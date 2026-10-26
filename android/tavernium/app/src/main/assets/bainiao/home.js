(() => {
 'use strict';
 const root=document.getElementById('bn-home-preview'), get=id=>document.getElementById(id);
 const pending=new Map();let nextId=0,state={},cards=[],cardsSourceKey='',cardsLoaded=false,currentView='home',editDirty=false,currentDetail=null,coverObserver=null;
 const names={ink:'墨伞',stone:'白鳥',moss:'青伞',bluebird:'蓝翼',redbird:'剪纸'};
 let updateActionBusy=false,updateOperation='',updateNotice=false,homeStatusStarted=false;
 let statusRequest=null;
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const systemTheme=window.matchMedia('(prefers-color-scheme: dark)');
 systemTheme.addEventListener('change',()=>{if(typeof state.dark!=='boolean')bainiaoRainGlass.render(systemTheme.matches);});
 /* Heading and action SVGs: Lucide, https://github.com/lucide-icons/lucide/tree/main/icons
    Umbrella presets use the same official Lucide geometry; the approved dove preset is a local PNG.
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

 */
 const iconNodes={
  "umbrella": "<path d=\"M12 13v7a2 2 0 0 0 4 0\" /><path d=\"M12 2v2\" /><path d=\"M20.992 13a1 1 0 0 0 .97-1.274 10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z\" />",
  "arrow-right": "<path d=\"M5 12h14\" /><path d=\"m12 5 7 7-7 7\" />",
  "arrow-up-right": "<path d=\"M7 7h10v10\" /><path d=\"M7 17 17 7\" />",
  "x": "<path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" />",
  "book-open": "<path d=\"M12 5v16\" /><path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\" />",
  "chevron-left": "<path d=\"m15 18-6-6 6-6\" />",
  "chevron-right": "<path d=\"m9 18 6-6-6-6\" />",
  "house": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" /><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" />",
  "image-plus": "<path d=\"M16 5h6\" /><path d=\"M19 2v6\" /><path d=\"M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5\" /><path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\" /><circle cx=\"9\" cy=\"9\" r=\"2\" />",
  "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /><path d=\"m15 5 4 4\" />",
  "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" />",
  "server": "<rect width=\"20\" height=\"8\" x=\"2\" y=\"2\" rx=\"2\" ry=\"2\" /><rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" ry=\"2\" /><line x1=\"6\" x2=\"6.01\" y1=\"6\" y2=\"6\" /><line x1=\"6\" x2=\"6.01\" y1=\"18\" y2=\"18\" />",
  "settings": "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\" /><circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "sliders-horizontal": "<path d=\"M10 5H3\" /><path d=\"M12 19H3\" /><path d=\"M14 3v4\" /><path d=\"M16 17v4\" /><path d=\"M21 12h-9\" /><path d=\"M21 19h-5\" /><path d=\"M21 5h-7\" /><path d=\"M8 10v4\" /><path d=\"M8 12H3\" />"
};
 function iconize(){root.querySelectorAll('i[data-lucide]').forEach(el=>{
  const name=el.dataset.lucide,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.setAttribute('class',el.className);svg.dataset.icon=name;svg.innerHTML=iconNodes[name]||iconNodes.umbrella;el.replaceWith(svg);
 });}
 function request(action,data={}){return new Promise((resolve,reject)=>{
  const id=++nextId;pending.set(id,{resolve,reject});
  if(!window.BainiaoNative){pending.delete(id);reject(new Error('请在千机伞 App 中打开此页面。'));return;}
  window.BainiaoNative.dispatch(JSON.stringify({id,action,data}));
 });}
 function feedback(text,error=false){get('bn-feedback').textContent=text;get('bn-feedback').hidden=!text;get('bn-feedback').classList.toggle('bn-feedback-error',error);}
 function act(fn){return async event=>{try{await fn(event);}catch(error){if(get('bn-connection-dialog').open){get('bn-connection-error').textContent=error.message;get('bn-connection-error').hidden=false;}else feedback(error.message,true);}};}
 function closeEdit(){get('bn-connection-dialog').close();editDirty=false;}
 function fillEdit(){get('bn-edit-url').value=state.url||'';get('bn-username').value=state.username||'';get('bn-password').value=state.password||'';}
 function openEdit(){editDirty=false;fillEdit();get('bn-connection-error').hidden=true;get('bn-connection-dialog').showModal();}
 function setConnectionStatus(kind,text){
  const status=get('bn-connection-status'),refresh=get('bn-status-refresh');status.textContent=text;status.dataset.state=kind;
  root.querySelector('.bn-connection').dataset.state=kind;refresh.disabled=kind==='checking';refresh.setAttribute('aria-busy',String(kind==='checking'));
  refresh.setAttribute('aria-label',text+'，'+(state.url?'刷新酒馆和插件状态':'添加酒馆地址'));refresh.title=state.url?'点击刷新酒馆和插件状态':'添加酒馆地址';
 }
 function resetStatus(){statusRequest=null;setConnectionStatus('idle',state.url?'待检查':'未设置');get('bn-plugin-list').replaceChildren();get('bn-plugin-list').append(Object.assign(document.createElement('p'),{className:'bn-inline-note',textContent:state.url?'点击上方状态可刷新插件信息。':'添加连接后自动读取插件状态。'}));get('bn-plugin-message').hidden=true;}
 function showView(view){
  if(currentView==='library'&&view!=='library'){closeDetail();clearCoverObserver();get('bn-detail-content').replaceChildren();}
  currentView=view;root.dataset.view=view;get('bn-home').hidden=view!=='home';get('bn-system-page').hidden=view!=='system';get('bn-library-page').hidden=view!=='library';bainiaoRainGlass.sync();feedback('');updateLoadingPreview();window.scrollTo(0,0);
 }
 window.BainiaoApp={ready:false,resolve(id,result){const task=pending.get(id);if(!task)return;pending.delete(id);result.ok?task.resolve(result.value):task.reject(new Error(result.error||'操作未完成，请重试。'));},back(){
  if(get('bn-update-dialog').open){closeUpdate();return true;}
  if(get('bn-connection-dialog').open){closeEdit();return true;}
  if(!get('bn-card-detail').hidden){closeDetail();return true;}
  if(currentView!=='home'){showView('home');return true;}return false;
 },updateChanged(value){state.appUpdate=value;updateActionBusy=false;renderUpdate();},stateChanged(value){if(value.browserOpen===false&&state.browserOpen===true){cards=[];cardsLoaded=false;cardsSourceKey='';get('bn-cards').replaceChildren();}state={...state,...value};render();},setVisible(visible){state.hostVisible=visible;root.dataset.hostVisible=visible&&!state.overlayOnly?'true':'false';ensureHomeStatus();updateLoadingPreview();bainiaoRainGlass.sync();},presentUpdate(overlayOnly,notice){setUpdateMode(overlayOnly);if(!get('bn-update-dialog').open){updateNotice=notice;openUpdate();}},endUpdatePresentation(){get('bn-update-dialog').close();setUpdateMode(false);}};
 function ensureHomeStatus(){
  if(!homeStatusStarted&&window.BainiaoApp.ready&&!state.overlayOnly&&state.hostVisible!==false&&state.url){homeStatusStarted=true;act(refreshStatus)();}
 }
 function setUpdateMode(overlayOnly){
  state.overlayOnly=overlayOnly;document.documentElement.dataset.updateOnly=String(overlayOnly);
  root.dataset.hostVisible=state.hostVisible!==false&&!overlayOnly?'true':'false';
  document.documentElement.style.backgroundColor=overlayOnly?'transparent':state.dark?'#1d1e1a':'#f7f6f1';
  updateLoadingPreview();bainiaoRainGlass.sync();ensureHomeStatus();
 }
 function render(){
  setUpdateMode(state.overlayOnly===true);

  get('bn-url').value=state.url||'';if(get('bn-connection-dialog').open&&!editDirty)fillEdit();
  if(typeof state.dark==='boolean'){root.dataset.theme=state.dark?'dark':'light';document.documentElement.style.colorScheme=state.dark?'dark':'light';document.documentElement.style.backgroundColor=state.overlayOnly?'transparent':state.dark?'#1d1e1a':'#f7f6f1';}
  bainiaoRainGlass.render(typeof state.dark==='boolean'?state.dark:systemTheme.matches);
  for(const [id,key,defaultValue] of [['bn-keepalive','keepalive',true],['bn-screen-on','keepScreenOn',true],['bn-reply-notifications','replyNotifications',false],['bn-ball-enabled','ballEnabled',false],['bn-perf-monitor','perfMonitor',false],['bn-verbose-log','verboseLog',false]])get(id).checked=typeof state[key]==='boolean'?state[key]:defaultValue;
  const browserOpen=state.browserOpen===true,closeButton=get('bn-close-browser'),closeBusy=closeButton.dataset.busy==='true';get('bn-enter-label').textContent=browserOpen?'返回酒馆':'进入酒馆';closeButton.disabled=!browserOpen||closeBusy;closeButton.setAttribute('aria-busy',String(closeBusy));
  get('bn-ball-size').value=state.ballSize||48;get('bn-size-value').textContent=(state.ballSize||48)+' px';get('bn-ball-opacity').value=state.ballOpacity||90;get('bn-opacity-value').textContent=(state.ballOpacity||90)+'%';get('bn-ball-position').value=state.ballPosition||'right-bottom';
  const ball=get('bn-ball-sample');const previewSize=Math.min(52,Math.max(44,state.ballSize||48));ball.style.width=ball.style.height=previewSize+'px';ball.style.opacity=(state.ballOpacity||90)/100;ball.style.borderRadius=state.ballShape==='rounded'?'12px':'50%';if(state.ballImage)ball.replaceChildren(Object.assign(document.createElement('img'),{src:state.ballImage,alt:''}));
  root.querySelectorAll('[data-ball-shape]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.ballShape===(state.ballShape||'circle'))));root.querySelectorAll('[data-icon]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.icon===(state.icon||'ink'))));
  get('bn-icon-description').textContent=names[state.icon]||names.ink;get('bn-current-icon').dataset.style=state.icon||'ink';get('bn-current-icon').innerHTML=state.icon==='stone'?'<img src="icon-stone.png" alt="">':state.icon==='bluebird'?'<img src="icon-bluebird.jpg" alt="">':state.icon==='redbird'?'<img src="icon-redbird.jpg" alt="">':'<i data-lucide="umbrella"></i>';
  get('bn-frame-summary').textContent=state.frameRate?state.frameRate+' fps':'跟随系统';get('bn-idle-summary').textContent=['关闭','普通','防烧屏'][state.idleMode||0];get('bn-version').textContent=state.version||'';get('bn-app-update-version').textContent=state.version?'v'+state.version:'';
  root.querySelectorAll('[data-frame]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.frame)===(state.frameRate||0))));root.querySelectorAll('[data-idle]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.idle)===(state.idleMode||0))));
  get('bn-loading-animation-description').textContent=state.loadingAnimationCustom?'自定义 GIF':'小鸽子';get('bn-loading-animation-reset').disabled=!state.loadingAnimationCustom;updateLoadingPreview();
  renderUpdate();iconize();
 }
 async function setPreference(key,value){const updated=await request('setting',{key,value});state={...state,[key]:value,...updated};render();}
 function panel(button,content){get(button).onclick=()=>{const open=get(content).hidden;get(content).hidden=!open;get(button).setAttribute('aria-expanded',String(open));updateLoadingPreview();};}
 panel('bn-ball-style-toggle','bn-ball-editor');panel('bn-icon-toggle','bn-icon-editor');panel('bn-loading-animation-toggle','bn-loading-animation-editor');
 function updateLoadingPreview(){
  const image=get('bn-loading-animation-preview'),still=get('bn-loading-animation-still');
  const visible=currentView==='home'&&get('bn-preferences').open&&!get('bn-loading-animation-editor').hidden&&!document.hidden&&root.dataset.hostVisible!=='false';
  if(!visible){image.onload=null;image.removeAttribute('src');still.getContext('2d').clearRect(0,0,96,96);delete still.dataset.source;return;}
  const url=state.loadingAnimationUrl;if(!url)return;
  image.hidden=reducedMotion.matches;still.hidden=!reducedMotion.matches;
  if(reducedMotion.matches){
   if(still.dataset.source===url)return;
   const freeze=()=>{const context=still.getContext('2d');context.clearRect(0,0,96,96);context.drawImage(image,0,0,96,96);still.dataset.source=url;image.onload=null;image.removeAttribute('src');};
   image.onload=freeze;if(image.getAttribute('src')===url&&image.complete&&image.naturalWidth){freeze();return;}
  }else image.onload=null;
  if(image.getAttribute('src')!==url)image.src=url;
 }
 get('bn-preferences').addEventListener('toggle',updateLoadingPreview);document.addEventListener('visibilitychange',updateLoadingPreview);
 if(reducedMotion.addEventListener)reducedMotion.addEventListener('change',updateLoadingPreview);else reducedMotion.addListener(updateLoadingPreview);
 function renderUpdate(){
  const value=state.appUpdate;
  if(!value){const phase=state.appUpdateCheck||'unknown',button=get('bn-app-update');button.disabled=phase==='checking';button.dataset.state=phase;get('bn-app-update-label').textContent=phase==='checking'?'正在检查…':phase==='current'?'已是最新':phase==='available'?'有更新':phase==='error'?'检查失败，重试':'检查更新';return;}

  const phase=value.phase,downloading=phase==='downloading'||phase==='cancelling',dialog=get('bn-update-dialog'),primary=get('bn-update-primary'),button=get('bn-app-update');
  dialog.dataset.phase=phase;
  get('bn-update-title').textContent=downloading?'正在下载更新':phase==='permission'?'允许安装更新':phase==='ready'?'准备安装':phase==='error'?'下载未完成':phase==='cancelled'?'下载已取消':'发现新版本';
  get('bn-update-meta').textContent=[value.version,value.size].filter(Boolean).join(' · ');
  get('bn-update-notes').textContent=value.notes||'';get('bn-update-notes').hidden=updateNotice||phase!=='available'||!value.notes;
  get('bn-update-download').hidden=!downloading;
  get('bn-update-progress').value=Math.max(0,Math.min(100,Number(value.percent)||0));get('bn-update-percent').textContent=(Number(value.percent)||0)+'%';
  get('bn-update-progress-label').textContent=phase==='cancelling'?'正在取消…':'下载安装包';
  get('bn-update-transferred').textContent=[value.downloaded,value.size].filter(Boolean).join(' / ');
  get('bn-update-message').textContent=value.message||'';get('bn-update-message').hidden=!value.message||phase==='cancelling';
  primary.hidden=downloading;primary.disabled=updateActionBusy;primary.textContent=updateNotice?'查看更新':phase==='permission'?'去设置':phase==='ready'?'安装更新':phase==='error'||phase==='cancelled'?'重新下载':'下载并安装';
  get('bn-update-cancel').textContent=updateNotice?'稍后':downloading?'取消下载':phase==='available'||phase==='permission'?'稍后':'关闭';
  button.disabled=phase==='cancelling';button.dataset.state=downloading?'downloading':'available';get('bn-app-update-label').textContent=phase==='cancelling'?'取消中…':downloading?'正在下载…':phase==='ready'||phase==='permission'?'待安装':'有更新';
 }
 function openUpdate(){renderUpdate();if(!get('bn-update-dialog').open)get('bn-update-dialog').showModal();}
 function closeUpdate(){
  const phase=state.appUpdate?.phase;
  if(phase==='downloading'||(updateActionBusy&&updateOperation==='download'))request('appUpdateAction',{operation:'cancel'}).catch(error=>feedback(error.message,true));
  get('bn-update-dialog').close();updateNotice=false;
  request('appUpdateAction',{operation:'dismiss'}).catch(()=>{});
  if(!state.overlayOnly)get('bn-app-update').focus({preventScroll:true});
 }
 get('bn-update-close').onclick=closeUpdate;get('bn-update-cancel').onclick=closeUpdate;
 get('bn-update-dialog').addEventListener('cancel',event=>{event.preventDefault();closeUpdate();});
 get('bn-update-dialog').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeUpdate();});
 get('bn-update-primary').onclick=async()=>{
  if(updateActionBusy)return;
  if(updateNotice){updateNotice=false;renderUpdate();return;}
  const phase=state.appUpdate?.phase,operation=phase==='permission'?'permission':phase==='ready'?'install':'download';
  updateActionBusy=true;updateOperation=operation;renderUpdate();
  try{await request('appUpdateAction',{operation});if(operation!=='download'){updateActionBusy=false;renderUpdate();}}
  catch(error){updateActionBusy=false;get('bn-update-message').textContent=error.message;get('bn-update-message').hidden=false;get('bn-update-primary').disabled=false;}
 };
 get('bn-app-update').onclick=async()=>{
  if(state.appUpdate){updateNotice=false;openUpdate();return;}
  const button=get('bn-app-update'),label=get('bn-app-update-label'),status=get('bn-app-update-status');button.disabled=true;button.dataset.state='checking';label.textContent='正在检查…';status.hidden=true;
  try{const result=await request('checkUpdates');const available=(result.message||'').startsWith('发现新版本 ');state.appUpdateCheck=available?'available':'current';button.dataset.state=state.appUpdateCheck;label.textContent=available?'有更新':'已是最新';}
  catch(error){state.appUpdateCheck='error';button.dataset.state='error';label.textContent='检查失败，重试';status.textContent=error.message;status.hidden=false;}
  finally{button.disabled=false;}
 };
 get('bn-loading-animation-upload').onclick=act(()=>request('pickImage',{target:'loading'}));
 get('bn-loading-animation-reset').onclick=act(async()=>{state={...state,...await request('resetLoadingAnimation')};render();feedback('已恢复默认小鸽子');});
 get('bn-connection-edit').onclick=openEdit;get('bn-connection-cancel').onclick=closeEdit;get('bn-connection-dialog').addEventListener('cancel',()=>{editDirty=false;});
 for(const id of ['bn-edit-url','bn-username','bn-password'])get(id).oninput=()=>{editDirty=true;};
 get('bn-connection-form').onsubmit=act(async event=>{
  event.preventDefault();const url=get('bn-edit-url').value.trim();
  try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password)throw Error();}catch{throw new Error('请填写完整的 http:// 或 https:// 酒馆地址。');}
  const saved=await request('saveConnection',{url,username:get('bn-username').value,password:get('bn-password').value});state={...state,...saved};cards=[];cardsLoaded=false;cardsSourceKey='';get('bn-cards').replaceChildren();editDirty=false;render();closeEdit();resetStatus();feedback('连接已保存');act(refreshStatus)();
 });
 async function connectionAction(operation){const value=await request('connectionAction',{operation});state={...state,...value};if(operation==='logout'||operation==='delete'){cards=[];cardsLoaded=false;cardsSourceKey='';get('bn-cards').replaceChildren();}editDirty=false;render();fillEdit();get('bn-connection-error').hidden=true;resetStatus();if(operation==='delete'){closeEdit();feedback('本机链接已删除');}else if(operation==='logout')feedback('已退出酒馆登录');else feedback('网页缓存已清空');}
 get('bn-logout').onclick=act(()=>connectionAction('logout'));get('bn-delete-connection').onclick=act(()=>connectionAction('delete'));get('bn-clear-cache').onclick=act(async()=>{await request('connectionAction',{operation:'cache'});get('bn-connection-error').textContent='网页缓存已清空，登录保留。';get('bn-connection-error').hidden=false;});
 async function saveHomeAddress(){if(!state.url){openEdit();return false;}await request('saveAddress',{url:get('bn-url').value});return true;}
 get('bn-enter').onclick=act(async()=>{if(await saveHomeAddress()){const value=await request('enter');state={...state,...value};render();}});get('bn-close-browser').onclick=act(async()=>{const button=get('bn-close-browser');if(button.dataset.busy==='true'||button.disabled)return;button.dataset.busy='true';render();try{const value=await request('closeBrowser');state={...state,...value};cards=[];cardsLoaded=false;cardsSourceKey='';get('bn-cards').replaceChildren();feedback('酒馆页面已关闭');}finally{delete button.dataset.busy;render();}});
 const pluginIdentity=plugin=>String(plugin.id||plugin.packageName||'').toLowerCase();
 function renderPlugins(value){
  const health=value.health,healthId=String(health?.plugin?.id||'st-bainiaodata').toLowerCase();const plugins=Array.isArray(value.plugins)?value.plugins:[];
  const installed=plugins.find(plugin=>pluginIdentity(plugin)===healthId);const rows=[];
  rows.push({name:'白鳥 data',plugin:installed,white:true});for(const plugin of plugins)if(plugin!==installed)rows.push({name:plugin.packageName||plugin.name||plugin.directory,plugin});
  const list=get('bn-plugin-list');list.replaceChildren();
  for(const row of rows){const item=document.createElement('div');item.className='bn-plugin-item';item.dataset.plugin=row.white?healthId:pluginIdentity(row.plugin)||row.plugin.directory;const copy=document.createElement('div');copy.className='bn-plugin-copy';const title=document.createElement('strong');title.textContent=row.name;const status=document.createElement('p');
   if(row.white){const running=health?.ok?String(health.plugin?.version||''):'';const disk=String(row.plugin?.version||'');status.textContent=running&&disk&&running!==disk?'运行 '+running+' · 已安装 '+disk:running?'运行 '+running:disk?'已安装 '+disk+' · 未连接':value.healthError||'未连接';}else status.textContent='已安装'+(row.plugin.version?' '+row.plugin.version:'');
   copy.append(title,status);item.append(copy);
   const canUpdate=typeof row.plugin?.canUpdate==='boolean'?row.plugin.canUpdate:Boolean(row.plugin?.remoteUrl);
   if(row.plugin?.directory&&canUpdate){const button=document.createElement('button');button.type='button';button.className='bn-plugin-update';button.dataset.updatePlugin=row.plugin.directory;button.textContent='更新';button.onclick=act(async()=>{button.disabled=true;button.textContent='检查中';get('bn-plugin-message').hidden=true;feedback('');try{const updated=await request('updatePlugin',{directory:row.plugin.directory});if(updated.plugin)Object.assign(row.plugin,updated.plugin);renderPlugins(value);const unchanged=updated.plugin?.isUpToDate===true,missingDependencies=health?.capabilities?.serverPluginManagement===true&&updated.plugin?.dependencyStatus?.needsInstall===true;get('bn-plugin-message').textContent=missingDependencies?(unchanged?'插件代码已是最新版本，请在服务器安装缺少的依赖后再重启酒馆。':'插件代码已更新，请在服务器安装缺少的依赖后再重启酒馆。'):unchanged?'已是最新版本。':updated.restartRecommended?'已拉取更新，重启酒馆后生效。':'插件已更新。';get('bn-plugin-message').hidden=false;}finally{button.disabled=false;button.textContent='更新';}});item.append(button);}
   list.append(item);
  }
  if(value.pluginsError){get('bn-plugin-message').textContent=value.pluginsError;get('bn-plugin-message').hidden=false;}else get('bn-plugin-message').hidden=true;
 }
 async function refreshStatus(){
  if(!state.url){openEdit();return;}if(statusRequest)return;
  const current={};statusRequest=current;setConnectionStatus('checking','检查中');
  try{const value=await request('status');if(statusRequest!==current)return;setConnectionStatus('ok','已连接');renderPlugins(value);feedback('');}
  catch(error){if(statusRequest!==current)return;setConnectionStatus('error',error.message.includes('登录')?'待登录':'未连接');get('bn-plugin-list').replaceChildren();throw error;}
  finally{if(statusRequest===current)statusRequest=null;}
 }
 get('bn-status-refresh').onclick=act(refreshStatus);
 for(const [id,key]of [['bn-keepalive','keepalive'],['bn-screen-on','keepScreenOn'],['bn-reply-notifications','replyNotifications'],['bn-ball-enabled','ballEnabled'],['bn-perf-monitor','perfMonitor'],['bn-verbose-log','verboseLog']])get(id).onchange=act(async()=>{try{await setPreference(key,get(id).checked);}catch(error){render();throw error;}});
 for(const [id,key]of [['bn-ball-size','ballSize'],['bn-ball-opacity','ballOpacity'],['bn-ball-position','ballPosition']]){get(id).oninput=()=>{if(id==='bn-ball-size')get('bn-size-value').textContent=get(id).value+' px';if(id==='bn-ball-opacity')get('bn-opacity-value').textContent=get(id).value+'%';};get(id).onchange=act(()=>setPreference(key,id==='bn-ball-position'?get(id).value:Number(get(id).value)));}
 root.querySelectorAll('[data-ball-shape]').forEach(el=>el.onclick=act(()=>setPreference('ballShape',el.dataset.ballShape)));root.querySelectorAll('[data-icon]').forEach(el=>el.onclick=act(()=>setPreference('icon',el.dataset.icon)));
 get('bn-ball-upload').onclick=act(()=>request('pickImage',{target:'ball'}));get('bn-icon-upload').onclick=act(()=>request('pickImage',{target:'shortcut'}));
 get('bn-system-open').onclick=()=>showView('system');get('bn-system-back').onclick=()=>showView('home');
 for(const fps of [0,20,30,45,60,90,120]){const button=document.createElement('button');button.type='button';button.dataset.frame=String(fps);button.textContent=fps?String(fps):'默认';button.onclick=act(()=>setPreference('frameRate',fps));get('bn-frame-options').append(button);}
 get('bn-frame-save').onclick=act(async()=>{const value=Number(get('bn-frame-custom').value);if(!Number.isInteger(value)||value<5||value>240)throw new Error('请输入 5–240 之间的帧率。');await setPreference('frameRate',value);});
 root.querySelectorAll('[data-idle]').forEach(button=>button.onclick=act(()=>setPreference('idleMode',Number(button.dataset.idle))));
 async function diagnostic(kind){const output=get('bn-diagnostic-output');output.hidden=false;output.textContent='正在读取…';try{const value=await request('diagnostic',{kind});output.textContent=value.text||'暂无记录。';}catch(error){output.textContent=error.message;}}
 get('bn-view-log').onclick=act(()=>diagnostic('log'));get('bn-view-report').onclick=act(()=>diagnostic('report'));get('bn-export-log').onclick=act(()=>request('exportLog'));get('bn-battery-settings').onclick=act(()=>request('systemPermission',{target:'battery'}));get('bn-notification-settings').onclick=act(()=>request('systemPermission',{target:'notifications'}));
 get('bn-license').ontoggle=act(async()=>{if(get('bn-license').open&&!get('bn-license-content').textContent){const texts=await Promise.all(['LICENSE.txt','ASSET-LICENSES.txt'].map(async name=>(await fetch(name)).text()));get('bn-license-content').textContent=texts.join('\n\n');}});
 function closeDetail(){
  const previous=currentDetail;currentDetail=null;get('bn-card-detail').hidden=true;get('bn-detail-content').replaceChildren();get('bn-detail-paging').hidden=true;get('bn-detail-title').textContent='角色卡详情';document.body.style.overflow='';
  if(previous?.button.isConnected)previous.button.focus({preventScroll:true});
 }
 function completeCard(card){
  if(card.shallow===true)return false;
  if(card.shallow===false)return true;
  return ['description','personality','scenario','first_mes'].every(key=>Object.prototype.hasOwnProperty.call(card.data||{},key)||Object.prototype.hasOwnProperty.call(card,key));
 }
 function showGreeting(){
  const current=currentDetail;if(!current?.greetings)return;
  const greeting=current.greetings[current.page];get('bn-greeting-title').textContent=greeting.label;
  get('bn-greeting-text').textContent=greeting.text;get('bn-greeting-empty').hidden=Boolean(greeting.text);
  get('bn-greeting-count').textContent=(current.page+1)+' / '+current.greetings.length;
  get('bn-greeting-prev').disabled=current.page===0;get('bn-greeting-next').disabled=current.page===current.greetings.length-1;
  get('bn-detail-content').scrollTop=0;
 }
 function renderDetail(current){
  const card=current.card,data=card.data&&typeof card.data==='object'?card.data:card,field=key=>data[key]??card[key]??'',content=get('bn-detail-content');content.replaceChildren();
  get('bn-detail-title').textContent=data.name||card.name||'角色卡详情';
  for(const [label,key]of [['简介','description'],['设定','personality'],['场景','scenario']]){
   const text=String(field(key));if(!text)continue;
   const section=document.createElement('details'),summary=document.createElement('summary'),paragraph=document.createElement('p');section.className='bn-card-section';summary.textContent=label;summary.insertAdjacentHTML('beforeend','<i class="bn-details-chevron" data-lucide="chevron-right" aria-hidden="true"></i>');paragraph.className='bn-card-prose';paragraph.textContent=text;section.append(summary,paragraph);content.append(section);
  }
  const title=Object.assign(document.createElement('h3'),{id:'bn-greeting-title'}),text=Object.assign(document.createElement('p'),{id:'bn-greeting-text',className:'bn-card-prose'}),empty=Object.assign(document.createElement('p'),{id:'bn-greeting-empty',className:'bn-inline-note',textContent:'这条开场白为空。'});content.append(title,text,empty);
  const alternates=field('alternate_greetings'),list=Array.isArray(alternates)?alternates:typeof alternates==='string'&&alternates?[alternates]:[];
  current.greetings=[{label:'主开场白',text:String(field('first_mes'))},...list.map((value,index)=>({label:'备选开场白 '+(index+1),text:String(value??'')}))];current.page=0;get('bn-detail-paging').hidden=false;iconize();showGreeting();
 }
 async function openDetail(card,button){
  const current={card,button,page:0};currentDetail=current;get('bn-detail-title').textContent=card.name||'角色卡详情';get('bn-detail-content').replaceChildren(Object.assign(document.createElement('p'),{className:'bn-inline-note',textContent:'正在读取角色卡…'}));get('bn-detail-paging').hidden=true;get('bn-card-detail').hidden=false;document.body.style.overflow='hidden';get('bn-detail-close').focus();
  try{
   if(!completeCard(card)){
    const raw=await request('character',{avatar:card.avatar});
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('无法读取角色卡，请返回卡库后重试。');
    Object.assign(card,raw);card.shallow=false;
   }
   if(currentDetail===current)renderDetail(current);
  }catch(error){if(currentDetail===current)get('bn-detail-content').replaceChildren(Object.assign(document.createElement('p'),{className:'bn-error',textContent:error.message}));}
 }
 function clearCoverObserver(){if(coverObserver){coverObserver.disconnect();coverObserver.takeRecords();coverObserver=null;}}
 function observeUnloadedCovers(){clearCoverObserver();coverObserver=new IntersectionObserver((entries,observer)=>{for(const entry of entries)if(entry.isIntersecting){const image=entry.target;image.src=image.dataset.coverSrc;delete image.dataset.coverSrc;observer.unobserve(image);}},{rootMargin:'160px 0px'});get('bn-cards').querySelectorAll('img[data-cover-src]').forEach(image=>coverObserver.observe(image));}
 function renderCards(){clearCoverObserver();const query=get('bn-card-search').value.trim().toLocaleLowerCase(),filtered=cards.filter(card=>[card.name,...(Array.isArray(card.tags)?card.tags:[])].join(' ').toLocaleLowerCase().includes(query));const container=get('bn-cards');container.replaceChildren();get('bn-library-status').textContent=filtered.length?filtered.length+' 张角色卡':cards.length?'没有匹配的角色卡。':'卡库中还没有角色卡。';
  for(const card of filtered){const button=document.createElement('button');button.type='button';button.className='bn-card';button.dataset.card=card.avatar;const image=document.createElement('img');image.alt='';image.loading='lazy';image.dataset.coverSrc='https://bainiao.local/cover?avatar='+encodeURIComponent(card.avatar);const title=document.createElement('strong');title.textContent=card.name||'未命名';button.append(image,title);button.onclick=()=>openDetail(card,button);container.append(button);}observeUnloadedCovers();
 }
 function cardSourceKey(){return [state.url||'',state.username||'',state.password||''].join('\u0000');}
 async function loadCards(force=false){if(!state.url){openEdit();return;}const key=cardSourceKey();if(!force&&cardsLoaded&&cardsSourceKey===key){get('bn-card-search').disabled=false;observeUnloadedCovers();return;}cards=[];cardsLoaded=false;cardsSourceKey='';get('bn-card-search').disabled=true;get('bn-library-status').textContent='正在读取角色卡…';get('bn-cards').replaceChildren();try{const loaded=await request('characters');if(!Array.isArray(loaded))throw new Error('无法读取角色卡列表，请先进入酒馆检查登录后重试。');cards=loaded;cardsLoaded=true;cardsSourceKey=key;get('bn-card-search').disabled=false;renderCards();}catch(error){get('bn-library-status').textContent=error.message;}}
 get('bn-library-open').onclick=act(async()=>{if(!state.url){openEdit();return;}showView('library');await loadCards();});get('bn-library-refresh').onclick=act(()=>loadCards(true));
 get('bn-card-search').oninput=renderCards;get('bn-library-back').onclick=()=>showView('home');get('bn-detail-close').onclick=closeDetail;get('bn-card-detail').onclick=event=>{if(event.target===event.currentTarget)closeDetail();};
 get('bn-greeting-prev').onclick=()=>{if(currentDetail?.page>0){currentDetail.page--;showGreeting();}};get('bn-greeting-next').onclick=()=>{if(currentDetail&&currentDetail.page<currentDetail.greetings.length-1){currentDetail.page++;showGreeting();}};
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&currentDetail){event.preventDefault();closeDetail();}});
 iconize();request('state').then(value=>{state=value;render();resetStatus();window.BainiaoApp.ready=true;ensureHomeStatus();if(state.updatePresentation){updateNotice=state.updatePresentation==='notice';openUpdate();}request('localReady').catch(()=>{});}).catch(error=>feedback(error.message,true));
})();
