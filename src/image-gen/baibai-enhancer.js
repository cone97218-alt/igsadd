/**
 * 柏宝绘 ST-BaiBai-Image 分区画师串增强引擎
 * 
 * 功能：
 * 1. 联动柏宝绘内部画风预设库，复刻并增强分区画师调度机制。
 * 2. 覆盖全部生图资产类别：立绘、表情差分、背景、剧情CG、NSFW CG、Q版头像、物品道具、换装衣柜、非人角色。
 * 3. 动态读取柏宝绘已存储的画风预设列表与官方推荐预设，支持各类别独立绑定。
 * 4. 动态拦截 globalThis.STBaiBaiImage.generate 接口，精准识别当前生图类别，智能组装并下发提示词。
 */

import { notifyToast } from '../ui/toast.js';

export const BAIBAI_PROMPT_KINDS = Object.freeze([
    { id: 'sprite', label: '立绘', icon: 'fa-person' },
    { id: 'expression', label: '表情差分', icon: 'fa-face-smile' },
    { id: 'background', label: '背景', icon: 'fa-image' },
    { id: 'cg', label: '剧情CG', icon: 'fa-film' },
    { id: 'nsfwCg', label: 'NSFW CG', icon: 'fa-heart' },
    { id: 'avatar', label: 'Q版头像', icon: 'fa-circle-user' },
    { id: 'item', label: '物品道具', icon: 'fa-cube' },
    { id: 'wardrobe', label: '换装衣柜', icon: 'fa-shirt' },
    { id: 'creature', label: '非人角色', icon: 'fa-paw' },
]);

export const BUILTIN_NAI_ARTIST_PRESET = Object.freeze({
    id: 'bi_default',
    name: '默认画师串',
    desc: '官方推荐通用二次元',
    prompt: '0.8::nnmbpx::,0.8::artist:yalmyu::,0.1::smilesmile1312,::,  artist:sh_(shinh), 0.4::chen bin::,0.4::dayama::,healthyman,bacheally,',
    negative: '',
});

/**
 * 动态读取柏宝绘已配置的画风预设列表
 */
export function getBaiBaiArtistPresets() {
    const list = [
        { ...BUILTIN_NAI_ARTIST_PRESET }
    ];

    try {
        const getContext = window.SillyTavern?.getContext || window.parent?.SillyTavern?.getContext;
        const ctx = getContext ? getContext() : null;
        let extSettings = ctx?.extensionSettings;

        if (!extSettings) {
            const raw = localStorage.getItem('extension_settings');
            if (raw) {
                extSettings = JSON.parse(raw);
            }
        }

        const baibai = extSettings?.baibai_image;
        if (baibai?.nai?.artistPresets && Array.isArray(baibai.nai.artistPresets)) {
            for (const p of baibai.nai.artistPresets) {
                if (p && p.id && !list.some(x => x.id === p.id)) {
                    list.push({
                        id: p.id,
                        name: p.name || p.id,
                        desc: p.desc || '',
                        prompt: p.prompt || '',
                        negative: p.negative || '',
                    });
                }
            }
        }
    } catch (e) {
        console.warn('[IGS-Patch] 读取柏宝绘预设失败:', e);
    }

    return list;
}

const STORAGE_KEY = 'igs:patch:baibai_artists_v3';

function buildInitialConfig() {
    const kinds = {};
    for (const item of BAIBAI_PROMPT_KINDS) {
        kinds[item.id] = {
            enabled: true,
            presetId: 'follow',
            extraPositive: '',
            extraNegative: '',
        };
    }
    return {
        enabled: true,
        kinds,
    };
}

let activeConfig = null;

export function getBaibaiArtistConfig() {
    if (activeConfig) return activeConfig;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.kinds === 'object') {
                const initial = buildInitialConfig();
                const mergedKinds = {};
                for (const item of BAIBAI_PROMPT_KINDS) {
                    const existing = parsed.kinds[item.id] || {};
                    mergedKinds[item.id] = {
                        enabled: existing.enabled !== false,
                        presetId: existing.presetId || 'follow',
                        extraPositive: existing.extraPositive || existing.positive || '',
                        extraNegative: existing.extraNegative || existing.negative || '',
                    };
                }
                activeConfig = {
                    ...initial,
                    ...parsed,
                    kinds: mergedKinds,
                };
                return activeConfig;
            }
        }

        // 尝试从旧版配置迁移
        const legacyRaw = localStorage.getItem('igs:patch:baibai_artists_v2');
        if (legacyRaw) {
            const legacyParsed = JSON.parse(legacyRaw);
            if (legacyParsed && typeof legacyParsed.kinds === 'object') {
                const initial = buildInitialConfig();
                for (const item of BAIBAI_PROMPT_KINDS) {
                    if (legacyParsed.kinds[item.id]) {
                        initial.kinds[item.id].enabled = legacyParsed.kinds[item.id].enabled !== false;
                        initial.kinds[item.id].extraPositive = legacyParsed.kinds[item.id].positive || '';
                        initial.kinds[item.id].extraNegative = legacyParsed.kinds[item.id].negative || '';
                    }
                }
                activeConfig = initial;
                return activeConfig;
            }
        }
    } catch (_) { }

    activeConfig = buildInitialConfig();
    return activeConfig;
}

export function saveBaibaiArtistConfig(cfg) {
    activeConfig = cfg;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (_) { }
}

// 追踪当前正在执行的 IGS 任务类别
let currentActiveKind = null;
let currentActivityId = null;

