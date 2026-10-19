package com.dineinone.waiter.data.local

import com.dineinone.waiter.data.remote.dto.MenuItemDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * In-memory cart for the current table/order being built.
 * ponytail: lives only in memory — an unsent order isn't worth persisting; it is
 * discarded on logout/table-switch, and confirmed orders live server-side.
 */
@Singleton
class CartManager @Inject constructor() {

    data class Line(val item: MenuItemDto, val qty: Int) {
        val lineTotal: Double get() = item.effectivePrice * qty
    }

    private val _lines = MutableStateFlow<Map<String, Line>>(emptyMap())
    val lines: StateFlow<Map<String, Line>> = _lines.asStateFlow()

    // The table this cart is bound to (set when opening from a table). Null = Menu-tab browsing.
    var tableId: String? = null
        private set
    var tableLabel: String? = null
        private set

    /** Start a fresh cart for a table (clears items when switching tables). */
    fun bindTable(id: String?, label: String? = null) {
        if (id != tableId) { _lines.value = emptyMap() }
        tableId = id
        tableLabel = label
    }

    /** Attach a table to the current cart WITHOUT clearing items (table picker at checkout). */
    fun setTableKeepingItems(id: String, label: String) {
        tableId = id
        tableLabel = label
    }

    fun qtyOf(itemId: String): Int = _lines.value[itemId]?.qty ?: 0

    fun add(item: MenuItemDto, delta: Int = 1) {
        val map = _lines.value.toMutableMap()
        val current = map[item.id]?.qty ?: 0
        val next = (current + delta).coerceAtLeast(0)
        if (next == 0) map.remove(item.id) else map[item.id] = Line(item, next)
        _lines.value = map
    }

    fun remove(itemId: String) {
        _lines.value = _lines.value.toMutableMap().apply { remove(itemId) }
    }

    fun clear() { _lines.value = emptyMap() }

    val itemCount: Int get() = _lines.value.values.sumOf { it.qty }
    val subtotal: Double get() = _lines.value.values.sumOf { it.lineTotal }
}
