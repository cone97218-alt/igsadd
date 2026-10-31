/**
 * 提示词阻断与捕获拦截器 (Prompt Interceptor & Blocker)
 * 
 * 核心机制：
 * 1. 深度劫持 SillyTavern.getContext 本身，确保每次任何模块调用 getContext() 均返回包裹层。
 * 2. 劫持 setExtensionPrompt，100% 截获主脚本下发的标签规则，存入共享状态并向主模型置空。
 * 3. 挂载 extensionPrompts 的 Proxy 代理：对 IGS 的 verifyContextPrompt 返回规则通过校验；
 *    对酒馆底层 prompt 收集器（Object.keys, Object.entries, for..in）彻底隐藏这些规则。
 * 4. 主动触发 IGS 规则同步，保证即使在冷启动未对话时也能即时捕获当前角色的原版规则。
 */

import { saveInterceptedRule, patchState } from '../state/state.js';

const BLOCKED_KEY_PREFIX = 'igs-scene-assets-';
const BLOCKED_EXACT_KEYS = new Set([
    'igs-scene-assets-format-rule',
    'igs-scene-assets-depth0',
    'igs-stats-state',
]);

// 内存中保留的虚假记录映射，专门用来应付 IGS 的 verifyContextPrompt 校验
const shadowPromptRecords = new Map();

export function shouldInterceptKey(key) {
    if (!key) return false;
    const str = String(key);
    return BLOCKED_EXACT_KEYS.has(str) || str.startsWith(BLOCKED_KEY_PREFIX) || str.startsWith('igs-');
}

function getCandidateWindows() {
    const list = [window];
    try {
        if (window.parent && window.parent !== window && !list.includes(window.parent)) {
            list.push(window.parent);
        }
    } catch (_) { }
    try {
        if (window.top && window.top !== window && !list.includes(window.top)) {
            list.push(window.top);
        }
    } catch (_) { }

    // 全面穿透所有层级的 iframe
    try {
        const rootDoc = (window.top || window.parent || window).document;
        if (rootDoc) {
            const iframes = rootDoc.querySelectorAll('iframe');
            for (const f of iframes) {
                try {
                    const fw = f.contentWindow;
                    if (fw && !list.includes(fw)) list.push(fw);
                } catch (_) { }
            }
        }
    } catch (_) { }

    return list;
}

let hasLoggedContextHook = false;

/**
 * 启动提示词拦截
 */
export function setupPromptBlocker() {
    hookAllCandidateWindows();

    // 初始快速检测保底
    setTimeout(hookAllCandidateWindows, 1000);
    setTimeout(hookAllCandidateWindows, 3000);

    // 低频静默守护进程（降低 CPU 消耗，杜绝高频空转）
    setInterval(hookAllCandidateWindows, 15000);

    console.info('[IGS-Patch] 提示词拦截器已启动：主模型系统提示词保持纯净，IGS规则已转存副模型。');
}

/**
 * 遍历并劫持所有候选窗口环境
 */
function hookAllCandidateWindows() {
    const wins = getCandidateWindows();
    for (const win of wins) {
        hookSillyTavernGetContext(win);
        hookTavernHelper(win);
        scanAndAdoptExistingPrompts(win);
    }
}

/**
 * 劫持 win.SillyTavern.getContext 本身
 */
function hookSillyTavernGetContext(win) {
    try {
        if (!win.SillyTavern || typeof win.SillyTavern.getContext !== 'function') return;

        // 如果尚未劫持 getContext 函数本身
        if (!win.SillyTavern.getContext.__isIgsPatchHooked) {
            const originalGetContext = win.SillyTavern.getContext.bind(win.SillyTavern);

            const hookedGetContext = function (...args) {
                const ctx = originalGetContext(...args);
                if (ctx) {
                    wrapContextInstance(ctx, win);
                }
                return ctx;
            };

            hookedGetContext.__isIgsPatchHooked = true;
            win.SillyTavern.getContext = hookedGetContext;
            if (!hasLoggedContextHook) {
                hasLoggedContextHook = true;
                console.info('[IGS-Patch] 成功劫持 SillyTavern.getContext 函数');
            }
        }

        // 同时对当前已有的上下文立即包裹一次
        const currentCtx = win.SillyTavern.getContext();
        if (currentCtx) {
            wrapContextInstance(currentCtx, win);
        }
    } catch (err) {
        // 静默
    }
}

