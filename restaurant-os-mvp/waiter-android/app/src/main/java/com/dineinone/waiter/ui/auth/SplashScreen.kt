package com.dineinone.waiter.ui.auth

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.sp
import com.dineinone.waiter.ui.components.DineWordmark
import com.dineinone.waiter.ui.theme.LavenderSurface
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(vm: AuthViewModel, onLoggedIn: () -> Unit, onLoggedOut: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(600) // brief brand moment
        val session = vm.getInitialSession()
        if (session?.token?.isNotBlank() == true) onLoggedIn() else onLoggedOut()
    }

    Surface(Modifier.fillMaxSize(), color = LavenderSurface) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            DineWordmark(fontSize = 34.sp)
        }
    }
}
