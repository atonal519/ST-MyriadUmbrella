package io.github.flashsky1024.tavernium;

/** The last connection check selects one provider; updates reuse it without probing. */
final class ServerPluginApi {
    private static final String MANAGED = "/api/plugins/st-bainiaodata/v1/admin/plugins";
    private static final String LUKER = "/api/users/plugins";
    private static final class Selection {
        final String origin, prefix;
        Selection(String origin, String prefix) { this.origin = origin; this.prefix = prefix; }
    }
    private volatile Selection selected;
    void select(String origin, boolean managed) { selected = new Selection(origin, managed ? MANAGED : LUKER); }
    void clear() { selected = null; }
    String listPath(String origin) { return prefix(origin) + "/list"; }
    String updatePath(String origin) { return prefix(origin) + "/update"; }
    private String prefix(String origin) {
        Selection value = selected;
        if (value == null || !value.origin.equals(origin)) throw new IllegalStateException("请先检查连接，再更新插件。");
        return value.prefix;
    }
    static boolean isManagedPath(String path) { return path.equals(MANAGED + "/list") || path.equals(MANAGED + "/update"); }
}
