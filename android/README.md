# 千机伞 Android

当前试用版：**0.1.8-trial**（versionCode 9）。

从 [Releases 下载安装包](https://github.com/atonal519/ST-MyriadUmbrella/releases/download/apk-v0.1.8-trial/qianjisan-0.1.8-trial.apk)，源码与构建文件位于本目录。

Android 7.0 及以上可用。已有千机伞试用版可直接覆盖安装，保留本机连接与偏好。线上更新源已接通，0.1.6 起可在首页右上角检查、下载更新，再按系统提示安装。

这是连接自有 SillyTavern / Luker 服务端的 WebView 浏览器。首页集中放置连接、服务端插件状态、卡库与设置。返回首页会保留当前酒馆页，点右侧“返回酒馆”继续原页面；需要重新加载时，先点左侧“关闭页面”再进入。

- 卡库每行四张，支持搜索、开场白分页和手动刷新，复用本次已读取的列表、详情和封面。
- 后台保活、悬浮球分别设置。偏好、加载 GIF、图标与本地页面日夜颜色由 App 管理。
- App 和酒馆扩展共仓维护，各自更新。服务端插件更新仍使用服务器管理员接口。

## 构建

需要 JDK 17、Android SDK Platform 36、Build Tools 36.0.0。Gradle 9.6.0 由项目 wrapper 固定。

```sh
cd android/tavernium
./gradlew lintDebug assembleDebug
```

安装包位于 `app/build/outputs/apk/debug/qianjisan-debug-0.1.8-trial.apk`。本地重新构建会使用构建者自己的签名；仓库不包含发布签名密钥。

## 发布更新

APK 版本和 versionCode 在 `tavernium/app/build.gradle` 中维护。发布时沿用同一应用包名及签名，递增 versionCode。

1. 构建并核验 APK，发布文件命名为 `qianjisan-<versionName>.apk`。
2. 用 Android SDK 的 `aapt2`、`apksigner` 加入 PATH 后运行：

   ```sh
   python3 scripts/create-trial-update.py qianjisan-0.1.8-trial.apk \
     --notes '本次更新说明' --output qianjisan-trial-update.json
   ```

3. 将 APK 上传到本仓库对应的 `apk-v<versionName>` Release，再更新仓库 main 根目录的 `qianjisan-trial-update.json`。

App 直接读取固定 Raw 清单，按实际版本、文件大小、SHA256、应用包名和签名核验安装包。前端插件版本使用独立的扩展清单。

## 来源与许可

基于 [flashsky1024/tavernium](https://github.com/flashsky1024/tavernium)，上游基线 `86b63647e6f6b6bb0c8fb156c11df9ebb4dd2f91`，本目录包含千机伞修改后的对应源码和构建文件，沿用 [GNU AGPL v3](LICENSE)。

第三方图标与动画署名见 [ASSET-LICENSES.txt](tavernium/app/src/main/assets/bainiao/ASSET-LICENSES.txt)。
