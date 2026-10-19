package com.dineinone.waiter.data.remote.dto

import com.dineinone.waiter.core.AnyToStringSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TableNumberRefDto(@SerialName("table_number") val tableNumber: String? = null)

@Serializable
data class RequestDto(
    @Serializable(with = AnyToStringSerializer::class) val id: String,
    @SerialName("table_id") @Serializable(with = AnyToStringSerializer::class) val tableId: String? = null,
    @SerialName("table_number") @Serializable(with = AnyToStringSerializer::class) val tableNumberRaw: String? = null,
    @SerialName("request_type") val requestType: String? = null,
    @SerialName("request_status") val requestStatus: String? = null,
    val quantity: Int = 1,
    val notes: String? = null,
    @SerialName("assigned_waiter_id") val assignedWaiterId: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("tables") val table: TableNumberRefDto? = null,
) {
    val tableNumber: String get() = tableNumberRaw ?: table?.tableNumber ?: tableId ?: "?"
    val status: String get() = (requestStatus ?: "pending").lowercase()
    val isPending: Boolean get() = status == "pending"
    val isAccepted: Boolean get() = status == "accepted"
    val isCompleted: Boolean get() = status == "completed"
}
