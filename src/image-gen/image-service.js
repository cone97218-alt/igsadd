/**
 * IGS 生图服务与多后端调度引擎 (Image Service)
 * 
 * 核心功能：
 * 1. 多引擎统一调度：支持 柏宝绘 (ST-BaiBai-Image)、自定义通用绘图 API (OpenAI/SiliconFlow/SDXL/FLUX)、NovelAI API、酒馆扩展。
 * 2. 状态实时侦测与诊断：自动检测各生图后端的就绪状态，精准定位报错原因。
 * 3. 跨源凭据同步：自动与原生 IGS autoIllustration.nai 配置实现双向同步。
 * 4. 详细错误追踪：提供真实网络状态码与服务端错误信息，杜绝无声失败。
 */

import { notifyToast } from '../ui/toast.js';
import { getRawBridgeConfig, saveRawBridgeConfig } from '../resources/asset-service.js';

const STORAGE_KEY_IMAGE_CONFIG = 'igs:patch:image_config_v1';

export const DEFAULT_IMAGE_CONFIG = Object.freeze({
    provider: 'auto', // 'auto' | 'custom' | 'baibai' | 'nai'
    // 自定义生图 API (标准 OpenAI / SiliconFlow 格式: POST /v1/images/generations)
    customApi: {
        enabled: true,
        endpoint: 'https://api.siliconflow.cn/v1/images/generations',
        apiKey: '',
        model: 'black-forest-labs/FLUX.1-schnell',
        size: '1024x1024',
    },
    // NovelAI 原生接口
    nai: {
        enabled: false,
        apiKey: '',
        endpoint: 'https://image.novelai.net',
        model: 'nai-diffusion-4-curated-preview',
    },
});

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
 * 读取当前生图配置
 */
export function getImageConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_IMAGE_CONFIG);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                ...DEFAULT_IMAGE_CONFIG,
                ...parsed,
                customApi: { ...DEFAULT_IMAGE_CONFIG.customApi, ...(parsed.customApi || {}) },
                nai: { ...DEFAULT_IMAGE_CONFIG.nai, ...(parsed.nai || {}) },
            };
        }
    } catch (_) { }

    // 回退尝试从 IGS bridge 读取 NAI Key
    const cfg = { ...DEFAULT_IMAGE_CONFIG };
    try {
        const bridge = getRawBridgeConfig();
        const naiKey = bridge?.autoIllustration?.nai?.apiKey || bridge?.imageApi?.apiKey;
        if (naiKey) {
            cfg.nai.apiKey = naiKey;
            cfg.nai.enabled = true;
        }
    } catch (_) { }

    return cfg;
}

/**
 * 持久化保存生图配置
 */
export function saveImageConfig(newConfig) {
    try {
        localStorage.setItem(STORAGE_KEY_IMAGE_CONFIG, JSON.stringify(newConfig));

        // 如果配置了 NAI Key，深度同步至 IGS 原生 bridge 配置中
        if (newConfig?.nai?.apiKey) {
            const bridge = getRawBridgeConfig();
            if (bridge) {
                bridge.autoIllustration = bridge.autoIllustration || {};
                bridge.autoIllustration.nai = bridge.autoIllustration.nai || {};
                bridge.autoIllustration.nai.apiKey = newConfig.nai.apiKey;
                if (newConfig.nai.endpoint) bridge.autoIllustration.nai.endpoint = newConfig.nai.endpoint;
                if (newConfig.nai.model) bridge.autoIllustration.nai.model = newConfig.nai.model;

                bridge.imageApi = bridge.imageApi || {};
                bridge.imageApi.apiKey = newConfig.nai.apiKey;
                if (newConfig.nai.endpoint) bridge.imageApi.endpoint = newConfig.nai.endpoint;
                if (newConfig.nai.model) bridge.imageApi.model = newConfig.nai.model;

                saveRawBridgeConfig(bridge);
            }
        }
        return true;
    } catch (err) {
        console.warn('[IGS-Patch] 保存生图配置失败:', err);
        return false;
    }
}

/**
 * 侦测所有生图后端的运行与配置状态
 */
