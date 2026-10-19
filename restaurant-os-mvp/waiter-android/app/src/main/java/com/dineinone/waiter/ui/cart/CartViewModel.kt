package com.dineinone.waiter.ui.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.local.CartManager
import com.dineinone.waiter.data.remote.dto.MenuItemDto
import com.dineinone.waiter.data.remote.dto.TableDto
import com.dineinone.waiter.data.repository.OrderRepository
import com.dineinone.waiter.data.repository.TablesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

import com.dineinone.waiter.data.repository.SubmittedOrderInfo

data class CartUiState(
    val notes: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
    val placed: Boolean = false,
    val placedOrder: SubmittedOrderInfo? = null,
    val tableId: String? = null,
    val tableLabel: String? = null,
    val tables: List<TableDto> = emptyList(),
    val showTablePicker: Boolean = false,
)

@HiltViewModel
class CartViewModel @Inject constructor(
    val cart: CartManager,
    private val orders: OrderRepository,
    private val tablesRepo: TablesRepository,
) : ViewModel() {

    val lines: StateFlow<Map<String, CartManager.Line>> = cart.lines

    private val _ui = MutableStateFlow(CartUiState(tableId = cart.tableId, tableLabel = cart.tableLabel))
    val ui: StateFlow<CartUiState> = _ui.asStateFlow()

    init {
        if (cart.tableId == null) loadTables()
    }

    private fun loadTables() {
        viewModelScope.launch {
            (tablesRepo.fetchTables() as? Outcome.Success)?.let { _ui.value = _ui.value.copy(tables = it.data) }
        }
    }

    fun inc(item: MenuItemDto) = cart.add(item, +1)
    fun dec(item: MenuItemDto) = cart.add(item, -1)
    fun removeLine(id: String) = cart.remove(id)
    fun clear() = cart.clear()
    fun setNotes(v: String) { if (v.length <= 120) _ui.value = _ui.value.copy(notes = v) }

    fun openTablePicker() { _ui.value = _ui.value.copy(showTablePicker = true) }
    fun dismissTablePicker() { _ui.value = _ui.value.copy(showTablePicker = false) }
    fun selectTable(t: TableDto) {
        cart.setTableKeepingItems(t.id, "T${t.number}")
        _ui.value = _ui.value.copy(tableId = t.id, tableLabel = "T${t.number}", showTablePicker = false, error = null)
    }

    fun placeOrder() {
        if (_ui.value.submitting) return
        val current = cart.lines.value.values.toList()
        if (current.isEmpty()) return
        if (cart.tableId == null) { _ui.value = _ui.value.copy(error = "Select a table before placing this order.", showTablePicker = true); return }
        _ui.value = _ui.value.copy(submitting = true, error = null)
        viewModelScope.launch {
            when (val r = orders.submit(cart.tableId, current, _ui.value.notes)) {
                is Outcome.Success -> {
                    cart.clear()
                    _ui.value = _ui.value.copy(submitting = false, placed = true, placedOrder = r.data)
                }
                is Outcome.Error -> _ui.value = _ui.value.copy(submitting = false, error = r.message)
            }
        }
    }
}
