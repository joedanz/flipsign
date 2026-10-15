package io.github.joedanz.flipsign;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * Shows the FlipSign display page full screen and keeps it there: screen kept on (which also holds
 * off the Fire TV screensaver), automatic retry while the server is unreachable, and a fresh
 * WebView if the renderer ever crashes. Press ≡ (Menu) on the remote for setup.
 */
public class MainActivity extends Activity {
    private static final long RETRY_MS = 10_000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable retry = this::load;
    private FrameLayout root;
    private WebView web;
    private TextView message;
    private String url;
    private boolean failed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        url = Prefs.url(this);
        if (url == null) {
            startActivity(new Intent(this, SetupActivity.class));
            finish();
            return;
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        message = new TextView(this);
        message.setTextColor(0xFFDDDDDD);
        message.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        message.setGravity(Gravity.CENTER);
        message.setPadding(96, 96, 96, 96);
        message.setVisibility(View.GONE);
        createWebView();
        root.addView(message, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        load();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setFocusable(false); // keys stay with the activity; the page needs no input
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // lets the flap "clack" play without a click
        s.setSupportZoom(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String pageUrl, android.graphics.Bitmap favicon) {
                failed = false;
            }

            @Override
            public void onPageFinished(WebView view, String pageUrl) {
                if (!failed) {
                    message.setVisibility(View.GONE);
                    web.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) fail(String.valueOf(error.getDescription()));
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) fail("HTTP " + response.getStatusCode());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false; // never hand links to another app
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // The page's renderer died (e.g. low memory after days of running). Start over with a new WebView.
                root.removeView(web);
                web.destroy();
                createWebView();
                load();
                return true;
            }
        });
        root.addView(web, 0, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private void load() {
        handler.removeCallbacks(retry);
        web.loadUrl(url);
    }

    private void fail(String reason) {
        failed = true;
        message.setText(getString(R.string.cant_reach, url, reason));
        message.setVisibility(View.VISIBLE);
        web.setVisibility(View.INVISIBLE); // hide the WebView's own error page behind the message
        handler.removeCallbacks(retry);
        handler.postDelayed(retry, RETRY_MS);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web == null) return;
        web.onResume();
        String saved = Prefs.url(this);
        if (saved != null && !saved.equals(url)) { // changed in setup
            url = saved;
            load();
        }
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(retry);
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** ≡ (Menu) opens setup. Back is ignored so a stray press can't take the sign down; Home still leaves. */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int key = event.getKeyCode();
        if (key == KeyEvent.KEYCODE_MENU) {
            if (event.getAction() == KeyEvent.ACTION_UP) startActivity(new Intent(this, SetupActivity.class));
            return true;
        }
        if (key == KeyEvent.KEYCODE_BACK) return true;
        return super.dispatchKeyEvent(event);
    }
}
