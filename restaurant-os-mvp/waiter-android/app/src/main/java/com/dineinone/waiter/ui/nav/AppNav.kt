package com.dineinone.waiter.ui.nav

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.dineinone.waiter.ui.auth.AuthViewModel
import com.dineinone.waiter.ui.auth.LoginScreen
import com.dineinone.waiter.ui.auth.SplashScreen
import com.dineinone.waiter.ui.cart.CartScreen
import com.dineinone.waiter.ui.cart.CartViewModel
import com.dineinone.waiter.ui.main.MainScaffold
import com.dineinone.waiter.ui.menu.MenuScreen
import com.dineinone.waiter.ui.menu.MenuViewModel
import com.dineinone.waiter.ui.payment.ClearScreen
import com.dineinone.waiter.ui.payment.ClearViewModel
import com.dineinone.waiter.ui.access.TableAccessScreen
import com.dineinone.waiter.ui.access.TableAccessViewModel
import com.dineinone.waiter.ui.notifications.NotificationsScreen
import com.dineinone.waiter.ui.notifications.NotificationsViewModel
import com.dineinone.waiter.ui.payment.PaymentScreen
import com.dineinone.waiter.ui.payment.PaymentViewModel
import com.dineinone.waiter.ui.profile.HelpScreen
import com.dineinone.waiter.ui.profile.ProfileScreen
import com.dineinone.waiter.ui.profile.ProfileViewModel
import com.dineinone.waiter.ui.profile.ShiftSummaryScreen
import com.dineinone.waiter.ui.profile.ShiftViewModel
import com.dineinone.waiter.ui.tabledetail.TableDetailScreen
import com.dineinone.waiter.ui.tabledetail.TableDetailViewModel

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.dineinone.waiter.ui.requests.RequestsViewModel
import com.dineinone.waiter.ui.components.DishReadyAlertSheet
import com.dineinone.waiter.ui.components.IncomingRequestAlertSheet
import com.dineinone.waiter.ui.components.ReadyDishEvent
import com.dineinone.waiter.ui.components.CustomerServiceAlertEvent
import com.dineinone.waiter.core.AudioService

object Routes {
    const val SPLASH = "splash"
    const val WELCOME = "welcome"
    const val LOGIN = "login"
    const val MAIN = "main"
    const val CART = "cart"
    const val MENU = "menu"
    const val TABLE = "table/{tableId}"
    const val PROFILE = "profile"
    const val SHIFT = "shift"
    const val HELP = "help"
    const val NOTIFICATIONS = "notifications"
    const val PAYMENT = "payment/{tableId}"
    const val CLEAR = "clear/{tableId}"
    const val ACCESS = "access/{tableId}"
    const val ORDER_CONFIRMED = "order_confirmed/{tableId}/{orderId}/{total}/{count}"
    fun table(id: String) = "table/$id"
    fun payment(id: String) = "payment/$id"
    fun clear(id: String) = "clear/$id"
    fun access(id: String) = "access/$id"
    fun orderConfirmed(tableId: String, orderId: String, total: Double, count: Int) =
        "order_confirmed/$tableId/$orderId/$total/$count"
}

