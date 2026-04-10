package com.miyo.vnmaker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import com.miyo.vnmaker.ui.components.MetricBadge
import com.miyo.vnmaker.ui.components.PanelCard
import com.miyo.vnmaker.ui.components.SplitHeadline
import com.miyo.vnmaker.ui.state.StudioStateHolder

@Composable
fun LibraryScreen(state: StudioStateHolder) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        brush = Brush.linearGradient(
                            listOf(
                                MaterialTheme.colorScheme.onSurface,
                                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.92f),
                            )
                        ),
                        shape = RoundedCornerShape(36.dp),
                    )
                    .padding(22.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    MetricBadge(text = "Android VN Studio")
                    Text(
                        text = "MIYO builds visual novels with a studio-grade mobile workflow.",
                        style = MaterialTheme.typography.displayLarge,
                        color = MaterialTheme.colorScheme.surface,
                    )
                    Text(
                        text = "Graph authoring, layered scenes, code and file views, Tuesday JS import, ZIP archives, Supabase backup hooks, and bundled starter documentation.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.78f),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = state::createProject) {
                            Text("New From Template")
                        }
                        OutlinedButton(onClick = state::importBundledTuesdaySample) {
                            Text("Import Tuesday Sample")
                        }
                    }
                }
            }
        }

        item {
            SplitHeadline(left = "Projects", right = "${state.projects.size} loaded")
        }

        items(state.projects, key = { it.manifest.id }) { project ->
            PanelCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { state.openProject(project.manifest.id) },
                eyebrow = project.manifest.mode.name,
                title = project.manifest.title,
                accent = MaterialTheme.colorScheme.secondary,
            ) {
                Text(
                    text = project.manifest.description.ifBlank { "No description yet." },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${project.blocks.size} blocks • ${project.variables.size} variables • ${project.scripts.size} scripts",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                    Text(
                        text = "Open",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }

        item {
            PanelCard(
                modifier = Modifier.fillMaxWidth(),
                eyebrow = "Bundled Docs",
                title = "Included guidance",
            ) {
                Text(
                    text = state.docs.joinToString(" • ") { it.title },
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

