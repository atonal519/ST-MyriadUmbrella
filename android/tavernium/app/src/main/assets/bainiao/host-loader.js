(function (gifUrl) {
    // The host owns this node and its removal. Only replace its default gear artwork.
    var parent = document.head || document.documentElement;
    if (!parent) return;
    var css = '#preloader{background-image:url(' + JSON.stringify(gifUrl)
        + ');background-position:center;background-size:96px 96px;background-repeat:no-repeat;}'
        + '#loader > #load-spinner.fa-gear{animation:none!important;background-image:url('
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
