package com.dineinone.waiter.ui.menu

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.local.CartManager
import com.dineinone.waiter.data.remote.dto.CategoryDto
import com.dineinone.waiter.data.remote.dto.MenuItemDto
import com.dineinone.waiter.data.repository.MenuRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class VegFilter { ALL, VEG, NONVEG }

data class MenuUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val categories: List<CategoryDto> = emptyList(),
    val items: List<MenuItemDto> = emptyList(),
    val selectedCategoryId: String? = null,
    val query: String = "",
    val veg: VegFilter = VegFilter.ALL,
) {
    val visible: List<MenuItemDto>
        get() {
            val q = query.trim()
            val isSearching = q.isNotEmpty()
            return items.filter { it ->
                val matchesCategory = isSearching || (selectedCategoryId == null || it.categoryId == selectedCategoryId)
                val matchesQuery = !isSearching || (it.name ?: "").contains(q, ignoreCase = true) || (it.description ?: "").contains(q, ignoreCase = true)
                val matchesVeg = when (veg) { VegFilter.ALL -> true; VegFilter.VEG -> it.veg; VegFilter.NONVEG -> !it.veg }
                matchesCategory && matchesQuery && matchesVeg
            }
        }
}

@HiltViewModel
class MenuViewModel @Inject constructor(
    private val repo: MenuRepository,
    val cart: CartManager,
    session: com.dineinone.waiter.data.local.SessionManager,
) : ViewModel() {

    val session: StateFlow<com.dineinone.waiter.data.local.SessionManager.Session?> =
        session.sessionFlow.stateIn(viewModelScope, kotlinx.coroutines.flow.SharingStarted.Eagerly, null)

    private val _ui = MutableStateFlow(MenuUiState())
    val ui: StateFlow<MenuUiState> = _ui.asStateFlow()

    val cartLines: StateFlow<Map<String, CartManager.Line>> = cart.lines

    private val _searchSelectionTrigger = MutableStateFlow(0)
    val searchSelectionTrigger: StateFlow<Int> = _searchSelectionTrigger.asStateFlow()

    init { load() }

    fun load() {
        _ui.value = _ui.value.copy(loading = true, error = null)
        viewModelScope.launch {
            val cats = repo.fetchCategories()
            val items = repo.fetchItems()
            val error = (cats as? Outcome.Error)?.message ?: (items as? Outcome.Error)?.message
            _ui.value = _ui.value.copy(
                loading = false,
                error = error,
                categories = (cats as? Outcome.Success)?.data ?: emptyList(),
                items = (items as? Outcome.Success)?.data ?: emptyList(),
            )
        }
    }

    fun selectCategory(id: String?) { _ui.value = _ui.value.copy(selectedCategoryId = id) }
    fun setQuery(q: String) { _ui.value = _ui.value.copy(query = q) }
    fun setVeg(v: VegFilter) { _ui.value = _ui.value.copy(veg = v) }

    fun add(item: MenuItemDto) {
        cart.add(item, +1)
        if (_ui.value.query.isNotBlank()) {
            _searchSelectionTrigger.value += 1
        }
    }
    fun dec(item: MenuItemDto) = cart.add(item, -1)
}
