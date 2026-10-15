package io.github.joedanz.flipsign;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Asks for the server address (checking that a FlipSign server answers there) and the start-at-boot choice. */
public class SetupActivity extends Activity {
    private EditText address;
    private CheckBox boot;
    private TextView status;
    private Button saveAnyway;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(64), dp(40), dp(64), dp(40));

        TextView title = text(R.string.setup_title, 34);
        title.setTextColor(0xFFFFCC33);
        col.addView(title);
        col.addView(text(R.string.setup_intro, 18));

        address = new EditText(this);
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setImeOptions(EditorInfo.IME_ACTION_DONE);
        address.setSingleLine(true);
        address.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        address.setHint(R.string.setup_hint);
        String saved = Prefs.url(this);
        address.setText(saved != null ? saved : "http://");
        address.setSelection(address.getText().length());
        address.setOnEditorActionListener((v, actionId, e) -> {
            check();
            return true;
        });
        col.addView(address, matchWidth(dp(16)));

        boot = new CheckBox(this);
        boot.setText(R.string.setup_boot);
        boot.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        boot.setChecked(Prefs.startAtBoot(this));
        boot.setOnCheckedChangeListener((b, checked) -> showBootStatus());
        col.addView(boot, matchWidth(dp(12)));

        LinearLayout buttons = new LinearLayout(this);
        Button save = new Button(this);
        save.setText(R.string.setup_save);
        save.setOnClickListener(v -> check());
        buttons.addView(save);
        saveAnyway = new Button(this);
        saveAnyway.setText(R.string.setup_save_anyway);
        saveAnyway.setVisibility(View.GONE);
        saveAnyway.setOnClickListener(v -> finishSetup(normalize(address.getText().toString())));
        LinearLayout.LayoutParams gap = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        gap.setMarginStart(dp(16));
        buttons.addView(saveAnyway, gap);
        save.setId(View.generateViewId());
        boot.setNextFocusDownId(save.getId()); // otherwise Down from the full-width checkbox can land on "Save anyway"
        col.addView(buttons, matchWidth(dp(12)));

        status = text(0, 18);
        col.addView(status, matchWidth(dp(12)));
        TextView help = text(0, 16);
        help.setText(getString(R.string.setup_help, versionName()));
        help.setTextColor(0xFF999999);
        col.addView(help, matchWidth(dp(24)));

        ScrollView scroll = new ScrollView(this);
        scroll.addView(col);
        setContentView(scroll);
        showBootStatus();
        address.requestFocus();
    }

    private void showBootStatus() {
        if (!boot.isChecked()) status.setText("");
        else if (Settings.canDrawOverlays(this)) status.setText(R.string.boot_ready);
        else status.setText(R.string.boot_needs_setup);
    }

    /** Accepts "192.168.1.50:3000" as well as full URLs. */
    static String normalize(String raw) {
        String s = raw.trim();
        if (!s.matches("(?i)^https?://.*")) s = "http://" + s;
        if (s.matches("(?i)^https?://[^/]+$")) s += "/";
        return s;
    }

    private void check() {
        String url = normalize(address.getText().toString());
        status.setText(getString(R.string.checking, url));
        saveAnyway.setVisibility(View.GONE);
        new Thread(() -> {
            boolean ok = isFlipSignServer(url);
            runOnUiThread(() -> {
                if (isFinishing()) return;
                if (ok) {
                    finishSetup(url);
                } else {
                    status.setText(getString(R.string.no_server, url));
                    saveAnyway.setVisibility(View.VISIBLE);
                }
            });
        }).start();
    }

    private static boolean isFlipSignServer(String url) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(new URL(url), "/healthz").openConnection();
            c.setConnectTimeout(4000);
            c.setReadTimeout(4000);
            if (c.getResponseCode() != 200) return false;
            try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) {
                String line = r.readLine();
                return line != null && line.trim().equals("ok");
            }
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private void finishSetup(String url) {
        Prefs.save(this, url, boot.isChecked());
        startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP));
        finish();
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    private TextView text(int res, int sp) {
        TextView t = new TextView(this);
        if (res != 0) t.setText(res);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(0xFFEEEEEE);
        t.setGravity(Gravity.START);
        return t;
    }

    private LinearLayout.LayoutParams matchWidth(int topMargin) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = topMargin;
        return lp;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
