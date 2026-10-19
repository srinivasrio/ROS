package com.dineinone.waiter.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.BarChart
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.dineinone.waiter.ui.components.clickableNoRipple
import com.dineinone.waiter.ui.theme.*

@Composable
fun ProfileScreen(
    vm: ProfileViewModel,
    onBack: () -> Unit,
    onShiftSummary: () -> Unit,
    onHelp: () -> Unit,
    onLoggedOut: () -> Unit,
) {
    val p by vm.profile.collectAsState()
    val notif by vm.notificationsEnabled.collectAsState()
    val isOnline by vm.isOnline.collectAsState()
    var showLogoutDialog by remember { mutableStateOf(false) }

    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { vm.updateAvatar(it.toString()) }
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Confirm Logout", fontWeight = FontWeight.Bold, color = InkPrimary) },
            text = { Text("Are you sure you want to log out from this session?", color = InkPrimary) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showLogoutDialog = false
                        vm.logout(onLoggedOut)
                    }
                ) {
                    Text("Log Out", color = Coral, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Cancel", color = Muted)
                }
            },
            containerColor = White,
            shape = RoundedCornerShape(16.dp),
        )
    }

    Column(Modifier.fillMaxSize().background(LavenderSoft)) {
        // Top Header
        Row(
            Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = InkPrimary)
            }
            Text(
                "Profile",
                style = MaterialTheme.typography.headlineMedium,
                color = InkPrimary,
                modifier = Modifier.weight(1f)
            )
        }

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Main Waiter Identity Card
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = White,
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    Modifier.padding(20.dp).fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Avatar with online ring & gallery change option
                    Box(
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            Modifier
                                .size(88.dp)
                                .clip(CircleShape)
                                .border(2.5.dp, if (isOnline) AvailableFg else BorderGrey, CircleShape)
                                .background(LavenderChip)
                                .clickableNoRipple { galleryLauncher.launch("image/*") },
                            contentAlignment = Alignment.Center
                        ) {
                            if (!p?.avatarUrl.isNullOrBlank()) {
                                AsyncImage(
                                    model = p!!.avatarUrl,
                                    contentDescription = "Profile Avatar",
                                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                                    contentScale = ContentScale.Crop,
                                )
                            } else {
                                Text(initials(p?.name), fontSize = 28.sp, color = PurpleDeep, fontWeight = FontWeight(800))
                            }
                        }
                        // Camera overlay badge
                        Box(
                            Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(Purple)
                                .align(Alignment.BottomEnd)
                                .clickableNoRipple { galleryLauncher.launch("image/*") },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Filled.CameraAlt, contentDescription = "Change photo", tint = White, modifier = Modifier.size(15.dp))
                        }
                    }

                    Spacer(Modifier.height(8.dp))
                    Text(
                        if (p?.avatarUrl.isNullOrBlank()) "Add Profile Picture" else "Change Profile Picture",
                        color = PurpleDeep,
                        fontWeight = FontWeight(700),
                        fontSize = 12.sp,
                        modifier = Modifier
                            .clip(PillShape)
                            .clickableNoRipple { galleryLauncher.launch("image/*") }
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    )

                    Spacer(Modifier.height(10.dp))
                    Text(
                        p?.name?.ifBlank { "Waiter Staff" } ?: "Waiter Staff",
                        style = MaterialTheme.typography.titleLarge,
                        color = InkPrimary,
                        fontWeight = FontWeight(800)
                    )

                    if (!p?.mobile.isNullOrBlank()) {
                        Spacer(Modifier.height(2.dp))
                        Text(
                            p!!.mobile,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Muted
                        )
                    }

                    Spacer(Modifier.height(12.dp))

                    // Structured Detail Badges
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        DetailBadge((p?.role ?: "waiter").replaceFirstChar { it.uppercase() })
                        if (!p?.employeeId.isNullOrBlank()) {
                            DetailBadge("ID: ${p?.employeeId}")
                        }
                        if (!p?.restaurantName.isNullOrBlank()) {
                            DetailBadge(p!!.restaurantName)
                        }
                    }

                    Spacer(Modifier.height(14.dp))

                    // Quick Shift Status Pill
                    Surface(
                        shape = PillShape,
                        color = if (isOnline) AvailableBg else BorderGrey.copy(alpha = 0.35f),
                        modifier = Modifier.clickableNoRipple { vm.setOnline(!isOnline) }
                    ) {
                        Row(
                            Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(Modifier.size(8.dp).clip(CircleShape).background(if (isOnline) AvailableFg else Muted))
                            Spacer(Modifier.width(8.dp))
                            Text(
                                if (isOnline) "On Shift (Online)" else "Off Shift (Offline)",
                                style = MaterialTheme.typography.labelMedium,
                                color = if (isOnline) AvailableFg else Muted,
                                fontWeight = FontWeight(700)
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Section: Preferences & Work Status
            Text(
                "PREFERENCES",
                style = MaterialTheme.typography.labelSmall,
                color = Muted,
                fontWeight = FontWeight(700),
                modifier = Modifier.padding(start = 6.dp, bottom = 6.dp)
            )
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = White,
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column {
                    ToggleRow(Icons.Filled.Schedule, "Shift Availability", isOnline) { vm.setOnline(it) }
                    Divider2()
                    ToggleRow(Icons.Filled.NotificationsNone, "Order & Call Alerts", notif) { vm.setNotifications(it) }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Section: Shift & Support
            Text(
                "REPORTS & HELP",
                style = MaterialTheme.typography.labelSmall,
                color = Muted,
                fontWeight = FontWeight(700),
                modifier = Modifier.padding(start = 6.dp, bottom = 6.dp)
            )
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = White,
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column {
                    Row2(Icons.Filled.BarChart, "Shift Summary & Sales", onClick = onShiftSummary)
                    Divider2()
                    Row2(Icons.AutoMirrored.Filled.HelpOutline, "Help & Support Desk", onClick = onHelp)
                }
            }

            Spacer(Modifier.height(20.dp))

            // Logout Button
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Coral.copy(alpha = 0.08f),
                border = androidx.compose.foundation.BorderStroke(1.dp, Coral.copy(alpha = 0.25f)),
                modifier = Modifier.fillMaxWidth().clickableNoRipple { showLogoutDialog = true }
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(14.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.AutoMirrored.Filled.Logout, null, tint = Coral, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Log Out", color = Coral, fontWeight = FontWeight(700), style = MaterialTheme.typography.titleSmall)
                }
            }

            Spacer(Modifier.height(16.dp))
            Text(
                "Dine in One Waiter · v1.0.0",
                style = MaterialTheme.typography.labelSmall,
                color = Muted,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun DetailBadge(text: String) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = LavenderSurface,
        border = androidx.compose.foundation.BorderStroke(0.5.dp, BorderGrey)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = InkPrimary,
            fontWeight = FontWeight(600),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun Row2(icon: ImageVector, label: String, value: String? = null, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickableNoRipple(onClick).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(LavenderSurface),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, null, tint = PurpleDeep, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(12.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = InkPrimary, fontWeight = FontWeight(600), modifier = Modifier.weight(1f))
        if (value != null) Text(value, style = MaterialTheme.typography.bodySmall, color = Muted)
        Spacer(Modifier.width(6.dp))
        Icon(Icons.Filled.ChevronRight, null, tint = Muted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun ToggleRow(icon: ImageVector, label: String, checked: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(LavenderSurface),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, null, tint = PurpleDeep, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(12.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = InkPrimary, fontWeight = FontWeight(600), modifier = Modifier.weight(1f))
        Switch(
            checked = checked,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(checkedTrackColor = Purple, checkedThumbColor = White)
        )
    }
}

@Composable
private fun Divider2() = HorizontalDivider(color = BorderGrey, modifier = Modifier.padding(horizontal = 16.dp))

private fun initials(name: String?): String {
    val n = name?.trim().orEmpty()
    if (n.isEmpty()) return "W"
    val p = n.split(" ").filter { it.isNotBlank() }
    return if (p.size >= 2) "${p[0].first()}${p[1].first()}".uppercase() else p[0].take(2).uppercase()
}
