package com.dineinone.waiter.ui.tabledetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CleaningServices
import androidx.compose.material.icons.filled.PersonAddAlt
import androidx.compose.material.icons.filled.ReceiptLong
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
import com.dineinone.waiter.data.remote.dto.OrderDto
import com.dineinone.waiter.data.remote.dto.OrderItemDto
import com.dineinone.waiter.data.remote.dto.TableDto
import com.dineinone.waiter.ui.components.*
import com.dineinone.waiter.ui.theme.*
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

@Composable
fun TableDetailScreen(
    vm: TableDetailViewModel,
    onBack: () -> Unit,
    onAddItems: (String) -> Unit,
    onViewBill: (String) -> Unit,
    onTableAccess: (String) -> Unit,
    onClearTable: (String) -> Unit,
) {
    val ui by vm.ui.collectAsState()

    Column(Modifier.fillMaxSize().background(LavenderSoft)) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = InkPrimary) }
            val t = ui.table
            Column(Modifier.weight(1f)) {
                Text(t?.displayName ?: ("Table T" + (t?.number ?: "")), style = MaterialTheme.typography.headlineMedium, color = InkPrimary)
                Text(buildString {
                    append(t?.areaName ?: "Floor"); append(" · Seats "); append(t?.capacity ?: 0)
                }, style = MaterialTheme.typography.bodySmall, color = Muted)
            }
            t?.let { StatusPill(statusLabel(it.status), statusColors(it.status)) }
        }

        when {
            ui.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Purple) }
            ui.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text(ui.error!!, color = Muted) }
            else -> Content(
                table = ui.table,
                order = ui.order,
                onAddItems = onAddItems,
                onViewBill = onViewBill,
                onTableAccess = onTableAccess,
                onClearTable = onClearTable,
                onMarkServed = vm::markOrderServed,
                onServeItem = { itemId -> vm.markItemStatus(itemId, "served") },
                onUnmerge = vm::unmergeTable,
            )
        }
    }
}

