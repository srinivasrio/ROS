package com.dineinone.waiter.ui.requests

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.RoomService
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dineinone.waiter.data.remote.dto.RequestDto
import com.dineinone.waiter.ui.components.clickableNoRipple
import com.dineinone.waiter.ui.theme.*
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import coil.compose.AsyncImage
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun RequestsScreen(vm: RequestsViewModel, onOpenProfile: () -> Unit, onOpenNotifications: () -> Unit) {
    val ui by vm.ui.collectAsState()
    val restaurant by vm.restaurantName.collectAsState()
    val logoUrl by vm.logoUrl.collectAsState()
    val waiterName by vm.waiterName.collectAsState()
    val avatarUrl by vm.avatarUrl.collectAsState()
    val initials = remember(waiterName) {
        waiterName.split(" ")
            .filter { it.isNotBlank() }
            .map { it.first().uppercase() }
            .take(2)
            .joinToString("")
            .ifBlank { "W" }
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                if (!logoUrl.isNullOrBlank()) {
                    AsyncImage(model = logoUrl, contentDescription = "Restaurant Logo", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                } else {
                    Text("🍃", fontSize = 16.sp)
                }
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    restaurant,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    fontSize = 19.sp,
                    color = InkPrimary,
                    maxLines = 1
                )
            }
            BadgedBox(badge = { if (ui.pending > 0) Badge(containerColor = Coral) { Text("${ui.pending}") } }) {
                IconButton(onClick = onOpenNotifications) { Icon(Icons.Outlined.NotificationsNone, "Notifications", tint = InkPrimary) }
            }
            Box(
                Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(LavenderChip)
                    .clickableNoRipple(onOpenProfile),
                contentAlignment = Alignment.Center
            ) {
                if (!avatarUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = avatarUrl,
                        contentDescription = "Avatar",
                        modifier = Modifier.fillMaxSize().clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Text(initials, style = MaterialTheme.typography.labelLarge, color = PurpleDeep)
                }
            }
        }

        Text(
            "Requests",
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            color = InkPrimary,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp)
        )

        FilterTabs(ui, vm::setFilter)

        when {
            ui.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Purple) }
            ui.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text(ui.error!!, color = Muted) }
            ui.visible.isEmpty() -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text("No requests here.", color = Muted) }
            else -> LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(ui.visible, key = { it.id }) { r ->
                    RequestCard(r,
                        onAccept = { vm.accept(r.id) }, onComplete = { vm.complete(r.id) },
                        onApprove = { vm.approveAccess(r.id) }, onDecline = { vm.declineAccess(r.id) })
                }
            }
        }
    }
}

@Composable
private fun FilterTabs(ui: RequestsUiState, onFilter: (ReqFilter) -> Unit) {
    Surface(
        shape = PillShape,
        color = LavenderSurface.copy(alpha = 0.72f),
        border = androidx.compose.foundation.BorderStroke(1.dp, White.copy(alpha = 0.65f)),
        shadowElevation = 4.dp,
        tonalElevation = 0.dp,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).height(50.dp)
    ) {
        BoxWithConstraints(Modifier.fillMaxSize().padding(horizontal = 4.dp, vertical = 3.dp)) {
            val pillWidth = maxWidth / 4
            val targetOffset = pillWidth * ui.filter.ordinal
            val animatedOffset by animateDpAsState(
                targetValue = targetOffset,
                animationSpec = spring(
                    dampingRatio = 0.78f,
                    stiffness = Spring.StiffnessMediumLow
                ),
                label = "RequestsTabTravel"
            )

            // Animated sliding indicator capsule around active button only
            Box(
                Modifier
                    .offset(x = animatedOffset)
                    .width(pillWidth)
                    .fillMaxHeight()
                    .clip(PillShape)
                    .background(LavenderChip)
            )

            Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                Tab("All", ui.all.size, ui.filter == ReqFilter.ALL, Modifier.weight(1f).fillMaxHeight()) { onFilter(ReqFilter.ALL) }
                Tab("Pending", ui.pending, ui.filter == ReqFilter.PENDING, Modifier.weight(1f).fillMaxHeight()) { onFilter(ReqFilter.PENDING) }
                Tab("In Progress", ui.inProgress, ui.filter == ReqFilter.IN_PROGRESS, Modifier.weight(1f).fillMaxHeight()) { onFilter(ReqFilter.IN_PROGRESS) }
                Tab("Done", ui.completed, ui.filter == ReqFilter.COMPLETED, Modifier.weight(1f).fillMaxHeight()) { onFilter(ReqFilter.COMPLETED) }
            }
        }
    }
}

