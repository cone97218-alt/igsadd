/**
 * 剧本转译调度管线 (Pipeline)
 * 深度绑定：楼层号 (Floor) + 分支编号 (Swipe)
 * 
 * 核心机制：
 * 1. 细粒度键值绑定：每个剧本以 mid + swipeId 双重定位，切换分支即切换对应剧本，删除楼层即同步删除。
 * 2. 多重存储：内存缓存 + 消息对象 extra.igs_patch_scripts + TauriTavern Rust KV (script_{mid}_s{swipeId})。
 * 3. 视口目标感知：获取当前界面所在或聚焦的楼层，而非盲目定位最新楼层。
 */

import { getStoredJson, setStoredJson, deleteStoredJson, listStoredKeys, findLastMessage } from '../tauri/adapter.js';
import { buildDirectorRequestPayload } from './grammar-prompt.js';
import { requestSecondaryLlm } from './secondary-llm.js';
import { notifyToast } from '../ui/toast.js';
import { updateProductionStatus } from '../state/state.js';

// 全局内存剧本库（key: `${mid}_${swipeId}`）
export const scriptMemoryStore = new Map();

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
 * 获取当前消息的活跃 swipe 编号
 */
export function getActiveSwipeId(messageId) {
    const mid = Number(messageId);
    if (isNaN(mid)) return 0;
    for (const w of getCandidateWindows()) {
        try {
            const chat = w.SillyTavern?.getContext?.()?.chat;
            if (Array.isArray(chat) && chat[mid]) {
                return Number(chat[mid].swipe_id) || 0;
            }
        } catch (_) { }
    }
    return 0;
}

/**
 * 智能获取当前界面可见或聚焦的楼层信息
 * 优先匹配屏幕中心可见的 Assistant 楼层，未找到时回退到最后一条 Assistant 消息
 */
export function getCurrentVisibleFloorInfo() {
    let chat = null;
    let targetDoc = null;

    for (const w of getCandidateWindows()) {
        try {
            const ctx = w.SillyTavern?.getContext?.();
            if (Array.isArray(ctx?.chat)) {
                chat = ctx.chat;
            }
            if (w.document && w.document.querySelector('#chat')) {
                targetDoc = w.document;
            }
        } catch (_) { }
    }

    if (!chat || !Array.isArray(chat)) {
        return null;
    }

    let bestMid = null;

    // 1. 如果有可见的聊天 DOM，按视口高度与位置进行测算
    if (targetDoc) {
        const chatContainer = targetDoc.querySelector('#chat');
        if (chatContainer) {
            const chatRect = chatContainer.getBoundingClientRect();
            const centerY = chatRect.top + chatRect.height * 0.45; // 黄金视线分割点

            const mesNodes = Array.from(chatContainer.querySelectorAll('.mes[mesid], [data-mesid], .mes'));
            let bestDist = Infinity;

            for (const node of mesNodes) {
                const rawId = node.getAttribute('mesid') || node.getAttribute('data-mesid');
                if (rawId == null) continue;
                const mid = parseInt(rawId, 10);
                if (isNaN(mid) || !chat[mid]) continue;

                const msg = chat[mid];
                if (msg.is_user) continue;

                const rect = node.getBoundingClientRect();
                // 位于容器可视范围内
                if (rect.bottom >= chatRect.top && rect.top <= chatRect.bottom) {
                    const nodeCenterY = (rect.top + rect.bottom) / 2;
                    const dist = Math.abs(nodeCenterY - centerY);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestMid = mid;
                    }
                }
            }
        }
    }

    // 2. 若未能从视口匹配到，回退到最后一条 Assistant 消息
    if (bestMid == null) {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i] && !chat[i].is_user) {
                bestMid = i;
                break;
            }
        }
    }

    if (bestMid == null || !chat[bestMid]) return null;

    const msg = chat[bestMid];
    const swipeId = Number(msg.swipe_id) || 0;
    const swipes = Array.isArray(msg.swipes) ? msg.swipes : [msg.mes || msg.text || ''];
    const currentSwipeText = (swipes[swipeId] != null ? swipes[swipeId] : (msg.mes || msg.text || '')).trim();

    return {
        floor: bestMid,
        swipeId,
        totalSwipes: Math.max(1, swipes.length),
        text: currentSwipeText,
        characterName: msg.name || '',
        msg,
    };
}

