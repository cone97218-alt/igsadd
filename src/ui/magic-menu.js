/**
 * 魔法棒菜单注入器 (Magic Wand Menu Entry)
 * 在酒馆拓展菜单中注入带 FontAwesome 放映机图标的【放映设置】入口
 */

import { openSettingsModal } from './settings-modal.js';
import { injectSettingsStyles } from './settings-styles.js';

const MENU_SELECTORS = [
    '#extensionsMenu',
    '#extensions_menu',
    '.extensions_block .list-group',
];

const ENTRY_ID = 'igs-patch-settings-magic-entry';

function getCandidateDocuments() {
    const docs = [document];
    try {
        if (window.parent && window.parent.document && !docs.includes(window.parent.document)) {
            docs.push(window.parent.document);
        }
    } catch (_) { }
    try {
        if (window.top && window.top.document && !docs.includes(window.top.document)) {
            docs.push(window.top.document);
        }
    } catch (_) { }
    return docs;
}

/**
 * 启动魔法棒菜单注入
 */
export function setupMagicMenu() {
    injectSettingsStyles();
    ensureMagicMenuEntry();

    // 监听 DOM 变化以应对菜单的动态弹出或销毁
    const docs = getCandidateDocuments();
    for (const doc of docs) {
        try {
            const observer = new MutationObserver(() => {
                ensureMagicMenuEntryDoc(doc);
            });
            observer.observe(doc.body, { childList: true, subtree: true });
        } catch (_) { }
    }

    // 定时轮询保底
    setInterval(ensureMagicMenuEntry, 2000);
    console.info('[IGS-Patch] 魔法棒菜单【放映设置】入口注入器已就绪。');
}

function ensureMagicMenuEntry() {
    for (const doc of getCandidateDocuments()) {
        ensureMagicMenuEntryDoc(doc);
    }
}

function ensureMagicMenuEntryDoc(doc) {
    if (!doc || !doc.body || typeof doc.querySelector !== 'function') return;

    for (const selector of MENU_SELECTORS) {
        const menu = doc.querySelector(selector);
        if (menu) {
            let item = menu.querySelector(`#${ENTRY_ID}`);
            if (!item) {
                item = createMagicMenuItem(doc);
                menu.appendChild(item);
                console.info('[IGS-Patch] 成功向魔法棒菜单注入【放映设置】');
            }
        }
    }
}

function createMagicMenuItem(doc) {
    const item = doc.createElement('div');
    item.id = ENTRY_ID;
    item.className = 'list-group-item flex-container flexGap5';
    item.title = '放映设置';
    item.setAttribute('role', 'button');
    item.style.cursor = 'pointer';
    item.style.display = 'flex';
    item.style.alignItems = 'center';

    item.innerHTML = `
        <i class="fa-solid fa-film" aria-hidden="true" style="margin-right: 8px; width: 16px; text-align: center;"></i>
        <span>放映设置</span>
    `;

    item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.info('[IGS-Patch] 点击了放映设置菜单项');

        // 尝试关闭酒馆魔法棒菜单
        try {
            const parentMenu = item.closest('#extensionsMenu, #extensions_menu');
            if (parentMenu) {
                parentMenu.style.display = 'none';
            }
        } catch (_) { }

        // 打开全屏 Vue 设置面板
        try {
            openSettingsModal();
        } catch (err) {
            console.error('[IGS-Patch] 呼出放映设置异常:', err);
        }
    });

    return item;
}
