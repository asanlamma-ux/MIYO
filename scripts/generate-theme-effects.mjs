import fs from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = '/root/Epub-Reader-';
const outDir = path.join(root, 'assets/images/theme-effects');

const defs = {
  blossom: {
    hero: { size: 900, svg: blossomHeroSvg },
    preview: { size: 320, svg: blossomPreviewSvg },
    particleA: { size: 128, svg: blossomPetalSvg },
    particleB: { size: 128, svg: blossomPetalSvgVariant },
  },
  coffee: {
    hero: { size: 900, svg: coffeeHeroSvg },
    preview: { size: 320, svg: coffeePreviewSvg },
    particleA: { size: 128, svg: coffeeSteamSvg },
    particleB: { size: 128, svg: coffeeFleckSvg },
  },
  comfort: {
    hero: { size: 900, svg: comfortHeroSvg },
    preview: { size: 320, svg: comfortPreviewSvg },
    particleA: { size: 128, svg: comfortDustSvg },
    particleB: { size: 128, svg: comfortFiberSvg },
  },
  matcha: {
    hero: { size: 900, svg: matchaHeroSvg },
    preview: { size: 320, svg: matchaPreviewSvg },
    particleA: { size: 128, svg: matchaLeafSvg },
    particleB: { size: 128, svg: matchaFiberSvg },
  },
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writePng(filePath, svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
  });
  await fs.writeFile(filePath, resvg.render().asPng());
}

