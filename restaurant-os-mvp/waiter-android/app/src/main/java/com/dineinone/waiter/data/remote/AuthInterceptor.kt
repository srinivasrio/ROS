package com.dineinone.waiter.data.remote

import com.dineinone.waiter.data.local.SessionManager
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Attaches the waiter JWT to every backend request as both Bearer and the
 * cookies the Next.js middleware expects. The server remains the auth authority.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val session: SessionManager,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { session.currentToken() }
        val req = chain.request()
        if (token.isNullOrBlank()) return chain.proceed(req)
        val authed = req.newBuilder()
            .header("Authorization", "Bearer $token")
            .header("Cookie", "dine_auth_token=$token; dine_auth_token_waiter=$token")
            .build()
        return chain.proceed(authed)
    }
}
