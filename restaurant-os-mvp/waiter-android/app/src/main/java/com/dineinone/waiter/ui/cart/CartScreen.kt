package com.dineinone.waiter.ui.cart

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dineinone.waiter.data.local.CartManager
import com.dineinone.waiter.ui.components.clickableNoRipple
import com.dineinone.waiter.ui.menu.VegMarker
import com.dineinone.waiter.ui.theme.*
import kotlin.math.roundToInt

import com.dineinone.waiter.data.repository.SubmittedOrderInfo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartScreen(
    vm: CartViewModel,
    onBack: () -> Unit,
    onAddMore: () -> Unit,
    onPlaced: (SubmittedOrderInfo) -> Unit,
) {
    val lines by vm.lines.collectAsState()
    val ui by vm.ui.collectAsState()
    val tableLabel = ui.tableLabel ?: ui.tableId?.let { "T$it" } ?: ""
    val list = lines.values.toList()
    var itemPendingDelete by remember { mutableStateOf<com.dineinone.waiter.data.remote.dto.MenuItemDto?>(null) }

    if (itemPendingDelete != null) {
        AlertDialog(
            onDismissRequest = { itemPendingDelete = null },
            title = { Text("Remove Item", fontWeight = FontWeight.Bold, color = InkPrimary) },
            text = { Text("Remove '${itemPendingDelete?.name}' from your cart?", color = InkPrimary) },
            confirmButton = {
                TextButton(
                    onClick = {
                        itemPendingDelete?.let { vm.removeLine(it.id) }
                        itemPendingDelete = null
                    }
                ) {
                    Text("Remove", color = Coral, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { itemPendingDelete = null }) {
                    Text("Cancel", color = Muted)
                }
            },
            containerColor = White,
            shape = RoundedCornerShape(16.dp),
        )
    }

    if (ui.showTablePicker) {
        ModalBottomSheet(onDismissRequest = vm::dismissTablePicker, containerColor = White) {
            Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp)) {
                Text("Order for which table?", style = MaterialTheme.typography.titleMedium, color = InkPrimary)
                Spacer(Modifier.height(12.dp))
                LazyColumn(Modifier.heightIn(max = 380.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(ui.tables, key = { it.id }) { t ->
                        Surface(shape = RoundedCornerShape(12.dp), color = LavenderSurface, modifier = Modifier.fillMaxWidth().clickableNoRipple { vm.selectTable(t) }) {
                            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text("T${t.number}", style = MaterialTheme.typography.titleSmall, color = InkPrimary, modifier = Modifier.weight(1f))
                                Text((t.status ?: "").replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.labelSmall, color = Muted)
                            }
                        }
                    }
                }
            }
        }
    }
    val subtotal = list.sumOf { it.lineTotal }
    val cgst = subtotal * 0.025
    val sgst = subtotal * 0.025
    val total = subtotal + cgst + sgst

    LaunchedEffect(ui.placed, ui.placedOrder) {
        if (ui.placed && ui.placedOrder != null) {
            onPlaced(ui.placedOrder!!)
        }
    }

    Column(Modifier.fillMaxSize().background(LavenderSoft)) {
        // Header with centered Table number (Requirement 5)
        Row(
            Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = InkPrimary)
            }
            Column(
                Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("Cart", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = InkPrimary)
                Spacer(Modifier.height(2.dp))
                if (tableLabel.isNotBlank()) {
                    Surface(
                        shape = PillShape,
                        color = AvailableBg,
                        modifier = Modifier.clickableNoRipple { vm.openTablePicker() },
                    ) {
                        Row(
                            Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Box(Modifier.size(6.dp).clip(CircleShape).background(AvailableFg))
                            Text(tableLabel, color = AvailableFg, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                } else {
                    Surface(
                        shape = PillShape,
                        color = PeachSurface,
                        modifier = Modifier.clickableNoRipple { vm.openTablePicker() },
                    ) {
                        Text(
                            "Select Table ›",
                            color = OccupiedFg,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                        )
                    }
                }
            }
            if (list.isNotEmpty()) {
                Text(
                    "Clear",
                    color = Coral,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickableNoRipple { vm.clear() }.padding(8.dp)
                )
            } else {
                Spacer(Modifier.width(48.dp))
            }
        }

        if (list.isEmpty()) {
            Box(Modifier.fillMaxSize(), Alignment.Center) { Text("Your cart is empty.", color = Muted) }
            return@Column
        }

        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // Requirement 5: removed entire "placing order for {table number}" section inside cart
            items(list, key = { it.item.id }) { line ->
                CartLineRow(
                    line = line,
                    onInc = vm::inc,
                    onDec = vm::dec,
                    onDelete = { itemPendingDelete = line.item }
                )
            }
            item {
                Surface(shape = RoundedCornerShape(14.dp), color = LavenderChip, modifier = Modifier.fillMaxWidth().clickableNoRipple(onAddMore)) {
                    Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Add, null, tint = PurpleDeep)
                        Spacer(Modifier.width(8.dp))
                        Text("Add More Items", color = PurpleDeep, fontWeight = FontWeight(700))
                    }
                }
            }
            item { OrderSummary(subtotal, cgst, sgst, total) }
            item {
                Column {
                    Text("Special instructions", style = MaterialTheme.typography.titleSmall, color = InkPrimary)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = ui.notes, onValueChange = vm::setNotes,
                        modifier = Modifier.fillMaxWidth().height(96.dp),
                        placeholder = { Text("e.g. Extra crispy, chutney on the side", color = Muted) },
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedContainerColor = White, unfocusedContainerColor = White, focusedBorderColor = Purple, unfocusedBorderColor = BorderGrey, cursorColor = Purple),
                    )
                    Text("${ui.notes.length}/120", style = MaterialTheme.typography.labelSmall, color = Muted, modifier = Modifier.align(Alignment.End).padding(top = 4.dp))
                }
            }
            if (ui.error != null) {
                item { Text(ui.error!!, color = ErrorRed, style = MaterialTheme.typography.bodySmall) }
            }
        }

        Box(Modifier.navigationBarsPadding().padding(16.dp)) {
            SlideToOrder(total = total, submitting = ui.submitting, onConfirm = vm::placeOrder)
        }
    }
}

