package com.dineinone.waiter.data.remote.dto

import com.dineinone.waiter.core.AnyToStringSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AreaNameDto(val name: String? = null)

@Serializable
data class TableDto(
    @Serializable(with = AnyToStringSerializer::class) val id: String,
    @SerialName("table_number") @Serializable(with = AnyToStringSerializer::class) val tableNumber: String? = null,
    val status: String? = null,
    val capacity: Int? = null,
    @SerialName("area_id") @Serializable(with = AnyToStringSerializer::class) val areaId: String? = null,
    @SerialName("assigned_waiter_id") @Serializable(with = AnyToStringSerializer::class) val assignedWaiterId: String? = null,
    @SerialName("assigned_waiter_name") val assignedWaiterName: String? = null,
    @SerialName("assigned_waiter_avatar") val assignedWaiterAvatar: String? = null,
    @SerialName("alert_status") val alertStatus: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("active_order_total") val activeOrderTotal: Double? = null,
    @SerialName("active_item_count") val activeItemCount: Int? = null,
    @SerialName("is_merged") val isMerged: Boolean = false,
    @SerialName("merged_group_id") @Serializable(with = AnyToStringSerializer::class) val mergedGroupId: String? = null,
    @SerialName("co_waiter_names") val coWaiterNames: String? = null,
    @SerialName("co_waiter_ids") val coWaiterIds: List<String>? = emptyList(),
    @SerialName("area_name") val areaNameCol: String? = null,
    @SerialName("restaurant_areas") val area: AreaNameDto? = null,
) {
    val areaName: String get() = (areaNameCol ?: area?.name)?.takeIf { it.isNotBlank() } ?: "Main Floor"
    val number: String get() = tableNumber ?: id
    val activeCoWaiterIds: List<String> get() = coWaiterIds ?: emptyList()
}

@Serializable
data class WaiterStaffDto(
    val id: String,
    val name: String,
    val role: String? = null,
    @SerialName("employee_id") val employeeId: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("is_online") val isOnline: Boolean = false,
    val status: String? = null,
)

@Serializable
data class AreaDto(
    @Serializable(with = AnyToStringSerializer::class) val id: String,
    val name: String? = null,
    @SerialName("display_order") val displayOrder: Int? = null,
)
