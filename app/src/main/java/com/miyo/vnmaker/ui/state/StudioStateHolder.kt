package com.miyo.vnmaker.ui.state

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.miyo.vnmaker.data.io.BundledDocsRepository
import com.miyo.vnmaker.data.io.ProjectArchiveManager
import com.miyo.vnmaker.data.io.ProjectJson
import com.miyo.vnmaker.data.io.ProjectRepository
import com.miyo.vnmaker.data.io.TuesdayJsImporter
import com.miyo.vnmaker.data.model.AuthoringMode
import com.miyo.vnmaker.data.model.BlockNode
import com.miyo.vnmaker.data.model.BundledDoc
import com.miyo.vnmaker.data.model.DialoguePage
import com.miyo.vnmaker.data.model.LayerKind
import com.miyo.vnmaker.data.model.LayerNode
import com.miyo.vnmaker.data.model.LuaScript
import com.miyo.vnmaker.data.model.ProjectDocument
import com.miyo.vnmaker.data.model.ProjectFileNode
import com.miyo.vnmaker.data.model.SceneNode
import com.miyo.vnmaker.data.model.VariableDef
import com.miyo.vnmaker.data.runtime.LuaScriptEngine
import com.miyo.vnmaker.data.runtime.NativeBridge
import com.miyo.vnmaker.data.runtime.PreviewFrame
import com.miyo.vnmaker.data.runtime.PreviewRuntime
import com.miyo.vnmaker.data.runtime.ProjectFileTreeBuilder
import com.miyo.vnmaker.data.runtime.RuntimeSnapshot
import com.miyo.vnmaker.data.sync.SupabaseSyncService
import java.util.UUID

enum class EditorTab {
    OVERVIEW,
    GRAPH,
    SCENE,
    VARIABLES,
    MANUAL,
    PREVIEW,
    DOCS,
    SYNC,
}

class StudioStateHolder(appContext: Context) {

    private val context = appContext.applicationContext
    private val archiveManager = ProjectArchiveManager(context)
    private val repository = ProjectRepository(context, archiveManager, TuesdayJsImporter())
    private val docsRepository = BundledDocsRepository(context)
    private val runtime = PreviewRuntime(NativeBridge(), LuaScriptEngine())
    private val syncService = SupabaseSyncService()

    var projects by mutableStateOf<List<ProjectDocument>>(emptyList())
        private set
    var activeProject by mutableStateOf<ProjectDocument?>(null)
        private set
    var docs by mutableStateOf<List<BundledDoc>>(emptyList())
        private set
    var selectedBlockId by mutableStateOf<String?>(null)
        private set
    var selectedSceneId by mutableStateOf<String?>(null)
        private set
    var selectedDocName by mutableStateOf<String?>(null)
        private set
    var selectedTab by mutableStateOf(EditorTab.OVERVIEW)
    var rawJsonDraft by mutableStateOf("")
        private set
    var syncStatus by mutableStateOf("Ready")
        private set
    var previewSnapshot by mutableStateOf<RuntimeSnapshot?>(null)
        private set
    var lastArchivePath by mutableStateOf<String?>(null)
        private set

    init {
        boot()
    }

    fun boot() {
        docs = docsRepository.loadDocs()
        selectedDocName = docs.firstOrNull()?.name
        repository.ensureSeeded()
        projects = repository.listProjects()
        if (activeProject == null) {
            projects.firstOrNull()?.let(::setActiveProject)
        }
    }

    fun createProject() {
        val project = repository.createFromTemplate("Project ${projects.size + 1}")
        setActiveProject(project)
        syncStatus = "Created ${project.manifest.title}"
    }

    fun importBundledTuesdaySample() {
        val raw = context.assets.open("templates/tuesday-sample.json").bufferedReader().use { it.readText() }
        val imported = repository.importTuesdayJson(raw)
        setActiveProject(imported)
        selectedTab = EditorTab.MANUAL
        syncStatus = "Imported Tuesday JS sample"
    }

    fun openProject(projectId: String) {
        repository.loadProject(projectId)?.let(::setActiveProject)
    }

    fun closeProject() {
        activeProject = null
        selectedBlockId = null
        selectedSceneId = null
        previewSnapshot = null
    }

    fun selectTab(tab: EditorTab) {
        selectedTab = tab
    }

    fun selectBlock(blockId: String) {
        selectedBlockId = blockId
        selectedSceneId = selectedBlock()?.scenes?.firstOrNull()?.id
    }

    fun selectScene(sceneId: String) {
        selectedSceneId = sceneId
    }

