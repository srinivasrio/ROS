package com.dineinone.waiter.ui.cart

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dineinone.waiter.ui.components.InkButton
import com.dineinone.waiter.ui.components.PrimaryButton
import com.dineinone.waiter.ui.theme.*

@Composable
fun OrderConfirmedScreen(
    tableId: String,
    tableLabel: String,
    orderId: String,
    totalAmount: Double,
    itemCount: Int,
    onViewTable: (String) -> Unit,
    onBackHome: () -> Unit,
) {
    val shortOrderId = if (orderId.length > 4) orderId.takeLast(4) else orderId

    Column(
        Modifier
            .fillMaxSize()
            .background(LavenderSoft)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        // Top app bar
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Order Placed",
                style = MaterialTheme.typography.titleMedium,
                color = InkPrimary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onBackHome) {
                Icon(Icons.Filled.Close, "Close", tint = InkPrimary)
            }
        }

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(16.dp))

            // Clean success badge
            Box(
                Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(AvailableBg),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(AvailableFg),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Check,
                        contentDescription = "Success",
                        tint = White,
                        modifier = Modifier.size(30.dp),
                    )
                }
            }

            Spacer(Modifier.height(18.dp))

            Text(
                "Order Sent to Kitchen",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight(800),
                color = InkPrimary,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(6.dp))

            Surface(
                shape = PillShape,
                color = LavenderChip,
            ) {
                Text(
                    "Table $tableLabel · Order #$shortOrderId",
                    color = PurpleDeep,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight(700),
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                )
            }

            Spacer(Modifier.height(24.dp))

            // Clean Structured Summary Card
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = White,
                border = BorderStroke(1.dp, BorderGrey),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(20.dp)) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Items Ordered", style = MaterialTheme.typography.bodyMedium, color = Muted)
                        Text("$itemCount item${if (itemCount > 1) "s" else ""}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight(700), color = InkPrimary)
                    }

                    Spacer(Modifier.height(12.dp))
                    HorizontalDivider(color = BorderGrey)
                    Spacer(Modifier.height(12.dp))

                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Status", style = MaterialTheme.typography.bodyMedium, color = Muted)
                        Surface(shape = PillShape, color = AvailableBg) {
                            Row(Modifier.padding(horizontal = 10.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(6.dp).clip(CircleShape).background(AvailableFg))
                                Spacer(Modifier.width(6.dp))
                                Text("Kitchen Preparing", style = MaterialTheme.typography.labelSmall, color = AvailableFg, fontWeight = FontWeight(700))
                            }
                        }
                    }

                    Spacer(Modifier.height(12.dp))
                    HorizontalDivider(color = BorderGrey)
                    Spacer(Modifier.height(12.dp))

                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Total Amount", style = MaterialTheme.typography.titleMedium, color = InkPrimary, fontWeight = FontWeight(700))
                        Text("₹${fmt(totalAmount)}", style = MaterialTheme.typography.headlineSmall, color = InkPrimary, fontWeight = FontWeight(800))
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
        }

        // Bottom action buttons: PrimaryButton (View Table) + InkButton (Back to Home)
        Column(
            Modifier
                .fillMaxWidth()
                .background(White)
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            PrimaryButton(
                text = "View Table",
                onClick = { onViewTable(tableId) },
            )
            InkButton(
                text = "Back to Home",
                onClick = onBackHome,
            )
        }
    }
}

@Composable
private fun OrderSummaryRow(label: String, value: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Muted)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight(700), color = InkPrimary)
    }
}

private fun fmt(v: Double): String = if (v % 1.0 == 0.0) v.toInt().toString() else String.format("%.2f", v)
