package com.dineinone.waiter.ui.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.RoomService
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.dineinone.waiter.data.remote.dto.RequestDto
import com.dineinone.waiter.ui.theme.*
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun NotificationsScreen(vm: NotificationsViewModel, onBack: () -> Unit) {
    val ui by vm.ui.collectAsState()

    Column(Modifier.fillMaxSize().background(LavenderSoft)) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = InkPrimary) }
            Text("Notifications", style = MaterialTheme.typography.headlineMedium, color = InkPrimary)
        }
        when {
            ui.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Purple) }
            ui.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text(ui.error!!, color = Muted) }
            ui.items.isEmpty() -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text("You're all caught up.", color = Muted) }
            else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(ui.items, key = { it.id }) { r -> NotifRow(r) }
            }
        }
    }
}

@Composable
private fun NotifRow(r: RequestDto) {
    val unread = r.isPending
    Surface(shape = RoundedCornerShape(14.dp), color = if (unread) LavenderSurface else White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(LavenderChip), contentAlignment = Alignment.Center) {
                Icon(iconFor(r.requestType), null, tint = PurpleDeep, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title(r), style = MaterialTheme.typography.titleSmall, color = InkPrimary)
                Text("Table ${r.tableNumber} · ${statusText(r.status)}", style = MaterialTheme.typography.bodySmall, color = Muted)
            }
            Text(timeOf(r.createdAt), style = MaterialTheme.typography.labelSmall, color = Muted)
            if (unread) { Spacer(Modifier.width(8.dp)); Box(Modifier.size(8.dp).clip(CircleShape).background(Coral)) }
        }
    }
}

private fun title(r: RequestDto): String = when ((r.requestType ?: "").lowercase()) {
    "call_waiter" -> "Waiter called"
    "water_requested" -> "Water requested"
    "cutlery_requested" -> "Cutlery requested"
    "bill_requested" -> "Bill requested"
    "table_access_request" -> "Table access request"
    else -> (r.requestType ?: "Update").replace('_', ' ').replaceFirstChar { it.uppercase() }
}
private fun statusText(s: String) = when (s) { "pending" -> "Needs attention"; "accepted" -> "In progress"; "completed" -> "Done"; else -> s }
private fun iconFor(type: String?): ImageVector = when ((type ?: "").lowercase()) {
    "water_requested" -> Icons.Filled.LocalDrink
    "bill_requested" -> Icons.Filled.ReceiptLong
    else -> Icons.Filled.RoomService
}
private fun timeOf(s: String?): String {
    val i = s?.let { runCatching { Instant.parse(it) }.getOrNull() ?: runCatching { java.time.OffsetDateTime.parse(it).toInstant() }.getOrNull() } ?: return ""
    return DateTimeFormatter.ofPattern("h:mm a").withZone(ZoneId.systemDefault()).format(i)
}