/**
 * 为具体的 context 实例挂载劫持与代理
 */
function wrapContextInstance(ctx, win) {
    if (!ctx) return;

    // 1. 劫持 ctx.setExtensionPrompt
    if (typeof ctx.setExtensionPrompt === 'function' && !ctx.setExtensionPrompt.__isIgsPatchHooked) {
        const originalSet = ctx.setExtensionPrompt.bind(ctx);

        const hookedSet = function (key, content, position, depth, scan, role) {
            if (shouldInterceptKey(key)) {
                // (1) 截获并存入补丁状态
                saveInterceptedRule(key, content, { position, depth, scan, role });

                // (2) 存入虚假记录表，准备给 IGS 校验函数核验
                shadowPromptRecords.set(key, {
                    value: String(content || ''),
                    position: Number(position) || 0,
                    depth: Math.max(0, Number(depth) || 0),
                    scan: Boolean(scan),
                    role: Number(role) || 0,
                });

                // (3) 将酒馆真实的提示词置空，彻底阻止发送给主模型
                originalSet(key, '', position, depth, scan, role);
                return;
            }
            return originalSet(key, content, position, depth, scan, role);
        };

        hookedSet.__isIgsPatchHooked = true;
        ctx.setExtensionPrompt = hookedSet;
    }

    // 2. 劫持 ctx.extensionPrompts 对象（使用 Proxy 欺骗 IGS 校验同时向酒馆主模型隐藏）
    if (ctx.extensionPrompts && !ctx.extensionPrompts.__isIgsPatchProxy) {
        const rawTarget = ctx.extensionPrompts;

        ctx.extensionPrompts = new Proxy(rawTarget, {
            get(target, prop, receiver) {
                if (prop === '__isIgsPatchProxy') return true;
                if (prop === '__rawTarget') return target;

                // 当 IGS 调用 verifyContextPrompt / getPromptRecord 读取被拦截 key 时：
                if (typeof prop === 'string' && shouldInterceptKey(prop)) {
                    if (shadowPromptRecords.has(prop)) {
                        return shadowPromptRecords.get(prop);
                    }
                }
                return Reflect.get(target, prop, receiver);
            },

            // 当酒馆使用 Object.keys, Object.entries, for..in 收集提示词送往主模型时：彻底滤除！
            ownKeys(target) {
                const keys = Reflect.ownKeys(target);
                return keys.filter((k) => typeof k !== 'string' || !shouldInterceptKey(k));
            },

            getOwnPropertyDescriptor(target, prop) {
                if (typeof prop === 'string' && shouldInterceptKey(prop)) {
                    return undefined; // 隐藏描述符，让 Object.entries 自动跳过
                }
                return Reflect.getOwnPropertyDescriptor(target, prop);
            },

            has(target, prop) {
                if (typeof prop === 'string' && shouldInterceptKey(prop)) {
                    return false;
                }
                return Reflect.has(target, prop);
            },

            deleteProperty(target, prop) {
                if (typeof prop === 'string' && shouldInterceptKey(prop)) {
                    shadowPromptRecords.delete(prop);
                }
                return Reflect.deleteProperty(target, prop);
            },
        });
    }

    // 3. 挂载 eventSource 监听，清洗即将发出的 payload
    hookEventSource(ctx);
}

/**
 * 扫描并领养已存在的残留提示词（应对补丁后加载的情况）
 */
function scanAndAdoptExistingPrompts(win) {
    try {
        const ctx = win.SillyTavern?.getContext?.();
        if (!ctx || !ctx.extensionPrompts) return;

        // 获取底层原始目标，彻底突破 Proxy ownKeys 的自遮蔽
        const raw = ctx.extensionPrompts.__rawTarget || ctx.extensionPrompts;
        const keys = new Set([
            ...Reflect.ownKeys(raw),
            'igs-scene-assets-format-rule',
            'igs-scene-assets-depth0',
            'igs-stats-state',
        ]);
        for (let i = 0; i < 30; i++) keys.add(`igs-scene-assets-entry-${i}`);

        for (const k of keys) {
            if (typeof k === 'string' && shouldInterceptKey(k)) {
                const record = raw[k] || shadowPromptRecords.get(k);
                if (record && record.value && String(record.value).trim()) {
                    saveInterceptedRule(k, record.value, record);
                    shadowPromptRecords.set(k, { ...record });
                    // 置空真实存储，从酒馆主模型提示词中彻底剥离
                    try {
                        delete raw[k];
                    } catch (_) {
                        record.value = '';
                    }
                }
            }
        }
    } catch (_) { }
}