function setupActivityWatcher() {
    const onActivity = (e) => {
        const detail = e.detail || e;
        if (detail && detail.type === 'start') {
            currentActiveKind = detail.kind || 'cg';
            currentActivityId = detail.id;
        } else if (detail && detail.type === 'end' && detail.id === currentActivityId) {
            currentActiveKind = null;
            currentActivityId = null;
        }
    };

    window.addEventListener('igs:image-activity', onActivity);
    try {
        if (window.parent && window.parent !== window) {
            window.parent.addEventListener('igs:image-activity', onActivity);
        }
    } catch (_) { }
}

function detectKindFromPayload(payload) {
    if (currentActiveKind) return currentActiveKind;

    const p = String(payload?.prompt || '').toLowerCase();
    const size = String(payload?.size || '').toLowerCase();
    const chars = Array.isArray(payload?.characters) ? payload.characters : [];

    if (p.includes('chibi') || p.includes('super deformed') || p.includes('sticker')) {
        return 'avatar';
    }
    if (p.includes('close-up') || p.includes('expressive face') || p.includes('blush') || p.includes('pout')) {
        return 'expression';
    }
    if (p.includes('no humans') || p.includes('scenery') || (size === 'landscape' && chars.length === 0)) {
        return 'background';
    }
    if (p.includes('white background') || p.includes('simple background') || p.includes('standing') || chars.length > 0) {
        return 'sprite';
    }
    if (p.includes('item focus') || p.includes('still life') || p.includes('object')) {
        return 'item';
    }
    if (p.includes('creature') || p.includes('beast') || p.includes('monster')) {
        return 'creature';
    }
    if (p.includes('wearing') || p.includes('outfit')) {
        return 'wardrobe';
    }
    return 'cg';
}

function prependTags(head, tail) {
    const h = String(head || '').trim().replace(/^,+|,+$/g, '').trim();
    const t = String(tail || '').trim().replace(/^,+|,+$/g, '').trim();
    if (!h) return t;
    if (!t) return h;
    return `${h}, ${t}`;
}

let isHookInstalled = false;

/**
 * 拦截与劫持 globalThis.STBaiBaiImage.generate
 */
export function setupBaibaiEnhancer() {
    if (isHookInstalled) return;
    setupActivityWatcher();

    const tryWrap = (target) => {
        if (!target || !target.STBaiBaiImage || target.STBaiBaiImage.__igsHooked) return false;
        const baibai = target.STBaiBaiImage;
        const originalGenerate = baibai.generate.bind(baibai);

        baibai.generate = async function interceptedGenerate(payload = {}, options = {}) {
            const workingPayload = { ...payload };
            const cfg = getBaibaiArtistConfig();
            if (cfg.enabled) {
                const kind = detectKindFromPayload(workingPayload);
                const kindEntry = cfg.kinds[kind];

                if (kindEntry && kindEntry.enabled !== false) {
                    const presetId = kindEntry.presetId || 'follow';

                    if (presetId === 'none') {
                        if (kindEntry.extraPositive) {
                            workingPayload.prompt = prependTags(kindEntry.extraPositive, workingPayload.prompt);
                        }
                        if (kindEntry.extraNegative) {
                            workingPayload.negative = prependTags(kindEntry.extraNegative, workingPayload.negative);
                        }
                    } else if (presetId !== 'follow') {
                        const presets = getBaiBaiArtistPresets();
                        const matched = presets.find(p => p.id === presetId);
                        if (matched) {
                            const finalPositive = prependTags(matched.prompt, kindEntry.extraPositive);
                            const finalNegative = prependTags(matched.negative, kindEntry.extraNegative);

                            if (finalPositive) {
                                workingPayload.prompt = prependTags(finalPositive, workingPayload.prompt);
                            }
                            if (finalNegative) {
                                workingPayload.negative = prependTags(finalNegative, workingPayload.negative);
                            }

                            const kindLabel = (BAIBAI_PROMPT_KINDS.find(k => k.id === kind) || {}).label || kind;
                            console.info(`[IGS-Patch] 柏宝绘生图：已套用【${kindLabel}】绑定的预设【${matched.name}】`);
                        }
                    } else {
                        if (kindEntry.extraPositive) {
                            workingPayload.prompt = prependTags(kindEntry.extraPositive, workingPayload.prompt);
                        }
                        if (kindEntry.extraNegative) {
                            workingPayload.negative = prependTags(kindEntry.extraNegative, workingPayload.negative);
                        }
                    }
                }
            }

            return originalGenerate(workingPayload, options);
        };

        baibai.__igsHooked = true;
        console.info('[IGS-Patch] 柏宝绘 (STBaiBaiImage) 分区画风联动拦截器已挂载就绪。');
        return true;
    };

    const runChecks = () => {
        tryWrap(globalThis);
        tryWrap(window);
        try { if (window.parent) tryWrap(window.parent); } catch (_) { }
        try { if (window.top) tryWrap(window.top); } catch (_) { }
    };

    runChecks();

    // 订阅柏宝绘生命周期事件
    window.addEventListener('st-baibai-image:ready', runChecks);
    window.addEventListener('st-baibai-image:changed', runChecks);
    try {
        if (window.parent && window.parent !== window) {
            window.parent.addEventListener('st-baibai-image:ready', runChecks);
            window.parent.addEventListener('st-baibai-image:changed', runChecks);
        }
    } catch (_) { }

    const interval = setInterval(() => {
        runChecks();
        if (globalThis.STBaiBaiImage?.__igsHooked) {
            clearInterval(interval);
        }
    }, 1500);

    isHookInstalled = true;
}
