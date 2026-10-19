package com.dineinone.waiter.di

import com.dineinone.waiter.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import kotlin.time.Duration.Companion.seconds
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SupabaseModule {

    @Provides
    @Singleton
    fun supabaseClient(): SupabaseClient = createSupabaseClient(
        supabaseUrl = BuildConfig.SUPABASE_URL,
        supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
    ) {
        install(Postgrest)
        install(Realtime) {
            disconnectOnNoSubscriptions = false
            connectOnSubscribe = true
            heartbeatInterval = 10.seconds
            reconnectDelay = 2.seconds
        }
    }
}
