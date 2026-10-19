package com.dineinone.waiter.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val DineInOneColors = lightColorScheme(
    primary = Purple,
    onPrimary = White,
    primaryContainer = LavenderChip,
    onPrimaryContainer = PurpleDeep,
    secondary = Coral,
    onSecondary = White,
    secondaryContainer = PeachSurface,
    onSecondaryContainer = OccupiedFg,
    tertiary = AvailableFg,
    background = AppBg,
    onBackground = InkPrimary,
    surface = White,
    onSurface = InkPrimary,
    surfaceVariant = LavenderSurface,
    onSurfaceVariant = Muted,
    outline = BorderGrey,
    outlineVariant = BorderGrey,
    error = ErrorRed,
    onError = White,
)

@Composable
fun DineInOneTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DineInOneColors,
        typography = AppTypography,
        shapes = AppShapes,
        content = content,
    )
}
