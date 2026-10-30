/**
 * 视觉小说演出导演提示词预设管理与编译器 (Prompt Preset Manager)
 * 
 * 核心特性：
 * 1. 预设驱动：支持系统身份/用户/AI自由分配，仅用 FontAwesome 图标表示与切换。
 * 2. 槽位拖拽排序：主脚本提示词（slot_igs_rules）与楼层原文（slot_floor_text）作为固定槽位可自由调序。
 * 3. 正则裁剪流水线：楼层原文支持多条可配置正则规则依次清洗。
 * 4. 纯净无括号，零 Emoji，响应式移动端支持。
 */

import { resolveEffectiveGrammar } from '../director/grammar-prompt.js';

const STORAGE_KEY = 'igs:patch:prompt_preset_v2';

export const DEFAULT_PROMPT_PRESET = {
    version: 2,
    name: '标准导演预设',
    items: [
        {
            id: 'slot_igs_rules',
            type: 'slot_igs_rules',
            role: 'system', // 'system' | 'user' | 'assistant'
            name: '主脚本提示词',
            enabled: true,
            removable: false,
        },
        {
            id: 'custom_director_guide',
            type: 'custom',
            role: 'system',
            name: '导演任务指引',
            content: `你是一位专业的视觉小说演出导演。请严格遵循上述视觉小说标签语法规范，将给定的【小说原文】改写为沉浸式视觉小说演出剧本。

制作要求：
1. 剧情忠实：完整保留原文的情节、对白、动作与心声，不得擅自删减或扩写故事。
2. 标签规范：
   - 角色说出的台词，使用 [igs-char:角色名|情绪|台词内容]
   - 角色的心理活动或心声，使用 [igs-thought:角色名|情绪|心声内容]
   - 旁白与环境动作描写，直接输出纯文本自然段落，严禁附加任何 speaker 标签或前缀
   - 场景与环境切换，使用 [igs-scene:地点|时段|天气]
   - 关键氛围渲染适度添加 [igs-fx:bgm|...] 或特效标签
3. 输出格式：直接输出转换后的剧本正文，严禁输出任何开场白、废话解释或 Markdown 代码块包裹。`,
            enabled: true,
            removable: true,
        },
        {
            id: 'slot_floor_text',
            type: 'slot_floor_text',
            role: 'user',
            name: '楼层原文',
            prefix: '【小说原文】\n',
            suffix: '',
            enabled: true,
            removable: false,
        },
    ],
    floorRegexRules: [
        { id: 'fence', name: '清除代码块', pattern: '^```[a-z]*\\s*\\n|\\n```\\s*$', replacement: '', flags: 'gim', enabled: true },
        { id: 'html', name: '清除HTML标签', pattern: '<[^>]+>', replacement: '', flags: 'g', enabled: true },
        { id: 'old_tags', name: '清除残留标签', pattern: '\\[(igs-[a-z0-9_-]+|speaker|emotion|location):[^\\]]*\\]', replacement: '', flags: 'gi', enabled: true },
        { id: 'md_img', name: '清除图片语法', pattern: '!\\[.*?\\]\\(.*?\\)', replacement: '', flags: 'g', enabled: true },
        { id: 'empty_lines', name: '规范多余空行', pattern: '\\n{3,}', replacement: '\\n\\n', flags: 'g', enabled: true },
    ],
};

let currentPreset = null;

/**
 * 读取当前预设配置
 */
export function getPromptPreset() {
    if (currentPreset) return currentPreset;

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.floorRegexRules)) {
                // 确保固定槽位必须存在
                ensureFixedSlots(parsed.items);
                currentPreset = parsed;
                return currentPreset;
            }
        }
    } catch (_) { }

    currentPreset = JSON.parse(JSON.stringify(DEFAULT_PROMPT_PRESET));
    return currentPreset;
}

/**
 * 保存当前预设配置
 */
