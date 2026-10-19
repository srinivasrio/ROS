package com.dineinone.waiter.ui.access

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dineinone.waiter.data.remote.dto.TableDto
import com.dineinone.waiter.data.remote.dto.WaiterStaffDto
import com.dineinone.waiter.ui.components.clickableNoRipple
import com.dineinone.waiter.ui.theme.*

@Composable
fun TableAccessScreen(vm: TableAccessViewModel, onBack: () -> Unit) {
    val ui by vm.ui.collectAsState()
    val t = ui.table

    var waiterToTransfer by remember { mutableStateOf<WaiterStaffDto?>(null) }

    if (waiterToTransfer != null) {
        AlertDialog(
            onDismissRequest = { waiterToTransfer = null },
            title = { Text("Transfer Table T${t?.number ?: ""}", fontWeight = FontWeight(700)) },
            text = { Text("Are you sure you want to transfer primary ownership of Table T${t?.number ?: ""} to ${waiterToTransfer?.name}? They will manage this table and its orders.") },
            confirmButton = {
                Button(
                    onClick = {
                        val target = waiterToTransfer
                        waiterToTransfer = null
                        if (target != null) vm.transferAccess(target)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Purple, contentColor = White)
                ) {
                    Text("Confirm Transfer", fontWeight = FontWeight(700))
                }
            },
            dismissButton = {
                TextButton(onClick = { waiterToTransfer = null }) {
                    Text("Cancel", color = Muted)
                }
            }
        )
    }

    Column(Modifier.fillMaxSize().background(LavenderSoft)) {
        // Header
        Row(
            Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = InkPrimary)
            }
            Column(Modifier.weight(1f)) {
                Text(
                    "Table T${t?.number ?: ""}",
                    style = MaterialTheme.typography.headlineMedium,
                    color = InkPrimary
                )
                Text(
                    if (ui.assignedToOther) "Assigned to another waiter" else "Manage table permissions",
                    style = MaterialTheme.typography.bodySmall,
                    color = Muted
                )
            }
        }

        when {
            ui.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                CircularProgressIndicator(color = Purple)
            }
            t == null -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                Text(ui.error ?: "Table not found", color = Muted)
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // Success or Error Feedback Banner
                    if (ui.successMessage != null) {
                        item {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = AvailableBg,
                                border = androidx.compose.foundation.BorderStroke(1.dp, AvailableFg.copy(alpha = 0.4f)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Filled.CheckCircle, null, tint = AvailableFg, modifier = Modifier.size(20.dp))
                                    Spacer(Modifier.width(10.dp))
                                    Text(ui.successMessage!!, color = AvailableFg, fontSize = 13.sp, fontWeight = FontWeight(600))
                                }
                            }
                        }
                    }

                    if (ui.error != null) {
                        item {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = ErrorRed.copy(alpha = 0.1f),
                                border = androidx.compose.foundation.BorderStroke(1.dp, ErrorRed.copy(alpha = 0.4f)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    ui.error!!,
                                    color = ErrorRed,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight(500),
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }
                    }

                    // Current Assignment Card
                    item {
                        Text("CURRENT PRIMARY WAITER", style = MaterialTheme.typography.labelSmall, color = Muted)
                        Spacer(Modifier.height(6.dp))
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = White,
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                val currentAssigned = ui.assignedStaff
                                val currentAvatar = currentAssigned?.avatarUrl ?: t.assignedWaiterAvatar
                                val currentName = currentAssigned?.name ?: t.assignedWaiterName ?: "Unassigned"

                                Box(
                                    Modifier
                                        .size(46.dp)
                                        .clip(CircleShape)
                                        .background(LavenderChip),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (!currentAvatar.isNullOrBlank()) {
                                        AsyncImage(
                                            model = currentAvatar,
                                            contentDescription = currentName,
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = ContentScale.Crop
                                        )
                                    } else {
                                        Text(
                                            initials(currentName),
                                            color = PurpleDeep,
                                            fontWeight = FontWeight(700),
                                            fontSize = 15.sp
                                        )
                                    }
                                }

                                Spacer(Modifier.width(12.dp))

                                Column(Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            currentName,
                                            style = MaterialTheme.typography.titleMedium,
                                            color = InkPrimary,
                                            fontWeight = FontWeight(700)
                                        )
                                        if (currentAssigned?.isOnline == true) {
                                            Spacer(Modifier.width(6.dp))
                                            Box(
                                                Modifier
                                                    .size(8.dp)
                                                    .clip(CircleShape)
                                                    .background(AvailableFg)
                                            )
                                        }
                                    }
                                    Text(
                                        when {
                                            ui.assignedToOther -> "Assigned to another waiter"
                                            t.assignedWaiterId == ui.myUserId -> "You are managing this table"
                                            else -> "Unassigned table"
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (ui.assignedToOther) Coral else Muted
                                    )
                                }

                                val isMyTable = t.assignedWaiterId == ui.myUserId
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (isMyTable) AvailableBg else LavenderChip,
                                    modifier = Modifier.padding(start = 4.dp)
                                ) {
                                    Text(
                                        if (isMyTable) "Mine" else if (ui.assignedToOther) "Assigned" else "Free",
                                        color = if (isMyTable) AvailableFg else PurpleDeep,
                                        fontWeight = FontWeight(700),
                                        fontSize = 12.sp,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }

                    // Co-waiters banner if any
                    val coWaiterIds = t.activeCoWaiterIds
                    if (coWaiterIds.isNotEmpty()) {
                        val coWaiterNames = ui.allStaff
                            .filter { it.id in coWaiterIds }
                            .map { it.name }
                            .ifEmpty { listOf("${coWaiterIds.size} waiter(s)") }

                        item {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = White,
                                border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(Modifier.padding(12.dp)) {
                                    Text("Shared Access (Co-Waiters)", style = MaterialTheme.typography.labelSmall, color = Muted)
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        coWaiterNames.joinToString(", "),
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = InkPrimary,
                                        fontWeight = FontWeight(600)
                                    )
                                }
                            }
                        }
                    }

                    // If user is locked out: show request access card
                    if (ui.assignedToOther) {
                        item {
                            if (ui.requestSent) {
                                SentCard()
                            } else {
                                LockedCard(t.assignedWaiterName ?: ui.assignedStaff?.name ?: "the waiter")
                                Spacer(Modifier.height(8.dp))
                                Surface(
                                    shape = RoundedCornerShape(14.dp),
                                    color = Purple,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickableNoRipple { vm.requestAccess() }
                                ) {
                                    Box(Modifier.padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
                                        if (ui.submitting && ui.actionWaiterId == null) {
                                            CircularProgressIndicator(color = White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                                        } else {
                                            Text("Request Table Access", color = White, fontWeight = FontWeight(700))
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Section: Remaining Waiters to Transfer or Give Access
                    item {
                        Spacer(Modifier.height(4.dp))
                        Column {
                            Text(
                                "AVAILABLE WAITERS & STAFF",
                                style = MaterialTheme.typography.labelSmall,
                                color = Muted,
                                fontWeight = FontWeight(700)
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                "Give or transfer access of Table T${t.number} to another waiter",
                                style = MaterialTheme.typography.bodySmall,
                                color = Muted
                            )
                        }
                    }

                    if (ui.otherWaiters.isEmpty()) {
                        item {
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = White,
                                border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Box(Modifier.padding(20.dp), contentAlignment = Alignment.Center) {
                                    Text("No other waiters found in this restaurant", color = Muted, fontSize = 13.sp)
                                }
                            }
                        }
                    } else {
                        items(ui.otherWaiters, key = { it.id }) { waiter ->
                            val isPrimary = waiter.id == t.assignedWaiterId
                            val isCoWaiter = waiter.id in t.activeCoWaiterIds
                            val isActionLoading = ui.submitting && ui.actionWaiterId == waiter.id

                            WaiterAccessRow(
                                waiter = waiter,
                                isPrimary = isPrimary,
                                isCoWaiter = isCoWaiter,
                                isLoading = isActionLoading,
                                onTransferClick = { waiterToTransfer = waiter },
                                onGiveAccessClick = { vm.giveAccess(waiter) },
                                onRevokeAccessClick = { vm.revokeAccess(waiter) }
                            )
                        }
                    }

                    item {
                        Spacer(Modifier.height(30.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun WaiterAccessRow(
    waiter: WaiterStaffDto,
    isPrimary: Boolean,
    isCoWaiter: Boolean,
    isLoading: Boolean,
    onTransferClick: () -> Unit,
    onGiveAccessClick: () -> Unit,
    onRevokeAccessClick: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = White,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (isPrimary) Purple.copy(alpha = 0.5f) else BorderGrey
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Avatar with online badge
                Box(contentAlignment = Alignment.BottomEnd) {
                    Box(
                        Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(LavenderChip),
                        contentAlignment = Alignment.Center
                    ) {
                        if (!waiter.avatarUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = waiter.avatarUrl,
                                contentDescription = waiter.name,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Text(
                                initials(waiter.name),
                                color = PurpleDeep,
                                fontWeight = FontWeight(700),
                                fontSize = 14.sp
                            )
                        }
                    }
                    // Status dot
                    Box(
                        Modifier
                            .size(11.dp)
                            .clip(CircleShape)
                            .background(if (waiter.isOnline) AvailableFg else BorderGrey)
                            .border(1.5.dp, White, CircleShape)
                    )
                }

                Spacer(Modifier.width(12.dp))

                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            waiter.name,
                            style = MaterialTheme.typography.titleSmall,
                            color = InkPrimary,
                            fontWeight = FontWeight(700)
                        )
                        if (waiter.isOnline) {
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Online",
                                color = AvailableFg,
                                fontSize = 11.sp,
                                fontWeight = FontWeight(600)
                            )
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            waiter.role?.replace('_', ' ')?.replaceFirstChar { it.uppercase() } ?: "Waiter",
                            style = MaterialTheme.typography.bodySmall,
                            color = Muted
                        )
                        if (!waiter.employeeId.isNullOrBlank()) {
                            Text(" • ${waiter.employeeId}", style = MaterialTheme.typography.bodySmall, color = Muted)
                        }
                    }
                }

                // Status chip
                if (isPrimary) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = LavenderChip,
                        modifier = Modifier.padding(start = 4.dp)
                    ) {
                        Text(
                            "Primary",
                            color = PurpleDeep,
                            fontWeight = FontWeight(700),
                            fontSize = 11.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                } else if (isCoWaiter) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = AvailableBg,
                        modifier = Modifier.padding(start = 4.dp)
                    ) {
                        Text(
                            "Co-Waiter",
                            color = AvailableFg,
                            fontWeight = FontWeight(700),
                            fontSize = 11.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                }
            }

            Spacer(Modifier.height(10.dp))

            // Action buttons row
            if (isLoading) {
                Box(Modifier.fillMaxWidth().height(36.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Purple, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Transfer Access Button
                    if (!isPrimary) {
                        Button(
                            onClick = onTransferClick,
                            modifier = Modifier.weight(1f).height(38.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Purple,
                                contentColor = White
                            ),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Icon(Icons.Filled.SwapHoriz, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Transfer", fontSize = 12.sp, fontWeight = FontWeight(700))
                        }
                    }

                    // Give or Revoke Co-Waiter Access Button
                    if (isCoWaiter) {
                        OutlinedButton(
                            onClick = onRevokeAccessClick,
                            modifier = Modifier.weight(1f).height(38.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed),
                            border = androidx.compose.foundation.BorderStroke(1.dp, ErrorRed.copy(alpha = 0.5f)),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text("Remove Access", fontSize = 12.sp, fontWeight = FontWeight(600))
                        }
                    } else if (!isPrimary) {
                        FilledTonalButton(
                            onClick = onGiveAccessClick,
                            modifier = Modifier.weight(1f).height(38.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.filledTonalButtonColors(
                                containerColor = LavenderChip,
                                contentColor = PurpleDeep
                            ),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text("+ Give Access", fontSize = 12.sp, fontWeight = FontWeight(700))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LockedCard(waiter: String) {
    Surface(shape = RoundedCornerShape(16.dp), color = LavenderSurface, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(White), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Lock, null, tint = Muted, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.height(8.dp))
            Text("Orders and bill are hidden", style = MaterialTheme.typography.titleSmall, color = InkPrimary)
            Spacer(Modifier.height(4.dp))
            Text(
                "You'll see this table's orders, bill and actions once $waiter or a manager approves your request.",
                style = MaterialTheme.typography.bodySmall,
                color = Muted
            )
        }
    }
}

@Composable
private fun SentCard() {
    Surface(shape = RoundedCornerShape(16.dp), color = AvailableBg, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Filled.CheckCircle, null, tint = AvailableFg, modifier = Modifier.size(32.dp))
            Spacer(Modifier.height(8.dp))
            Text("Access request sent", style = MaterialTheme.typography.titleSmall, color = AvailableFg, fontWeight = FontWeight(700))
            Spacer(Modifier.height(4.dp))
            Text("The assigned waiter or a manager will review it shortly.", style = MaterialTheme.typography.bodySmall, color = AvailableFg)
        }
    }
}

private fun initials(name: String?): String {
    val n = name?.trim().orEmpty()
    if (n.isEmpty()) return "?"
    val p = n.split(" ").filter { it.isNotBlank() }
    return if (p.size >= 2) "${p[0].first()}${p[1].first()}".uppercase() else p[0].take(2).uppercase()
}
