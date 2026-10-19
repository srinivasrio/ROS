package com.dineinone.waiter.data.repository

import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.core.runCatchingOutcome
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.remote.dto.RequestDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.flow.onStart
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RequestsRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val session: SessionManager,
) {
    private suspend fun rid(): String = session.sessionFlow.first()?.restaurantId.orEmpty()

    suspend fun fetch(): Outcome<List<RequestDto>> = runCatchingOutcome {
        val r = rid()
        supabase.from("service_requests")
            .select(Columns.raw("id,table_id,table_number,request_type,request_status,quantity,notes,assigned_waiter_id,created_at,tables(table_number)")) {
                filter { eq("restaurant_id", r) }
                order("created_at", Order.DESCENDING)
                limit(60)
            }
            .decodeList<RequestDto>()
    }

    suspend fun accept(id: String): Outcome<Unit> = runCatchingOutcome {
        val waiterId = session.sessionFlow.first()?.userId
        supabase.from("service_requests").update(buildJsonObject {
            put("request_status", "accepted")
            put("accepted_at", Instant.now().toString())
            if (waiterId != null && waiterId.matches(Regex("^[0-9a-fA-F-]{36}$"))) {
                put("accepted_by", waiterId); put("assigned_waiter_id", waiterId)
            }
        }) { filter { eq("id", id.toLongOrNull() ?: id) } }
    }

    suspend fun complete(id: String): Outcome<Unit> = runCatchingOutcome {
        supabase.from("service_requests").update(buildJsonObject {
            put("request_status", "completed")
            put("completed_at", Instant.now().toString())
        }) { filter { eq("id", id.toLongOrNull() ?: id) } }
    }

    // ── Table access (Supabase RPCs, mirroring the web app) ──
    suspend fun requestAccess(tableId: String): Outcome<Unit> = runCatchingOutcome {
        val s = session.sessionFlow.first() ?: error("Not signed in")
        supabase.postgrest.rpc("request_table_access", buildJsonObject {
            put("p_table_id", tableId.toLongOrNull() ?: 0L)
            put("p_requester_id", s.userId)
            put("p_requester_name", s.name)
            put("p_restaurant_id", s.restaurantId)
        })
    }

    suspend fun approveAccess(requestId: String, transferType: String = "share"): Outcome<Unit> = runCatchingOutcome {
        val s = session.sessionFlow.first() ?: error("Not signed in")
        supabase.postgrest.rpc("approve_table_access", buildJsonObject {
            put("p_request_id", requestId.toLongOrNull() ?: 0L)
            put("p_approver_id", s.userId)
            put("p_transfer_type", transferType)
        })
    }

    suspend fun declineAccess(requestId: String): Outcome<Unit> = runCatchingOutcome {
        val s = session.sessionFlow.first() ?: error("Not signed in")
        supabase.postgrest.rpc("decline_table_access", buildJsonObject {
            put("p_request_id", requestId.toLongOrNull() ?: 0L)
            put("p_decliner_id", s.userId)
        })
    }

    val readyEvents = kotlinx.coroutines.flow.MutableSharedFlow<com.dineinone.waiter.ui.components.ReadyDishEvent>(extraBufferCapacity = 10)
    val serviceEvents = kotlinx.coroutines.flow.MutableSharedFlow<com.dineinone.waiter.ui.components.CustomerServiceAlertEvent>(extraBufferCapacity = 10)
    private val emittedAlertKeys = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()

    fun emitReadyDish(event: com.dineinone.waiter.ui.components.ReadyDishEvent) {
        val key = "ready_${event.requestId ?: "${event.tableId}_${event.itemName}"}_${event.quantity}"
        if (emittedAlertKeys.add(key)) {
            android.util.Log.d("RequestsRepo", "Emitting unique ready dish event: $key")
            readyEvents.tryEmit(event)
        } else {
            android.util.Log.d("RequestsRepo", "Suppressed duplicate ready dish event: $key")
        }
    }

    fun emitServiceAlert(event: com.dineinone.waiter.ui.components.CustomerServiceAlertEvent) {
        val key = "service_${event.id}_${event.quantity}"
        if (emittedAlertKeys.add(key)) {
            android.util.Log.d("RequestsRepo", "Emitting unique service alert event: $key")
            serviceEvents.tryEmit(event)
        } else {
            android.util.Log.d("RequestsRepo", "Suppressed duplicate service alert event: $key")
        }
    }

    fun changes(restaurantId: String): Flow<PostgresAction> {
        val ch = supabase.channel("waiter-feed-$restaurantId")
        val reqFlow = ch.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "service_requests"
        }
        val ordersFlow = ch.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "orders"
        }
        val itemsFlow = ch.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "order_items"
        }
        return kotlinx.coroutines.flow.merge(reqFlow, ordersFlow, itemsFlow)
            .onStart { ch.subscribe() }
            .onCompletion { runCatching { ch.unsubscribe() } }
    }
}
