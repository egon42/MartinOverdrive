/** App color theme — CSS custom properties applied from Settings. */

export type ThemeColorKey =
  | 'bg'
  | 'ink'
  | 'muted'
  | 'paper'
  | 'line'
  | 'acid'
  | 'onAcid'
  | 'orange'
  | 'blue'
  | 'topbar'
  | 'showBg'
  | 'input'

export type ThemeColors = Record<ThemeColorKey, string>

export type ThemePresetId =
  | 'martin-drive'
  | 'stage-lights'
  | 'cream-paper'
  | 'midnight'
  | 'high-contrast'
  | 'amber-amp'

export const THEME_COLOR_META: { key: ThemeColorKey; label: string; hint: string }[] = [
  { key: 'bg', label: 'Page background', hint: 'Main app backdrop' },
  { key: 'ink', label: 'Text', hint: 'Headings and body copy' },
  { key: 'muted', label: 'Muted text', hint: 'Secondary labels and hints' },
  { key: 'paper', label: 'Cards & panels', hint: 'Song cards, filters, panels' },
  { key: 'line', label: 'Borders', hint: 'Dividers and outlines' },
  { key: 'acid', label: 'Accent', hint: 'Buttons, active nav, chord chips' },
  { key: 'onAcid', label: 'On accent', hint: 'Text on accent buttons' },
  { key: 'orange', label: 'Alert accent', hint: 'Capo chips, errors, dev badge' },
  { key: 'blue', label: 'Info accent', hint: 'Transpose tags, follow live' },
  { key: 'topbar', label: 'Top bar', hint: 'Sticky navigation bar' },
  { key: 'showBg', label: 'Show mode', hint: 'Full-screen stage backdrop' },
  { key: 'input', label: 'Inputs', hint: 'Text fields and selects' },
]

/** Current Martin Drive site look — default. */
export const MARTIN_DRIVE: ThemeColors = {
  bg: '#070806',
  ink: '#f5f5f1',
  muted: '#9da79e',
  paper: '#11130f',
  line: '#30352f',
  acid: '#64d66f',
  onAcid: '#061008',
  orange: '#ef4d4d',
  blue: '#3a6ea5',
  topbar: '#000000',
  showBg: '#000000',
  input: '#080a08',
}

export const THEME_PRESETS: Record<ThemePresetId, { label: string; colors: ThemeColors }> = {
  'martin-drive': { label: 'Martin Drive', colors: MARTIN_DRIVE },
  'stage-lights': {
    label: 'Stage Lights',
    colors: {
      bg: '#050505',
      ink: '#fafafa',
      muted: '#a0a0a0',
      paper: '#121212',
      line: '#2a2a2a',
      acid: '#b8ff3c',
      onAcid: '#0a1000',
      orange: '#ff6b35',
      blue: '#4ea8de',
      topbar: '#000000',
      showBg: '#000000',
      input: '#0a0a0a',
    },
  },
  'cream-paper': {
    label: 'Cream Paper',
    colors: {
      bg: '#f3f0e8',
      ink: '#101816',
      muted: '#65716c',
      paper: '#fffdf7',
      line: '#d9d8cf',
      acid: '#cbea45',
      onAcid: '#1a2208',
      orange: '#f2783c',
      blue: '#3a6ea5',
      topbar: '#f3f0e8',
      showBg: '#0c1110',
      input: '#ffffff',
    },
  },
  midnight: {
    label: 'Midnight',
    colors: {
      bg: '#0b1020',
      ink: '#e8eef8',
      muted: '#8b97b0',
      paper: '#141b2d',
      line: '#2a3550',
      acid: '#5cc8ff',
      onAcid: '#041018',
      orange: '#ff7a59',
      blue: '#7c6cff',
      topbar: '#080c18',
      showBg: '#060910',
      input: '#0a0f1c',
    },
  },
  'high-contrast': {
    label: 'High Contrast',
    colors: {
      bg: '#000000',
      ink: '#ffffff',
      muted: '#c0c0c0',
      paper: '#000000',
      line: '#ffffff',
      acid: '#ffff00',
      onAcid: '#000000',
      orange: '#ff0000',
      blue: '#00ffff',
      topbar: '#000000',
      showBg: '#000000',
      input: '#000000',
    },
  },
  'amber-amp': {
    label: 'Amber Amp',
    colors: {
      bg: '#120e08',
      ink: '#f7efe3',
      muted: '#a89880',
      paper: '#1c1610',
      line: '#3a3024',
      acid: '#e8a13c',
      onAcid: '#1a1004',
      orange: '#ef4d4d',
      blue: '#5a8fbf',
      topbar: '#0c0906',
      showBg: '#0a0805',
      input: '#100c08',
    },
  },
}

const CSS_VAR: Record<ThemeColorKey, string> = {
  bg: '--bg',
  ink: '--ink',
  muted: '--muted',
  paper: '--paper',
  line: '--line',
  acid: '--acid',
  onAcid: '--on-acid',
  orange: '--orange',
  blue: '--blue',
  topbar: '--topbar',
  showBg: '--show-bg',
  input: '--input',
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v)
}

export function isThemePresetId(v: unknown): v is ThemePresetId {
  return typeof v === 'string' && v in THEME_PRESETS
}

export function normalizeColors(raw: unknown, fallback: ThemeColors = MARTIN_DRIVE): ThemeColors {
  const out = { ...fallback }
  if (!raw || typeof raw !== 'object') return out
  const o = raw as Record<string, unknown>
  for (const key of Object.keys(CSS_VAR) as ThemeColorKey[]) {
    if (isHexColor(o[key])) out[key] = o[key]
  }
  return out
}

/** Match a color set to a known preset, or `'custom'`. */
export function matchPreset(colors: ThemeColors): ThemePresetId | 'custom' {
  for (const id of Object.keys(THEME_PRESETS) as ThemePresetId[]) {
    const preset = THEME_PRESETS[id].colors
    if ((Object.keys(CSS_VAR) as ThemeColorKey[]).every((k) => colors[k].toLowerCase() === preset[k].toLowerCase())) {
      return id
    }
  }
  return 'custom'
}

export function applyTheme(colors: ThemeColors, root: HTMLElement = document.documentElement) {
  for (const key of Object.keys(CSS_VAR) as ThemeColorKey[]) {
    root.style.setProperty(CSS_VAR[key], colors[key])
  }
  // Light cream preset needs a light color-scheme so form controls match.
  const luminance = hexLuminance(colors.bg)
  root.style.setProperty('color-scheme', luminance > 0.45 ? 'light' : 'dark')
  root.style.color = colors.ink
  root.style.background = colors.bg
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', colors.topbar)
}

function hexLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
