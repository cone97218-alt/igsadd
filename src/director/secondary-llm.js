/**
 * 副 API 客户端服务
 * 深度复用 IGS 主脚本在设置面板中配置的副 LLM 设定（支持独立 OpenAI 兼容接口与酒馆 generateRaw）
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
 * 获取 IGS 当前配置的副 LLM 设置
 */
export function getIgsSecondaryLlmConfig() {
    try {
        for (const w of getCandidateWindows()) {
            const igs = w.IGS || w.ImmersiveGalgameSystem;
            const unified = igs?.getUnifiedSettings?.();
            const config = unified?.bridge?.autoIllustration?.llm;
            if (config) return config;
        }
    } catch (err) {
        console.warn('[IGS-Patch] 读取 IGS 副 LLM 配置失败:', err);
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
                if (text) return text;
            } catch (err) {
                console.warn('[IGS-Patch] 通过 IGS.requestSecondaryText 请求失败，尝试独立调用:', err);
            }
        }
    }

    // 2. 检查配置类型：若是独立 OpenAI 兼容接口（如 DeepSeek、OpenAI、Gemini等）
    if (config && config.source === 'openai' && config.endpoint) {
        return requestOpenAiCompat(messages, config, timeoutMs);
    }

    // 3. 若配置为通过酒馆生成（tavern），调用 TavernHelper.generateRaw
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
async function requestOpenAiCompat(messages, config, timeoutMs) {
    let endpoint = String(config.endpoint || '').trim().replace(/\/+$/, '');
    if (!endpoint.endsWith('/chat/completions')) {
        endpoint = /\/v\d+$/i.test(endpoint) ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey.trim()}` } : {}),
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
                should_silence: true, // 静默生成：不广播事件、不显示停止按钮
                ordered_prompts: list,
            });
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

    throw new Error('未检测到可用的副 API 方式（既无独立 OpenAI 配置，也无法调用 generateRaw）');
}

function extractContent(raw) {
    if (typeof raw === 'string') return raw;
    if (raw?.content) return raw.content;
    if (raw?.choices?.[0]?.message?.content) return raw.choices[0].message.content;
    return null;
}
