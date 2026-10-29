# 千机伞 Android

当前公开版本：**0.2.4**（versionCode 24）。

从 [Releases 下载安装包](https://github.com/atonal519/ST-MyriadUmbrella/releases/download/apk-v0.2.4/qianjisan-0.2.4.apk)，源码与构建文件位于本目录。

Android 7.0 及以上可用。已有千机伞试用版可直接覆盖安装，保留本机连接与偏好。旧版可在首页右上角检查、下载更新，再按系统提示覆盖安装。0.2.4 启动后会静默检查一次；发现更高版本时，可直接在当前酒馆页面上方查看提醒，点“稍后”继续原页面。首页仍保留手动检查。

这是连接自有 SillyTavern / Luker 服务端的 WebView 浏览器。首页集中放置连接、服务端插件状态、卡库与设置。返回首页会保留当前酒馆页，点右侧“返回酒馆”继续原页面；需要重新加载时，先点左侧“关闭页面”再进入。

- 首页卡库下方新增「主题联动」抽屉，可绑定浅色、深色两套已保存的酒馆主题，开启后随手机系统模式自动切换。默认关闭，关闭后保留当前酒馆主题。
- 修复 Luker 已加载后主题列表仍提示“酒馆尚未就绪”的问题。
- 支持预设、世界书、主题、人格、正则、QR 等共用的 Blob/data 文件导出，兼容临时下载链接和弹层中的头像下载；普通图片及受登录保护的 HTTP 下载复用当前会话，文件保存在手机“下载/SillyTavern”。网页生成的 Blob 文件保留约 48 MiB 的原有大小上限。
- 加载白鸽保持固定小尺寸，避免部分美化主题把动画放大铺满屏幕；保留原生酒馆的标志、初始化文字和加载结束时机。
- 卡库每行四张，支持搜索、开场白分页和手动刷新，复用本次已读取的列表、详情和封面。
- 后台保活、悬浮球分别设置。偏好、加载 GIF、图标与本地页面日夜颜色由 App 管理。
- 首页使用动态雨窗，水珠聚集后滑落，跟随日夜配色；静止雨珠使用缓存，减少每帧重复绘制。离开首页、切后台或横幅离开视窗时停止动画；减少动画时保留静态画面。
- 酒馆操作使用柔和配色和状态灯，标题字号与顶部留白已调整。标题右侧的连接状态可点击刷新，独立“检查连接”行已合并。
- 开启保活时，远端网页保留活动窗口状态；切后台时停止绘制，返回首页也保持酒馆页挂载，再进入继续同一页面。该后台策略已在 0.2.1 通过用户 ColorOS 17 真机的后台回复通知验证。
- 偏好新增“显示手机状态栏”，默认开启。酒馆状态栏跟随酒馆主题配色，自动调整时间、电量图标深浅；回本地页面恢复 App 日夜配色。防烧屏模式同时隐藏顶部状态栏和底部导航，解除后恢复当前选择。
- 更新说明、下载进度和安装权限说明使用页内弹窗，跟随系统日夜主题；关闭下载弹窗会取消下载，已下载安装包可继续安装。最后的安装确认由 Android 系统显示。
- App 和酒馆扩展共仓维护，各自更新。服务端插件更新仍使用服务器管理员接口。

## 构建

需要 JDK 17、Android SDK Platform 36、Build Tools 36.0.0。Gradle 9.6.0 由项目 wrapper 固定。

```sh
cd android/tavernium
./gradlew lintDebug assembleDebug
```

安装包位于 `app/build/outputs/apk/debug/qianjisan-debug-0.2.4.apk`。当前公开附件沿用上述已验证的 debug 构建流程与维护者保留的同一签名，兼容已有安装；仓库不包含签名私钥。本地重新构建会使用构建者自己的签名。

## 发布更新

APK 版本和 versionCode 在 `tavernium/app/build.gradle` 中维护。发布时沿用同一应用包名及签名，递增 versionCode。

1. 构建并核验 APK，发布文件命名为 `qianjisan-<versionName>.apk`。
2. 用 Android SDK 的 `aapt2`、`apksigner` 加入 PATH 后运行：

   ```sh
   python3 scripts/create-trial-update.py qianjisan-0.2.4.apk \
     --notes '本次更新说明' --output qianjisan-trial-update.json
   ```

3. 将 APK 上传到本仓库对应的 `apk-v<versionName>` Release，再更新仓库 main 根目录的 `qianjisan-trial-update.json`。

为兼容已安装的旧客户端，清单内部 `channel` 仍保留 `trial`；它与 GitHub Release 的 prerelease 标记独立，0.2.4 为正式公开发布。不要直接改为 `stable`，旧客户端会过滤掉该条更新。

App 直接读取固定 Raw 清单，按实际版本、文件大小、SHA256、应用包名和签名核验安装包。前端插件版本使用独立的扩展清单。

## 来源与许可

基于 [flashsky1024/tavernium](https://github.com/flashsky1024/tavernium)，上游基线 `86b63647e6f6b6bb0c8fb156c11df9ebb4dd2f91`，本目录包含千机伞修改后的对应源码和构建文件，沿用 [GNU AGPL v3](LICENSE)。

第三方图标与动画署名见 [ASSET-LICENSES.txt](tavernium/app/src/main/assets/bainiao/ASSET-LICENSES.txt)。
