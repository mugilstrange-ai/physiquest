package com.physiquest.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * The daily study reminder. One alarm a day at the student's time; when it rings, the phone checks
 * whether the student has already studied today and stays quiet if so. It is set again after a
 * restart, an app update or a change of the phone's clock. Nothing leaves the phone.
 */
public class Reminder extends BroadcastReceiver {

    static final String PREFS = "physiquest";
    static final String CHANNEL = "study";
    static final String ACTION = "com.physiquest.app.REMIND";
    private static final int NOTE_ID = 4110;

    @Override
    public void onReceive(Context c, Intent intent) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean("rem_on", false)) return;
        if (intent != null && ACTION.equals(intent.getAction())) {
            long today = dayNum(System.currentTimeMillis());
            long last = p.getLong("rem_last", -1);
            if (last < today && p.getLong("rem_shown", -1) != today) {
                show(c, p, last == today - 1 ? p.getInt("rem_streak", 0) : 0);
                p.edit().putLong("rem_shown", today).apply();
            }
        }
        schedule(c);   // the next one
    }

    /** Days since 1970 in the phone's own time zone: the same count the page uses for its streak. */
    static long dayNum(long t) {
        return (t + TimeZone.getDefault().getOffset(t)) / 86400000L;
    }

    /** Whether PhysiQuest may show notifications right now. */
    static boolean allowed(Context c) {
        if (Build.VERSION.SDK_INT >= 33
                && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || !nm.areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = nm.getNotificationChannel(CHANNEL);
            if (ch != null && ch.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        }
        return true;
    }

    static void channel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Study reminders", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("One reminder a day at the time you choose. Quiet on days you have already studied.");
        nm.createNotificationChannel(ch);
    }

    /** Sets the alarm for the next reminder time, or removes it when the reminder is off. */
    static void schedule(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        PendingIntent pi = alarm(c);
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean("rem_on", false)) {
            am.cancel(pi);
            return;
        }
        Calendar k = Calendar.getInstance();
        k.set(Calendar.HOUR_OF_DAY, p.getInt("rem_h", 19));
        k.set(Calendar.MINUTE, p.getInt("rem_m", 0));
        k.set(Calendar.SECOND, 0);
        k.set(Calendar.MILLISECOND, 0);
        if (k.getTimeInMillis() <= System.currentTimeMillis() + 5000) k.add(Calendar.DAY_OF_MONTH, 1);
        // Not to the second, so it needs no special permission and is kind to the battery.
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, k.getTimeInMillis(), pi);
    }

    static void cancel(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am != null) am.cancel(alarm(c));
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(NOTE_ID);
    }

    private static PendingIntent alarm(Context c) {
        Intent i = new Intent(c, Reminder.class).setAction(ACTION);
        return PendingIntent.getBroadcast(c, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @SuppressWarnings("deprecation")
    private static void show(Context c, SharedPreferences p, int streak) {
        if (!allowed(c)) return;
        channel(c);
        String title = p.getString("rem_t", "Time for today’s physics");
        String body = streak > 0
                ? p.getString("rem_bn", "Keep your {n}-day streak going. 5 minutes of physics is enough today.").replace("{n}", String.valueOf(streak))
                : p.getString("rem_b0", "5 minutes is enough: one question, one animation or one card to revise.");
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(c, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder nb = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        nb.setSmallIcon(R.drawable.ic_stat_pq)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setColor(0xFF5B3FB0)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setShowWhen(true);
        if (Build.VERSION.SDK_INT < 26) nb.setPriority(Notification.PRIORITY_DEFAULT);
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 33
                && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        try {
            nm.notify(NOTE_ID, nb.build());
        } catch (SecurityException ignored) {
        }
    }
}
