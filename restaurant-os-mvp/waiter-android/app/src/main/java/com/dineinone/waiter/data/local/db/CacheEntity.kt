package com.dineinone.waiter.data.local.db

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase

/**
 * Generic JSON cache: one row per (restaurant, resource) so data screens can fall back
 * to the last-known-good payload when the network is unavailable. Supabase stays authoritative.
 */
@Entity(tableName = "cache")
data class CacheEntity(
    @PrimaryKey val key: String,
    val json: String,
    val updatedAt: Long,
)

@Dao
interface CacheDao {
    @Query("SELECT * FROM cache WHERE `key` = :key LIMIT 1")
    suspend fun get(key: String): CacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(entity: CacheEntity)

    @Query("DELETE FROM cache")
    suspend fun clear()
}

@androidx.room.Database(entities = [CacheEntity::class], version = 1, exportSchema = false)
abstract class DineDatabase : RoomDatabase() {
    abstract fun cacheDao(): CacheDao
}
