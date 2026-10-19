package com.dineinone.waiter.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.animation.core.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dineinone.waiter.data.remote.dto.TableDto
import com.dineinone.waiter.ui.components.*
import com.dineinone.waiter.ui.home.HomeUiState.Companion.norm
import com.dineinone.waiter.ui.theme.*

import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.material.icons.filled.Check

@Composable
fun HomeScreen(vm: HomeViewModel, onOpenTable: (String) -> Unit, onOpenProfile: () -> Unit, onOpenNotifications: () -> Unit) {
    val ui by vm.ui.collectAsState()
    val session by vm.session.collectAsState()
    val userId = session?.userId.orEmpty()

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            HomeHeader(
                restaurant = session?.restaurantName?.ifBlank { "Dine in One" } ?: "Dine in One",
                subtitle = null,
                initials = initials(session?.name),
                logoUrl = session?.logoUrl,
                avatarUrl = session?.avatarUrl,
                unreadCount = ui.unreadNotificationsCount,
                isBellAnimating = ui.isBellAnimating,
                onAvatar = onOpenProfile,
                onBell = {
                    vm.onBellOpened()
                    onOpenNotifications()
                },
            )

            when {
                ui.loading -> LoadingTables()
                ui.error != null -> ErrorState(ui.error!!) { vm.load() }
                else -> TablesContent(
                    ui = ui,
                    userId = userId,
                    restaurantName = session?.restaurantName ?: "Nellore Main",
                    onOpenTable = onOpenTable,
                    onToggleSelectTable = vm::toggleSelectTable,
                    onRefresh = { vm.load(refresh = true) },
                    onFilter = vm::setFilter,
                    onToggleStatus = vm::toggleStatusFilter,
                    onOpenAreas = vm::openAreaSheet,
                )
            }
        }

        // Floating Merge Action Bar
        if (ui.isSelectionMode) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = InkPrimary,
                shadowElevation = 14.dp,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(bottom = 78.dp, start = 16.dp, end = 16.dp)
                    .fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${ui.selectedTableIds.size} table${if (ui.selectedTableIds.size > 1) "s" else ""} selected",
                        color = White,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight(700),
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        TextButton(onClick = vm::clearSelection) {
                            Text("Cancel", color = Color(0xFFD1D5DB), fontWeight = FontWeight(600))
                        }
                        Button(
                            onClick = vm::mergeSelectedTables,
                            enabled = ui.selectedTableIds.size >= 2,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Purple,
                                disabledContainerColor = Muted.copy(alpha = 0.5f),
                            ),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Text(
                                "Merge Tables",
                                color = White,
                                fontWeight = FontWeight(800),
                            )
                        }
                    }
                }
            }
        }
    }

    if (ui.showAreaSheet) {
        AreasBottomSheet(
            ui = ui,
            onSelect = vm::selectArea,
            onDismiss = vm::dismissAreaSheet,
        )
    }
}

