package com.dineinone.waiter.data.local

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "dineinone_session")

/**
 * Persists the authenticated waiter session (JWT + identity) via DataStore.
 * The token is the source of truth for auth; identity fields are cached for UI only.
 */
@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private object Keys {
        val TOKEN = stringPreferencesKey("token")
        val USER_ID = stringPreferencesKey("user_id")
        val NAME = stringPreferencesKey("name")
        val MOBILE = stringPreferencesKey("mobile")
        val ROLE = stringPreferencesKey("role")
        val RESTAURANT_ID = stringPreferencesKey("restaurant_id")
        val RESTAURANT_NAME = stringPreferencesKey("restaurant_name")
        val EMPLOYEE_ID = stringPreferencesKey("employee_id")
        val AVATAR = stringPreferencesKey("avatar_url")
        val LOGO = stringPreferencesKey("logo_url")
        val IS_ONLINE = booleanPreferencesKey("is_online")
        val NOTIFICATIONS = booleanPreferencesKey("notifications_enabled")
    }

    val notificationsEnabled: Flow<Boolean> = context.dataStore.data.map { it[Keys.NOTIFICATIONS] ?: true }
    val isOnlineFlow: Flow<Boolean> = context.dataStore.data.map { it[Keys.IS_ONLINE] ?: true }

    suspend fun setNotifications(enabled: Boolean) {
        context.dataStore.edit { it[Keys.NOTIFICATIONS] = enabled }
    }

    suspend fun setOnline(enabled: Boolean) {
        context.dataStore.edit { it[Keys.IS_ONLINE] = enabled }
    }

    suspend fun updateAvatar(avatarUri: String) {
        context.dataStore.edit { it[Keys.AVATAR] = avatarUri }
    }

    data class Session(
        val token: String,
        val userId: String,
        val name: String,
        val mobile: String,
        val role: String,
        val restaurantId: String,
        val restaurantName: String,
        val employeeId: String,
        val avatarUrl: String?,
        val logoUrl: String? = null,
        val isOnline: Boolean = true,
    )

    val tokenFlow: Flow<String?> = context.dataStore.data.map { it[Keys.TOKEN] }

    val sessionFlow: Flow<Session?> = context.dataStore.data.map { p ->
        val token = p[Keys.TOKEN] ?: return@map null
        Session(
            token = token,
            userId = p[Keys.USER_ID].orEmpty(),
            name = p[Keys.NAME].orEmpty(),
            mobile = p[Keys.MOBILE].orEmpty(),
            role = p[Keys.ROLE].orEmpty(),
            restaurantId = p[Keys.RESTAURANT_ID].orEmpty(),
            restaurantName = p[Keys.RESTAURANT_NAME].orEmpty(),
            employeeId = p[Keys.EMPLOYEE_ID].orEmpty(),
            avatarUrl = p[Keys.AVATAR],
            logoUrl = p[Keys.LOGO],
            isOnline = p[Keys.IS_ONLINE] ?: true,
        )
    }

    suspend fun currentToken(): String? = context.dataStore.data.first()[Keys.TOKEN]

    suspend fun save(session: Session) {
        context.dataStore.edit { p ->
            p[Keys.TOKEN] = session.token
            p[Keys.USER_ID] = session.userId
            p[Keys.NAME] = session.name
            p[Keys.MOBILE] = session.mobile
            p[Keys.ROLE] = session.role
            p[Keys.RESTAURANT_ID] = session.restaurantId
            p[Keys.RESTAURANT_NAME] = session.restaurantName
            p[Keys.EMPLOYEE_ID] = session.employeeId
            if (session.avatarUrl != null) p[Keys.AVATAR] = session.avatarUrl else p.remove(Keys.AVATAR)
            if (session.logoUrl != null) p[Keys.LOGO] = session.logoUrl else p.remove(Keys.LOGO)
            p[Keys.IS_ONLINE] = session.isOnline
        }
    }

    suspend fun updateProfile(avatarUrl: String?, logoUrl: String?) {
        context.dataStore.edit { p ->
            if (avatarUrl != null) p[Keys.AVATAR] = avatarUrl
            if (logoUrl != null) p[Keys.LOGO] = logoUrl
        }
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}
