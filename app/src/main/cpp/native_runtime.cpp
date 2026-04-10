#include <jni.h>
#include <regex>
#include <string>
#include <unordered_map>

static std::string jstringToString(JNIEnv* env, jstring value) {
    if (value == nullptr) return "";
    const char* chars = env->GetStringUTFChars(value, nullptr);
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_miyo_vnmaker_data_runtime_NativeBridge_nativeInterpolateTemplate(
    JNIEnv* env,
    jobject,
    jstring templateValue,
    jobjectArray keys,
    jobjectArray values
) {
    std::string text = jstringToString(env, templateValue);
    const jsize size = env->GetArrayLength(keys);
    std::unordered_map<std::string, std::string> variables;
    variables.reserve(static_cast<size_t>(size));

    for (jsize index = 0; index < size; index++) {
        auto key = static_cast<jstring>(env->GetObjectArrayElement(keys, index));
        auto value = static_cast<jstring>(env->GetObjectArrayElement(values, index));
        variables[jstringToString(env, key)] = jstringToString(env, value);
    }

    std::regex pattern(R"(<([A-Za-z0-9_\-]+)>)");
    std::smatch match;
    std::string result;
    auto begin = text.cbegin();

    while (std::regex_search(begin, text.cend(), match, pattern)) {
        result.append(match.prefix().first, match.prefix().second);
        const auto key = match[1].str();
        auto found = variables.find(key);
        if (found != variables.end()) {
            result.append(found->second);
        } else {
            result.append(match[0].str());
        }
        begin = match.suffix().first;
    }

    result.append(begin, text.cend());
    return env->NewStringUTF(result.c_str());
}

extern "C"
JNIEXPORT jboolean JNICALL
Java_com_miyo_vnmaker_data_runtime_NativeBridge_nativeEvaluateComparison(
    JNIEnv* env,
    jobject,
    jstring left,
    jstring operation,
    jstring right
) {
    const auto lhs = jstringToString(env, left);
    const auto op = jstringToString(env, operation);
    const auto rhs = jstringToString(env, right);

    if (op == "==" || op == "=") return lhs == rhs;
    if (op == "!=") return lhs != rhs;

    try {
        const auto lhsValue = std::stod(lhs);
        const auto rhsValue = std::stod(rhs);
        if (op == ">") return lhsValue > rhsValue;
        if (op == ">=") return lhsValue >= rhsValue;
        if (op == "<") return lhsValue < rhsValue;
        if (op == "<=") return lhsValue <= rhsValue;
    } catch (...) {
        return JNI_FALSE;
    }

    return JNI_FALSE;
}
