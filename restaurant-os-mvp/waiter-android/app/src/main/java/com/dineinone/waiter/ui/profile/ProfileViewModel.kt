package com.dineinone.waiter.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val session: SessionManager,
    private val auth: AuthRepository,
) : ViewModel() {

    val profile: StateFlow<SessionManager.Session?> =
        session.sessionFlow.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val notificationsEnabled: StateFlow<Boolean> =
        session.notificationsEnabled.stateIn(viewModelScope, SharingStarted.Eagerly, true)

    val isOnline: StateFlow<Boolean> =
        session.isOnlineFlow.stateIn(viewModelScope, SharingStarted.Eagerly, true)

    init {
        viewModelScope.launch { auth.refreshStaffProfile() }
    }

    fun setNotifications(enabled: Boolean) = viewModelScope.launch { session.setNotifications(enabled) }

    fun setOnline(online: Boolean) = viewModelScope.launch { auth.updateOnlineStatus(online) }

    fun updateAvatar(avatarUri: String) = viewModelScope.launch { session.updateAvatar(avatarUri) }

    fun logout(onDone: () -> Unit) = viewModelScope.launch { auth.logout(); onDone() }
}
