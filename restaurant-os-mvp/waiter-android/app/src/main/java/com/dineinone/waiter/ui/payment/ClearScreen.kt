package com.dineinone.waiter.ui.payment

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.dineinone.waiter.ui.components.PrimaryButton
import com.dineinone.waiter.ui.components.SecondaryButton
import com.dineinone.waiter.ui.components.SlideToConfirmButton
import com.dineinone.waiter.ui.components.clickableNoRipple
import com.dineinone.waiter.ui.theme.*

private val checklist = listOf(
    "Collect plates and used items",
    "Clean the tabletop",
    "Reset cutlery and table settings",
    "Confirm the table is ready",
)

@Composable
fun ClearScreen(vm: ClearViewModel, onBack: () -> Unit, onCleared: () -> Unit) {
    val ui by vm.ui.collectAsState()
    val checked = remember { mutableStateListOf(false, false, false, false) }
    val doneCount = checked.count { it }
    val allDone = doneCount == checklist.size
    val tableNumber = ui.table?.number ?: ""

    LaunchedEffect(ui.cleared) { if (ui.cleared) onCleared() }

    Column(Modifier.fillMaxSize().background(LavenderSoft)) {
        // App bar
        Row(
            Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = InkPrimary)
            }
            Column {
                Text("Clear Table T$tableNumber", style = MaterialTheme.typography.headlineMedium, color = InkPrimary)
                Text("Finish the session and reset the table", style = MaterialTheme.typography.bodySmall, color = Muted)
            }
        }

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            // Summary Card
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = White,
                border = BorderStroke(1.dp, BorderGrey),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text("Payment", style = MaterialTheme.typography.labelSmall, color = Muted)
                            Spacer(Modifier.height(4.dp))
                            Surface(shape = PillShape, color = if (ui.order?.isPaid == true) AvailableBg else PeachSurface) {
                                Text(
                                    if (ui.order?.isPaid == true) "Paid" else "Unpaid",
                                    color = if (ui.order?.isPaid == true) AvailableFg else OccupiedFg,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight(700),
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                )
                            }
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Amount paid", style = MaterialTheme.typography.labelSmall, color = Muted)
                            Spacer(Modifier.height(2.dp))
                            Text(
                                "₹${fmt(ui.order?.amountPaid ?: ui.order?.totalAmount ?: 0.0)}",
                                style = MaterialTheme.typography.titleMedium,
                                color = InkPrimary,
                                fontWeight = FontWeight(800),
                            )
                        }
                    }

                    Spacer(Modifier.height(12.dp))
                    HorizontalDivider(color = BorderGrey)
                    Spacer(Modifier.height(10.dp))

                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("Dining duration", style = MaterialTheme.typography.bodySmall, color = Muted)
                        Text("45 min", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight(600), color = InkPrimary)
                    }
                }
            }

            Spacer(Modifier.height(18.dp))

            // Clearing checklist header
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Clearing checklist", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight(700), color = InkPrimary)
                Text("$doneCount of ${checklist.size} done", style = MaterialTheme.typography.bodyMedium, color = Muted)
            }
            Spacer(Modifier.height(8.dp))
            LinearProgressIndicator(
                progress = { doneCount / checklist.size.toFloat() },
                modifier = Modifier.fillMaxWidth().height(6.dp),
                color = Purple,
                trackColor = LavenderSurface,
            )
            Spacer(Modifier.height(14.dp))

            // Checklist items
            checklist.forEachIndexed { i, label ->
                val isDone = checked[i]
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = White,
                    border = BorderStroke(1.2.dp, if (isDone) Purple else BorderGrey),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 3.dp)
                        .clickableNoRipple { checked[i] = !checked[i] },
                ) {
                    Row(
                        Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(
                            checked = isDone,
                            onCheckedChange = { checked[i] = it },
                            colors = CheckboxDefaults.colors(checkedColor = Purple),
                            modifier = Modifier.size(28.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            label,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = if (isDone) FontWeight(600) else FontWeight.Normal,
                            color = InkPrimary,
                        )
                    }
                }
            }

            if (ui.error != null) {
                Spacer(Modifier.height(8.dp))
                Text(ui.error!!, color = ErrorRed, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(20.dp))

            SlideToConfirmButton(
                text = if (allDone) "Slide to confirm table ready" else "Complete the checklist to confirm",
                onConfirm = vm::confirm,
                enabled = allDone,
                submitting = ui.submitting,
            )

            Spacer(Modifier.height(10.dp))

            // Cancel button
            OutlinedButton(
                onClick = onBack,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.5.dp, ErrorRed),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = ErrorRed,
                    containerColor = ErrorRed.copy(alpha = 0.08f),
                ),
            ) {
                Text("Cancel", fontWeight = FontWeight(700), color = ErrorRed)
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

private fun fmt(v: Double): String = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)
