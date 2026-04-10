package com.miyo.vnmaker.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.matchParentSize
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.CloudUpload
import androidx.compose.material.icons.rounded.Code
import androidx.compose.material.icons.rounded.Extension
import androidx.compose.material.icons.rounded.FileOpen
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Layers
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.consume
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.miyo.vnmaker.data.model.AuthoringMode
import com.miyo.vnmaker.data.model.BlockNode
import com.miyo.vnmaker.data.model.ChoiceNode
import com.miyo.vnmaker.data.model.LayerKind
import com.miyo.vnmaker.data.model.LayerNode
import com.miyo.vnmaker.data.model.ProjectDocument
import com.miyo.vnmaker.data.runtime.PreviewFrame
import com.miyo.vnmaker.ui.components.MetricBadge
import com.miyo.vnmaker.ui.components.PanelCard
import com.miyo.vnmaker.ui.components.SplitHeadline
import com.miyo.vnmaker.ui.state.EditorTab
import com.miyo.vnmaker.ui.state.StudioStateHolder
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@Composable
fun EditorScreen(state: StudioStateHolder) {
    val project = state.activeProject ?: return
    val scope = rememberCoroutineScope()
    val previewFrame = state.currentFrame()
    val scroll = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scroll)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = project.manifest.mode.name,
            title = project.manifest.title,
            accent = MaterialTheme.colorScheme.primary,
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = project.manifest.description.ifBlank { "Android-first visual novel project" },
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    Text(
                        text = state.syncStatus,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    IconButton(onClick = state::closeProject) {
                        Icon(Icons.Rounded.ArrowBack, contentDescription = "Back")
                    }
                    OutlinedButton(onClick = { state.setMode(AuthoringMode.EASY) }) {
                        Text("Easy")
                    }
                    OutlinedButton(onClick = { state.setMode(AuthoringMode.MANUAL) }) {
                        Text("Manual")
                    }
                }
            }
        }

        ScrollableTabRow(
            selectedTabIndex = state.selectedTab.ordinal,
            containerColor = Color.Transparent,
            edgePadding = 0.dp,
        ) {
            EditorTab.entries.forEach { tab ->
                Tab(
                    selected = state.selectedTab == tab,
                    onClick = { state.selectTab(tab) },
                    text = { Text(tab.name.lowercase().replaceFirstChar { it.uppercase() }) },
                )
            }
        }

        when (state.selectedTab) {
            EditorTab.OVERVIEW -> OverviewTab(state, project, previewFrame)
            EditorTab.GRAPH -> GraphTab(state, project)
            EditorTab.SCENE -> SceneTab(state, previewFrame)
            EditorTab.VARIABLES -> VariablesTab(state, project)
            EditorTab.MANUAL -> ManualTab(state, project)
            EditorTab.PREVIEW -> PreviewTab(state, previewFrame)
            EditorTab.DOCS -> DocsTab(state)
            EditorTab.SYNC -> SyncTab(
                state = state,
                project = project,
                onPushBackup = { scope.launch { state.pushBackup() } },
            )
        }
    }
}

@Composable
private fun OverviewTab(
    state: StudioStateHolder,
    project: ProjectDocument,
    previewFrame: PreviewFrame?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = "Project",
            title = "Studio summary",
            accent = MaterialTheme.colorScheme.secondary,
        ) {
            SplitHeadline(left = "Current blueprint", right = project.manifest.entryBlockId)
            Text(
                text = "MIYO keeps a typed project model as the source of truth. Easy mode and Manual mode both read and write the same structure.",
                style = MaterialTheme.typography.bodyMedium,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricBadge("${project.blocks.size} blocks")
                MetricBadge("${project.variables.size} vars", accent = MaterialTheme.colorScheme.secondary)
                MetricBadge("${project.scripts.size} scripts", accent = MaterialTheme.colorScheme.onSurface)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = state::addBlock) {
                    Icon(Icons.Rounded.Extension, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Add Block")
                }
                OutlinedButton(onClick = state::addPage) {
                    Icon(Icons.Rounded.AutoStories, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Add Page")
                }
                OutlinedButton(onClick = state::exportActiveArchive) {
                    Icon(Icons.Rounded.FileOpen, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Export ZIP")
                }
            }
        }

        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = "Current page",
            title = previewFrame?.speaker ?: "Narration",
        ) {
            var draft by remember(previewFrame?.page?.id) { mutableStateOf(previewFrame?.page?.text.orEmpty()) }
            TextField(
                value = draft,
                onValueChange = { draft = it },
                modifier = Modifier.fillMaxWidth(),
                textStyle = MaterialTheme.typography.bodyLarge,
                label = { Text("Page text") },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = { state.updateCurrentPageText(draft) }) {
                    Text("Apply Text")
                }
                OutlinedButton(onClick = state::previewReset) {
                    Text("Restart Preview")
                }
            }
        }
    }
}

