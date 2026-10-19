package com.dineinone.waiter.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.repository.ShiftRepository
import com.dineinone.waiter.data.repository.ShiftStats
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ShiftUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val stats: ShiftStats? = null,
)

@HiltViewModel
class ShiftViewModel @Inject constructor(
    private val repo: ShiftRepository,
) : ViewModel() {
    private val _ui = MutableStateFlow(ShiftUiState())
    val ui: StateFlow<ShiftUiState> = _ui.asStateFlow()

    init { load() }

    fun load() {
        _ui.value = ShiftUiState(loading = true)
        viewModelScope.launch {
            when (val r = repo.fetchToday()) {
                is Outcome.Success -> _ui.value = ShiftUiState(loading = false, stats = r.data)
                is Outcome.Error -> _ui.value = ShiftUiState(loading = false, error = r.message)
            }
        }
    }
}
