@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)

package com.dineinone.waiter.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.dineinone.waiter.R

private fun jakarta(weight: Int) = Font(
    R.font.plus_jakarta_sans,
    FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight))
)

private fun archivo(weight: Int) = Font(
    R.font.archivo,
    FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight))
)

val Jakarta = FontFamily(
    jakarta(400), jakarta(500), jakarta(600), jakarta(700), jakarta(800)
)

// Display family for the "Dine in One" wordmark and big headings.
val Archivo = FontFamily(
    archivo(600), archivo(700), archivo(800)
)

val AppTypography = Typography(
    displayLarge = TextStyle(fontFamily = Archivo, fontWeight = FontWeight(800), fontSize = 40.sp, lineHeight = 44.sp),
    displayMedium = TextStyle(fontFamily = Archivo, fontWeight = FontWeight(700), fontSize = 32.sp, lineHeight = 38.sp),
    headlineLarge = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(800), fontSize = 28.sp, lineHeight = 34.sp),
    headlineMedium = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(700), fontSize = 24.sp, lineHeight = 30.sp),
    titleLarge = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(700), fontSize = 20.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(600), fontSize = 16.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(600), fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(500), fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(500), fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(500), fontSize = 12.sp, lineHeight = 16.sp),
    labelLarge = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(700), fontSize = 14.sp, lineHeight = 18.sp),
    labelMedium = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(600), fontSize = 12.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = Jakarta, fontWeight = FontWeight(600), fontSize = 11.sp, lineHeight = 14.sp),
)
