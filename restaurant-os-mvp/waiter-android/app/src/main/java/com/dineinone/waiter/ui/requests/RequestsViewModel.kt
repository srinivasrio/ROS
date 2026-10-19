package com.dineinone.waiter.ui.requests

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.remote.dto.RequestDto
import com.dineinone.waiter.data.repository.RequestsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

import android.util.Log
import io.github.jan.supabase.realtime.HasRecord
import io.github.jan.supabase.realtime.PostgresAction
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

import com.dineinone.waiter.data.repository.TablesRepository

enum class ReqFilter { ALL, PENDING, IN_PROGRESS, COMPLETED }

data class RequestsUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val all: List<RequestDto> = emptyList(),
    val filter: ReqFilter = ReqFilter.ALL,
) {
    val pending get() = all.count { it.isPending }
    val inProgress get() = all.count { it.isAccepted }
    val completed get() = all.count { it.isCompleted }
    val visible: List<RequestDto> get() = when (filter) {
        ReqFilter.ALL -> all
        ReqFilter.PENDING -> all.filter { it.isPending }
        ReqFilter.IN_PROGRESS -> all.filter { it.isAccepted }
        ReqFilter.COMPLETED -> all.filter { it.isCompleted }
    }
}

@HiltViewModel
class RequestsViewModel @Inject constructor(
    private val repo: RequestsRepository,
    private val session: SessionManager,
    private val tablesRepo: TablesRepository,
) : ViewModel() {

    private val _ui = MutableStateFlow(RequestsUiState())
    val ui: StateFlow<RequestsUiState> = _ui.asStateFlow()

    val pendingCount: StateFlow<Int> = MutableStateFlow(0)
    val readyEvents = repo.readyEvents
    val serviceEvents = repo.serviceEvents
    private val notifiedRequestIds = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
    private var initialLoadCompleted = false

    val restaurantName: StateFlow<String> = session.sessionFlow
        .map { it?.restaurantName?.ifBlank { "Dine in One" } ?: "Dine in One" }
        .stateIn(viewModelScope, SharingStarted.Eagerly, "Dine in One")

    val waiterName: StateFlow<String> = session.sessionFlow
        .map { it?.name?.ifBlank { "Waiter" } ?: "Waiter" }
        .stateIn(viewModelScope, SharingStarted.Eagerly, "Waiter")

    val avatarUrl: StateFlow<String?> = session.sessionFlow
        .map { it?.avatarUrl }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val logoUrl: StateFlow<String?> = session.sessionFlow
        .map { it?.logoUrl }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    init {
        viewModelScope.launch { tablesRepo.fetchTables() }
        load()
        observe()
        startPollingHeartbeat()
    }

    private fun isRecentRequest(createdAt: String?): Boolean {
        if (createdAt.isNullOrBlank()) return true
        return try {
            val normalized = createdAt.trim().replace(' ', 'T')
            val withOffset = if (normalized.endsWith("+00")) normalized + ":00" else normalized
            val instant = try {
                java.time.OffsetDateTime.parse(withOffset).toInstant()
            } catch (_: Exception) {
                try {
                    java.time.Instant.parse(withOffset)
                } catch (_: Exception) {
                    val clean = normalized.substringBefore('+').substringBefore('Z')
                    java.time.LocalDateTime.parse(clean).toInstant(java.time.ZoneOffset.UTC)
                }
            }
            val ageSeconds = java.time.Duration.between(instant, java.time.Instant.now()).seconds
            // Allow active requests created in last 2 hours
            ageSeconds in -120..7200
        } catch (_: Exception) {
            true // If parsing fails, never suppress an alert!
        }
    }

    fun load() {
        viewModelScope.launch {
            Log.d("RequestsViewModel", "load() triggered, calling repo.fetch()...")
            when (val r = repo.fetch()) {
                is Outcome.Success -> {
                    val items = r.data
                    Log.d("RequestsViewModel", "repo.fetch() succeeded, fetched ${items.size} items. initialLoadCompleted=$initialLoadCompleted")
                    _ui.value = _ui.value.copy(loading = false, all = items, error = null)
                    (pendingCount as MutableStateFlow).value = items.count { it.isPending }

                    if (!initialLoadCompleted) {
                        initialLoadCompleted = true
                        for (req in items) {
                            if (!req.tableId.isNullOrBlank() && !req.tableNumberRaw.isNullOrBlank()) {
                                tablesRepo.cacheTable(req.tableId, req.tableNumberRaw)
                            }
                            if (!isRecentRequest(req.createdAt) || !req.isPending) {
                                notifiedRequestIds.add("${req.id}_qty_${req.quantity}")
                                notifiedRequestIds.add(req.id)
                            }
                        }
                    }

                    // Process pending requests that haven't been notified yet
                    val pendingToNotify = items.filter { 
                        val alertKey = "${it.id}_qty_${it.quantity}"
                        it.isPending && !notifiedRequestIds.contains(alertKey) && !notifiedRequestIds.contains(it.id)
                    }
                    Log.d("RequestsViewModel", "pendingToNotify count: ${pendingToNotify.size}")
                    for (req in pendingToNotify) {
                        notifiedRequestIds.add(req.id)
                        notifiedRequestIds.add("${req.id}_qty_${req.quantity}")
                        val type = (req.requestType ?: "").lowercase().trim()
                        val resolvedTableNum = req.tableNumber.takeIf { it.isNotBlank() && it != req.tableId }
                            ?: tablesRepo.resolveTableNumber(req.tableId)
                        Log.d("RequestsViewModel", "Dispatching alert for req #${req.id} type=$type table=$resolvedTableNum")
                        if (type == "order_ready" || type == "dish_ready") {
                            repo.emitReadyDish(
                                com.dineinone.waiter.ui.components.ReadyDishEvent(
                                    requestId = req.id,
                                    tableId = req.tableId.orEmpty(),
                                    tableNumber = resolvedTableNum,
                                    itemName = req.notes ?: "Food Order",
                                    quantity = req.quantity
                                )
                            )
                        } else {
                            repo.emitServiceAlert(
                                com.dineinone.waiter.ui.components.CustomerServiceAlertEvent(
                                    id = req.id,
                                    tableId = req.tableId.orEmpty(),
                                    tableNumber = resolvedTableNum,
                                    serviceType = req.requestType.orEmpty(),
                                    title = com.dineinone.waiter.ui.components.ServiceHelper.labelFor(req.requestType),
                                    quantity = req.quantity,
                                    notes = req.notes,
                                    isTableAccess = type == "table_access_request"
                                )
                            )
                        }
                    }
                }
                is Outcome.Error -> {
                    Log.e("RequestsViewModel", "repo.fetch() FAILED: ${r.message}")
                    _ui.value = _ui.value.copy(loading = false, error = r.message)
                }
            }
        }
    }

    private fun handleRealtimeAction(action: PostgresAction, restaurantId: String) {
        if (action is HasRecord) {
            val rec = action.record
            val resId = rec["restaurant_id"]?.jsonPrimitive?.contentOrNull
            if (resId != null && resId != restaurantId) return

            // 1. service_requests table
            if (rec.containsKey("request_type")) {
                val status = rec["request_status"]?.jsonPrimitive?.contentOrNull ?: "pending"
                val id = rec["id"]?.jsonPrimitive?.contentOrNull ?: ""
                val qty = rec["quantity"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: 1
                val alertKey = "${id}_qty_${qty}"
                Log.d("RequestsViewModel", "Realtime service_requests action: id=$id status=$status qty=$qty")
                if (status.equals("pending", true) && id.isNotBlank()) {
                    if (!notifiedRequestIds.contains(alertKey)) {
                        notifiedRequestIds.add(id)
                        notifiedRequestIds.add(alertKey)
                        val reqType = rec["request_type"]?.jsonPrimitive?.contentOrNull ?: ""
                        val tableId = rec["table_id"]?.jsonPrimitive?.contentOrNull ?: ""
                        val rawTableNum = rec["table_number"]?.jsonPrimitive?.contentOrNull
                        val tableNum = if (!rawTableNum.isNullOrBlank() && rawTableNum != tableId) {
                            tablesRepo.cacheTable(tableId, rawTableNum)
                            rawTableNum
                        } else {
                            tablesRepo.resolveTableNumber(tableId).takeIf { it.isNotBlank() && it != tableId }
                                ?: tableId
                        }
                        val notes = rec["notes"]?.jsonPrimitive?.contentOrNull

                        if (reqType.equals("order_ready", true) || reqType.equals("dish_ready", true)) {
                            repo.emitReadyDish(
                                com.dineinone.waiter.ui.components.ReadyDishEvent(
                                    requestId = id,
                                    tableId = tableId,
                                    tableNumber = tableNum,
                                    itemName = notes ?: "Food Order",
                                    quantity = qty
                                )
                            )
                        } else {
                            repo.emitServiceAlert(
                                com.dineinone.waiter.ui.components.CustomerServiceAlertEvent(
                                    id = id,
                                    tableId = tableId,
                                    tableNumber = tableNum,
                                    serviceType = reqType,
                                    title = com.dineinone.waiter.ui.components.ServiceHelper.labelFor(reqType),
                                    quantity = qty,
                                    notes = notes,
                                    isTableAccess = reqType.equals("table_access_request", true)
                                )
                            )
                        }
                    }
                }
                load()
            }
            // 2. orders table (kitchen marks order ready or order status updates)
            else if (rec.containsKey("total_amount") || rec.containsKey("order_number") || rec.containsKey("is_completed")) {
                val status = rec["status"]?.jsonPrimitive?.contentOrNull
                Log.d("RequestsViewModel", "Realtime orders action: status=$status, reloading...")
                load()
            }
            // 3. order_items table (kitchen marks dish ready or item status updates)
            else if (rec.containsKey("price_at_time") || rec.containsKey("order_id")) {
                val status = rec["status"]?.jsonPrimitive?.contentOrNull
                Log.d("RequestsViewModel", "Realtime order_items action: status=$status, reloading...")
                load()
            }
        } else {
            load()
        }
    }

    private fun observe() {
        viewModelScope.launch {
            session.sessionFlow.filterNotNull()
                .map { it.restaurantId }
                .distinctUntilChanged()
                .collectLatest { rid ->
                    if (rid.isNotBlank()) {
                        while (isActive) {
                            try {
                                Log.d("RequestsViewModel", "Starting Realtime subscription for restaurant $rid")
                                repo.changes(rid).collect { action ->
                                    handleRealtimeAction(action, rid)
                                }
                            } catch (e: CancellationException) {
                                throw e
                            } catch (e: Exception) {
                                Log.w("RequestsViewModel", "Realtime connection error, retrying in 2s: ${e.message}")
                                delay(2000)
                            }
                        }
                    }
                }
        }
    }

    private fun startPollingHeartbeat() {
        viewModelScope.launch {
            while (isActive) {
                delay(15000)
                load()
            }
        }
    }

    fun setFilter(f: ReqFilter) { _ui.value = _ui.value.copy(filter = f) }
    fun accept(id: String) = viewModelScope.launch { repo.accept(id); load() }
    fun complete(id: String) = viewModelScope.launch { repo.complete(id); load() }
    fun approveAccess(id: String) = viewModelScope.launch { repo.approveAccess(id); load() }
    fun declineAccess(id: String) = viewModelScope.launch { repo.declineAccess(id); load() }
}
