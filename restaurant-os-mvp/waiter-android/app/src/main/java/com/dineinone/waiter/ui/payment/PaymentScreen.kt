package com.dineinone.waiter.ui.payment

import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dineinone.waiter.data.remote.dto.OrderItemDto
import com.dineinone.waiter.ui.components.InkButton
import com.dineinone.waiter.ui.components.PrimaryButton
import com.dineinone.waiter.ui.components.SecondaryButton
import com.dineinone.waiter.ui.components.SlideToConfirmButton
import com.dineinone.waiter.ui.components.clickableNoRipple
import com.dineinone.waiter.ui.theme.*
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import kotlin.math.ceil

@Composable
fun PaymentScreen(vm: PaymentViewModel, onBack: () -> Unit, onPaid: (String) -> Unit) {
    val ui by vm.ui.collectAsState()
    val isPaid = ui.paid || ui.order?.isPaid == true

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
            Column(Modifier.weight(1f)) {
                Text("Payment & Bill", style = MaterialTheme.typography.headlineMedium, color = InkPrimary)
                Text("Table T${ui.table?.number ?: ""}", style = MaterialTheme.typography.bodySmall, color = Muted)
            }
            Surface(shape = PillShape, color = if (isPaid) AvailableBg else PeachSurface) {
                Text(
                    if (isPaid) "Paid" else "Unpaid",
                    color = if (isPaid) AvailableFg else OccupiedFg,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight(700),
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                )
            }
        }

        when {
            ui.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator(color = Purple) }
            ui.order == null -> Box(Modifier.fillMaxSize(), Alignment.Center) { Text("No bill for this table.", color = Muted) }
            else -> Body(ui, vm, isPaid, onProceedToClear = { onPaid(vm.tableId) })
        }
    }
}

