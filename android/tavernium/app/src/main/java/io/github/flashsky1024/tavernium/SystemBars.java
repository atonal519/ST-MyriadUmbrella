package io.github.flashsky1024.tavernium;

import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;

/** Stateless system bar policy shared by the Activity and its local update Dialog. */
final class SystemBars {
    private SystemBars() {}

    static int localColor(boolean dark) { return dark ? 0xff1d1e1a : 0xfff7f6f1; }

    static void applyLocal(Window window, boolean dark) {
        int color = localColor(dark);
        apply(window, false, false, color, color);
    }

    static void apply(Window window, boolean hideStatus, boolean hideNavigation, int statusColor, int navigationColor) {
        if (window == null) return;
        window.setStatusBarColor(statusColor);
        window.setNavigationBarColor(navigationColor);
        View decor = window.getDecorView();
        int managed = View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= 26) managed |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        int flags = decor.getSystemUiVisibility() & ~managed;
        if (Build.VERSION.SDK_INT >= 30) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.setDecorFitsSystemWindows(true);
            decor.setSystemUiVisibility(flags);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                int status = WindowInsets.Type.statusBars(), navigation = WindowInsets.Type.navigationBars();
                if (hideStatus) controller.hide(status); else controller.show(status);
                if (hideNavigation) controller.hide(navigation); else controller.show(navigation);
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                int appearance = (darkIcons(statusColor) ? WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : 0)
                        | (darkIcons(navigationColor) ? WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS : 0);
                controller.setSystemBarsAppearance(appearance, mask);
                if (hideStatus || hideNavigation) controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                return;
            }
        }
        if (hideStatus) {
            window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            flags |= View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
        } else window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (hideNavigation) flags |= View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        if (hideStatus || hideNavigation) flags |= View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
        if (darkIcons(statusColor)) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= 26 && darkIcons(navigationColor)) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        decor.setSystemUiVisibility(flags);
    }

    /** Only four bounded byte values cross the remote bridge; CSS parsing stays in its document. */
    static Integer parseColor(String value) {
        if (value == null || value.length() > 15 || !value.matches("[0-9]{1,3}(,[0-9]{1,3}){3}")) return null;
        String[] parts = value.split(",");
        int[] bytes = new int[4];
        for (int i = 0; i < 4; i++) {
            bytes[i] = Integer.parseInt(parts[i]);
            if (bytes[i] > 255) return null;
        }
        return (bytes[3] << 24) | (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
    }

    static int themeColor(String tint, String text, int fallback) {
        Integer color = parseColor(tint);
        if (color == null) return fallback;
        Integer foreground = parseColor(text);
        int base = foreground == null || (foreground >>> 24) == 0 ? fallback
                : darkIcons(foreground) ? 0xff18191c : 0xfff7f6f1;
        int alpha = color >>> 24;
        int result = 0xff000000;
        for (int shift : new int[]{16, 8, 0}) {
            int channel = (((color >>> shift) & 255) * alpha + ((base >>> shift) & 255) * (255 - alpha) + 127) / 255;
            result |= channel << shift;
        }
        return result;
    }

    static boolean darkIcons(int color) {
        double luminance = 0.2126 * linear((color >>> 16) & 255)
                + 0.7152 * linear((color >>> 8) & 255) + 0.0722 * linear(color & 255);
        return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05);
    }

    private static double linear(int value) {
        double channel = value / 255.0;
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    }
}
