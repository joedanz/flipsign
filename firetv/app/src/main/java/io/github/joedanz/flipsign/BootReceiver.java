package io.github.joedanz.flipsign;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Opens the board when the Fire TV starts. On Fire OS 8 (Android 11) the system only allows this
 * if the app holds "display over other apps", which is granted once over ADB (see README).
 * Without it the call is silently ignored and the TV stays on Home.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (Prefs.url(context) == null || !Prefs.startAtBoot(context)) return;
        context.startActivity(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
}
