package io.github.flashsky1024.tavernium;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Movie;
import android.graphics.Outline;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

/** User-selected local images, actual launcher aliases and the independent optional overlay. */
final class LocalAppearance {
    private final Activity activity;
    private final SharedPreferences prefs;
    private final WindowManager manager;
    private final LoadingAnimationFile loading;
    private View overlay;
    LocalAppearance(Activity activity,SharedPreferences prefs){this.activity=activity;this.prefs=prefs;this.manager=(WindowManager)activity.getSystemService(Activity.WINDOW_SERVICE);this.loading=new LoadingAnimationFile(activity.getFilesDir());}
    private Intent launcherIntent(){return new Intent(activity,MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);}
    void updateExistingShortcutIntent(){
        if(Build.VERSION.SDK_INT<26)return;
        ShortcutManager shortcuts=activity.getSystemService(ShortcutManager.class);
        if(shortcuts==null)return;
        for(ShortcutInfo existing:shortcuts.getPinnedShortcuts())if(existing.getId().equals("bainiao-custom")){
            shortcuts.updateShortcuts(java.util.Collections.singletonList(new ShortcutInfo.Builder(activity,"bainiao-custom").setShortLabel("千机伞").setLongLabel("千机伞 · 自选图片入口").setIntent(launcherIntent()).build()));
            return;
        }
    }
    boolean overlayAllowed(){return Settings.canDrawOverlays(activity);}
    void askOverlayPermission(){activity.startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+activity.getPackageName())));}
    File image(String target){return new File(activity.getFilesDir(),"bainiao-"+target+".png");}
    boolean customLoadingAnimation(){return loading.isCustom();}
    long loadingAnimationVersion(){return loading.version();}
    InputStream openLoadingAnimation()throws java.io.IOException{return loading.open(()->activity.getAssets().open("bainiao/loading-dove.gif"));}
    void resetLoadingAnimation()throws java.io.IOException{loading.reset();}
    void saveImage(Uri uri,String target)throws Exception{
        if(target.equals("loading")){
            try(InputStream input=activity.getContentResolver().openInputStream(uri)){
                if(input==null)throw new Exception("无法读取 GIF，请重新选择文件。");
                loading.replace(input,file->{Movie movie=Movie.decodeFile(file.getAbsolutePath());if(movie==null||movie.width()<=0||movie.height()<=0)throw new Exception("无法播放这个 GIF，请选择其他 GIF 文件。");});
            }
            PerfLog.i("Appearance","loading GIF saved locally without conversion");return;
        }
        final int bound=target.equals("ball")?192:256;
        BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;
        try(InputStream in=activity.getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,options);}
        if(options.outWidth<=0||options.outHeight<=0)throw new Exception("无法读取这张图片，请选择普通图片文件。");
        options.inJustDecodeBounds=false;options.inSampleSize=1;
        while(Math.max(options.outWidth,options.outHeight)/options.inSampleSize>bound*2)options.inSampleSize*=2;
        Bitmap decoded;
        try(InputStream in=activity.getContentResolver().openInputStream(uri)){decoded=BitmapFactory.decodeStream(in,null,options);}
        if(decoded==null)throw new Exception("无法读取这张图片，请重新选择。");
        float scale=Math.min(1f,(float)bound/Math.max(decoded.getWidth(),decoded.getHeight()));
        Bitmap saved=Bitmap.createScaledBitmap(decoded,Math.max(1,Math.round(decoded.getWidth()*scale)),Math.max(1,Math.round(decoded.getHeight()*scale)),true);
        try(FileOutputStream out=new FileOutputStream(image(target))){if(!saved.compress(Bitmap.CompressFormat.PNG,100,out))throw new Exception("图片保存失败，请重新选择。");}
        if(saved!=decoded)saved.recycle();decoded.recycle();
        PerfLog.i("Appearance",target+" image saved locally");
    }
    void selectLauncherIcon(String choice)throws Exception{
        String[] choices={"ink","stone","moss","bluebird","redbird"};String[] aliases={"Ink","Stone","Moss","Bluebird","Redbird"};int selected=-1;
        for(int i=0;i<choices.length;i++)if(choices[i].equals(choice))selected=i;
        if(selected<0)throw new Exception("请选择内置图标。");
        PackageManager pm=activity.getPackageManager();String namespace=MainActivity.class.getPackage().getName();
        pm.setComponentEnabledSetting(new ComponentName(activity,namespace+".Launcher"+aliases[selected]),PackageManager.COMPONENT_ENABLED_STATE_ENABLED,PackageManager.DONT_KILL_APP);
        for(int i=0;i<aliases.length;i++)if(i!=selected)pm.setComponentEnabledSetting(new ComponentName(activity,namespace+".Launcher"+aliases[i]),PackageManager.COMPONENT_ENABLED_STATE_DISABLED,PackageManager.DONT_KILL_APP);
    }
    void pinShortcut()throws Exception{
        if(Build.VERSION.SDK_INT<26)throw new Exception("自选图片桌面快捷入口需要 Android 8 或更新版本。内置图标可正常切换。");
        ShortcutManager shortcuts=activity.getSystemService(ShortcutManager.class);
        if(shortcuts==null||!shortcuts.isRequestPinShortcutSupported())throw new Exception("当前桌面未提供添加快捷入口功能，请使用内置图标。");
        Bitmap bitmap=BitmapFactory.decodeFile(image("shortcut").getAbsolutePath());
        if(bitmap==null)throw new Exception("请先选择一张图片。");
        ShortcutInfo info=new ShortcutInfo.Builder(activity,"bainiao-custom").setShortLabel("千机伞").setLongLabel("千机伞 · 自选图片入口")
                .setIcon(Icon.createWithBitmap(bitmap)).setIntent(launcherIntent()).build();
        if(shortcuts.isRequestPinShortcutSupported()){
            shortcuts.updateShortcuts(java.util.Collections.singletonList(info));
            if(!shortcuts.requestPinShortcut(info,null))throw new Exception("桌面未接受快捷入口，请使用内置图标。");
            Toast.makeText(activity,"请按系统提示添加桌面快捷入口",Toast.LENGTH_LONG).show();
        }
    }
    void hideOverlay(){if(overlay==null)return;try{manager.removeView(overlay);}catch(IllegalArgumentException ignored){}overlay=null;PerfLog.i("Overlay","removed");}
    void showOverlay(boolean browserOpen,Runnable back,Runnable refresh){
        hideOverlay();
        if(!browserOpen||!prefs.getBoolean("ball_enabled",false)||!overlayAllowed())return;
        LinearLayout row=new LinearLayout(activity);row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER);
        LinearLayout menu=new LinearLayout(activity);menu.setOrientation(LinearLayout.VERTICAL);menu.setVisibility(View.GONE);
        Button home=new Button(activity);home.setText("返回首页");home.setOnClickListener(v->back.run());
        Button reload=new Button(activity);reload.setText("刷新页面");reload.setOnClickListener(v->{menu.setVisibility(View.GONE);refresh.run();});menu.addView(home);menu.addView(reload);
        ImageView ball=new ImageView(activity);ball.setContentDescription("千机伞快捷操作");ball.setScaleType(ImageView.ScaleType.CENTER_CROP);
        Bitmap bitmap=BitmapFactory.decodeFile(image("ball").getAbsolutePath());
        if(bitmap!=null)ball.setImageBitmap(bitmap);else ball.setImageResource(R.drawable.icon_ink);
        GradientDrawable background=new GradientDrawable();background.setColor(Color.parseColor("#eeeee7"));
        boolean rounded="rounded".equals(prefs.getString("ball_shape","circle"));int size=dp(prefs.getInt("ball_size",48));
        background.setCornerRadius(rounded?dp(12):size/2f);ball.setBackground(background);ball.setClipToOutline(true);ball.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        ball.setAlpha(prefs.getInt("ball_opacity",90)/100f);ball.setOnClickListener(v->{menu.setVisibility(menu.getVisibility()==View.VISIBLE?View.GONE:View.VISIBLE);});
        row.addView(menu);row.addView(ball,new LinearLayout.LayoutParams(size,size));
        int type=Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams params=new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.WRAP_CONTENT,type,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,PixelFormat.TRANSLUCENT);
        String position=prefs.getString("ball_position","right-bottom");
        params.gravity=(position.startsWith("left")?Gravity.LEFT:Gravity.RIGHT)|(position.endsWith("top")?Gravity.TOP:Gravity.BOTTOM);params.x=dp(12);params.y=dp(90);
        try{manager.addView(row,params);overlay=row;PerfLog.i("Overlay","shown independent of keepalive");}
        catch(RuntimeException e){Toast.makeText(activity,"悬浮球未能显示，请检查系统悬浮窗权限。",Toast.LENGTH_LONG).show();}
    }
    private int dp(int value){return Math.round(value*activity.getResources().getDisplayMetrics().density);}
}
