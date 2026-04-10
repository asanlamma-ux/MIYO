package com.miyo.vnmaker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import com.miyo.vnmaker.ui.screens.EditorScreen
import com.miyo.vnmaker.ui.screens.LibraryScreen
import com.miyo.vnmaker.ui.state.StudioStateHolder
import com.miyo.vnmaker.ui.theme.MiyoTheme

@Composable
fun MiyoApp() {
    val context = LocalContext.current.applicationContext
    val state = remember { StudioStateHolder(context) }

    MiyoTheme {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            androidx.compose.ui.graphics.Color(0xFFF5F0E7),
                            androidx.compose.ui.graphics.Color(0xFFEFE5D7),
                            androidx.compose.ui.graphics.Color(0xFFF8F5EF),
                        )
                    )
                )
        ) {
            if (state.activeProject == null) {
                LibraryScreen(state = state)
            } else {
                EditorScreen(state = state)
            }
        }
    }
}

