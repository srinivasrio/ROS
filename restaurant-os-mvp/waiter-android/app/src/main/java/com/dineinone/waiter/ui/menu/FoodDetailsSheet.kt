package com.dineinone.waiter.ui.menu

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dineinone.waiter.data.remote.dto.MenuItemDto
import com.dineinone.waiter.ui.components.PrimaryButton
import com.dineinone.waiter.ui.components.clickableNoRipple
import com.dineinone.waiter.ui.theme.*

private data class FoodStyleOption(val name: String, val extraPrice: Double)
private data class FoodAddonOption(val name: String, val price: Double)

private val sampleStyles = listOf(
    FoodStyleOption("Classic", 0.0),
    FoodStyleOption("Ghee roast", 20.0),
    FoodStyleOption("Mysore masala", 30.0),
)

private val sampleAddons = listOf(
    FoodAddonOption("Extra chutney", 10.0),
    FoodAddonOption("Extra sambar", 15.0),
    FoodAddonOption("Podi topping", 20.0),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoodDetailsSheet(
    item: MenuItemDto,
    qty: Int,
    onAdd: () -> Unit,
    onDec: () -> Unit,
    onDismiss: () -> Unit,
) {
    var selectedStyle by remember { mutableStateOf(sampleStyles.first()) }
    val selectedAddons = remember { mutableStateListOf<FoodAddonOption>() }
    var specialInstructions by remember { mutableStateOf("") }
    var localQty by remember { mutableIntStateOf(if (qty > 0) qty else 1) }

    val basePrice = item.effectivePrice
    val unitPrice = if (item.comboSubItems.isNotEmpty()) basePrice else basePrice + selectedStyle.extraPrice + selectedAddons.sumOf { it.price }
    val totalPrice = unitPrice * localQty

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = White,
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp),
        ) {
            // Food Image
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(LavenderSurface),
                contentAlignment = Alignment.Center,
            ) {
                if (!item.imageUrl.isNullOrBlank()) {
                    AsyncImage(item.imageUrl, item.name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                } else {
                    Text("🍽️", fontSize = 48.sp)
                }
            }

            Spacer(Modifier.height(14.dp))

            // Badges
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VegMarker(item.veg)
                Chip(if (item.veg) "Veg" else "Non-Veg", if (item.veg) AvailableFg else Coral)
                if (item.isAvailable) Chip("Available", AvailableFg)
                if (item.isPopular) Chip("Best seller", PurpleDeep)
            }

            Spacer(Modifier.height(10.dp))

            Text(item.name ?: "", style = MaterialTheme.typography.headlineMedium, color = InkPrimary, fontWeight = FontWeight(800))

            if (!item.description.isNullOrBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(item.description!!, style = MaterialTheme.typography.bodyMedium, color = Muted)
            }

            Spacer(Modifier.height(12.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("₹${fmt(basePrice)}", style = MaterialTheme.typography.headlineSmall, color = InkPrimary, fontWeight = FontWeight(800))
                Text(" base price", style = MaterialTheme.typography.bodyMedium, color = Muted)
                if (item.hasDiscount) {
                    Spacer(Modifier.width(8.dp))
                    Text("₹${fmt(item.price)}", style = MaterialTheme.typography.titleMedium, color = Muted, textDecoration = TextDecoration.LineThrough)
                }
            }

            if (item.comboSubItems.isNotEmpty()) {
                Spacer(Modifier.height(16.dp))
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Items in this combo (${item.comboSubItems.size})",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight(700),
                        color = InkPrimary
                    )
                    Surface(shape = PillShape, color = LavenderChip) {
                        Text(
                            "Combo Offer",
                            color = PurpleDeep,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))

                item.comboSubItems.forEach { sub ->
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = LavenderSurface.copy(alpha = 0.5f),
                        border = BorderStroke(1.dp, BorderGrey.copy(alpha = 0.6f)),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    ) {
                        Row(
                            Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            VegMarker(sub.isVeg)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "${sub.quantity} × ${sub.name}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight(600),
                                color = InkPrimary,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                "₹${fmt(sub.price * sub.quantity)}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight(700),
                                color = InkPrimary,
                            )
                        }
                    }
                }

                Spacer(Modifier.height(8.dp))
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = AvailableBg.copy(alpha = 0.7f),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Actual Total Price: ₹${fmt(item.comboActualTotal)}", style = MaterialTheme.typography.bodySmall, color = Muted, textDecoration = TextDecoration.LineThrough)
                            Text("Combo Offer Price: ₹${fmt(item.effectivePrice)}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = AvailableFg)
                        }
                        if (item.comboActualTotal > item.effectivePrice) {
                            Surface(shape = PillShape, color = AvailableFg) {
                                Text(
                                    "Save ₹${fmt(item.comboActualTotal - item.effectivePrice)}",
                                    color = White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }
                }
            } else {
                Spacer(Modifier.height(20.dp))

                // Choose style: Required · pick 1
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Choose style", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight(700), color = InkPrimary)
                    Surface(shape = PillShape, color = LavenderSurface) {
                        Text("Required · pick 1", color = PurpleDeep, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp))
                    }
                }
                Spacer(Modifier.height(8.dp))

                sampleStyles.forEach { style ->
                    val isSelected = selectedStyle == style
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = White,
                        border = BorderStroke(1.5.dp, if (isSelected) Purple else BorderGrey),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clickableNoRipple { selectedStyle = style },
                    ) {
                        Row(
                            Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = isSelected,
                                onClick = { selectedStyle = style },
                                colors = RadioButtonDefaults.colors(selectedColor = Purple),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(style.name, style = MaterialTheme.typography.bodyLarge, color = InkPrimary, modifier = Modifier.weight(1f))
                            Text(
                                if (style.extraPrice == 0.0) "Included" else "+₹${fmt(style.extraPrice)}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight(600),
                                color = if (style.extraPrice == 0.0) Muted else InkPrimary,
                            )
                        }
                    }
                }

                Spacer(Modifier.height(18.dp))

                // Add-ons: Optional · up to 3
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Add-ons", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight(700), color = InkPrimary)
                    Surface(shape = PillShape, color = LavenderSurface) {
                        Text("Optional · up to 3", color = Muted, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp))
                    }
                }
                Spacer(Modifier.height(8.dp))

                sampleAddons.forEach { addon ->
                    val isChecked = selectedAddons.contains(addon)
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = White,
                        border = BorderStroke(1.5.dp, if (isChecked) Purple else BorderGrey),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clickableNoRipple {
                                if (isChecked) selectedAddons.remove(addon)
                                else if (selectedAddons.size < 3) selectedAddons.add(addon)
                            },
                    ) {
                        Row(
                            Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(
                                checked = isChecked,
                                onCheckedChange = { check ->
                                    if (check) { if (selectedAddons.size < 3) selectedAddons.add(addon) }
                                    else selectedAddons.remove(addon)
                                },
                                colors = CheckboxDefaults.colors(checkedColor = Purple),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(addon.name, style = MaterialTheme.typography.bodyLarge, color = InkPrimary, modifier = Modifier.weight(1f))
                            Text("+₹${fmt(addon.price)}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight(600), color = InkPrimary)
                        }
                    }
                }
            }

            Spacer(Modifier.height(18.dp))

            // Quantity Row
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Quantity", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight(700), color = InkPrimary)
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = LavenderSurface,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "–",
                            color = PurpleDeep,
                            fontSize = 20.sp,
                            fontWeight = FontWeight(700),
                            modifier = Modifier
                                .clickableNoRipple { if (localQty > 1) localQty-- }
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                        Text("$localQty", color = InkPrimary, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight(700))
                        Text(
                            "+",
                            color = PurpleDeep,
                            fontSize = 20.sp,
                            fontWeight = FontWeight(700),
                            modifier = Modifier
                                .clickableNoRipple { localQty++ }
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                    }
                }
            }

            Spacer(Modifier.height(18.dp))

            // Special instructions
            Text("Special instructions", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight(700), color = InkPrimary)
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(
                value = specialInstructions,
                onValueChange = { if (it.length <= 120) specialInstructions = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("e.g. Extra crispy, chutney on the side", color = Muted) },
                shape = RoundedCornerShape(14.dp),
                minLines = 2,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = White,
                    unfocusedContainerColor = White,
                    focusedBorderColor = Purple,
                    unfocusedBorderColor = BorderGrey,
                    cursorColor = Purple,
                ),
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Text("${specialInstructions.length}/120", style = MaterialTheme.typography.labelSmall, color = Muted)
            }

            Spacer(Modifier.height(24.dp))

            // Add to Cart Button with total
            PrimaryButton(
                text = "Add to Cart  ·  ₹${fmt(totalPrice)}",
                onClick = {
                    repeat(localQty) { onAdd() }
                    onDismiss()
                },
            )
        }
    }
}

@Composable
private fun Chip(text: String, color: Color) {
    Surface(shape = RoundedCornerShape(8.dp), color = color.copy(alpha = 0.12f)) {
        Text(text, color = color, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight(600), modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
    }
}

private fun fmt(v: Double): String = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)
