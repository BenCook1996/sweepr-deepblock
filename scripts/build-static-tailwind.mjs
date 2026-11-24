#!/usr/bin/env node
/**
 * Builds `website/sweepr-tailwind.min.css` statically from all class names
 * and dynamic class tokens across `website/` and `scripts/`, eliminating
 * runtime `https://cdn.tailwindcss.com/3.4.5` JIT overhead while preserving
 * exact Tailwind v3 spacing, colors, gradients, typography, and breakpoints.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT, 'website');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const OUT_FILE = path.join(WEBSITE_DIR, 'sweepr-tailwind.min.css');

const COLORS = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',
  slate: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
  gray: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712' },
  neutral: { 50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0a0a0a' },
  emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22' },
  brand: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22' },
  teal: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e' },
  sky: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 900: '#0c4a6e' },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
  indigo: { 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 900: '#312e81', 950: '#1e1b4b' },
  purple: { 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7' },
  red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a' },
  rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519' },
  amber: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03' }
};

const SPACING = {
  0: '0px', px: '1px', '0.5': '0.125rem', 1: '0.25rem', '1.5': '0.375rem',
  2: '0.5rem', '2.5': '0.625rem', 3: '0.75rem', '3.5': '0.875rem',
  4: '1rem', '4.5': '1.125rem', 5: '1.25rem', 6: '1.5rem', 7: '1.75rem',
  8: '2rem', 9: '2.25rem', 10: '2.5rem', 11: '2.75rem', 12: '3rem',
  13: '3.25rem', 14: '3.5rem', 16: '4rem', 20: '5rem', 24: '6rem',
  28: '7rem', 32: '8rem', 40: '10rem', 44: '11rem', 48: '12rem',
  56: '14rem', 60: '15rem', 72: '18rem'
};

const MAX_W = {
  xs: '20rem', sm: '24rem', md: '28rem', lg: '32rem', xl: '36rem',
  '2xl': '42rem', '3xl': '48rem', '4xl': '56rem', '5xl': '64rem',
  '6xl': '72rem', '7xl': '80rem', full: '100%'
};

const RADII = {
  sm: '0.125rem', DEFAULT: '0.25rem', md: '0.375rem', lg: '0.5rem',
  xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem', full: '9999px', none: '0px'
};

const TEXT_SIZES = {
  xs: ['0.75rem', '1rem'],
  sm: ['0.875rem', '1.25rem'],
  base: ['1rem', '1.5rem'],
  lg: ['1.125rem', '1.75rem'],
  xl: ['1.25rem', '1.75rem'],
  '2xl': ['1.5rem', '2rem'],
  '3xl': ['1.875rem', '2.25rem'],
  '4xl': ['2.25rem', '2.5rem'],
  '5xl': ['3rem', '1'],
  '6xl': ['3.75rem', '1']
};

const FONT_WEIGHTS = {
  normal: '400', medium: '500', semibold: '600',
  bold: '700', extrabold: '800', black: '900'
};

function hexToRgba(hex, alpha) {
  if (hex === 'transparent') return 'transparent';
  if (hex === 'currentColor') return 'currentColor';
  if (hex === 'inherit') return 'inherit';
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const a = Number(alpha) / 100;
  return `rgb(${r} ${g} ${b} / ${a})`;
}

function resolveColor(token) {
  let colorToken = token;
  let alpha = null;
  if (token.includes('/')) {
    const idx = token.lastIndexOf('/');
    colorToken = token.slice(0, idx);
    alpha = token.slice(idx + 1);
  }
  let hex = null;
  if (colorToken.startsWith('[') && colorToken.endsWith(']')) {
    hex = colorToken.slice(1, -1);
  } else if (COLORS[colorToken] && typeof COLORS[colorToken] === 'string') {
    hex = COLORS[colorToken];
  } else {
    const parts = colorToken.split('-');
    if (parts.length === 2 && COLORS[parts[0]] && COLORS[parts[0]][parts[1]]) {
      hex = COLORS[parts[0]][parts[1]];
    }
  }
  if (!hex) return null;
  if (alpha !== null && hex.startsWith('#')) return hexToRgba(hex, alpha);
  return hex;
}

function resolveSize(token, { allowFraction = false, allowAuto = false, allowScreen = false } = {}) {
  if (allowAuto && token === 'auto') return 'auto';
  if (allowScreen && token === 'screen') return '100vh';
  if (token === 'full') return '100%';
  if (SPACING[token]) return SPACING[token];
  if (allowFraction && /^\d+\/\d+$/.test(token)) {
    const [a, b] = token.split('/').map(Number);
    if (b) return `${((a / b) * 100).toFixed(6).replace(/\.?0+$/, '')}%`;
  }
  if (token.startsWith('[') && token.endsWith(']')) {
    return token.slice(1, -1).replace(/_/g, ' ');
  }
  return null;
}

function cssEscapeClass(cls) {
  return cls.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

function compileUtility(rawUtil) {
  let important = false;
  let util = rawUtil;
  if (util.startsWith('!')) {
    important = true;
    util = util.slice(1);
  }
  let negative = false;
  if (util.startsWith('-')) {
    negative = true;
    util = util.slice(1);
  }
  const imp = important ? ' !important' : '';
  const sign = negative ? '-' : '';
  const wrap = (decls) => decls.map(([p, v]) => `${p}:${v}${imp}`).join(';');

  // Exact keyword utilities
  const exact = {
    block: [['display', 'block']],
    'inline-block': [['display', 'inline-block']],
    inline: [['display', 'inline']],
    flex: [['display', 'flex']],
    'inline-flex': [['display', 'inline-flex']],
    grid: [['display', 'grid']],
    hidden: [['display', 'none']],
    relative: [['position', 'relative']],
    absolute: [['position', 'absolute']],
    fixed: [['position', 'fixed']],
    sticky: [['position', 'sticky']],
    'flex-col': [['flex-direction', 'column']],
    'flex-row': [['flex-direction', 'row']],
    'flex-wrap': [['flex-wrap', 'wrap']],
    'flex-1': [['flex', '1 1 0%']],
    'flex-grow': [['flex-grow', '1']],
    'flex-shrink': [['flex-shrink', '1']],
    'flex-shrink-0': [['flex-shrink', '0']],
    'shrink-0': [['flex-shrink', '0']],
    'items-center': [['align-items', 'center']],
    'items-start': [['align-items', 'flex-start']],
    'items-end': [['align-items', 'flex-end']],
    'items-baseline': [['align-items', 'baseline']],
    'items-stretch': [['align-items', 'stretch']],
    'justify-center': [['justify-content', 'center']],
    'justify-between': [['justify-content', 'space-between']],
    'justify-around': [['justify-content', 'space-around']],
    'justify-start': [['justify-content', 'flex-start']],
    'justify-end': [['justify-content', 'flex-end']],
    'place-items-center': [['place-items', 'center']],
    'min-h-screen': [['min-height', '100vh']],
    'min-w-0': [['min-width', '0px']],
    'max-w-full': [['max-width', '100%']],
    container: [['width', '100%']],
    'font-sans': [['font-family', 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif']],
    'font-mono': [['font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace']],
    antialiased: [['-webkit-font-smoothing', 'antialiased'], ['-moz-osx-font-smoothing', 'grayscale']],
    uppercase: [['text-transform', 'uppercase']],
    'normal-case': [['text-transform', 'none']],
    italic: [['font-style', 'italic']],
    underline: [['text-decoration-line', 'underline']],
    'line-through': [['text-decoration-line', 'line-through']],
    'no-underline': [['text-decoration-line', 'none']],
    'underline-offset-4': [['text-underline-offset', '4px']],
    truncate: [['overflow', 'hidden'], ['text-overflow', 'ellipsis'], ['white-space', 'nowrap']],
    'whitespace-nowrap': [['white-space', 'nowrap']],
    'text-left': [['text-align', 'left']],
    'text-center': [['text-align', 'center']],
    'text-right': [['text-align', 'right']],
    'leading-none': [['line-height', '1']],
    'leading-tight': [['line-height', '1.25']],
    'leading-snug': [['line-height', '1.375']],
    'leading-relaxed': [['line-height', '1.625']],
    'tracking-tighter': [['letter-spacing', '-0.05em']],
    'tracking-tight': [['letter-spacing', '-0.025em']],
    'tracking-normal': [['letter-spacing', '0em']],
    'tracking-wide': [['letter-spacing', '0.025em']],
    'tracking-wider': [['letter-spacing', '0.05em']],
    'tracking-widest': [['letter-spacing', '0.1em']],
    'tabular-nums': [['font-variant-numeric', 'tabular-nums']],
    'sr-only': [['position', 'absolute'], ['width', '1px'], ['height', '1px'], ['padding', '0'], ['margin', '-1px'], ['overflow', 'hidden'], ['clip', 'rect(0,0,0,0)'], ['white-space', 'nowrap'], ['border-width', '0']],
    'overflow-hidden': [['overflow', 'hidden']],
    'overflow-x-auto': [['overflow-x', 'auto']],
    'overflow-y-auto': [['overflow-y', 'auto']],
    'object-cover': [['object-fit', 'cover']],
    'aspect-video': [['aspect-ratio', '16 / 9']],
    'pointer-events-none': [['pointer-events', 'none']],
    'select-none': [['user-select', 'none']],
    'cursor-pointer': [['cursor', 'pointer']],
    'cursor-help': [['cursor', 'help']],
    'cursor-ew-resize': [['cursor', 'ew-resize']],
    'cursor-not-allowed': [['cursor', 'not-allowed']],
    'border-collapse': [['border-collapse', 'collapse']],
    'border-dashed': [['border-style', 'dashed']],
    border: [['border-width', '1px']],
    'border-2': [['border-width', '2px']],
    'border-t': [['border-top-width', '1px']],
    'border-t-0': [['border-top-width', '0px']],
    'border-b': [['border-bottom-width', '1px']],
    'border-l': [['border-left-width', '1px']],
    'border-l-4': [['border-left-width', '4px']],
    'border-r': [['border-right-width', '1px']],
    'border-r-2': [['border-right-width', '2px']],
    'border-y': [['border-top-width', '1px'], ['border-bottom-width', '1px']],
    'list-none': [['list-style-type', 'none']],
    'list-disc': [['list-style-type', 'disc']],
    'list-decimal': [['list-style-type', 'decimal']],
    'list-inside': [['list-style-position', 'inside']],
    'fill-current': [['fill', 'currentColor']],
    'bg-clip-text': [['background-clip', 'text'], ['-webkit-background-clip', 'text']],
    'bg-gradient-to-r': [['background-image', 'linear-gradient(to right, var(--tw-gradient-stops))']],
    'bg-gradient-to-b': [['background-image', 'linear-gradient(to bottom, var(--tw-gradient-stops))']],
    'bg-gradient-to-t': [['background-image', 'linear-gradient(to top, var(--tw-gradient-stops))']],
    'bg-gradient-to-br': [['background-image', 'linear-gradient(to bottom right, var(--tw-gradient-stops))']],
    'backdrop-blur': [['backdrop-filter', 'blur(8px)'], ['-webkit-backdrop-filter', 'blur(8px)']],
    'backdrop-blur-md': [['backdrop-filter', 'blur(12px)'], ['-webkit-backdrop-filter', 'blur(12px)']],
    'backdrop-blur-lg': [['backdrop-filter', 'blur(16px)'], ['-webkit-backdrop-filter', 'blur(16px)']],
    'backdrop-blur-xl': [['backdrop-filter', 'blur(24px)'], ['-webkit-backdrop-filter', 'blur(24px)']],
    'blur-3xl': [['filter', 'blur(64px)']],
    'brightness-75': [['filter', 'brightness(.75)']],
    'drop-shadow': [['filter', 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))']],
    'drop-shadow-md': [['filter', 'drop-shadow(0 4px 3px rgb(0 0 0 / 0.07))']],
    transform: [['transform', 'translate(var(--tw-translate-x,0),var(--tw-translate-y,0)) rotate(var(--tw-rotate,0)) scaleX(var(--tw-scale-x,1)) scaleY(var(--tw-scale-y,1))']],
    'translate-x-1/2': [['--tw-translate-x', negative ? '-50%' : '50%'], ['transform', 'translate(var(--tw-translate-x,0),var(--tw-translate-y,0)) rotate(var(--tw-rotate,0)) scaleX(var(--tw-scale-x,1)) scaleY(var(--tw-scale-y,1))']],
    'translate-y-1/2': [['--tw-translate-y', negative ? '-50%' : '50%'], ['transform', 'translate(var(--tw-translate-x,0),var(--tw-translate-y,0)) rotate(var(--tw-rotate,0)) scaleX(var(--tw-scale-x,1)) scaleY(var(--tw-scale-y,1))']],
    'translate-y-0.5': [['--tw-translate-y', negative ? '-0.125rem' : '0.125rem'], ['transform', 'translate(var(--tw-translate-x,0),var(--tw-translate-y,0))']],
    'translate-y-1': [['--tw-translate-y', negative ? '-0.25rem' : '0.25rem'], ['transform', 'translate(var(--tw-translate-x,0),var(--tw-translate-y,0))']],
    'scale-105': [['--tw-scale-x', '1.05'], ['--tw-scale-y', '1.05'], ['transform', 'translate(var(--tw-translate-x,0),var(--tw-translate-y,0)) scaleX(1.05) scaleY(1.05)']],
    'rotate-180': [['--tw-rotate', '180deg'], ['transform', 'rotate(180deg)']],
    transition: [['transition-property', 'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter'], ['transition-timing-function', 'cubic-bezier(0.4, 0, 0.2, 1)'], ['transition-duration', '150ms']],
    'transition-all': [['transition-property', 'all'], ['transition-timing-function', 'cubic-bezier(0.4, 0, 0.2, 1)'], ['transition-duration', '150ms']],
    'transition-colors': [['transition-property', 'color, background-color, border-color, text-decoration-color, fill, stroke'], ['transition-timing-function', 'cubic-bezier(0.4, 0, 0.2, 1)'], ['transition-duration', '150ms']],
    'transition-shadow': [['transition-property', 'box-shadow'], ['transition-timing-function', 'cubic-bezier(0.4, 0, 0.2, 1)'], ['transition-duration', '150ms']],
    'transition-transform': [['transition-property', 'transform'], ['transition-timing-function', 'cubic-bezier(0.4, 0, 0.2, 1)'], ['transition-duration', '150ms']],
    'duration-100': [['transition-duration', '100ms']],
    'duration-200': [['transition-duration', '200ms']],
    'animate-pulse': [['animation', 'tw-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite']],
    'animate-spin': [['animation', 'tw-spin 1s linear infinite']],
    'outline-none': [['outline', '2px solid transparent'], ['outline-offset', '2px']],
    outline: [['outline-style', 'solid']],
    'outline-2': [['outline-width', '2px']],
    'ring-2': [['box-shadow', '0 0 0 2px var(--tw-ring-color, #10b981)']],
    shadow: [['box-shadow', '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)']],
    'shadow-xs': [['box-shadow', '0 1px 2px 0 rgb(0 0 0 / 0.05)']],
    'shadow-2xs': [['box-shadow', '0 1px 1px 0 rgb(0 0 0 / 0.05)']],
    'shadow-sm': [['box-shadow', '0 1px 2px 0 rgb(0 0 0 / 0.05)']],
    'shadow-md': [['box-shadow', '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)']],
    'shadow-lg': [['box-shadow', '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)']],
    'shadow-xl': [['box-shadow', '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)']],
    'shadow-2xl': [['box-shadow', '0 25px 50px -12px rgb(0 0 0 / 0.25)']],
    'shadow-inner': [['box-shadow', 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)']],
    'inset-0': [['inset', '0px']],
    'inset-x-0': [['left', '0px'], ['right', '0px']],
    'inset-x-2.5': [['left', '0.625rem'], ['right', '0.625rem']],
    'inset-x-3': [['left', '0.75rem'], ['right', '0.75rem']],
    'inset-y-0': [['top', '0px'], ['bottom', '0px']],
    'line-clamp-2': [['overflow', 'hidden'], ['display', '-webkit-box'], ['-webkit-box-orient', 'vertical'], ['-webkit-line-clamp', '2']]
  };
  if (exact[util]) return { body: wrap(exact[util]) };

  // Divide utilities
  if (util === 'divide-y') return { body: `border-top-width:1px${imp};border-bottom-width:0px${imp}`, childCombinator: ' > :not([hidden]) ~ :not([hidden])' };
  if (util === 'divide-x') return { body: `border-left-width:1px${imp};border-right-width:0px${imp}`, childCombinator: ' > :not([hidden]) ~ :not([hidden])' };
  if (util.startsWith('divide-')) {
    const col = resolveColor(util.slice(7));
    if (col) return { body: `border-color:${col}${imp}`, childCombinator: ' > :not([hidden]) ~ :not([hidden])' };
  }
  if (util.startsWith('space-y-') && SPACING[util.slice(8)]) {
    return { body: `margin-top:${SPACING[util.slice(8)]}${imp}`, childCombinator: ' > :not([hidden]) ~ :not([hidden])' };
  }

  // Sizing & Positioning
  for (const [pfx, props] of [
    ['w-', ['width']], ['h-', ['height']],
    ['min-h-', ['min-height']], ['max-h-', ['max-height']],
    ['top-', ['top']], ['bottom-', ['bottom']], ['left-', ['left']], ['right-', ['right']]
  ]) {
    if (util.startsWith(pfx)) {
      const val = resolveSize(util.slice(pfx.length), { allowFraction: true, allowAuto: pfx === 'w-' || pfx === 'h-', allowScreen: pfx === 'min-h-' || pfx === 'h-' });
      if (val) return { body: wrap(props.map((p) => [p, sign + val])) };
    }
  }
  if (util.startsWith('max-w-')) {
    const tok = util.slice(6);
    const mv = MAX_W[tok] || resolveSize(tok);
    if (mv) return { body: wrap([['max-width', mv]]) };
  }
  if (util.startsWith('scroll-mt-') && SPACING[util.slice(10)]) {
    return { body: wrap([['scroll-margin-top', SPACING[util.slice(10)]]]) };
  }

  // Spacing: p/m/gap
  const spacingProps = {
    'p-': ['padding'], 'px-': ['padding-left', 'padding-right'], 'py-': ['padding-top', 'padding-bottom'],
    'pt-': ['padding-top'], 'pr-': ['padding-right'], 'pb-': ['padding-bottom'], 'pl-': ['padding-left'],
    'm-': ['margin'], 'mx-': ['margin-left', 'margin-right'], 'my-': ['margin-top', 'margin-bottom'],
    'mt-': ['margin-top'], 'mr-': ['margin-right'], 'mb-': ['margin-bottom'], 'ml-': ['margin-left'],
    'gap-': ['gap'], 'gap-x-': ['column-gap'], 'gap-y-': ['row-gap']
  };
  for (const [pfx, props] of Object.entries(spacingProps)) {
    if (util.startsWith(pfx)) {
      const val = resolveSize(util.slice(pfx.length), { allowAuto: pfx.startsWith('m') });
      if (val) return { body: wrap(props.map((p) => [p, val === 'auto' ? 'auto' : sign + val])) };
    }
  }

  // Grid & Col span
  if (/^grid-cols-(\d+)$/.test(util)) {
    const n = RegExp.$1;
    return { body: wrap([['grid-template-columns', `repeat(${n}, minmax(0, 1fr))`]]) };
  }
  if (/^col-span-(\d+)$/.test(util)) {
    const n = RegExp.$1;
    return { body: wrap([['grid-column', `span ${n} / span ${n}`]]) };
  }

  // Z-index & Opacity
  if (util.startsWith('z-')) {
    const tok = util.slice(2);
    const v = tok.startsWith('[') && tok.endsWith(']') ? tok.slice(1, -1) : (/^\d+$/.test(tok) ? tok : null);
    if (v !== null) return { body: wrap([['z-index', v]]) };
  }
  if (/^opacity-(\d+)$/.test(util)) {
    return { body: wrap([['opacity', String(Number(RegExp.$1) / 100)]]) };
  }

  // Radii
  if (util === 'rounded') return { body: wrap([['border-radius', RADII.DEFAULT]]) };
  if (util.startsWith('rounded-t-') && RADII[util.slice(10)]) return { body: wrap([['border-top-left-radius', RADII[util.slice(10)]], ['border-top-right-radius', RADII[util.slice(10)]]]) };
  if (util.startsWith('rounded-b') && (!util.slice(9) || RADII[util.slice(10)])) {
    const r = util === 'rounded-b' ? RADII.DEFAULT : RADII[util.slice(10)];
    return { body: wrap([['border-bottom-left-radius', r], ['border-bottom-right-radius', r]]) };
  }
  if (util.startsWith('rounded-bl-') && RADII[util.slice(11)]) return { body: wrap([['border-bottom-left-radius', RADII[util.slice(11)]]]) };
  if (util.startsWith('rounded-')) {
    const tok = util.slice(8);
    const rv = RADII[tok] || (tok.startsWith('[') && tok.endsWith(']') ? tok.slice(1, -1) : null);
    if (rv) return { body: wrap([['border-radius', rv]]) };
  }

  // Font weight & sizes & leading-[...]
  if (util.startsWith('font-') && FONT_WEIGHTS[util.slice(5)]) {
    return { body: wrap([['font-weight', FONT_WEIGHTS[util.slice(5)]]]) };
  }
  if (util.startsWith('leading-[') && util.endsWith(']')) {
    return { body: wrap([['line-height', util.slice(9, -1)]]) };
  }
  if (util.startsWith('text-')) {
    const tok = util.slice(5);
    if (TEXT_SIZES[tok]) {
      return { body: wrap([['font-size', TEXT_SIZES[tok][0]], ['line-height', TEXT_SIZES[tok][1]]]) };
    }
    if (tok.startsWith('[') && tok.endsWith(']') && !tok.startsWith('[#')) {
      return { body: wrap([['font-size', tok.slice(1, -1)]]) };
    }
    const col = resolveColor(tok);
    if (col) return { body: wrap([['color', col]]) };
  }

  // Backgrounds, Borders, Gradients, Accents, Outlines, Rings, Shadows
  if (util.startsWith('bg-')) {
    const col = resolveColor(util.slice(3));
    if (col) return { body: wrap([['background-color', col]]) };
  }
  if (util.startsWith('border-')) {
    const col = resolveColor(util.slice(7));
    if (col) return { body: wrap([['border-color', col]]) };
  }
  if (util.startsWith('outline-')) {
    const col = resolveColor(util.slice(8));
    if (col) return { body: wrap([['outline-color', col]]) };
  }
  if (util.startsWith('ring-')) {
    const col = resolveColor(util.slice(5));
    if (col) return { body: wrap([['--tw-ring-color', col]]) };
  }
  if (util.startsWith('accent-')) {
    const col = resolveColor(util.slice(7));
    if (col) return { body: wrap([['accent-color', col]]) };
  }
  if (util.startsWith('from-')) {
    const col = resolveColor(util.slice(5));
    if (col) return { body: `--tw-gradient-from:${col}${imp};--tw-gradient-to:${hexToRgba(col.startsWith('#') ? col : '#000000', 0)}${imp};--tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to)${imp}` };
  }
  if (util.startsWith('via-')) {
    const col = resolveColor(util.slice(4));
    if (col) return { body: `--tw-gradient-stops:var(--tw-gradient-from), ${col}, var(--tw-gradient-to)${imp}` };
  }
  if (util.startsWith('to-')) {
    const col = resolveColor(util.slice(3));
    if (col) return { body: `--tw-gradient-to:${col}${imp}` };
  }
  if (util.startsWith('shadow-')) {
    const tok = util.slice(7);
    if (tok.startsWith('[') && tok.endsWith(']')) {
      return { body: wrap([['box-shadow', tok.slice(1, -1).replace(/_/g, ' ')]]) };
    }
    const col = resolveColor(tok);
    if (col) return { body: wrap([['--tw-shadow-color', col]]) };
  }

  return null;
}

function getBoxLayerOrder(rawToken) {
  let util = String(rawToken).split(':').pop() || '';
  if (util.startsWith('!')) util = util.slice(1);
  if (util.startsWith('-')) util = util.slice(1);
  // Layer 2: single-side / single-corner utilities (must override axis & all-sides)
  if (
    /^(?:p[trblse]|m[trblse]|scroll-[pm][trblse])-/.test(util) ||
    /^(?:top|right|bottom|left|start|end)-/.test(util) ||
    /^border-[trbl](?:$|-)/.test(util) ||
    /^rounded-(?:tl|tr|bl|br)(?:$|-)/.test(util)
  ) {
    return 2;
  }
  // Layer 1: axis / edge utilities (must override all-sides, precede single-side)
  if (
    /^(?:[pm][xy]|inset-[xy]|gap-[xy]|scroll-[pm][xy])-/.test(util) ||
    /^border-[xy](?:$|-)/.test(util) ||
    /^rounded-[trbl](?:$|-)/.test(util)
  ) {
    return 1;
  }
  // Layer 0: all-sides & general utilities
  return 0;
}

function scanTokens() {
  const tokens = new Set([
    // Pre-seeded tokens used in refreshed SEO templates + dynamic JS state toggles
    'border-l-4', 'border-emerald-500', 'bg-slate-900', 'rounded-xl', 'p-5', 'space-y-3',
    'text-sky-400', 'bg-red-500/20', 'text-red-300', 'border-red-500/40',
    'bg-emerald-500/15', 'text-emerald-300', 'border-emerald-500/30',
    'bg-emerald-50', 'text-emerald-700', 'border-emerald-200', 'hidden', 'flex', 'block'
  ]);
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|js|mjs)$/.test(e.name)) {
        const s = fs.readFileSync(p, 'utf8');
        const reAttr = /(?:class|className)\s*=\s*["'`]([^"'`]+)["'`]/g;
        let m;
        while ((m = reAttr.exec(s))) {
          for (const c of m[1].split(/\s+/)) {
            if (c && !c.includes('${') && !c.includes('{{')) tokens.add(c);
          }
        }
        const reList = /classList\.(?:add|remove|toggle)\(\s*["']([^"']+)["']/g;
        while ((m = reList.exec(s))) {
          for (const c of m[1].split(/\s+/)) if (c) tokens.add(c);
        }
      }
    }
  }
  walk(WEBSITE_DIR);
  walk(SCRIPTS_DIR);
  const serverPath = path.join(ROOT, 'server.js');
  if (fs.existsSync(serverPath)) {
    const s = fs.readFileSync(serverPath, 'utf8');
    const reAttr = /(?:class|className)\s*=\s*["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = reAttr.exec(s))) {
      for (const c of m[1].split(/\s+/)) {
        if (c && !c.includes('${') && !c.includes('{{')) tokens.add(c);
      }
    }
  }
  return [...tokens].sort((a, b) => {
    const layerDiff = getBoxLayerOrder(a) - getBoxLayerOrder(b);
    if (layerDiff !== 0) return layerDiff;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

const PREFLIGHT = `*,::before,::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e5e7eb}
html{line-height:1.5;-webkit-text-size-adjust:100%;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
body{margin:0;line-height:inherit}
h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit;margin:0}
a{color:inherit;text-decoration:inherit}
button,input,select,textarea{font-family:inherit;font-size:100%;font-weight:inherit;line-height:inherit;color:inherit;margin:0;padding:0}
button,[role="button"]{cursor:pointer;background-color:transparent;background-image:none}
ol,ul{list-style:none;margin:0;padding:0}
img,svg,video,canvas{display:block;max-width:100%}
img,video{height:auto}
table{text-indent:0;border-color:inherit;border-collapse:collapse}
p,figure,blockquote,dl,dd{margin:0}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:1em}
@keyframes tw-spin{to{transform:rotate(360deg)}}
@keyframes tw-pulse{50%{opacity:.5}}
`;

const BP_MAP = { sm: '640px', md: '768px', lg: '1024px', xl: '1280px' };
const baseRules = [];
const stateRules = [];
const bpBuckets = { sm: [], md: [], lg: [], xl: [] };
const unrecognized = [];

for (const rawToken of scanTokens()) {
  const parts = rawToken.split(':');
  const utilName = parts[parts.length - 1];
  const variants = parts.slice(0, -1);
  const compiled = compileUtility(utilName);
  if (!compiled) {
    // Skip non-utility semantic class names (custom CSS components like .glass-nav, .btn, .adsbox, etc.)
    if (/^(bg|text|border|p|m|w|h|min|max|grid|col|gap|flex|space|divide|rounded|shadow|font|leading|tracking|sm|md|lg|xl|hover|focus|group|disabled)/.test(rawToken)) {
      unrecognized.push(rawToken);
    }
    continue;
  }

  let bp = null;
  let selector = '.' + cssEscapeClass(rawToken);
  for (const v of variants) {
    if (BP_MAP[v]) bp = v;
    else if (v === 'hover') selector += ':hover';
    else if (v === 'focus') selector += ':focus';
    else if (v === 'focus-visible') selector += ':focus-visible';
    else if (v === 'disabled') selector += ':disabled';
    else if (v === 'group-hover') selector = `.group:hover ${selector}`;
    else if (v === 'group-open') selector = `.group[open] ${selector}`;
  }
  if (compiled.childCombinator) selector += compiled.childCombinator;
  const rule = `${selector}{${compiled.body}}`;

  if (bp) bpBuckets[bp].push(rule);
  else if (variants.length) stateRules.push(rule);
  else baseRules.push(rule);
}

let cssOut = PREFLIGHT + baseRules.join('\n') + '\n' + stateRules.join('\n') + '\n';
for (const [bp, minWidth] of Object.entries(BP_MAP)) {
  if (bpBuckets[bp].length) {
    cssOut += `@media (min-width: ${minWidth}) {\n${bpBuckets[bp].join('\n')}\n}\n`;
  }
}

fs.writeFileSync(OUT_FILE, cssOut, 'utf8');
console.log(`Built ${path.relative(ROOT, OUT_FILE)} (${(cssOut.length / 1024).toFixed(1)} KB, base=${baseRules.length}, state=${stateRules.length}, responsive=${Object.values(bpBuckets).reduce((a, b) => a + b.length, 0)})`);
if (unrecognized.length) {
  console.warn('Unrecognized utility-like tokens:', unrecognized.join(', '));
}
