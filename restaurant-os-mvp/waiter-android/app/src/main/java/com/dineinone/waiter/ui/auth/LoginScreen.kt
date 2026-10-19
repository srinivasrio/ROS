package com.dineinone.waiter.ui.auth

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import com.dineinone.waiter.BuildConfig
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dineinone.waiter.ui.components.*
import com.dineinone.waiter.ui.theme.*

@Composable
fun LoginScreen(vm: AuthViewModel, onSuccess: () -> Unit) {
    val ui by vm.ui.collectAsState()

    LaunchedEffect(ui.success) { if (ui.success) onSuccess() }

    Surface(Modifier.fillMaxSize(), color = LavenderSoft) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(top = 48.dp, bottom = 24.dp),
        ) {
            // ponytail: wordmark doubles as a DEBUG-only long-press dev-login (stripped from release).
            Box(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .then(if (BuildConfig.DEBUG) Modifier.devLongPress { vm.devSeed() } else Modifier),
                contentAlignment = androidx.compose.ui.Alignment.CenterStart,
            ) { DineWordmark(fontSize = 22.sp) }
            Spacer(Modifier.height(28.dp))
            Text("Welcome Back", style = MaterialTheme.typography.headlineLarge, color = InkPrimary)
            Text("Sign in", style = MaterialTheme.typography.bodyMedium, color = Muted)
            Spacer(Modifier.height(20.dp))
            Text(buildRequiredHint(), style = MaterialTheme.typography.labelSmall, color = Muted)
            Spacer(Modifier.height(12.dp))

            LabeledField(
                label = "Mobile Number",
                value = ui.mobile,
                onValueChange = vm::onMobile,
                placeholder = "98765 43210",
                prefix = "+91 ",
                leading = { Icon(Icons.Outlined.PhoneAndroid, null, tint = Muted) },
                keyboardType = KeyboardType.Phone,
                required = true,
            )
            Spacer(Modifier.height(16.dp))

            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Text("Security PIN", style = MaterialTheme.typography.labelMedium, color = InkPrimary)
                Text(" *", color = Coral, style = MaterialTheme.typography.labelMedium)
            }
            Spacer(Modifier.height(8.dp))
            PinBoxes(value = ui.pin, onValueChange = vm::onPin, length = 4)

            if (ui.error != null) {
                Spacer(Modifier.height(16.dp))
                ErrorBanner(ui.error!!)
            }

            Spacer(Modifier.height(24.dp))
            PrimaryButton(text = "Login", onClick = vm::login, loading = ui.loading, enabled = ui.mobile.length == 10 && ui.pin.length >= 4)

            Spacer(Modifier.height(16.dp))
            Text(
                "Forgot PIN?",
                style = MaterialTheme.typography.labelLarge,
                color = InkPrimary,
                textAlign = TextAlign.Center,
                textDecoration = TextDecoration.Underline,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun buildRequiredHint() = "All fields are required *"

@OptIn(ExperimentalFoundationApi::class)
private fun Modifier.devLongPress(onLongPress: () -> Unit): Modifier = composed {
    combinedClickable(
        interactionSource = remember { MutableInteractionSource() },
        indication = null,
        onClick = {},
        onLongClick = onLongPress,
    )
}
