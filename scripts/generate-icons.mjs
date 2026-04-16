import fs from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = '/root/Epub-Reader-';
const outDir = path.join(root, 'assets/images');

function iconSvg({ transparent = false }) {
  return `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="140" y1="110" x2="900" y2="920" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#FFF6F0"/>
        <stop offset="1" stop-color="#F5E6E2"/>
      </linearGradient>
      <linearGradient id="petal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFD6E0"/>
        <stop offset="1" stop-color="#E58AA4"/>
      </linearGradient>
      <linearGradient id="book" x1="340" y1="290" x2="710" y2="820" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#59443E"/>
        <stop offset="1" stop-color="#2F2521"/>
      </linearGradient>
      <filter id="shadow" x="200" y="180" width="640" height="700" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#442C2D" flood-opacity="0.18"/>
      </filter>
    </defs>

    ${transparent ? '' : '<rect width="1024" height="1024" rx="236" fill="url(#bg)"/>'}
    ${transparent ? '' : '<circle cx="186" cy="184" r="82" fill="#FFFFFF" fill-opacity="0.36"/>'}
    ${transparent ? '' : '<circle cx="826" cy="816" r="114" fill="#EAB8C3" fill-opacity="0.18"/>'}

    <g filter="url(#shadow)">
      <path d="M354 284C354 260.804 372.804 242 396 242H628C651.196 242 670 260.804 670 284V760C670 787.614 647.614 810 620 810H404C376.386 810 354 787.614 354 760V284Z" fill="url(#book)"/>
      <path d="M388 292C388 276.536 400.536 264 416 264H609C624.464 264 637 276.536 637 292V734C637 751.673 622.673 766 605 766H420C402.327 766 388 751.673 388 734V292Z" fill="#FFF8F3"/>
      <path d="M512 264V766" stroke="#D2C2BA" stroke-width="10" stroke-linecap="round"/>
      <path d="M424 352H585" stroke="#D8C7BE" stroke-width="18" stroke-linecap="round"/>
      <path d="M424 412H550" stroke="#E2D4CC" stroke-width="12" stroke-linecap="round"/>
      <path d="M424 452H575" stroke="#E7DAD3" stroke-width="12" stroke-linecap="round"/>
      <path d="M424 692H602" stroke="#E2D4CC" stroke-width="12" stroke-linecap="round"/>
    </g>

    <g transform="translate(516 466)">
      <ellipse cx="0" cy="-120" rx="82" ry="132" fill="url(#petal)" transform="rotate(0)"/>
      <ellipse cx="114" cy="-30" rx="82" ry="132" fill="url(#petal)" transform="rotate(72)"/>
      <ellipse cx="70" cy="112" rx="82" ry="132" fill="url(#petal)" transform="rotate(144)"/>
      <ellipse cx="-70" cy="112" rx="82" ry="132" fill="url(#petal)" transform="rotate(216)"/>
      <ellipse cx="-114" cy="-30" rx="82" ry="132" fill="url(#petal)" transform="rotate(288)"/>
      <circle cx="0" cy="0" r="64" fill="#FFF4D9"/>
      <circle cx="0" cy="0" r="42" fill="#F7D97B"/>
      <g fill="#B8644A">
        <circle cx="-26" cy="-14" r="6"/>
        <circle cx="16" cy="-20" r="6"/>
        <circle cx="24" cy="10" r="6"/>
        <circle cx="-14" cy="24" r="6"/>
        <circle cx="4" cy="28" r="6"/>
      </g>
    </g>

    <g opacity="0.92">
      <path d="M758 272C785 250 829 254 851 281C827 286 799 305 789 333C768 322 753 297 758 272Z" fill="#F4A8BE"/>
      <path d="M221 724C244 703 283 704 304 725C282 733 259 751 250 773C230 763 217 744 221 724Z" fill="#F1B5C4"/>
      <path d="M734 660C751 645 780 646 796 663C779 669 762 683 755 700C740 692 731 677 734 660Z" fill="#F6C7D2"/>
    </g>
  </svg>`;
}

async function writePng(fileName, size, transparent = false) {
  const svg = iconSvg({ transparent });
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  });
  const pngData = resvg.render().asPng();
  await fs.writeFile(path.join(outDir, fileName), pngData);
}

await writePng('icon.png', 1024, false);
await writePng('adaptive-icon.png', 1024, true);
await writePng('splash-icon.png', 1024, false);
await writePng('favicon.png', 128, false);
