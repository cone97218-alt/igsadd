/**
 * IGS TauriTavern 增强独立补丁 (主入口)
 * 架构：
 * 1. 提示词解耦与阻断：彻底拦截主脚本注入的 Gal 标签规范，主模型提示词保持 0 污染
 * 2. 原生标签规则转存：拦截到的完整 IGS 标签规则实时转交给副模型用作演出导演指南
 * 3. 制作模式双轨制：支持【自动制作】(正文生成完毕即自动改写) 与【手动制作】(放映键触发制作)
 * 4. 放映键无缝重构：QR 栏 "Gal模拟" 按钮重构为纯 FontAwesome 放映机图标并劫持点击逻辑
 * 5. 全屏放映设置面板：在魔法棒菜单注入【放映设置】入口，调起 Vue 3 原生全屏控制台
 * 6. 原生 Rust 存储：全面对接 TauriTavern KV Store，毫秒级读写海量演出剧本
 */

import { initConfig, patchState } from './state/state.js';
import { getTauriHandle } from './tauri/adapter.js';
import { setupPromptBlocker } from './interceptor/prompt-blocker.js';
import { setupRenderHook } from './interceptor/render-hook.js';
import { processLatestAssistantMessage, convertMessageToGal, handleMessageSwiped, handleMessageDeleted } from './director/pipeline.js';
import { syncAllStoredScriptsToChat } from './interceptor/render-hook.js';
import { setupQrHijack } from './ui/qr-hijack.js';
import { setupMagicMenu } from './ui/magic-menu.js';
import { openSettingsModal, closeSettingsModal, ensureMounted } from './ui/settings-modal.js';
import { openResourcesModal, closeResourcesModal, ensureResourcesMounted } from './ui/resources-modal.js';
import { fullResetGalSystem } from './tauri/reset.js';
import { notifyToast } from './ui/toast.js';
import { setupBaibaiEnhancer } from './image-gen/baibai-enhancer.js';
import { setupBaiBaiBookBridge } from './baibai/book-bridge.js';
import { ensureIgsDatabasesHealthy } from './resources/asset-service.js';

(async function initIgsTauriPatch() {
    console.info('[IGS-Patch] 正在初始化 TauriTavern 增强补丁 v2.0 (Vue 3 架构)...');

    // 1. 初始化持久化配置
    await initConfig();

    // 1.5 检查并自愈修复 IndexedDB 数据表结构（防止原生 IGS 生图时报 store not found）
    ensureIgsDatabasesHealthy().catch(err => console.warn('[IGS-Patch] 数据库自检异常:', err));

    // 2. 检查与连接 TauriTavern Rust API
    const handle = await getTauriHandle();
    if (handle) {
        console.info('[IGS-Patch] 已成功连接 TauriTavern Rust 后端 API。');
    } else {
        console.warn('[IGS-Patch] 未检测到 TauriTavern 环境，将以标准酒馆模式降级运行。');
    }

    // 3. 启动柏宝书虚拟数据库适配桥 (替换/虚拟 AutoCardUpdater 接口)
    setupBaiBaiBookBridge();

    // 4. 启动提示词阻断器：截获 IGS 规则并确保主模型提示词纯净
    setupPromptBlocker();

    // 5. 启动渲染劫持：向 IGS 阅读器喂入副模型转译剧本
    setupRenderHook();

    // 6. 启动 QR 栏放映键劫持与图标重构
    setupQrHijack();

    // 7. 启动柏宝绘分区画师增强引擎
    setupBaibaiEnhancer();

    // 8. 启动魔法棒菜单【放映设置】与【放映资源】注入并预热挂载
    setupMagicMenu();
    ensureMounted();
    ensureResourcesMounted();

    // 9. 绑定正文生成生命周期事件
    bindGenerationEvents();

    // 8. 暴露全局 API
    const patchApi = {
        version: '2.0.0',
        patchState,
        openSettings: openSettingsModal,
        closeSettings: closeSettingsModal,
        openResources: openResourcesModal,
        closeResources: closeResourcesModal,
        fullReset: fullResetGalSystem,
        convertMessageToGal,
        processLatestAssistantMessage,
    };
    for (const w of getCandidateWindows()) {
        try { w.__IGS_TAURI_PATCH__ = patchApi; } catch (_) { }
    }

    console.info('[IGS-Patch] IGS 补丁初始化完毕：放映键已重构，魔法棒放映设置已装载。');
})();

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

function bindGenerationEvents() {
    for (const w of getCandidateWindows()) {
        try {
            const ctx = w.SillyTavern?.getContext?.();
            const eventSource = ctx?.eventSource || w.eventSource;
            if (!eventSource || typeof eventSource.on !== 'function') continue;
            if (eventSource.__igsPatchGenBound) continue;
            eventSource.__igsPatchGenBound = true;

            const onGenerationEnded = async () => {
                if (patchState.productionMode === 'auto') {
                    console.info('[IGS-Patch] 自动模式：检测到正文生成完毕，开始在后台制作演出...');
                    try {
                        await processLatestAssistantMessage();
                    } catch (e) {
                        console.warn('[IGS-Patch] 自动转译剧本失败:', e);
                    }
                } else {
                    console.info('[IGS-Patch] 手动模式：正文生成完毕，待用户点击放映键时制作演出。');
                }
            };

            const eventTypes = ctx?.event_types || ctx?.eventTypes || {};
            const endEvent = eventTypes.GENERATION_ENDED || 'generation_ended';
            const swipedEvent = eventTypes.MESSAGE_SWIPED || 'message_swiped';
            const deletedEvent = eventTypes.MESSAGE_DELETED || 'message_deleted';
            const chatChangedEvent = eventTypes.CHAT_CHANGED || 'chat_changed';

            eventSource.on(endEvent, onGenerationEnded);

            eventSource.on(swipedEvent, (messageId) => {
                console.info('[IGS-Patch] 收到分支切换事件 (MESSAGE_SWIPED):', messageId);
                handleMessageSwiped(messageId);
            });

            eventSource.on(deletedEvent, (messageId) => {
                console.info('[IGS-Patch] 收到楼层删除事件 (MESSAGE_DELETED):', messageId);
                handleMessageDeleted(messageId);
            });

            eventSource.on(chatChangedEvent, () => {
                console.info('[IGS-Patch] 收到对话切换事件 (CHAT_CHANGED)，全量重载剧本映射');
                syncAllStoredScriptsToChat();
            });

            console.info('[IGS-Patch] 成功绑定全套生成、分支与楼层生命周期事件');
        } catch (_) { }
    }
}