@Composable
private fun GraphTab(state: StudioStateHolder, project: ProjectDocument) {
    val horizontal = rememberScrollState()
    val vertical = rememberScrollState()
    val width = ((project.blocks.maxOfOrNull { it.positionX } ?: 420f) + 520f).dp
    val height = ((project.blocks.maxOfOrNull { it.positionY } ?: 320f) + 320f).dp

    PanelCard(
        modifier = Modifier.fillMaxWidth(),
        eyebrow = "Graph",
        title = "Drag story blocks",
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(560.dp)
                .clip(RoundedCornerShape(22.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f))
                .horizontalScroll(horizontal)
                .verticalScroll(vertical)
        ) {
            Box(
                modifier = Modifier
                    .width(width)
                    .height(height)
            ) {
                Canvas(modifier = Modifier.matchParentSize()) {
                    val connections = buildConnections(project)
                    connections.forEach { (from, to) ->
                        drawLine(
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.18f),
                            start = Offset(from.positionX + 100f, from.positionY + 60f),
                            end = Offset(to.positionX + 100f, to.positionY + 60f),
                            strokeWidth = 6f,
                        )
                    }
                }

                project.blocks.forEach { block ->
                    Card(
                        modifier = Modifier
                            .offset { IntOffset(block.positionX.roundToInt(), block.positionY.roundToInt()) }
                            .width(210.dp)
                            .pointerInput(block.id) {
                                detectDragGestures { change, dragAmount ->
                                    change.consume()
                                    state.updateBlockPosition(block.id, dragAmount.x, dragAmount.y)
                                }
                            },
                        shape = RoundedCornerShape(22.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (state.selectedBlockId == block.id) {
                                MaterialTheme.colorScheme.onSurface
                            } else {
                                MaterialTheme.colorScheme.surface
                            }
                        ),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            MetricBadge(
                                text = block.id,
                                accent = Color(android.graphics.Color.parseColor(block.colorHex))
                            )
                            Text(
                                text = block.title,
                                style = MaterialTheme.typography.titleLarge,
                                color = if (state.selectedBlockId == block.id) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                text = "${block.scenes.size} scenes",
                                style = MaterialTheme.typography.bodyMedium,
                                color = if (state.selectedBlockId == block.id) MaterialTheme.colorScheme.surface.copy(alpha = 0.72f) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.68f),
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Button(onClick = { state.selectBlock(block.id) }) {
                                    Text("Select")
                                }
                                OutlinedButton(onClick = { state.jumpToBlock(block.id) }) {
                                    Text("Preview")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SceneTab(state: StudioStateHolder, previewFrame: PreviewFrame?) {
    val block = state.selectedBlock()
    val scene = state.selectedScene()
    var canvasWidthPx by remember { mutableStateOf(1) }
    var canvasHeightPx by remember { mutableStateOf(1) }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = "Scene Studio",
            title = block?.title ?: "No block selected",
        ) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(onClick = { state.addLayer(LayerKind.BACKGROUND) }) {
                    Icon(Icons.Rounded.Layers, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Add Background")
                }
                OutlinedButton(onClick = { state.addLayer(LayerKind.SPRITE) }) {
                    Icon(Icons.Rounded.GraphicEq, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Add Sprite")
                }
                OutlinedButton(onClick = state::addPage) {
                    Icon(Icons.Rounded.AutoStories, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Add Page")
                }
            }

            BoxWithConstraints(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(360.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(android.graphics.Color.parseColor(scene?.backgroundColorHex ?: "#F3EEE6")))
                    .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
                    .onSizeChanged {
                        canvasWidthPx = it.width
                        canvasHeightPx = it.height
                    }
            ) {
                scene?.layers
                    ?.sortedBy { it.zIndex }
                    ?.forEach { layer ->
                        val layerColor = layer.colorHex?.let { Color(android.graphics.Color.parseColor(it)) }
                            ?: MaterialTheme.colorScheme.secondary
                        Box(
                            modifier = Modifier
                                .offset {
                                    IntOffset(
                                        (layer.x * canvasWidthPx.toFloat()).roundToInt(),
                                        (layer.y * canvasHeightPx.toFloat()).roundToInt(),
                                    )
                                }
                                .width((maxWidth * layer.width).coerceAtLeast(46.dp))
                                .height((maxHeight * layer.height).coerceAtLeast(46.dp))
                                .clip(RoundedCornerShape(18.dp))
                                .background(layerColor.copy(alpha = layer.alpha))
                                .border(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f), RoundedCornerShape(18.dp))
                                .pointerInput(layer.id) {
                                    detectDragGestures { change, dragAmount ->
                                        change.consume()
                                        state.moveLayer(
                                            layer.id,
                                            dragAmount.x / canvasWidthPx.toFloat(),
                                            dragAmount.y / canvasHeightPx.toFloat(),
                                        )
                                    }
                                }
                                .padding(10.dp)
                        ) {
                            Text(
                                text = layer.name,
                                color = Color.White,
                                style = MaterialTheme.typography.titleMedium,
                            )
                        }
                    }
            }

            scene?.pages?.forEachIndexed { index, page ->
                MetricBadge(text = "Page ${index + 1}: ${page.text.take(26)}")
            }
        }

        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = "Live frame",
            title = previewFrame?.speaker ?: "Narration",
        ) {
            Text(previewFrame?.text.orEmpty(), style = MaterialTheme.typography.bodyLarge)
        }

        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = "Layers",
            title = "Order and placement",
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                scene?.layers
                    ?.sortedByDescending { it.zIndex }
                    ?.forEach { layer ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column {
                                Text(layer.name, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    "x ${"%.2f".format(layer.x)} • y ${"%.2f".format(layer.y)} • z ${layer.zIndex}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.outline,
                                )
                            }
                            Row {
                                IconButton(onClick = { state.nudgeLayerOrder(layer.id, 1) }) {
                                    Icon(Icons.Rounded.ArrowUpward, contentDescription = "Bring forward")
                                }
                                IconButton(onClick = { state.nudgeLayerOrder(layer.id, -1) }) {
                                    Icon(Icons.Rounded.ArrowDownward, contentDescription = "Send backward")
                                }
                            }
                        }
                    }
            }
        }
    }
}

