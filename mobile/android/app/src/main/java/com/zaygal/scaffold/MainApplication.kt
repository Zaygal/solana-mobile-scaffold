package com.zaygal.scaffold

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {
    override val reactHost: ReactHost by lazy {
        getDefaultReactHost(applicationContext, PackageList(this).packages)
    }

    override fun onCreate() {
        super.onCreate()
        Log.i("MWASCAFFOLD", "native startup reached")
        loadReactNative(this)
    }
}
