package com.miyo.vnmaker.data.runtime

class NativeBridge {

    private val loaded: Boolean

    init {
        loaded = runCatching {
            System.loadLibrary("miyo_runtime")
            true
        }.getOrDefault(false)
    }

    fun interpolateTemplate(templateValue: String, keys: Array<String>, values: Array<String>): String {
        if (!loaded) {
            return keys.zip(values).fold(templateValue) { acc, (key, value) ->
                acc.replace("<$key>", value)
            }
        }
        return nativeInterpolateTemplate(templateValue, keys, values)
    }

    fun evaluateComparison(left: String, operation: String, right: String): Boolean {
        if (!loaded) {
            return when (operation) {
                "=", "==" -> left == right
                "!=" -> left != right
                ">" -> (left.toDoubleOrNull() ?: 0.0) > (right.toDoubleOrNull() ?: 0.0)
                ">=" -> (left.toDoubleOrNull() ?: 0.0) >= (right.toDoubleOrNull() ?: 0.0)
                "<" -> (left.toDoubleOrNull() ?: 0.0) < (right.toDoubleOrNull() ?: 0.0)
                "<=" -> (left.toDoubleOrNull() ?: 0.0) <= (right.toDoubleOrNull() ?: 0.0)
                else -> false
            }
        }
        return nativeEvaluateComparison(left, operation, right)
    }

    private external fun nativeInterpolateTemplate(templateValue: String, keys: Array<String>, values: Array<String>): String

    private external fun nativeEvaluateComparison(left: String, operation: String, right: String): Boolean
}