@Composable
private fun Tab(label: String, count: Int, active: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier
            .clip(PillShape)
            .clickableNoRipple(onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = if (active) PurpleDeep else Muted, fontWeight = FontWeight(if (active) 700 else 500))
        Text("$count", style = MaterialTheme.typography.titleSmall, color = if (active) PurpleDeep else InkPrimary, fontWeight = FontWeight(if (active) 800 else 600))
    }
}

@Composable
private fun RequestCard(r: RequestDto, onAccept: () -> Unit, onComplete: () -> Unit, onApprove: () -> Unit, onDecline: () -> Unit) {
    val isAccess = (r.requestType ?: "").equals("table_access_request", true)
    Surface(shape = RoundedCornerShape(16.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey)) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(shape = RoundedCornerShape(8.dp), color = LavenderChip) {
                    Text("Table ${r.tableNumber}", color = PurpleDeep, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                }
                Spacer(Modifier.weight(1f))
                StatusDot(r.status)
            }
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                val drawableRes = requestDrawableFor(r.requestType)
                Box(
                    Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(LavenderSurface)
                        .border(1.dp, BorderGrey, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    if (drawableRes != null) {
                        Image(
                            painter = painterResource(drawableRes),
                            contentDescription = labelFor(r.requestType),
                            modifier = Modifier.size(34.dp),
                            contentScale = ContentScale.Fit
                        )
                    } else {
                        Icon(iconFor(r.requestType), null, tint = PurpleDeep, modifier = Modifier.size(24.dp))
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(labelFor(r.requestType), style = MaterialTheme.typography.titleSmall, color = InkPrimary, fontWeight = FontWeight(700))
                        if (r.quantity > 1) Text("  × ${r.quantity}", style = MaterialTheme.typography.bodyMedium, color = PurpleDeep, fontWeight = FontWeight(700))
                    }
                    Text(if (r.assignedWaiterId.isNullOrBlank()) "Unassigned" else "Assigned", style = MaterialTheme.typography.bodySmall, color = Muted)
                }
                Text(timeOf(r.createdAt), style = MaterialTheme.typography.labelSmall, color = Muted)
            }
            if (!r.notes.isNullOrBlank() && !r.notes!!.trimStart().startsWith("{")) {
                Spacer(Modifier.height(8.dp))
                Surface(shape = RoundedCornerShape(8.dp), color = LavenderSurface, modifier = Modifier.fillMaxWidth()) {
                    Text("\"${r.notes}\"", style = MaterialTheme.typography.bodySmall, color = Muted, modifier = Modifier.padding(10.dp))
                }
            }
            if (!r.isCompleted) {
                Spacer(Modifier.height(12.dp))
                when {
                    isAccess && r.isPending -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Surface(shape = RoundedCornerShape(12.dp), color = White, border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey), modifier = Modifier.weight(1f).clickableNoRipple(onDecline)) {
                            Box(Modifier.padding(vertical = 12.dp), contentAlignment = Alignment.Center) { Text("Decline", color = InkPrimary, fontWeight = FontWeight(600)) }
                        }
                        Surface(shape = RoundedCornerShape(12.dp), color = LavenderChip, modifier = Modifier.weight(1f).clickableNoRipple(onApprove)) {
                            Box(Modifier.padding(vertical = 12.dp), contentAlignment = Alignment.Center) { Text("Approve", color = PurpleDeep, fontWeight = FontWeight(700)) }
                        }
                    }
                    r.isPending -> Surface(shape = RoundedCornerShape(12.dp), color = LavenderChip, modifier = Modifier.fillMaxWidth().clickableNoRipple(onAccept)) {
                        Box(Modifier.padding(vertical = 12.dp), contentAlignment = Alignment.Center) { Text("Accept Request", color = PurpleDeep, fontWeight = FontWeight(700)) }
                    }
                    else -> Surface(shape = RoundedCornerShape(12.dp), color = LavenderChip, modifier = Modifier.fillMaxWidth().clickableNoRipple(onComplete)) {
                        Box(Modifier.padding(vertical = 12.dp), contentAlignment = Alignment.Center) { Text("Mark Completed", color = PurpleDeep, fontWeight = FontWeight(700)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusDot(status: String) {
    val (label, color) = when (status) {
        "pending" -> "Pending" to Coral
        "accepted" -> "In Progress" to OrangeWarn
        "completed" -> "Completed" to AvailableFg
        else -> status to Muted
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(6.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = color, fontWeight = FontWeight(600))
    }
}

private fun requestDrawableFor(type: String?): Int? = when ((type ?: "").lowercase().trim()) {
    "water_requested", "water" -> com.dineinone.waiter.R.drawable.svc_water
    "bill_requested", "bill" -> com.dineinone.waiter.R.drawable.svc_bill
    "cutlery_requested", "cutlery" -> com.dineinone.waiter.R.drawable.svc_cutlery
    "plate_requested", "extra_plate", "plate" -> com.dineinone.waiter.R.drawable.svc_plate
    "glass_requested", "extra_glass", "glass" -> com.dineinone.waiter.R.drawable.svc_glass
    "bowl_requested", "finger_bowl" -> com.dineinone.waiter.R.drawable.svc_finger_bowl
    "salt_requested", "salt" -> com.dineinone.waiter.R.drawable.svc_salt
    "pepper_requested", "pepper" -> com.dineinone.waiter.R.drawable.svc_pepper
    "sauce_requested", "ketchup" -> com.dineinone.waiter.R.drawable.svc_ketchup
    "tissue_requested", "tissue" -> com.dineinone.waiter.R.drawable.svc_tissue
    "call_waiter" -> com.dineinone.waiter.R.drawable.svc_waiter
    else -> null
}

private fun iconFor(type: String?): ImageVector = when ((type ?: "").lowercase()) {
    "water_requested" -> Icons.Filled.LocalDrink
    "cutlery_requested" -> Icons.Filled.Restaurant
    "bill_requested" -> Icons.Filled.ReceiptLong
    else -> Icons.Filled.RoomService
}

private fun labelFor(type: String?): String = when ((type ?: "").lowercase()) {
    "call_waiter" -> "Call Waiter"
    "water_requested" -> "Water"
    "cutlery_requested" -> "Cutlery"
    "bill_requested" -> "Bill"
    "table_access_request" -> "Table Access"
    "plate_requested" -> "Extra Plate"
    "glass_requested" -> "Extra Glass"
    "tissue_requested" -> "Tissue"
    "sauce_requested" -> "Ketchup"
    else -> (type ?: "Request").replace('_', ' ').replaceFirstChar { it.uppercase() }
}

private fun timeOf(createdAt: String?): String {
    val inst = createdAt?.let { runCatching { Instant.parse(it) }.getOrNull() ?: runCatching { java.time.OffsetDateTime.parse(it).toInstant() }.getOrNull() } ?: return ""
    return DateTimeFormatter.ofPattern("h:mm a").withZone(ZoneId.systemDefault()).format(inst)
}
