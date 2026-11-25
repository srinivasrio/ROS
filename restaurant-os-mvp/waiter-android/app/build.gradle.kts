plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.dineinone.waiter"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.dineinone.waiter"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        vectorDrawables { useSupportLibrary = true }

        // Backend endpoints — override via Gradle property (-PSUPABASE_URL=...) or env vars.
        val supabaseUrl = (project.findProperty("SUPABASE_URL") as String?)
            ?: System.getenv("SUPABASE_URL")
            ?: "https://db.dineinone.com"
        val supabaseAnonKey = (project.findProperty("SUPABASE_ANON_KEY") as String?)
            ?: System.getenv("SUPABASE_ANON_KEY")
            ?: ""

        buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
    }

    buildTypes {
        debug {
            val debugApiUrl = (project.findProperty("BASE_API_URL") as String?)
                ?: System.getenv("BASE_API_URL")
                ?: "http://10.0.2.2:3000"
            buildConfigField("String", "BASE_API_URL", "\"$debugApiUrl\"")
        }
        release {
            val releaseApiUrl = (project.findProperty("RELEASE_BASE_API_URL") as String?)
                ?: System.getenv("RELEASE_BASE_API_URL")
                ?: (project.findProperty("BASE_API_URL") as String?)
                ?: System.getenv("BASE_API_URL")
                ?: "https://waiter.dineinone.com"
            buildConfigField("String", "BASE_API_URL", "\"$releaseApiUrl\"")
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.splashscreen)

    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.navigation.compose)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    implementation(libs.datastore.preferences)
    implementation(libs.coil.compose)

    implementation(libs.retrofit)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.retrofit.serialization)

    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.realtime)
    implementation(libs.ktor.client.okhttp)

    implementation(libs.kotlinx.coroutines.android)
}