/**
 * 检查某楼层的特定分支是否已制作演出
 */
export async function checkFloorScriptExists(messageId, swipeId = null) {
    if (messageId == null) return false;
    const mid = Number(messageId);
    const sid = swipeId != null ? Number(swipeId) : getActiveSwipeId(mid);
    const memKey = `${mid}_${sid}`;

    if (scriptMemoryStore.has(memKey)) return true;

    // 检查 message.extra
    for (const w of getCandidateWindows()) {
        try {
            const msg = w.SillyTavern?.getContext?.()?.chat?.[mid];
            if (msg?.extra?.igs_patch_scripts?.[sid]) {
                const cached = msg.extra.igs_patch_scripts[sid];
                scriptMemoryStore.set(memKey, cached);
                attachScriptToMessage(mid, cached, sid);
                return true;
            }
        } catch (_) { }
    }

    // 检查 Tauri Store
    try {
        const cached = await getStoredJson(`script_${mid}_s${sid}`);
        if (cached && typeof cached === 'string' && cached.trim()) {
            scriptMemoryStore.set(memKey, cached);
            attachScriptToMessage(mid, cached, sid);
            return true;
        }
    } catch (_) { }

    return false;
}

/**
 * 将转译剧本挂载到内存与消息对象上
 */
export function attachScriptToMessage(messageId, script, swipeId = 0) {
    if (messageId == null || !script) return;
    const mid = Number(messageId);
    const sid = Number(swipeId) || 0;
    const memKey = `${mid}_${sid}`;
    scriptMemoryStore.set(memKey, script);

    for (const w of getCandidateWindows()) {
        try {
            const chat = w.SillyTavern?.getContext?.()?.chat;
            if (Array.isArray(chat) && chat[mid]) {
                const msg = chat[mid];
                msg.extra = msg.extra || {};
                msg.extra.igs_patch_scripts = msg.extra.igs_patch_scripts || {};
                msg.extra.igs_patch_scripts[sid] = script;

                // 仅当当前活跃的 swipe 确实等于目标 sid 时，才挂载到可见文本流
                const activeSid = Number(msg.swipe_id) || 0;
                if (activeSid === sid) {
                    msg.text = script;
                    msg.visibleText = script;
                    msg.displayText = script;
                    msg.plainText = script;
                    msg.formattedText = script;
                    msg.rawHtml = script;
                }
            }
        } catch (_) { }
    }
}

/**
 * 剧本代码级后处理与语法规范纠偏
 * 彻底消除 [speaker:...] 等旧格式标签，确保符合 IGS 0.37.x 原生规范
 * 1. [speaker:旁白] -> 纯文本自然段落（彻底移除 speaker 标签）
 * 2. [speaker:角色(心理)] [emotion:情绪] -> [igs-thought:角色|情绪|内容]
 * 3. [speaker:角色] [emotion:情绪] -> [igs-char:角色|情绪|内容]
 * 4. 彻底去除 Markdown 代码块包裹
 */
