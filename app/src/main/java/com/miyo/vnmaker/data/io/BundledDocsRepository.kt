package com.miyo.vnmaker.data.io

import android.content.Context
import com.miyo.vnmaker.data.model.BundledDoc

class BundledDocsRepository(private val context: Context) {

    fun loadDocs(): List<BundledDoc> {
        val files = context.assets.list("docs").orEmpty().sorted()
        return files.map { name ->
            val body = context.assets.open("docs/$name").bufferedReader().use { it.readText() }
            BundledDoc(
                name = name,
                title = name.removeSuffix(".md").replace("-", " ").replaceFirstChar { it.uppercase() },
                body = body,
            )
        }
    }
}

