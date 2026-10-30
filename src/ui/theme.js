/**
 * IGS 0.37.x 原生 UI 配色主题系统
 * 严格复刻主拓展的 4 套主题（奶油风 cream, 浅色 light, 地雷色 landmine, 深色 dark）
 */

export const THEME_OPTIONS = [
    { value: 'cream', label: '奶油风', scheme: 'light', swatch: { base: '#f7f0e6', accent: '#85a76a' } },
    { value: 'light', label: '浅色', scheme: 'light', swatch: { base: '#fbfaf6', accent: '#11110f' } },
    { value: 'landmine', label: '地雷色', scheme: 'dark', swatch: { base: '#2b2b2b', accent: '#ffc4d4' } },
    { value: 'dark', label: '深色', scheme: 'dark', swatch: { base: '#24292e', accent: '#7fd6ca' } },
];

export const THEME_PALETTES = {
    landmine: {
        scheme: 'dark',
        backdrop: 'rgba(20, 19, 22, 0.78)',
        tokens: {
            'shell-bg': '#2b2b2b',
            'paper': 'rgba(255, 196, 212, 0.08)',
            'panel': '#2b2b2b',
            'surface': '#322f32',
            'card': '#322f32',
            'field': '#3e383b',
            'close-bg': '#574e53',
            'line': 'rgba(255, 255, 255, 0.08)',
            'line-strong': 'rgba(255, 196, 212, 0.25)',
            'ink': '#ffffff',
            'ink-2': 'rgba(255, 255, 255, 0.75)',
            'ink-3': 'rgba(255, 255, 255, 0.5)',
            'accent': '#ffc4d4',
            'accent-2': '#ffd9e4',
            'on-accent': '#2b2b2b',
            'danger': '#d96c6c',
            'highlight': '#4a4246',
            'raised': '#574e53',
        },
    },
    cream: {
        scheme: 'light',
        backdrop: 'rgba(92, 70, 44, 0.45)',
        tokens: {
            'shell-bg': '#f7f0e6',
            'paper': '#efe4d7',
            'panel': '#f7f0e6',
            'surface': '#f3ece1',
            'card': '#f3ece1',
            'field': '#ebe2d5',
            'close-bg': '#ebe2d5',
            'line': 'rgba(116, 91, 62, 0.12)',
            'line-strong': 'rgba(116, 91, 62, 0.22)',
            'ink': '#514638',
            'ink-2': '#735f4a',
            'ink-3': '#9a8268',
            'accent': '#85a76a',
            'accent-2': '#738f5b',
            'on-accent': '#fcf8f1',
            'danger': '#a76561',
            'highlight': '#e3d8c8',
            'raised': '#fffaf3',
        },
    },
    light: {
        scheme: 'light',
        backdrop: 'rgba(23, 23, 20, 0.4)',
        tokens: {
            'shell-bg': '#f8f5ee',
            'paper': '#ebe9e3',
            'panel': '#f8f5ee',
            'surface': '#f3f2ee',
            'card': '#f3f2ee',
            'field': '#ebe9e4',
            'close-bg': '#ebe9e4',
            'line': 'rgba(23, 23, 20, 0.08)',
            'line-strong': 'rgba(23, 23, 20, 0.18)',
            'ink': '#11110f',
            'ink-2': '#46443d',
            'ink-3': '#77736a',
            'accent': '#11110f',
            'accent-2': '#2d2b26',
            'on-accent': '#fbfaf7',
            'danger': '#95514b',
            'highlight': '#e1dfd9',
            'raised': '#ffffff',
        },
    },
    dark: {
        scheme: 'dark',
        backdrop: 'rgba(10, 14, 20, 0.78)',
        tokens: {
            'shell-bg': '#24292e',
            'paper': '#2d343b',
            'panel': '#1f2428',
            'surface': '#2a3036',
            'card': '#2a3036',
            'field': '#31383f',
            'close-bg': '#31383f',
            'line': 'rgba(205, 217, 229, 0.1)',
            'line-strong': 'rgba(127, 214, 202, 0.28)',
            'ink': '#f0f3f6',
            'ink-2': '#c9d1d9',
            'ink-3': '#8b949e',
            'accent': '#7fd6ca',
            'accent-2': '#69c7bc',
            'on-accent': '#1f2428',
            'danger': '#d07a74',
            'highlight': '#3a424a',
            'raised': '#454e57',
        },
    },
};

export function getThemeTokens(themeName) {
    const palette = THEME_PALETTES[themeName] || THEME_PALETTES.cream;
    return palette.tokens;
}

export function generateThemeCssVariables(themeName, prefix = '--igs-settings-') {
    const palette = THEME_PALETTES[themeName] || THEME_PALETTES.cream;
    const lines = [];
    lines.push(`--igs-settings-backdrop: ${palette.backdrop};`);
    for (const [k, v] of Object.entries(palette.tokens)) {
        lines.push(`${prefix}${k}: ${v};`);
    }
    return lines.join(' ');
}
