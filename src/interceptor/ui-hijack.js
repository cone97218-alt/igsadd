/**
 * 界面交互与设置劫持器 (UI Hijack Interceptor)
 * 
 * 核心功能：
 * 1. 深度劫持原生标题画面（Title Screen）与放映阅读器（Reader）中的设置与素材按钮：
 *    - 点击「生成主角立绘」、「调整立绘」、「补全立绘」-> 自动定向至新建的 Vue 放映资源控制台（角色页）。
 *    - 点击「CG 库」-> 定向至 Vue 资源控制台（CG 画廊页）。
 *    - 点击「补全物品图」-> 定向至 Vue 资源控制台（道具页）。
 *    - 点击「设置」-> 自动定向至新建的 Vue 放映设置控制台。
 * 2. 彻底拦截原生旧版 #igs-settings 弹窗，防止其在舞台上方闪烁或错位叠加。
 * 3. 劫持 window.IGS.openSettings 与 app.igsUi.openSettings 代码级调用。
 */

import { openSettingsModal } from '../ui/settings-modal.js';
import { openResourcesModal } from '../ui/resources-modal.js';

function getCandidateWindows() {
    const wins = [window];
    try {
        if (window.parent && !wins.includes(window.parent)) wins.push(window.parent);
    } catch (_) { }
    try {
        if (window.top && !wins.includes(window.top)) wins.push(window.top);
    } catch (_) { }

    try {
        const rootDoc = (window.top || window.parent || window).document;
        if (rootDoc) {
            const iframes = rootDoc.querySelectorAll('iframe');
            for (const f of iframes) {
                try {
                    const fw = f.contentWindow;
                    if (fw && !wins.includes(fw)) wins.push(fw);
                } catch (_) { }
            }
        }
    } catch (_) { }

    return wins;
}

const SUPPRESS_OLD_SETTINGS_STYLE_ID = 'igs-patch-suppress-old-settings';

/**
 * 注入全局样式，强制隐藏原生遗留的 #igs-settings 容器
 */
export function injectSettingsSuppressionStyles() {
    const css = `
        /* 彻底压制原生旧版设置弹窗与遮罩层，杜绝界面错位 */
        #igs-settings,
        .igs-settings-overlay,
        [data-igs-settings] {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            visibility: hidden !important;
            z-index: -9999 !important;
        }
    `;

    for (const w of getCandidateWindows()) {
        try {
            const doc = w.document;
            if (doc && !doc.getElementById(SUPPRESS_OLD_SETTINGS_STYLE_ID)) {
                const style = doc.createElement('style');
                style.id = SUPPRESS_OLD_SETTINGS_STYLE_ID;
                style.textContent = css;
                (doc.head || doc.body || doc.documentElement).appendChild(style);
            }
        } catch (_) { }
    }
}

let isHijackInstalled = false;

/**
 * 全局安装界面劫持监听器
 */
