package com.dineinone.waiter.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val mobile: String = "",
    val pin: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repo: AuthRepository,
) : ViewModel() {

    val session: StateFlow<SessionManager.Session?> =
        repo.sessionFlow.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    suspend fun getInitialSession(): SessionManager.Session? = repo.sessionFlow.first()

    private val _ui = MutableStateFlow(LoginUiState())
    val ui: StateFlow<LoginUiState> = _ui.asStateFlow()

    fun onMobile(v: String) { _ui.value = _ui.value.copy(mobile = v.filter { it.isDigit() }.take(10), error = null) }
    fun onPin(v: String) { _ui.value = _ui.value.copy(pin = v, error = null) }

    fun login() {
        val s = _ui.value
        if (s.loading) return
        _ui.value = s.copy(loading = true, error = null)
        viewModelScope.launch {
            when (val r = repo.login(s.mobile, s.pin)) {
                is Outcome.Success -> _ui.value = _ui.value.copy(loading = false, success = true)
                is Outcome.Error -> _ui.value = _ui.value.copy(loading = false, error = r.message)
            }
        }
    }

    fun logout() { viewModelScope.launch { repo.logout() } }

    fun devSeed() = viewModelScope.launch {
        repo.devSeed("202609089153") // "Srinivas In" — has menu + tables for previewing data screens
        _ui.value = _ui.value.copy(success = true)
    }
}
