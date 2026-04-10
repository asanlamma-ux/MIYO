package com.miyo.vnmaker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class ProjectDocument(
    val manifest: ProjectManifest,
    val variables: List<VariableDef>,
    val characters: List<CharacterDef>,
    val blocks: List<BlockNode>,
    val scripts: List<LuaScript>,
    val notes: List<String> = emptyList(),
)

@Serializable
data class ProjectManifest(
    val id: String,
    val title: String,
    val description: String = "",
    val defaultLanguage: String = "en",
    val languages: List<String> = listOf("en"),
    val lastEditedEpochMillis: Long,
    val themeName: String = "studio-light",
    val entryBlockId: String,
    val mode: AuthoringMode = AuthoringMode.EASY,
    val supabaseUrl: String = "",
    val supabaseAnonKey: String = "",
    val bucketName: String = "project-archives",
)

@Serializable
enum class AuthoringMode {
    EASY,
    MANUAL,
}

@Serializable
data class VariableDef(
    val name: String,
    val type: VariableType,
    val value: String,
)

@Serializable
enum class VariableType {
    STRING,
    INT,
    FLOAT,
    BOOL,
}

@Serializable
data class CharacterDef(
    val id: String,
    val name: String,
    val accent: String = "#C65D3A",
)

@Serializable
data class BlockNode(
    val id: String,
    val title: String,
    val colorHex: String = "#C65D3A",
    val positionX: Float = 0f,
    val positionY: Float = 0f,
    val scenes: List<SceneNode> = emptyList(),
)

@Serializable
data class SceneNode(
    val id: String,
    val title: String,
    val backgroundColorHex: String = "#F3EEE6",
    val layers: List<LayerNode> = emptyList(),
    val pages: List<DialoguePage> = emptyList(),
)

@Serializable
data class LayerNode(
    val id: String,
    val name: String,
    val kind: LayerKind,
    val assetPath: String? = null,
    val colorHex: String? = null,
    val x: Float = 0f,
    val y: Float = 0f,
    val width: Float = 1f,
    val height: Float = 1f,
    val zIndex: Int = 0,
    val alpha: Float = 1f,
    val pageIndex: Int = -1,
)

@Serializable
enum class LayerKind {
    BACKGROUND,
    SPRITE,
    OVERLAY,
}

@Serializable
data class DialoguePage(
    val id: String,
    val speakerId: String? = null,
    val text: String,
    val choices: List<ChoiceNode> = emptyList(),
)

@Serializable
data class ChoiceNode(
    val id: String,
    val label: String,
    val targetBlockId: String,
    val condition: ConditionNode? = null,
    val mutations: List<VariableMutation> = emptyList(),
)

@Serializable
data class ConditionNode(
    val variableName: String,
    val operation: String,
    val expectedValue: String,
)

@Serializable
data class VariableMutation(
    val variableName: String,
    val operation: MutationOperation,
    val value: String,
)

@Serializable
enum class MutationOperation {
    SET,
    ADD,
    SUBTRACT,
    TOGGLE,
}

@Serializable
data class LuaScript(
    val id: String,
    val name: String,
    val content: String,
)

data class BundledDoc(
    val name: String,
    val title: String,
    val body: String,
)

data class ProjectFileNode(
    val path: String,
    val label: String,
)

data class TuesdayImportResult(
    val project: ProjectDocument,
    val warnings: List<String>,
)

