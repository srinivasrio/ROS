package com.dineinone.waiter.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val mobile: String,
    val pin: String,
)

@Serializable
data class LoginResponse(
    val success: Boolean = false,
    val token: String? = null,
    val redirectUrl: String? = null,
    val user: UserDto? = null,
    val error: String? = null,
)

@Serializable
data class UserDto(
    val id: String? = null,
    val name: String? = null,
    val role: String? = null,
    val email: String? = null,
    val mobile: String? = null,
    val restaurant_id: String? = null,
    val employee_id: String? = null,
    val employee_code: String? = null,
    val status: String? = null,
)
