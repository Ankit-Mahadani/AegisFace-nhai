# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# TFLite
-keep class org.tensorflow.lite.** { *; }

# React Native New Arch / Nitro
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.margelo.nitro.** { *; }

# VisionCamera
-keep class com.mrousavy.camera.** { *; }

# op-sqlite
-keep class com.op.sqlite.** { *; }

# Expo modules
-keep class expo.modules.** { *; }

# Add any project specific keep options here:
