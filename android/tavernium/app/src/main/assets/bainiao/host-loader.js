(function (gifUrl) {
    // The host owns both stages and their removal. Bound only the App GIF artwork;
    // host themes can otherwise apply cover, larger gear dimensions or transforms.
    var parent = document.head || document.documentElement;
    if (!parent) return;
    var css = '#preloader{background-image:url(' + JSON.stringify(gifUrl)
        + ');background-position:center;background-size:96px 96px!important;background-repeat:no-repeat;}'
        + '#loader > #load-spinner.fa-gear{--spinner-size:96px!important;'
        + 'width:var(--spinner-size)!important;height:var(--spinner-size)!important;'
        + 'top:calc(50% - var(--spinner-size) / 2);left:calc(50% - var(--spinner-size) / 2);'
        + 'transform:none!important;animation:none!important;background-image:url('
        + JSON.stringify(gifUrl) + ');background-position:center;background-size:contain;background-repeat:no-repeat;}'
        + '#loader > #load-spinner.fa-gear::before{content:none!important;}';
    var style = document.getElementById('qianjisan-host-loader');
    if (!style) {
        style = document.createElement('style');
        style.id = 'qianjisan-host-loader';
        parent.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
})
