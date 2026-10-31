/**
 * 副 API 客户端服务
 * 深度复用并严格对齐 IGS 主脚本在设置面板中配置的副 LLM 设定（支持独立 OpenAI 兼容接口与酒馆 generateRaw）
 */

const DEFAULT_TIMEOUT_MS = 60000;

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
 * 规范化 LLM 配置对象
 */
export function normalizeLlmConfig(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const endpoint = String(raw.endpoint || raw.url || raw.apiUrl || raw.baseUrl || raw.host || '').trim();
    const apiKey = String(raw.apiKey || raw.key || raw.token || raw.api_key || '').trim();
    const model = String(raw.model || raw.modelName || raw.model_name || 'gpt-4o-mini').trim();
    const source = String(raw.source || (endpoint ? 'openai' : 'tavern')).toLowerCase();

    return {
        source,
        endpoint,
        apiKey,
        model,
        customHeaders: raw.customHeaders || {},
        customBody: raw.customBody || {},
    };
}

/**
 * 获取主脚本配置的副 LLM 设置 (IGS 原生实例 > localStorage bridge 配置)
 */
export function getIgsSecondaryLlmConfig() {
    // 1. 深度穿透探测 IGS 主脚本原生运行时内存对象
    try {
        for (const w of getCandidateWindows()) {
            const igs = w.IGS || w.ImmersiveGalgameSystem;
            if (!igs) continue;

            const candidates = [
                igs.getUnifiedSettings?.()?.bridge?.autoIllustration?.llm,
                igs.getUnifiedSettings?.()?.bridge?.llm,
                igs.getUnifiedSettings?.()?.bridge?.secondaryLlm,
                igs.getUnifiedSettings?.()?.autoIllustration?.llm,
                igs.getUnifiedSettings?.()?.llm,
                igs.getConfig?.()?.autoIllustration?.llm,
                igs.getConfig?.()?.bridge?.autoIllustration?.llm,
                igs.getConfig?.()?.llm,
                igs.getState?.()?.config?.bridge?.autoIllustration?.llm,
                igs.getState?.()?.legacyIgs?.bridge?.autoIllustration?.llm,
                igs.bridge?.autoIllustration?.llm,
                igs.bridge?.llm,
                igs.settings?.autoIllustration?.llm,
            ];

            for (const c of candidates) {
                if (c && (c.endpoint || c.url || c.apiUrl || c.baseUrl || c.source)) {
                    return normalizeLlmConfig(c);
                }
            }
        }
    } catch (err) {
        console.warn('[IGS-Patch] 读取 IGS 内存配置异常:', err);
    }

    // 2. 深度穿透探测主脚本持久化存储 localStorage
    const storageKeys = [
        'igs_bridge_config',
        'igs_settings',
        'immersive_galgame_system',
        'IGS_SETTINGS',
    ];

    for (const key of storageKeys) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') continue;

            const candidates = [
                parsed.autoIllustration?.llm,
                parsed.bridge?.autoIllustration?.llm,
                parsed.bridge?.llm,
                parsed.bridge?.secondaryLlm,
                parsed.llm,
                parsed.secondaryLlm,
            ];

            for (const c of candidates) {
                if (c && (c.endpoint || c.url || c.apiUrl || c.baseUrl || c.source)) {
                    return normalizeLlmConfig(c);
                }
            }
        } catch (_) { }
    }

    return null;
}

function normalizePromptMessages(promptData) {
    if (Array.isArray(promptData)) return promptData;
    if (promptData && Array.isArray(promptData.messages)) return promptData.messages;
    if (promptData && (promptData.system || promptData.user)) {
        const list = [];
        if (promptData.system) list.push({ role: 'system', content: promptData.system });
        if (promptData.user) list.push({ role: 'user', content: promptData.user });
        return list;
    }
    return [{ role: 'user', content: String(promptData || '') }];
}

/**
 * 调度副 API 发起文本转换请求
 * @param {Object|Array} promptData { system, user } 或 Array<{ role, content }>
 * @param {Object} overrideOptions
 */
