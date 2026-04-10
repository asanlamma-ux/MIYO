package com.miyo.vnmaker.data.sync

import com.miyo.vnmaker.data.model.ProjectDocument
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType

data class BackupDescriptor(
    val projectId: String,
    val archivePath: String,
    val syncedAt: Long,
)

class SupabaseSyncService {

    private val client = HttpClient()

    suspend fun uploadProject(project: ProjectDocument, archiveBytes: ByteArray): Result<BackupDescriptor> = runCatching {
        require(project.manifest.supabaseUrl.isNotBlank()) { "Supabase URL is missing" }
        require(project.manifest.supabaseAnonKey.isNotBlank()) { "Supabase anon key is missing" }

        val baseUrl = project.manifest.supabaseUrl.trimEnd('/')
        val archivePath = "${project.manifest.id}/current.zip"

        client.put("$baseUrl/storage/v1/object/${project.manifest.bucketName}/$archivePath") {
            header("apikey", project.manifest.supabaseAnonKey)
            header("Authorization", "Bearer ${project.manifest.supabaseAnonKey}")
            contentType(ContentType.Application.OctetStream)
            setBody(archiveBytes)
        }

        val escapedTitle = project.manifest.title.replace("\"", "\\\"")
        val metadata = """
            {
              "project_id": "${project.manifest.id}",
              "title": "$escapedTitle",
              "archive_path": "$archivePath",
              "schema_version": 1
            }
        """.trimIndent()

        client.post("$baseUrl/rest/v1/project_backups") {
            header("apikey", project.manifest.supabaseAnonKey)
            header("Authorization", "Bearer ${project.manifest.supabaseAnonKey}")
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            setBody(metadata)
        }

        BackupDescriptor(
            projectId = project.manifest.id,
            archivePath = archivePath,
            syncedAt = System.currentTimeMillis(),
        )
    }

    suspend fun fetchBackupManifest(project: ProjectDocument): Result<String> = runCatching {
        require(project.manifest.supabaseUrl.isNotBlank()) { "Supabase URL is missing" }
        require(project.manifest.supabaseAnonKey.isNotBlank()) { "Supabase anon key is missing" }

        client.get("${project.manifest.supabaseUrl.trimEnd('/')}/rest/v1/project_backups?project_id=eq.${project.manifest.id}&select=*") {
            header("apikey", project.manifest.supabaseAnonKey)
            header("Authorization", "Bearer ${project.manifest.supabaseAnonKey}")
        }.bodyAsText()
    }
}
