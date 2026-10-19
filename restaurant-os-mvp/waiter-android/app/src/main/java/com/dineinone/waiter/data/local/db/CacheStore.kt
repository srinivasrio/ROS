package com.dineinone.waiter.data.local.db

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/** Thin wrapper to read/write serialized lists in the Room cache. */
@Singleton
class CacheStore @Inject constructor(
    val dao: CacheDao,
    val json: Json,
) {
    suspend inline fun <reified T> putList(key: String, list: List<T>) {
        runCatching { dao.put(CacheEntity(key, json.encodeToString(list), System.currentTimeMillis())) }
    }

    suspend inline fun <reified T> getList(key: String): List<T>? = runCatching {
        dao.get(key)?.json?.let { json.decodeFromString<List<T>>(it) }
    }.getOrNull()

    suspend fun clear() = runCatching { dao.clear() }
}
