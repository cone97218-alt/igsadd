/**
 * 补丁全局状态与配置中心 (State Management)
 */

import { getStoredJson, setStoredJson } from '../tauri/adapter.js';

const STORAGE_KEY_PROD_MODE = 'igs:patch:production_mode';
const STORAGE_KEY_THEME = 'igs:patch:ui_theme';

export const patchState = {
    // 制作模式：'auto' (自动制作) | 'manual' (手动制作)
    productionMode: 'auto',

    // 拦截到的 IGS 原生提示词与标签规则
    interceptedPrompt: {
        system: '',
        depth0: '',
        segments: [],
        rawKeys: {},
        updatedAt: null,
        charCount: 0,
    },

    // 演出制作运行时状态
    productionStatus: {
        isProducing: false,
        floor: null,
        progress: '',
        error: null,
        lastSuccessAt: null,
    },

    // UI 配色主题：'cream' | 'light' | 'landmine' | 'dark'
    theme: 'cream',
};

// 状态变更监听器集合
const stateListeners = new Set();

export function subscribeState(listener) {
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
}

export function notifyStateChange() {
    for (const listener of stateListeners) {
        try {
            listener(patchState);
        } catch (e) {
            console.warn('[IGS-Patch] 状态监听器执行异常:', e);
        }
    }
}

/**
 * 初始化配置（从持久化存储恢复）
 */
export async function initConfig() {
    try {
        const savedMode = localStorage.getItem(STORAGE_KEY_PROD_MODE);
        if (savedMode === 'manual' || savedMode === 'auto') {
            patchState.productionMode = savedMode;
        }

        const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
        if (savedTheme) {
            patchState.theme = savedTheme;
        } else {
            // 尝试同步主扩展当前主题
            detectAndSyncIgsTheme();
        }
    } catch (_) { }

    notifyStateChange();
}

/**
 * 切换制作模式
 * @param {'auto'|'manual'} mode
 */
export function setProductionMode(mode) {
    if (mode !== 'auto' && mode !== 'manual') return;
    patchState.productionMode = mode;
    try {
        localStorage.setItem(STORAGE_KEY_PROD_MODE, mode);
    } catch (_) { }
    notifyStateChange();
}

/**
 * 保存拦截到的 IGS 提示词规则
 */
export function saveInterceptedRule(key, content, meta = {}) {
    if (!key || !content) return;
    const strContent = String(content).trim();
    if (!strContent) return;

    // 检查是否有实质变化，无变化不重复更新与刷屏
    if (key === 'igs-scene-assets-format-rule') {
        if (patchState.interceptedPrompt.system === strContent) return;
        patchState.interceptedPrompt.system = strContent;
    } else if (key === 'igs-scene-assets-depth0') {
        if (patchState.interceptedPrompt.depth0 === strContent) return;
        patchState.interceptedPrompt.depth0 = strContent;
    } else {
        const existingIdx = patchState.interceptedPrompt.segments.findIndex((s) => s.id === key);
        if (existingIdx >= 0) {
            if (patchState.interceptedPrompt.segments[existingIdx].content === strContent) return;
            patchState.interceptedPrompt.segments[existingIdx] = { id: key, content: strContent, meta };
        } else {
            patchState.interceptedPrompt.segments.push({ id: key, content: strContent, meta });
        }
    }

    patchState.interceptedPrompt.rawKeys[key] = {
        content: strContent,
        meta,
        at: Date.now(),
    };

    patchState.interceptedPrompt.updatedAt = Date.now();
    patchState.interceptedPrompt.charCount =
        (patchState.interceptedPrompt.system.length || 0) +
        (patchState.interceptedPrompt.depth0.length || 0) +
        patchState.interceptedPrompt.segments.reduce((acc, s) => acc + (s.content?.length || 0), 0);

    console.info(`[IGS-Patch] 截获/更新 IGS 规则 [${key}] (${strContent.length}字)`);
    notifyStateChange();
}

/**
 * 更新制作状态
 */
export function updateProductionStatus(partial) {
    Object.assign(patchState.productionStatus, partial);
    notifyStateChange();
}

/**
 * 设置界面主题
 */
export function setTheme(themeName) {
    patchState.theme = themeName;
    try {
        localStorage.setItem(STORAGE_KEY_THEME, themeName);
    } catch (_) { }
    notifyStateChange();
}

/**
 * 探测并同步主拓展的主题
 */
export function detectAndSyncIgsTheme() {
    try {
        const candidates = [window, window.parent, window.top].filter(Boolean);
        for (const w of candidates) {
            const igs = w.IGS || w.ImmersiveGalgameSystem;
            const settings = igs?.getUnifiedSettings?.();
            const igsTheme = settings?.bridge?.settingsTheme || localStorage.getItem('igs:settings:theme');
            if (igsTheme) {
                patchState.theme = igsTheme;
                return igsTheme;
            }
        }
    } catch (_) { }
    return patchState.theme;
}