@Composable
private fun HomeHeader(
    restaurant: String,
    subtitle: String? = null,
    initials: String,
    logoUrl: String?,
    avatarUrl: String?,
    unreadCount: Int = 0,
    isBellAnimating: Boolean = false,
    onAvatar: () -> Unit,
    onBell: () -> Unit,
) {
    val infiniteTransition = rememberInfiniteTransition(label = "BellShake")
    val bellAngle by if (isBellAnimating) {
        infiniteTransition.animateFloat(
            initialValue = -16f,
            targetValue = 16f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 180, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "BellAngle"
        )
    } else {
        remember { mutableFloatStateOf(0f) }
    }

    Row(
        Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (!logoUrl.isNullOrBlank()) {
                AsyncImage(model = logoUrl, contentDescription = "Logo", modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            } else {
                Text("🍃", fontSize = 18.sp)
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                restaurant,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                fontSize = 19.sp,
                color = InkPrimary,
                maxLines = 1
            )
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Muted, maxLines = 1)
            }
        }
        IconButton(onClick = onBell) {
            BadgedBox(
                badge = {
                    if (unreadCount > 0) {
                        Badge(containerColor = Coral) {
                            Text("$unreadCount", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            ) {
                Icon(
                    Icons.Filled.NotificationsNone,
                    "Notifications",
                    tint = if (isBellAnimating) PurpleDeep else InkPrimary,
                    modifier = Modifier.graphicsLayer { rotationZ = bellAngle }
                )
            }
        }
        Spacer(Modifier.width(4.dp))
        Box(
            Modifier.size(38.dp).clip(CircleShape).background(LavenderChip).clickableNoRipple(onAvatar),
            contentAlignment = Alignment.Center,
        ) {
            if (!avatarUrl.isNullOrBlank()) {
                AsyncImage(model = avatarUrl, contentDescription = "Avatar", modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop)
            } else {
                Text(initials, style = MaterialTheme.typography.labelLarge, color = PurpleDeep)
            }
        }
    }
}

@Composable
private fun TablesContent(
    ui: HomeUiState,
    userId: String,
    restaurantName: String,
    onOpenTable: (String) -> Unit,
    onToggleSelectTable: (String) -> Unit,
    onRefresh: () -> Unit,
    onFilter: (TableFilter) -> Unit,
    onToggleStatus: (String) -> Unit,
    onOpenAreas: () -> Unit,
) {
    val tables = ui.visible(userId)
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 120.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Home", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = InkPrimary, modifier = Modifier.weight(1f))
                    GradientPillButton(
                        text = ui.selectedAreaName ?: "Areas",
                        onClick = onOpenAreas,
                    )
                }
                Spacer(Modifier.height(14.dp))
                SegmentedFilter(ui.filter, ui.currentTables.size, ui.mineCount(userId), onFilter)
                Spacer(Modifier.height(14.dp))
                StatRow(ui.available, ui.occupied, ui.reserved, ui.statusFilter, onToggleStatus)
                Spacer(Modifier.height(8.dp))
            }
        }
        if (tables.isEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                EmptyState(if (ui.filter == TableFilter.MINE) "No tables assigned to you in this area." else "No tables found in this area.")
            }
        } else {
            items(tables, key = { it.id }) { t ->
                TableCard(
                    t = t,
                    isSelected = ui.selectedTableIds.contains(t.id),
                    isSelectionMode = ui.isSelectionMode,
                    onOpen = onOpenTable,
                    onToggleSelect = onToggleSelectTable,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AreasBottomSheet(
    ui: HomeUiState,
    onSelect: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = White) {
        Column(
            Modifier
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp)
        ) {
            Text("Select Area", style = MaterialTheme.typography.headlineSmall, color = InkPrimary, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text("Filter floor tables by restaurant section", style = MaterialTheme.typography.bodyMedium, color = Muted)
            Spacer(Modifier.height(16.dp))

            // "All Areas" option
            val allSelected = ui.selectedAreaId == null
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = if (allSelected) LavenderChip else LavenderSurface,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickableNoRipple { onSelect(null) },
            ) {
                Row(
                    Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "All Areas",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = if (allSelected) FontWeight.Bold else FontWeight.SemiBold,
                        color = if (allSelected) PurpleDeep else InkPrimary,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "${ui.tables.size} tables",
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (allSelected) PurpleDeep else Muted,
                    )
                }
            }

            Spacer(Modifier.height(10.dp))

            // Each area
            ui.areas.forEach { area ->
                val isSelected = ui.selectedAreaId == area.id
                val countInArea = ui.tables.count {
                    it.areaId == area.id || (area.name != null && it.areaName.equals(area.name, ignoreCase = true))
                }
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = if (isSelected) LavenderChip else LavenderSurface,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clickableNoRipple { onSelect(area.id) },
                ) {
                    Row(
                        Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            area.name ?: "Area",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                            color = if (isSelected) PurpleDeep else InkPrimary,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            "$countInArea table${if (countInArea == 1) "" else "s"}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (isSelected) PurpleDeep else Muted,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SegmentedFilter(filter: TableFilter, allCount: Int, mineCount: Int, onFilter: (TableFilter) -> Unit) {
    Surface(
        shape = PillShape,
        color = LavenderSurface.copy(alpha = 0.72f),
        border = androidx.compose.foundation.BorderStroke(1.dp, White.copy(alpha = 0.65f)),
        shadowElevation = 4.dp,
        tonalElevation = 0.dp,
        modifier = Modifier.fillMaxWidth().height(44.dp),
    ) {
        BoxWithConstraints(Modifier.fillMaxSize().padding(horizontal = 4.dp, vertical = 4.dp)) {
            val pillWidth = maxWidth / 2
            val targetOffset = if (filter == TableFilter.ALL) 0.dp else pillWidth
            val animatedOffset by androidx.compose.animation.core.animateDpAsState(
                targetValue = targetOffset,
                animationSpec = androidx.compose.animation.core.spring(
                    dampingRatio = 0.78f,
                    stiffness = androidx.compose.animation.core.Spring.StiffnessMediumLow
                ),
                label = "HomeTablePillTravel"
            )

            // Animated sliding capsule button layout around active button only
            Box(
                Modifier
                    .offset(x = animatedOffset)
                    .width(pillWidth)
                    .fillMaxHeight()
                    .clip(PillShape)
                    .background(LavenderChip)
            )

            Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                SegItem("All Tables · $allCount", filter == TableFilter.ALL, Modifier.weight(1f).fillMaxHeight()) { onFilter(TableFilter.ALL) }
                SegItem("My Tables · $mineCount", filter == TableFilter.MINE, Modifier.weight(1f).fillMaxHeight()) { onFilter(TableFilter.MINE) }
            }
        }
    }
}

@Composable
private fun SegItem(text: String, active: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .clip(PillShape)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = MaterialTheme.typography.titleSmall, color = if (active) PurpleDeep else Muted, fontWeight = FontWeight(if (active) 800 else 600))
    }
}

@Composable
private fun StatRow(
    available: Int,
    occupied: Int,
    reserved: Int,
    activeStatus: String?,
    onToggle: (String) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        StatChip("Available", available, AvailableBg, AvailableFg, activeStatus == "available", Modifier.weight(1f)) { onToggle("available") }
        StatChip("Occupied", occupied, OccupiedBg, OccupiedFg, activeStatus == "occupied", Modifier.weight(1f)) { onToggle("occupied") }
        StatChip("Reserved", reserved, ReservedBg, ReservedFg, activeStatus == "reserved", Modifier.weight(1f)) { onToggle("reserved") }
    }
}

