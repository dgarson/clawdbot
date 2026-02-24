import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../lib/utils';

// Types
type AccentColor = 'indigo' | 'emerald' | 'violet' | 'orange' | 'rose' | 'amber' | 'cyan' | 'teal' | 'zinc';
type BorderRadius = 'none' | 'sm' | 'md' | 'xl' | 'full';
type FontSize = 'sm' | 'md' | 'lg';
type Typography = 'system-ui' | 'Inter' | 'JetBrains';
type ThemePreset = 'ocean' | 'forest' | 'sunset' | 'midnight' | 'mono';

interface ThemeTokens {
  accentColor: AccentColor;
  pageBg: number;
  cardBg: number;
  borderBg: number;
  fontSize: FontSize;
  borderRadius: BorderRadius;
  typography: Typography;
}

interface ThemePresetDef {
  name: string;
  accentColor: AccentColor;
  pageBg: number;
  cardBg: number;
  borderBg: number;
  backgroundBase: 'zinc' | 'slate';
}

// Constants
const ACCENT_COLORS: { id: AccentColor; label: string; hex: string }[] = [
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'teal', label: 'Teal', hex: '#14b8a6' },
  { id: 'zinc', label: 'Zinc', hex: '#71717a' },
];

const BORDER_RADII: { id: BorderRadius; label: string; value: string }[] = [
  { id: 'none', label: 'None', value: '0px' },
  { id: 'sm', label: 'Sm', value: '4px' },
  { id: 'md', label: 'Md', value: '8px' },
  { id: 'xl', label: 'Xl', value: '12px' },
  { id: 'full', label: 'Full', value: '9999px' },
];

const FONT_SIZES: { id: FontSize; label: string; rem: string }[] = [
  { id: 'sm', label: 'Small', rem: '0.875rem' },
  { id: 'md', label: 'Medium', rem: '1rem' },
  { id: 'lg', label: 'Large', rem: '1.125rem' },
];

const TYPOGRAPHY_OPTIONS: { id: Typography; label: string; fontFamily: string }[] = [
  { id: 'system-ui', label: 'System UI', fontFamily: 'system-ui, sans-serif' },
  { id: 'Inter', label: 'Inter', fontFamily: 'Inter, system-ui, sans-serif' },
  { id: 'JetBrains', label: 'JetBrains Mono', fontFamily: 'JetBrains Mono, monospace' },
];