@Composable
private fun ColumnScope.Body(
    ui: PaymentUiState,
    vm: PaymentViewModel,
    isPaid: Boolean,
    onProceedToClear: () -> Unit,
) {
    val context = LocalContext.current

    Column(
        Modifier
            .weight(1f)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        // Itemised bill card
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = White,
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Itemised bill",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight(700),
                        color = InkPrimary,
                        modifier = Modifier.weight(1f),
                    )
                    Text("Order #${ui.order?.orderNumber ?: ""}", style = MaterialTheme.typography.labelMedium, color = Muted)
                }
                Spacer(Modifier.height(12.dp))

                ui.items.forEach { ItemLine(it) }

                Spacer(Modifier.height(10.dp))
                HorizontalDivider(color = BorderGrey)
                Spacer(Modifier.height(10.dp))

                val subtotal = ui.subtotal
                val cgst = ui.cgst
                val sgst = ui.sgst
                val discount = ui.discount
                val service = ui.service

                BillRow("Subtotal", "₹${fmt(subtotal)}")
                BillRow("CGST 2.5%", "₹${fmt(cgst)}")
                BillRow("SGST 2.5%", "₹${fmt(sgst)}")
                if (service > 0) {
                    BillRow("Service charge", "₹${fmt(service)}")
                }
                BillRow("Discount", if (discount > 0) "-₹${fmt(discount)}" else "None")

                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Total payable", style = MaterialTheme.typography.titleMedium, color = InkPrimary, fontWeight = FontWeight(700), modifier = Modifier.weight(1f))
                    Text("₹${fmt(ui.total)}", style = MaterialTheme.typography.titleLarge, color = InkPrimary, fontWeight = FontWeight(800))
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        // Paid & Balance row
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            val amountPaid = if (isPaid) ui.total else (ui.order?.amountPaid ?: 0.0)
            val balance = if (isPaid) 0.0 else (ui.total - amountPaid).coerceAtLeast(0.0)

            ChipStat("Amount paid", "₹${fmt(amountPaid)}", if (isPaid) AvailableBg else LavenderSurface, if (isPaid) AvailableFg else InkPrimary, Modifier.weight(1f))
            ChipStat("Balance", "₹${fmt(balance)}", if (isPaid) LavenderSurface else PeachSurface, if (isPaid) Muted else OccupiedFg, Modifier.weight(1f))
        }

        Spacer(Modifier.height(18.dp))

        if (isPaid) {
            // Bill is PAID: Show Invoice Actions + Proceed to Table Clearing
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = AvailableBg,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier.size(36.dp).clip(CircleShape).background(AvailableFg),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.Check, null, tint = White, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("Payment Completed", color = AvailableFg, fontWeight = FontWeight(700), style = MaterialTheme.typography.titleSmall)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Secondary action buttons: Print Invoice & Share
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                SecondaryButton(
                    text = "Print Invoice",
                    onClick = {
                        Toast.makeText(context, "Printing tax invoice for Table T${ui.table?.number ?: ""}...", Toast.LENGTH_SHORT).show()
                    },
                    modifier = Modifier.weight(1f),
                )
                SecondaryButton(
                    text = "Share",
                    onClick = {
                        val shareText = "Tax Invoice - Table T${ui.table?.number ?: ""}\nOrder #${ui.order?.orderNumber ?: ""}\nTotal Paid: ₹${fmt(ui.total)}\nThank you for dining with us!"
                        val sendIntent = Intent().apply {
                            action = Intent.ACTION_SEND
                            putExtra(Intent.EXTRA_TEXT, shareText)
                            type = "text/plain"
                        }
                        context.startActivity(Intent.createChooser(sendIntent, "Share Bill"))
                    },
                    modifier = Modifier.weight(1f),
                )
            }

            Spacer(Modifier.height(16.dp))

            // Primary Button: Proceed to Table Clearing
            PrimaryButton(
                text = "Proceed to Table Clearing",
                onClick = onProceedToClear,
            )
        } else {
            // Bill is UNPAID: Payment collection options
            Text("Collect payment", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight(700), color = InkPrimary)
            Spacer(Modifier.height(10.dp))

            Surface(shape = PillShape, color = LavenderSurface) {
                Row(Modifier.padding(4.dp)) {
                    PayMethod.entries.forEach { m ->
                        MethodTab(m.label, ui.method == m, Modifier.weight(1f)) { vm.setMethod(m) }
                    }
                }
            }

            Spacer(Modifier.height(14.dp))

            when (ui.method) {
                PayMethod.CASH -> CashPanel(ui, vm)
                PayMethod.UPI -> UpiPanel(ui, vm, context)
                PayMethod.CARD -> CardPanel(ui, vm, context)
            }

            if (ui.error != null) {
                Spacer(Modifier.height(8.dp))
                Text(ui.error!!, color = ErrorRed, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(18.dp))

            SlideToConfirmButton(
                text = if (ui.method == PayMethod.CASH) "Slide to confirm cash payment" else "Slide to confirm payment",
                onConfirm = vm::confirm,
                enabled = ui.canConfirm,
                submitting = ui.submitting,
            )
        }

        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun CashPanel(ui: PaymentUiState, vm: PaymentViewModel) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = White,
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Amount due", style = MaterialTheme.typography.bodyMedium, color = Muted, modifier = Modifier.weight(1f))
                Text("₹${fmt(ui.total)}", style = MaterialTheme.typography.titleMedium, color = InkPrimary, fontWeight = FontWeight(800))
            }

            Spacer(Modifier.height(12.dp))
            Text("Amount received", style = MaterialTheme.typography.labelMedium, color = InkPrimary, fontWeight = FontWeight(600))
            Spacer(Modifier.height(6.dp))

            OutlinedTextField(
                value = ui.amountReceived,
                onValueChange = vm::setAmount,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                prefix = { Text("₹ ", fontWeight = FontWeight(700), color = InkPrimary) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = White,
                    unfocusedContainerColor = White,
                    focusedBorderColor = Purple,
                    unfocusedBorderColor = BorderGrey,
                    cursorColor = Purple,
                ),
            )

            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                QuickChip("Exact") { vm.setAmount(fmt(ui.total)) }
                val r100 = (ceil(ui.total / 100.0) * 100).toInt()
                val r500 = (ceil(ui.total / 500.0) * 500).toInt()
                if (r100.toDouble() > ui.total) QuickChip("₹$r100") { vm.setAmount("$r100") }
                if (r500.toDouble() > ui.total && r500 != r100) QuickChip("₹$r500") { vm.setAmount("$r500") }
                QuickChip("₹2,000") { vm.setAmount("2000") }
            }

            Spacer(Modifier.height(14.dp))
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = AvailableBg,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Change to return", color = AvailableFg, fontWeight = FontWeight(600), modifier = Modifier.weight(1f))
                    Text("₹${fmt(ui.change)}", color = AvailableFg, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight(800))
                }
            }
        }
    }
}