@Composable
private fun VariablesTab(state: StudioStateHolder, project: ProjectDocument) {
    PanelCard(
        modifier = Modifier.fillMaxWidth(),
        eyebrow = "Variables",
        title = "Runtime state inputs",
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            project.variables.forEach { variable ->
                TextField(
                    value = variable.value,
                    onValueChange = { state.updateVariable(variable, it) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(variable.name) },
                    supportingText = { Text(variable.type.name) },
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ManualTab(state: StudioStateHolder, project: ProjectDocument) {
    val files = state.projectFiles()
    val primaryScript = project.scripts.firstOrNull()?.content.orEmpty()
    var luaDraft by remember(project.manifest.id, primaryScript) { mutableStateOf(primaryScript) }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = "File View",
            title = "Project tree",
        ) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                files.forEach { file ->
                    MetricBadge(text = file.path, accent = MaterialTheme.colorScheme.secondary)
                }
            }
        }

        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = "Code View",
            title = "Typed JSON source",
        ) {
            BasicTextField(
                value = state.rawJsonDraft,
                onValueChange = state::updateRawJsonDraft,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 280.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(MaterialTheme.colorScheme.onSurface)
                    .padding(16.dp),
                textStyle = TextStyle(
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.surface,
                ),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = state::applyRawJsonDraft) {
                    Icon(Icons.Rounded.Code, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Apply JSON")
                }
                OutlinedButton(onClick = { state.selectTab(EditorTab.DOCS) }) {
                    Text("Review Docs")
                }
            }
        }

        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = "Lua",
            title = "Manual automation hook",
        ) {
            BasicTextField(
                value = luaDraft,
                onValueChange = { luaDraft = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 180.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(16.dp),
                textStyle = TextStyle(
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurface,
                ),
            )
            Button(onClick = { state.updateLuaScript(luaDraft) }) {
                Text("Save Lua")
            }
        }
    }
}