@Composable
private fun StatChip(label: String, count: Int, bg: Color, fg: Color, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(bg)
            .border(if (selected) 2.dp else 0.dp, if (selected) fg else Color.Transparent, RoundedCornerShape(14.dp))
            .clickableNoRipple(onClick)
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("$count", fontSize = 18.sp, fontWeight = FontWeight(800), color = fg)
        Text(label, style = MaterialTheme.typography.labelSmall, fontSize = 11.sp, color = fg)
    }
}

@Composable
private fun TableCard(
    t: TableDto,
    isSelected: Boolean,
    isSelectionMode: Boolean,
    onOpen: (String) -> Unit,
    onToggleSelect: (String) -> Unit,
) {
    val status = norm(t.status)
    val (chipBg, chipFg) = statusColors(status)
    val cardBg = chipBg
    Column(
        Modifier
            .fillMaxWidth()
            .height(176.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(cardBg)
            .border(
                width = if (isSelected) 2.5.dp else 1.2.dp,
                color = if (isSelected) Purple else chipFg.copy(alpha = 0.25f),
                shape = RoundedCornerShape(18.dp)
            )
            .pointerInput(isSelectionMode, isSelected) {
                detectTapGestures(
                    onTap = {
                        if (isSelectionMode) onToggleSelect(t.id) else onOpen(t.id)
                    },
                    onLongPress = {
                        onToggleSelect(t.id)
                    }
                )
            }
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                t.displayName ?: "T${t.number}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = InkPrimary,
                modifier = Modifier.weight(1f),
                maxLines = 1,
            )
            if (isSelectionMode) {
                Box(
                    modifier = Modifier
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(if (isSelected) Purple else White)
                        .border(1.5.dp, if (isSelected) Purple else BorderGrey, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    if (isSelected) {
                        Icon(Icons.Filled.Check, contentDescription = null, tint = White, modifier = Modifier.size(14.dp))
                    }
                }
            } else if ((t.capacity ?: 0) > 0) {
                Icon(Icons.Filled.People, null, tint = Muted, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(2.dp))
                Text("${t.capacity}", style = MaterialTheme.typography.labelSmall, color = Muted)
            } else if (!t.assignedWaiterName.isNullOrBlank()) {
                AvatarMini(initials(t.assignedWaiterName))
            }
        }
        Spacer(Modifier.height(6.dp))
        StatusPill(statusLabel(status), chipBg, chipFg)
        val tags = subTags(t)
        Spacer(Modifier.height(4.dp))
        Box(Modifier.height(18.dp)) {
            if (tags.isNotEmpty()) {
                Text("• ${tags.first()}", style = MaterialTheme.typography.bodySmall, fontSize = 11.sp, color = Muted, maxLines = 1)
            }
        }
        Spacer(Modifier.weight(1f))
        val cta = ctaFor(status)
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = if (isSelectionMode && isSelected) LavenderChip else (if (status == "available") White else LavenderChip),
            border = if (!isSelectionMode && status == "available") androidx.compose.foundation.BorderStroke(1.dp, BorderGrey) else null,
            modifier = Modifier
                .fillMaxWidth()
                .height(36.dp)
                .pointerInput(isSelectionMode, isSelected) {
                    detectTapGestures(
                        onTap = {
                            if (isSelectionMode) onToggleSelect(t.id) else onOpen(t.id)
                        },
                        onLongPress = {
                            onToggleSelect(t.id)
                        }
                    )
                },
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    if (isSelectionMode) (if (isSelected) "Selected ✓" else "Select") else cta,
                    color = if (isSelectionMode) (if (isSelected) PurpleDeep else InkPrimary) else (if (status == "available") InkPrimary else PurpleDeep),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight(700),
                    fontSize = 13.sp,
                )
            }
        }
    }
}

