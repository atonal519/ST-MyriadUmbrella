package io.github.flashsky1024.tavernium;

import android.app.Activity;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Local UI and the single, shared native session client. The remote browser never receives this bridge. */
final class HomeController {
    interface Host {
        void clearHttpAuthentication(); void connectionChanged(); void enterBrowser();
        void closeBrowser(); boolean browserOpen();
        void settingsChanged(String key); void clearConnection(boolean delete, Runnable completed);
        void clearLegacyCache(); void openSystemPermission(String target);
        void exportLog(); void pickImage(String target);
        void checkUpdates(java.util.function.BiConsumer<String,String> completed);
        void appUpdateAction(String operation);
    }
    private static final String ORIGIN = "https://bainiao.local";
    private final Activity activity;
    private final SharedPreferences prefs;
    private final Host host;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    /** Card browsing must not wait behind the four status/plugin requests. */
    private final ExecutorService libraryIo = Executors.newSingleThreadExecutor();
    private final SessionClient client;
    private final LocalAppearance appearance;
    private final ServerPluginApi pluginApi = new ServerPluginApi();
    private WebView view;
    private JSONObject appUpdate;
    private String csrf = "";
    private String csrfOrigin = "";

    HomeController(Activity activity, SharedPreferences prefs, Host host, LocalAppearance appearance) {
        this.activity=activity; this.prefs=prefs; this.host=host; this.appearance=appearance;
        CookieManager jar=CookieManager.getInstance(); jar.setAcceptCookie(true);
        this.client=new SessionClient(new SessionClient.Cookies(){
            public String get(String url){return jar.getCookie(url);}
            public void set(String url,String value) throws java.io.IOException {
                java.util.concurrent.CountDownLatch applied = new java.util.concurrent.CountDownLatch(1);
                activity.runOnUiThread(() -> jar.setCookie(url,value,accepted -> applied.countDown()));
                try {
                    if(!applied.await(5,java.util.concurrent.TimeUnit.SECONDS))throw new java.io.IOException("登录会话保存超时");
                } catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new java.io.IOException("登录会话保存中断"); }
                jar.flush();
            }
        },(method,path,status)->PerfLog.i("HomeRequest",method+" "+path+" HTTP "+status),
                bytes -> android.util.Base64.encodeToString(bytes,android.util.Base64.NO_WRAP));
    }
    WebView create() {
        if(view!=null) return view;
        view=new WebView(activity);
        view.setBackgroundColor(android.graphics.Color.TRANSPARENT);
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setAllowFileAccess(false);
        view.getSettings().setAllowContentAccess(false);
        view.addJavascriptInterface(new LocalBridge(),"BainiaoNative");
        view.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView webView,WebResourceRequest request){return true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView webView,WebResourceRequest request){return asset(request.getUrl());}
        });
        view.loadUrl(ORIGIN+"/home.html");
        return view;
    }
    void destroyView(){
        if(view==null)return;
        view.removeJavascriptInterface("BainiaoNative");view.stopLoading();
        if(view.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)view.getParent()).removeView(view);
        view.destroy();view=null;
    }
    void dispose(){destroyView();io.shutdown();libraryIo.shutdown();}
    void back(Runnable finish){if(view==null){finish.run();return;}view.evaluateJavascript("window.BainiaoApp && window.BainiaoApp.back()",value->{if(!"true".equals(value))finish.run();});}
    void stateChanged(){if(view!=null)view.evaluateJavascript("window.BainiaoApp && window.BainiaoApp.stateChanged("+state()+")",null);}
    void updateChanged(JSONObject value){
        appUpdate=value;
        if(view!=null)view.evaluateJavascript("window.BainiaoApp && window.BainiaoApp.updateChanged("+value+")",null);
    }
    void visibilityChanged(boolean visible){
        if(view!=null)view.evaluateJavascript("window.BainiaoApp && window.BainiaoApp.setVisible("+visible+")",null);
    }
    private JSONObject state(){
        JSONObject value=new JSONObject();
        try {
            value.put("dark",(activity.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)==android.content.res.Configuration.UI_MODE_NIGHT_YES);
            ConnectionSettings.Saved connection = ConnectionSettings.read(prefs);
            value.put("url",connection.url);
            value.put("browserOpen",host.browserOpen());
            value.put("username",connection.username);
            value.put("password",connection.password);
            value.put("version",BuildConfig.VERSION_NAME);
            if(appUpdate!=null)value.put("appUpdate",appUpdate);
            value.put("frameRate",prefs.getInt("frame_rate_limit",0));
            value.put("idleMode",IdleController.readMode(prefs));
            value.put("perfMonitor",prefs.getBoolean("perf_monitor",false));
            value.put("verboseLog",prefs.getBoolean("verbose_log",false));
            value.put("replyNotifications",prefs.getBoolean("reply_notifications",false));
            value.put("keepalive",!prefs.getBoolean("pause_in_background",false));
            value.put("keepScreenOn",prefs.getBoolean("keep_screen_on",true));
            value.put("ballEnabled",prefs.getBoolean("ball_enabled",false));
            value.put("ballSize",prefs.getInt("ball_size",48));value.put("ballOpacity",prefs.getInt("ball_opacity",90));
            value.put("ballShape",prefs.getString("ball_shape","circle"));value.put("ballPosition",prefs.getString("ball_position","right-bottom"));
            value.put("icon",prefs.getString("launcher_icon","ink"));
            value.put("loadingAnimationCustom",appearance.customLoadingAnimation());
            value.put("loadingAnimationUrl",ORIGIN+"/loading-animation.gif?v="+appearance.loadingAnimationVersion());
            if(appearance.image("ball").exists())value.put("ballImage",ORIGIN+"/image/ball?v="+appearance.image("ball").lastModified());
            if(appearance.image("shortcut").exists())value.put("shortcutImage",ORIGIN+"/image/shortcut?v="+appearance.image("shortcut").lastModified());
        }catch(Exception ignored){}
        return value;
    }
    private WebResourceResponse asset(Uri uri){
        try{
            if(!"https".equals(uri.getScheme())||!"bainiao.local".equals(uri.getHost()))return empty(403);
            String path=uri.getPath();
            if("/loading-animation.gif".equals(path))return new WebResourceResponse("image/gif",null,appearance.openLoadingAnimation());
            if("/cover".equals(path)){
                String avatar=uri.getQueryParameter("avatar");
                if(avatar==null||avatar.isEmpty())return empty(404);
                Snapshot snapshot=new Snapshot(prefs);
                SessionClient.StreamResponse response=client.requestStream(snapshot.url,snapshot.user,snapshot.password,"GET","/characters/"+Uri.encode(avatar),null,null);
                String mime=response.contentType==null?"image/png":response.contentType.split(";")[0];
                try{return new WebResourceResponse(mime,null,response.status,response.status==200?"OK":"Image unavailable",Collections.emptyMap(),response.body);}
                catch(RuntimeException error){response.close();throw error;}
            }
            if(path!=null&&path.startsWith("/image/")){
                String target=path.substring(7);if(!target.equals("ball")&&!target.equals("shortcut"))return empty(404);
                return new WebResourceResponse("image/png",null,new FileInputStream(appearance.image(target)));
            }
            String name="/home.html".equals(path)?"home.html":"/home.css".equals(path)?"home.css":"/home.js".equals(path)?"home.js":"/rain-glass.js".equals(path)?"rain-glass.js":"/rain-background.webp".equals(path)?"rain-background.webp":"/icon-stone.png".equals(path)?"icon-stone.png":"/icon-bluebird.jpg".equals(path)?"icon-bluebird.jpg":"/icon-redbird.jpg".equals(path)?"icon-redbird.jpg":"/LICENSE.txt".equals(path)?"LICENSE.txt":"/ASSET-LICENSES.txt".equals(path)?"ASSET-LICENSES.txt":null;
            if(name==null)return empty(404);
            String mime=name.endsWith("png")?"image/png":name.endsWith("jpg")?"image/jpeg":name.endsWith("webp")?"image/webp":name.endsWith("css")?"text/css":name.endsWith("js")?"text/javascript":name.endsWith("txt")?"text/plain":"text/html";
            return new WebResourceResponse(mime,name.endsWith("png")||name.endsWith("jpg")||name.endsWith("webp")?null:"UTF-8",activity.getAssets().open("bainiao/"+name));
        }catch(Exception e){PerfLog.w("HomeRequest","asset failed path="+uri.getPath());return empty(404);}
    }
    private WebResourceResponse empty(int status){return new WebResourceResponse("text/plain","UTF-8",status,"Unavailable",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    private static final class Snapshot {
        final String url,user,password;
        Snapshot(SharedPreferences prefs){ConnectionSettings.Saved connection=ConnectionSettings.read(prefs);url=connection.url;user=connection.username;password=connection.password;}
    }
    private final class LocalBridge {
        @JavascriptInterface public void dispatch(String raw){
            activity.runOnUiThread(()->{
                try{
                    JSONObject command=new JSONObject(raw);int id=command.getInt("id");String action=command.getString("action");JSONObject data=command.optJSONObject("data");
                    if(data==null)data=new JSONObject();handle(id,action,data);
                }catch(Exception e){PerfLog.w("HomeBridge","invalid local command");}
            });
        }
    }
    private void handle(int id,String action,JSONObject data){
        try{
            switch(action){
                case "state":reply(id,state(),null);return;
                case "checkUpdates":{
                    final WebView destination=view;
                    host.checkUpdates((message,error)->{
                        JSONObject result=new JSONObject();try{result.put("message",message);}catch(Exception ignored){}
                        replyTo(destination,id,result,error);
                    });return;
                }
                case "appUpdateAction":host.appUpdateAction(data.getString("operation"));reply(id,new JSONObject(),null);return;
                case "saveConnection":{
                    ConnectionSettings.Saved before=ConnectionSettings.read(prefs);
                    String url=data.getString("url").trim();
                    if(!UrlKit.isAllowedServerUrl(url)||Uri.parse(url).getUserInfo()!=null)throw new Exception("请填写完整的 http:// 或 https:// 酒馆地址；公网地址请使用 https://。");
                    String username=data.getString("username");String password=data.getString("password");
                    if(ConnectionSettings.save(prefs,url,username,password,host::clearHttpAuthentication)){
                        pluginApi.clear();
                        if(!before.url.equals(url)||!before.username.equals(username)||!before.password.equals(password))host.connectionChanged();
                        PerfLog.i("Home","connection settings saved");
                    }
                    reply(id,new JSONObject().put("url",url).put("username",username).put("password",password),null);return;
                }
                case "saveAddress":{
                    String url=data.getString("url").trim();
                    if(!UrlKit.isAllowedServerUrl(url)||Uri.parse(url).getUserInfo()!=null)throw new Exception("请先编辑有效的酒馆地址。");
                    ConnectionSettings.Saved saved=ConnectionSettings.read(prefs);
                    if(ConnectionSettings.save(prefs,url,saved.username,saved.password,host::clearHttpAuthentication)){
                        pluginApi.clear();
                        if(!saved.url.equals(url))host.connectionChanged();
                    }
                    reply(id,new JSONObject().put("url",url),null);return;
                }
                case "connectionAction":{
                    String operation=data.getString("operation");
                    if(operation.equals("cache")){
                        if(view!=null)view.clearCache(true);host.clearLegacyCache();
                        PerfLog.i("Home","WebView cache cleared; Cookie retained");reply(id,state(),null);
                    }else if(operation.equals("logout")||operation.equals("delete")){
                        host.clearConnection(operation.equals("delete"),()->{
                            // CSRF belongs to the Cookie session just cleared by the host.
                            csrf="";csrfOrigin="";
                            pluginApi.clear();
                            if(operation.equals("logout")||operation.equals("delete"))host.connectionChanged();
                            reply(id,state(),null);
                        });
                    }else throw new Exception("请选择连接操作。");
                    return;
                }
                case "diagnostic":{
                    String kind=data.getString("kind");final WebView destination=view;
                    io.execute(()->{try{
                        String text;
                        if(kind.equals("log")){PerfLog.flushAndWait();text=PerfLog.tail(32*1024);}
                        else if(kind.equals("report"))text=PerfMonitor.report();
                        else throw new Exception("请选择诊断内容。");
                        replyTo(destination,id,new JSONObject().put("text",text),null);
                    }catch(Exception error){replyTo(destination,id,null,"诊断读取失败，请稍后重试。");}});return;
                }
                case "setting":applySetting(data);host.settingsChanged(data.getString("key"));reply(id,state(),null);return;
                case "enter":reply(id,new JSONObject(),null);host.enterBrowser();return;
                case "closeBrowser":host.closeBrowser();reply(id,state(),null);return;
                case "systemPermission":host.openSystemPermission(data.getString("target"));reply(id,new JSONObject(),null);return;
                case "exportLog":host.exportLog();reply(id,new JSONObject(),null);return;
                case "pickImage":host.pickImage(data.getString("target"));reply(id,new JSONObject(),null);return;
                case "resetLoadingAnimation":appearance.resetLoadingAnimation();reply(id,state(),null);return;
                default:break;
            }
            final Snapshot snapshot=new Snapshot(prefs);
            final WebView destination=view;
            if(snapshot.url.isEmpty())throw new Exception("请先保存酒馆地址。");
            ExecutorService executor = (action.equals("characters") || action.equals("character")) ? libraryIo : io;
            executor.execute(()->{
                try{Object value=network(action,data,snapshot);replyTo(destination,id,value,null);}
                catch(Exception e){PerfLog.w("HomeRequest",action+" failed (no response content logged)");replyTo(destination,id,null,e.getMessage()==null?"连接失败，请检查酒馆地址和网络后重试。":e.getMessage());}
            });
        }catch(Exception e){reply(id,null,e.getMessage());}
    }
    private void applySetting(JSONObject data)throws Exception{
        String key=data.getString("key");SharedPreferences.Editor edit=prefs.edit();
        switch(key){
            case "frameRate":{
                int value=data.getInt("value");if(value!=0&&(value<5||value>240))throw new Exception("请输入 5–240 之间的帧率。");
                edit.putInt("frame_rate_limit",value);break;
            }
            case "idleMode":{int value=data.getInt("value");if(value<0||value>2)throw new Exception("请选择挂机模式。");edit.putInt("idle_mode_v2",value);break;}
            case "perfMonitor":edit.putBoolean("perf_monitor",data.getBoolean("value"));break;
            case "verboseLog":edit.putBoolean("verbose_log",data.getBoolean("value"));break;
            case "replyNotifications":edit.putBoolean("reply_notifications",data.getBoolean("value"));break;
            case "keepalive":edit.putBoolean("pause_in_background",!data.getBoolean("value"));break;
            case "keepScreenOn":edit.putBoolean("keep_screen_on",data.getBoolean("value"));break;
            case "ballEnabled":{
                boolean enabled=data.getBoolean("value");
                if(enabled&&!appearance.overlayAllowed()){appearance.askOverlayPermission();throw new Exception("请允许千机伞显示在其他应用上层，返回后再次开启悬浮球。");}
                edit.putBoolean("ball_enabled",enabled);break;
            }
            case "ballSize":edit.putInt("ball_size",Math.max(40,Math.min(64,data.getInt("value"))));break;
            case "ballOpacity":edit.putInt("ball_opacity",Math.max(40,Math.min(100,data.getInt("value"))));break;
            case "ballShape":{String value=data.getString("value");if(!value.equals("circle")&&!value.equals("rounded"))throw new Exception("请选择悬浮球形状。");edit.putString("ball_shape",value);break;}
            case "ballPosition":{String value=data.getString("value");if(!java.util.Arrays.asList("right-bottom","left-bottom","right-top","left-top").contains(value))throw new Exception("请选择悬浮球位置。");edit.putString("ball_position",value);break;}
            case "icon":{String value=data.getString("value");appearance.selectLauncherIcon(value);edit.putString("launcher_icon",value);break;}
            default:throw new Exception("此设置暂不可用。");
        }
        edit.apply();PerfLog.i("HomeSettings",key+" saved and applied");
    }
    private Object network(String action,JSONObject data,Snapshot snapshot)throws Exception{
        switch(action){
            case "status":{
                pluginApi.clear();
                ensureCsrf(snapshot);Object user=json(snapshot,"GET","/api/users/me",null,false);JSONObject result=new JSONObject().put("user",user);
                try{result.put("health",json(snapshot,"GET","/api/plugins/st-bainiaodata/v1/health",null,false));}
                catch(Exception e){result.put("healthError",e.getMessage());}
                if(user instanceof JSONObject&&((JSONObject)user).optBoolean("admin",false)){
                    try{
                        JSONObject health=result.optJSONObject("health");
                        JSONObject capabilities=health==null?null:health.optJSONObject("capabilities");
                        pluginApi.select(snapshot.url,capabilities!=null&&capabilities.optBoolean("serverPluginManagement",false));
                        Object listed=json(snapshot,"POST",pluginApi.listPath(snapshot.url),new JSONObject(),true);
                        if(listed instanceof JSONObject)result.put("plugins",((JSONObject)listed).optJSONArray("plugins"));
                    }catch(Exception error){result.put("pluginsError",error.getMessage());}
                }else result.put("pluginsError","使用管理员账号登录后可管理服务端插件。");
                return result;
            }
            case "plugins":ensureCsrf(snapshot);return json(snapshot,"POST",pluginApi.listPath(snapshot.url),new JSONObject(),true);
            case "updatePlugin":ensureCsrf(snapshot);return json(snapshot,"POST",pluginApi.updatePath(snapshot.url),new JSONObject().put("directory",data.getString("directory")),true);
            case "characters":ensureCsrf(snapshot);return projectCards(json(snapshot,"POST","/api/characters/all",new JSONObject(),false));
            case "character":ensureCsrf(snapshot);return projectCard(json(snapshot,"POST","/api/characters/get",new JSONObject().put("avatar_url",data.getString("avatar")),false));
            default:throw new Exception("此操作暂不可用。");
        }
    }
    private synchronized void ensureCsrf(Snapshot snapshot)throws Exception{if(csrf.isEmpty()||!csrfOrigin.equals(snapshot.url))obtainCsrf(snapshot);}
    private synchronized void obtainCsrf(Snapshot snapshot)throws Exception{
        Object value=json(snapshot,"GET","/csrf-token",null,false);
        if(!(value instanceof JSONObject)||((JSONObject)value).optString("token").isEmpty())throw new Exception("无法读取登录会话，请先进入酒馆登录，再回首页检查。");
        csrf=((JSONObject)value).getString("token");csrfOrigin=snapshot.url;
    }
    /** Only fields consumed by the local card list/detail cross the JS bridge. */
    private static Object projectCards(Object value) throws Exception {
        if (value instanceof JSONArray) {
            JSONArray source=(JSONArray)value, result=new JSONArray();
            for(int i=0;i<source.length();i++)result.put(projectCard(source.opt(i)));
            return result;
        }
        return value;
    }
    private static Object projectCard(Object value) throws Exception {
        if (!(value instanceof JSONObject)) return value;
        JSONObject source=(JSONObject)value, result=new JSONObject();
        copy(source,result,"avatar");copy(source,result,"name");copy(source,result,"tags");copy(source,result,"shallow");copy(source,result,"creator");
        Object data=source.opt("data");
        if (data instanceof JSONObject) {
            JSONObject compact=new JSONObject();
            for(String key:new String[]{"name","description","personality","scenario","first_mes","alternate_greetings"})copy((JSONObject)data,compact,key);
            result.put("data",compact);
        } else if (data != null && data != JSONObject.NULL) result.put("data",data);
        for(String key:new String[]{"description","personality","scenario","first_mes","alternate_greetings"})copy(source,result,key);
        return result;
    }
    private static void copy(JSONObject source,JSONObject target,String key){if(source.has(key))try{target.put(key,source.get(key));}catch(Exception ignored){}}
    private Object json(Snapshot snapshot,String method,String path,JSONObject body,boolean admin)throws Exception{
        SessionClient.Response response;
        try{response=client.request(snapshot.url,snapshot.user,snapshot.password,method,path,body==null?null:body.toString(),body==null?null:csrf);}
        catch(java.io.IOException e){throw new Exception("连接失败，请检查酒馆地址和网络后重试。");}
        if(response.status>=300){
            if(ServerPluginApi.isManagedPath(path)){
                String message="";
                try{Object error=new JSONTokener(response.text()).nextValue();if(error instanceof JSONObject)message=((JSONObject)error).optString("message","");}catch(Exception ignored){}
                if(!message.trim().isEmpty())throw new Exception(message);
            }
            if(response.status==401||response.status==302||response.status==303)throw new Exception("请先进入酒馆完成登录，再回首页重试。");
            if(response.status==403)throw new Exception(admin?"请先进入酒馆，使用管理员账号登录后重试。":"请先进入酒馆完成登录，再回首页重试。");
            if(response.status==404)throw new Exception(path.contains("plugins/list")||path.contains("plugins/update")?"当前接口未提供插件管理，请在服务器更新并启用白鳥 data，再检查连接。":path.contains("st-bainiaodata")?"请在酒馆服务端安装并启用白鳥 data，再检查连接。":"酒馆未提供此功能，请检查服务器版本。");
            throw new Exception("酒馆处理失败（"+response.status+"），请稍后重试。");
        }
        try{
            Object value=new JSONTokener(response.text()).nextValue();
            if(!(value instanceof JSONObject)&&!(value instanceof JSONArray))throw new Exception();
            PerfLog.i("HomeRequest",path+" parsed");return value;
        }catch(Exception e){throw new Exception("酒馆返回了登录页或无法读取的内容，请先进入酒馆检查登录。");}
    }
    private void reply(int id,Object value,String error){ replyTo(view,id,value,error); }
    private void replyTo(WebView destination,int id,Object value,String error){
        activity.runOnUiThread(()->{
            if(destination==null||view!=destination)return;
            JSONObject result=new JSONObject();try{result.put("ok",error==null);if(error==null)result.put("value",value);else result.put("error",error);}catch(Exception ignored){}
            view.evaluateJavascript("window.BainiaoApp && window.BainiaoApp.resolve("+id+","+result+")",null);
        });
    }
}