export async function requestSecondaryLlm(promptData, overrideOptions = {}) {
    const config = getIgsSecondaryLlmConfig();
    const timeoutMs = overrideOptions.timeoutMs || DEFAULT_TIMEOUT_MS;
    const messages = normalizePromptMessages(promptData);

    console.info('[IGS-Patch] 使用主脚本副 API 配置发起转译请求:', {
        source: config?.source,
        endpoint: config?.endpoint,
        model: config?.model,
    });

    // 1. 如果 IGS 内部已暴露现成的 requestSecondaryText，优先直调
    for (const w of getCandidateWindows()) {
        const igs = w.IGS || w.ImmersiveGalgameSystem;
        if (typeof igs?.requestSecondaryText === 'function') {
            try {
                const sysContent = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
                const userContent = messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n');
                const result = await igs.requestSecondaryText({
                    system: sysContent,
                    user: userContent,
                    messages,
                }, config || {});
                const text = extractContent(result);
                if (text && text.trim()) return text.trim();
            } catch (err) {
                console.warn('[IGS-Patch] 通过 IGS.requestSecondaryText 请求失败，尝试独立调用:', err);
            }
        }
    }

    // 2. 检查配置类型：若是独立 OpenAI 兼容接口或具备有效 endpoint
    if (config && (config.source === 'openai' || config.endpoint)) {
        return requestOpenAiCompat(messages, config, timeoutMs);
    }

    // 3. 若配置为通过酒馆生成（tavern），调用酒馆原生接口
    return requestTavernRaw(messages, timeoutMs);
}

/**
 * 测试副 API 连通性
 */
export async function testSecondaryLlmConnection() {
    const startTime = Date.now();
    try {
        const testPayload = [
            { role: 'system', content: 'You are a test assistant. Reply with "pong" only.' },
            { role: 'user', content: 'ping' },
        ];
        const reply = await requestSecondaryLlm(testPayload, { timeoutMs: 15000 });
        const latency = Date.now() - startTime;
        return {
            ok: true,
            latency,
            reply: String(reply).slice(0, 100),
        };
    } catch (err) {
        return {
            ok: false,
            latency: Date.now() - startTime,
            error: err.message || String(err),
        };
    }
}

/**
 * 请求 OpenAI 兼容协议接口
 */
export async function requestOpenAiCompat(messages, config, timeoutMs) {
    let endpoint = String(config.endpoint || '').trim().replace(/\/+$/, '');
    if (!endpoint) {
        throw new Error('未读取到主脚本配置的副 API 请求地址 (endpoint)');
    }

    if (!endpoint.endsWith('/chat/completions')) {
        if (/\/v\d+$/i.test(endpoint)) {
            endpoint = `${endpoint}/chat/completions`;
        } else if (/\/v\d+\/$/i.test(endpoint)) {
            endpoint = `${endpoint}chat/completions`;
        } else {
            endpoint = `${endpoint}/v1/chat/completions`;
        }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const authHeader = config.apiKey ? (
        config.apiKey.startsWith('Bearer ') ? config.apiKey : `Bearer ${config.apiKey.trim()}`
    ) : null;

    const headers = {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
        ...(config.customHeaders || {}),
    };

    const payload = {
        model: config.model || 'gpt-4o-mini',
        messages: Array.isArray(messages) ? messages : [
            { role: 'system', content: messages.system },
            { role: 'user', content: messages.user },
        ],
        temperature: 0.3,
        stream: false,
        ...(config.customBody || {}),
    };

    console.info(`[IGS-Patch] 正在发起 fetch 请求到副 API: ${endpoint}`, { model: payload.model });

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`副 API HTTP 错误 ${response.status}: ${errText.slice(0, 200)}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('副 API 未返回有效的 choices[0].message.content');
        }
        return content.trim();
    } catch (err) {
        console.error('[IGS-Patch] fetch 副 API 失败:', err);
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 通过酒馆原生后端进行静默生成
 */
async function requestTavernRaw(messages, timeoutMs) {
    const list = Array.isArray(messages) ? messages : [
        { role: 'system', content: messages.system },
        { role: 'user', content: messages.user },
    ];

    for (const w of getCandidateWindows()) {
        const helper = w.TavernHelper;
        if (helper && typeof helper.generateRaw === 'function') {
            const result = await helper.generateRaw({
                should_stream: false,
                should_silence: true,
                ordered_prompts: list,
            });
            return String(result || '').trim();
        }

        if (typeof w.generateRaw === 'function') {
            const sys = list.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
            const user = list.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n');
            const result = await w.generateRaw(user, sys, false, false);
            return String(result || '').trim();
        }

        const ctx = w.SillyTavern?.getContext?.();
        if (ctx && typeof ctx.generateRaw === 'function') {
            const sys = list.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
            const user = list.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n');
            const result = await ctx.generateRaw({
                systemPrompt: sys,
                prompt: user,
            });
            return String(result || '').trim();
        }
    }

    throw new Error('未检测到可用的副 API 方式（请在主脚本设置中配置副 LLM）');
}

function extractContent(raw) {
    if (typeof raw === 'string') return raw;
    if (raw?.content) return raw.content;
    if (raw?.choices?.[0]?.message?.content) return raw.choices[0].message.content;
    return null;
}
