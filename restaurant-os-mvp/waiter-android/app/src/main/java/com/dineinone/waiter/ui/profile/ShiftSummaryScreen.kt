package com.dineinone.waiter.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dineinone.waiter.data.repository.ShiftStats
import com.dineinone.waiter.ui.theme.*
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun ShiftSummaryScreen(vm: ShiftViewModel, onBack: () -> Unit) {
    val ui by vm.ui.collectAsState()

    Column(Modifier.fillMaxSize().background(LavenderSoft)) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = InkPrimary) }
            Text("Shift Summary", style = MaterialTheme.typography.headlineMedium, color = InkPrimary)
        }
        when {
            ui.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Purple) }
            ui.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text(ui.error!!, color = Muted) }
            else -> ShiftBody(ui.stats!!)
        }
    }
}

@Composable
private fun ColumnScope.ShiftBody(s: ShiftStats) {
    Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp)) {
        // Today card
        Surface(shape = RoundedCornerShape(16.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Today · ${today()}", style = MaterialTheme.typography.titleSmall, color = InkPrimary, modifier = Modifier.weight(1f))
                    Surface(shape = PillShape, color = AvailableBg) {
                        Row(Modifier.padding(horizontal = 10.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(6.dp).clip(CircleShape).background(AvailableFg)); Spacer(Modifier.width(5.dp))
                            Text("On shift", style = MaterialTheme.typography.labelSmall, color = AvailableFg)
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row {
                    KeyBig("Started", timeOf(s.startedAt), Modifier.weight(1f))
                    KeyBig("Ends", "—", Modifier.weight(1f))
                    KeyBig("Duration", durationOf(s.startedAt), Modifier.weight(1f))
                }
                Spacer(Modifier.height(6.dp))
                Text("Times in device local time", style = MaterialTheme.typography.labelSmall, color = Muted)
            }
        }

        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatTile("Tables Served", "${s.tablesServed}", AvailableBg, AvailableFg, Modifier.weight(1f))
            StatTile("Orders Handled", "${s.ordersHandled}", LavenderSurface, PurpleDeep, Modifier.weight(1f))
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatTile("Requests Resolved", "${s.requestsResolved}", ReservedBg, ReservedFg, Modifier.weight(1f))
            StatTile("Pending Tasks", "${s.pendingTasks}", PeachSurface, OccupiedFg, Modifier.weight(1f))
        }
        Spacer(Modifier.height(10.dp))
        Text("Total sales: ₹${fmt(s.totalSales)}", style = MaterialTheme.typography.bodyMedium, color = InkPrimary, fontWeight = FontWeight(700))
        Text("Orders count each submission once. Shared tables count for every waiter who served them.", style = MaterialTheme.typography.labelSmall, color = Muted, modifier = Modifier.padding(top = 4.dp))

        Spacer(Modifier.height(18.dp))
        Text("Recent activity", style = MaterialTheme.typography.titleMedium, color = InkPrimary)
        Spacer(Modifier.height(10.dp))
        Surface(shape = RoundedCornerShape(16.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(4.dp)) {
                val activity = buildActivity(s)
                if (activity.isEmpty()) Text("No activity yet today.", color = Muted, modifier = Modifier.padding(16.dp))
                activity.take(12).forEach { (title, sub, time) -> ActivityRow(title, sub, time) }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable private fun KeyBig(k: String, v: String, modifier: Modifier) {
    Column(modifier) {
        Text(k, style = MaterialTheme.typography.labelSmall, color = Muted)
        Text(v, style = MaterialTheme.typography.titleSmall, color = InkPrimary, fontWeight = FontWeight(700))
    }
}

@Composable private fun StatTile(label: String, value: String, bg: Color, fg: Color, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(16.dp)).background(bg).padding(16.dp)) {
        Text(value, fontSize = 26.sp, fontWeight = FontWeight(800), color = fg)
        Text(label, style = MaterialTheme.typography.labelMedium, color = fg)
    }
}

@Composable private fun ActivityRow(title: String, sub: String, time: String) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(Purple))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = InkPrimary)
            if (sub.isNotBlank()) Text(sub, style = MaterialTheme.typography.bodySmall, color = Muted)
        }
        Text(time, style = MaterialTheme.typography.labelSmall, color = Muted)
    }
}

private fun buildActivity(s: ShiftStats): List<Triple<String, String, String>> {
    val fromOrders = s.orders.map { Triple("Order submitted", "#${it.orderNumber ?: ""} · ₹${fmt(it.totalAmount ?: 0.0)}", it.createdAt) }
    val fromReqs = s.requests.map { Triple(
        if (it.requestStatus.equals("completed", true)) "Request resolved" else "Request received",
        (it.requestType ?: "").replace('_', ' '), it.createdAt,
    ) }
    return (fromOrders + fromReqs).sortedByDescending { it.third ?: "" }.map { Triple(it.first, it.second, timeOf(it.third)) }
}

private fun fmt(v: Double): String = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)
private fun today(): String = DateTimeFormatter.ofPattern("EEE d MMM").withZone(ZoneId.systemDefault()).format(Instant.now())
private fun parse(s: String?): Instant? = s?.let { runCatching { Instant.parse(it) }.getOrNull() ?: runCatching { java.time.OffsetDateTime.parse(it).toInstant() }.getOrNull() }
private fun timeOf(s: String?): String { val i = parse(s) ?: return "—"; return DateTimeFormatter.ofPattern("h:mm a").withZone(ZoneId.systemDefault()).format(i) }
private fun durationOf(s: String?): String {
    val start = parse(s) ?: return "—"
    val d = Duration.between(start, Instant.now())
    val h = d.toHours(); val m = d.toMinutes() % 60
    return if (h > 0) "${h}h ${m}min" else "${m}min"
}
