package com.dineinone.waiter.ui.payment

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.remote.dto.OrderDto
import com.dineinone.waiter.data.remote.dto.TableDto
import com.dineinone.waiter.data.repository.PaymentRepository
import com.dineinone.waiter.data.repository.TableDetailRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ClearUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val table: TableDto? = null,
    val order: OrderDto? = null,
    val submitting: Boolean = false,
    val cleared: Boolean = false,
)

@HiltViewModel
class ClearViewModel @Inject constructor(
    private val tableRepo: TableDetailRepository,
    private val paymentRepo: PaymentRepository,
    savedState: SavedStateHandle,
) : ViewModel() {

    val tableId: String = savedState.get<String>("tableId").orEmpty()
    private val _ui = MutableStateFlow(ClearUiState())
    val ui: StateFlow<ClearUiState> = _ui.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            val table = tableRepo.fetchTable(tableId)
            val order = tableRepo.fetchLatestOrder(tableId)
            _ui.value = _ui.value.copy(
                loading = false,
                table = (table as? Outcome.Success)?.data,
                order = (order as? Outcome.Success)?.data,
            )
        }
    }

    fun confirm() {
        if (_ui.value.submitting) return
        _ui.value = _ui.value.copy(submitting = true, error = null)
        viewModelScope.launch {
            when (val r = paymentRepo.clearTable(tableId)) {
                is Outcome.Success -> _ui.value = _ui.value.copy(submitting = false, cleared = true)
                is Outcome.Error -> _ui.value = _ui.value.copy(submitting = false, error = r.message)
            }
        }
    }
}
