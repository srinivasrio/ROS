package com.dineinone.waiter.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt
import com.dineinone.waiter.ui.theme.*

/** "Dine in One" wordmark — Archivo, coral "in". */
@Composable
fun DineWordmark(fontSize: androidx.compose.ui.unit.TextUnit = 22.sp) {
    Row {
        Text("Dine ", fontFamily = Archivo, fontWeight = FontWeight(800), fontSize = fontSize, color = InkPrimary)
        Text("in", fontFamily = Archivo, fontWeight = FontWeight(800), fontSize = fontSize, color = Coral)
        Text(" One", fontFamily = Archivo, fontWeight = FontWeight(800), fontSize = fontSize, color = InkPrimary)
    }
}

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().height(54.dp),
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = LavenderChip,
            contentColor = PurpleDeep,
            disabledContainerColor = LavenderChip.copy(alpha = 0.5f),
            disabledContentColor = PurpleDeep.copy(alpha = 0.5f),
        ),
        elevation = null,
    ) {
        if (loading) {
            CircularProgressIndicator(strokeWidth = 2.dp, color = PurpleDeep, modifier = Modifier.size(20.dp))
        } else {
            Text(text, fontWeight = FontWeight(700), fontSize = 16.sp)
        }
    }
}

@Composable
fun SecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(50.dp),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, BorderGrey),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = InkPrimary, containerColor = White),
    ) { Text(text, fontWeight = FontWeight(600)) }
}

/** Solid dark ink button matching the design system (View Bill, Back to Home, Transfer Access). */
@Composable
fun InkButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().height(52.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = InkPrimary,
            contentColor = White,
            disabledContainerColor = InkPrimary.copy(alpha = 0.5f),
            disabledContentColor = White.copy(alpha = 0.5f),
        ),
        elevation = null,
    ) {
        if (loading) {
            CircularProgressIndicator(strokeWidth = 2.dp, color = White, modifier = Modifier.size(20.dp))
        } else {
            Text(text, fontWeight = FontWeight(700), fontSize = 16.sp)
        }
    }
}

/** Pill button for areas and filter shortcuts matching navigation button color and style. */
@Composable
fun GradientPillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        shape = PillShape,
        color = LavenderChip,
        border = BorderStroke(1.dp, Color(0xFFC4B5FD).copy(alpha = 0.5f)),
        shadowElevation = 2.dp,
        modifier = modifier
            .clip(PillShape)
            .clickableNoRipple(onClick),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 9.dp),
        ) {
            Text(
                text = text,
                color = PurpleDeep,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight(800),
                fontSize = 15.sp,
            )
            Spacer(Modifier.width(4.dp))
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = PurpleDeep,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}

/** Card-styled labeled text field matching the design inputs. */
@Composable
fun LabeledField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    leading: @Composable (() -> Unit)? = null,
    prefix: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    required: Boolean = false,
) {
    var hidden by remember { mutableStateOf(isPassword) }
    Column(modifier) {
        Row {
            Text(label, style = MaterialTheme.typography.labelMedium, color = InkPrimary)
            if (required) Text(" *", color = Coral, style = MaterialTheme.typography.labelMedium)
        }
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(placeholder, color = Muted) },
            leadingIcon = leading,
            prefix = prefix?.let { { Text(it, fontWeight = FontWeight(700), color = InkPrimary) } },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            visualTransformation = if (hidden) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            trailingIcon = if (isPassword) {
                { TextButton(onClick = { hidden = !hidden }) { Text(if (hidden) "Show" else "Hide", color = Purple, style = MaterialTheme.typography.labelMedium) } }
            } else null,
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = White,
                unfocusedContainerColor = White,
                focusedBorderColor = Purple,
                unfocusedBorderColor = BorderGrey,
                cursorColor = Purple,
            ),
        )
    }
}

