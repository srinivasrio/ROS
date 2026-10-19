package com.dineinone.waiter.data.repository

import com.dineinone.waiter.core.AnyToStringSerializer
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.core.runCatchingOutcome
import com.dineinone.waiter.data.local.SessionManager
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.flow.first
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class ShiftOrderRow(
    @Serializable(with = AnyToStringSerializer::class) val id: String,
    @SerialName("table_id") @Serializable(with = AnyToStringSerializer::class) val tableId: String? = null,
    @SerialName("total_amount") val totalAmount: Double? = null,
    @SerialName("order_number") val orderNumber: Long? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class ShiftRequestRow(
    @Serializable(with = AnyToStringSerializer::class) val id: String,
    @SerialName("request_type") val requestType: String? = null,
    @SerialName("request_status") val requestStatus: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

data class ShiftStats(
    val ordersHandled: Int,
    val tablesServed: Int,
    val requestsResolved: Int,
    val pendingTasks: Int,
    val totalSales: Double,
    val startedAt: String?,
    val orders: List<ShiftOrderRow>,
    val requests: List<ShiftRequestRow>,
)

@Singleton
class ShiftRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val session: SessionManager,
) {
    suspend fun fetchToday(): Outcome<ShiftStats> = runCatchingOutcome {
        val s = session.sessionFlow.first() ?: error("Not signed in")
        val rid = s.restaurantId
        val waiterId = s.userId
        val todayStart = LocalDate.now(ZoneId.systemDefault()).atStartOfDay(ZoneId.systemDefault()).toInstant().toString()

        val isUuid = waiterId.matches(Regex("^[0-9a-fA-F-]{36}$"))

        val orders = if (isUuid) {
            supabase.from("orders")
                .select(Columns.list("id", "table_id", "total_amount", "order_number", "created_at")) {
                    filter { eq("restaurant_id", rid); eq("waiter_id", waiterId); gte("created_at", todayStart) }
                    order("created_at", Order.DESCENDING)
                    limit(100)
                }.decodeList<ShiftOrderRow>()
        } else emptyList()

        val requests = if (isUuid) {
            supabase.from("service_requests")
                .select(Columns.list("id", "request_type", "request_status", "created_at")) {
                    filter { eq("restaurant_id", rid); eq("assigned_waiter_id", waiterId); gte("created_at", todayStart) }
                    order("created_at", Order.DESCENDING)
                    limit(100)
                }.decodeList<ShiftRequestRow>()
        } else emptyList()

        ShiftStats(
            ordersHandled = orders.size,
            tablesServed = orders.mapNotNull { it.tableId }.distinct().size,
            requestsResolved = requests.count { it.requestStatus.equals("completed", true) },
            pendingTasks = requests.count { it.requestStatus.equals("pending", true) || it.requestStatus.equals("accepted", true) },
            totalSales = orders.sumOf { it.totalAmount ?: 0.0 },
            startedAt = orders.minByOrNull { it.createdAt ?: "" }?.createdAt,
            orders = orders,
            requests = requests,
        )
    }
}
