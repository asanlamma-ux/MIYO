package com.miyo.vnmaker.data.io

import com.miyo.vnmaker.data.model.AuthoringMode
import com.miyo.vnmaker.data.model.BlockNode
import com.miyo.vnmaker.data.model.CharacterDef
import com.miyo.vnmaker.data.model.ChoiceNode
import com.miyo.vnmaker.data.model.ConditionNode
import com.miyo.vnmaker.data.model.DialoguePage
import com.miyo.vnmaker.data.model.LayerKind
import com.miyo.vnmaker.data.model.LayerNode
import com.miyo.vnmaker.data.model.LuaScript
import com.miyo.vnmaker.data.model.MutationOperation
import com.miyo.vnmaker.data.model.ProjectDocument
import com.miyo.vnmaker.data.model.ProjectManifest
import com.miyo.vnmaker.data.model.SceneNode
import com.miyo.vnmaker.data.model.TuesdayImportResult
import com.miyo.vnmaker.data.model.VariableDef
import com.miyo.vnmaker.data.model.VariableMutation
import com.miyo.vnmaker.data.model.VariableType
import java.util.UUID
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class TuesdayJsImporter {

    private val json = Json { ignoreUnknownKeys = true }

    fun import(raw: String): TuesdayImportResult {
        val root = json.parseToJsonElement(raw).jsonObject
        val parameters = root["parameters"]?.jsonObject ?: JsonObject(emptyMap())
        val blocksMeta = root["blocks"]?.jsonObject ?: JsonObject(emptyMap())
        val warnings = mutableListOf<String>()
        val languages = parameters["languares"]?.jsonArray?.mapNotNull { it.stringOrNull() }.orEmpty().ifEmpty { listOf("en") }
        val title = parameters["title"].textValue(languages.first()) ?: "Imported Tuesday Project"
        val entryBlockId = parameters["launch_story"]?.stringOrNull()
            ?: root.keys.firstOrNull { it != "parameters" && it != "blocks" }
            ?: "block_1"

        val variables = parameters["variables"]?.jsonObject.orEmpty().map { (key, value) ->
            VariableDef(
                name = key,
                type = inferVariableType(value),
                value = value.primitiveString(),
            )
        }

        val characterNames = linkedSetOf<String>()
        val blockNodes = root
            .filterKeys { it != "parameters" && it != "blocks" }
            .mapNotNull { (blockId, element) ->
                if (element !is JsonArray) return@mapNotNull null
                val blockPosition = blocksMeta[blockId]?.jsonArray
                val scenes = element.mapIndexed { sceneIndex, sceneElement ->
                    val scene = sceneElement.jsonObject
                    val pages = scene["dialogs"]?.jsonArray?.mapIndexed { pageIndex, pageElement ->
                        val dialog = pageElement.jsonObject
                        val speaker = dialog["name"]?.textValue(languages.first())
                        speaker?.let(characterNames::add)
                        if (dialog["html"] != null) {
                            warnings += "HTML content in $blockId/$sceneIndex/$pageIndex requires manual review."
                        }
                        if (dialog["js"] != null) {
                            warnings += "JavaScript content in $blockId/$sceneIndex/$pageIndex was not executed and was preserved as a warning."
                        }
                        DialoguePage(
                            id = "$blockId-scene-$sceneIndex-page-$pageIndex",
                            speakerId = speaker?.slug(),
                            text = dialog["text"].textValue(languages.first()) ?: dialog["html"]?.stringOrNull() ?: "...",
                            choices = dialog["choice"]?.jsonArray?.mapIndexed { choiceIndex, choiceElement ->
                                val choice = choiceElement.jsonObject
                                ChoiceNode(
                                    id = "$blockId-scene-$sceneIndex-page-$pageIndex-choice-$choiceIndex",
                                    label = choice["text"].textValue(languages.first()) ?: "Choice ${choiceIndex + 1}",
                                    targetBlockId = choice["go_to"]?.stringOrNull() ?: blockId,
                                    condition = null,
                                    mutations = choice["variables"]?.toMutations().orEmpty(),
                                )
                            }.orEmpty(),
                        )
                    }.orEmpty()

                    val layers = buildList {
                        val backgroundValue = scene["background_image"]?.textValue(languages.first())
                        if (!backgroundValue.isNullOrBlank()) {
                            add(
                                LayerNode(
                                    id = "$blockId-scene-$sceneIndex-background",
                                    name = "Imported Background",
                                    kind = LayerKind.BACKGROUND,
                                    assetPath = backgroundValue,
                                    x = 0f,
                                    y = 0f,
                                    width = 1f,
                                    height = 1f,
                                )
                            )
                        }
                    }

                    SceneNode(
                        id = "$blockId-scene-$sceneIndex",
                        title = "Scene ${sceneIndex + 1}",
                        backgroundColorHex = scene["background_color"]?.stringOrNull() ?: "#F3EEE6",
                        layers = layers,
                        pages = pages,
                    )
                }

                BlockNode(
                    id = blockId,
                    title = blockId.replace('_', ' ').replaceFirstChar { it.uppercase() },
                    colorHex = "#C65D3A",
                    positionX = blockPosition?.getOrNull(0)?.primitiveFloat() ?: 120f,
                    positionY = blockPosition?.getOrNull(1)?.primitiveFloat() ?: 120f,
                    scenes = scenes,
                )
            }

        if (parameters["plugins"] != null) {
            warnings += "Tuesday JS plugins require manual migration."
        }

        val characters = characterNames.map { name ->
            CharacterDef(
                id = name.slug(),
                name = name,
            )
        }

        val project = ProjectDocument(
            manifest = ProjectManifest(
                id = "tuesday-${UUID.randomUUID()}",
                title = title,
                description = "Imported from Tuesday JS",
                defaultLanguage = languages.first(),
                languages = languages,
                lastEditedEpochMillis = System.currentTimeMillis(),
                entryBlockId = entryBlockId,
                mode = AuthoringMode.MANUAL,
            ),
            variables = variables,
            characters = characters,
            blocks = blockNodes,
            scripts = listOf(
                LuaScript(
                    id = "global",
                    name = "global.lua",
                    content = "-- Review imported warnings before automating logic.\nfunction on_page()\n  return nil\nend\n",
                )
            ),
            notes = warnings,
        )
        return TuesdayImportResult(project = project, warnings = warnings)
    }

    private fun inferVariableType(element: JsonElement): VariableType {
        val primitive = element as? JsonPrimitive ?: return VariableType.STRING
        return when {
            primitive.booleanOrNull != null -> VariableType.BOOL
            primitive.doubleOrNull != null -> {
                if (primitive.content.contains('.')) VariableType.FLOAT else VariableType.INT
            }
            else -> VariableType.STRING
        }
    }

    private fun JsonElement?.textValue(language: String): String? {
        return when (this) {
            null -> null
            is JsonPrimitive -> content
            is JsonObject -> this[language]?.stringOrNull() ?: this.values.firstOrNull()?.stringOrNull()
            else -> null
        }
    }

    private fun JsonElement?.toMutations(): List<VariableMutation> {
        return this?.jsonArray?.mapNotNull { item ->
            val triple = item.jsonArray
            val name = triple.getOrNull(0)?.stringOrNull() ?: return@mapNotNull null
            val operation = triple.getOrNull(1)?.stringOrNull()?.lowercase()
            val value = triple.getOrNull(2)?.primitiveString() ?: "0"
            VariableMutation(
                variableName = name,
                operation = when (operation) {
                    "+", "add" -> MutationOperation.ADD
                    "-", "sub", "subtract" -> MutationOperation.SUBTRACT
                    "toggle" -> MutationOperation.TOGGLE
                    else -> MutationOperation.SET
                },
                value = value,
            )
        }.orEmpty()
    }

    private fun JsonElement?.stringOrNull(): String? = (this as? JsonPrimitive)?.contentOrNull

    private fun JsonElement?.primitiveString(): String = (this as? JsonPrimitive)?.content ?: ""

    private fun JsonElement?.primitiveFloat(): Float? {
        val raw = (this as? JsonPrimitive)?.content ?: return null
        return raw.filter { it.isDigit() || it == '.' || it == '-' }.toFloatOrNull()
    }

    private fun String.slug(): String = lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
}
