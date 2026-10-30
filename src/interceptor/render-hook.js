/**
 * 渲染劫持拦截器 (Render Hook)
 * 拦截 IGS 阅读器与舞台渲染器的文本获取管道
 * 
 * 核心增强：
 * 1. 窗口穿透：同时穿透 window, parent, top，彻底解决沙箱 iframe 导致 window.IGS 为空的问题。
 * 2. 细粒度楼层与分支绑定：根据当前消息的 swipe_id 精确注入对应的转译剧本。
 */

import { listStoredKeys, getStoredJson, getActiveChatId } from '../tauri/adapter.js';
import { scriptMemoryStore, attachScriptToMessage, normalizeGalScript, getScriptStoreKey, getScriptMemKey } from '../director/pipeline.js';

function getCandidateWindows() {
    const wins = [window];
    try {
        if (window.parent && !wins.includes(window.parent)) wins.push(window.parent);
    } catch (_) { }
    try {
        if (window.top && !wins.includes(window.top)) wins.push(window.top);
    } catch (_) { }

    // 全面穿透所有层级的 iframe
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

/**
 * 预热加载指定楼层与分支的剧本到内存
 */
export async function preloadScriptToMemory(messageId, swipeId = 0) {
    if (messageId == null) return null;
    const mid = Number(messageId);
    const sid = Number(swipeId) || 0;
    const memKey = getScriptMemKey(mid, sid);

    if (scriptMemoryStore.has(memKey)) {
        const cached = scriptMemoryStore.get(memKey);
        const normalized = normalizeGalScript(cached);
        if (normalized !== cached) {
            scriptMemoryStore.set(memKey, normalized);
        }
        attachScriptToMessage(mid, normalized, sid);
        return normalized;
    }

    const key = getScriptStoreKey(mid, sid);
    let script = await getStoredJson(key);
    if (!script) {
        // 兼容回退旧格式
        script = await getStoredJson(`script_${mid}_s${sid}`);
    }
    if (script) {
        const normalized = normalizeGalScript(script);
        scriptMemoryStore.set(memKey, normalized);
        attachScriptToMessage(mid, normalized, sid);
        return normalized;
    }
    return null;
}

/**
 * 全量同步历史转译剧本
 */
export async function syncAllStoredScriptsToChat() {
    try {
        const keys = await listStoredKeys();
        if (!Array.isArray(keys)) return;
        const currentChatId = getActiveChatId();

        for (const k of keys) {
            // 匹配作用域格式: script_{chatId}_{mid}_s{swipeId}
            const scopedMatch = k.match(/^script_(.+)_(\d+)_s(\d+)$/);
            if (scopedMatch) {
                const cId = scopedMatch[1];
                if (cId === currentChatId) {
                    const mid = parseInt(scopedMatch[2], 10);
                    const sid = parseInt(scopedMatch[3], 10);
                    await preloadScriptToMemory(mid, sid);
                }
                continue;
            }

            // 兼容旧格式: script_{mid}_s{swipeId}
            const match = k.match(/^script_(\d+)_s(\d+)$/);
            if (match) {
                const mid = parseInt(match[1], 10);
                const sid = parseInt(match[2], 10);
                await preloadScriptToMemory(mid, sid);
            } else if (k.startsWith('script_')) {
                // 兼容旧版格式 script_{mid}
                const mid = parseInt(k.replace('script_', ''), 10);
                if (!isNaN(mid)) {
                    await preloadScriptToMemory(mid, 0);
                }
            }
        }
    } catch (err) {
        console.warn('[IGS-Patch] 全量同步剧本到内存异常:', err);
    }
}

/**
 * 设置渲染拦截
 */
export function setupRenderHook() {
    const wins = getCandidateWindows();
    wins.forEach((w) => {
        hookTavernHelperInWindow(w);
        observeIgsInWindow(w, (igs) => {
            hookIgsInstance(igs, w);
        });
    });

    syncAllStoredScriptsToChat();
}

function hookTavernHelperInWindow(win) {
    try {
        const helper = win.TavernHelper;
        if (helper && typeof helper.getChatMessages === 'function' && !helper.__tauri_patch_hooked) {
            helper.__tauri_patch_hooked = true;
            const originalGetChatMessages = helper.getChatMessages.bind(helper);

            helper.getChatMessages = function (range, ...rest) {
                const messages = originalGetChatMessages(range, ...rest);
                if (!Array.isArray(messages)) return messages;

                return messages.map((msg, i) => {
                    const realId = findRealFloorIndex(msg, i, win);
                    const swipeId = Number(msg.swipe_id) || 0;
                    const memKey = `${realId}_${swipeId}`;

                    const rawScript = scriptMemoryStore.get(memKey) || msg.extra?.igs_patch_scripts?.[swipeId];
                    if (rawScript) {
                        const script = normalizeGalScript(rawScript);
                        return {
                            ...msg,
                            id: realId,
                            text: script,
                            visibleText: script,
                            displayText: script,
                            plainText: script,
                            formattedText: script,
                            rawHtml: script,
                            mes: script,
                            element: null, // 强制清空 element，阻止 dom-visible-override 覆盖
                        };
                    } else if (msg && typeof msg.mes === 'string' && msg.mes.includes('[speaker:')) {
                        // 容错：防止未经转译的脏格式直接引发阅读器角色归属崩坏
                        const cleaned = normalizeGalScript(msg.mes);
                        return {
                            ...msg,
                            text: cleaned,
                            visibleText: cleaned,
                            displayText: cleaned,
                            plainText: cleaned,
                            formattedText: cleaned,
                            rawHtml: cleaned,
                            mes: cleaned,
                            element: null,
                        };
                    }
                    return msg;
                });
            };
            console.info('[IGS-Patch] 已成功挂钩 TavernHelper.getChatMessages');
        }
    } catch (_) { }
}

function findRealFloorIndex(msg, defaultIdx, win) {
    const chat = win.SillyTavern?.getContext?.()?.chat || window.SillyTavern?.getContext?.()?.chat;
    if (Array.isArray(chat)) {
        const directIdx = chat.indexOf(msg);
        if (directIdx !== -1) return directIdx;

        const contentIdx = chat.findIndex((m) => m && msg && m.mes === msg.mes && Boolean(m.is_user) === Boolean(msg.is_user));
        if (contentIdx !== -1) return contentIdx;
    }
    return Number(msg?.id ?? defaultIdx);
}

function hookIgsInstance(igs, ownerWin) {
    if (!igs || igs.__tauri_patch_hooked) return;
    igs.__tauri_patch_hooked = true;

    // 劫持 openViewerFromMessage
    if (typeof igs.openViewerFromMessage === 'function') {
        const originalOpen = igs.openViewerFromMessage.bind(igs);
        igs.openViewerFromMessage = async function (messageId, mode, openOptions = {}) {
            const mid = Number(messageId);
            const chat = ownerWin.SillyTavern?.getContext?.()?.chat;
            const sid = Number(chat?.[mid]?.swipe_id) || 0;
            await preloadScriptToMemory(mid, sid);
            return originalOpen(messageId, mode, openOptions);
        };
    }

    // 劫持 openLatestAvailable
    if (typeof igs.openLatestAvailable === 'function') {
        const originalOpenLatest = igs.openLatestAvailable.bind(igs);
        igs.openLatestAvailable = async function (mode, options = {}) {
            const chat = ownerWin.SillyTavern?.getContext?.()?.chat;
            if (Array.isArray(chat) && chat.length > 0) {
                for (let i = chat.length - 1; i >= 0; i--) {
                    if (chat[i] && !chat[i].is_user) {
                        const sid = Number(chat[i].swipe_id) || 0;
                        await preloadScriptToMemory(i, sid);
                        break;
                    }
                }
            }
            return originalOpenLatest(mode, options);
        };
    }
}

function observeIgsInWindow(win, onFound) {
    if (win.IGS || win.ImmersiveGalgameSystem) {
        onFound(win.IGS || win.ImmersiveGalgameSystem);
        return;
    }

    let intervalId = setInterval(() => {
        if (win.IGS || win.ImmersiveGalgameSystem) {
            clearInterval(intervalId);
            onFound(win.IGS || win.ImmersiveGalgameSystem);
        }
    }, 500);

    setTimeout(() => clearInterval(intervalId), 30000);
}
