package com.dineinone.waiter.core

/** Minimal result wrapper for repository calls. */
sealed interface Outcome<out T> {
    data class Success<T>(val data: T) : Outcome<T>
    data class Error(val message: String) : Outcome<Nothing>
}

inline fun <T> runCatchingOutcome(block: () -> T): Outcome<T> = try {
    Outcome.Success(block())
} catch (e: Exception) {
    android.util.Log.w("DineOutcome", "operation failed: ${e.message}", e)
    Outcome.Error(friendlyError(e.message))
}

/** Map raw network/DB exception text to short user-facing copy. */
fun friendlyError(raw: String?): String {
    val m = (raw ?: "").lowercase()
    return when {
        "timeout" in m || "failed to connect" in m || "unable to resolve host" in m ||
            "connect" in m || "network" in m || "unreachable" in m ->
            "Couldn't reach the server. Check your connection and try again."
        "permission" in m || "row-level security" in m || "401" in m || "403" in m ->
            "You don't have permission to do that."
        raw.isNullOrBlank() -> "Something went wrong. Please try again."
        else -> "Something went wrong. Please try again."
    }
}