@Composable
fun AppNav(nav: NavHostController = rememberNavController()) {
    val requestsVm: RequestsViewModel = hiltViewModel()
    val context = androidx.compose.ui.platform.LocalContext.current
    var readyAlertEvent by remember { mutableStateOf<ReadyDishEvent?>(null) }
    var serviceAlertEvent by remember { mutableStateOf<CustomerServiceAlertEvent?>(null) }

    LaunchedEffect(Unit) {
        requestsVm.readyEvents.collect { event ->
            readyAlertEvent = event
            AudioService.playAlert(context)
        }
    }

    LaunchedEffect(Unit) {
        requestsVm.serviceEvents.collect { event ->
            serviceAlertEvent = event
            AudioService.playAlert(context)
        }
    }

    Box(Modifier.fillMaxSize()) {
        NavHost(navController = nav, startDestination = Routes.SPLASH) {
        composable(Routes.SPLASH) {
            val vm: AuthViewModel = hiltViewModel()
            SplashScreen(
                vm = vm,
                onLoggedIn = { nav.navigateClearing(Routes.MAIN) },
                onLoggedOut = { nav.navigateClearing(Routes.WELCOME) },
            )
        }
        composable(Routes.WELCOME) {
            com.dineinone.waiter.ui.auth.WelcomeScreen(
                onGetStarted = { nav.navigate(Routes.LOGIN) },
            )
        }
        composable(Routes.LOGIN) {
            val vm: AuthViewModel = hiltViewModel()
            LoginScreen(vm = vm, onSuccess = { nav.navigateClearing(Routes.MAIN) })
        }
        composable(Routes.MAIN) {
            MainScaffold(
                requestsVm = requestsVm,
                onLoggedOut = { nav.navigateClearing(Routes.WELCOME) },
                onOpenCart = { nav.navigate(Routes.CART) },
                onOpenTable = { id -> nav.navigate(Routes.table(id)) },
                onOpenProfile = { nav.navigate(Routes.PROFILE) },
                onOpenNotifications = { nav.navigate(Routes.NOTIFICATIONS) },
            )
        }
        composable(Routes.NOTIFICATIONS) {
            val vm: NotificationsViewModel = hiltViewModel()
            NotificationsScreen(vm = vm, onBack = { nav.popBackStack() })
        }
        composable(Routes.PROFILE) {
            val vm: ProfileViewModel = hiltViewModel()
            ProfileScreen(
                vm = vm,
                onBack = { nav.popBackStack() },
                onShiftSummary = { nav.navigate(Routes.SHIFT) },
                onHelp = { nav.navigate(Routes.HELP) },
                onLoggedOut = { nav.navigateClearing(Routes.WELCOME) },
            )
        }
        composable(Routes.SHIFT) {
            val vm: ShiftViewModel = hiltViewModel()
            ShiftSummaryScreen(vm = vm, onBack = { nav.popBackStack() })
        }
        composable(Routes.HELP) {
            HelpScreen(onBack = { nav.popBackStack() }, onContact = { })
        }
        composable(
            Routes.PAYMENT,
            arguments = listOf(navArgument("tableId") { type = NavType.StringType }),
        ) {
            val vm: PaymentViewModel = hiltViewModel()
            PaymentScreen(
                vm = vm,
                onBack = { nav.popBackStack() },
                onPaid = { id -> nav.navigate(Routes.clear(id)) { popUpTo(Routes.PAYMENT) { inclusive = true } } },
            )
        }
        composable(
            Routes.CLEAR,
            arguments = listOf(navArgument("tableId") { type = NavType.StringType }),
        ) {
            val vm: ClearViewModel = hiltViewModel()
            ClearScreen(
                vm = vm,
                onBack = { nav.popBackStack() },
                onCleared = { nav.popBackStack(Routes.MAIN, inclusive = false) },
            )
        }
        composable(
            Routes.ACCESS,
            arguments = listOf(navArgument("tableId") { type = NavType.StringType }),
        ) {
            val vm: TableAccessViewModel = hiltViewModel()
            TableAccessScreen(vm = vm, onBack = { nav.popBackStack() })
        }
        composable(
            Routes.TABLE,
            arguments = listOf(navArgument("tableId") { type = NavType.StringType }),
        ) {
            val vm: TableDetailViewModel = hiltViewModel()
            TableDetailScreen(
                vm = vm,
                onBack = { nav.popBackStack() },
                onAddItems = { vm.bindForOrdering(); nav.navigate(Routes.MENU) },
                onViewBill = { id -> nav.navigate(Routes.payment(id)) },
                onTableAccess = { id -> nav.navigate(Routes.access(id)) },
                onClearTable = { id -> nav.navigate(Routes.clear(id)) },
            )
        }
        composable(Routes.MENU) {
            val vm: MenuViewModel = hiltViewModel()
            MenuScreen(
                vm = vm,
                onOpenItem = { },
                onOpenCart = { nav.navigate(Routes.CART) },
            )
        }
        composable(Routes.CART) {
            val vm: CartViewModel = hiltViewModel()
            CartScreen(
                vm = vm,
                onBack = { nav.popBackStack() },
                onAddMore = { nav.popBackStack() },
                onPlaced = { info ->
                    nav.navigate(Routes.orderConfirmed(info.tableId, info.orderId, info.totalAmount, info.itemCount)) {
                        popUpTo(Routes.CART) { inclusive = true }
                    }
                },
            )
        }
        composable(
            Routes.ORDER_CONFIRMED,
            arguments = listOf(
                navArgument("tableId") { type = NavType.StringType },
                navArgument("orderId") { type = NavType.StringType },
                navArgument("total") { type = NavType.StringType },
                navArgument("count") { type = NavType.IntType },
            ),
        ) { entry ->
            val tableId = entry.arguments?.getString("tableId").orEmpty()
            val orderId = entry.arguments?.getString("orderId").orEmpty()
            val total = entry.arguments?.getString("total")?.toDoubleOrNull() ?: 0.0
            val count = entry.arguments?.getInt("count") ?: 1
            com.dineinone.waiter.ui.cart.OrderConfirmedScreen(
                tableId = tableId,
                tableLabel = "T$tableId",
                orderId = orderId,
                totalAmount = total,
                itemCount = count,
                onViewTable = { id ->
                    nav.navigate(Routes.table(id)) {
                        popUpTo(Routes.MAIN)
                    }
                },
                onBackHome = {
                    nav.navigate(Routes.MAIN) {
                        popUpTo(Routes.MAIN) { inclusive = true }
                    }
                },
            )
        }
    }

    readyAlertEvent?.let { ev ->
            DishReadyAlertSheet(
                event = ev,
                onPickUp = {
                    val tableId = ev.tableId
                    val reqId = ev.requestId
                    readyAlertEvent = null
                    if (!reqId.isNullOrBlank()) {
                        requestsVm.accept(reqId)
                    }
                    if (tableId.isNotBlank()) {
                        nav.navigate(Routes.table(tableId))
                    }
                },
                onDismiss = {
                    readyAlertEvent = null
                }
            )
        }

        serviceAlertEvent?.let { ev ->
            IncomingRequestAlertSheet(
                event = ev,
                onAccept = {
                    val reqId = ev.id
                    val isAccess = ev.isTableAccess
                    serviceAlertEvent = null
                    if (isAccess) {
                        requestsVm.approveAccess(reqId)
                    } else {
                        requestsVm.accept(reqId)
                    }
                },
                onDecline = {
                    val reqId = ev.id
                    serviceAlertEvent = null
                    requestsVm.declineAccess(reqId)
                },
                onDismiss = {
                    serviceAlertEvent = null
                }
            )
        }
    }
}

private fun NavHostController.navigateClearing(route: String) {
    navigate(route) {
        popUpTo(0) { inclusive = true }
        launchSingleTop = true
    }
}
