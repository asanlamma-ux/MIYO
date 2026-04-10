package com.miyo.vnmaker.data.runtime

import com.miyo.vnmaker.data.model.BlockNode
import com.miyo.vnmaker.data.model.ChoiceNode
import com.miyo.vnmaker.data.model.ConditionNode
import com.miyo.vnmaker.data.model.DialoguePage
import com.miyo.vnmaker.data.model.LayerNode
import com.miyo.vnmaker.data.model.MutationOperation
import com.miyo.vnmaker.data.model.ProjectDocument
import com.miyo.vnmaker.data.model.VariableMutation

data class RuntimeSnapshot(
    val currentBlockId: String,
    val currentSceneIndex: Int,
    val currentPageIndex: Int,
    val variables: Map<String, String>,
)

data class PreviewFrame(
    val block: BlockNode,
    val page: DialoguePage,
    val speaker: String?,
    val text: String,
    val layers: List<LayerNode>,
    val choices: List<ChoiceNode>,
    val variables: Map<String, String>,
)

class PreviewRuntime(
    private val nativeBridge: NativeBridge,
    private val luaScriptEngine: LuaScriptEngine,
) {

    fun bootstrap(project: ProjectDocument): RuntimeSnapshot {
        val vars = project.variables.associate { it.name to it.value }
        val initial = RuntimeSnapshot(
            currentBlockId = project.manifest.entryBlockId,
            currentSceneIndex = 0,
            currentPageIndex = 0,
            variables = vars,
        )
        return applyScripts(project, initial)
    }

    fun currentFrame(project: ProjectDocument, snapshot: RuntimeSnapshot): PreviewFrame {
        val block = project.blocks.firstOrNull { it.id == snapshot.currentBlockId } ?: project.blocks.first()
        val scene = block.scenes.getOrElse(snapshot.currentSceneIndex) { block.scenes.first() }
        val page = scene.pages.getOrElse(snapshot.currentPageIndex) { scene.pages.first() }
        val speaker = page.speakerId?.let { speakerId -> project.characters.firstOrNull { it.id == speakerId }?.name }
        val text = nativeBridge.interpolateTemplate(
            page.text,
            snapshot.variables.keys.toTypedArray(),
            snapshot.variables.values.toTypedArray(),
        )
        val visibleLayers = scene.layers
            .filter { it.pageIndex == -1 || it.pageIndex == snapshot.currentPageIndex }
            .sortedBy { it.zIndex }
        val visibleChoices = page.choices.filter { choice ->
            choice.condition?.let { evaluateCondition(it, snapshot.variables) } ?: true
        }
        return PreviewFrame(
            block = block,
            page = page,
            speaker = speaker,
            text = text,
            layers = visibleLayers,
            choices = visibleChoices,
            variables = snapshot.variables,
        )
    }

    fun next(project: ProjectDocument, snapshot: RuntimeSnapshot): RuntimeSnapshot {
        val frame = currentFrame(project, snapshot)
        if (frame.choices.isNotEmpty()) return snapshot
        val block = frame.block
        val scene = block.scenes[snapshot.currentSceneIndex]
        return if (snapshot.currentPageIndex + 1 < scene.pages.size) {
            applyScripts(
                project,
                snapshot.copy(currentPageIndex = snapshot.currentPageIndex + 1),
            )
        } else {
            snapshot
        }
    }

    fun applyChoice(project: ProjectDocument, snapshot: RuntimeSnapshot, choice: ChoiceNode): RuntimeSnapshot {
        val mutated = snapshot.variables.toMutableMap()
        choice.mutations.forEach { mutation ->
            applyMutation(mutated, mutation)
        }
        val advanced = RuntimeSnapshot(
            currentBlockId = choice.targetBlockId,
            currentSceneIndex = 0,
            currentPageIndex = 0,
            variables = mutated,
        )
        return applyScripts(project, advanced)
    }

    fun jumpToBlock(project: ProjectDocument, snapshot: RuntimeSnapshot, blockId: String): RuntimeSnapshot {
        val next = snapshot.copy(
            currentBlockId = blockId,
            currentSceneIndex = 0,
            currentPageIndex = 0,
        )
        return applyScripts(project, next)
    }

    private fun applyScripts(project: ProjectDocument, snapshot: RuntimeSnapshot): RuntimeSnapshot {
        val variables = snapshot.variables.toMutableMap()
        val targetBlockId = luaScriptEngine.runPageHooks(project.scripts, variables)
        return if (targetBlockId.isNullOrBlank()) {
            snapshot.copy(variables = variables)
        } else {
            snapshot.copy(
                currentBlockId = targetBlockId,
                currentSceneIndex = 0,
                currentPageIndex = 0,
                variables = variables,
            )
        }
    }

    private fun evaluateCondition(condition: ConditionNode, variables: Map<String, String>): Boolean {
        val actual = variables[condition.variableName].orEmpty()
        return nativeBridge.evaluateComparison(actual, condition.operation, condition.expectedValue)
    }

    private fun applyMutation(variables: MutableMap<String, String>, mutation: VariableMutation) {
        val current = variables[mutation.variableName].orEmpty()
        variables[mutation.variableName] = when (mutation.operation) {
            MutationOperation.SET -> mutation.value
            MutationOperation.TOGGLE -> (!(current == "true")).toString()
            MutationOperation.ADD -> ((current.toDoubleOrNull() ?: 0.0) + (mutation.value.toDoubleOrNull() ?: 0.0)).cleanNumber()
            MutationOperation.SUBTRACT -> ((current.toDoubleOrNull() ?: 0.0) - (mutation.value.toDoubleOrNull() ?: 0.0)).cleanNumber()
        }
    }

    private fun Double.cleanNumber(): String {
        return if (this % 1.0 == 0.0) toInt().toString() else toString()
    }
}