/** Segmented PIN entry — N boxes bound to a single string. */
@Composable
fun PinBoxes(
    value: String,
    onValueChange: (String) -> Unit,
    length: Int = 5,
    modifier: Modifier = Modifier,
    masked: Boolean = true,
) {
    BasicTextField(
        value = value,
        onValueChange = { if (it.length <= length && it.all { c -> c.isDigit() }) onValueChange(it) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        modifier = modifier.fillMaxWidth(),
        decorationBox = {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(length) { i ->
                    val ch = value.getOrNull(i)
                    Box(
                        Modifier
                            .weight(1f)
                            .height(54.dp)
                            .border(1.dp, if (ch != null) Purple else BorderGrey, RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = when { ch == null -> "–"; masked -> "•"; else -> ch.toString() },
                            style = MaterialTheme.typography.titleLarge,
                            color = if (ch != null) InkPrimary else Muted,
                        )
                    }
                }
            }
        },
    )
}

@Composable
fun ErrorBanner(message: String, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .border(1.dp, Coral.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
            .background(PeachSurface.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.ErrorOutline, null, tint = Coral, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text(message, style = MaterialTheme.typography.bodySmall, color = OccupiedFg)
    }
}

// ── small helpers ──
fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier = composed {
    clickable(
        interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
        indication = null,
        onClick = onClick,
    )
}

/**
 * Slide to confirm button matching the existing slide gesture design.
 */
@Composable
fun SlideToConfirmButton(
    text: String,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    submitting: Boolean = false,
    thumbColor: Color = Purple,
    trackColor: Color = LavenderSurface,
    textColor: Color = PurpleDeep,
) {
    val density = androidx.compose.ui.platform.LocalDensity.current
    var trackWidthPx by remember { mutableStateOf(0f) }
    val thumbPx = with(density) { 54.dp.toPx() }
    var offset by remember { mutableStateOf(0f) }
    val maxOffset = (trackWidthPx - thumbPx).coerceAtLeast(0f)

    LaunchedEffect(enabled) {
        if (!enabled) offset = 0f
    }

    Surface(
        shape = RoundedCornerShape(999.dp),
        color = if (enabled) trackColor else BorderGrey.copy(alpha = 0.35f),
        modifier = modifier.fillMaxWidth().height(62.dp),
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .onSizeChanged { trackWidthPx = it.width.toFloat() },
            contentAlignment = Alignment.Center,
        ) {
            // Fill background covering track with button thumbColor as user slides
            if (enabled && offset > 0f) {
                Box(
                    Modifier
                        .fillMaxHeight()
                        .width(with(density) { (offset + thumbPx).toDp() })
                        .clip(RoundedCornerShape(999.dp))
                        .background(thumbColor)
                        .align(Alignment.CenterStart)
                )
            }
            Text(
                text = if (submitting) "Processing…" else text,
                color = if (offset > maxOffset * 0.45f) White else if (enabled) textColor else Muted,
                fontWeight = FontWeight(700),
                fontSize = 15.sp,
            )
            Box(
                Modifier
                    .offset { IntOffset(offset.roundToInt(), 0) }
                    .padding(4.dp)
                    .size(54.dp)
                    .clip(CircleShape)
                    .background(if (enabled) thumbColor else BorderGrey)
                    .align(Alignment.CenterStart)
                    .pointerInput(maxOffset, submitting, enabled) {
                        if (submitting || !enabled) return@pointerInput
                        detectHorizontalDragGestures(
                            onDragEnd = {
                                if (offset > maxOffset * 0.70f) {
                                    offset = maxOffset
                                    onConfirm()
                                } else {
                                    offset = 0f
                                }
                            },
                        ) { _, dragAmount ->
                            offset = (offset + dragAmount).coerceIn(0f, maxOffset)
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                if (submitting) {
                    CircularProgressIndicator(color = White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                } else {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = "Confirm",
                        tint = White,
                    )
                }
            }
        }
    }
}
