package com.dineinone.waiter.data.repository

import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.core.runCatchingOutcome
import com.dineinone.waiter.data.local.CartManager
import com.dineinone.waiter.data.local.SessionManager
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID

@Serializable
private data class OrderIdRow(val id: String? = null, val total_amount: Double? = null)

@Serializable
private data class CreateOrderResponse(
    val id: String? = null,
    val success: Boolean? = null,
    val total_amount: Double? = null,
    val is_duplicate: Boolean? = null,
)

/**
 * Places orders directly against Supabase, mirroring the existing waiter web app:
 * executes canonical create_order_v2 atomic RPC so kitchen KDS, live orders,
 * customer, and admin tables immediately sync via Supabase Realtime.
 */
data class SubmittedOrderInfo(
    val orderId: String,
    val tableId: String,
    val totalAmount: Double,
    val itemCount: Int,
)

@Singleton
class OrderRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val session: SessionManager,
) {
    private val uuidRegex = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    private val jsonParser = Json { ignoreUnknownKeys = true }

    suspend fun submit(tableId: String?, lines: List<CartManager.Line>, notes: String): Outcome<SubmittedOrderInfo> = runCatchingOutcome {
        require(lines.isNotEmpty()) { "Cart is empty" }
        val s = session.sessionFlow.first() ?: error("Not signed in")
        val rid = s.restaurantId
        val waiterId = s.userId.takeIf { uuidRegex.matches(it) }
        val parsedTableId = tableId?.toLongOrNull()

        val subtotal = lines.sumOf { it.lineTotal }
        val gst = subtotal * 0.05
        val grand = subtotal + gst
        val now = Instant.now().toString()

        // 1. Find an active order for this table to append to if one exists.
        val existing: OrderIdRow? = if (parsedTableId != null) {
            supabase.from("orders").select(Columns.list("id", "total_amount")) {
                filter {
                    eq("restaurant_id", rid)
                    eq("is_completed", false)
                    eq("table_id", parsedTableId)
                    isIn("status", listOf("placed", "preparing", "ready", "served"))
                }
                order("created_at", Order.DESCENDING)
                limit(1)
            }.decodeList<OrderIdRow>().firstOrNull()
        } else null

        val itemsPayload = buildJsonArray {
            lines.forEach { line ->
                add(buildJsonObject {
                    line.item.id.toLongOrNull()?.let { put("menu_item_id", it) }
                    put("quantity", line.qty)
                    put("price", line.item.effectivePrice)
                    put("notes", notes)
                    put("item_type", line.item.itemType ?: "standard")
                    put("tax_percent", 5.0)
                    put("cgst_percent", 2.5)
                    put("sgst_percent", 2.5)
                })
            }
        }

        val rpcParams = buildJsonObject {
            put("p_restaurant_id", rid)
            put("p_transaction_id", UUID.randomUUID().toString())
            put("p_items", itemsPayload)
            if (parsedTableId != null) put("p_table_id", parsedTableId)
            put("p_order_type", "DINE_IN")
            put("p_status", "placed")
            if (waiterId != null) put("p_waiter_id", waiterId)
            if (existing?.id != null) put("p_active_order_id", existing.id)
        }

        var orderId: String? = null
        var finalTotal: Double = grand

        // Execute canonical create_order_v2 RPC (P1-02 atomic transaction)
        try {
            val rpcRes = supabase.postgrest.rpc("create_order_v2", rpcParams)
            val decoded = jsonParser.decodeFromString<CreateOrderResponse>(rpcRes.data)
            if (decoded.id != null) {
                orderId = decoded.id
                if (decoded.total_amount != null && decoded.total_amount > 0) {
                    finalTotal = decoded.total_amount
                }
            }
        } catch (rpcErr: Exception) {
            android.util.Log.w("OrderRepository", "create_order_v2 RPC failed, falling back to direct write: ${rpcErr.message}")
            // Fallback: direct write to orders and order_items
            if (existing?.id != null) {
                val newTotal = (existing.total_amount ?: 0.0) + grand
                finalTotal = newTotal
                supabase.from("orders").update(buildJsonObject {
                    put("total_amount", newTotal)
                    put("status", "placed")
                    if (waiterId != null) put("waiter_id", waiterId)
                }) { filter { eq("id", existing.id) } }
                orderId = existing.id
            } else {
                val payload = buildJsonObject {
                    put("restaurant_id", rid)
                    put("status", "placed")
                    put("order_type", "DINE_IN")
                    put("total_amount", grand)
                    put("gst_amount", gst)
                    put("cgst_amount", gst / 2.0)
                    put("sgst_amount", gst / 2.0)
                    put("is_completed", false)
                    put("created_at", now)
                    if (parsedTableId != null) put("table_id", parsedTableId)
                    if (waiterId != null) put("waiter_id", waiterId)
                }
                orderId = supabase.from("orders").insert(payload) { select(Columns.list("id")) }
                    .decodeList<OrderIdRow>().firstOrNull()?.id ?: error("Order not created")
            }

            // Insert order items
            val items: List<JsonObject> = lines.map { line ->
                buildJsonObject {
                    put("order_id", orderId)
                    put("restaurant_id", rid)
                    put("quantity", line.qty)
                    put("price_at_time", line.item.effectivePrice)
                    put("status", "placed")
                    put("notes", notes)
                    put("item_type", line.item.itemType ?: "standard")
                    put("tax_percent", 5.0)
                    put("cgst_percent", 2.5)
                    put("sgst_percent", 2.5)
                    put("created_at", now)
                    line.item.id.toLongOrNull()?.let { put("menu_item_id", it) }
                }
            }
            supabase.from("order_items").insert(items)

            // Mark table occupied
            if (parsedTableId != null) {
                supabase.from("tables").update(buildJsonObject {
                    put("status", "occupied")
                    put("last_activity_at", now)
                    if (waiterId != null) put("assigned_waiter_id", waiterId)
                }) { filter { eq("id", parsedTableId); eq("restaurant_id", rid) } }
            }
        }

        SubmittedOrderInfo(
            orderId = orderId ?: error("Order submission produced no order ID"),
            tableId = tableId ?: "",
            totalAmount = finalTotal,
            itemCount = lines.sumOf { it.qty },
        )
    }
}