    fun selectDoc(name: String) {
        selectedDocName = name
    }

    fun setMode(mode: AuthoringMode) {
        mutateProject { project ->
            project.copy(
                manifest = project.manifest.copy(mode = mode)
            )
        }
    }

    fun updateRawJsonDraft(value: String) {
        rawJsonDraft = value
    }

    fun applyRawJsonDraft() {
        runCatching {
            val decoded = ProjectJson.decode(rawJsonDraft)
            repository.save(decoded)
            setActiveProject(decoded)
            syncStatus = "Applied manual JSON changes"
        }.onFailure {
            syncStatus = "JSON apply failed: ${it.message}"
        }
    }

    fun updateVariable(variable: VariableDef, value: String) {
        mutateProject { project ->
            project.copy(
                variables = project.variables.map {
                    if (it.name == variable.name) it.copy(value = value) else it
                }
            )
        }
    }

    fun updateBlockPosition(blockId: String, deltaX: Float, deltaY: Float) {
        mutateProject { project ->
            project.copy(
                blocks = project.blocks.map { block ->
                    if (block.id == blockId) {
                        block.copy(
                            positionX = block.positionX + deltaX,
                            positionY = block.positionY + deltaY,
                        )
                    } else {
                        block
                    }
                }
            )
        }
    }

    fun addBlock() {
        mutateProject { project ->
            val index = project.blocks.size + 1
            val blockId = "block-$index"
            project.copy(
                blocks = project.blocks + BlockNode(
                    id = blockId,
                    title = "Block $index",
                    colorHex = if (index % 2 == 0) "#3E6B6F" else "#C65D3A",
                    positionX = 180f + (index * 80f),
                    positionY = 180f + (index * 42f),
                    scenes = listOf(
                        SceneNode(
                            id = "$blockId-scene-1",
                            title = "Scene 1",
                            pages = listOf(
                                DialoguePage(
                                    id = "$blockId-page-1",
                                    text = "New page"
                                )
                            )
                        )
                    )
                )
            )
        }
    }

    fun addPage() {
        updateSelectedScene { scene ->
            val nextIndex = scene.pages.size + 1
            scene.copy(
                pages = scene.pages + DialoguePage(
                    id = "${scene.id}-page-$nextIndex",
                    text = "Page $nextIndex",
                )
            )
        }
    }

    fun updateCurrentPageText(text: String) {
        val pageIndex = previewSnapshot?.currentPageIndex ?: 0
        updateSelectedScene { scene ->
            scene.copy(
                pages = scene.pages.mapIndexed { index, page ->
                    if (index == pageIndex) page.copy(text = text) else page
                }
            )
        }
    }

    fun addLayer(kind: LayerKind) {
        updateSelectedScene { scene ->
            scene.copy(
                layers = scene.layers + LayerNode(
                    id = "layer-${UUID.randomUUID()}",
                    name = if (kind == LayerKind.BACKGROUND) "New Background" else "New Sprite",
                    kind = kind,
                    colorHex = if (kind == LayerKind.BACKGROUND) "#D6B79B" else "#3E6B6F",
                    x = if (kind == LayerKind.BACKGROUND) 0f else 0.35f,
                    y = if (kind == LayerKind.BACKGROUND) 0f else 0.16f,
                    width = if (kind == LayerKind.BACKGROUND) 1f else 0.24f,
                    height = if (kind == LayerKind.BACKGROUND) 1f else 0.58f,
                    zIndex = scene.layers.maxOfOrNull { it.zIndex }?.plus(1) ?: 1,
                )
            )
        }
    }

    fun moveLayer(layerId: String, deltaX: Float, deltaY: Float) {
        updateSelectedScene { scene ->
            scene.copy(
                layers = scene.layers.map { layer ->
                    if (layer.id == layerId) {
                        layer.copy(
                            x = (layer.x + deltaX).coerceIn(-0.2f, 1.2f),
                            y = (layer.y + deltaY).coerceIn(-0.2f, 1.2f),
                        )
                    } else {
                        layer
                    }
                }
            )
        }
    }

    fun nudgeLayerOrder(layerId: String, delta: Int) {
        updateSelectedScene { scene ->
            scene.copy(
                layers = scene.layers.map { layer ->
                    if (layer.id == layerId) {
                        layer.copy(zIndex = (layer.zIndex + delta).coerceAtLeast(0))
                    } else {
                        layer
                    }
                }
            )
        }
    }

    fun updateLuaScript(content: String) {
        mutateProject { project ->
            val script = project.scripts.firstOrNull()
                ?: LuaScript(id = "global", name = "global.lua", content = content)
            project.copy(
                scripts = listOf(script.copy(content = content))
            )
        }
    }

