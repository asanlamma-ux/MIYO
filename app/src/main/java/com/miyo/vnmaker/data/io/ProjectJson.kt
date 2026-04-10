package com.miyo.vnmaker.data.io

import com.miyo.vnmaker.data.model.ProjectDocument
import kotlinx.serialization.json.Json

object ProjectJson {
    val format = Json {
        ignoreUnknownKeys = true
        prettyPrint = true
        prettyPrintIndent = "  "
    }

    fun encode(project: ProjectDocument): String = format.encodeToString(ProjectDocument.serializer(), project)

    fun decode(raw: String): ProjectDocument = format.decodeFromString(ProjectDocument.serializer(), raw)
}