@Composable
private fun ColumnScope.Content(
    table: TableDto?,
    order: OrderDto?,
    onAddItems: (String) -> Unit,
    onViewBill: (String) -> Unit,
    onTableAccess: (String) -> Unit,
    onClearTable: (String) -> Unit,
    onMarkServed: () -> Unit,
    onServeItem: (String) -> Unit,
    onUnmerge: () -> Unit,
) {
    val tableId = table?.id ?: return
    val items = order?.activeItems.orEmpty()
    val hasActiveOrder = order != null && !order.isCompleted && items.isNotEmpty()
    val isAvailable = norm(table.status) == "available"
    val canClear = !isAvailable && (order?.isPaid == true || norm(table.status) == "clearing")

    Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp)) {
        // Waiters + guests/timing
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            InfoCard(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Waiters", style = MaterialTheme.typography.labelMedium, color = Muted, modifier = Modifier.weight(1f))
                    if (!table.coWaiterNames.isNullOrBlank()) StatusPill("Shared", ReservedBg to ReservedFg)
                }
                Spacer(Modifier.height(8.dp))
                val names = listOfNotNull(table.assignedWaiterName?.takeIf { it.isNotBlank() }) +
                    (table.coWaiterNames?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() } ?: emptyList())
                if (names.isEmpty()) Text("Unassigned", style = MaterialTheme.typography.bodySmall, color = Muted)
                else Row(horizontalArrangement = Arrangement.spacedBy((-6).dp)) {
                    names.take(4).forEach { Avatar(initials(it)) }
                }
            }
            InfoCard(Modifier.weight(1f)) {
                KeyVal("Guests", "${table.capacity ?: 0} guests")
                KeyVal("Dining for", diningFor(order?.createdAt))
                KeyVal("Started", startedAt(order?.createdAt))
            }
        }

        Spacer(Modifier.height(18.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Table order", style = MaterialTheme.typography.titleMedium, color = InkPrimary, modifier = Modifier.weight(1f))
            Text("${items.size} items", style = MaterialTheme.typography.bodySmall, color = Muted)
        }
        Spacer(Modifier.height(10.dp))

        if (!hasActiveOrder) {
            InfoCard(Modifier.fillMaxWidth()) {
                Text("No active order on this table.", color = Muted, style = MaterialTheme.typography.bodyMedium)
            }
        } else {
            Surface(shape = RoundedCornerShape(16.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey)) {
                Column(Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Order #${order!!.orderNumber ?: order.id.take(4)}", style = MaterialTheme.typography.titleSmall, color = InkPrimary)
                    Spacer(Modifier.width(8.dp))
                        StatusPill(orderStatusLabel(order.status), statusColors(order.status))
                        Spacer(Modifier.weight(1f))
                        Text("₹${fmt(order.totalAmount ?: items.sumOf { it.lineTotal })}", style = MaterialTheme.typography.titleSmall, color = InkPrimary, fontWeight = FontWeight(700))
                    }
                    Spacer(Modifier.height(10.dp))
                    items.forEach { item ->
                        ItemRow(
                            item = item,
                            onServe = { onServeItem(item.id) },
                        )
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
            BillCard(order!!, items)
        }

        Spacer(Modifier.height(18.dp))
        // Table Access & Clear Table
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            SecondaryButton("Table Access", onClick = { onTableAccess(tableId) }, modifier = Modifier.weight(1f))
            Column(Modifier.weight(1f)) {
                SecondaryButton(
                    text = "Clear Table",
                    onClick = { onClearTable(tableId) },
                    enabled = canClear,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (!canClear) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        if (isAvailable) "Table is already available" else "Available after the bill is paid",
                        style = MaterialTheme.typography.labelSmall,
                        color = Muted,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        if (table?.isMerged == true || !table?.mergedGroupId.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            SecondaryButton(
                text = "Unmerge Table Group",
                onClick = onUnmerge,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(Modifier.height(16.dp))

        // Bottom Actions: + Add Items & View Bill
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            PrimaryButton(
                text = "+ Add Items",
                onClick = { onAddItems(tableId) },
                modifier = Modifier.weight(1f),
            )
            if (hasActiveOrder) {
                InkButton(
                    text = "View Bill",
                    onClick = { onViewBill(tableId) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable private fun InfoCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier, shape = RoundedCornerShape(16.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey)) {
        Column(Modifier.padding(14.dp), content = content)
    }
}

@Composable private fun KeyVal(k: String, v: String) {
    Row(Modifier.padding(vertical = 3.dp)) {
        Text("$k: ", style = MaterialTheme.typography.bodySmall, color = Muted)
        Text(v, style = MaterialTheme.typography.bodySmall, color = InkPrimary, fontWeight = FontWeight(600))
    }
}

@Composable private fun ItemRow(item: OrderItemDto, onServe: (() -> Unit)? = null) {
    val isReady = item.status?.lowercase() == "ready"
    val isCombo = item.isCombo
    val comboSubs = item.parsedComboItems

    Column(Modifier.padding(vertical = 6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)).background(LavenderSurface), contentAlignment = Alignment.Center) {
                if (!item.menuItem?.imageUrl.isNullOrBlank()) AsyncImage(item.menuItem!!.imageUrl, item.name, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else Text(if (isCombo) "🍱" else "🍽️", fontSize = 20.sp)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                val deco = if (item.cancelled) TextDecoration.LineThrough else TextDecoration.None
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${item.quantity} × ${item.name}", style = MaterialTheme.typography.titleSmall, color = InkPrimary, textDecoration = deco)
                    if (isCombo) {
                        Spacer(Modifier.width(6.dp))
                        Surface(shape = PillShape, color = LavenderChip) {
                            Text("Combo", color = PurpleDeep, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }
                }
                if (!item.notes.isNullOrBlank()) {
                    Surface(shape = RoundedCornerShape(6.dp), color = LavenderSurface) {
                        Text("Note: ${item.notes}", style = MaterialTheme.typography.labelSmall, color = Muted, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                    }
                }
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatusPill(itemStatusLabel(item.status), itemStatusColors(item.status))
                    if (isReady && onServe != null) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFF059669),
                            modifier = Modifier.clickableNoRipple(onServe),
                        ) {
                            Row(
                                Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                Icon(Icons.Filled.Check, contentDescription = null, tint = White, modifier = Modifier.size(12.dp))
                                Text("Serve", color = White, fontWeight = FontWeight(800), fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("₹${fmt(item.lineTotal)}", style = MaterialTheme.typography.titleSmall, color = if (item.cancelled) Muted else InkPrimary, textDecoration = if (item.cancelled) TextDecoration.LineThrough else TextDecoration.None)
                if (isCombo && item.comboActualTotal > item.priceAtTime) {
                    Text("₹${fmt(item.comboActualTotal * item.quantity)}", style = MaterialTheme.typography.labelSmall, color = Muted, textDecoration = TextDecoration.LineThrough)
                }
            }
        }

        // Structured combo items list with each price, actual total, and combo offer price
        if (isCombo && comboSubs.isNotEmpty()) {
            Spacer(Modifier.height(6.dp))
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = LavenderSurface.copy(alpha = 0.6f),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey.copy(alpha = 0.4f)),
                modifier = Modifier.fillMaxWidth().padding(start = 54.dp),
            ) {
                Column(Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
                    Text("Items inside combo:", style = MaterialTheme.typography.labelSmall, color = Muted, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(4.dp))
                    comboSubs.forEach { sub ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 1.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("• ${sub.quantity} × ${sub.name ?: "Item"}", style = MaterialTheme.typography.bodySmall, color = InkPrimary)
                            Text("₹${fmt(sub.price * sub.quantity)}", style = MaterialTheme.typography.bodySmall, color = InkPrimary, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    HorizontalDivider(color = BorderGrey.copy(alpha = 0.5f), modifier = Modifier.padding(vertical = 4.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Actual Total: ₹${fmt(item.comboActualTotal)}", style = MaterialTheme.typography.labelSmall, color = Muted, textDecoration = TextDecoration.LineThrough)
                        Text("Combo Price: ₹${fmt(item.priceAtTime)}", style = MaterialTheme.typography.labelSmall, color = AvailableFg, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable private fun BillCard(order: OrderDto, items: List<OrderItemDto>) {
    val subtotal = items.sumOf { it.lineTotal }
    val cgst = if ((order.cgstAmount ?: 0.0) > 0.0) {
        order.cgstAmount!!
    } else if ((order.gstAmount ?: 0.0) > 0.0) {
        order.gstAmount!! / 2.0
    } else {
        subtotal * 0.025
    }

    val sgst = if ((order.sgstAmount ?: 0.0) > 0.0) {
        order.sgstAmount!!
    } else if ((order.gstAmount ?: 0.0) > 0.0) {
        order.gstAmount!! / 2.0
    } else {
        subtotal * 0.025
    }

    val gst = if ((order.gstAmount ?: 0.0) > 0.0) order.gstAmount!! else (cgst + sgst)
    val service = order.serviceCharge ?: 0.0
    val discount = order.discountAmount ?: 0.0
    val computedTotal = (subtotal + gst + service - discount).coerceAtLeast(0.0)
    val dbTotal = order.totalAmount ?: 0.0
    val total = if (dbTotal >= (subtotal + gst - 0.05)) dbTotal else computedTotal
    Surface(shape = RoundedCornerShape(16.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey)) {
        Column(Modifier.padding(16.dp)) {
            Text("Bill Breakdown", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = InkPrimary)
            Spacer(Modifier.height(8.dp))

            items.forEach { itm ->
                Row(Modifier.padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${itm.quantity} × ${itm.name}", style = MaterialTheme.typography.bodySmall, color = InkPrimary, modifier = Modifier.weight(1f))
                    Text("₹${fmt(itm.lineTotal)}", style = MaterialTheme.typography.bodySmall, color = InkPrimary, fontWeight = FontWeight.SemiBold)
                }
                if (itm.isCombo && itm.parsedComboItems.isNotEmpty()) {
                    Column(Modifier.padding(start = 12.dp, bottom = 4.dp)) {
                        itm.parsedComboItems.forEach { sub ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("• ${sub.quantity} × ${sub.name ?: "Item"}", style = MaterialTheme.typography.labelSmall, color = Muted)
                                Text("₹${fmt(sub.price * sub.quantity)}", style = MaterialTheme.typography.labelSmall, color = Muted)
                            }
                        }
                        Row(Modifier.fillMaxWidth().padding(top = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Actual Total: ₹${fmt(itm.comboActualTotal)}", style = MaterialTheme.typography.labelSmall, color = Muted, textDecoration = TextDecoration.LineThrough)
                            Text("Combo Price: ₹${fmt(itm.priceAtTime)}", style = MaterialTheme.typography.labelSmall, color = AvailableFg, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(Modifier.height(6.dp))
            HorizontalDivider(color = BorderGrey)
            Spacer(Modifier.height(6.dp))

            BillRow("Subtotal (${items.size} items)", subtotal)
            BillRow("CGST 2.5%", cgst)
            BillRow("SGST 2.5%", sgst)
            if (service > 0) BillRow("Service charge", service)
            if (discount > 0) BillRow("Discount", -discount)
            Spacer(Modifier.height(8.dp)); HorizontalDivider(color = BorderGrey); Spacer(Modifier.height(8.dp))
            Row {
                Text("Total incl. GST", style = MaterialTheme.typography.titleMedium, color = InkPrimary, modifier = Modifier.weight(1f))
                Text("₹${fmt(total)}", style = MaterialTheme.typography.titleMedium, color = InkPrimary, fontWeight = FontWeight(800))
            }
            Text("Cancelled items not charged", style = MaterialTheme.typography.labelSmall, color = Muted, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable private fun BillRow(label: String, value: Double) {
    Row(Modifier.padding(vertical = 3.dp)) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Muted, modifier = Modifier.weight(1f))
        Text("₹${fmt(value)}", style = MaterialTheme.typography.bodyMedium, color = InkPrimary)
    }
}

@Composable private fun ActionButton(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector, filled: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier.height(52.dp).clickableNoRipple(onClick),
        shape = RoundedCornerShape(14.dp),
        color = if (filled) LavenderChip else White,
        border = if (filled) null else androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
    ) {
        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = if (filled) PurpleDeep else InkPrimary, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(text, color = if (filled) PurpleDeep else InkPrimary, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight(700))
        }
    }
}

@Composable private fun StatusPill(text: String, colors: Pair<Color, Color>) {
    Surface(shape = PillShape, color = colors.first) {
        Text(text, color = colors.second, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp))
    }
}

@Composable private fun Avatar(initials: String) {
    Box(Modifier.size(30.dp).clip(CircleShape).background(LavenderChip).border(2.dp, White, CircleShape), contentAlignment = Alignment.Center) {
        Text(initials, fontSize = 11.sp, color = PurpleDeep, fontWeight = FontWeight(700))
    }
}

// ── helpers ──
private fun fmt(v: Double): String = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)

private fun statusLabel(s: String?): String = when (norm(s)) {
    "available" -> "Available"; "occupied" -> "Occupied"; "reserved" -> "Reserved"
    "clearing" -> "Awaiting clearing"; "on_hold" -> "On hold"; else -> (s ?: "").replaceFirstChar { it.uppercase() }
}
private fun statusColors(s: String?): Pair<Color, Color> = when (norm(s)) {
    "available" -> AvailableBg to AvailableFg
    "occupied", "placed", "preparing" -> OccupiedBg to OccupiedFg
    "reserved" -> ReservedBg to ReservedFg
    "clearing" -> PeachSurface to OccupiedFg
    "served", "paid" -> AvailableBg to AvailableFg
    else -> LavenderChip to PurpleDeep
}
private fun norm(s: String?): String = when ((s ?: "").lowercase()) {
    "empty", "available", "free" -> "available"
    "occupied", "ordered", "seated" -> "occupied"
    "reserved", "booked" -> "reserved"
    "dirty", "cleaning", "awaiting_clearing" -> "clearing"
    "on_hold", "hold" -> "on_hold"
    else -> (s ?: "").lowercase()
}
private fun orderStatusLabel(s: String?): String = when ((s ?: "").lowercase()) {
    "placed", "queued" -> "In progress"; "preparing" -> "Preparing"; "ready" -> "Ready"
    "served" -> "Served"; "paid" -> "Paid"; else -> (s ?: "").replaceFirstChar { it.uppercase() }
}
private fun itemStatusLabel(s: String?): String = when ((s ?: "").lowercase()) {
    "placed", "queued" -> "Sent to Kitchen"; "preparing" -> "Preparing"; "ready" -> "Ready to Serve"
    "served" -> "Served"; "paid" -> "Served"; "cancelled" -> "Cancelled"; else -> (s ?: "")
}
private fun itemStatusColors(s: String?): Pair<Color, Color> = when ((s ?: "").lowercase()) {
    "preparing" -> ReservedBg to ReservedFg
    "ready" -> OccupiedBg to OccupiedFg
    "served", "paid" -> AvailableBg to AvailableFg
    "cancelled" -> PeachSurface to Coral
    else -> LavenderChip to PurpleDeep
}
private fun initials(name: String): String {
    val p = name.trim().split(" ").filter { it.isNotBlank() }
    return if (p.size >= 2) "${p[0].first()}${p[1].first()}".uppercase() else name.take(2).uppercase()
}
private fun diningFor(createdAt: String?): String {
    val start = parse(createdAt) ?: return "—"
    val mins = ChronoUnit.MINUTES.between(start, Instant.now()).coerceAtLeast(0)
    return if (mins >= 60) "${mins / 60}h ${mins % 60}m" else "$mins min"
}
private fun startedAt(createdAt: String?): String {
    val inst = parse(createdAt) ?: return "—"
    return DateTimeFormatter.ofPattern("h:mm a").withZone(ZoneId.systemDefault()).format(inst)
}
private fun parse(s: String?): Instant? = s?.let { runCatching { Instant.parse(it) }.getOrNull() ?: runCatching { java.time.OffsetDateTime.parse(it).toInstant() }.getOrNull() }
