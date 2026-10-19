package com.dineinone.waiter.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.dineinone.waiter.R
import com.dineinone.waiter.ui.theme.*

data class CustomerServiceAlertEvent(
    val id: String,
    val tableId: String,
    val tableNumber: String,
    val serviceType: String,
    val title: String,
    val quantity: Int = 1,
    val notes: String? = null,
    val isTableAccess: Boolean = false,
)

object ServiceHelper {
    fun drawableFor(type: String?): Int? = when ((type ?: "").lowercase().trim()) {
        "water_requested", "water" -> R.drawable.svc_water
        "bill_requested", "bill" -> R.drawable.svc_bill
        "cutlery_requested", "cutlery" -> R.drawable.svc_cutlery
        "plate_requested", "extra_plate", "plate" -> R.drawable.svc_plate
        "glass_requested", "extra_glass", "glass" -> R.drawable.svc_glass
        "bowl_requested", "finger_bowl" -> R.drawable.svc_finger_bowl
        "salt_requested", "salt" -> R.drawable.svc_salt
        "pepper_requested", "pepper" -> R.drawable.svc_pepper
        "sauce_requested", "ketchup" -> R.drawable.svc_ketchup
        "tissue_requested", "tissue" -> R.drawable.svc_tissue
        "call_waiter" -> R.drawable.svc_waiter
        else -> null
    }

    fun iconFor(type: String?): ImageVector = when ((type ?: "").lowercase().trim()) {
        "water_requested", "water" -> Icons.Filled.LocalDrink
        "cutlery_requested", "cutlery" -> Icons.Filled.Restaurant
        "bill_requested", "bill" -> Icons.Filled.ReceiptLong
        "table_access_request" -> Icons.Filled.SwapHoriz
        else -> Icons.Filled.RoomService
    }

    fun labelFor(type: String?): String = when ((type ?: "").lowercase().trim()) {
        "call_waiter" -> "Call Waiter"
        "water_requested", "water" -> "Water"
        "cutlery_requested", "cutlery" -> "Cutlery"
        "bill_requested", "bill" -> "Bill"
        "table_access_request" -> "Table Access"
        "plate_requested", "plate", "extra_plate" -> "Extra Plate"
        "glass_requested", "glass", "extra_glass" -> "Extra Glass"
        "tissue_requested", "tissue" -> "Tissue"
        "sauce_requested", "ketchup" -> "Ketchup"
        "bowl_requested", "finger_bowl" -> "Finger Bowl"
        "salt_requested", "salt" -> "Salt"
        "pepper_requested", "pepper" -> "Pepper"
        "clean_table", "cleaning" -> "Clean Table"
        else -> (type ?: "Service Request").replace('_', ' ').replaceFirstChar { it.uppercase() }
    }
}

