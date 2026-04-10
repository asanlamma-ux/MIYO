package com.miyo.vnmaker.data.runtime

import com.miyo.vnmaker.data.model.LuaScript
import java.util.concurrent.atomic.AtomicReference
import org.luaj.vm2.LuaValue
import org.luaj.vm2.lib.OneArgFunction
import org.luaj.vm2.lib.TwoArgFunction
import org.luaj.vm2.lib.jme.JmePlatform

class LuaScriptEngine {

    fun runPageHooks(scripts: List<LuaScript>, variables: MutableMap<String, String>): String? {
        scripts.forEach { script ->
            val globals = JmePlatform.standardGlobals()
            val gotoTarget = AtomicReference<String?>(null)

            globals.set("get_var", object : OneArgFunction() {
                override fun call(arg: LuaValue): LuaValue {
                    return LuaValue.valueOf(variables[arg.tojstring()].orEmpty())
                }
            })
            globals.set("set_var", object : TwoArgFunction() {
                override fun call(key: LuaValue, value: LuaValue): LuaValue {
                    variables[key.tojstring()] = value.tojstring()
                    return LuaValue.NIL
                }
            })
            globals.set("goto_block", object : OneArgFunction() {
                override fun call(arg: LuaValue): LuaValue {
                    gotoTarget.set(arg.tojstring())
                    return LuaValue.NIL
                }
            })

            runCatching {
                globals.load(script.content, script.name).call()
                val hook = globals.get("on_page")
                if (!hook.isnil()) {
                    val result = hook.call()
                    if (result.isstring()) {
                        gotoTarget.set(result.tojstring())
                    }
                }
            }

            gotoTarget.get()?.let { return it }
        }
        return null
    }
}

