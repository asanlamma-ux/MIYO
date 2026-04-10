package com.miyo.vnmaker.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp

@Composable
fun PanelCard(
    modifier: Modifier = Modifier,
    title: String? = null,
    eyebrow: String? = null,
    accent: Color = MaterialTheme.colorScheme.primary,
    content: @Composable () -> Unit,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(28.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (eyebrow != null || title != null) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (eyebrow != null) {
                        MetricBadge(text = eyebrow, accent = accent)
                    }
                    if (title != null) {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }
            content()
        }
    }
}

@Composable
fun MetricBadge(
    text: String,
    accent: Color = MaterialTheme.colorScheme.primary,
) {
    Box(
        modifier = Modifier
            .border(
                width = 1.dp,
                color = accent.copy(alpha = 0.4f),
                shape = RoundedCornerShape(999.dp),
            )
            .background(accent.copy(alpha = 0.1f), RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp)
            .defaultMinSize(minHeight = 28.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text.uppercase(),
            style = MaterialTheme.typography.labelSmall.copy(fontFamily = FontFamily.Monospace),
            color = accent,
        )
    }
}

@Composable
fun SplitHeadline(
    left: String,
    right: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(left, style = MaterialTheme.typography.headlineMedium)
        Text(
            text = right.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.outline,
        )
    }
}

