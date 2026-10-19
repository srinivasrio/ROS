package com.dineinone.waiter.data.repository

import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.core.runCatchingOutcome
import com.dineinone.waiter.data.local.SessionManager
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/** Bill settlement + table clearing, mirroring the web app's Supabase writes. */
@Singleton
class PaymentRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val session: SessionManager,
) {
    private suspend fun rid(): String = session.sessionFlow.first()?.restaurantId.orEmpty()

    suspend fun settle(
        orderId: String,
        tableId: String?,
        method: String,
        amountPaid: Double,
        paidBy: String,
        totalAmount: Double? = null,
        gstAmount: Double? = null,
        cgstAmount: Double? = null,
        sgstAmount: Double? = null,
    ): Outcome<Unit> = runCatchingOutcome {
        val rid = rid()
        val now = Instant.now().toString()
        supabase.from("orders").update(buildJsonObject {
            put("status", "paid")
            put("amount_paid", amountPaid)
            if (totalAmount != null) put("total_amount", totalAmount)
            if (gstAmount != null) put("gst_amount", gstAmount)
            if (cgstAmount != null) put("cgst_amount", cgstAmount)
            if (sgstAmount != null) put("sgst_amount", sgstAmount)
            put("payment_method", method)
            put("paid_by", paidBy)
            put("completed_at", now)
        }) { filter { eq("id", orderId); eq("restaurant_id", rid) } }

        supabase.from("order_items").update(buildJsonObject { put("status", "served") }) { filter { eq("order_id", orderId) } }

        // Note: the table stays "occupied" until the waiter clears it (Clear Table → empty).
        // The 'cleaning' status is blocked for the app's key, and order.isPaid already drives
        // the Clear Table action, so we just mark the order paid here.
        tableId?.toLongOrNull()?.let { tid ->
            supabase.from("tables").update(buildJsonObject { put("last_activity_at", now) }) {
                filter { eq("id", tid); eq("restaurant_id", rid) }
            }
        }
    }

    suspend fun clearTable(tableId: String): Outcome<Unit> = runCatchingOutcome {
        val rid = rid()
        val now = Instant.now().toString()
        val tid = tableId.toLongOrNull()
        if (tid != null) {
            supabase.from("orders").update(buildJsonObject { put("is_completed", true); put("status", "paid") }) {
                filter { eq("table_id", tid); eq("restaurant_id", rid); eq("is_completed", false) }
            }
            supabase.from("tables").update(buildJsonObject {
                put("status", "empty"); put("last_activity_at", now)
                put("assigned_waiter_id", null as String?); put("customer_present_at", null as String?)
            }) { filter { eq("id", tid); eq("restaurant_id", rid) } }
        }
    }

    suspend fun fetchPaymentQrUrl(): String? = runCatching {
        val rid = rid()
        val row = supabase.from("restaurant_profile")
            .select(io.github.jan.supabase.postgrest.query.Columns.raw("restaurant_info")) { filter { eq("restaurant_id", rid) } }
            .decodeList<RestaurantProfileRow>()
            .firstOrNull()
        row?.restaurantInfo?.paymentQrUrl?.takeIf { it.isNotBlank() && it != "null" }
    }.getOrNull()
}

@kotlinx.serialization.Serializable
private data class RestaurantProfileInfo(
    @kotlinx.serialization.SerialName("payment_qr_url") val paymentQrUrl: String? = null,
    @kotlinx.serialization.SerialName("logo_url") val logoUrl: String? = null,
)

@kotlinx.serialization.Serializable
private data class RestaurantProfileRow(
    @kotlinx.serialization.SerialName("restaurant_info") val restaurantInfo: RestaurantProfileInfo? = null,
)

