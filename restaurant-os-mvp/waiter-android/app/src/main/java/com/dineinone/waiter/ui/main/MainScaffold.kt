package com.dineinone.waiter.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.RoomService
import androidx.compose.material.icons.outlined.RestaurantMenu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.dineinone.waiter.ui.components.clickableNoRipple
import com.dineinone.waiter.ui.home.HomeScreen
import com.dineinone.waiter.ui.home.HomeViewModel
import com.dineinone.waiter.ui.menu.MenuScreen
import com.dineinone.waiter.ui.menu.MenuViewModel
import com.dineinone.waiter.ui.requests.RequestsScreen
import com.dineinone.waiter.ui.requests.RequestsViewModel
import com.dineinone.waiter.ui.theme.*

private enum class Tab(val label: String, val icon: ImageVector) {
    HOME("Home", Icons.Filled.Home),
    MENU("Menu", Icons.Outlined.RestaurantMenu),
    REQUESTS("Requests", Icons.Filled.RoomService),
}

@Composable
fun MainScaffold(
    requestsVm: RequestsViewModel,
    onLoggedOut: () -> Unit,
    onOpenCart: () -> Unit = {},
    onOpenTable: (String) -> Unit = {},
    onOpenProfile: () -> Unit = {},
    onOpenNotifications: () -> Unit = {},
) {
    var tab by rememberSaveable { mutableStateOf(Tab.HOME) }
    val homeVm: HomeViewModel = hiltViewModel()
    val menuVm: MenuViewModel = hiltViewModel()
    val requestCount by requestsVm.pendingCount.collectAsState()

    Box(Modifier.fillMaxSize().background(AppBg)) {
        androidx.compose.animation.Crossfade(
            targetState = tab,
            animationSpec = androidx.compose.animation.core.tween(durationMillis = 180),
            label = "TabCrossfade",
        ) { currentTab ->
            when (currentTab) {
                Tab.HOME -> HomeScreen(
                    vm = homeVm,
                    onOpenTable = onOpenTable,
                    onOpenProfile = onOpenProfile,
                    onOpenNotifications = onOpenNotifications,
                )
                Tab.MENU -> MenuScreen(
                    vm = menuVm,
                    onOpenItem = { },
                    onOpenCart = onOpenCart,
                )
                Tab.REQUESTS -> RequestsScreen(
                    vm = requestsVm,
                    onOpenProfile = onOpenProfile,
                    onOpenNotifications = onOpenNotifications,
                )
            }
        }
        DineBottomBar(
            selected = tab,
            onSelect = { tab = it },
            requestCount = requestCount,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

@Composable
private fun DineBottomBar(selected: Tab, onSelect: (Tab) -> Unit, requestCount: Int, modifier: Modifier = Modifier) {
    val tabWidth = 84.dp
    val tabHeight = 46.dp
    val spacing = 2.dp
    val targetOffset = (selected.ordinal * 86).dp
    val animatedOffset by androidx.compose.animation.core.animateDpAsState(
        targetValue = targetOffset,
        animationSpec = androidx.compose.animation.core.spring(
            dampingRatio = 0.78f,
            stiffness = androidx.compose.animation.core.Spring.StiffnessMediumLow
        ),
        label = "NavPillTravel"
    )

    // Floating capsule that overlays the content (cards/menu/requests show around it).
    Box(
        modifier.fillMaxWidth().navigationBarsPadding().padding(bottom = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            shape = RoundedCornerShape(999.dp),
            color = LavenderSurface.copy(alpha = 0.72f),
            border = androidx.compose.foundation.BorderStroke(1.dp, White.copy(alpha = 0.65f)),
            shadowElevation = 8.dp,
            tonalElevation = 0.dp
        ) {
            Box(
                Modifier.padding(horizontal = 4.dp, vertical = 4.dp)
            ) {
                // Smooth travel background pill
                Box(
                    Modifier
                        .offset(x = animatedOffset)
                        .width(tabWidth)
                        .height(tabHeight)
                        .clip(RoundedCornerShape(999.dp))
                        .background(LavenderChip)
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(spacing),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Tab.entries.forEach { t ->
                        BottomItem(
                            tab = t,
                            active = t == selected,
                            badge = if (t == Tab.REQUESTS && requestCount > 0) requestCount else null,
                            onClick = { onSelect(t) },
                            modifier = Modifier.width(tabWidth).height(tabHeight),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BottomItem(tab: Tab, active: Boolean, badge: Int?, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val fg = if (active) PurpleDeep else InkPrimary
    Column(
        modifier
            .clip(RoundedCornerShape(999.dp))
            .clickableNoRipple(onClick)
            .padding(horizontal = 2.dp, vertical = 3.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        BadgedBox(badge = { if (badge != null) Badge(containerColor = Coral) { Text("$badge") } }) {
            Icon(tab.icon, contentDescription = tab.label, tint = fg, modifier = Modifier.size(19.dp))
        }
        Spacer(Modifier.height(1.dp))
        Text(
            tab.label,
            style = MaterialTheme.typography.labelSmall,
            color = fg,
            fontWeight = FontWeight(if (active) 700 else 500),
            maxLines = 1
        )
    }
}
