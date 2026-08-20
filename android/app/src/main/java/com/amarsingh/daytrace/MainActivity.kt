package com.amarsingh.daytrace

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.app.ActivityCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var rootView: FrameLayout
    private val generativeModel: GenerativeModel by lazy { Generation.getClient() }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NotificationSupport.createChannel(this)
        if (Build.VERSION.SDK_INT >= 33 && ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 42)
        }
        WorkManager.getInstance(this).enqueueUniquePeriodicWork("daytrace-overdue-scan", ExistingPeriodicWorkPolicy.UPDATE, PeriodicWorkRequestBuilder<OverdueWorker>(15, TimeUnit.MINUTES).build())

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        rootView = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(17, 19, 24))
        }
        webView = WebView(this)
        webView.setBackgroundColor(Color.rgb(17, 19, 24))
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }
        }
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(Bridge(), "DayTraceAndroid")

        rootView.addView(
            webView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
        setContentView(rootView)

        WindowCompat.getInsetsController(window, rootView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        ViewCompat.setOnApplyWindowInsetsListener(rootView) { view, insets ->
            val safeBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(
                safeBars.left,
                safeBars.top,
                safeBars.right,
                maxOf(safeBars.bottom, keyboard.bottom),
            )
            insets
        }
        ViewCompat.requestApplyInsets(rootView)

        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (webView.canGoBack()) webView.goBack() else finish() }
        })
    }

    inner class Bridge {
        @JavascriptInterface fun syncSchedule(payload: String) { ScheduleStore.sync(this@MainActivity, payload) }

        @JavascriptInterface
        fun processOnDeviceAi(requestId: String, input: String, stateContext: String) {
            if (requestId.length > 120 || input.length > 12_000 || stateContext.length > 40_000) {
                emitAiResult(requestId, "error", message = "The request was too large for on-device processing.")
                return
            }

            lifecycleScope.launch {
                try {
                    when (generativeModel.checkStatus()) {
                        FeatureStatus.AVAILABLE -> runOnDeviceInference(requestId, input, stateContext)
                        FeatureStatus.UNAVAILABLE -> emitAiResult(
                            requestId,
                            "unavailable",
                            message = "Gemini Nano is not available on this device configuration.",
                        )
                        FeatureStatus.DOWNLOADABLE -> {
                            emitAiResult(
                                requestId,
                                "downloading",
                                message = "Gemini Nano is downloading. DayTrace is using its local parser for this update.",
                            )
                            downloadGeminiNano()
                        }
                        FeatureStatus.DOWNLOADING -> emitAiResult(
                            requestId,
                            "downloading",
                            message = "Gemini Nano is still downloading. DayTrace is using its local parser for this update.",
                        )
                    }
                } catch (error: Throwable) {
                    emitAiResult(
                        requestId,
                        "error",
                        message = error.message ?: "On-device AI could not process this update.",
                    )
                }
            }
        }
    }

    private suspend fun downloadGeminiNano() {
        try {
            generativeModel.download().collect { status ->
                if (status is DownloadStatus.DownloadCompleted) {
                    emitAiStatus("available", "Gemini Nano is ready for on-device processing.")
                } else if (status is DownloadStatus.DownloadFailed) {
                    emitAiStatus("error", status.e.message ?: "Gemini Nano download failed.")
                }
            }
        } catch (error: Throwable) {
            emitAiStatus("error", error.message ?: "Gemini Nano download failed.")
        }
    }

    private suspend fun runOnDeviceInference(requestId: String, input: String, stateContext: String) {
        val prompt =
            """
            You are DayTrace, a private on-device productivity assistant. Interpret the user's latest
            day update using the supplied current tracker state. Be concise, specific, and supportive.
            Never claim a change unless it is present in the JSON update. Match an existing task by
            its exact id whenever possible. Do not invent facts, times, or completed work.

            Return ONLY one valid JSON object, without markdown or commentary, in this shape:
            {
              "aiResponseText": "A short response directly related to the user's words",
              "extractedStateUpdate": {
                "currentLocation": "optional string",
                "currentActivity": "optional string",
                "currentEnergy": "optional HIGH_FOCUS|NORMAL|LOW_ENERGY|RUSHED|DISTRACTED|EMOTIONAL|TIRED",
                "updatedTasks": [{"id":"existing id","title":"exact title","status":"CAPTURED|NEXT|ACTIVE|WAITING|BLOCKED|SCHEDULED|DONE|CANCELLED"}],
                "newTasks": [{"title":"task","category":"OFFICE|CAREER|CLIENT|CONTENT|KHABARZAAR|HOME|FAMILY|HEALTH|PERSONAL|IDEAS","owner":"ME|SPOUSE|CLIENT|BOSS|IT_TEAM|RECRUITER|OTHER","status":"CAPTURED|NEXT|SCHEDULED","priority":6}],
                "completedTaskTitles": ["exact existing task title"],
                "newTimelineEvents": [{"time":"HH:mm","type":"EVENT|TASK_STARTED|TASK_COMPLETED|INTERRUPTION|MEETING|DEPARTURE|UPDATE","description":"event"}],
                "newFixedEvents": [{"time":"HH:mm","title":"event","category":"OFFICE|CAREER|CLIENT|CONTENT|KHABARZAAR|HOME|FAMILY|HEALTH|PERSONAL|IDEAS"}],
                "newReminders": [{"type":"TIME_BASED|LOCATION_BASED|EVENT_TRIGGERED","triggerCondition":"condition","message":"reminder"}],
                "nextBestAction": {"taskId":"existing id or null","title":"action","rationale":"why","estimatedMinutes":30},
                "changesSummary": {"tasksDone":[],"tasksWaiting":[],"tasksBlocked":[],"tasksCreated":[],"timelineAdded":[],"nextAction":"optional"}
              }
            }
            Omit optional scalar fields that are not supported by the user's message. Use empty arrays
            for unchanged collections. If the message is a question, answer it in aiResponseText and
            make no tracker change unless the user also requested one.
            
            Current DayTrace state: $stateContext

            Latest user message: $input
            """.trimIndent()
        val response = generativeModel.generateContent(prompt)
        val output = response.candidates.firstOrNull()?.text.orEmpty()
        if (output.isBlank()) {
            emitAiResult(requestId, "error", message = "Gemini Nano returned an empty response.")
            return
        }
        val modelName = runCatching { generativeModel.getBaseModelName() }.getOrNull()
        emitAiResult(requestId, "available", output = output, modelName = modelName)
    }

    private fun emitAiResult(
        requestId: String,
        status: String,
        output: String? = null,
        message: String? = null,
        modelName: String? = null,
    ) {
        val detail = JSONObject().apply {
            put("requestId", requestId)
            put("status", status)
            if (output != null) put("output", output)
            if (message != null) put("message", message)
            if (modelName != null) put("modelName", modelName)
        }
        runOnUiThread {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('daytrace-native-ai-result',{detail:${detail}}));",
                null,
            )
        }
    }

    private fun emitAiStatus(status: String, message: String) {
        val detail = JSONObject().apply {
            put("status", status)
            put("message", message)
        }
        runOnUiThread {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('daytrace-native-ai-status',{detail:${detail}}));",
                null,
            )
        }
    }

    override fun onDestroy() {
        if (this::webView.isInitialized) {
            webView.removeJavascriptInterface("DayTraceAndroid")
            webView.destroy()
        }
        if (this::rootView.isInitialized) {
            rootView.removeAllViews()
        }
        runCatching { generativeModel.close() }
        super.onDestroy()
    }
}
