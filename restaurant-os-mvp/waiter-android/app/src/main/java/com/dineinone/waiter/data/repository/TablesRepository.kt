package com.dineinone.waiter.data.repository

import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.core.friendlyError
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.local.db.CacheStore
import com.dineinone.waiter.data.remote.dto.AreaDto
import com.dineinone.waiter.data.remote.dto.TableDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.flow.onStart
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TablesRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val session: SessionManager,
    private val cache: CacheStore,
) {
    private val tableIdToNumber = java.util.concurrent.ConcurrentHashMap<String, String>()

    fun cacheTable(id: String, number: String) {
        if (id.isNotBlank() && number.isNotBlank()) {
            tableIdToNumber[id] = number
        }
    }

    fun resolveTableNumber(tableId: String?): String {
        if (tableId.isNullOrBlank()) return "?"
        return tableIdToNumber[tableId] ?: tableId
    }

    private suspend fun restaurantId(): String = session.sessionFlow.first()?.restaurantId.orEmpty()

    suspend fun fetchTables(): Outcome<List<TableDto>> {
        val rid = restaurantId()
        val key = "tables:$rid"
        return try {
            val list = try {
                supabase.postgrest.rpc(
                    "get_tables_by_restaurant",
                    buildJsonObject { put("p_restaurant_id", rid) }
                ).decodeList<TableDto>()
            } catch (_: Exception) {
                supabase.from("tables")
                    .select(Columns.raw("*, restaurant_areas(name)")) {
                        filter { eq("restaurant_id", rid) }
                        order("table_number", Order.ASCENDING)
                    }
                    .decodeList<TableDto>()
            }
            list.forEach { t ->
                val num = t.tableNumber ?: t.id
                tableIdToNumber[t.id] = num
            }
            cache.putList(key, list)
            Outcome.Success(list)
        } catch (e: Exception) {
            cache.getList<TableDto>(key)?.let { cached ->
                cached.forEach { t ->
                    val num = t.tableNumber ?: t.id
                    tableIdToNumber[t.id] = num
                }
                return Outcome.Success(cached)
            }
            Outcome.Error(friendlyError(e.message))
        }
    }

    suspend fun fetchAreas(): Outcome<List<AreaDto>> {
        val rid = restaurantId()
        val key = "areas:$rid"
        return try {
            val list = try {
                supabase.postgrest.rpc(
                    "get_areas_by_restaurant",
                    buildJsonObject { put("p_restaurant_id", rid) }
                ).decodeList<AreaDto>()
            } catch (_: Exception) {
                supabase.from("restaurant_areas")
                    .select(Columns.ALL) {
                        filter { eq("restaurant_id", rid) }
                        order("display_order", Order.ASCENDING)
                    }
                    .decodeList<AreaDto>()
            }
            cache.putList(key, list)
            Outcome.Success(list)
        } catch (e: Exception) {
            cache.getList<AreaDto>(key)?.let { return Outcome.Success(it) }
            Outcome.Error(friendlyError(e.message))
        }
    }

    /** Emits once per table or order change for this restaurant; collector should refetch. */
    fun tableChanges(restaurantId: String): Flow<Unit> {
        val tablesChannel = supabase.channel("waiter-tables-$restaurantId")
        val tablesChanges = tablesChannel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "tables"
            filter("restaurant_id", io.github.jan.supabase.postgrest.query.filter.FilterOperator.EQ, restaurantId)
        }.map { }.onStart { tablesChannel.subscribe() }.onCompletion { runCatching { tablesChannel.unsubscribe() } }

        val ordersChannel = supabase.channel("waiter-orders-$restaurantId")
        val ordersChanges = ordersChannel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "orders"
            filter("restaurant_id", io.github.jan.supabase.postgrest.query.filter.FilterOperator.EQ, restaurantId)
        }.map { }.onStart { ordersChannel.subscribe() }.onCompletion { runCatching { ordersChannel.unsubscribe() } }

        return kotlinx.coroutines.flow.merge(tablesChanges, ordersChanges)
    }

    suspend fun mergeTables(tableIds: List<String>): Outcome<Unit> = try {
        val r = restaurantId()
        require(tableIds.size >= 2) { "Select at least 2 tables to merge" }
        
        // 1. Fetch tables to compute total capacity and name
        val tables = supabase.from("tables").select(Columns.list("id", "table_number", "capacity")) {
            filter {
                isIn("id", tableIds.mapNotNull { it.toLongOrNull() ?: it })
                eq("restaurant_id", r)
            }
        }.decodeList<TableDto>()

        val totalCapacity = tables.sumOf { it.capacity ?: 4 }
        val sortedNumbers = tables.map { it.number }.sortedWith { a, b ->
            (a.toIntOrNull() ?: 0).compareTo(b.toIntOrNull() ?: 0)
        }
        val displayName = "Table ${sortedNumbers.joinToString("+")}"
        val mergeGroupId = java.util.UUID.randomUUID().toString()

        // 2. Insert into table_merge_groups
        supabase.from("table_merge_groups").insert(buildJsonObject {
            put("id", mergeGroupId)
            put("display_name", displayName)
            put("total_capacity", totalCapacity)
            put("status", "available")
            put("restaurant_id", r)
        })

        // 3. Update physical tables to mark is_merged = true, merged_group_id = mergeGroupId
        supabase.from("tables").update(buildJsonObject {
            put("is_merged", true)
            put("merged_group_id", mergeGroupId)
            put("last_activity_at", java.time.Instant.now().toString())
        }) {
            filter {
                isIn("id", tableIds.mapNotNull { it.toLongOrNull() ?: it })
                eq("restaurant_id", r)
            }
        }
        Outcome.Success(Unit)
    } catch (e: Exception) {
        Outcome.Error(friendlyError(e.message))
    }

    suspend fun unmergeTables(mergeGroupId: String): Outcome<Unit> = try {
        val r = restaurantId()
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
        Outcome.Success(Unit)
    } catch (e: Exception) {
        Outcome.Error(friendlyError(e.message))
    }
}
