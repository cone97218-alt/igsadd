/**
 * QR 栏放映键劫持与图标重构 (QR Hijacker)
 * 
 * 核心功能：
 * 1. 探测主脚本注入在 QR 栏的 "Gal模拟" 按钮。
 * 2. 纯图标重构：彻底替换为纯 FontAwesome 放映机图标 (<i class="fa-solid fa-film"></i>)，严禁 Emoji 与括号说明。
 * 3. 视口焦点楼层感知：点击放映键时，精准获取当前屏幕所处于的楼层与对应活跃分支 (Swipe)，而非死板定位最新楼层。
 * 4. 模式调度：
 *    - 手动模式：若当前所在楼层/分支未制作，阻断阅读器，立即制作；就绪后点击即从该楼层开播。
 *    - 自动模式：直接从当前所在楼层顺畅唤起阅读器播放。
 */

import { patchState } from '../state/state.js';
import { getCurrentVisibleFloorInfo, checkFloorScriptExists, convertMessageToGal } from '../director/pipeline.js';
import { notifyToast } from './toast.js';

const QR_BUTTON_NAME = 'Gal模拟';

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

function getCandidateWindows() {
    const list = [window];
    try {
        if (window.parent && window.parent !== window && !list.includes(window.parent)) list.push(window.parent);
    } catch (_) { }
    try {
        if (window.top && window.top !== window && !list.includes(window.top)) list.push(window.top);
    } catch (_) { }
    return list;
}

/**
 * 启动放映键劫持与监听
 */
export function setupQrHijack() {
    scanAndTransformAll();

    // 监听 DOM 变化以应对 QR 栏重绘、切换对话等生命周期
    const docs = getCandidateDocuments();
    for (const doc of docs) {
        try {
            const observer = new MutationObserver(() => {
                scanAndTransformDoc(doc);
            });
            observer.observe(doc.body, { childList: true, subtree: true });
        } catch (_) { }
    }

    setInterval(scanAndTransformAll, 1500);
    console.info('[IGS-Patch] QR 栏放映键重构与劫持器已就绪。');
}

function scanAndTransformAll() {
    for (const doc of getCandidateDocuments()) {
        scanAndTransformDoc(doc);
    }
}

function scanAndTransformDoc(doc) {
    if (!doc || !doc.body || typeof doc.querySelectorAll !== 'function') return;

    const candidates = doc.querySelectorAll('.qr--button, [data-qr-name], .qr-btn, #qr--bar button, #qr--bar .menu_button, .quick-reply-button');
    for (const el of candidates) {
        if (isTargetQrButton(el)) {
            transformButton(el);
        }
    }

    const allButtons = doc.querySelectorAll('#qr--bar button, .qr--bar button, .quick_reply_container button');
    for (const el of allButtons) {
        if (isTargetQrButton(el)) {
            transformButton(el);
        }
    }
}

function isTargetQrButton(el) {
    if (!el) return false;
    const name = el.getAttribute('data-qr-name') || el.dataset?.qrName;
    if (name === QR_BUTTON_NAME) return true;

    const text = el.textContent?.trim();
    if (text === QR_BUTTON_NAME) return true;

    if (el.dataset?.igsPatchProjector === '1') return true;

    return false;
}

function transformButton(btn) {
    if (!btn) return;

    btn.dataset.igsPatchProjector = '1';

    // 纯 FontAwesome 图标，无 Emoji，无括号说明
    if (btn.dataset.igsPatchIconApplied !== '1' || !btn.querySelector('i.fa-film')) {
        btn.dataset.igsPatchIconApplied = '1';
        btn.innerHTML = '<i class="fa-solid fa-film" aria-hidden="true"></i>';
        btn.title = '放映';
        btn.setAttribute('aria-label', '放映');

        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.minWidth = '34px';
        btn.style.padding = '0 8px';
    }

    // 捕获阶段拦截点击
    if (!btn.__igsPatchClickHooked) {
        btn.__igsPatchClickHooked = true;
        btn.addEventListener('click', handleProjectorButtonClick, true);
    }
}

/**
 * 拦截放映键点击逻辑
 */
async function handleProjectorButtonClick(e) {
    // 1. 获取当前屏幕所处界面或聚焦的楼层（以及活跃分支 swipe）
    const target = getCurrentVisibleFloorInfo();
    if (!target) {
        return; // 无有效楼层，交由原版处理
    }

    const mid = target.floor;
    const sid = target.swipeId;
    const isProduced = await checkFloorScriptExists(mid, sid);
    const mode = patchState.productionMode; // 'auto' | 'manual'

    // 手动模式
    if (mode === 'manual') {
        if (!isProduced) {
            // 当前所在楼层与分支未制作：阻止打开阅读器，立即开始制作
            e.stopImmediatePropagation();
            e.preventDefault();
            try {
                await convertMessageToGal(mid, target.text, { swipeId: sid, characterName: target.characterName }, true);
            } catch (_) { }
            return;
        }

        // 已就绪：拦截默认行为，精准打开当前楼层阅读器
        e.stopImmediatePropagation();
        e.preventDefault();
        openViewerAtFloor(mid);
    } else {
        // 自动模式
        e.stopImmediatePropagation();
        e.preventDefault();

        if (!isProduced) {
            try {
                await convertMessageToGal(mid, target.text, { swipeId: sid, characterName: target.characterName }, true);
            } catch (_) { }
        }
        openViewerAtFloor(mid);
    }
}

function openViewerAtFloor(messageId) {
    for (const w of getCandidateWindows()) {
        const igs = w.IGS || w.ImmersiveGalgameSystem;
        if (igs) {
            if (typeof igs.openViewerFromMessage === 'function') {
                igs.openViewerFromMessage(messageId);
                return;
            }
            if (typeof igs.openLatestAvailable === 'function') {
                igs.openLatestAvailable();
                return;
            }
        }
    }
}
