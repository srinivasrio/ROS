package com.dineinone.waiter.data.repository

import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.core.runCatchingOutcome
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.remote.dto.OrderDto
import com.dineinone.waiter.data.remote.dto.TableDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.flow.onStart
import com.dineinone.waiter.data.remote.dto.WaiterStaffDto
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TableDetailRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val session: SessionManager,
) {
    private suspend fun rid(): String = session.sessionFlow.first()?.restaurantId.orEmpty()

    private val orderEmbed = Columns.raw(
        "id,status,total_amount,gst_amount,cgst_amount,sgst_amount,service_charge,discount_amount,amount_paid,created_at,order_number,is_completed," +
            "order_items(id,quantity,price_at_time,status,notes,combo_name,combo_items,menu_items(name,image_url,item_type))"
    )

    suspend fun fetchTable(tableId: String): Outcome<TableDto> = runCatchingOutcome {
        supabase.from("tables")
            .select(Columns.raw("*, restaurant_areas(name)")) {
                filter { eq("id", tableId.toLongOrNull() ?: tableId) }
                limit(1)
            }
            .decodeList<TableDto>()
            .firstOrNull() ?: error("Table not found")
    }

    /** Latest order for the table (active or just-paid), with its items. */
    suspend fun fetchLatestOrder(tableId: String): Outcome<OrderDto?> = runCatchingOutcome {
        val r = rid()
        supabase.from("orders")
            .select(orderEmbed) {
                filter {
                    eq("restaurant_id", r)
                    eq("table_id", tableId.toLongOrNull() ?: tableId)
                }
                order("created_at", Order.DESCENDING)
                limit(1)
            }
            .decodeList<OrderDto>()
            .firstOrNull()
    }

    suspend fun markItemStatus(itemId: String, status: String): Outcome<Unit> = runCatchingOutcome {
        val now = java.time.Instant.now().toString()
        supabase.from("order_items").update(buildJsonObject {
            put("status", status)
            if (status == "served") put("served_at", now)
        }) {
            filter { eq("id", itemId.toLongOrNull() ?: itemId) }
        }
    }

    suspend fun unmergeTables(mergeGroupId: String): Outcome<Unit> = runCatchingOutcome {
        val r = rid()
        supabase.from("tables").update(buildJsonObject {
            put("is_merged", false)
            put("merged_group_id", null)
            put("status", "available")
            put("last_activity_at", java.time.Instant.now().toString())
        }) {
            filter {
                eq("merged_group_id", mergeGroupId)
                eq("restaurant_id", r)
            }
        }
        supabase.from("table_merge_groups").delete {
            filter {
                eq("id", mergeGroupId)
                eq("restaurant_id", r)
            }
        }
    }

    suspend fun markOrderServed(orderId: String): Outcome<Unit> = runCatchingOutcome {
        supabase.from("order_items").update(buildJsonObject { put("status", "served") }) { filter { eq("order_id", orderId) } }
        supabase.from("orders").update(buildJsonObject { put("status", "served") }) { filter { eq("id", orderId) } }
    }

    suspend fun fetchRestaurantStaff(): Outcome<List<WaiterStaffDto>> = runCatchingOutcome {
        val r = rid()
        supabase.from("staff")
            .select(Columns.raw("id, name, role, employee_id, avatar_url, is_online, status")) {
                filter {
                    eq("restaurant_id", r)
                    eq("status", "active")
                }
            }
            .decodeList<WaiterStaffDto>()
    }

    suspend fun transferTableAccess(tableId: String, newWaiterId: String, currentWaiterId: String): Outcome<Unit> = runCatchingOutcome {
        val r = rid()
        val tId = tableId.toLongOrNull() ?: tableId
        supabase.from("tables").update(buildJsonObject {
            put("assigned_waiter_id", newWaiterId)
            put("transferred_to_waiter_id", newWaiterId)
            put("transferred_from_waiter_id", currentWaiterId)
        }) {
            filter { eq("id", tId) }
        }
        runCatching {
            supabase.from("orders").update(buildJsonObject {
                put("waiter_id", newWaiterId)
            }) {
                filter {
                    eq("restaurant_id", r)
                    eq("table_id", tId)
                    neq("status", "paid")
                    neq("status", "cancelled")
                }
            }
        }
        Unit
    }

    suspend fun giveTableAccess(tableId: String, waiterId: String, currentCoWaiterIds: List<String>): Outcome<Unit> = runCatchingOutcome {
        val tId = tableId.toLongOrNull() ?: tableId
        val updated = (currentCoWaiterIds + waiterId).distinct()
        supabase.from("tables").update(buildJsonObject {
            put("co_waiter_ids", JsonArray(updated.map { JsonPrimitive(it) }))
        }) {
            filter { eq("id", tId) }
        }
        Unit
    }

    suspend fun revokeTableAccess(tableId: String, waiterId: String, currentCoWaiterIds: List<String>): Outcome<Unit> = runCatchingOutcome {
        val tId = tableId.toLongOrNull() ?: tableId
        val updated = currentCoWaiterIds.filter { it != waiterId }
        supabase.from("tables").update(buildJsonObject {
            put("co_waiter_ids", JsonArray(updated.map { JsonPrimitive(it) }))
        }) {
            filter { eq("id", tId) }
        }
        Unit
    }

    fun changes(tableId: String, restaurantId: String): Flow<Unit> {
        val ordersCh = supabase.channel("td-orders-$tableId")
        val ordersFlow = ordersCh.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "orders"
            filter("table_id", FilterOperator.EQ, tableId)
        }.map { }.onStart { ordersCh.subscribe() }.onCompletion { runCatching { ordersCh.unsubscribe() } }

        val itemsCh = supabase.channel("td-items-$restaurantId")
        val itemsFlow = itemsCh.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "order_items"
            filter("restaurant_id", FilterOperator.EQ, restaurantId)
        }.map { }.onStart { itemsCh.subscribe() }.onCompletion { runCatching { itemsCh.unsubscribe() } }

        return merge(ordersFlow, itemsFlow)
    }
}
