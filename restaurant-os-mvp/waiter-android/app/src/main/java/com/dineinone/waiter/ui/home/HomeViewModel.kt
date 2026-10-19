package com.dineinone.waiter.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.remote.dto.TableDto
import com.dineinone.waiter.data.repository.TablesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

import com.dineinone.waiter.data.remote.dto.AreaDto

enum class TableFilter { ALL, MINE }

data class HomeUiState(
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    val error: String? = null,
    val tables: List<TableDto> = emptyList(),
    val areas: List<AreaDto> = emptyList(),
    val selectedAreaId: String? = null,
    val showAreaSheet: Boolean = false,
    val filter: TableFilter = TableFilter.ALL,
    val statusFilter: String? = null,
    val selectedTableIds: Set<String> = emptySet(),
    val unreadNotificationsCount: Int = 0,
    val isBellAnimating: Boolean = false,
) {
    val isSelectionMode: Boolean get() = selectedTableIds.isNotEmpty()

    val selectedAreaName: String?
        get() = areas.firstOrNull { it.id == selectedAreaId }?.name

    private fun areaFiltered(): List<TableDto> {
        val aid = selectedAreaId ?: return tables
        val aName = selectedAreaName
        return tables.filter { it.areaId == aid || (aName != null && it.areaName.equals(aName, ignoreCase = true)) }
    }

    private fun mine(list: List<TableDto>, userId: String) = list.filter { it.assignedWaiterId == userId }

    fun visible(userId: String): List<TableDto> {
        val byArea = areaFiltered()
        val base = if (filter == TableFilter.MINE) mine(byArea, userId) else byArea
        return if (!statusFilter.isNullOrBlank()) base.filter { norm(it.status) == statusFilter } else base
    }

    val currentTables: List<TableDto> get() = areaFiltered()
    val available get() = currentTables.count { norm(it.status) == "available" }
    val occupied get() = currentTables.count { norm(it.status) == "occupied" }
    val reserved get() = currentTables.count { norm(it.status) == "reserved" }
    fun mineCount(userId: String) = mine(currentTables, userId).size

    companion object {
        fun norm(s: String?): String = when ((s ?: "").lowercase()) {
            "empty", "available", "free" -> "available"
            "occupied", "ordered", "seated", "dining" -> "occupied"
            "reserved", "booked" -> "reserved"
            "on_hold", "hold" -> "on_hold"
            "dirty", "cleaning", "awaiting_clearing", "needs_clearing" -> "clearing"
            "paid", "bill_paid" -> "clearing"
            else -> (s ?: "").lowercase()
        }
    }
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repo: TablesRepository,
    private val authRepo: com.dineinone.waiter.data.repository.AuthRepository,
    private val requestsRepo: com.dineinone.waiter.data.repository.RequestsRepository,
    session: SessionManager,
) : ViewModel() {

    val session: StateFlow<SessionManager.Session?> =
        session.sessionFlow.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private val _ui = MutableStateFlow(HomeUiState())
    val ui: StateFlow<HomeUiState> = _ui.asStateFlow()

    init {
        load()
        observeRealtime()
        loadNotifications()
        viewModelScope.launch { authRepo.refreshStaffProfile() }
    }

    private fun loadNotifications() {
        viewModelScope.launch {
            when (val r = requestsRepo.fetch()) {
                is Outcome.Success -> {
                    val pendingCount = r.data.count { it.status == "pending" }
                    if (pendingCount > 0) {
                        _ui.value = _ui.value.copy(
                            unreadNotificationsCount = pendingCount,
                            isBellAnimating = true
                        )
                    }
                }
                else -> Unit
            }
        }
    }

    fun onBellOpened() {
        _ui.value = _ui.value.copy(isBellAnimating = false, unreadNotificationsCount = 0)
    }

    fun load(refresh: Boolean = false) {
        _ui.value = _ui.value.copy(loading = !refresh && _ui.value.tables.isEmpty(), refreshing = refresh, error = null)
        viewModelScope.launch {
            val tablesResult = repo.fetchTables()
            val areasResult = repo.fetchAreas()
            val newAreas = (areasResult as? Outcome.Success)?.data ?: emptyList()
            when (tablesResult) {
                is Outcome.Success -> _ui.value = _ui.value.copy(loading = false, refreshing = false, tables = tablesResult.data, areas = newAreas, error = null)
                is Outcome.Error -> _ui.value = _ui.value.copy(loading = false, refreshing = false, areas = newAreas, error = tablesResult.message)
            }
        }
        loadNotifications()
    }

    private fun observeRealtime() {
        viewModelScope.launch {
            session.collect { s ->
                val rid = s?.restaurantId
                if (!rid.isNullOrBlank()) {
                    runCatching {
                        repo.tableChanges(rid).collect { load(refresh = true) }
                    }
                }
            }
        }
    }

    fun setFilter(f: TableFilter) { _ui.value = _ui.value.copy(filter = f) }
    fun toggleStatusFilter(status: String) {
        _ui.value = _ui.value.copy(
            statusFilter = if (_ui.value.statusFilter == status) null else status
        )
    }
    fun openAreaSheet() { _ui.value = _ui.value.copy(showAreaSheet = true) }
    fun dismissAreaSheet() { _ui.value = _ui.value.copy(showAreaSheet = false) }
    fun selectArea(areaId: String?) {
        _ui.value = _ui.value.copy(selectedAreaId = areaId, showAreaSheet = false)
    }

    fun toggleSelectTable(tableId: String) {
        val current = _ui.value.selectedTableIds
        val next = if (current.contains(tableId)) current - tableId else current + tableId
        _ui.value = _ui.value.copy(selectedTableIds = next)
    }

    fun clearSelection() {
        _ui.value = _ui.value.copy(selectedTableIds = emptySet())
    }

    fun mergeSelectedTables() {
        val selected = _ui.value.selectedTableIds.toList()
        if (selected.size < 2) return
        viewModelScope.launch {
            _ui.value = _ui.value.copy(loading = true)
            repo.mergeTables(selected)
            clearSelection()
            load(refresh = true)
        }
    }
}
