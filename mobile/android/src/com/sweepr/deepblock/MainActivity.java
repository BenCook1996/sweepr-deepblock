package com.sweepr.deepblock;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String BASE_APP_URL = "https://sweeprdeepblock.com/app/";
    private WebView webView;

    @SuppressWarnings("deprecation")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#070B14"));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setSaveFormData(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) {
                    return true;
                }
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
                String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";
                String path = uri.getPath() != null ? uri.getPath() : "";

                if (!"https".equals(scheme)) {
                    return true;
                }
                if ("sweeprdeepblock.com".equals(host) && path.startsWith("/app/")) {
                    return false;
                }
                try {
                    Intent externalIntent = new Intent(Intent.ACTION_VIEW, uri);
                    externalIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(externalIntent);
                } catch (Exception ignored) {
                    // Ignore missing external handler
                }
                return true;
            }
        });

        webView.addJavascriptInterface(new SweeprBridge(this), "SweeprAndroid");
        setContentView(webView);

        String html = readAssetHtml("index.html");
        webView.loadDataWithBaseURL(BASE_APP_URL, html, "text/html", "UTF-8", null);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    private String readAssetHtml(String assetName) {
        try (InputStream is = getAssets().open(assetName);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) {
                out.write(buf, 0, n);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "<!DOCTYPE html><html><body style='font-family:sans-serif;background:#070b14;color:#f8fafc;padding:24px'><h2>SWEEPR Deepblock</h2><p>Unable to load app assets.</p></body></html>";
        }
    }

    private static final class SweeprBridge {
        private final Context appContext;

        SweeprBridge(Context ctx) {
            this.appContext = ctx.getApplicationContext();
        }

        @JavascriptInterface
        public void copyText(String text) {
            if (text == null) return;
            String clamped = text.length() > 128 ? text.substring(0, 128) : text;
            try {
                ClipboardManager cm = (ClipboardManager) appContext.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) {
                    cm.setPrimaryClip(ClipData.newPlainText("SWEEPR Deepblock", clamped));
                }
            } catch (Exception ignored) {
                // Ignore clipboard errors
            }
        }

        @JavascriptInterface
        public String getPrivateDnsStatus() {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
                return "{\"supported\":false,\"active\":false,\"host\":\"\"}";
            }
            try {
                ConnectivityManager cm = (ConnectivityManager) appContext.getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm == null) {
                    return "{\"supported\":true,\"active\":false,\"host\":\"\"}";
                }
                Network activeNetwork = cm.getActiveNetwork();
                LinkProperties lp = activeNetwork != null ? cm.getLinkProperties(activeNetwork) : null;
                boolean active = lp != null && lp.isPrivateDnsActive();
                String host = lp != null && lp.getPrivateDnsServerName() != null ? lp.getPrivateDnsServerName() : "";
                String escapedHost = host
                    .replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "")
                    .replace("\r", "");
                return "{\"supported\":true,\"active\":" + active + ",\"host\":\"" + escapedHost + "\"}";
            } catch (Exception e) {
                return "{\"supported\":true,\"active\":false,\"host\":\"\"}";
            }
        }

        @JavascriptInterface
        public void openWirelessSettings() {
            try {
                Intent i = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                appContext.startActivity(i);
            } catch (Exception e) {
                try {
                    Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    appContext.startActivity(fallback);
                } catch (Exception ignored) {
                    // Ignore missing settings activity
                }
            }
        }
    }
}
