package com.miyo.vnmaker.data.runtime

import com.miyo.vnmaker.data.model.ProjectDocument
import com.miyo.vnmaker.data.model.ProjectFileNode

object ProjectFileTreeBuilder {

    fun build(project: ProjectDocument): List<ProjectFileNode> {
        val result = mutableListOf<ProjectFileNode>()
        result += ProjectFileNode("manifest.json", "Manifest")
        result += ProjectFileNode("variables.json", "Variables")
        result += ProjectFileNode("characters.json", "Characters")
        project.blocks.forEach { block ->
            result += ProjectFileNode("story/${block.id}.json", block.title)
        }
        project.scripts.forEach { script ->
            result += ProjectFileNode("scripts/${script.name}", script.name)
        }
        if (project.notes.isNotEmpty()) {
            result += ProjectFileNode("notes/import-review.md", "Import Review")
        }
        return result
    }
}

