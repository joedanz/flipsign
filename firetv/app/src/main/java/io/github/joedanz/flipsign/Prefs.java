package io.github.joedanz.flipsign;

import android.content.Context;
import android.content.SharedPreferences;

/** The two things the app remembers: the server address and whether to start at boot. */
final class Prefs {
    private static final String FILE = "flipsign";
    private static final String KEY_URL = "url";
    private static final String KEY_START_AT_BOOT = "startAtBoot";

    private Prefs() {}

    private static SharedPreferences get(Context c) {
        return c.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    /** The display URL, or null before setup. */
    static String url(Context c) {
        return get(c).getString(KEY_URL, null);
    }

    static boolean startAtBoot(Context c) {
        return get(c).getBoolean(KEY_START_AT_BOOT, true);
    }

    static void save(Context c, String url, boolean startAtBoot) {
        get(c).edit().putString(KEY_URL, url).putBoolean(KEY_START_AT_BOOT, startAtBoot).apply();
    }
}