export function detectImageBackends() {
    const status = {
        baibai: { detected: false, configured: false, label: '柏宝绘 (ST-BaiBai-Image)', detail: '未检测到插件' },
        customApi: { detected: false, configured: false, label: '通用/OpenAI 兼容绘图 API', detail: '未配置 API Key' },
        nai: { detected: false, configured: false, label: 'NovelAI 原生接口', detail: '未配置 API Key' },
        extension: { detected: false, configured: false, label: '酒馆原生/智绘姬扩展', detail: '未检测到出图接口' },
    };

    // 1. 柏宝绘侦测
    for (const w of getCandidateWindows()) {
        try {
            const api = w.STBaiBaiImage;
            if (api && typeof api.generate === 'function') {
                status.baibai.detected = true;
                const backendStatus = typeof api.getBackendStatus === 'function' ? api.getBackendStatus() : null;
                if (backendStatus && backendStatus.configured === false) {
                    status.baibai.configured = false;
                    status.baibai.detail = backendStatus.reason || '柏宝绘未配置出图渠道';
                } else {
                    status.baibai.configured = true;
                    status.baibai.detail = '已就绪 (可直接出图)';
                }
                break;
            }
        } catch (_) { }
    }

    // 2. 自定义通用 API 侦测
    const config = getImageConfig();
    if (config?.customApi?.apiKey && config?.customApi?.endpoint) {
        status.customApi.detected = true;
        status.customApi.configured = true;
        status.customApi.detail = `已配置 (${config.customApi.model || '默认模型'})`;
    }

    // 3. NovelAI 侦测
    const bridge = getRawBridgeConfig();
    const naiKey = config?.nai?.apiKey || bridge?.autoIllustration?.nai?.apiKey || bridge?.imageApi?.apiKey;
    if (naiKey && naiKey.trim()) {
        status.nai.detected = true;
        status.nai.configured = true;
        status.nai.detail = '已配置 API Key';
    }

    // 4. 酒馆扩展侦测
    for (const w of getCandidateWindows()) {
        try {
            if (typeof w.generateImage === 'function' || typeof w.SillyTavern?.getContext?.()?.generateImage === 'function') {
                status.extension.detected = true;
                status.extension.configured = true;
                status.extension.detail = '已就绪 (调用酒馆画图插件)';
                break;
            }
        } catch (_) { }
    }

    return status;
}

/**
 * 测试自定义 API 连接
 */
