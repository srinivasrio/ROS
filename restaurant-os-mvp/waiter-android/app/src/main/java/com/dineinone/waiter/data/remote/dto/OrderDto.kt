package com.dineinone.waiter.data.remote.dto

import com.dineinone.waiter.core.AnyToStringSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MenuItemRefDto(
    val name: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("item_type") val itemType: String? = null,
)

@Serializable
data class OrderItemComboSubItem(
    val name: String? = null,
    val price: Double = 0.0,
    val quantity: Int = 1,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("item_type") val itemType: String? = null,
)

@Serializable
data class OrderItemDto(
    @Serializable(with = AnyToStringSerializer::class) val id: String,
    val quantity: Int = 1,
    @SerialName("price_at_time") val priceAtTime: Double = 0.0,
    val status: String? = null,
    val notes: String? = null,
    @SerialName("combo_name") val comboName: String? = null,
    @SerialName("combo_items") val comboItemsRaw: kotlinx.serialization.json.JsonElement? = null,
    @SerialName("menu_items") val menuItem: MenuItemRefDto? = null,
) {
    val name: String get() = comboName ?: menuItem?.name ?: "Item"
    val isCombo: Boolean get() = !comboName.isNullOrBlank() || menuItem?.itemType?.equals("combo", true) == true || parsedComboItems.isNotEmpty()
    val lineTotal: Double get() = priceAtTime * quantity
    val cancelled: Boolean get() = status?.equals("cancelled", true) == true

    val parsedComboItems: List<OrderItemComboSubItem> get() {
        val raw = comboItemsRaw ?: return emptyList()
        return runCatching {
            val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true; isLenient = true }
            when (raw) {
                is kotlinx.serialization.json.JsonArray -> {
                    json.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(OrderItemComboSubItem.serializer()), raw)
                }
                is kotlinx.serialization.json.JsonPrimitive -> {
                    val s = raw.content
                    if (s.startsWith("[")) {
                        json.decodeFromString<List<OrderItemComboSubItem>>(s)
                    } else emptyList()
                }
                else -> emptyList()
            }
        }.getOrDefault(emptyList())
    }

    val comboActualTotal: Double get() {
        val subs = parsedComboItems
        return if (subs.isNotEmpty()) subs.sumOf { it.price * it.quantity } else priceAtTime
    }
}

@Serializable
data class OrderDto(
    @Serializable(with = AnyToStringSerializer::class) val id: String,
    val status: String? = null,
    @SerialName("total_amount") val totalAmount: Double? = null,
    @SerialName("gst_amount") val gstAmount: Double? = null,
    @SerialName("cgst_amount") val cgstAmount: Double? = null,
    @SerialName("sgst_amount") val sgstAmount: Double? = null,
    @SerialName("service_charge") val serviceCharge: Double? = null,
    @SerialName("discount_amount") val discountAmount: Double? = null,
    @SerialName("amount_paid") val amountPaid: Double? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("order_number") val orderNumber: Long? = null,
    @SerialName("is_completed") val isCompleted: Boolean = false,
    @SerialName("order_items") val items: List<OrderItemDto> = emptyList(),
) {
    val activeItems: List<OrderItemDto> get() = items.filterNot { it.cancelled }
    val isPaid: Boolean get() = status?.equals("paid", true) == true

    val subtotal: Double
        get() = activeItems.sumOf { it.lineTotal }

    val cgst: Double
        get() {
            val dbCgst = cgstAmount ?: 0.0
            if (dbCgst > 0.0) return dbCgst
            val dbGst = gstAmount ?: 0.0
            if (dbGst > 0.0) return dbGst / 2.0
            return subtotal * 0.025
        }

    val sgst: Double
        get() {
            val dbSgst = sgstAmount ?: 0.0
            if (dbSgst > 0.0) return dbSgst
            val dbGst = gstAmount ?: 0.0
            if (dbGst > 0.0) return dbGst / 2.0
            return subtotal * 0.025
        }

    val gst: Double
        get() {
            val dbGst = gstAmount ?: 0.0
            if (dbGst > 0.0) return dbGst
            return cgst + sgst
        }

    val service: Double
        get() = serviceCharge ?: 0.0

    val discount: Double
        get() = discountAmount ?: 0.0

    val totalWithGst: Double
        get() {
            val computedTotal = (subtotal + gst + service - discount).coerceAtLeast(0.0)
            val dbTotal = totalAmount ?: 0.0
            // If DB total already includes GST (dbTotal >= subtotal + gst - 0.05), use dbTotal.
            // Otherwise, dbTotal was stored without GST or is missing, so use computedTotal with GST added!
            return if (dbTotal >= (subtotal + gst - 0.05)) dbTotal else computedTotal
        }
}