    fun updateSupabaseSettings(url: String, anonKey: String, bucketName: String) {
        mutateProject { project ->
            project.copy(
                manifest = project.manifest.copy(
                    supabaseUrl = url,
                    supabaseAnonKey = anonKey,
                    bucketName = bucketName,
                )
            )
        }
    }

    fun previewReset() {
        val project = activeProject ?: return
        previewSnapshot = runtime.bootstrap(project)
    }

    fun previewNext() {
        val project = activeProject ?: return
        val snapshot = previewSnapshot ?: runtime.bootstrap(project)
        previewSnapshot = runtime.next(project, snapshot)
    }

    fun previewChoose(choiceId: String) {
        val project = activeProject ?: return
        val snapshot = previewSnapshot ?: runtime.bootstrap(project)
        val choice = currentFrame()?.choices?.firstOrNull { it.id == choiceId } ?: return
        previewSnapshot = runtime.applyChoice(project, snapshot, choice)
    }

    fun jumpToBlock(blockId: String) {
        val project = activeProject ?: return
        val snapshot = previewSnapshot ?: runtime.bootstrap(project)
        previewSnapshot = runtime.jumpToBlock(project, snapshot, blockId)
        selectBlock(blockId)
    }

    fun currentFrame(): PreviewFrame? {
        val project = activeProject ?: return null
        val snapshot = previewSnapshot ?: runtime.bootstrap(project).also { previewSnapshot = it }
        return runtime.currentFrame(project, snapshot)
    }

    fun projectFiles(): List<ProjectFileNode> {
        val project = activeProject ?: return emptyList()
        return ProjectFileTreeBuilder.build(project)
    }

    fun selectedBlock(): BlockNode? {
        val project = activeProject ?: return null
        return project.blocks.firstOrNull { it.id == selectedBlockId } ?: project.blocks.firstOrNull()
    }

    fun selectedScene(): SceneNode? {
        val block = selectedBlock() ?: return null
        return block.scenes.firstOrNull { it.id == selectedSceneId } ?: block.scenes.firstOrNull()
    }

    fun selectedDoc(): BundledDoc? {
        return docs.firstOrNull { it.name == selectedDocName } ?: docs.firstOrNull()
    }

    fun exportActiveArchive() {
        val project = activeProject ?: return
        val file = repository.exportArchive(project)
        lastArchivePath = file.absolutePath
        syncStatus = "Exported ZIP to ${file.absolutePath}"
    }

    suspend fun pushBackup() {
        val project = activeProject ?: return
        val archive = repository.exportArchive(project)
        val result = syncService.uploadProject(project, archive.readBytes())
        syncStatus = result.fold(
            onSuccess = { "Uploaded backup to ${it.archivePath}" },
            onFailure = { "Backup failed: ${it.message}" },
        )
    }

    private fun setActiveProject(project: ProjectDocument) {
        activeProject = project
        projects = repository.listProjects()
        selectedBlockId = project.blocks.firstOrNull()?.id
        selectedSceneId = project.blocks.firstOrNull()?.scenes?.firstOrNull()?.id
        rawJsonDraft = ProjectJson.encode(project)
        previewSnapshot = runtime.bootstrap(project)
    }

    private inline fun mutateProject(transform: (ProjectDocument) -> ProjectDocument) {
        val current = activeProject ?: return
        val preservedBlockId = selectedBlockId
        val preservedSceneId = selectedSceneId
        val updated = transform(current)
        repository.save(updated)
        activeProject = updated
        projects = repository.listProjects()
        selectedBlockId = updated.blocks.firstOrNull { it.id == preservedBlockId }?.id ?: updated.blocks.firstOrNull()?.id
        selectedSceneId = selectedBlock()?.scenes?.firstOrNull { it.id == preservedSceneId }?.id ?: selectedBlock()?.scenes?.firstOrNull()?.id
        rawJsonDraft = ProjectJson.encode(updated)
        previewSnapshot = runtime.bootstrap(updated)
    }

    private inline fun updateSelectedScene(transform: (SceneNode) -> SceneNode) {
        val blockId = selectedBlockId ?: return
        val sceneId = selectedSceneId ?: return
        mutateProject { project ->
            project.copy(
                blocks = project.blocks.map { block ->
                    if (block.id == blockId) {
                        block.copy(
                            scenes = block.scenes.map { scene ->
                                if (scene.id == sceneId) transform(scene) else scene
                            }
                        )
                    } else {
                        block
                    }
                }
            )
        }
    }
}
