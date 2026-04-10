package com.miyo.vnmaker.data.io

import android.content.Context
import com.miyo.vnmaker.data.model.ProjectDocument
import java.io.File
import java.util.UUID

class ProjectRepository(
    private val context: Context,
    private val archiveManager: ProjectArchiveManager,
    private val importer: TuesdayJsImporter,
) {

    private val projectsDir = File(context.filesDir, "projects").apply { mkdirs() }

    fun ensureSeeded() {
        if (projectsDir.listFiles().isNullOrEmpty()) {
            val starter = context.assets.open("templates/starter-project.json").bufferedReader().use { it.readText() }
            val project = ProjectJson.decode(starter)
            save(project)
        }
    }

    fun listProjects(): List<ProjectDocument> {
        ensureSeeded()
        return projectsDir.listFiles()
            .orEmpty()
            .filter { it.isFile && it.extension == "json" }
            .map { ProjectJson.decode(it.readText()) }
            .sortedByDescending { it.manifest.lastEditedEpochMillis }
    }

    fun loadProject(projectId: String): ProjectDocument? {
        val file = File(projectsDir, "$projectId.json")
        return if (file.exists()) ProjectJson.decode(file.readText()) else null
    }

    fun save(project: ProjectDocument) {
        val updated = project.copy(
            manifest = project.manifest.copy(
                lastEditedEpochMillis = System.currentTimeMillis(),
            )
        )
        File(projectsDir, "${updated.manifest.id}.json").writeText(ProjectJson.encode(updated))
    }

    fun createFromTemplate(title: String = "New Project"): ProjectDocument {
        val starter = context.assets.open("templates/starter-project.json").bufferedReader().use { it.readText() }
        val project = ProjectJson.decode(starter)
        val cloned = project.copy(
            manifest = project.manifest.copy(
                id = "project-${UUID.randomUUID()}",
                title = title,
                lastEditedEpochMillis = System.currentTimeMillis(),
            )
        )
        save(cloned)
        return cloned
    }

    fun importTuesdayJson(raw: String): ProjectDocument {
        val imported = importer.import(raw).project
        save(imported)
        return imported
    }

    fun exportArchive(project: ProjectDocument): File {
        save(project)
        return archiveManager.export(project)
    }

    fun importArchive(file: File): ProjectDocument {
        val imported = archiveManager.importArchive(file)
        save(imported)
        return imported
    }
}

