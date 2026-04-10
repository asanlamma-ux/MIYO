package com.miyo.vnmaker.data.io

import android.content.Context
import com.miyo.vnmaker.data.model.ProjectDocument
import java.io.File
import net.lingala.zip4j.ZipFile

class ProjectArchiveManager(private val context: Context) {

    fun export(project: ProjectDocument): File {
        val exportsDir = File(context.filesDir, "exports").apply { mkdirs() }
        val workingDir = File(exportsDir, project.manifest.id).apply {
            deleteRecursively()
            mkdirs()
        }
        val jsonFile = File(workingDir, "project.json")
        jsonFile.writeText(ProjectJson.encode(project))

        val archive = File(exportsDir, "${project.manifest.id}.zip")
        if (archive.exists()) archive.delete()
        ZipFile(archive).addFolder(workingDir)
        workingDir.deleteRecursively()
        return archive
    }

    fun importArchive(archive: File): ProjectDocument {
        val importsDir = File(context.cacheDir, "imports").apply { mkdirs() }
        val workingDir = File(importsDir, archive.nameWithoutExtension).apply {
            deleteRecursively()
            mkdirs()
        }
        ZipFile(archive).extractAll(workingDir.absolutePath)
        val projectFile = workingDir.walkTopDown().firstOrNull { it.isFile && it.name == "project.json" }
            ?: error("Archive does not contain project.json")
        return ProjectJson.decode(projectFile.readText())
    }
}

