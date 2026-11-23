package com.physiquest.app;

import android.Manifest;
import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.Settings;

import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import androidx.webkit.WebViewAssetLoader;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONObject;

import java.util.Locale;
import java.util.concurrent.Executor;

/**
 * Shows the PhysiQuest web app, bundled in assets/, full screen.
 * Lessons, simulations and fonts are all inside the app and work offline. The internet is used only for the
 * optional account: Google sign-in, saving progress, and Premium.
 * The page is served from a private https address (WebViewAssetLoader) rather than file://, which is safer and
 * is what Google sign-in and the database need.
 */
public class MainActivity extends Activity {

    private static final String START = "https://appassets.androidplatform.net/assets/index.html";
    private static final String HOST = "appassets.androidplatform.net";

    private WebView web;
    private FrameLayout root;
    private int ink;
    private WebViewAssetLoader assets;
    private CredentialManager credentials;
    private String oldProgress;          // progress saved by versions before 1.8, brought across once
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Executor onMain = main::post;
    private TextToSpeech tts;            // read aloud, started the first time it is used
    private boolean ttsReady;
    private String[] ttsPending;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ink = Color.parseColor("#21143d");
        assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        credentials = CredentialManager.create(this);

        // The app draws edge to edge; this frame keeps the page clear of the
        // status bar, navigation bar, camera cut-out and on-screen keyboard.
        root = new FrameLayout(this);
        root.setBackgroundColor(ink);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                l = i.left; t = i.top; r = i.right; b = i.bottom;
            } else {
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop();
                r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(l, t, r, b);
            return insets;
        });

        web = makeWebView();
        setContentView(root);

        // Back steps through the sections you visited, then closes the app.
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBackOrClose);
        }

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
            return;
        }
        SharedPreferences prefs = getSharedPreferences("physiquest", MODE_PRIVATE);
        if (prefs.getBoolean("progress_moved", false)) {
            web.loadUrl(START);
        } else {
            readOldProgress(json -> {
                prefs.edit().putBoolean("progress_moved", true).apply();
                oldProgress = json;
                web.loadUrl(START);
            });
        }
    }

    /** Creates the page view: outside links, UPI and email are handed to the phone's own apps. */
    private WebView makeWebView() {
        WebView w = new WebView(this);
        w.setBackgroundColor(ink);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // saves XP, badges and progress on the phone
        s.setAllowFileAccess(false);     // the page comes from the private https address, not from files
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        w.addJavascriptInterface(new Bridge(), "PQAndroid");

        w.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                if ("https".equals(scheme) && HOST.equals(url.getHost())) {
                    return false;                       // the app's own pages
                }
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    // Outside links open in the phone's browser.
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                if ("upi".equals(scheme)) {
                    // "Pay with GPay / UPI" opens the phone's UPI app (GPay, PhonePe, Paytm…).
                    try {
                        startActivity(Intent.createChooser(new Intent(Intent.ACTION_VIEW, url), "Pay with"));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                if ("mailto".equals(scheme) || "tel".equals(scheme)) {
                    // Bug reports open the phone's email app.
                    try {
                        startActivity(new Intent("mailto".equals(scheme) ? Intent.ACTION_SENDTO : Intent.ACTION_DIAL, url));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                return true;                            // anything else stays out of the app
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // Bring across progress saved by an older version of the app, once.
                if (view == web && oldProgress != null && oldProgress.length() > 2 && !"null".equals(oldProgress)) {
                    String json = oldProgress;
                    oldProgress = null;
                    view.evaluateJavascript("window.pqImport&&window.pqImport(" + json + ")", null);
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // The page's renderer was stopped (the phone ran low on memory, or it crashed).
                // Build a fresh page instead of letting the whole app close. Progress is saved on the phone.
                if (view == web) {
                    root.removeView(view);
                    view.destroy();
                    web = makeWebView();
                    web.loadUrl(START);
                }
                return true;
            }
        });

        root.addView(w, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        return w;
    }

    /** What the page may ask of the app. Only the app's own page is ever loaded in this view. */
    private class Bridge {
        @JavascriptInterface
        public void googleSignIn(String webClientId) {
            main.post(() -> startGoogleSignIn(webClientId));
        }

        /** "Invite friends" and "Share my progress": the phone's own share sheet (WhatsApp, Telegram, SMS…). */
        @JavascriptInterface
        public void share(String text) {
            if (text == null || text.isEmpty()) return;
            final String t = text.length() > 1000 ? text.substring(0, 1000) : text;
            main.post(() -> {
                try {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_TEXT, t);
                    startActivity(Intent.createChooser(send, "Share PhysiQuest"));
                } catch (Exception ignored) {
                }
            });
        }

        /** Read aloud: the phone's own text-to-speech voices, in the student's language (falls back to English). */
        @JavascriptInterface
        public void speak(String text, String lang, double rate) {
            if (text == null || text.isEmpty()) return;
            final String t = text.length() > 60000 ? text.substring(0, 60000) : text;
            main.post(() -> speakNow(t, lang, (float) rate));
        }

        @JavascriptInterface
        public void stopSpeak() {
            main.post(() -> { if (tts != null) tts.stop(); });
        }

        /** Save as PDF: the system print screen for this page, which offers "Save as PDF". */
        @JavascriptInterface
        public void print(String title) {
            final String name = title == null || title.isEmpty() ? "PhysiQuest" : (title.length() > 80 ? title.substring(0, 80) : title);
            main.post(() -> {
                try {
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    PrintDocumentAdapter adapter = web.createPrintDocumentAdapter(name);
                    pm.print(name, adapter, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                } catch (Exception ignored) {
                }
            });
        }

        /** "Pay with a UPI app": opens GPay, PhonePe, Paytm, BHIM… with the amount filled in, then tells the page how it went. */
        @JavascriptInterface
        public void payUpi(String link) {
            if (link == null || !link.startsWith("upi://pay?") || link.length() > 600) return;
            main.post(() -> {
                try {
                    Intent pay = new Intent(Intent.ACTION_VIEW, Uri.parse(link));
                    startActivityForResult(Intent.createChooser(pay, "Pay with"), REQ_UPI);
                } catch (Exception e) {
                    upiDone("noapp", "");
                }
            });
        }

        /** App lock: "ok" when the phone has a screen lock (fingerprint, face, PIN, pattern or password) that can confirm its owner. */
        @JavascriptInterface
        public String lockState() {
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            return km != null && km.isDeviceSecure() ? "ok" : "none";
        }

        /** App lock: the phone's own check. The page gets {type:'lock', ok, why}; PhysiQuest never sees the fingerprint or the PIN. */
        @JavascriptInterface
        public void unlock(String title) {
            final String t = title == null || title.isEmpty() ? "Unlock PhysiQuest" : (title.length() > 60 ? title.substring(0, 60) : title);
            main.post(() -> startUnlock(t));
        }

        /** Google Play's rating card. Google decides whether it appears (and how often); it never appears
         *  outside a Play install. The page asks only after a good moment, at most a few times a year. */
        @JavascriptInterface
        public void askReview() {
            main.post(() -> {
                try {
                    ReviewManager rm = ReviewManagerFactory.create(MainActivity.this);
                    rm.requestReviewFlow().addOnCompleteListener(t -> {
                        if (!t.isSuccessful() || isFinishing()) return;
                        ReviewInfo info = t.getResult();
                        rm.launchReviewFlow(MainActivity.this, info);
                    });
                } catch (Exception ignored) {
                }
            });
        }

        /** Night mode: "1" when the phone is in dark mode. The page view cannot tell on its own. */
        @JavascriptInterface
        public String isNight() {
            int m = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            return m == Configuration.UI_MODE_NIGHT_YES ? "1" : "0";
        }

        /** Daily reminder: {on, h, m, can}, where can says whether notifications are allowed. */
        @JavascriptInterface
        public String remState() {
            SharedPreferences p = getSharedPreferences(Reminder.PREFS, MODE_PRIVATE);
            try {
                JSONObject o = new JSONObject();
                o.put("on", p.getBoolean("rem_on", false));
                o.put("h", p.getInt("rem_h", 19));
                o.put("m", p.getInt("rem_m", 0));
                o.put("can", Reminder.allowed(MainActivity.this));
                return o.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        /** Daily reminder on or off at h:m. The page gets {type:'rem', ok, why}; the phone may ask to allow notifications. */
        @JavascriptInterface
        public void remSet(boolean on, int h, int m) {
            final int hh = Math.max(0, Math.min(23, h)), mm = Math.max(0, Math.min(59, m));
            main.post(() -> setReminder(on, hh, mm));
        }

        /** The last study day and the streak, and the reminder's words in the student's language. */
        @JavascriptInterface
        public void remInfo(double lastDay, int streak, String title, String body0, String bodyN) {
            getSharedPreferences(Reminder.PREFS, MODE_PRIVATE).edit()
                    .putLong("rem_last", (long) lastDay)
                    .putInt("rem_streak", Math.max(0, streak))
                    .putString("rem_t", clip(title, 120, "Time for today’s physics"))
                    .putString("rem_b0", clip(body0, 300, "5 minutes is enough: one question, one animation or one card to revise."))
                    .putString("rem_bn", clip(bodyN, 300, "Keep your {n}-day streak going. 5 minutes of physics is enough today."))
                    .apply();
        }

        @JavascriptInterface
        public void remOpenSettings() {
            main.post(() -> {
                try {
                    Intent i;
                    if (Build.VERSION.SDK_INT >= 26) {
                        i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                        i.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    } else {
                        i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                    }
                    startActivity(i);
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void signOut() {
            main.post(() -> credentials.clearCredentialStateAsync(new ClearCredentialStateRequest(), new CancellationSignal(), onMain,
                    new CredentialManagerCallback<Void, ClearCredentialException>() {
                        @Override public void onResult(Void result) { }
                        @Override public void onError(ClearCredentialException e) { }
                    }));
        }
    }

    /** Android's own "Sign in with Google" sheet. The page receives a Google ID token, never a password. */
    private void startGoogleSignIn(String webClientId) {
        if (webClientId == null || webClientId.isEmpty()) {
            sendToPage("google", "error", "Accounts are not set up yet.");
            return;
        }
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(webClientId).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        credentials.getCredentialAsync(this, request, new CancellationSignal(), onMain,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        Credential c = response.getCredential();
                        if (c instanceof CustomCredential
                                && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                            try {
                                GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(c.getData());
                                sendToPage("google", "idToken", g.getIdToken());
                                return;
                            } catch (Exception ignored) {
                            }
                        }
                        sendToPage("google", "error", "Google sign-in did not work. Please try again.");
                    }

                    @Override
                    public void onError(GetCredentialException e) {
                        if (e instanceof GetCredentialCancellationException) {
                            sendToPage("google", "cancelled", "1");      // the student closed the sheet
                        } else if (e instanceof NoCredentialException) {
                            sendToPage("google", "error", "No Google account is on this phone. Add one in Settings, then try again.");
                        } else {
                            sendToPage("google", "error", "Google sign-in did not work. Check your internet and try again.");
                        }
                    }
                });
    }

    private void sendToPage(String type, String key, String value) {
        try {
            JSONObject o = new JSONObject();
            o.put("type", type);
            o.put(key, value);
            if (web != null) {
                web.evaluateJavascript("window.pqNative&&window.pqNative(" + JSONObject.quote(o.toString()) + ")", null);
            }
        } catch (Exception ignored) {
        }
    }

    /** Versions before 1.8 kept progress under file://. Read it once with a hidden view, then hand it over. */
    private void readOldProgress(java.util.function.Consumer<String> done) {
        WebView old = new WebView(this);
        WebSettings s = old.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        final boolean[] finished = {false};
        Runnable giveUp = () -> {
            if (finished[0]) return;
            finished[0] = true;
            root.removeView(old);
            old.destroy();
            done.accept(null);
        };
        old.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) {
                v.evaluateJavascript("(function(){try{return localStorage.getItem('physiquest-v3')||''}catch(e){return ''}})()", value -> {
                    if (finished[0]) return;
                    finished[0] = true;
                    root.removeView(v);
                    v.destroy();
                    done.accept(value);
                });
            }
        });
        old.setVisibility(View.INVISIBLE);
        root.addView(old, new FrameLayout.LayoutParams(1, 1));
        main.postDelayed(giveUp, 4000);   // never hold the app up for long
        old.loadUrl("file:///android_asset/blank.html");
    }

    private void goBackOrClose() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            finish();
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        goBackOrClose();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    private void speakNow(String text, String lang, float rate) {
        if (tts == null) {
            ttsPending = new String[]{text, lang, String.valueOf(rate)};
            tts = new TextToSpeech(this, status -> {
                ttsReady = status == TextToSpeech.SUCCESS;
                if (!ttsReady) { speakDone("none"); return; }
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { }
                    @Override public void onDone(String id) { if ("pq-end".equals(id)) speakDone(""); }
                    @Override public void onError(String id) { speakDone(""); }
                });
                if (ttsPending != null) { String[] p = ttsPending; ttsPending = null; speakNow(p[0], p[1], Float.parseFloat(p[2])); }
            });
            return;
        }
        if (!ttsReady) { ttsPending = new String[]{text, lang, String.valueOf(rate)}; return; }
        String tag = lang == null || lang.isEmpty() ? "en-IN" : lang;
        boolean ok = hasVoice(tts.setLanguage(Locale.forLanguageTag(tag)));
        if (!ok && tag.startsWith("en")) ok = hasVoice(tts.setLanguage(Locale.US)) || hasVoice(tts.setLanguage(Locale.ENGLISH));
        if (!ok) {
            /* the text is in the student's language: an English voice cannot read it, so say what to install instead */
            tellPage("window.pqSpeakLang&&window.pqSpeakLang('missing')");
            return;
        }
        tts.setSpeechRate(Math.max(0.5f, Math.min(2f, rate)));
        /* the engine takes about 4000 characters at a time, so long pages are queued sentence by sentence */
        java.util.List<String> parts = new java.util.ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String sentence : text.split("(?<=[.!?\u0964])\\s+")) {
            String piece = sentence;
            while (piece.length() > 3000) {
                if (cur.length() > 0) { parts.add(cur.toString()); cur.setLength(0); }
                parts.add(piece.substring(0, 3000));
                piece = piece.substring(3000);
            }
            if (cur.length() > 0 && cur.length() + piece.length() + 1 > 3000) { parts.add(cur.toString()); cur.setLength(0); }
            if (cur.length() > 0) cur.append(' ');
            cur.append(piece);
        }
        if (cur.length() > 0) parts.add(cur.toString());
        for (int i = 0; i < parts.size(); i++) {
            tts.speak(parts.get(i), i == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, i == parts.size() - 1 ? "pq-end" : "pq-" + i);
        }
    }

    private static boolean hasVoice(int r) {
        return r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
    }

    private void speakDone(String why) {
        tellPage("window.pqSpeakDone&&window.pqSpeakDone(" + JSONObject.quote(why) + ")");
    }

    private static final int REQ_UPI = 4107;
    private static final int REQ_LOCK = 4108;
    private static final int REQ_NOTIFY = 4109;

    /** Fingerprint or face, with the phone's PIN, pattern or password as the fallback (Android 10 and later);
     *  on older phones, the phone's own lock-screen check. */
    @SuppressWarnings("deprecation")
    private void startUnlock(String title) {
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (km == null || !km.isDeviceSecure()) { lockDone(false, "nolock"); return; }
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                android.hardware.biometrics.BiometricPrompt.Builder b = new android.hardware.biometrics.BiometricPrompt.Builder(this).setTitle(title);
                if (Build.VERSION.SDK_INT >= 30) {
                    b.setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_WEAK
                            | android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL);
                } else {
                    b.setDeviceCredentialAllowed(true);
                }
                b.build().authenticate(new CancellationSignal(), onMain, new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                    @Override public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult r) { lockDone(true, ""); }
                    @Override public void onAuthenticationError(int code, CharSequence msg) { lockDone(false, "cancel"); }
                });
                return;
            } catch (Exception ignored) {
                // fall back to the lock-screen check below
            }
        }
        Intent i = km.createConfirmDeviceCredentialIntent(title, "Use your phone's fingerprint, PIN, pattern or password.");
        if (i == null) { lockDone(false, "nolock"); return; }
        try { startActivityForResult(i, REQ_LOCK); } catch (Exception e) { lockDone(false, "error"); }
    }

    private void lockDone(boolean ok, String why) {
        try {
            JSONObject m = new JSONObject();
            m.put("type", "lock");
            m.put("ok", ok);
            m.put("why", why);
            tellPage("window.pqNative&&window.pqNative(" + JSONObject.quote(m.toString()) + ")");
        } catch (Exception ignored) {
        }
    }

    /** The UPI app's answer, for example "txnId=…&responseCode=00&Status=SUCCESS&txnRef=…". Some apps send nothing. */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_LOCK) { lockDone(resultCode == RESULT_OK, resultCode == RESULT_OK ? "" : "cancel"); return; }
        if (requestCode != REQ_UPI) return;
        String raw = "";
        if (data != null) {
            String r = data.getStringExtra("response");
            if (r == null && data.getExtras() != null) {
                Object o = data.getExtras().get("Status");
                if (o != null) r = "Status=" + o;
            }
            if (r != null) raw = r;
        }
        String low = raw.toLowerCase(Locale.ROOT);
        String status = low.contains("status=success") ? "success"
                : (low.contains("status=submitted") || low.contains("status=pending")) ? "submitted"
                : (low.contains("status=failure") || low.contains("status=failed")) ? "failure"
                : raw.isEmpty() ? "unknown" : "other";
        upiDone(status, raw);
    }

    private void upiDone(String status, String raw) {
        try {
            JSONObject m = new JSONObject();
            m.put("type", "upi");
            m.put("status", status);
            m.put("raw", raw.length() > 300 ? raw.substring(0, 300) : raw);
            tellPage("window.pqNative&&window.pqNative(" + JSONObject.quote(m.toString()) + ")");
        } catch (Exception ignored) {
        }
    }

    private static String clip(String s, int max, String fallback) {
        if (s == null || s.trim().isEmpty()) return fallback;
        return s.length() > max ? s.substring(0, max) : s;
    }

    private int[] pendingReminder;   // the time chosen while the phone asks to allow notifications

    private void setReminder(boolean on, int h, int m) {
        if (!on) {
            getSharedPreferences(Reminder.PREFS, MODE_PRIVATE).edit().putBoolean("rem_on", false).apply();
            Reminder.cancel(this);
            reminderDone(true, "");
            return;
        }
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            pendingReminder = new int[]{h, m};
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY);
            return;
        }
        reminderOn(h, m);
    }

    private void reminderOn(int h, int m) {
        Reminder.channel(this);
        if (!Reminder.allowed(this)) {
            reminderDone(false, "blocked");
            return;
        }
        getSharedPreferences(Reminder.PREFS, MODE_PRIVATE).edit()
                .putBoolean("rem_on", true).putInt("rem_h", h).putInt("rem_m", m).apply();
        Reminder.schedule(this);
        reminderDone(true, "");
    }

    private void reminderDone(boolean ok, String why) {
        try {
            JSONObject m = new JSONObject();
            m.put("type", "rem");
            m.put("ok", ok);
            m.put("why", why);
            tellPage("window.pqNative&&window.pqNative(" + JSONObject.quote(m.toString()) + ")");
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_NOTIFY || pendingReminder == null) return;
        int[] t = pendingReminder;
        pendingReminder = null;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            reminderOn(t[0], t[1]);
        } else {
            reminderDone(false, "denied");
        }
    }

    /** The phone switched between light and dark mode while the app is open. */
    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        tellPage("window.pqThemeChanged&&pqThemeChanged()");
    }

    private void tellPage(String js) {
        main.post(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }

    @Override
    protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
        super.onDestroy();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        // Back from Razorpay's payment page in the browser: check at once whether Premium has switched on.
        tellPage("window.PQPAY&&PQPAY.resume&&PQPAY.resume()");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Uri data = intent.getData();
        if (data != null && "physiquest".equals(data.getScheme())) {
            tellPage("window.PQPAY&&PQPAY.resume&&PQPAY.resume()");
        }
    }
}