export function setupUiHijack() {
    if (isHijackInstalled) return;
    isHijackInstalled = true;

    injectSettingsSuppressionStyles();

    const handleCaptureClick = (e) => {
        const target = e.target;
        if (!target || typeof target.closest !== 'function') return;

        // 如果点击发生在补丁自己的弹窗内部，放行
        if (target.closest('.igs-patch-window') || target.closest('.igs-resources-window')) {
            return;
        }

        // 1. 原生标题主菜单（Title Screen）按钮拦截
        const tsBtn = target.closest('[data-ts-act]');
        if (tsBtn) {
            const act = tsBtn.getAttribute('data-ts-act');
            if (act === 'settings') {
                e.preventDefault();
                e.stopImmediatePropagation();
                console.info('[IGS-Patch] 拦截到标题画面「设置」按钮点击，切换至 Vue 设置控制台');
                openSettingsModal();
                return;
            }
            if (act === 'user-char') {
                e.preventDefault();
                e.stopImmediatePropagation();
                console.info('[IGS-Patch] 拦截到标题画面「生成主角立绘」按钮点击，切换至 Vue 资源控制台 (角色页)');
                openResourcesModal({ initialTab: 'characters' });
                return;
            }
        }

        // 2. 原生阅读器控制栏（Reader Toolbar）按钮拦截
        const actBtn = target.closest('[data-act]');
        if (actBtn) {
            const act = actBtn.getAttribute('data-act');
            if (act === 'settings') {
                e.preventDefault();
                e.stopImmediatePropagation();
                console.info('[IGS-Patch] 拦截到阅读器「设置」按钮点击，切换至 Vue 设置控制台');
                openSettingsModal();
                return;
            }
            if (act === 'generate-assets' || act === 'sprite-edit' || act === 'live2d-settings') {
                e.preventDefault();
                e.stopImmediatePropagation();
                console.info('[IGS-Patch] 拦截到阅读器「立绘/素材」按钮点击，切换至 Vue 资源控制台 (角色页)');
                openResourcesModal({ initialTab: 'characters' });
                return;
            }
            if (act === 'cg-gallery') {
                e.preventDefault();
                e.stopImmediatePropagation();
                console.info('[IGS-Patch] 拦截到阅读器「CG 库」按钮点击，切换至 Vue 资源控制台 (CG 画廊)');
                openResourcesModal({ initialTab: 'cgs' });
                return;
            }
            if (act === 'fill-item-images') {
                e.preventDefault();
                e.stopImmediatePropagation();
                console.info('[IGS-Patch] 拦截到阅读器「补全物品图」按钮点击，切换至 Vue 资源控制台 (道具库)');
                openResourcesModal({ initialTab: 'items' });
                return;
            }
        }

        // 3. 文本容错拦截（防备其他没有带 data-act 属性的旧按钮）
        const buttonEl = target.closest('button, .igs-icon-btn, .igs-ts-btn, .igs-menu-item');
        if (buttonEl) {
            const text = (buttonEl.textContent || buttonEl.getAttribute('title') || '').trim();
            if (text.includes('生成主角立绘') || text === '生成立绘' || text === '补全立绘与背景') {
                e.preventDefault();
                e.stopImmediatePropagation();
                openResourcesModal({ initialTab: 'characters' });
                return;
            }
            if (text === 'CG 库' || text === 'CG库' || text === 'CG 画廊') {
                e.preventDefault();
                e.stopImmediatePropagation();
                openResourcesModal({ initialTab: 'cgs' });
                return;
            }
            if (text === '补全物品图' || text === '物品道具') {
                e.preventDefault();
                e.stopImmediatePropagation();
                openResourcesModal({ initialTab: 'items' });
                return;
            }
        }
    };

    // 挂载到所有候选窗口的 capture 事件阶段，确保拥有最高优先级
    for (const w of getCandidateWindows()) {
        try {
            w.document.addEventListener('click', handleCaptureClick, true);
        } catch (_) { }
    }

    // 周期性巡检挂钩 API
    hookProgrammaticOpenSettings();
    setInterval(hookProgrammaticOpenSettings, 2000);
}

/**
 * 拦截 window.IGS.openSettings 与 app.igsUi.openSettings
 */
export function hookProgrammaticOpenSettings() {
    for (const w of getCandidateWindows()) {
        try {
            const igs = w.IGS || w.ImmersiveGalgameSystem;
            if (igs && typeof igs.openSettings === 'function' && !igs.openSettings.__igsPatched) {
                const originalOpen = igs.openSettings.bind(igs);
                igs.openSettings = function (options = {}) {
                    console.info('[IGS-Patch] 拦截到编程式 IGS.openSettings 调用:', options);
                    const page = options?.page || options?.tab || '';
                    if (['chars', 'scene', 'sprites'].includes(page)) {
                        openResourcesModal({ initialTab: 'characters' });
                        return { ok: true };
                    }
                    if (['cg', 'gallery', 'illustrations'].includes(page)) {
                        openResourcesModal({ initialTab: 'cgs' });
                        return { ok: true };
                    }
                    if (['items', 'inventory'].includes(page)) {
                        openResourcesModal({ initialTab: 'items' });
                        return { ok: true };
                    }
                    if (['wardrobe'].includes(page)) {
                        openResourcesModal({ initialTab: 'wardrobe' });
                        return { ok: true };
                    }
                    openSettingsModal();
                    return { ok: true };
                };
                igs.openSettings.__igsPatched = true;
            }

            if (igs?.igsUi && typeof igs.igsUi.openSettings === 'function' && !igs.igsUi.openSettings.__igsPatched) {
                igs.igsUi.openSettings = function (options = {}) {
                    console.info('[IGS-Patch] 拦截到编程式 igsUi.openSettings 调用:', options);
                    const page = options?.page || options?.tab || '';
                    if (['chars', 'scene', 'sprites'].includes(page)) {
                        openResourcesModal({ initialTab: 'characters' });
                        return { ok: true };
                    }
                    if (['cg', 'gallery', 'illustrations'].includes(page)) {
                        openResourcesModal({ initialTab: 'cgs' });
                        return { ok: true };
                    }
                    if (['items', 'inventory'].includes(page)) {
                        openResourcesModal({ initialTab: 'items' });
                        return { ok: true };
                    }
                    if (['wardrobe'].includes(page)) {
                        openResourcesModal({ initialTab: 'wardrobe' });
                        return { ok: true };
                    }
                    openSettingsModal();
                    return { ok: true };
                };
                igs.igsUi.openSettings.__igsPatched = true;
            }
        } catch (_) { }
    }
}