@Composable
fun IncomingRequestAlertSheet(
    event: CustomerServiceAlertEvent,
    onAccept: () -> Unit,
    onDismiss: () -> Unit,
    onDecline: (() -> Unit)? = null,
) {
    val coralBorder = Color(0xFFFF4D4F)
    val coralLight = Color(0xFFFFF1F0)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(dismissOnBackPress = true, dismissOnClickOutside = false),
    ) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = White,
            border = BorderStroke(2.5.dp, coralBorder),
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
                // Top Header Row: "NEW SERVICE REQUEST" & Close
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = coralLight,
                        border = BorderStroke(1.dp, coralBorder.copy(alpha = 0.3f)),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Icon(
                                Icons.Filled.NotificationsActive,
                                contentDescription = null,
                                tint = coralBorder,
                                modifier = Modifier.size(15.dp),
                            )
                            Text(
                                if (event.isTableAccess) "TABLE ACCESS REQUEST" else "NEW SERVICE REQUEST",
                                color = coralBorder,
                                fontWeight = FontWeight(900),
                                fontSize = 11.sp,
                                letterSpacing = 0.5.sp,
                            )
                        }
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "Dismiss",
                            tint = Muted,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(Modifier.height(18.dp))

                // Service Details Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    val drawableRes = ServiceHelper.drawableFor(event.serviceType)
                    Box(
                        modifier = Modifier
                            .size(68.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(LavenderSurface)
                            .border(1.dp, BorderGrey, RoundedCornerShape(18.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (drawableRes != null) {
                            Image(
                                painter = painterResource(drawableRes),
                                contentDescription = event.title,
                                modifier = Modifier.size(46.dp),
                                contentScale = ContentScale.Fit,
                            )
                        } else {
                            Icon(
                                ServiceHelper.iconFor(event.serviceType),
                                contentDescription = null,
                                tint = PurpleDeep,
                                modifier = Modifier.size(32.dp),
                            )
                        }
                    }

                    Spacer(Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = LavenderChip,
                        ) {
                            val displayTable = if (event.tableNumber.startsWith("Table", ignoreCase = true)) {
                                event.tableNumber
                            } else {
                                "Table ${event.tableNumber}"
                            }
                            Text(
                                displayTable,
                                color = PurpleDeep,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight(800),
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                            )
                        }

                        Spacer(Modifier.height(6.dp))

                        Text(
                            text = event.title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight(900),
                            fontSize = 20.sp,
                            color = InkPrimary,
                            lineHeight = 24.sp,
                        )

                        if (event.quantity > 1) {
                            Spacer(Modifier.height(3.dp))
                            Text(
                                text = "Quantity: ${event.quantity}",
                                color = Purple,
                                fontWeight = FontWeight(800),
                                fontSize = 13.sp,
                            )
                        }
                    }
                }

                // Optional Notes
                if (!event.notes.isNullOrBlank() && !event.notes.trimStart().startsWith("{")) {
                    Spacer(Modifier.height(14.dp))
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = LavenderSurface,
                        border = BorderStroke(1.dp, BorderGrey.copy(alpha = 0.5f)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            text = "Note: ${event.notes}",
                            style = MaterialTheme.typography.bodySmall,
                            color = InkPrimary,
                            modifier = Modifier.padding(12.dp),
                        )
                    }
                }

                Spacer(Modifier.height(22.dp))

                // Bottom Buttons
                if (event.isTableAccess) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Surface(
                            onClick = onDecline ?: onDismiss,
                            shape = RoundedCornerShape(14.dp),
                            color = White,
                            border = BorderStroke(1.5.dp, BorderGrey),
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp)),
                        ) {
                            Box(
                                modifier = Modifier.padding(vertical = 14.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    "Decline",
                                    color = InkPrimary,
                                    fontWeight = FontWeight(700),
                                    fontSize = 14.sp,
                                )
                            }
                        }

                        Surface(
                            onClick = onAccept,
                            shape = RoundedCornerShape(14.dp),
                            color = Purple,
                            shadowElevation = 4.dp,
                            modifier = Modifier
                                .weight(1.5f)
                                .clip(RoundedCornerShape(14.dp)),
                        ) {
                            Row(
                                modifier = Modifier.padding(vertical = 14.dp),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Filled.Check, null, tint = White, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    "Approve",
                                    color = White,
                                    fontWeight = FontWeight(800),
                                    fontSize = 15.sp,
                                )
                            }
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Surface(
                            onClick = onDismiss,
                            shape = RoundedCornerShape(14.dp),
                            color = White,
                            border = BorderStroke(1.5.dp, BorderGrey),
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp)),
                        ) {
                            Box(
                                modifier = Modifier.padding(vertical = 14.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    "Dismiss",
                                    color = Muted,
                                    fontWeight = FontWeight(700),
                                    fontSize = 14.sp,
                                )
                            }
                        }

                        Surface(
                            onClick = onAccept,
                            shape = RoundedCornerShape(14.dp),
                            color = Purple,
                            shadowElevation = 4.dp,
                            modifier = Modifier
                                .weight(2f)
                                .clip(RoundedCornerShape(14.dp)),
                        ) {
                            Row(
                                modifier = Modifier.padding(vertical = 14.dp),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Filled.Check, null, tint = White, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    "Accept Request",
                                    color = White,
                                    fontWeight = FontWeight(800),
                                    fontSize = 15.sp,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