export function normalizeGalScript(rawScript) {
    if (!rawScript || typeof rawScript !== 'string') return '';
    let text = rawScript.trim();

    // 1. 去除 Markdown 代码块包裹
    text = text.replace(/^```[a-z]*\s*\n/i, '').replace(/\n```\s*$/i, '');

    // 规范化换行
    text = text.replace(/\r\n/g, '\n');

    // 2. 切分段落
    const blocks = text.split(/\n{2,}/);
    const normalizedBlocks = [];

    for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        // 如果是纯粹的 igs 标准指令行 (igs-scene, igs-char, igs-thought, igs-fx)
        if (/^\[igs-(?:scene|char|thought|fx):/i.test(trimmed)) {
            normalizedBlocks.push(trimmed);
            continue;
        }

        // 旁白标签清除：[speaker:旁白] 或 [speaker:Narrator]
        if (/^\[(?:speaker|角色|说话人):\s*(?:旁白|叙述|解说|Narrator)\s*\]/i.test(trimmed)) {
            const pureText = trimmed.replace(/^\[(?:speaker|角色|说话人):\s*(?:旁白|叙述|解说|Narrator)\s*\]\s*(?:\[(?:emotion|情绪):[^\]]*\])?\s*/i, '').trim();
            if (pureText) normalizedBlocks.push(pureText);
            continue;
        }

        // 心理标签转换：[speaker:角色(心理)] [emotion:情绪] 内容
        const thoughtMatch = trimmed.match(/^\[(?:speaker|角色|说话人):\s*([^(\])]+?)\s*[(（](?:心理|心声|内心|想法)[)）]\s*\](?:\s*\[(?:emotion|情绪):\s*([^\]]+?)\s*\])?\s*([\s\S]+)$/i);
        if (thoughtMatch) {
            const charName = thoughtMatch[1].trim();
            const emotion = (thoughtMatch[2] || '平静').trim();
            const content = thoughtMatch[3].trim();
            normalizedBlocks.push(`[igs-thought:${charName}|${emotion}|${content}]`);
            continue;
        }

        // 对白标签转换：[speaker:角色] [emotion:情绪] 台词
        const charMatch = trimmed.match(/^\[(?:speaker|角色|说话人):\s*([^\]]+?)\s*\](?:\s*\[(?:emotion|情绪):\s*([^\]]+?)\s*\])?\s*([\s\S]+)$/i);
        if (charMatch) {
            const charName = charMatch[1].trim();
            if (charName === '旁白' || charName === '叙述' || charName === 'Narrator') {
                const pureText = (charMatch[3] || '').trim();
                if (pureText) normalizedBlocks.push(pureText);
            } else {
                const emotion = (charMatch[2] || '平静').trim();
                const content = charMatch[3].trim();
                normalizedBlocks.push(`[igs-char:${charName}|${emotion}|${content}]`);
            }
            continue;
        }

        // 普通自然段落，原样保留
        normalizedBlocks.push(trimmed);
    }

    return normalizedBlocks.join('\n\n');
}

/**
 * 将指定楼层与分支的正文通过副模型转换为 Gal 演出剧本
 */
export async function convertMessageToGal(messageId, rawText, contextMeta = {}, force = false) {
    if (messageId == null || !rawText || !rawText.trim()) {
        return null;
    }

    const mid = Number(messageId);
    const sid = contextMeta.swipeId != null ? Number(contextMeta.swipeId) : getActiveSwipeId(mid);
    const storeKey = `script_${mid}_s${sid}`;
    const memKey = `${mid}_${sid}`;

    // 检查缓存
    if (!force) {
        if (scriptMemoryStore.has(memKey)) {
            const cached = scriptMemoryStore.get(memKey);
            attachScriptToMessage(mid, cached, sid);
            refreshIgsStage(mid);
            return cached;
        }
        const stored = await getStoredJson(storeKey);
        if (stored && typeof stored === 'string' && stored.trim()) {
            attachScriptToMessage(mid, stored, sid);
            refreshIgsStage(mid);
            return stored;
        }
    }

    try {
        console.info(`[IGS-Patch] 正在使用副 API 转译第 ${mid} 楼 (分支 ${sid}) 为 Gal 演出...`);
        updateProductionStatus({
            isProducing: true,
            floor: mid,
            swipeId: sid,
            progress: `正在改写第 ${mid} 楼演出...`,
            error: null,
        });

        notifyToast(`第 ${mid} 楼开始制作`, 'info', 1800);

        const payload = buildDirectorRequestPayload(rawText, contextMeta);
        const converted = await requestSecondaryLlm(payload);

        if (!converted || !converted.trim()) {
            throw new Error('副 API 返回剧本为空');
        }

        // 代码级清洗与语法纠偏，确保符合 IGS 0.37.x 原生规范
        const normalized = normalizeGalScript(converted);

        // 存入 Tauri KV
        await setStoredJson(storeKey, normalized);

        // 挂载到内存与消息
        attachScriptToMessage(mid, normalized, sid);

        console.info(`[IGS-Patch] 第 ${mid} 楼 (分支 ${sid}) 演出制作完成并已存入存储。`);

        updateProductionStatus({
            isProducing: false,
            floor: mid,
            swipeId: sid,
            progress: '制作完成',
            error: null,
            lastSuccessAt: Date.now(),
        });

        notifyToast(`第 ${mid} 楼制作就绪`, 'success', 2200);

        // 驱动刷新
        refreshIgsStage(mid);

        return normalized;
    } catch (err) {
        console.error(`[IGS-Patch] 第 ${mid} 楼 (分支 ${sid}) 转译失败:`, err);
        updateProductionStatus({
            isProducing: false,
            floor: mid,
            swipeId: sid,
            progress: '制作失败',
            error: err.message || String(err),
        });
        notifyToast(`第 ${mid} 楼制作失败: ${err.message}`, 'error', 3000);
        throw err;
    }
}

