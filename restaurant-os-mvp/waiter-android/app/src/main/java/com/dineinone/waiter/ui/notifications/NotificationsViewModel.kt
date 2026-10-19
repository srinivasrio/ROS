package com.dineinone.waiter.ui.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.remote.dto.RequestDto
import com.dineinone.waiter.data.repository.RequestsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NotificationsUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val items: List<RequestDto> = emptyList(),
)

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val repo: RequestsRepository,
    private val session: SessionManager,
) : ViewModel() {
    private val _ui = MutableStateFlow(NotificationsUiState())
    val ui: StateFlow<NotificationsUiState> = _ui.asStateFlow()

    init { load(); observe() }

    fun load() {
        viewModelScope.launch {
            when (val r = repo.fetch()) {
                is Outcome.Success -> _ui.value = NotificationsUiState(loading = false, items = r.data)
                is Outcome.Error -> _ui.value = NotificationsUiState(loading = false, error = r.message)
            }
        }
    }

    private fun observe() {
        viewModelScope.launch {
            val rid = session.sessionFlow.first()?.restaurantId ?: return@launch
            runCatching { repo.changes(rid).collect { load() } }
        }
    }
}