export function savePromptPreset(preset) {
    if (!preset || !Array.isArray(preset.items)) return;
    ensureFixedSlots(preset.items);
    currentPreset = preset;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preset));
    } catch (_) { }
}

/**
 * 恢复为默认预设配置
 */
export function resetPromptPreset() {
    currentPreset = JSON.parse(JSON.stringify(DEFAULT_PROMPT_PRESET));
    savePromptPreset(currentPreset);
    return currentPreset;
}

/**
 * 确保固定槽位存在
 */
function ensureFixedSlots(items) {
    const hasIgs = items.some((it) => it.type === 'slot_igs_rules');
    if (!hasIgs) {
        items.unshift({
            id: 'slot_igs_rules',
            type: 'slot_igs_rules',
            role: 'system',
            name: '主脚本提示词',
            enabled: true,
            removable: false,
        });
    }

    const hasFloor = items.some((it) => it.type === 'slot_floor_text');
    if (!hasFloor) {
        items.push({
            id: 'slot_floor_text',
            type: 'slot_floor_text',
            role: 'user',
            name: '楼层原文',
            prefix: '【小说原文】\n',
            suffix: '',
            enabled: true,
            removable: false,
        });
    }
}

/**
 * 对楼层小说正文执行正则裁剪流水线
 */
export function clipFloorText(rawText, customRules = null) {
    if (!rawText || typeof rawText !== 'string') return '';
    let text = rawText;

    const preset = getPromptPreset();
    const rules = Array.isArray(customRules) ? customRules : (preset.floorRegexRules || []);

    for (const rule of rules) {
        if (!rule || rule.enabled === false || !rule.pattern) continue;
        try {
            const re = new RegExp(rule.pattern, rule.flags || 'g');
            text = text.replace(re, rule.replacement != null ? rule.replacement : '');
        } catch (err) {
            console.warn('[IGS-Patch] 正则规则执行异常:', rule.name, err);
        }
    }

    return text.trim();
}

/**
 * 编译预设，生成送往副模型的完整结构化提示词
 * @param {string} rawFloorText 楼层小说原文
 * @param {Object} contextMeta 上下文元数据
 * @returns {Array<{ role: 'system'|'user'|'assistant', content: string }>}
 */
export function compilePromptMessages(rawFloorText, contextMeta = {}) {
    const preset = getPromptPreset();
    const items = preset.items || [];
    const messages = [];

    const effectiveGrammar = resolveEffectiveGrammar();
    const clippedText = clipFloorText(rawFloorText, preset.floorRegexRules);

    for (const item of items) {
        if (!item || item.enabled === false) continue;

        let content = '';
        if (item.type === 'slot_igs_rules') {
            content = effectiveGrammar;
        } else if (item.type === 'slot_floor_text') {
            const prefix = item.prefix || '';
            const suffix = item.suffix || '';
            content = `${prefix}${clippedText}${suffix}`.trim();
        } else {
            content = String(item.content || '').trim();
        }

        if (!content) continue;

        messages.push({
            role: item.role || 'system',
            content,
        });
    }

    // 若列表为空，兜底安全生成
    if (messages.length === 0) {
        messages.push({ role: 'system', content: effectiveGrammar });
        messages.push({ role: 'user', content: clippedText });
    }

    return messages;
}

/**
 * 切换条目角色：system -> user -> assistant -> system
 */
export function cycleRole(role) {
    if (role === 'system') return 'user';
    if (role === 'user') return 'assistant';
    return 'system';
}

/**
 * 角色对应的 FontAwesome 图标类名
 * system: 齿轮 (fa-gear)
 * user: 用户 (fa-user)
 * assistant/ai: 机器人 (fa-robot)
 */
export function getRoleIconClass(role) {
    if (role === 'system') return 'fa-gear';
    if (role === 'user') return 'fa-user';
    return 'fa-robot';
}

/**
 * 角色可读名称 (无括号)
 */
export function getRoleDisplayName(role) {
    if (role === 'system') return '系统';
    if (role === 'user') return '用户';
    return 'AI';
}
