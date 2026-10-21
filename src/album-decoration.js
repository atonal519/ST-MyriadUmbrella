const textureUrl = new URL('../assets/album/pen-hatching.png', import.meta.url).href;

// One fixed ornament belongs to the library viewport; the PNG supplies only ink alpha.
export const albumDecoration = `<svg class="album-decoration-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 650" fill="none" aria-hidden="true">
<defs>
<clipPath id="tt-home-umbrella-cloth">
<path d="M0 0L0 -248Q37.388 -236.058 76.636 -235.862Q108.504 -212.951 145.771 -200.636Q168.999 -168.999 200.636 -145.771Q212.951 -108.504 235.862 -76.636Q236.058 -37.388 248 0Z"/>
</clipPath>
<mask id="tt-home-umbrella-source" maskUnits="userSpaceOnUse" x="0" y="0" width="1322" height="1190">
<path d="M0 0H1322V1190H0Z" fill="white"/>
<g fill="none" stroke="black" stroke-linecap="round" stroke-linejoin="round">
<path d="M457 12C587 104 769 142 884 105C827 291 998 445 1167 442C1062 575 1158 728 1298 810C1146 843 1127 1028 1202 1131" stroke-width="45"/>
<path d="M0 1185C70 840 260 405 457 12" stroke-width="52"/>
<path d="M0 1185L884 105" stroke-width="54"/>
<path d="M0 1185L1167 442" stroke-width="55"/>
<path d="M0 1185L1298 810" stroke-width="55"/>
<path d="M0 1185L1202 1131" stroke-width="45"/>
</g>
</mask>
<mask id="tt-home-umbrella-ink" maskUnits="userSpaceOnUse" x="0" y="-248" width="248" height="248" style="mask-type:alpha">
<g transform="scale(0.20928270042194091) translate(-14 -1171)">
<image href="${textureUrl}" width="1322" height="1190" mask="url(#tt-home-umbrella-source)"/>
</g>
</mask>
<g id="tt-home-umbrella-fan">
<path d="M0 0L0 -248Q37.388 -236.058 76.636 -235.862Q108.504 -212.951 145.771 -200.636Q168.999 -168.999 200.636 -145.771Q212.951 -108.504 235.862 -76.636Q236.058 -37.388 248 0Z" fill="currentColor" opacity=".035"/>
<g clip-path="url(#tt-home-umbrella-cloth)" opacity=".32">
<path d="M0 0V-248H248V0Z" fill="currentColor" mask="url(#tt-home-umbrella-ink)"/>
</g>
<path d="M0.9 0Q0.65 -136.4 0.32 -248L-0.32 -248Q-0.65 -136.4 -0.9 0Z" fill="currentColor" opacity=".35"/>
<path d="M0.856 0.278Q42.768 -129.523 76.94 -235.763L76.332 -235.961Q41.532 -129.925 -0.856 -0.278Z" fill="currentColor" opacity=".29"/>
<path d="M0.728 0.529Q80.7 -109.968 146.03 -200.448L145.512 -200.824Q79.648 -110.732 -0.728 -0.529Z" fill="currentColor" opacity=".35"/>
<path d="M0.529 0.728Q110.732 -79.648 200.824 -145.512L200.448 -146.03Q109.968 -80.7 -0.529 -0.728Z" fill="currentColor" opacity=".29"/>
<path d="M0.278 0.856Q129.925 -41.532 235.961 -76.332L235.763 -76.94Q129.523 -42.768 -0.278 -0.856Z" fill="currentColor" opacity=".35"/>
<path d="M0 0.9Q136.4 0.65 248 0.32L248 -0.32Q136.4 -0.65 0 -0.9Z" fill="currentColor" opacity=".29"/>
<path d="M0 -248Q37.388 -236.058 76.636 -235.862Q108.504 -212.951 145.771 -200.636Q168.999 -168.999 200.636 -145.771Q212.951 -108.504 235.862 -76.636Q236.058 -37.388 248 0" stroke="currentColor" stroke-width="1.25" opacity=".4"/>
<g>
<path d="M0 -248L0 -250" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".6"/>
<circle cx="0" cy="-250" r="1.25" fill="currentColor" opacity=".64"/>
</g>
<g>
<path d="M76.636 -235.862L77.254 -237.764" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".6"/>
<circle cx="77.254" cy="-237.764" r="1.25" fill="currentColor" opacity=".64"/>
</g>
<g>
<path d="M145.771 -200.636L146.946 -202.254" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".6"/>
<circle cx="146.946" cy="-202.254" r="1.25" fill="currentColor" opacity=".64"/>
</g>
<g>
<path d="M200.636 -145.771L202.254 -146.946" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".6"/>
<circle cx="202.254" cy="-146.946" r="1.25" fill="currentColor" opacity=".64"/>
</g>
<g>
<path d="M235.862 -76.636L237.764 -77.254" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".6"/>
<circle cx="237.764" cy="-77.254" r="1.25" fill="currentColor" opacity=".64"/>
</g>
<g>
<path d="M248 0L250 0" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".6"/>
<circle cx="250" cy="0" r="1.25" fill="currentColor" opacity=".64"/>
</g>
</g>
</defs>
<use href="#tt-home-umbrella-fan" transform="translate(382 -32) rotate(180)"/>
<use href="#tt-home-umbrella-fan" transform="translate(-24 677)"/>
</svg>`;