export async function testCustomApiConnection(customApiConfig) {
    if (!customApiConfig || !customApiConfig.endpoint || !customApiConfig.apiKey) {
        return { ok: false, message: '请先填写接口地址与 API Key' };
    }

    try {
        let url = customApiConfig.endpoint.trim();
        // 自动补全 /v1/images/generations
        if (!url.includes('/images/generations') && !url.endsWith('/')) {
            url = `${url}/images/generations`;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customApiConfig.apiKey.trim()}`,
            },
            body: JSON.stringify({
                model: customApiConfig.model || 'black-forest-labs/FLUX.1-schnell',
                prompt: '1girl, anime, cute smile, masterpiece',
                n: 1,
                size: '512x512',
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            let parsedReason = '';
            try {
                const j = JSON.parse(errText);
                parsedReason = j?.error?.message || j?.message || '';
            } catch (_) { }
            return {
                ok: false,
                message: `服务器返回 HTTP ${res.status}: ${parsedReason || errText.slice(0, 150)}`,
            };
        }

        const json = await res.json();
        const b64 = json?.data?.[0]?.b64_json;
        const imgUrl = json?.data?.[0]?.url;

        if (b64 || imgUrl) {
            return { ok: true, message: '连接与生图测试成功！' };
        }

        return { ok: false, message: '接口返回数据中未包含有效的图片内容 (data[0].b64_json 或 url 为空)' };
    } catch (err) {
        return { ok: false, message: `网络请求失败: ${err.message}` };
    }
}

/**
 * 调度执行图像生成
 * @param {Object} options
 * @param {string} options.prompt 提示词
 * @param {string} [options.negative] 负面提示词
 * @param {string} [options.type] 类别 ('sprite' | 'mood' | 'cg' | 'item' | 'scene')
 * @param {string} [options.charName] 角色名
 * @param {string} [options.size] 'portrait' | 'landscape' | 'square'
 */
export async function executeImageGeneration(options = {}) {
    const prompt = String(options.prompt || '').trim();
    const negative = String(options.negative || '').trim();
    const type = options.type || 'sprite';
    const charName = options.charName || '';
    const size = options.size || (type === 'cg' || type === 'scene' ? 'landscape' : (type === 'item' ? 'square' : 'portrait'));

    if (!prompt) {
        throw new Error('生图提示词不能为空');
    }

    const config = getImageConfig();
    const backends = detectImageBackends();

    // 策略 1: 如果配置并启用了自定义通用 API，且处于 auto 或 custom 模式
    if ((config.provider === 'custom' || config.provider === 'auto') && backends.customApi.configured) {
        try {
            console.info('[IGS-Patch] 正在通过自定义通用生图 API 生成图片...');
            let url = config.customApi.endpoint.trim();
            if (!url.includes('/images/generations') && !url.endsWith('/')) {
                url = `${url}/images/generations`;
            }

            // 根据画幅换算像素尺寸 (FLUX/SDXL 推荐 1024 级尺寸)
            let pixelSize = '1024x1024';
            if (size === 'landscape') pixelSize = '1024x768';
            else if (size === 'portrait') pixelSize = '768x1024';

            const payload = {
                model: config.customApi.model || 'black-forest-labs/FLUX.1-schnell',
                prompt: prompt,
                n: 1,
                size: pixelSize,
            };
            if (negative) {
                payload.negative_prompt = negative;
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.customApi.apiKey.trim()}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errText = await res.text();
                let detail = '';
                try {
                    const j = JSON.parse(errText);
                    detail = j?.error?.message || j?.message || '';
                } catch (_) { }
                throw new Error(`通用生图 API 错误 (HTTP ${res.status}): ${detail || errText.slice(0, 160)}`);
            }

            const data = await res.json();
            const b64 = data?.data?.[0]?.b64_json;
            if (b64) return `data:image/png;base64,${b64}`;
            const imgUrl = data?.data?.[0]?.url;
            if (imgUrl) return imgUrl;

            throw new Error('生图 API 未返回图片数据 (b64_json 与 url 均为空)');
        } catch (err) {
            console.warn('[IGS-Patch] 自定义生图 API 执行失败:', err);
            // 如果明确指定为 custom 模式，直接向上抛出详细错误
            if (config.provider === 'custom') throw err;
            // 否则在 auto 模式下继续尝试其他可用渠道
        }
    }

    // 策略 2: 柏宝绘 (STBaiBaiImage)
    if ((config.provider === 'baibai' || config.provider === 'auto') && backends.baibai.detected) {
        for (const w of getCandidateWindows()) {
            try {
                const api = w.STBaiBaiImage;
                if (api && typeof api.generate === 'function') {
                    const status = typeof api.getBackendStatus === 'function' ? api.getBackendStatus() : null;
                    if (status && status.configured === false) {
                        throw new Error(`柏宝绘未就绪：${status.reason || '请在酒馆拓展菜单「柏宝绘」中配置出图渠道'}`);
                    }

                    console.info('[IGS-Patch] 正在通过柏宝绘 (STBaiBaiImage) 生成图片...');
                    const reqOptions = {
                        prompt,
                        ...(negative ? { negative } : {}),
                        size: size === 'landscape' ? 'landscape' : 'portrait',
                        save: false,
                    };
                    if (charName) reqOptions.character = charName;

                    const result = await api.generate(reqOptions);
                    const dataUrl = result && (result.dataUrl || result.url);
                    if (dataUrl) return dataUrl;
                    if (result && result.error) throw new Error(result.error);
                }
            } catch (err) {
                console.warn('[IGS-Patch] 柏宝绘出图异常:', err);
                if (config.provider === 'baibai') throw err;
            }
        }
    }

    // 策略 3: 原生 IGS generateImage 接口
    for (const w of getCandidateWindows()) {
        try {
            const igs = w.IGS || w.ImmersiveGalgameSystem;
            if (igs && typeof igs.generateImage === 'function') {
                console.info('[IGS-Patch] 正在尝试调用 IGS 原生生图服务...');
                const res = await igs.generateImage({
                    prompt,
                    negative,
                    type,
                    character: charName,
                });
                if (res && res.ok !== false) {
                    const dataUrl = res.dataUrl || res.url || res;
                    if (typeof dataUrl === 'string' && dataUrl) return dataUrl;
                } else if (res && res.reason && res.reason !== 'provider-not-enabled') {
                    throw new Error(`IGS 生图错误: ${res.reason}`);
                }
            }
        } catch (err) {
            console.warn('[IGS-Patch] IGS 原生生图服务调用失败:', err);
        }
    }

    // 策略 4: 酒馆原生扩展
    for (const w of getCandidateWindows()) {
        try {
            if (typeof w.generateImage === 'function') {
                console.info('[IGS-Patch] 正在请求酒馆原生画图接口...');
                const res = await w.generateImage(prompt, negative);
                const dataUrl = res && (res.url || res.dataUrl || res);
                if (typeof dataUrl === 'string' && dataUrl) return dataUrl;
            }
        } catch (err) {
            console.warn('[IGS-Patch] 酒馆画图接口调用失败:', err);
        }
    }

    // 全部渠道均不可用，抛出包含诊断信息的异常
    const failureMsg = [
        '未检测到已就绪的生图后端：',
        `• 柏宝绘 (STBaiBaiImage): ${backends.baibai.detail}`,
        `• 通用/OpenAI 兼容 API: ${backends.customApi.detail}`,
        `• NovelAI 凭据: ${backends.nai.detail}`,
        `• 酒馆画图扩展: ${backends.extension.detail}`,
        '提示：建议在「设置 › 生图引擎」中填入通用的绘图 API (如 SiliconFlow / OpenAI 等) 或在酒馆中配置柏宝绘插件。',
    ].join('\n');

    const err = new Error(failureMsg);
    err.code = 'NO_IMAGE_BACKEND';
    err.backends = backends;
    throw err;
}
