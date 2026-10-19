package com.dineinone.waiter.data.remote.dto

import com.dineinone.waiter.core.AnyToStringSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CategoryDto(
    @Serializable(with = AnyToStringSerializer::class) val id: String,
    val name: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("sort_order") val sortOrder: Int? = null,
    @SerialName("category_type") val categoryType: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
)

@Serializable
data class MenuItemDto(
    @Serializable(with = AnyToStringSerializer::class) val id: String,
    val name: String? = null,
    val description: String? = null,
    val price: Double = 0.0,
    @SerialName("special_price") val specialPrice: Double? = null,
    @SerialName("original_price") val originalPrice: Double? = null,
    @SerialName("category_id") @Serializable(with = AnyToStringSerializer::class) val categoryId: String? = null,
    @SerialName("item_type") val itemType: String? = null,
    @SerialName("is_veg") val isVeg: Boolean? = null,
    @SerialName("is_available") val isAvailable: Boolean = true,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("is_popular") val isPopular: Boolean = false,
    val comboSubItems: List<ComboSubItemDto> = emptyList(),
) {
    val veg: Boolean get() = isVeg ?: (itemType?.equals("veg", true) ?: true)
    val effectivePrice: Double get() = specialPrice ?: price
    val strikedPrice: Double? get() {
        if (specialPrice != null && price > specialPrice) return price
        if (originalPrice != null && originalPrice > effectivePrice) return originalPrice
        return null
    }
    val hasDiscount: Boolean get() = strikedPrice != null
    val isCombo: Boolean get() = itemType?.equals("combo", true) == true || categoryId == "combos" || comboSubItems.isNotEmpty()
    val comboActualTotal: Double get() = if (comboSubItems.isNotEmpty()) comboSubItems.sumOf { it.price * it.quantity } else (originalPrice ?: price)
}

@Serializable
data class ComboSubItemDto(
    val name: String,
    val quantity: Int = 1,
    val price: Double = 0.0,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("is_veg") val isVeg: Boolean = true,
)

@Serializable
data class SpecialSubItemDto(
    val quantity: Int = 1,
    @SerialName("menu_item_id") val menuItemId: String? = null,
    @SerialName("menu_item") val menuItem: MenuItemDto? = null,
)

@Serializable
data class TodaySpecialDto(
    @Serializable(with = AnyToStringSerializer::class) val id: String,
    val title: String? = null,
    val description: String? = null,
    @SerialName("special_price") val specialPrice: Double? = null,
    @SerialName("original_price") val originalPrice: Double? = null,
    @SerialName("is_combo") val isCombo: Boolean = false,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("special_type") val specialType: String? = null,
    val items: List<SpecialSubItemDto> = emptyList(),
)
