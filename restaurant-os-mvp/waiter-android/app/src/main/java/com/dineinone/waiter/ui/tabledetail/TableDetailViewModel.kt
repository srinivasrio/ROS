package com.dineinone.waiter.ui.tabledetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.local.CartManager
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.remote.dto.OrderDto
import com.dineinone.waiter.data.remote.dto.TableDto
import com.dineinone.waiter.data.repository.TableDetailRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TableDetailUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val table: TableDto? = null,
    val order: OrderDto? = null,
)

@HiltViewModel
class TableDetailViewModel @Inject constructor(
    private val repo: TableDetailRepository,
    private val session: SessionManager,
    private val cart: CartManager,
    savedState: SavedStateHandle,
) : ViewModel() {

    val tableId: String = savedState.get<String>("tableId").orEmpty()

    /** Bind the cart to this table before navigating to the menu to add items. */
    fun bindForOrdering() {
        val t = _ui.value.table
        cart.bindTable(tableId, "T${t?.number ?: ""}")
    }

    private val _ui = MutableStateFlow(TableDetailUiState())
    val ui: StateFlow<TableDetailUiState> = _ui.asStateFlow()

    init {
        load()
        observe()
    }

    fun load() {
        viewModelScope.launch {
            val table = repo.fetchTable(tableId)
            val order = repo.fetchLatestOrder(tableId)
            _ui.value = TableDetailUiState(
                loading = false,
                table = (table as? Outcome.Success)?.data,
                order = (order as? Outcome.Success)?.data,
                error = (table as? Outcome.Error)?.message,
            )
        }
    }

    private fun observe() {
        viewModelScope.launch {
            val rid = session.sessionFlow.first()?.restaurantId ?: return@launch
            runCatching { repo.changes(tableId, rid).collect { load() } }
        }
    }

    fun markOrderServed() {
        val orderId = _ui.value.order?.id ?: return
        viewModelScope.launch { repo.markOrderServed(orderId); load() }
    }

    fun markItemStatus(itemId: String, status: String) {
        viewModelScope.launch { repo.markItemStatus(itemId, status); load() }
    }

    fun unmergeTable() {
        val groupId = _ui.value.table?.mergedGroupId ?: return
        viewModelScope.launch { repo.unmergeTables(groupId); load() }
    }
}