@Composable
private fun CartLineRow(
    line: CartManager.Line,
    onInc: (com.dineinone.waiter.data.remote.dto.MenuItemDto) -> Unit,
    onDec: (com.dineinone.waiter.data.remote.dto.MenuItemDto) -> Unit,
    onDelete: () -> Unit
) {
    Surface(shape = RoundedCornerShape(16.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(50.dp).clip(RoundedCornerShape(12.dp)).background(LavenderSurface), contentAlignment = Alignment.Center) {
                if (!line.item.imageUrl.isNullOrBlank()) AsyncImage(line.item.imageUrl, line.item.name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    VegMarker(line.item.veg)
                    Spacer(Modifier.width(5.dp))
                    // Requirement 19: reduce each item name text size
                    Text(
                        line.item.name ?: "",
                        style = MaterialTheme.typography.bodyMedium,
                        fontSize = 13.sp,
                        color = InkPrimary,
                        fontWeight = FontWeight(600),
                        maxLines = 2
                    )
                }
                if (line.item.isCombo && line.item.comboSubItems.isNotEmpty()) {
                    Text(
                        "${line.item.comboSubItems.size} items included",
                        fontSize = 11.sp,
                        color = PurpleDeep,
                        fontWeight = FontWeight(600)
                    )
                }
            }
            Spacer(Modifier.width(8.dp))
            // Requirement 19: move counter down, replace price of each item to above count button, and reduce counter button sizes
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "₹${fmt(line.lineTotal)}",
                    style = MaterialTheme.typography.titleSmall,
                    color = InkPrimary,
                    fontWeight = FontWeight(700),
                    fontSize = 14.sp
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(
                        Icons.Filled.DeleteOutline,
                        "Remove",
                        tint = Coral,
                        modifier = Modifier.size(24.dp).clickableNoRipple(onDelete).padding(2.dp)
                    )
                    Surface(shape = RoundedCornerShape(8.dp), color = LavenderSurface, modifier = Modifier.height(26.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Filled.Remove,
                                "-",
                                tint = PurpleDeep,
                                modifier = Modifier
                                    .clickableNoRipple {
                                        if (line.qty <= 1) onDelete()
                                        else onDec(line.item)
                                    }
                                    .padding(horizontal = 6.dp, vertical = 4.dp)
                                    .size(13.dp)
                            )
                            Text(
                                "${line.qty}",
                                color = InkPrimary,
                                fontWeight = FontWeight(700),
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 4.dp)
                            )
                            Icon(
                                Icons.Filled.Add,
                                "+",
                                tint = PurpleDeep,
                                modifier = Modifier
                                    .clickableNoRipple { onInc(line.item) }
                                    .padding(horizontal = 6.dp, vertical = 4.dp)
                                    .size(13.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OrderSummary(subtotal: Double, cgst: Double, sgst: Double, total: Double) {
    Surface(shape = RoundedCornerShape(16.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey)) {
        Column(Modifier.padding(16.dp)) {
            Text("Order summary", style = MaterialTheme.typography.titleSmall, color = InkPrimary)
            Spacer(Modifier.height(10.dp))
            SummaryRow("Subtotal", "₹${fmt(subtotal)}")
            SummaryRow("CGST 2.5%", "₹${fmt(cgst)}")
            SummaryRow("SGST 2.5%", "₹${fmt(sgst)}")
            Spacer(Modifier.height(8.dp))
            HorizontalDivider(color = BorderGrey)
            Spacer(Modifier.height(8.dp))
            Row {
                Text("Estimated total", style = MaterialTheme.typography.titleMedium, color = InkPrimary, modifier = Modifier.weight(1f))
                Text("₹${fmt(total)}", style = MaterialTheme.typography.titleMedium, color = InkPrimary, fontWeight = FontWeight(800))
            }
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(Modifier.padding(vertical = 3.dp)) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Muted, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodyMedium, color = InkPrimary)
    }
}

@Composable
private fun SlideToOrder(total: Double, submitting: Boolean, onConfirm: () -> Unit) {
    com.dineinone.waiter.ui.components.SlideToConfirmButton(
        text = "Slide to order   ₹${fmt(total)}",
        submitting = submitting,
        onConfirm = onConfirm,
    )
}

private fun fmt(v: Double): String = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)
