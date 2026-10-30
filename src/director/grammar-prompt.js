/**
 * 视觉小说演出导演 Prompt 组装与正文清洗模块
 * 
 * 核心逻辑：
 * 1. 动态读取从主脚本拦截到的【原生 IGS 标签语法与场景规则】。
 * 2. 对楼层小说正文进行正则裁剪与清洗，消除冗余格式干扰。
 * 3. 拼接导演改编指引任务，送交副模型进行高保真演出剧本制作。
 */

import { patchState } from '../state/state.js';
import { compilePromptMessages } from '../prompt-presets/preset-manager.js';

// 兜底原生标签规范（仅在从未拦截到主脚本注入时的首次冷启动备用）
const FALLBACK_DEFAULT_GRAMMAR = `[igs标签语法]
[igs-scene:地点|时段|天气] 场景切换（时段：黎明/白天/黄昏/夜晚/深夜；天气：晴朗/阴天/雨天/暴雨/雪天/大风）
[igs-char:角色名|情绪|台词内容] 角色对白（情绪：开心/微笑/得意/温柔/生气/愤怒/委屈/害羞/脸红/悲伤/哭泣/惊讶/震惊/思考/疑惑/冷淡/释然/认真/疲惫/害怕/平静）
[igs-thought:角色名|情绪|心声内容] 角色心理活动、内心独白
旁白与环境动作描写：直接输出纯文本自然段落，无需任何标签包裹，段与段之间空一行。
[igs-fx:bgm|曲名或情绪] 背景音乐（如：[igs-fx:bgm|静谧]、[igs-fx:bgm|温馨]、[igs-fx:bgm|紧张]）
[igs-fx:heart|角色名] 好感心动
[igs-fx:sweat|角色名] 尴尬无奈
[igs-fx:shock|角色名] 震惊特写`;

/**
 * 获取当前生效的 IGS 语法规则（拦截到的主脚本规则优先）
 */
export function resolveEffectiveGrammar() {
    const parts = [];

    if (patchState.interceptedPrompt.system) {
        parts.push(patchState.interceptedPrompt.system);
    }
    if (patchState.interceptedPrompt.depth0) {
        parts.push(patchState.interceptedPrompt.depth0);
    }
    if (Array.isArray(patchState.interceptedPrompt.segments) && patchState.interceptedPrompt.segments.length > 0) {
        for (const seg of patchState.interceptedPrompt.segments) {
            if (seg?.content) parts.push(seg.content);
        }
    }

    if (parts.length > 0) {
        return parts.join('\n\n');
    }

    return FALLBACK_DEFAULT_GRAMMAR;
}

/**
 * 对楼层小说正文进行正则清洗与裁剪
 * @param {string} rawText
 */
export function cleanFloorNovelText(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = rawText;

    // 1. 去除 Markdown 代码块包裹
    text = text.replace(/^```[a-z]*\s*\n/i, '').replace(/\n```\s*$/i, '');

    // 2. 去除可能残留的 HTML 标签 (如 <div class="message">...</div>)
    text = text.replace(/<[^>]+>/g, '');

    // 3. 去除已有旧格式标签（如果二次制作，避免标签重复嵌套）
    text = text.replace(/\[(igs-[a-z0-9_-]+|speaker|emotion|location):[^\]]*\]/gi, '');

    // 4. 去除可能存在的图片占位符 (Markdown 图片)
    text = text.replace(/!\[.*?\]\(.*?\)/g, '');

    // 5. 规范化空白行：连续多行空行合并为一个空行
    text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

    return text.trim();
}

/**
 * 组装发送给副模型的导演剧本制作请求（预设驱动流水线）
 * @param {string} rawArticle 楼层小说原文
 * @param {Object} contextMeta 上下文元数据
 */
export function buildDirectorRequestPayload(rawArticle, contextMeta = {}) {
    return compilePromptMessages(rawArticle, contextMeta);
}