@Composable
private fun StatusPill(text: String, bg: Color, fg: Color) {
    Surface(shape = PillShape, color = bg) {
        Text(text, color = fg, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
    }
}

@Composable
private fun AvatarMini(initials: String) {
    Box(Modifier.size(22.dp).clip(CircleShape).background(LavenderChip), contentAlignment = Alignment.Center) {
        Text(initials, fontSize = 10.sp, color = PurpleDeep, fontWeight = FontWeight(700))
    }
}

@Composable
private fun LoadingTables() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Purple)
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(message, style = MaterialTheme.typography.bodyMedium, color = Muted)
        Spacer(Modifier.height(16.dp))
        SecondaryButton("Retry", onRetry)
    }
}

@Composable
private fun EmptyState(message: String) {
    Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
        Text(message, style = MaterialTheme.typography.bodyMedium, color = Muted)
    }
}

// ── status helpers ──
private fun statusColors(status: String): Pair<Color, Color> = when (status) {
    "available" -> AvailableBg to AvailableFg
    "occupied" -> OccupiedBg to OccupiedFg
    "reserved" -> ReservedBg to ReservedFg
    "clearing" -> PeachSurface to OccupiedFg
    "on_hold" -> LavenderChip to PurpleDeep
    else -> BorderGrey to Muted
}

private fun statusLabel(status: String): String = when (status) {
    "available" -> "Available"
    "occupied" -> "Occupied"
    "reserved" -> "Reserved"
    "clearing" -> "Awaiting clearing"
    "on_hold" -> "On hold"
    else -> status.replaceFirstChar { it.uppercase() }
}

private fun ctaFor(status: String): String = when (status) {
    "available" -> "Seat Guests"
    "reserved" -> "View Reservation"
    "clearing" -> "Clear Table"
    else -> "View Table"
}

private fun subTags(t: TableDto): List<String> {
    val tags = mutableListOf<String>()
    if ((t.activeItemCount ?: 0) > 0) tags.add("${t.activeItemCount} item${if (t.activeItemCount == 1) "" else "s"}")
    if (!t.alertStatus.isNullOrBlank() && t.alertStatus != "none") tags.add(t.alertStatus!!.replace('_', ' '))
    if (!t.coWaiterNames.isNullOrBlank()) tags.add("Shared")
    return tags
}

private fun initials(name: String?): String {
    val n = name?.trim().orEmpty()
    if (n.isEmpty()) return "W"
    val parts = n.split(" ").filter { it.isNotBlank() }
    return when {
        parts.size >= 2 -> "${parts[0].first()}${parts[1].first()}".uppercase()
        else -> parts[0].take(2).uppercase()
    }
}
