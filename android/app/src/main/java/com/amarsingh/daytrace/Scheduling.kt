package com.amarsingh.daytrace

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

object NotificationSupport {
    const val CHANNEL = "daytrace_schedule"
    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= 26) (context.getSystemService(NotificationManager::class.java)).createNotificationChannel(NotificationChannel(CHANNEL, "DayTrace reminders", NotificationManager.IMPORTANCE_HIGH))
    }
    fun show(context: Context, id: Int, title: String, message: String) {
        createChannel(context)
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pending = PendingIntent.getActivity(context, id, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL).setSmallIcon(com.amarsingh.daytrace.R.drawable.ic_launcher).setContentTitle(title).setContentText(message).setStyle(NotificationCompat.BigTextStyle().bigText(message)).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).setContentIntent(pending).build()
        try { NotificationManagerCompat.from(context).notify(id, notification) } catch (_: SecurityException) { }
    }
}

object ScheduleStore {
    private const val PREFS = "daytrace_native_schedule"
    private const val STATE = "state"
    fun sync(context: Context, payload: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(STATE, payload).apply()
        scheduleAll(context, payload)
    }
    fun reschedule(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(STATE, null)?.let { scheduleAll(context, it) }
    private fun atNext(timeText: String): Long? {
        val match = Regex("(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?", RegexOption.IGNORE_CASE).find(timeText) ?: return null
        var hour = match.groupValues[1].toInt(); val minute = match.groupValues[2].ifEmpty { "0" }.toInt(); val marker = match.groupValues[3].lowercase()
        if (marker == "pm" && hour < 12) hour += 12 else if (marker == "am" && hour == 12) hour = 0
        var dateTime = LocalDateTime.of(LocalDate.now(), LocalTime.of(hour.coerceIn(0, 23), minute.coerceIn(0, 59)))
        if (!dateTime.isAfter(LocalDateTime.now())) dateTime = dateTime.plusDays(1)
        return dateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
    }
    private fun schedule(context: Context, key: String, title: String, message: String, time: String) {
        val trigger = atNext(time) ?: return; val id = key.hashCode()
        val intent = Intent(context, AlarmReceiver::class.java).putExtra("id", id).putExtra("title", title).putExtra("message", message)
        val pending = PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val alarms = context.getSystemService(AlarmManager::class.java)
        if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending)
        else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pending)
    }
    private fun scheduleAll(context: Context, payload: String) {
        val root = try { JSONObject(payload) } catch (_: Exception) { return }
        fun each(array: JSONArray?, action: (JSONObject) -> Unit) { if (array != null) for (i in 0 until array.length()) array.optJSONObject(i)?.let(action) }
        each(root.optJSONArray("reminders")) { if (!it.optBoolean("isDone")) schedule(context, "rem-${it.optString("id")}", "DayTrace reminder", it.optString("message"), it.optString("triggerCondition")) }
        each(root.optJSONArray("fixedEvents")) { schedule(context, "event-${it.optString("id")}", "Upcoming: ${it.optString("title")}", "Scheduled for ${it.optString("time")}", it.optString("time")) }
        each(root.optJSONArray("timetable")) { if (it.optString("status") != "COMPLETED" && it.optString("status") != "SKIPPED") schedule(context, "routine-${it.optString("id")}", "Routine: ${it.optString("title")}", it.optString("notes", "Time to begin"), it.optString("startTime")) }
    }
    fun overdue(context: Context) {
        val payload = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(STATE, null) ?: return
        val root = try { JSONObject(payload) } catch (_: Exception) { return }; val tasks = root.optJSONArray("tasks") ?: return; val now = System.currentTimeMillis()
        for (i in 0 until tasks.length()) { val task = tasks.optJSONObject(i) ?: continue; if (task.optString("status") in setOf("DONE", "CANCELLED")) continue; val due = task.optString("dueAt"); val millis = runCatching { java.time.Instant.parse(due).toEpochMilli() }.getOrNull() ?: continue; if (millis < now) NotificationSupport.show(context, ("overdue-${task.optString("id")}").hashCode(), "Overdue task", task.optString("title")) }
    }
}

class AlarmReceiver : BroadcastReceiver() { override fun onReceive(context: Context, intent: Intent) = NotificationSupport.show(context, intent.getIntExtra("id", 1), intent.getStringExtra("title") ?: "DayTrace", intent.getStringExtra("message") ?: "Scheduled activity") }
class BootReceiver : BroadcastReceiver() { override fun onReceive(context: Context, intent: Intent) = ScheduleStore.reschedule(context) }
class OverdueWorker(context: Context, params: WorkerParameters) : Worker(context, params) { override fun doWork(): Result { ScheduleStore.overdue(applicationContext); return Result.success() } }
