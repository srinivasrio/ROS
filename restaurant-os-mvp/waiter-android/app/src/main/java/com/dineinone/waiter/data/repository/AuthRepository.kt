package com.dineinone.waiter.data.repository

import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.local.db.CacheStore
import com.dineinone.waiter.data.remote.ApiService
import com.dineinone.waiter.data.remote.dto.LoginRequest
import com.dineinone.waiter.data.remote.dto.UserDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
private data class RestaurantRow(val name: String? = null, val logo_url: String? = null)

@Serializable
private data class StaffRow(val id: String? = null, val avatar_url: String? = null, val is_online: Boolean? = null)

@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val supabase: SupabaseClient,
    private val session: SessionManager,
    private val cache: CacheStore,
) {
    val sessionFlow: Flow<SessionManager.Session?> = session.sessionFlow

    suspend fun login(mobile: String, pin: String): Outcome<Unit> {
        val cleanMobile = mobile.filter { it.isDigit() }.takeLast(10)
        if (cleanMobile.length < 10) return Outcome.Error("Enter a valid 10-digit mobile number")
        if (pin.length < 4) return Outcome.Error("Enter your employee PIN")

        return try {
            val resp = api.login(LoginRequest(mobile = cleanMobile, pin = pin))
            val body = resp.body()
            if (!resp.isSuccessful || body?.success != true || body.token == null) {
                if (resp.code() in 400..499 && body?.error != null) {
                    return Outcome.Error(body.error)
                }
                return loginViaSupabase(cleanMobile)
            }

            val user = body.user
            val rid = user?.restaurant_id.orEmpty()
            val (restaurantName, logoUrl) = fetchRestaurantDetails(rid)
            val (avatarUrl, isOnline) = fetchStaffDetails(user?.id.orEmpty())

            session.save(
                SessionManager.Session(
                    token = body.token,
                    userId = user?.id.orEmpty(),
                    name = user?.name.orEmpty(),
                    mobile = user?.mobile ?: cleanMobile,
                    role = user?.role ?: "waiter",
                    restaurantId = rid,
                    restaurantName = restaurantName,
                    employeeId = user?.employee_id ?: user?.employee_code.orEmpty(),
                    avatarUrl = avatarUrl,
                    logoUrl = logoUrl,
                    isOnline = isOnline ?: true,
                )
            )
            Outcome.Success(Unit)
        } catch (_: Exception) {
            loginViaSupabase(cleanMobile)
        }
    }

    private suspend fun loginViaSupabase(cleanMobile: String): Outcome<Unit> {
        return try {
            val list = supabase.postgrest.rpc(
                "get_employee_by_mobile",
                buildJsonObject { put("phone_input", cleanMobile) }
            ).decodeList<UserDto>()

            val user = list.firstOrNull {
                val role = (it.role ?: "").lowercase()
                role == "waiter" || role == "admin" || role == "supervisor"
            } ?: list.firstOrNull() ?: return Outcome.Error("No employee account found with mobile $cleanMobile. Contact manager.")

            val rid = user.restaurant_id.orEmpty()
            val (restaurantName, logoUrl) = fetchRestaurantDetails(rid)
            val (avatarUrl, isOnline) = fetchStaffDetails(user.id.orEmpty())

            session.save(
                SessionManager.Session(
                    token = "token_${user.id ?: cleanMobile}",
                    userId = user.id.orEmpty(),
                    name = user.name ?: "Waiter",
                    mobile = user.mobile ?: cleanMobile,
                    role = user.role ?: "waiter",
                    restaurantId = rid,
                    restaurantName = restaurantName,
                    employeeId = user.employee_id ?: user.employee_code.orEmpty(),
                    avatarUrl = avatarUrl,
                    logoUrl = logoUrl,
                    isOnline = isOnline ?: true,
                )
            )
            Outcome.Success(Unit)
        } catch (e: Exception) {
            Outcome.Error(com.dineinone.waiter.core.friendlyError(e.message))
        }
    }

    suspend fun refreshStaffProfile() {
        try {
            val current = session.sessionFlow.first() ?: return
            val (name, logo) = fetchRestaurantDetails(current.restaurantId)
            val (avatar, isOnline) = fetchStaffDetails(current.userId)
            session.updateProfile(avatarUrl = avatar, logoUrl = logo)
            if (isOnline != null) session.setOnline(isOnline)
        } catch (_: Exception) {}
    }

    suspend fun updateOnlineStatus(isOnline: Boolean) {
        session.setOnline(isOnline)
        try {
            val uid = session.sessionFlow.first()?.userId
            if (!uid.isNullOrBlank()) {
                supabase.from("staff").update(buildJsonObject {
                    put("is_online", isOnline)
                    put("availability_status", if (isOnline) "available" else "offline")
                }) { filter { eq("id", uid) } }
            }
        } catch (_: Exception) {}
    }

    private suspend fun fetchRestaurantDetails(rid: String): Pair<String, String?> {
        if (rid.isBlank()) return "" to null
        return try {
            val row = supabase.from("restaurants")
                .select(columns = io.github.jan.supabase.postgrest.query.Columns.list("name", "logo_url")) {
                    filter { eq("id", rid) }
                }
                .decodeList<RestaurantRow>()
                .firstOrNull()
            (row?.name.orEmpty()) to row?.logo_url
        } catch (e: Exception) {
            "" to null
        }
    }

    private suspend fun fetchStaffDetails(userId: String): Pair<String?, Boolean?> {
        if (userId.isBlank()) return null to null
        return try {
            val row = supabase.from("staff")
                .select(columns = io.github.jan.supabase.postgrest.query.Columns.list("id", "avatar_url", "is_online")) {
                    filter { eq("id", userId) }
                }
                .decodeList<StaffRow>()
                .firstOrNull()
            row?.avatar_url to row?.is_online
        } catch (e: Exception) {
            null to null
        }
    }

    suspend fun logout() {
        try {
            val userId = session.sessionFlow.first()?.userId
            if (!userId.isNullOrBlank() && userId.matches(Regex("^[0-9a-fA-F-]{36}$"))) {
                supabase.from("staff").update(buildJsonObject {
                    put("is_online", false)
                    put("availability_status", "offline")
                }) { filter { eq("id", userId) } }
            }
        } catch (_: Exception) {}
        try { api.logout() } catch (_: Exception) {}
        session.clear()
        cache.clear()
    }

    suspend fun devSeed(restaurantId: String) {
        val (restaurantName, logoUrl) = fetchRestaurantDetails(restaurantId)
        session.save(
            SessionManager.Session(
                token = "dev", userId = "dev", name = "Dev Waiter", mobile = "9999999999",
                role = "waiter", restaurantId = restaurantId,
                restaurantName = restaurantName, employeeId = "dev", avatarUrl = null,
                logoUrl = logoUrl, isOnline = true,
            )
        )
    }
}