@Composable
private fun PreviewTab(state: StudioStateHolder, previewFrame: PreviewFrame?) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = "Runtime",
            title = previewFrame?.block?.title ?: "Preview",
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(320.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(previewBackground(previewFrame))
            ) {
                previewFrame?.layers?.sortedBy { it.zIndex }?.forEach { layer ->
                    PreviewLayer(layer = layer)
                }
            }
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.onSurface),
                shape = RoundedCornerShape(22.dp),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = previewFrame?.speaker ?: "Narration",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.secondary,
                    )
                    Text(
                        text = previewFrame?.text.orEmpty(),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.surface,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = state::previewNext) {
                            Icon(Icons.Rounded.PlayArrow, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Next")
                        }
                        OutlinedButton(onClick = state::previewReset) {
                            Text("Restart")
                        }
                    }
                    previewFrame?.choices?.forEach { choice ->
                        OutlinedButton(onClick = { state.previewChoose(choice.id) }) {
                            Text(choice.label)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DocsTab(state: StudioStateHolder) {
    val doc = state.selectedDoc()
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        PanelCard(
            modifier = Modifier.fillMaxWidth(),
            eyebrow = "Docs",
            title = doc?.title ?: "Documentation",
        ) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                state.docs.forEach { bundled ->
                    OutlinedButton(onClick = { state.selectDoc(bundled.name) }) {
                        Text(bundled.title)
                    }
                }
            }
            Text(doc?.body.orEmpty(), style = MaterialTheme.typography.bodyMedium)
        }

        state.activeProject?.notes?.takeIf { it.isNotEmpty() }?.let { notes ->
            PanelCard(
                modifier = Modifier.fillMaxWidth(),
                eyebrow = "Import review",
                title = "Warnings and unsupported features",
            ) {
                notes.forEach { note ->
                    Text("• $note", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun SyncTab(
    state: StudioStateHolder,
    project: ProjectDocument,
    onPushBackup: () -> Unit,
) {
    var url by remember(project.manifest.id, project.manifest.supabaseUrl) { mutableStateOf(project.manifest.supabaseUrl) }
    var key by remember(project.manifest.id, project.manifest.supabaseAnonKey) { mutableStateOf(project.manifest.supabaseAnonKey) }
    var bucket by remember(project.manifest.id, project.manifest.bucketName) { mutableStateOf(project.manifest.bucketName) }

    PanelCard(
        modifier = Modifier.fillMaxWidth(),
        eyebrow = "Sync",
        title = "Supabase and archives",
    ) {
        TextField(value = url, onValueChange = { url = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Supabase URL") })
        TextField(value = key, onValueChange = { key = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Anon key") })
        TextField(value = bucket, onValueChange = { bucket = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Bucket") })
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = { state.updateSupabaseSettings(url, key, bucket) }) {
                Text("Save Config")
            }
            OutlinedButton(onClick = state::exportActiveArchive) {
                Icon(Icons.Rounded.FileOpen, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Export ZIP")
            }
            OutlinedButton(onClick = onPushBackup) {
                Icon(Icons.Rounded.CloudUpload, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Push Backup")
            }
        }
        state.lastArchivePath?.let {
            Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
        }
    }
}

private fun buildConnections(project: ProjectDocument): List<Pair<BlockNode, BlockNode>> {
    val byId = project.blocks.associateBy { it.id }
    return project.blocks.flatMap { block ->
        block.scenes.flatMap { scene ->
            scene.pages.flatMap { page ->
                page.choices.mapNotNull { choice ->
                    val target = byId[choice.targetBlockId] ?: return@mapNotNull null
                    block to target
                }
            }
        }
    }
}

@Composable
private fun previewBackground(previewFrame: PreviewFrame?): Brush {
    val fallback = Brush.linearGradient(
        colors = listOf(
            MaterialTheme.colorScheme.surfaceVariant,
            MaterialTheme.colorScheme.surface,
        )
    )
    val layerColor = previewFrame?.layers?.firstOrNull()?.colorHex ?: return fallback
    return Brush.linearGradient(
        colors = listOf(
            Color(android.graphics.Color.parseColor(layerColor)),
            MaterialTheme.colorScheme.surface,
        )
    )
}

@Composable
private fun PreviewLayer(layer: LayerNode) {
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val color = layer.colorHex?.let { Color(android.graphics.Color.parseColor(it)) }
            ?: MaterialTheme.colorScheme.secondary
        Box(
            modifier = Modifier
                .offset {
                    IntOffset(
                        (layer.x * constraints.maxWidth.toFloat()).roundToInt(),
                        (layer.y * constraints.maxHeight.toFloat()).roundToInt(),
                    )
                }
                .width((maxWidth * layer.width).coerceAtLeast(42.dp))
                .height((maxHeight * layer.height).coerceAtLeast(42.dp))
                .clip(RoundedCornerShape(18.dp))
                .background(color.copy(alpha = layer.alpha))
                .padding(10.dp)
        ) {
            Text(layer.name, color = Color.White, style = MaterialTheme.typography.labelSmall)
        }
    }
}
