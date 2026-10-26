package io.github.flashsky1024.tavernium;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** The custom GIF's existence is the selection; both preview and playback open this source. */
final class LoadingAnimationFile {
    interface DefaultSource { InputStream open() throws IOException; }
    interface Validator { void validate(File file) throws Exception; }
    private final File custom;
    LoadingAnimationFile(File directory) { custom = new File(directory, "bainiao-loading.gif"); }
    boolean isCustom() { return custom.isFile(); }
    long version() { return isCustom() ? custom.lastModified() : 0; }
    InputStream open(DefaultSource fallback) throws IOException {
        return isCustom() ? new FileInputStream(custom) : fallback.open();
    }
    void replace(InputStream input, Validator validator) throws Exception {
        File candidate = new File(custom.getParentFile(), custom.getName() + ".tmp");
        try {
            try (FileOutputStream output = new FileOutputStream(candidate)) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            }
            byte[] header = new byte[6]; int count = 0;
            try (InputStream saved = new FileInputStream(candidate)) {
                while (count < header.length) {
                    int n = saved.read(header, count, header.length - count);
                    if (n < 0) break;
                    count += n;
                }
            }
            String signature = new String(header, StandardCharsets.US_ASCII);
            if (count != 6 || (!signature.equals("GIF87a") && !signature.equals("GIF89a")))
                throw new IOException("请选择 GIF 动画文件。");
            validator.validate(candidate);
            if (!candidate.renameTo(custom)) throw new IOException("GIF 保存失败，请重新选择。");
        } finally { if (candidate.exists()) candidate.delete(); }
    }
    void reset() throws IOException {
        if (custom.exists() && !custom.delete()) throw new IOException("无法恢复默认动画，请重试。");
    }
}
