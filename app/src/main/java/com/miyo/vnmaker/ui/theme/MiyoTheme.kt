package com.miyo.vnmaker.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val LightScheme = lightColorScheme(
    primary = Color(0xFFC65D3A),
    onPrimary = Color(0xFFF8F3ED),
    secondary = Color(0xFF3E6B6F),
    background = Color(0xFFF3EEE6),
    surface = Color(0xFFFFFBF6),
    surfaceVariant = Color(0xFFE6DDD1),
    onSurface = Color(0xFF171411),
    onBackground = Color(0xFF171411),
    outline = Color(0xFF9F907F),
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFFE38B6E),
    secondary = Color(0xFF89B0B4),
    background = Color(0xFF15110F),
    surface = Color(0xFF1E1814),
    surfaceVariant = Color(0xFF2B231D),
    onSurface = Color(0xFFF4EDE2),
    onBackground = Color(0xFFF4EDE2),
    outline = Color(0xFF6D5E50),
)

private val StudioTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.Bold,
        fontSize = 34.sp,
        lineHeight = 38.sp,
        letterSpacing = (-0.8).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 28.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        letterSpacing = 0.2.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        letterSpacing = 0.4.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 19.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        letterSpacing = 0.8.sp,
    ),
)

@Composable
fun MiyoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkScheme else LightScheme,
        typography = StudioTypography,
        content = content,
    )
}