/**
 * 劫持 TavernHelper.injectPrompts 回退路径
 */
function hookTavernHelper(win) {
    try {
        const helper = win.TavernHelper;
        if (helper && typeof helper.injectPrompts === 'function' && !helper.injectPrompts.__isIgsPatchHooked) {
            const originalInject = helper.injectPrompts.bind(helper);

            const hookedInject = function (prompts, ...args) {
                if (Array.isArray(prompts)) {
                    for (const p of prompts) {
                        if (p && shouldInterceptKey(p.id)) {
                            saveInterceptedRule(p.id, p.content, p);
                            shadowPromptRecords.set(p.id, {
                                value: p.content,
                                position: 0,
                                depth: 0,
                                scan: false,
                                role: 0,
                            });
                        }
                    }
                    const filtered = prompts.filter((p) => !shouldInterceptKey(p?.id));
                    return originalInject(filtered, ...args);
                }
                return originalInject(prompts, ...args);
            };

            hookedInject.__isIgsPatchHooked = true;
            helper.injectPrompts = hookedInject;
        }
    } catch (_) { }
}

/**
 * 监听酒馆底层事件，双重清洗即将送出给 LLM 的 payload
 */
function hookEventSource(ctx) {
    try {
        const eventSource = ctx.eventSource;
        const eventTypes = ctx.event_types || ctx.eventTypes || {};
        if (!eventSource || typeof eventSource.on !== 'function') return;
        if (eventSource.__igsPromptFilterAttached) return;
        eventSource.__igsPromptFilterAttached = true;

        const scrubMessages = (data) => {
            if (!data) return;
            const messages = data.messages || data.prompt;
            if (Array.isArray(messages)) {
                for (let i = messages.length - 1; i >= 0; i--) {
                    const msg = messages[i];
                    const content = typeof msg === 'string' ? msg : msg?.content;
                    if (typeof content === 'string') {
                        if (content.includes('[igs标签语法]') || content.includes('【场景与台词】') || content.includes('igs-scene-assets')) {
                            if (content.length < 5000 && (content.startsWith('[igs标签语法]') || content.startsWith('【场景与台词】') || content.startsWith('igs-scene-assets'))) {
                                messages.splice(i, 1);
                            } else {
                                const cleaned = content
                                    .replace(/\[igs标签语法\][\s\S]*?(?=\n\n[^\n]|\[|$)/gi, '')
                                    .replace(/【场景与台词】[\s\S]*?(?=\n\n[^\n]|\[|$)/gi, '');
                                if (typeof msg === 'string') {
                                    messages[i] = cleaned.trim();
                                } else if (msg) {
                                    msg.content = cleaned.trim();
                                }
                            }
                        }
                    }
                }
            }
        };

        if (eventTypes.CHAT_COMPLETION_PROMPT_READY) {
            eventSource.on(eventTypes.CHAT_COMPLETION_PROMPT_READY, scrubMessages);
        }
        if (eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS) {
            eventSource.on(eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS, scrubMessages);
        }
    } catch (_) { }
}

/**
 * 主动触发 IGS 重新计算并下发场景资产规则
 */
export function triggerIgsPromptResync() {
    for (const win of getCandidateWindows()) {
        try {
            // 方式 1: 若 IGS 全局对象有暴露内部 refresh 或 sync，则直接触发
            const igs = win.IGS || win.ImmersiveGalgameSystem;
            if (igs && typeof igs.refresh === 'function') {
                igs.refresh();
            }

            // 方式 2: 重新扫描领养已有规则
            scanAndAdoptExistingPrompts(win);
        } catch (_) { }
    }
}