function svgShell(body, viewBox = '0 0 1024 1024') {
  return `<svg width="1024" height="1024" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

function blossomPetalPath(fillA = '#F9C7D5', fillB = '#E38EA9') {
  return `
    <defs>
      <linearGradient id="petal" x1="180" y1="120" x2="820" y2="900" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${fillA}"/>
        <stop offset="1" stop-color="${fillB}"/>
      </linearGradient>
    </defs>
    <path d="M522 150C660 172 782 307 780 462C778 620 646 770 480 784C332 796 216 678 206 534C194 364 322 202 522 150Z" fill="url(#petal)"/>
    <path d="M444 256C530 264 612 328 622 414C634 520 556 620 452 638C360 654 286 590 276 500C264 398 334 284 444 256Z" fill="#FFF4F7" fill-opacity="0.42"/>
  `;
}

function blossomHeroSvg() {
  return svgShell(`
    <defs>
      <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(520 510) rotate(90) scale(360)">
        <stop offset="0" stop-color="#FFF0D9"/>
        <stop offset="1" stop-color="#FFF0D9" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="108" y="84" width="816" height="856" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="26" stdDeviation="30" flood-color="#7A4A58" flood-opacity="0.18"/>
      </filter>
      <linearGradient id="core" x1="455" y1="415" x2="585" y2="632" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#FFF7DD"/>
        <stop offset="1" stop-color="#F7CC73"/>
      </linearGradient>
      <linearGradient id="outline" x1="286" y1="220" x2="744" y2="816" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#FBD4DE"/>
        <stop offset="1" stop-color="#E38EA9"/>
      </linearGradient>
    </defs>
    <circle cx="522" cy="510" r="318" fill="url(#glow)"/>
    <g filter="url(#shadow)">
      <g transform="translate(512 512)">
        <ellipse cx="0" cy="-184" rx="118" ry="190" fill="url(#outline)"/>
        <ellipse cx="175" cy="-52" rx="118" ry="190" fill="url(#outline)" transform="rotate(72)"/>
        <ellipse cx="108" cy="168" rx="118" ry="190" fill="url(#outline)" transform="rotate(144)"/>
        <ellipse cx="-108" cy="168" rx="118" ry="190" fill="url(#outline)" transform="rotate(216)"/>
        <ellipse cx="-175" cy="-52" rx="118" ry="190" fill="url(#outline)" transform="rotate(288)"/>
        <circle cx="0" cy="0" r="86" fill="url(#core)"/>
        <circle cx="0" cy="0" r="56" fill="#F7CF61"/>
        <g fill="#B96455">
          <circle cx="-30" cy="-18" r="8"/>
          <circle cx="14" cy="-28" r="8"/>
          <circle cx="28" cy="8" r="8"/>
          <circle cx="-18" cy="28" r="8"/>
          <circle cx="8" cy="34" r="8"/>
        </g>
      </g>
    </g>
    <path d="M770 238C810 218 860 236 884 278C848 288 810 324 798 360C764 352 742 286 770 238Z" fill="#F3AEC0"/>
    <path d="M184 708C222 680 280 680 318 706C284 724 252 754 238 786C204 774 178 742 184 708Z" fill="#F7CBD4"/>
  `);
}

function blossomPreviewSvg() {
  return svgShell(`
    <defs>
      <radialGradient id="bg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(512 512) rotate(90) scale(380)">
        <stop offset="0" stop-color="#FFF2F5"/>
        <stop offset="1" stop-color="#FFF2F5" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="512" cy="512" r="330" fill="url(#bg)"/>
    <g transform="translate(512 512) scale(0.72)">
      <ellipse cx="0" cy="-184" rx="118" ry="190" fill="#F7BFD0"/>
      <ellipse cx="175" cy="-52" rx="118" ry="190" fill="#ED9EB4" transform="rotate(72)"/>
      <ellipse cx="108" cy="168" rx="118" ry="190" fill="#F7BFD0" transform="rotate(144)"/>
      <ellipse cx="-108" cy="168" rx="118" ry="190" fill="#ED9EB4" transform="rotate(216)"/>
      <ellipse cx="-175" cy="-52" rx="118" ry="190" fill="#F7BFD0" transform="rotate(288)"/>
      <circle cx="0" cy="0" r="82" fill="#FFF4DC"/>
      <circle cx="0" cy="0" r="54" fill="#F3C967"/>
    </g>
  `);
}

function blossomPetalSvg() {
  return svgShell(blossomPetalPath(), '0 0 1024 1024');
}

function blossomPetalSvgVariant() {
  return svgShell(blossomPetalPath('#F8D7DE', '#D47B97') + '<circle cx="610" cy="520" r="30" fill="#FFF5F6" fill-opacity="0.35"/>', '0 0 1024 1024');
}

function coffeeHeroSvg() {
  return svgShell(`
    <defs>
      <radialGradient id="brew" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(512 496) rotate(90) scale(360)">
        <stop offset="0" stop-color="#F1D7AF" stop-opacity="0.65"/>
        <stop offset="1" stop-color="#F1D7AF" stop-opacity="0"/>
      </radialGradient>
      <filter id="cupShadow" x="120" y="138" width="780" height="776" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="32" stdDeviation="28" flood-color="#281B16" flood-opacity="0.28"/>
      </filter>
      <linearGradient id="cup" x1="286" y1="260" x2="724" y2="796" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#D0B08A"/>
        <stop offset="1" stop-color="#8B674C"/>
      </linearGradient>
      <linearGradient id="steam" x1="380" y1="130" x2="672" y2="392" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#F7E1BE" stop-opacity="0.15"/>
        <stop offset="1" stop-color="#F7E1BE" stop-opacity="0.85"/>
      </linearGradient>
    </defs>
    <circle cx="512" cy="512" r="328" fill="url(#brew)"/>
    <path d="M352 212C310 186 308 126 346 98C382 126 394 178 372 226C364 224 358 220 352 212Z" fill="url(#steam)"/>
    <path d="M508 164C476 124 500 72 554 60C578 106 568 154 532 188C524 182 516 174 508 164Z" fill="url(#steam)"/>
    <path d="M664 232C650 176 688 134 742 138C758 188 742 234 694 266C682 256 672 246 664 232Z" fill="url(#steam)"/>
    <g filter="url(#cupShadow)">
      <path d="M280 344C280 288 325 242 380 242H642C697 242 742 288 742 344V460C742 578 646 674 528 674H494C376 674 280 578 280 460V344Z" fill="url(#cup)"/>
      <path d="M764 332C836 338 886 394 886 464C886 536 832 592 760 596" stroke="#AA8766" stroke-width="42" stroke-linecap="round"/>
      <ellipse cx="512" cy="318" rx="198" ry="84" fill="#6B4634"/>
      <ellipse cx="512" cy="304" rx="176" ry="58" fill="#9E6F4A"/>
      <ellipse cx="512" cy="292" rx="152" ry="38" fill="#E5C38A"/>
    </g>
    <g fill="#D8B484" fill-opacity="0.55">
      <circle cx="248" cy="736" r="18"/>
      <circle cx="726" cy="768" r="20"/>
      <circle cx="806" cy="640" r="14"/>
    </g>
  `);
}

function coffeePreviewSvg() {
  return svgShell(`
    <defs>
      <radialGradient id="bg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(512 512) rotate(90) scale(340)">
        <stop offset="0" stop-color="#4A342A" stop-opacity="0.14"/>
        <stop offset="1" stop-color="#4A342A" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="512" cy="512" r="320" fill="url(#bg)"/>
    <ellipse cx="512" cy="660" rx="180" ry="60" fill="#2B201B" fill-opacity="0.14"/>
    <path d="M356 372C356 326 394 288 440 288H616C662 288 700 326 700 372V446C700 522 638 584 562 584H494C418 584 356 522 356 446V372Z" fill="#B7936B"/>
    <path d="M712 372C758 382 788 416 788 460C788 502 758 538 714 546" stroke="#B7936B" stroke-width="30" stroke-linecap="round"/>
    <ellipse cx="528" cy="350" rx="142" ry="54" fill="#6E4734"/>
    <ellipse cx="528" cy="338" rx="116" ry="30" fill="#DEBD87"/>
    <path d="M446 244C430 206 446 174 476 164C500 192 500 228 474 258" stroke="#F1D3A5" stroke-width="18" stroke-linecap="round" stroke-opacity="0.55"/>
    <path d="M566 226C554 190 576 154 612 152C632 184 626 220 594 248" stroke="#F1D3A5" stroke-width="18" stroke-linecap="round" stroke-opacity="0.55"/>
  `);
}

function coffeeSteamSvg() {
  return svgShell(`
    <defs>
      <linearGradient id="steam" x1="512" y1="140" x2="512" y2="900" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#F4DAB4" stop-opacity="0"/>
        <stop offset="0.55" stop-color="#F4DAB4" stop-opacity="0.9"/>
        <stop offset="1" stop-color="#F4DAB4" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M430 920C356 812 366 726 424 646C482 568 518 496 466 400C428 330 430 252 510 132" stroke="url(#steam)" stroke-width="96" stroke-linecap="round"/>
  `);
}

function coffeeFleckSvg() {
  return svgShell(`
    <circle cx="404" cy="404" r="188" fill="#D6AF73"/>
    <circle cx="620" cy="430" r="118" fill="#F1D7AB" fill-opacity="0.9"/>
    <circle cx="480" cy="652" r="110" fill="#A77D56" fill-opacity="0.92"/>
  `);
}

function comfortHeroSvg() {
  return svgShell(`
    <defs>
      <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(512 510) rotate(90) scale(360)">
        <stop offset="0" stop-color="#F7E2B6" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#F7E2B6" stop-opacity="0"/>
      </radialGradient>
      <filter id="sheetShadow" x="158" y="92" width="708" height="860" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#674B34" flood-opacity="0.18"/>
      </filter>
      <linearGradient id="sheet" x1="246" y1="182" x2="770" y2="830" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#FFF8E9"/>
        <stop offset="1" stop-color="#F0DFC3"/>
      </linearGradient>
    </defs>
    <circle cx="512" cy="512" r="330" fill="url(#glow)"/>
    <g filter="url(#sheetShadow)">
      <path d="M252 170C252 134 282 104 318 104H706C742 104 772 134 772 170V788C772 822 744 850 710 850H314C280 850 252 822 252 788V170Z" fill="url(#sheet)"/>
      <path d="M706 104L772 170H706V104Z" fill="#ECD7B1"/>
      <path d="M332 286H664" stroke="#D3B88D" stroke-width="18" stroke-linecap="round"/>
      <path d="M332 348H624" stroke="#E4CCAA" stroke-width="12" stroke-linecap="round"/>
      <path d="M332 406H650" stroke="#E7D3B8" stroke-width="12" stroke-linecap="round"/>
      <path d="M332 464H592" stroke="#E7D3B8" stroke-width="12" stroke-linecap="round"/>
      <path d="M332 694H640" stroke="#E1C7A0" stroke-width="12" stroke-linecap="round"/>
      <path d="M332 752H588" stroke="#E7D3B8" stroke-width="12" stroke-linecap="round"/>
    </g>
    <path d="M196 792C232 784 260 816 270 852C232 860 198 848 180 814C184 804 190 798 196 792Z" fill="#D9BC8E" fill-opacity="0.62"/>
    <path d="M802 720C838 718 868 744 880 778C844 790 806 780 786 748C790 736 796 726 802 720Z" fill="#E2CAA1" fill-opacity="0.68"/>
  `);
}

function comfortPreviewSvg() {
  return svgShell(`
    <ellipse cx="512" cy="760" rx="178" ry="52" fill="#A88559" fill-opacity="0.12"/>
    <path d="M316 226C316 196 340 172 370 172H654C684 172 708 196 708 226V706C708 734 686 756 658 756H366C338 756 316 734 316 706V226Z" fill="#FFF6E3"/>
    <path d="M654 172L708 226H654V172Z" fill="#EDD6AF"/>
    <path d="M384 318H624" stroke="#D2B285" stroke-width="16" stroke-linecap="round"/>
    <path d="M384 376H596" stroke="#E1C9A5" stroke-width="11" stroke-linecap="round"/>
    <path d="M384 428H618" stroke="#E6D2B7" stroke-width="11" stroke-linecap="round"/>
    <path d="M384 644H580" stroke="#E3CBAA" stroke-width="11" stroke-linecap="round"/>
  `);
}

function comfortDustSvg() {
  return svgShell(`
    <circle cx="214" cy="322" r="72" fill="#DABD90" fill-opacity="0.72"/>
    <circle cx="512" cy="200" r="54" fill="#E6CCAA" fill-opacity="0.88"/>
    <circle cx="720" cy="468" r="88" fill="#F2DFC3" fill-opacity="0.78"/>
    <circle cx="460" cy="766" r="46" fill="#C9A777" fill-opacity="0.62"/>
  `);
}

function comfortFiberSvg() {
  return svgShell(`
    <path d="M258 520C346 454 410 444 526 470C620 490 692 484 784 436" stroke="#D1B07C" stroke-width="54" stroke-linecap="round" stroke-opacity="0.56"/>
    <path d="M296 636C390 588 474 576 560 602C638 626 706 630 760 610" stroke="#F0D9B1" stroke-width="38" stroke-linecap="round" stroke-opacity="0.54"/>
  `);
}

function matchaHeroSvg() {
  return svgShell(`
    <defs>
      <radialGradient id="wash" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(520 520) rotate(90) scale(360)">
        <stop offset="0" stop-color="#A7C58E" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#A7C58E" stop-opacity="0"/>
      </radialGradient>
      <filter id="ringShadow" x="126" y="126" width="772" height="772" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="28" stdDeviation="24" flood-color="#385032" flood-opacity="0.18"/>
      </filter>
      <linearGradient id="ring" x1="284" y1="268" x2="760" y2="770" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#8FB071"/>
        <stop offset="1" stop-color="#4B6E40"/>
      </linearGradient>
    </defs>
    <circle cx="520" cy="520" r="336" fill="url(#wash)"/>
    <g filter="url(#ringShadow)">
      <path d="M786 518C786 668 662 792 512 792C362 792 238 668 238 518C238 368 362 244 512 244C580 244 630 258 686 290" stroke="url(#ring)" stroke-width="82" stroke-linecap="round"/>
      <path d="M686 290C760 334 806 420 806 516" stroke="#395333" stroke-width="40" stroke-linecap="round"/>
    </g>
    <path d="M374 372C436 396 494 454 514 514C446 510 384 474 340 410C350 396 360 384 374 372Z" fill="#8EB373" fill-opacity="0.54"/>
    <path d="M582 618C648 632 704 680 728 734C654 740 588 714 538 660C548 646 562 632 582 618Z" fill="#9DC482" fill-opacity="0.48"/>
    <g stroke="#6D8B5E" stroke-width="10" stroke-linecap="round" opacity="0.5">
      <path d="M326 250L354 286"/>
      <path d="M704 736L742 770"/>
      <path d="M242 610L274 632"/>
      <path d="M770 366L806 388"/>
    </g>
  `);
}

function matchaPreviewSvg() {
  return svgShell(`
    <path d="M740 512C740 636 638 738 514 738C390 738 288 636 288 512C288 388 390 286 514 286C570 286 616 298 662 326" stroke="#5F834C" stroke-width="70" stroke-linecap="round"/>
    <path d="M662 326C710 356 740 424 740 512" stroke="#385330" stroke-width="34" stroke-linecap="round"/>
    <path d="M422 402C468 424 506 460 526 500C472 500 422 474 384 436C394 424 406 412 422 402Z" fill="#96BC7A" fill-opacity="0.56"/>
    <path d="M546 580C598 596 636 630 654 670C602 672 552 652 512 616C520 604 532 592 546 580Z" fill="#A8CF8D" fill-opacity="0.52"/>
  `);
}

function matchaLeafSvg() {
  return svgShell(`
    <defs>
      <linearGradient id="leaf" x1="182" y1="180" x2="812" y2="808" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#A6C887"/>
        <stop offset="1" stop-color="#5D874A"/>
      </linearGradient>
    </defs>
    <path d="M170 604C294 324 596 190 858 194C810 466 616 754 330 846C252 818 204 734 170 604Z" fill="url(#leaf)"/>
    <path d="M248 700C418 570 586 450 782 306" stroke="#F6FBF0" stroke-width="22" stroke-linecap="round" stroke-opacity="0.38"/>
  `);
}

function matchaFiberSvg() {
  return svgShell(`
    <path d="M252 404C326 442 404 462 500 462C616 462 708 432 788 378" stroke="#A2C686" stroke-width="50" stroke-linecap="round" stroke-opacity="0.52"/>
    <path d="M286 628C360 646 430 646 508 626C604 602 670 566 742 506" stroke="#668956" stroke-width="34" stroke-linecap="round" stroke-opacity="0.48"/>
  `);
}

await ensureDir(outDir);

for (const [packId, pack] of Object.entries(defs)) {
  for (const [name, def] of Object.entries(pack)) {
    await writePng(path.join(outDir, `${packId}-${name}.png`), def.svg(), def.size);
  }
}
