package com.dineinone.waiter.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.SoupKitchen
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.dineinone.waiter.ui.theme.*

data class ReadyDishEvent(
    val requestId: String? = null,
    val tableId: String,
    val tableNumber: String,
    val itemName: String,
    val quantity: Int = 1,
)

@Composable
fun DishReadyAlertSheet(
    event: ReadyDishEvent,
    onPickUp: () -> Unit,
    onDismiss: () -> Unit,
) {
    val emeraldPrimary = Color(0xFF10B981)
    val emeraldDark = Color(0xFF059669)
    val emeraldLight = Color(0xFFECFDF5)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(dismissOnBackPress = true, dismissOnClickOutside = false),
    ) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = White,
            border = BorderStroke(2.5.dp, emeraldPrimary),
            shadowElevation = 24.dp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(22.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Top Header Row: "KITCHEN ALERT" & "READY"
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = emeraldLight,
                        border = BorderStroke(1.dp, emeraldPrimary.copy(alpha = 0.3f)),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Icon(
                                Icons.Filled.SoupKitchen,
                                contentDescription = null,
                                tint = emeraldDark,
                                modifier = Modifier.size(15.dp),
                            )
                            Text(
                                "KITCHEN ALERT",
                                color = emeraldDark,
                                fontWeight = FontWeight(900),
                                fontSize = 11.sp,
                                letterSpacing = 0.5.sp,
                            )
                        }
                    }

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = emeraldPrimary,
                    ) {
                        Text(
                            "READY",
                            color = White,
                            fontWeight = FontWeight(900),
                            fontSize = 10.sp,
                            letterSpacing = 0.5.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                    }
                }

                Spacer(Modifier.height(18.dp))

                // Circular Utensils Icon Highlight
                Box(
                    modifier = Modifier
                        .size(76.dp)
                        .clip(CircleShape)
                        .background(emeraldLight)
                        .border(3.dp, emeraldPrimary.copy(alpha = 0.25f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Restaurant,
                        contentDescription = null,
                        tint = emeraldDark,
                        modifier = Modifier.size(40.dp),
                    )
                }

                Spacer(Modifier.height(14.dp))

                // Table Number Badge
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = AppBg,
                    border = BorderStroke(1.dp, BorderGrey),
                ) {
                    val displayTable = if (event.tableNumber.startsWith("Table", ignoreCase = true)) {
                        event.tableNumber
                    } else {
                        "Table ${event.tableNumber}"
                    }
                    Text(
                        displayTable,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight(900),
                        color = InkPrimary,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                    )
                }

                Spacer(Modifier.height(14.dp))

                // Dish Details Card
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xFFF9FAFB),
                    border = BorderStroke(1.dp, BorderGrey),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        val formattedItemName = if (event.itemName.matches(Regex("^\\d+x\\s+.*", RegexOption.IGNORE_CASE))) {
                            event.itemName
                        } else {
                            "${event.quantity}x ${event.itemName}"
                        }
                        Text(
                            formattedItemName,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight(800),
                            color = InkPrimary,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "Prepared and ready at the kitchen counter",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF6B7280),
                            fontWeight = FontWeight(500),
                            textAlign = TextAlign.Center,
                        )
                    }
                }

                Spacer(Modifier.height(20.dp))

                // Action Buttons: Dismiss & Pick Up & Serve
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(12.dp),
                        color = LavenderChip,
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp),
                    ) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                "Dismiss",
                                color = InkPrimary,
                                fontWeight = FontWeight(700),
                                fontSize = 13.sp,
                            )
                        }
                    }

                    Surface(
                        onClick = onPickUp,
                        shape = RoundedCornerShape(12.dp),
                        color = emeraldDark,
                        modifier = Modifier
                            .weight(1.8f)
                            .height(46.dp),
                    ) {
                        Row(
                            Modifier.fillMaxSize(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Filled.Check,
                                contentDescription = null,
                                tint = White,
                                modifier = Modifier.size(16.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "Pick Up & Serve",
                                color = White,
                                fontWeight = FontWeight(800),
                                fontSize = 13.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}