@Composable
private fun UpiPanel(ui: PaymentUiState, vm: PaymentViewModel, context: Context) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = White,
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                Modifier
                    .size(160.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(White)
                    .border(1.dp, BorderGrey, RoundedCornerShape(14.dp))
                    .padding(8.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (!ui.paymentQrUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = ui.paymentQrUrl,
                        contentDescription = "Official Payment QR",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit,
                    )
                } else {
                    Icon(Icons.Filled.QrCode, "Dynamic QR", tint = PurpleDeep, modifier = Modifier.size(120.dp))
                }
            }
            Spacer(Modifier.height(10.dp))
            Text("Scan to pay ₹${fmt(ui.total)}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight(700), color = InkPrimary)
            Text("UPI / GPay / PhonePe / Paytm", style = MaterialTheme.typography.bodySmall, color = Muted)
            Spacer(Modifier.height(12.dp))
            SecondaryButton("Edit Amount", onClick = {
                Toast.makeText(context, "Tap amount field to adjust", Toast.LENGTH_SHORT).show()
            }, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun CardPanel(ui: PaymentUiState, vm: PaymentViewModel, context: Context) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = White,
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderGrey),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("Card Machine", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight(700), color = InkPrimary)
            Spacer(Modifier.height(6.dp))
            Text("Swipe, insert or tap customer card on EDC terminal.", style = MaterialTheme.typography.bodySmall, color = Muted)
            Spacer(Modifier.height(12.dp))
            SecondaryButton("Send ₹${fmt(ui.total)} to Terminal", onClick = {
                Toast.makeText(context, "Amount sent to EDC POS terminal", Toast.LENGTH_SHORT).show()
            }, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun ItemLine(it: OrderItemDto) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val deco = if (it.cancelled) TextDecoration.LineThrough else TextDecoration.None
        Column(Modifier.weight(1f)) {
            Text(
                "${it.name} × ${it.quantity}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight(600),
                color = if (it.cancelled) Muted else InkPrimary,
                textDecoration = deco,
            )
            if (!it.notes.isNullOrBlank()) {
                Text(it.notes!!, style = MaterialTheme.typography.bodySmall, color = Muted)
            }
        }
        if (it.cancelled) {
            Surface(shape = PillShape, color = PeachSurface) {
                Text("Cancelled", color = Coral, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp))
            }
        } else {
            Text("₹${fmt(it.lineTotal)}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight(700), color = InkPrimary)
        }
    }
}

@Composable
private fun BillRow(label: String, value: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Muted)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = InkPrimary, fontWeight = FontWeight(600))
    }
}

@Composable
private fun ChipStat(label: String, value: String, bg: Color, fg: Color, modifier: Modifier) {
    Column(
        modifier
            .background(bg, RoundedCornerShape(14.dp))
            .padding(14.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = fg.copy(alpha = 0.8f))
        Spacer(Modifier.height(2.dp))
        Text(value, style = MaterialTheme.typography.titleMedium, color = fg, fontWeight = FontWeight(800))
    }
}

@Composable
private fun MethodTab(label: String, active: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .clip(PillShape)
            .background(if (active) LavenderChip else Color.Transparent)
            .clickableNoRipple(onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = if (active) PurpleDeep else Muted,
            fontWeight = FontWeight(if (active) 700 else 500),
        )
    }
}

@Composable
private fun QuickChip(label: String, onClick: () -> Unit) {
    Surface(
        shape = PillShape,
        color = LavenderSurface,
        modifier = Modifier.clickableNoRipple(onClick),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight(600),
            color = InkPrimary,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
        )
    }
}

private fun fmt(v: Double): String = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)
