package com.dineinone.waiter.data.remote

import com.dineinone.waiter.data.remote.dto.LoginRequest
import com.dineinone.waiter.data.remote.dto.LoginResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Next.js backend endpoints (mutations + auth). Reads go through Supabase/postgrest.
 */
interface ApiService {
    @POST("api/auth/waiter/login")
    suspend fun login(@Body body: LoginRequest): Response<LoginResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>
}