/**
 * 响应分支切换 (MESSAGE_SWIPED)
 */
export function handleMessageSwiped(messageId) {
    const mid = Number(messageId);
    if (isNaN(mid)) return;

    for (const w of getCandidateWindows()) {
        try {
            const chat = w.SillyTavern?.getContext?.()?.chat;
            if (Array.isArray(chat) && chat[mid]) {
                const msg = chat[mid];
                const sid = Number(msg.swipe_id) || 0;
                const memKey = `${mid}_${sid}`;
                const script = scriptMemoryStore.get(memKey) || msg.extra?.igs_patch_scripts?.[sid];

                if (script) {
                    msg.text = script;
                    msg.visibleText = script;
                    msg.displayText = script;
                    msg.plainText = script;
                    msg.formattedText = script;
                    msg.rawHtml = script;
                    console.info(`[IGS-Patch] 第 ${mid} 楼切换至分支 ${sid}，已同步应用该分支剧本`);
                } else {
                    delete msg.text;
                    delete msg.visibleText;
                    delete msg.displayText;
                    delete msg.plainText;
                    delete msg.formattedText;
                    delete msg.rawHtml;
                    console.info(`[IGS-Patch] 第 ${mid} 楼切换至分支 ${sid}，该分支尚未制作演出`);
                }
                refreshIgsStage(mid);
            }
        } catch (_) { }
    }
}

/**
 * 响应楼层删除 (MESSAGE_DELETED)
 */
export async function handleMessageDeleted(messageId) {
    const mid = Number(messageId);
    if (isNaN(mid)) return;

    // 清空内存缓存
    for (const key of scriptMemoryStore.keys()) {
        if (key.startsWith(`${mid}_`)) {
            scriptMemoryStore.delete(key);
        }
    }

    // 清空持久化存储
    try {
        const keys = await listStoredKeys();
        if (Array.isArray(keys)) {
            for (const k of keys) {
                if (k.startsWith(`script_${mid}_`)) {
                    await deleteStoredJson(k);
                }
            }
        }
    } catch (_) { }

    console.info(`[IGS-Patch] 已彻底清理第 ${mid} 楼的全部演出剧本缓存`);
}

/**
 * 驱动 IGS 视窗或阅读器刷新渲染
 */
export function refreshIgsStage(messageId) {
    for (const w of getCandidateWindows()) {
        try {
            const igs = w.IGS || w.ImmersiveGalgameSystem;
            if (!igs) continue;

            if (typeof igs.refresh === 'function') {
                igs.refresh({ messageId });
            }
            if (typeof igs.renderScene === 'function') {
                igs.renderScene();
            }
        } catch (err) {
            console.warn('[IGS-Patch] 刷新 IGS 舞台异常:', err);
        }
    }
}

/**
 * 自动处理最新 assistant 消息
 */
export async function processLatestAssistantMessage() {
    const hit = await findLastMessage({ role: 'assistant', scanLimit: 50 });
    if (!hit || !hit.message) return null;

    const mid = hit.index;
    const sid = Number(hit.message.swipe_id) || 0;
    const rawText = hit.message.mes || hit.message.text || '';

    return convertMessageToGal(mid, rawText, { swipeId: sid });
}
