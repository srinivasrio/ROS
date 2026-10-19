package com.dineinone.waiter.ui.access

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.remote.dto.TableDto
import com.dineinone.waiter.data.remote.dto.WaiterStaffDto
import com.dineinone.waiter.data.repository.RequestsRepository
import com.dineinone.waiter.data.repository.TableDetailRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AccessUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val successMessage: String? = null,
    val table: TableDto? = null,
    val myUserId: String = "",
    val allStaff: List<WaiterStaffDto> = emptyList(),
    val otherWaiters: List<WaiterStaffDto> = emptyList(),
    val assignedStaff: WaiterStaffDto? = null,
    val submitting: Boolean = false,
    val requestSent: Boolean = false,
    val actionWaiterId: String? = null,
) {
    val assignedToOther: Boolean
        get() = !table?.assignedWaiterId.isNullOrBlank() && table?.assignedWaiterId != myUserId
    val isMineOrFree: Boolean get() = !assignedToOther
}

@HiltViewModel
class TableAccessViewModel @Inject constructor(
    private val tableRepo: TableDetailRepository,
    private val requestsRepo: RequestsRepository,
    private val session: SessionManager,
    savedState: SavedStateHandle,
) : ViewModel() {

    val tableId: String = savedState.get<String>("tableId").orEmpty()
    private val _ui = MutableStateFlow(AccessUiState())
    val ui: StateFlow<AccessUiState> = _ui.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _ui.value = _ui.value.copy(loading = true, error = null)
            val uid = session.sessionFlow.first()?.userId.orEmpty()
            val tableOutcome = tableRepo.fetchTable(tableId)
            val staffOutcome = tableRepo.fetchRestaurantStaff()

            val table = (tableOutcome as? Outcome.Success)?.data
            val rawStaff = (staffOutcome as? Outcome.Success)?.data ?: emptyList()
            val waitersOnly = rawStaff.filter {
                val r = it.role?.lowercase()?.trim() ?: "waiter"
                r == "waiter" || r == "waitstaff"
            }

            val assigned = rawStaff.firstOrNull { it.id == table?.assignedWaiterId }
            val others = waitersOnly.filter { it.id != uid }

            if (tableOutcome is Outcome.Error) {
                _ui.value = _ui.value.copy(
                    loading = false,
                    error = tableOutcome.message,
                    myUserId = uid,
                    allStaff = waitersOnly,
                    otherWaiters = others,
                    assignedStaff = assigned
                )
            } else {
                _ui.value = _ui.value.copy(
                    loading = false,
                    table = table,
                    myUserId = uid,
                    allStaff = waitersOnly,
                    otherWaiters = others,
                    assignedStaff = assigned
                )
            }
        }
    }

    fun transferAccess(targetWaiter: WaiterStaffDto) {
        val currentUid = _ui.value.myUserId
        if (_ui.value.submitting || currentUid.isBlank()) return
        _ui.value = _ui.value.copy(submitting = true, actionWaiterId = targetWaiter.id, error = null, successMessage = null)
        viewModelScope.launch {
            when (val r = tableRepo.transferTableAccess(tableId, targetWaiter.id, currentUid)) {
                is Outcome.Success -> {
                    val refreshedTable = (tableRepo.fetchTable(tableId) as? Outcome.Success)?.data
                    _ui.value = _ui.value.copy(
                        submitting = false,
                        actionWaiterId = null,
                        table = refreshedTable ?: _ui.value.table?.copy(assignedWaiterId = targetWaiter.id),
                        assignedStaff = targetWaiter,
                        successMessage = "Table transferred to ${targetWaiter.name} successfully."
                    )
                }
                is Outcome.Error -> {
                    _ui.value = _ui.value.copy(submitting = false, actionWaiterId = null, error = r.message)
                }
            }
        }
    }

    fun giveAccess(targetWaiter: WaiterStaffDto) {
        val currentCoWaiters = _ui.value.table?.activeCoWaiterIds ?: emptyList()
        if (_ui.value.submitting) return
        _ui.value = _ui.value.copy(submitting = true, actionWaiterId = targetWaiter.id, error = null, successMessage = null)
        viewModelScope.launch {
            when (val r = tableRepo.giveTableAccess(tableId, targetWaiter.id, currentCoWaiters)) {
                is Outcome.Success -> {
                    val refreshedTable = (tableRepo.fetchTable(tableId) as? Outcome.Success)?.data
                    _ui.value = _ui.value.copy(
                        submitting = false,
                        actionWaiterId = null,
                        table = refreshedTable ?: _ui.value.table?.copy(coWaiterIds = (currentCoWaiters + targetWaiter.id).distinct()),
                        successMessage = "Access shared with ${targetWaiter.name}."
                    )
                }
                is Outcome.Error -> {
                    _ui.value = _ui.value.copy(submitting = false, actionWaiterId = null, error = r.message)
                }
            }
        }
    }

    fun revokeAccess(targetWaiter: WaiterStaffDto) {
        val currentCoWaiters = _ui.value.table?.activeCoWaiterIds ?: emptyList()
        if (_ui.value.submitting) return
        _ui.value = _ui.value.copy(submitting = true, actionWaiterId = targetWaiter.id, error = null, successMessage = null)
        viewModelScope.launch {
            when (val r = tableRepo.revokeTableAccess(tableId, targetWaiter.id, currentCoWaiters)) {
                is Outcome.Success -> {
                    val refreshedTable = (tableRepo.fetchTable(tableId) as? Outcome.Success)?.data
                    _ui.value = _ui.value.copy(
                        submitting = false,
                        actionWaiterId = null,
                        table = refreshedTable ?: _ui.value.table?.copy(coWaiterIds = currentCoWaiters.filter { it != targetWaiter.id }),
                        successMessage = "Access removed for ${targetWaiter.name}."
                    )
                }
                is Outcome.Error -> {
                    _ui.value = _ui.value.copy(submitting = false, actionWaiterId = null, error = r.message)
                }
            }
        }
    }

    fun requestAccess() {
        if (_ui.value.submitting) return
        _ui.value = _ui.value.copy(submitting = true, error = null)
        viewModelScope.launch {
            when (val r = requestsRepo.requestAccess(tableId)) {
                is Outcome.Success -> _ui.value = _ui.value.copy(submitting = false, requestSent = true)
                is Outcome.Error -> _ui.value = _ui.value.copy(submitting = false, error = r.message)
            }
        }
    }
}
