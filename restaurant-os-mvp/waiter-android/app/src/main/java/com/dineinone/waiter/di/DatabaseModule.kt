package com.dineinone.waiter.di

import android.content.Context
import androidx.room.Room
import com.dineinone.waiter.data.local.db.CacheDao
import com.dineinone.waiter.data.local.db.DineDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun database(@ApplicationContext context: Context): DineDatabase =
        Room.databaseBuilder(context, DineDatabase::class.java, "dineinone.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    @Singleton
    fun cacheDao(db: DineDatabase): CacheDao = db.cacheDao()
}
