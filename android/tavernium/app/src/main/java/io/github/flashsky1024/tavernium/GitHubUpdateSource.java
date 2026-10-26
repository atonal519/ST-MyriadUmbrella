package io.github.flashsky1024.tavernium;

import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Public APK releases are separate from the frontend extension in this repository. */
final class GitHubUpdateSource {
    static final String REPOSITORY = "atonal519/ST-MyriadUmbrella";
    static final String FEED = "https://raw.githubusercontent.com/" + REPOSITORY + "/main/qianjisan-trial-update.json";
    static final String MANIFEST = "qianjisan-trial-update.json";
    interface Connections { HttpURLConnection open(URL address) throws Exception; }
    static final Connections NETWORK = address -> (HttpURLConnection) address.openConnection();
    private static final int MAX_JSON_BYTES = 1024 * 1024;
    private static final String DOWNLOAD_PATH = "/" + REPOSITORY + "/releases/download/";

    /** This binding is created only after the fixed feed's APK address and metadata have been checked. */
    static final class Binding {
        private final String url, sha256;
        private final long size;
        private final int code;
        private Binding(UpdateManager.Release release) {
            url=release.url;sha256=release.sha256;size=release.size;code=release.versionCode;
        }
        boolean matches(UpdateManager.Release release) {
            return url.equals(release.url) && sha256.equals(release.sha256)
                    && size==release.size && code==release.versionCode;
        }
    }
    static UpdateManager.Release check(int currentCode) throws Exception { return check(currentCode,NETWORK); }
    static UpdateManager.Release check(int currentCode,Connections connections) throws Exception {
        String text=readJson(FEED,false,connections);
        if(new JSONObject(text).optJSONArray("releases")==null)
            throw new IllegalStateException("无法读取更新信息，请稍后重新检查。");
        for(UpdateManager.Release release:UpdateManager.parseReleases(text)) {
            if(!"trial".equals(release.channel)||release.versionCode<=currentCode)continue;
            if(!assetUrl(release.url,release.versionName)||release.size<=0
                    ||!release.sha256.matches("(?i)[0-9a-f]{64}"))
                throw new SecurityException("更新信息与安装包不一致，请稍后重新检查。");
            release.githubBinding=new Binding(release);
            return release;
        }
        return null;
    }
    private static boolean assetUrl(String value,String versionName) {
        try {
            URI uri=new URI(value);
            if(!secure(uri)||!"github.com".equals(uri.getHost())||uri.getRawQuery()!=null
                    ||uri.getRawFragment()!=null||!versionName.matches("[A-Za-z0-9._-]+")
                    ||!uri.getPath().startsWith(DOWNLOAD_PATH))return false;
            String[] parts=uri.getPath().substring(DOWNLOAD_PATH.length()).split("/",-1);
            return parts.length==2&&parts[0].startsWith("apk-v")&&parts[0].matches("[A-Za-z0-9._-]+")
                    &&parts[1].equals("qianjisan-"+versionName+".apk");
        }catch(Exception error){return false;}
    }
    private static boolean secure(URI uri) {
        return "https".equals(uri.getScheme())&&uri.getRawUserInfo()==null
                &&(uri.getPort()==-1||uri.getPort()==443);
    }
    private static boolean assetHop(String address,String original) {
        try {
            URI uri=new URI(address);
            if(!secure(uri)||uri.getRawFragment()!=null)return false;
            if(address.equals(original))return true;
            return "release-assets.githubusercontent.com".equals(uri.getHost())
                    ||"objects.githubusercontent.com".equals(uri.getHost());
        }catch(Exception error){return false;}
    }
    static HttpURLConnection open(String address,boolean asset,int timeout,String accept,Connections connections) throws Exception {
        String current=address;
        for(int redirects=0;redirects<=5;redirects++) {
            if(!(asset?assetHop(current,address):FEED.equals(current)))
                throw new SecurityException("更新下载地址不受支持，请稍后重新检查。");
            HttpURLConnection connection=connections.open(new URL(current));boolean retained=false;
            try {
                connection.setConnectTimeout(8000);connection.setReadTimeout(timeout);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept",accept);
                connection.setRequestProperty("User-Agent","Qianjisan/"+BuildConfig.VERSION_NAME);
                int code=connection.getResponseCode();
                if(code==200){retained=true;return connection;}
                if(code==301||code==302||code==303||code==307||code==308){
                    String location=connection.getHeaderField("Location");
                    if(location==null||redirects==5)throw new IllegalStateException("更新下载地址暂不可用，请稍后重新检查。");
                    current=new URL(new URL(current),location).toString();
                }else if(code==404&&!asset)throw new IllegalStateException("APK更新源尚未发布，请稍后重新检查。");
                else if(code==429)throw new IllegalStateException("更新服务暂时限制了请求，请稍后再试。");
                else throw new IllegalStateException("读取更新失败（"+code+"），请稍后再试。");
            }finally{if(!retained)connection.disconnect();}
        }
        throw new IllegalStateException("更新下载地址暂不可用，请稍后重新检查。");
    }
    private static String readJson(String url,boolean asset,Connections connections) throws Exception {
        HttpURLConnection connection=open(url,asset,15000,"application/json",connections);
        try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[8192];int count;
            while((count=input.read(buffer))!=-1){if(output.size()+count>MAX_JSON_BYTES)throw new IllegalStateException("更新信息过大，请稍后重新检查。");output.write(buffer,0,count);}
            return new String(output.toByteArray(),StandardCharsets.UTF_8);
        }finally{connection.disconnect();}
    }
}
