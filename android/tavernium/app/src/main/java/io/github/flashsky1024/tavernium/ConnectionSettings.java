package io.github.flashsky1024.tavernium;

import android.content.SharedPreferences;

/** The connection form and request consumers read the same existing preference keys. */
final class ConnectionSettings {
    static final class Saved {
        final String url, username, password;
        Saved(String url, String username, String password) {
            this.url = url; this.username = username; this.password = password;
        }
    }
    static Saved read(SharedPreferences prefs) {
        return new Saved(prefs.getString("server_url", ""),
                prefs.getString("basic_auth_user", ""), prefs.getString("basic_auth_pass", ""));
    }
    static boolean save(SharedPreferences prefs, String url, String username, String password,
                        Runnable clearHttpAuthentication) {
        Saved previous = read(prefs);
        if (previous.url.equals(url) && previous.username.equals(username)
                && previous.password.equals(password)) return false;
        // Clear all cached realms before replacing the single configured connection.
        clearHttpAuthentication.run();
        prefs.edit().putString("server_url", url).putString("basic_auth_user", username)
                .putString("basic_auth_pass", password).apply();
        return true;
    }
}
