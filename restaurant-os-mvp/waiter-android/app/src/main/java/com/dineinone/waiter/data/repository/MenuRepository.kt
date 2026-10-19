package com.dineinone.waiter.data.repository

import com.dineinone.waiter.core.Outcome
import com.dineinone.waiter.core.friendlyError
import com.dineinone.waiter.data.local.SessionManager
import com.dineinone.waiter.data.local.db.CacheStore
import com.dineinone.waiter.data.remote.dto.CategoryDto
import com.dineinone.waiter.data.remote.dto.MenuItemDto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MenuRepository @Inject constructor(
    private val supabase: SupabaseClient,
    private val session: SessionManager,
    private val cache: CacheStore,
) {
    private suspend fun rid(): String = session.sessionFlow.first()?.restaurantId.orEmpty()

    suspend fun fetchCategories(): Outcome<List<CategoryDto>> {
        val r = rid()
        val key = "categories:$r"
        return try {
            val list = supabase.from("categories")
                .select(Columns.ALL) {
                    filter { eq("restaurant_id", r); eq("is_active", true) }
                    order("sort_order", Order.ASCENDING)
                }
                .decodeList<CategoryDto>()
                .filter { it.categoryType == null || it.categoryType == "food" }
                .toMutableList()

            // Prepend Combos and Specials as two distinct categories
            val combosCategory = CategoryDto(
                id = "combos",
                name = "Combos",
                imageUrl = "https://images.unsplash.com/photo-1544025162-d76694265947?w=300",
                sortOrder = -2,
                categoryType = "food",
                isActive = true
            )
            val specialsCategory = CategoryDto(
                id = "specials",
                name = "Specials",
                imageUrl = "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300",
                sortOrder = -1,
                categoryType = "food",
                isActive = true
            )
            list.add(0, specialsCategory)
            list.add(0, combosCategory)

            cache.putList(key, list)
            Outcome.Success(list)
        } catch (e: Exception) {
            cache.getList<CategoryDto>(key)?.let { return Outcome.Success(it) }
            Outcome.Error(friendlyError(e.message))
        }
    }

    suspend fun fetchItems(): Outcome<List<MenuItemDto>> {
        val r = rid()
        val key = "menu_items:$r"
        return try {
            val standardItems = supabase.from("menu_items")
                .select(Columns.ALL) {
                    filter { eq("restaurant_id", r); eq("is_available", true) }
                }
                .decodeList<MenuItemDto>()

            val specials = runCatching {
                supabase.from("today_specials")
                    .select(Columns.raw("*, items:today_special_items(quantity, menu_item_id, menu_item:menu_items(id, name, price, image_url, item_type, is_veg))")) {
                        filter { eq("restaurant_id", r); eq("is_active", true) }
                    }
                    .decodeList<com.dineinone.waiter.data.remote.dto.TodaySpecialDto>()
            }.getOrElse {
                runCatching {
                    supabase.from("today_specials")
                        .select(Columns.ALL) {
                            filter { eq("restaurant_id", r); eq("is_active", true) }
                        }
                        .decodeList<com.dineinone.waiter.data.remote.dto.TodaySpecialDto>()
                }.getOrDefault(emptyList())
            }

            val specialItems = specials.map { s ->
                val isCombo = s.isCombo || (s.specialType?.equals("combo", true) == true)
                val subItems = s.items.mapNotNull { sub ->
                    val mi = sub.menuItem
                    if (mi != null) {
                        com.dineinone.waiter.data.remote.dto.ComboSubItemDto(
                            name = mi.name ?: "Item",
                            quantity = sub.quantity,
                            price = mi.price,
                            imageUrl = mi.imageUrl,
                            isVeg = mi.veg,
                        )
                    } else null
                }
                val actualTotal = if (subItems.isNotEmpty()) subItems.sumOf { it.price * it.quantity } else (s.originalPrice ?: s.specialPrice ?: 0.0)
                MenuItemDto(
                    id = s.id,
                    name = s.title ?: if (isCombo) "Combo Meal" else "Special Dish",
                    description = s.description,
                    price = actualTotal,
                    specialPrice = s.specialPrice,
                    originalPrice = s.originalPrice ?: actualTotal,
                    categoryId = if (isCombo) "combos" else "specials",
                    itemType = if (isCombo) "combo" else "special",
                    isVeg = if (subItems.isNotEmpty()) subItems.all { it.isVeg } else false,
                    isAvailable = s.isActive,
                    imageUrl = s.imageUrl,
                    isPopular = true,
                    comboSubItems = subItems,
                )
            }

            val combined = specialItems + standardItems
            cache.putList(key, combined)
            Outcome.Success(combined)
        } catch (e: Exception) {
            cache.getList<MenuItemDto>(key)?.let { return Outcome.Success(it) }
            Outcome.Error(friendlyError(e.message))
        }
    }
}