const THEME_PRESETS: { id: ThemePreset; name: string; emoji: string; def: ThemePresetDef }[] = [
  {
    id: 'ocean',
    name: 'Ocean Dark',
    emoji: '🌊',
    def: {
      name: 'Ocean Dark',
      accentColor: 'indigo',
      pageBg: 950,
      cardBg: 900,
      borderBg: 800,
      backgroundBase: 'zinc',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    def: {
      name: 'Forest',
      accentColor: 'emerald',
      pageBg: 950,
      cardBg: 900,
      borderBg: 800,
      backgroundBase: 'zinc',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    emoji: '🌅',
    def: {
      name: 'Sunset',
      accentColor: 'orange',
      pageBg: 950,
      cardBg: 900,
      borderBg: 800,
      backgroundBase: 'zinc',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    emoji: '🌙',
    def: {
      name: 'Midnight',
      accentColor: 'violet',
      pageBg: 950,
      cardBg: 900,
      borderBg: 800,
      backgroundBase: 'slate',
    },
  },
  {
    id: 'mono',
    name: 'Mono',
    emoji: '⚫',
    def: {
      name: 'Mono',
      accentColor: 'zinc',
      pageBg: 950,
      cardBg: 900,
      borderBg: 800,
      backgroundBase: 'zinc',
    },
  },
];

const DEFAULT_TOKENS: ThemeTokens = {
  accentColor: 'indigo',
  pageBg: 950,
  cardBg: 900,
  borderBg: 800,
  fontSize: 'md',
  borderRadius: 'md',
  typography: 'Inter',
};

// Generate CSS variables
function generateCSSVariables(tokens: ThemeTokens): string {
  const radiusValue = BORDER_RADII.find((r) => r.id === tokens.borderRadius)?.value || '8px';
  const fontSizeValue = FONT_SIZES.find((f) => f.id === tokens.fontSize)?.rem || '1rem';
  const fontFamily = TYPOGRAPHY_OPTIONS.find((t) => t.id === tokens.typography)?.fontFamily || 'Inter, system-ui, sans-serif';

  return `:root {
  --theme-accent: ${tokens.accentColor};
  --theme-page-bg: ${tokens.pageBg};
  --theme-card-bg: ${tokens.cardBg};
  --theme-border-bg: ${tokens.borderBg};
  --theme-font-size: ${fontSizeValue};
  --theme-border-radius: ${radiusValue};
  --theme-font-family: ${fontFamily};
}`;
}

// Helper to get accent hex
function getAccentHex(color: AccentColor): string {
  const found = ACCENT_COLORS.find((c) => c.id === color);
  return found?.hex || '#6366f1';
}

export default function ThemeEditor() {
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_TOKENS);
  const [activePreset, setActivePreset] = useState<ThemePreset | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleTokenChange = useCallback(<K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K]) => {
    setTokens((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null);
  }, []);

  const handlePresetSelect = useCallback((presetId: ThemePreset) => {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) {return;}

    setTokens({
      accentColor: preset.def.accentColor,
      pageBg: preset.def.pageBg,
      cardBg: preset.def.cardBg,
      borderBg: preset.def.borderBg,
      fontSize: 'md',
      borderRadius: 'md',
      typography: 'Inter',
    });
    setActivePreset(presetId);
  }, []);

  const handleReset = useCallback(() => {
    setTokens(DEFAULT_TOKENS);
    setActivePreset(null);
  }, []);

  const handleCopyCSS = useCallback(async () => {
    const css = generateCSSVariables(tokens);
    await navigator.clipboard.writeText(css);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }, [tokens]);

  // Computed preview styles
  const previewStyles = useMemo(() => {
    const bgBase: 'zinc' | 'slate' = activePreset === 'midnight' ? 'slate' : 'zinc';
    const radiusValue = BORDER_RADII.find((r) => r.id === tokens.borderRadius)?.value || '8px';
    const fontSizeValue = FONT_SIZES.find((f) => f.id === tokens.fontSize)?.rem || '1rem';
    const fontFamilyValue = TYPOGRAPHY_OPTIONS.find((t) => t.id === tokens.typography)?.fontFamily || 'Inter, system-ui, sans-serif';
    const accentHex = getAccentHex(tokens.accentColor);
    
    // Background color maps
    const bgHexZinc: Record<number, string> = {
      950: '#09090b',
      900: '#18181b',
      800: '#27272a',
    };
    const bgHexSlate: Record<number, string> = {
      950: '#020617',
      900: '#0f172a',
      800: '#1e293b',
    };
    
    const bgHex = bgBase === 'zinc' ? bgHexZinc : bgHexSlate;
    
    return {
      pageBg: bgHex[tokens.pageBg] || bgHex[950],
      cardBg: bgHex[tokens.cardBg] || bgHex[900],
      borderBg: bgHex[tokens.borderBg] || bgHex[800],
      accentColor: accentHex,
      fontSize: fontSizeValue,
      borderRadius: radiusValue,
      fontFamily: fontFamilyValue,
    };
  }, [tokens, activePreset]);

  const accentHex = getAccentHex(tokens.accentColor);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6" role="main" aria-label="Theme Editor">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Theme Editor</h1>
          <p className="text-zinc-400">
            Customize your interface appearance with presets or fine-tune individual tokens.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls Panel */}
          <div className="space-y-8">
            {/* Theme Presets */}
            <section aria-labelledby="presets-heading">
              <h2 id="presets-heading" className="text-lg font-medium mb-4">Theme Presets</h2>
              <div className="grid grid-cols-5 gap-3" role="radiogroup" aria-label="Theme presets">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-150',
                      'border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
                      activePreset === preset.id
                        ? 'border-indigo-500 bg-zinc-900'
                        : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                    )}
                    role="radio"
                    aria-checked={activePreset === preset.id}
                    aria-label={preset.name}
                  >
                    <span className="text-2xl" aria-hidden="true">{preset.emoji}</span>
                    <span className="text-xs text-zinc-400">{preset.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Accent Color */}
            <section aria-labelledby="accent-heading">
              <h2 id="accent-heading" className="text-lg font-medium mb-4">Accent Color</h2>
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Accent color options">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => handleTokenChange('accentColor', color.id)}
                    className={cn(
                      'w-10 h-10 rounded-lg transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:ring-white',
                      tokens.accentColor === color.id
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110'
                        : 'hover:scale-105'
                    )}
                    role="radio"
                    aria-checked={tokens.accentColor === color.id}
                    aria-label={color.label}
                  >
                    <span 
                      className="block w-full h-full rounded-lg" 
                      style={{ backgroundColor: color.hex }}
                    />
                  </button>
                ))}
              </div>
            </section>

            {/* Background Depth */}
            <section aria-labelledby="background-heading">
              <h2 id="background-heading" className="text-lg font-medium mb-4">Background Depth</h2>
              <div className="space-y-5">
                {[
                  { key: 'pageBg' as const, label: 'Page Background', value: tokens.pageBg },
                  { key: 'cardBg' as const, label: 'Card Background', value: tokens.cardBg },
                  { key: 'borderBg' as const, label: 'Border Background', value: tokens.borderBg },
                ].map(({ key, label, value }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label htmlFor={key} className="text-sm text-zinc-400">{label}</label>
                      <span className="text-xs text-zinc-500 font-mono">{value}</span>
                    </div>
                    <input
                      id={key}
                      type="range"
                      min="800"
                      max="990"
                      step="10"
                      value={value}
                      onChange={(e) => handleTokenChange(key, Number(e.target.value) as 800 | 850 | 900 | 950 | 990)}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      aria-label={`${label}: ${value}`}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Font Size */}
            <section aria-labelledby="fontsize-heading">
              <h2 id="fontsize-heading" className="text-lg font-medium mb-4">Font Size Scale</h2>
              <div className="flex gap-2" role="radiogroup" aria-label="Font size options">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => handleTokenChange('fontSize', size.id)}
                    className={cn(
                      'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-150',
                      'border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
                      tokens.fontSize === size.id
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700'
                    )}
                    role="radio"
                    aria-checked={tokens.fontSize === size.id}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Border Radius */}
            <section aria-labelledby="radius-heading">
              <h2 id="radius-heading" className="text-lg font-medium mb-4">Border Radius</h2>
              <div className="flex gap-2" role="radiogroup" aria-label="Border radius options">
                {BORDER_RADII.map((radius) => (
                  <button
                    key={radius.id}
                    onClick={() => handleTokenChange('borderRadius', radius.id)}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150',
                      'border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
                      tokens.borderRadius === radius.id
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700'
                    )}
                    role="radio"
                    aria-checked={tokens.borderRadius === radius.id}
                  >
                    {radius.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Typography */}
            <section aria-labelledby="typography-heading">
              <h2 id="typography-heading" className="text-lg font-medium mb-4">Typography</h2>
              <div className="flex gap-2" role="radiogroup" aria-label="Typography options">
                {TYPOGRAPHY_OPTIONS.map((typo) => (
                  <button
                    key={typo.id}
                    onClick={() => handleTokenChange('typography', typo.id)}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150',
                      'border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
                      tokens.typography === typo.id
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700'
                    )}
                    role="radio"
                    aria-checked={tokens.typography === typo.id}
                  >
                    {typo.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Actions */}
            <section aria-labelledby="actions-heading" className="pt-4 border-t border-zinc-800">
              <h2 id="actions-heading" className="sr-only">Actions</h2>
              <div className="flex gap-3">
                <button
                  onClick={handleCopyCSS}
                  className={cn(
                    'flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-150',
                    'bg-indigo-500 hover:bg-indigo-600 text-white',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950'
                  )}
                  aria-label={copyFeedback ? 'CSS copied to clipboard' : 'Copy CSS variables to clipboard'}
                >
                  {copyFeedback ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy CSS Variables
                    </span>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className={cn(
                    'py-2.5 px-4 rounded-lg font-medium transition-all duration-150',
                    'border-2 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950'
                  )}
                  aria-label="Reset to default theme"
                >
                  Reset
                </button>
              </div>
            </section>
          </div>

          {/* Live Preview Panel */}
          <div className="lg:sticky lg:top-6 h-fit">
            <section aria-labelledby="preview-heading">
              <h2 id="preview-heading" className="text-lg font-medium mb-4">Live Preview</h2>
              <div
                className="rounded-xl p-6 transition-all duration-200"
                style={{ backgroundColor: previewStyles.pageBg }}
              >
                {/* Preview Card */}
                <div
                  className="rounded-xl p-5 mb-4"
                  style={{
                    backgroundColor: previewStyles.cardBg,
                    borderColor: previewStyles.borderBg,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderRadius: previewStyles.borderRadius,
                    fontFamily: previewStyles.fontFamily,
                    fontSize: previewStyles.fontSize,
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-zinc-100" style={{ fontFamily: previewStyles.fontFamily }}>
                      Settings
                    </h3>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${accentHex}33`,
                        color: accentHex,
                      }}
                    >
                      Pro
                    </span>
                  </div>

                  <p className="text-zinc-400 mb-4" style={{ fontFamily: previewStyles.fontFamily }}>
                    Customize your experience with personalized settings.
                  </p>

                  {/* Input */}
                  <div className="mb-4">
                    <label
                      htmlFor="preview-input"
                      className="block text-sm text-zinc-400 mb-1.5"
                      style={{ fontFamily: previewStyles.fontFamily }}
                    >
                      Username
                    </label>
                    <input
                      id="preview-input"
                      type="text"
                      placeholder="Enter username..."
                      className="w-full px-3 py-2 text-zinc-100 placeholder-zinc-500 border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0"
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderColor: `${accentHex}4d`,
                        borderRadius: previewStyles.borderRadius,
                        fontFamily: previewStyles.fontFamily,
                        fontSize: previewStyles.fontSize,
                      }}
                    />
                  </div>

                  {/* Button */}
                  <button
                    className="px-4 py-2 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      backgroundColor: accentHex,
                      borderRadius: previewStyles.borderRadius,
                      fontFamily: previewStyles.fontFamily,
                      fontSize: previewStyles.fontSize,
                    }}
                  >
                    Save Changes
                  </button>
                </div>

                {/* Mini Nav */}
                <div
                  className="flex items-center gap-1 p-2 rounded-lg"
                  style={{
                    backgroundColor: previewStyles.cardBg,
                    borderColor: previewStyles.borderBg,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderRadius: previewStyles.borderRadius,
                  }}
                >
                  {[
                    { name: 'Home', active: false },
                    { name: 'Profile', active: false },
                    { name: 'Settings', active: true },
                  ].map((item) => (
                    <button
                      key={item.name}
                      className="px-3 py-1.5 text-sm rounded-md transition-colors duration-150"
                      style={{
                        fontFamily: previewStyles.fontFamily,
                        backgroundColor: item.active ? `${accentHex}4d` : 'transparent',
                        color: item.active ? '#fff' : '#a1a1aa',
                      }}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* CSS Preview */}
              <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                <h3 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
                  Generated CSS
                </h3>
                <pre
                  className="text-xs text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap"
                  aria-label="Generated CSS variables"
                >
                  {generateCSSVariables(tokens)}
                </pre>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
