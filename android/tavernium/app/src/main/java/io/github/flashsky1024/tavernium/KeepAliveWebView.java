package io.github.flashsky1024.tavernium;

import android.content.Context;
import android.view.View;
import android.webkit.WebView;

/** Remote page only: keep its provider window active while the actual View may stop drawing. */
final class KeepAliveWebView extends WebView {
    // WebView may dispatch visibility from super(context); field initializers must not erase it.
    private int systemWindowVisibility;
    private boolean windowStateKnown;
    private boolean policyReady;
    private boolean keepAliveEnabled;
    private boolean disposed;

    KeepAliveWebView(Context context) {
        super(context);
        if (!this.windowStateKnown) {
            this.systemWindowVisibility = getWindowVisibility();
            this.windowStateKnown = true;
        }
        this.policyReady = true;
    }

    void setKeepAliveEnabled(boolean enabled) {
        if (this.disposed || this.keepAliveEnabled == enabled) return;
        this.keepAliveEnabled = enabled;
        forwardWindowVisibility("policy");
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        this.systemWindowVisibility = visibility;
        this.windowStateKnown = true;
        if (!this.disposed) forwardWindowVisibility("window");
    }

    private void forwardWindowVisibility(String event) {
        int forwarded = this.keepAliveEnabled ? View.VISIBLE : this.systemWindowVisibility;
        super.onWindowVisibilityChanged(forwarded);
        if (this.policyReady) logBoundary(event, forwarded);
    }

    private void logBoundary(String event, int forwarded) {
        PerfLog.i("RemoteWindow", event + " system=" + this.systemWindowVisibility
                + " forwarded=" + forwarded + " keepalive=" + this.keepAliveEnabled
                + " attached=" + isAttachedToWindow() + " view=" + getVisibility());
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (this.policyReady) logBoundary("attach", this.keepAliveEnabled ? View.VISIBLE : this.systemWindowVisibility);
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        if (this.policyReady) logBoundary("detach", this.keepAliveEnabled ? View.VISIBLE : this.systemWindowVisibility);
    }

    @Override
    public void destroy() {
        if (this.disposed) return;
        setKeepAliveEnabled(false);
        this.disposed = true;
        super.destroy();
    }
}
