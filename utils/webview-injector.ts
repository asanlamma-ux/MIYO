/**
 * WebView Injection Engine — inject CSS/JS changes into the reader WebView
 * WITHOUT triggering a full reload.
 *
 * This avoids the 300-500ms flash that happens when regenerating HTML
 * for theme, typography, or chapter content changes.
 */

import type { Theme } from '@/types/theme';
import type { TypographySettings } from '@/types/theme';

function serialize<T>(value: T): string {
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Theme injection — update CSS custom properties without reload
// ---------------------------------------------------------------------------

export function buildThemeInjectionJS(theme: Theme): string {
  const payload = serialize({
    background: theme.background,
    text: theme.text,
    secondaryText: theme.secondaryText,
    accent: theme.accent,
    cardBackground: theme.cardBackground,
  });
  return `
(function() {
  var theme = ${payload};
  var root = document.documentElement;
  root.style.setProperty('--bg', theme.background);
  root.style.setProperty('--fg', theme.text);
  root.style.setProperty('--fg2', theme.secondaryText);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--card', theme.cardBackground);
  document.body.style.backgroundColor = theme.background;
  document.body.style.color = theme.text;
})();
true;
`;
}

// ---------------------------------------------------------------------------
// Typography injection — update font/sizing without reload
// ---------------------------------------------------------------------------

export function buildTypographyInjectionJS(typography: TypographySettings): string {
  const payload = serialize(typography);
  return `
(function() {
  var typography = ${payload};
  var html = document.documentElement;
  var body = document.body;
  html.style.fontSize = typography.fontSize + 'px';
  body.style.fontWeight = String(typography.fontWeight);
  body.style.lineHeight = String(typography.lineHeight);
  body.style.letterSpacing = typography.letterSpacing + 'em';
  body.style.textAlign = typography.textAlign;
  // Update paragraph spacing
  var ps = document.querySelectorAll('p');
  for (var i = 0; i < ps.length; i++) {
    ps[i].style.marginBottom = typography.paragraphSpacing + 'px';
  }
})();
true;
`;
}

// ---------------------------------------------------------------------------
// Font family injection
// ---------------------------------------------------------------------------

export function buildFontFamilyInjectionJS(fontStack: string, fontFaceCss: string): string {
  const payload = serialize({
    fontStack,
    fontFaceCss,
  });
  return `
(function() {
  var payload = ${payload};
  var existingStyle = document.querySelector('style[data-miyo-font-style]');
  if (existingStyle) existingStyle.remove();
  var style = document.createElement('style');
  style.setAttribute('data-miyo-font-style', 'true');
  style.textContent = payload.fontFaceCss + '\\n' +
    'body, .miyo-wrap, .miyo-wrap p, .miyo-wrap div, .miyo-wrap span, .miyo-wrap li, .miyo-wrap a, .miyo-wrap blockquote, .miyo-wrap td, .miyo-wrap th, .miyo-wrap h1, .miyo-wrap h2, .miyo-wrap h3, .miyo-wrap h4, .miyo-wrap h5, .miyo-wrap h6, .miyo-wrap strong, .miyo-wrap em { font-family: ' + payload.fontStack + ' !important; } .miyo-wrap code, .miyo-wrap pre { font-family: "MiyoJetBrainsMono", "JetBrains Mono", "Courier New", monospace !important; }';
  document.head.appendChild(style);
  document.body.style.fontFamily = payload.fontStack;
  var textNodes = document.querySelectorAll('.miyo-wrap p, .miyo-wrap div, .miyo-wrap span, .miyo-wrap li, .miyo-wrap a, .miyo-wrap blockquote, .miyo-wrap td, .miyo-wrap th, .miyo-wrap h1, .miyo-wrap h2, .miyo-wrap h3, .miyo-wrap h4, .miyo-wrap h5, .miyo-wrap h6, .miyo-wrap strong, .miyo-wrap em');
  for (var i = 0; i < textNodes.length; i++) {
    textNodes[i].style.fontFamily = payload.fontStack;
  }
})();
true;
`;
}

// ---------------------------------------------------------------------------
// Blue light filter injection — toggle without reload
// ---------------------------------------------------------------------------

export function buildBlueLightFilterJS(enabled: boolean): string {
  const payload = serialize({ enabled });
  return `
(function() {
  var payload = ${payload};
  var overlay = document.getElementById('miyo-blf');
  if (payload.enabled) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'miyo-blf';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(255,120,40,0.32);pointer-events:none;z-index:2147483647;';
      document.body.appendChild(overlay);
    }
  } else {
    if (overlay) overlay.remove();
  }
})();
true;
`;
}

// ---------------------------------------------------------------------------
// Chapter content swap — replace chapter HTML without full reload
// ---------------------------------------------------------------------------

export function buildChapterSwapJS(
  chapterHtml: string,
  scrollPosition: number,
  highlightsJSON: string,
  searchTerm: string,
  twoColumn: boolean
): string {
  const payload = serialize({
    chapterHtml,
    scrollPosition,
    highlights: JSON.parse(highlightsJSON || '[]') as Array<{
      text: string;
      color: string;
      textColor: string;
      id: string;
    }>,
    searchTerm,
    twoColumn,
  });

  return `
(function() {
  var payload = ${payload};
  // Stop any auto-scroll
  if (window.__miyoScrollTimer) {
    clearInterval(window.__miyoScrollTimer);
    window.__miyoScrollTimer = null;
  }

  var wrap = document.querySelector('.miyo-wrap');
  if (!wrap) return;

  // Swap content
  wrap.innerHTML = payload.chapterHtml;

  // Update column class
  wrap.className = payload.twoColumn ? 'miyo-wrap miyo-two-col' : 'miyo-wrap';

  // Restore scroll position
  window.scrollTo(0, payload.scrollPosition);

  // Re-apply highlights
  var highlights = payload.highlights;
  if (highlights && highlights.length > 0) {
    setTimeout(function() {
      highlights.forEach(function(h) {
        window.__addHighlight && window.__addHighlight(h.text, h.color, h.textColor, h.id);
      });
    }, 150);
  }

  // Re-apply search highlight
  var searchTerm = payload.searchTerm;
  if (searchTerm && window.__highlightSearch) {
    setTimeout(function() { window.__highlightSearch(searchTerm); }, 300);
  }
})();
true;
`;
}

// ---------------------------------------------------------------------------
// Margin injection
// ---------------------------------------------------------------------------

export function buildMarginInjectionJS(marginPx: number): string {
  const payload = serialize({ marginPx });
  return `
(function() {
  var payload = ${payload};
  document.body.style.paddingLeft = payload.marginPx + 'px';
  document.body.style.paddingRight = payload.marginPx + 'px';
})();
true;
`;
}

// ---------------------------------------------------------------------------
// Column width injection
// ---------------------------------------------------------------------------

export function buildColumnWidthInjectionJS(maxWidth: number | null): string {
  const payload = serialize({ maxWidth });
  return `
(function() {
  var payload = ${payload};
  var wrap = document.querySelector('.miyo-wrap');
  if (!wrap) return;
  if (typeof payload.maxWidth === 'number') {
    wrap.style.maxWidth = payload.maxWidth + 'px';
    wrap.style.marginLeft = 'auto';
    wrap.style.marginRight = 'auto';
    wrap.style.width = '100%';
  } else {
    wrap.style.maxWidth = 'none';
    wrap.style.width = '100%';
  }
})();
true;
`;
}

// ---------------------------------------------------------------------------
// Bionic reading injection (toggle without reload)
// ---------------------------------------------------------------------------

export function buildBionicToggleJS(enabled: boolean): string {
  if (!enabled) {
    return `
(function() {
  var bolds = document.querySelectorAll('.miyo-bionic');
  for (var i = 0; i < bolds.length; i++) {
    var b = bolds[i];
    var text = b.textContent;
    var parent = b.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(text), b);
      parent.normalize();
    }
  }
})();
true;
`;
  }

  return `
(function() {
  try {
    var root = document.querySelector('.miyo-wrap') || document.body;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    var budget = 14000;
    for (var i = 0; i < nodes.length && budget > 0; i++) {
      var node = nodes[i];
      var p = node.parentElement;
      if (!p) continue;
      var tag = p.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE') continue;
      if (p.closest('code,pre,script,style,.miyo-highlight,.miyo-search-match,.miyo-bionic')) continue;
      var t = node.nodeValue;
      if (!t || t.replace(/\\s/g, '').length < 12) continue;
      var parts = t.split(/(\\s+)/);
      var frag = document.createDocumentFragment();
      for (var j = 0; j < parts.length; j++) {
        var w = parts[j];
        if (!w || /^\\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); continue; }
        if (w.length < 4) { frag.appendChild(document.createTextNode(w)); continue; }
        var c = Math.max(1, Math.ceil(w.length * 0.42));
        var s = document.createElement('strong');
        s.className = 'miyo-bionic';
        s.style.fontWeight = '650';
        s.textContent = w.slice(0, c);
        frag.appendChild(s);
        frag.appendChild(document.createTextNode(w.slice(c)));
        budget -= w.length;
      }
      node.parentNode.replaceChild(frag, node);
    }
  } catch (e) {}
})();
true;
`;
}

// ---------------------------------------------------------------------------
// Auto-scroll injection
// ---------------------------------------------------------------------------

export function buildAutoScrollJS(speed: number): string {
  return `
(function() {
  if (window.__miyoScrollTimer) { clearInterval(window.__miyoScrollTimer); window.__miyoScrollTimer = null; }
  var speed = ${speed};
  if (!speed) return;
  var step = 0.14 + speed * 0.11;
  window.__miyoScrollTimer = setInterval(function() {
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (window.scrollY >= maxScroll - 0.5) return;
    window.scrollBy(0, step);
  }, 45);
})();
true;
`;
}
