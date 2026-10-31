/**
 * 放映设置全屏控制台 (Vue 3 架构)
 * 完美遵循 IGS 原生 UI 配色与视觉规范，提供演出模式切换、提示词拦截监视与数据管理
 * 规范：纯 FontAwesome 图标，严禁 Emoji；标题严禁使用括号补充说明；全屏手机端深度响应式适配
 * 焦点感知：动态绑定当前视口/聚焦楼层及特定分支 (Swipe)
 */

import { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { patchState, setProductionMode, setTheme, subscribeState, detectAndSyncIgsTheme } from '../state/state.js';
import { THEME_OPTIONS, THEME_PALETTES, generateThemeCssVariables } from './theme.js';
import { getIgsSecondaryLlmConfig, testSecondaryLlmConnection } from '../director/secondary-llm.js';
import { getCurrentVisibleFloorInfo, checkFloorScriptExists, convertMessageToGal } from '../director/pipeline.js';
import { fullResetGalSystem } from '../tauri/reset.js';
import { triggerIgsPromptResync } from '../interceptor/prompt-blocker.js';
import { notifyToast } from './toast.js';
import { injectSettingsStyles } from './settings-styles.js';
import { 
    getPromptPreset, 
    savePromptPreset, 
    resetPromptPreset, 
    compilePromptMessages, 
    cycleRole, 
    getRoleIconClass,
    getRoleDisplayName
} from '../prompt-presets/preset-manager.js';
import {
    BAIBAI_PROMPT_KINDS,
    getBaiBaiArtistPresets,
    getBaibaiArtistConfig,
    saveBaibaiArtistConfig
} from '../image-gen/baibai-enhancer.js';
import { getBaiBaiBookApi, extractFilteredNumericVars } from '../baibai/book-bridge.js';
import {
    getImageConfig,
    saveImageConfig,
    detectImageBackends,
    testCustomApiConnection
} from '../image-gen/image-service.js';

// 响应式显示开关
export const isModalVisible = ref(false);
export const requestedSettingsTab = ref('production');

let appInstance = null;
let containerEl = null;

export function openSettingsModal(options = null) {
    let targetDoc = null;
    let tab = null;
    if (options && options.nodeType === 9) {
        targetDoc = options;
    } else if (options && typeof options === 'object') {
        targetDoc = options.targetDoc || null;
        tab = options.initialTab || options.tab || null;
    }
    if (tab) {
        requestedSettingsTab.value = tab;
    }

    console.info('[IGS-Patch] 正在呼出放映设置全屏控制台...', tab ? `(初始标签: ${tab})` : '');
    injectSettingsStyles();
    detectAndSyncIgsTheme();
    ensureMounted(targetDoc);

    // 每次打开面板时，主动触发一次 IGS 规则同步
    triggerIgsPromptResync();

    isModalVisible.value = true;
}

export function closeSettingsModal() {
    isModalVisible.value = false;
}

function getCandidateDocument() {
    try {
        if (window.parent && window.parent.document) return window.parent.document;
    } catch (_) { }
    try {
        if (window.top && window.top.document) return window.top.document;
    } catch (_) { }
    return document;
}

export function ensureMounted(targetDoc = null) {
    const doc = targetDoc || getCandidateDocument();
    if (!doc) return;

    let container = doc.getElementById('igs-patch-settings-mount-root');
    if (!container) {
        container = doc.createElement('div');
        container.id = 'igs-patch-settings-mount-root';
        (doc.body || doc.documentElement).appendChild(container);
    }
    containerEl = container;

    if (!appInstance) {
        try {
            appInstance = createApp(SettingsRootComponent);
            appInstance.mount(containerEl);
        } catch (err) {
            console.error('[IGS-Patch] 挂载 Vue 3 设置面板失败:', err);
        }
    } else if (containerEl && !doc.body.contains(containerEl)) {
        (doc.body || doc.documentElement).appendChild(containerEl);
    }
}

const SettingsRootComponent = {
    setup() {
        const visible = isModalVisible;
        const activeTab = ref(requestedSettingsTab.value || 'production');
        watch(requestedSettingsTab, (val) => {
            if (val) activeTab.value = val;
        });

        const showPromptDetails = ref(false);

        // 响应式状态同步
        const state = reactive({
            productionMode: patchState.productionMode,
            interceptedPrompt: patchState.interceptedPrompt,
            productionStatus: patchState.productionStatus,
            theme: patchState.theme,
        });

        // 副模型测试状态
        const llmTesting = ref(false);
        const llmTestResult = ref(null);

        // 当前界面所处楼层与分支状态
        const currentFloorInfo = reactive({
            id: null,
            swipeId: 0,
            totalSwipes: 1,
            textLen: 0,
            hasScript: false,
            loading: false,
            characterName: '',
            rawText: '',
        });

        // 二次确认弹窗
        const confirmDialog = reactive({
            visible: false,
            title: '',
            content: '',
            onConfirm: null,
        });

        const themeStyleVars = computed(() => {
            return generateThemeCssVariables(state.theme);
        });

        const secondaryLlmConfig = computed(() => {
            return getIgsSecondaryLlmConfig() || { source: 'tavern', model: '酒馆原生默认' };
        });

        // 提示词预设流水线状态
        const preset = reactive(getPromptPreset());
        const showCompiledPreview = ref(false);
        const showRegexPanel = ref(false);

        // 提示词条目折叠/展开状态：默认全部折叠 (expandedItemIds 初始为空)
        const expandedItemIds = reactive({});
        const isItemExpanded = (id) => !!expandedItemIds[id];
        const toggleItemCollapse = (id) => {
            expandedItemIds[id] = !expandedItemIds[id];
        };

        const handleRoleCycle = (item) => {
            item.role = cycleRole(item.role);
            savePromptPreset(preset);
        };

        const handleMoveItemUp = (idx) => {
            if (idx > 0) {
                const temp = preset.items[idx];
                preset.items[idx] = preset.items[idx - 1];
                preset.items[idx - 1] = temp;
                savePromptPreset(preset);
            }
        };

        const handleMoveItemDown = (idx) => {
            if (idx < preset.items.length - 1) {
                const temp = preset.items[idx];
                preset.items[idx] = preset.items[idx + 1];
                preset.items[idx + 1] = temp;
                savePromptPreset(preset);
            }
        };

        const handleAddItem = () => {
            preset.items.push({
                id: 'custom_' + Date.now(),
                type: 'custom',
                role: 'system',
                name: '自定义条目',
                content: '',
                enabled: true,
                removable: true,
            });
            savePromptPreset(preset);
        };

        const handleDeleteItem = (idx) => {
            preset.items.splice(idx, 1);
            savePromptPreset(preset);
        };

        const handleResetPreset = () => {
            const def = resetPromptPreset();
            Object.assign(preset, def);
            notifyToast('已恢复默认预设', 'info');
        };

        const handleAddRegexRule = () => {
            preset.floorRegexRules.push({
                id: 're_' + Date.now(),
                name: '自定义正则',
                pattern: '',
                replacement: '',
                flags: 'g',
                enabled: true,
            });
            savePromptPreset(preset);
        };

        const handleDeleteRegexRule = (idx) => {
            preset.floorRegexRules.splice(idx, 1);
            savePromptPreset(preset);
        };

        const handleSavePresetChanges = () => {
            savePromptPreset(preset);
        };

        // 全屏编辑面板状态
        const expandEditor = reactive({
            visible: false,
            item: null,
            title: '',
            content: '',
            onSave: null,
        });

        const handleOpenExpandEditor = (item) => {
            expandEditor.item = item;
            expandEditor.title = item.name || '编辑提示词';
            expandEditor.content = item.content || '';
            expandEditor.onSave = null;
            expandEditor.visible = true;
        };

        const handleSaveExpandEditor = () => {
            if (typeof expandEditor.onSave === 'function') {
                expandEditor.onSave(expandEditor.content);
            } else if (expandEditor.item) {
                expandEditor.item.content = expandEditor.content;
                savePromptPreset(preset);
            }
            expandEditor.visible = false;
            notifyToast('保存成功', 'info');
        };

        const handleCloseExpandEditor = () => {
            expandEditor.visible = false;
        };

        // 柏宝绘分区画师联动状态
        const baibaiConfig = reactive(getBaibaiArtistConfig());
        const baibaiKinds = BAIBAI_PROMPT_KINDS;
        const availablePresets = ref(getBaiBaiArtistPresets());
        const isBaibaiDetected = ref(Boolean(window.STBaiBaiImage || window.parent?.STBaiBaiImage));

        // 分区画师卡片折叠状态，默认折叠
        const expandedArtistKinds = reactive({});
        const isArtistKindExpanded = (id) => !!expandedArtistKinds[id];
        const toggleArtistKindCollapse = (id) => {
            expandedArtistKinds[id] = !expandedArtistKinds[id];
        };

        const handleSaveBaibaiConfig = () => {
            saveBaibaiArtistConfig(baibaiConfig);
        };

        const handleRefreshPresets = () => {
            availablePresets.value = getBaiBaiArtistPresets();
            notifyToast('已刷新柏宝绘预设列表', 'info');
        };

        const handleResetAllToFollow = () => {
            for (const item of baibaiKinds) {
                if (baibaiConfig.kinds[item.id]) {
                    baibaiConfig.kinds[item.id].presetId = 'follow';
                    baibaiConfig.kinds[item.id].enabled = true;
                }
            }
            saveBaibaiArtistConfig(baibaiConfig);
            notifyToast('已将所有类别重置为跟随柏宝绘当前设置', 'info');
        };

        const getPresetDetails = (presetId) => {
            if (!presetId || presetId === 'follow' || presetId === 'none') return null;
            return availablePresets.value.find(p => p.id === presetId) || null;
        };

        // 柏宝书虚拟数据库联动状态
        const isBaiBaiBookDetected = ref(Boolean(getBaiBaiBookApi()));
        const detectedNumericVars = ref([]);

        const refreshBaiBaiBookInfo = () => {
            const bookApi = getBaiBaiBookApi();
            isBaiBaiBookDetected.value = Boolean(bookApi);
            if (bookApi) {
                try {
                    const snap = bookApi.getSnapshot();
                    detectedNumericVars.value = extractFilteredNumericVars(snap?.vars);
                } catch (_) { }
            }
        };
        refreshBaiBaiBookInfo();

        const getPresetDisplayName = (presetId) => {
            if (!presetId || presetId === 'follow') return '跟随全局';
            if (presetId === 'none') return '纯净画面';
            const found = availablePresets.value.find(p => p.id === presetId);
            return found ? found.name : presetId;
        };

        const handleOpenArtistEditor = (kindId, field, fieldLabel) => {
            const kind = baibaiKinds.find(k => k.id === kindId);
            const title = `${kind?.label || kindId} · ${fieldLabel}`;
            expandEditor.item = null;
            expandEditor.title = title;
            expandEditor.content = baibaiConfig.kinds[kindId]?.[field] || '';
            expandEditor.onSave = (newContent) => {
                if (baibaiConfig.kinds[kindId]) {
                    baibaiConfig.kinds[kindId][field] = newContent;
                    saveBaibaiArtistConfig(baibaiConfig);
                }
            };
            expandEditor.visible = true;
        };

        const previewCompiledMessages = computed(() => {
            return compilePromptMessages(
                currentFloorInfo.rawText || '夜晚，窗外飘着细雨。林小雨轻轻叹了口气，合上手中的书本。',
                { characterName: currentFloorInfo.characterName }
            );
        });

        const updateStateFromGlobal = () => {
            state.productionMode = patchState.productionMode;
            state.interceptedPrompt = patchState.interceptedPrompt;
            state.productionStatus = patchState.productionStatus;
            state.theme = patchState.theme;
        };

        const refreshCurrentFloor = async () => {
            currentFloorInfo.loading = true;
            try {
                const target = getCurrentVisibleFloorInfo();
                if (target) {
                    currentFloorInfo.id = target.floor;
                    currentFloorInfo.swipeId = target.swipeId;
                    currentFloorInfo.totalSwipes = target.totalSwipes;
                    currentFloorInfo.textLen = target.text.length;
                    currentFloorInfo.characterName = target.characterName;
                    currentFloorInfo.rawText = target.text;
                    currentFloorInfo.hasScript = await checkFloorScriptExists(target.floor, target.swipeId);
                } else {
                    currentFloorInfo.id = null;
                    currentFloorInfo.swipeId = 0;
                    currentFloorInfo.totalSwipes = 1;
                    currentFloorInfo.textLen = 0;
                    currentFloorInfo.hasScript = false;
                    currentFloorInfo.characterName = '';
                    currentFloorInfo.rawText = '';
                }
            } catch (_) { }
            finally {
                currentFloorInfo.loading = false;
            }
        };

        // 监听面板打开
        watch(isModalVisible, (isOpen) => {
            if (isOpen) {
                updateStateFromGlobal();
                refreshCurrentFloor();
                availablePresets.value = getBaiBaiArtistPresets();
                isBaibaiDetected.value = Boolean(window.STBaiBaiImage || window.parent?.STBaiBaiImage);
            }
        });

        const handleSetMode = (mode) => {
            setProductionMode(mode);
            state.productionMode = mode;
        };

        const handleSetTheme = (themeName) => {
            setTheme(themeName);
            state.theme = themeName;
        };

        const handleResyncPrompts = () => {
            triggerIgsPromptResync();
            notifyToast('已触发 IGS 规则同步', 'info');
            setTimeout(updateStateFromGlobal, 400);
        };

        const handleTestLlm = async () => {
            llmTesting.value = true;
            llmTestResult.value = null;
            try {
                const res = await testSecondaryLlmConnection();
                llmTestResult.value = res;
            } catch (err) {
                llmTestResult.value = { ok: false, error: err.message };
            } finally {
                llmTesting.value = false;
            }
        };

        const handleManualProduce = async () => {
            if (currentFloorInfo.id == null || !currentFloorInfo.rawText) {
                notifyToast('未检测到有效的楼层正文', 'warn');
                return;
            }
            try {
                await convertMessageToGal(
                    currentFloorInfo.id,
                    currentFloorInfo.rawText,
                    {
                        swipeId: currentFloorInfo.swipeId,
                        characterName: currentFloorInfo.characterName,
                    },
                    true
                );
                await refreshCurrentFloor();
            } catch (_) { }
        };

        const handleOpenReader = async () => {
            closeSettingsModal();
            try {
                const igs = window.parent?.IGS || window.IGS;
                const mid = currentFloorInfo.id;
                const sid = currentFloorInfo.swipeId || 0;

                // 预热加载剧本
                const { preloadScriptToMemory } = await import('../interceptor/render-hook.js');
                if (mid != null) {
                    await preloadScriptToMemory(mid, sid);
                }

                // 强制关闭旧阅读器实例，避免残留旧的未格式化快照
                if (typeof igs?.closeReader === 'function') {
                    try { igs.closeReader(); } catch (_) { }
                }
                if (typeof igs?.igsUi?.closeReader === 'function') {
                    try { igs.igsUi.closeReader(); } catch (_) { }
                }

                if (igs && typeof igs.openViewerFromMessage === 'function' && mid != null) {
                    igs.openViewerFromMessage(mid);
                } else if (igs && typeof igs.openLatestAvailable === 'function') {
                    igs.openLatestAvailable();
                } else {
                    notifyToast('主拓展阅读器接口尚未就绪', 'warn');
                }
            } catch (err) {
                notifyToast(`唤起阅读器异常: ${err.message}`, 'error');
            }
        };

        const handleResetCurrentFloor = async () => {
            if (currentFloorInfo.id == null) return;
            const mid = currentFloorInfo.id;
            const sid = currentFloorInfo.swipeId;

            confirmDialog.title = '清空当前楼层演出数据';
            confirmDialog.content = `确认清除第 ${mid} 楼分支 ${sid + 1} 的转译剧本吗？清除后可随时重新制作。`;
            confirmDialog.onConfirm = async () => {
                confirmDialog.visible = false;
                const { setStoredJson } = await import('../tauri/adapter.js');
                const { getScriptStoreKey, getScriptMemKey, scriptMemoryStore } = await import('../director/pipeline.js');
                await setStoredJson(getScriptStoreKey(mid, sid), null);
                await setStoredJson(`script_${mid}_s${sid}`, null);
                scriptMemoryStore.delete(getScriptMemKey(mid, sid));
                scriptMemoryStore.delete(`${mid}_${sid}`);
                notifyToast(`已清空第 ${mid} 楼分支 ${sid + 1} 剧本`, 'info');
                await refreshCurrentFloor();
            };
            confirmDialog.visible = true;
        };

        const handleFullReset = () => {
            confirmDialog.title = '重置一切';
            confirmDialog.content = '【最高警报】此操作将彻底抹除所有角色立绘、全聊天演出剧本、生图图库、数据库及所有本地缓存，恢复至纯净初始状态。确认重置一切吗？';
            confirmDialog.onConfirm = async () => {
                confirmDialog.visible = false;
                await fullResetGalSystem();
                await refreshCurrentFloor();
            };
            confirmDialog.visible = true;
        };

        // 生图引擎与诊断状态
        const imageConfig = reactive(getImageConfig());
        const imageBackends = ref(detectImageBackends());
        const imageTesting = ref(false);
        const imageTestResult = ref(null);
        const showCustomApiKey = ref(false);
        const showNaiApiKey = ref(false);

        const refreshImageBackends = () => {
            imageBackends.value = detectImageBackends();
        };

        const handleSaveImageConfig = () => {
            const ok = saveImageConfig(imageConfig);
            if (ok) {
                notifyToast('生图配置保存成功并已同步至原生服务', 'success');
                refreshImageBackends();
            } else {
                notifyToast('生图配置保存失败', 'error');
            }
        };

        const handleTestImageApi = async () => {
            imageTesting.value = true;
            imageTestResult.value = null;
            try {
                const res = await testCustomApiConnection(imageConfig.customApi);
                imageTestResult.value = res;
                if (res.ok) {
                    notifyToast('自定义生图 API 连接与测试出图成功！', 'success');
                } else {
                    notifyToast(`API 测试未通过: ${res.message}`, 'error', 4500);
                }
            } finally {
                imageTesting.value = false;
            }
        };

        let unsubscribe = null;

        onMounted(() => {
            unsubscribe = subscribeState(updateStateFromGlobal);
            const onKeyDown = (e) => {
                if (e.key === 'Escape' && isModalVisible.value) {
                    closeSettingsModal();
                }
            };
            window.addEventListener('keydown', onKeyDown);
        });

        onUnmounted(() => {
            if (unsubscribe) unsubscribe();
        });

        return {
            visible,
            activeTab,
            state,
            showPromptDetails,
            currentFloorInfo,
            llmTesting,
            llmTestResult,
            confirmDialog,
            themeOptions: THEME_OPTIONS,
            themeStyleVars,
            secondaryLlmConfig,
            preset,
            expandEditor,
            handleOpenExpandEditor,
            handleSaveExpandEditor,
            handleCloseExpandEditor,
            baibaiConfig,
            baibaiKinds,
            availablePresets,
            isBaibaiDetected,
            isArtistKindExpanded,
            toggleArtistKindCollapse,
            handleSaveBaibaiConfig,
            handleRefreshPresets,
            handleResetAllToFollow,
            getPresetDetails,
            getPresetDisplayName,
            handleOpenArtistEditor,
            isItemExpanded,
            toggleItemCollapse,
            getRoleDisplayName,
            showCompiledPreview,
            showRegexPanel,
            handleRoleCycle,
            handleMoveItemUp,
            handleMoveItemDown,
            handleAddItem,
            handleDeleteItem,
            handleResetPreset,
            handleAddRegexRule,
            handleDeleteRegexRule,
            handleSavePresetChanges,
            previewCompiledMessages,
            getRoleIconClass,
            handleSetMode,
            handleSetTheme,
            handleResyncPrompts,
            handleTestLlm,
            handleManualProduce,
            handleOpenReader,
            handleResetCurrentFloor,
            handleFullReset,
            isBaiBaiBookDetected,
            detectedNumericVars,
            refreshBaiBaiBookInfo,
            imageConfig,
            imageBackends,
            imageTesting,
            imageTestResult,
            showCustomApiKey,
            showNaiApiKey,
            refreshImageBackends,
            handleSaveImageConfig,
            handleTestImageApi,
            close: closeSettingsModal,
        };
    },

    template: `
    <div v-if="visible" class="igs-patch-overlay" :style="themeStyleVars" @click.self="close">
      <div class="igs-patch-window">
        <!-- 头部 -->
        <header class="igs-patch-header">
          <div class="igs-patch-title-box">
            <i class="fa-solid fa-film igs-patch-icon"></i>
            <div>
              <h2 class="igs-patch-title">放映设置</h2>
              <span class="igs-patch-subtitle">双轨演出与副模型导演</span>
            </div>
          </div>

          <div class="igs-patch-header-actions">
            <!-- 配色主题切换 -->
            <div class="igs-patch-theme-group">
              <button 
                v-for="th in themeOptions" 
                :key="th.value" 
                class="igs-patch-theme-swatch"
                :class="['theme-' + th.value, { 'is-active': state.theme === th.value }]"
                @click="handleSetTheme(th.value)"
                :title="th.label"
              >
                <span class="swatch-base" :style="{ backgroundColor: th.swatch.base }"></span>
                <span class="swatch-accent" :style="{ backgroundColor: th.swatch.accent }"></span>
              </button>
            </div>

            <!-- 关闭按钮 -->
            <button class="igs-patch-btn-close" @click="close" title="关闭">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        <!-- 主体结构 -->
        <div class="igs-patch-body">
          <!-- 标签页导航（桌面端为左侧边栏，移动端为顶部横向滚动条） -->
          <nav class="igs-patch-nav">
            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'production' }"
              @click="activeTab = 'production'"
            >
              <i class="fa-solid fa-clapperboard"></i>
              <span>制作</span>
            </button>

            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'imageGen' }"
              @click="activeTab = 'imageGen'; refreshImageBackends();"
            >
              <i class="fa-solid fa-paintbrush"></i>
              <span>生图引擎</span>
            </button>

            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'artist' }"
              @click="activeTab = 'artist'"
            >
              <i class="fa-solid fa-palette"></i>
              <span>画风</span>
            </button>

            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'prompt' }"
              @click="activeTab = 'prompt'"
            >
              <i class="fa-solid fa-shield-halved"></i>
              <span>提示词</span>
            </button>

            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'data' }"
              @click="activeTab = 'data'"
            >
              <i class="fa-solid fa-database"></i>
              <span>数据</span>
            </button>

            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'about' }"
              @click="activeTab = 'about'"
            >
              <i class="fa-solid fa-circle-info"></i>
              <span>关于</span>
            </button>
          </nav>

          <!-- 内容展示面板 -->
          <main class="igs-patch-content">
            <!-- 板块 1: 制作 -->
            <section v-if="activeTab === 'production'" class="igs-patch-section">
              <h3 class="section-title">制作模式</h3>
              <p class="section-desc">选择在正文生成完毕后如何将小说改编为视觉小说视窗演出。</p>

              <div class="mode-cards-grid">
                <!-- 自动制作模式卡片 -->
                <div 
                  class="mode-card" 
                  :class="{ 'is-selected': state.productionMode === 'auto' }"
                  @click="handleSetMode('auto')"
                >
                  <div class="mode-card-header">
                    <div class="mode-radio">
                      <span v-if="state.productionMode === 'auto'" class="radio-inner"></span>
                    </div>
                    <span class="mode-title">自动制作</span>
                    <span class="mode-badge">
                      <i class="fa-solid fa-bolt"></i> 自动
                    </span>
                  </div>
                  <p class="mode-desc">
                    主模型生成完小说正文后，立即自动在后台由副模型改写为带演出标签的剧本并存入存储。点击放映键即可秒开阅读器沉浸播放。
                  </p>
                </div>

                <!-- 手动制作模式卡片 -->
                <div 
                  class="mode-card" 
                  :class="{ 'is-selected': state.productionMode === 'manual' }"
                  @click="handleSetMode('manual')"
                >
                  <div class="mode-card-header">
                    <div class="mode-radio">
                      <span v-if="state.productionMode === 'manual'" class="radio-inner"></span>
                    </div>
                    <span class="mode-title">手动制作</span>
                    <span class="mode-badge">
                      <i class="fa-solid fa-hand"></i> 手动
                    </span>
                  </div>
                  <p class="mode-desc">
                    正文生成后不自动调用副模型。当您想要观看演出时，点击放映键开始制作当前视口所处楼层剧本，制作就绪后再次点击正式开播。
                  </p>
                </div>
              </div>

              <!-- 当前所在楼层演出状态 -->
              <h3 class="section-title" style="margin-top: 24px;">楼层状态</h3>
              <div class="status-card">
                <div v-if="currentFloorInfo.id != null" class="floor-details">
                  <div class="floor-stat-row">
                    <span class="stat-label">目标楼层：</span>
                    <span class="stat-val">第 {{ currentFloorInfo.id }} 楼</span>
                    <span class="stat-sep">|</span>
                    <span class="stat-label">分支：</span>
                    <span class="stat-val">{{ currentFloorInfo.swipeId + 1 }} / {{ currentFloorInfo.totalSwipes }}</span>
                    <span class="stat-sep">|</span>
                    <span class="stat-label">正文字数：</span>
                    <span class="stat-val">{{ currentFloorInfo.textLen }} 字</span>
                    <span class="stat-sep">|</span>
                    <span class="stat-label">剧本状态：</span>
                    <span class="stat-tag" :class="currentFloorInfo.hasScript ? 'tag-ready' : 'tag-pending'">
                      <i class="fa-solid" :class="currentFloorInfo.hasScript ? 'fa-check' : 'fa-clock'"></i>
                      <span>{{ currentFloorInfo.hasScript ? '演出已就绪' : '尚未制作' }}</span>
                    </span>
                  </div>

                  <div v-if="state.productionStatus.isProducing" class="producing-banner">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>{{ state.productionStatus.progress || '正在制作演出中' }}</span>
                  </div>

                  <div class="floor-actions">
                    <button 
                      class="igs-btn igs-btn-primary" 
                      :disabled="state.productionStatus.isProducing"
                      @click="handleManualProduce"
                    >
                      <i class="fa-solid fa-wand-magic-sparkles"></i>
                      <span>{{ currentFloorInfo.hasScript ? '重新制作' : '立即制作' }}</span>
                    </button>

                    <button 
                      v-if="currentFloorInfo.hasScript" 
                      class="igs-btn igs-btn-accent"
                      @click="handleOpenReader"
                    >
                      <i class="fa-solid fa-play"></i>
                      <span>开始放映</span>
                    </button>
                  </div>
                </div>

                <div v-else class="floor-empty">
                  <span>当前界面尚未检索到可见楼层，请先在酒馆中进入对话。</span>
                </div>
              </div>
            </section>

            <!-- 板块 2: 提示词预设与副模型 -->
            <section v-if="activeTab === 'prompt'" class="igs-patch-section">
              <!-- 拦截器状态 -->
              <h3 class="section-title">提示词拦截器</h3>
              <p class="section-desc">
                主脚本计划下发给主模型的视觉小说标签语法规则已被截获并剥离，确保主模型正文自然纯粹。
              </p>

              <div class="status-card">
                <div class="interceptor-status-row">
                  <span class="status-badge-ok">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>已激活拦截阻断</span>
                  </span>
                  <span class="intercepted-meta">
                    已截获规则字数: <strong>{{ state.interceptedPrompt.charCount }}</strong> 字符
                  </span>
                </div>

                <div class="interceptor-action-buttons" style="margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap;">
                  <button class="igs-btn igs-btn-secondary" @click="showPromptDetails = !showPromptDetails">
                    <i class="fa-solid" :class="showPromptDetails ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                    <span>{{ showPromptDetails ? '收起规则' : '查看规则' }}</span>
                  </button>

                  <button class="igs-btn igs-btn-secondary" @click="handleResyncPrompts">
                    <i class="fa-solid fa-arrows-rotate"></i>
                    <span>重新捕获</span>
                  </button>
                </div>

                <div v-if="showPromptDetails" class="prompt-preview-box">
                  <pre>{{ state.interceptedPrompt.system || '主脚本尚未触发提示词注入，当前使用内置原生规则兜底' }}</pre>
                </div>
              </div>

              <!-- 导演提示词预设流水线 -->
              <h3 class="section-title" style="margin-top: 24px;">导演提示词</h3>
              <p class="section-desc">
                按序编译并发送给副模型制作剧本。主脚本提示词与楼层原文为固定槽位，可自由调序；点击身份图标可快速切换。
              </p>

              <div class="preset-toolbar">
                <button class="igs-btn igs-btn-primary" @click="handleAddItem">
                  <i class="fa-solid fa-plus"></i>
                  <span>新增</span>
                </button>

                <button class="igs-btn igs-btn-secondary" @click="showCompiledPreview = !showCompiledPreview">
                  <i class="fa-solid" :class="showCompiledPreview ? 'fa-eye-slash' : 'fa-eye'"></i>
                  <span>{{ showCompiledPreview ? '收起预览' : '预览' }}</span>
                </button>

                <button class="igs-btn igs-btn-secondary" @click="handleResetPreset">
                  <i class="fa-solid fa-arrow-rotate-left"></i>
                  <span>恢复默认</span>
                </button>
              </div>

              <!-- 编译预览盒子 -->
              <div v-if="showCompiledPreview" class="prompt-preview-box" style="margin-bottom: 16px;">
                <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 8px; color: var(--igs-settings-accent);">
                  <i class="fa-solid fa-code"></i> 实时编译发送结果
                </div>
                <div class="preview-messages-container">
                  <div 
                    v-for="(msg, mIdx) in previewCompiledMessages" 
                    :key="mIdx"
                    class="preview-msg-card"
                    :class="'msg-' + msg.role"
                  >
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <i class="fa-solid" :class="getRoleIconClass(msg.role)"></i>
                      <span style="font-weight: 600; font-size: 0.8rem; text-transform: uppercase;">{{ msg.role }}</span>
                    </div>
                    <pre style="margin: 0; font-size: 0.8rem; white-space: pre-wrap;">{{ msg.content }}</pre>
                  </div>
                </div>
              </div>

              <!-- 预设条目卡片列表 -->
              <div class="preset-list">
                <div 
                  v-for="(item, idx) in preset.items" 
                  :key="item.id"
                  class="preset-item-card"
                  :class="{ 'is-disabled': !item.enabled }"
                >
                  <div class="preset-item-header" @click="toggleItemCollapse(item.id)">
                    <div class="item-header-left">
                      <!-- 折叠/展开指示图标：最前置手柄 -->
                      <i class="fa-solid collapse-toggle-icon" :class="isItemExpanded(item.id) ? 'fa-chevron-down' : 'fa-chevron-right'"></i>

                      <!-- 身份切换按钮：纯图标，无文字 -->
                      <button 
                        class="role-cycle-btn"
                        :class="'role-' + item.role"
                        :title="'当前身份: ' + getRoleDisplayName(item.role) + '，点击切换'"
                        @click.stop="handleRoleCycle(item)"
                      >
                        <i class="fa-solid" :class="getRoleIconClass(item.role)"></i>
                      </button>

                      <input 
                        v-if="item.type === 'custom'"
                        v-model="item.name" 
                        class="item-name-input"
                        placeholder="条目名称"
                        @click.stop
                        @change="handleSavePresetChanges"
                      />
                      <span v-else class="item-name-input" style="cursor: pointer;">
                        {{ item.name }}
                      </span>

                      <span v-if="item.type === 'slot_igs_rules'" class="item-slot-badge">
                        <i class="fa-solid fa-link"></i> 固定槽位
                      </span>
                      <span v-else-if="item.type === 'slot_floor_text'" class="item-slot-badge">
                        <i class="fa-solid fa-feather-pointed"></i> 固定槽位
                      </span>
                    </div>

                    <!-- 操作按钮组 -->
                    <div class="item-header-actions">
                      <button 
                        v-if="item.type === 'custom'"
                        class="mini-icon-btn" 
                        title="全屏编辑"
                        @click.stop="handleOpenExpandEditor(item)"
                      >
                        <i class="fa-solid fa-expand" style="pointer-events: none;"></i>
                      </button>
                      <button 
                        class="mini-icon-btn" 
                        :disabled="idx === 0"
                        title="上移"
                        @click.stop="handleMoveItemUp(idx)"
                      >
                        <i class="fa-solid fa-arrow-up"></i>
                      </button>
                      <button 
                        class="mini-icon-btn" 
                        :disabled="idx === preset.items.length - 1"
                        title="下移"
                        @click.stop="handleMoveItemDown(idx)"
                      >
                        <i class="fa-solid fa-arrow-down"></i>
                      </button>
                      <button 
                        v-if="item.removable"
                        class="mini-icon-btn btn-danger" 
                        title="删除"
                        @click.stop="handleDeleteItem(idx)"
                      >
                        <i class="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>

                  <!-- 卡片正文内容：默认折叠，展开时显示 -->
                  <div v-if="isItemExpanded(item.id)" class="preset-item-content">
                    <!-- 主脚本规则固定槽位 -->
                    <div v-if="item.type === 'slot_igs_rules'" class="slot-fixed-desc">
                      动态挂载主脚本截获的当前角色标签语法与场景规则；主脚本未注入时自动采用内置原生规则兜底。
                    </div>

                    <!-- 楼层原文固定槽位 -->
                    <div v-else-if="item.type === 'slot_floor_text'">
                      <div class="slot-fixed-desc" style="margin-bottom: 8px;">
                        动态挂载当前视口焦点楼层小说正文。可配置前缀、后缀并执行正则流水线裁剪。
                      </div>
                      <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                        <input 
                          v-model="item.prefix" 
                          class="regex-rule-input" 
                          style="flex: 1;" 
                          placeholder="前缀引导词，如：【小说原文】"
                          @change="handleSavePresetChanges"
                        />
                      </div>

                      <!-- 正则裁剪规则展开/收起 -->
                      <button 
                        class="igs-btn igs-btn-secondary" 
                        style="padding: 4px 10px; font-size: 0.8rem;"
                        @click="showRegexPanel = !showRegexPanel"
                      >
                        <i class="fa-solid" :class="showRegexPanel ? 'fa-chevron-up' : 'fa-filter'"></i>
                        <span>{{ showRegexPanel ? '收起正则' : '正则裁剪' }}</span>
                      </button>

                      <div v-if="showRegexPanel" class="regex-panel-box">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                          <span style="font-weight: 600; font-size: 0.82rem; color: var(--igs-settings-accent);">
                            <i class="fa-solid fa-scissors"></i> 顺序执行正则替换
                          </span>
                          <button class="igs-btn igs-btn-secondary" style="padding: 2px 8px; font-size: 0.75rem;" @click="handleAddRegexRule">
                            <i class="fa-solid fa-plus"></i> 新增
                          </button>
                        </div>

                        <div class="regex-rules-list">
                          <div 
                            v-for="(rule, rIdx) in preset.floorRegexRules" 
                            :key="rule.id"
                            class="regex-rule-item"
                          >
                            <input type="checkbox" v-model="rule.enabled" @change="handleSavePresetChanges" />
                            <input 
                              v-model="rule.name" 
                              class="regex-rule-input" 
                              style="width: 100px;" 
                              placeholder="规则名称"
                              @change="handleSavePresetChanges"
                            />
                            <input 
                              v-model="rule.pattern" 
                              class="regex-rule-input" 
                              style="flex: 2; min-width: 140px;" 
                              placeholder="匹配表达式"
                              @change="handleSavePresetChanges"
                            />
                            <input 
                              v-model="rule.replacement" 
                              class="regex-rule-input" 
                              style="flex: 1; min-width: 80px;" 
                              placeholder="替换内容"
                              @change="handleSavePresetChanges"
                            />
                            <button 
                              class="mini-icon-btn btn-danger" 
                              title="删除正则"
                              @click="handleDeleteRegexRule(rIdx)"
                            >
                              <i class="fa-solid fa-xmark"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 自定义提示词文本 (仅保留 textarea，无重复按钮) -->
                    <div v-else>
                      <textarea 
                        v-model="item.content"
                        class="preset-textarea"
                        placeholder="输入提示词内容..."
                        @change="handleSavePresetChanges"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 副模型状态 -->
              <h3 class="section-title" style="margin-top: 24px;">副模型状态</h3>
              <p class="section-desc">复用主扩展配置的副模型接口，专职负责将小说改写为演出剧本。</p>

              <div class="status-card">
                <div class="llm-info-grid">
                  <div class="llm-info-item">
                    <span class="info-label">接口来源：</span>
                    <span class="info-val">{{ secondaryLlmConfig.source === 'openai' ? '独立 OpenAI 兼容接口' : '酒馆原生桥接' }}</span>
                  </div>
                  <div class="llm-info-item">
                    <span class="info-label">模型标识：</span>
                    <span class="info-val">{{ secondaryLlmConfig.model || '默认' }}</span>
                  </div>
                  <div v-if="secondaryLlmConfig.endpoint" class="llm-info-item" style="grid-column: 1 / -1;">
                    <span class="info-label">端点地址：</span>
                    <span class="info-val code-text">{{ secondaryLlmConfig.endpoint }}</span>
                  </div>
                </div>

                <div class="llm-action-row">
                  <button 
                    class="igs-btn igs-btn-secondary" 
                    :disabled="llmTesting"
                    @click="handleTestLlm"
                  >
                    <i class="fa-solid" :class="llmTesting ? 'fa-spinner fa-spin' : 'fa-network-wired'"></i>
                    <span>{{ llmTesting ? '正在测试' : '测试连接' }}</span>
                  </button>

                  <span v-if="llmTestResult" class="test-result-tag" :class="llmTestResult.ok ? 'res-ok' : 'res-err'">
                    <i class="fa-solid" :class="llmTestResult.ok ? 'fa-check' : 'fa-xmark'"></i>
                    <span>{{ llmTestResult.ok ? '连通正常 ' + llmTestResult.latency + ' ms' : '连接失败: ' + llmTestResult.error }}</span>
                  </span>
                </div>
              </div>
            </section>

            <!-- 板块: 生图引擎与实时诊断 -->
            <section v-if="activeTab === 'imageGen'" class="igs-patch-section">
              <h3 class="section-title">生图引擎与实时诊断</h3>
              <p class="section-desc">
                解决生图失败与未就绪问题。支持通过通用 OpenAI/SiliconFlow 绘图接口 (推荐 FLUX/SDXL)、NovelAI 原生接口或酒馆插件 (柏宝绘/智绘姬) 出图。
              </p>

              <!-- 状态检测看板 -->
              <div class="status-card" style="margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                  <span style="font-weight: 700; font-size: 1rem; color: var(--igs-settings-ink);">后端就绪看板</span>
                  <button class="igs-btn igs-btn-secondary" style="padding: 4px 10px; font-size: 0.82rem;" @click="refreshImageBackends">
                    <i class="fa-solid fa-arrows-rotate"></i>
                    <span>重新检测</span>
                  </button>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                  <div style="background: var(--igs-settings-field); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--igs-settings-line);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                      <i class="fa-solid" :class="imageBackends.customApi.configured ? 'fa-circle-check status-badge-ok' : 'fa-circle-xmark status-badge-err'"></i>
                      <strong style="font-size: 0.9rem;">通用绘图 API</strong>
                    </div>
                    <div style="font-size: 0.78rem; color: var(--igs-settings-muted);">{{ imageBackends.customApi.detail }}</div>
                  </div>

                  <div style="background: var(--igs-settings-field); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--igs-settings-line);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                      <i class="fa-solid" :class="imageBackends.baibai.configured ? 'fa-circle-check status-badge-ok' : (imageBackends.baibai.detected ? 'fa-circle-exclamation status-badge-warn' : 'fa-circle-xmark status-badge-err')"></i>
                      <strong style="font-size: 0.9rem;">柏宝绘插件</strong>
                    </div>
                    <div style="font-size: 0.78rem; color: var(--igs-settings-muted);">{{ imageBackends.baibai.detail }}</div>
                  </div>

                  <div style="background: var(--igs-settings-field); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--igs-settings-line);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                      <i class="fa-solid" :class="imageBackends.nai.configured ? 'fa-circle-check status-badge-ok' : 'fa-circle-xmark status-badge-err'"></i>
                      <strong style="font-size: 0.9rem;">NovelAI 接口</strong>
                    </div>
                    <div style="font-size: 0.78rem; color: var(--igs-settings-muted);">{{ imageBackends.nai.detail }}</div>
                  </div>

                  <div style="background: var(--igs-settings-field); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--igs-settings-line);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                      <i class="fa-solid" :class="imageBackends.extension.configured ? 'fa-circle-check status-badge-ok' : 'fa-circle-xmark status-badge-err'"></i>
                      <strong style="font-size: 0.9rem;">智绘姬/原生扩展</strong>
                    </div>
                    <div style="font-size: 0.78rem; color: var(--igs-settings-muted);">{{ imageBackends.extension.detail }}</div>
                  </div>
                </div>
              </div>

              <!-- 调度模式首选项 -->
              <div class="setting-card">
                <div class="setting-row">
                  <div class="setting-info">
                    <span class="setting-title">出图调度策略</span>
                    <span class="setting-desc">当点击「确认生图」或补全素材时，优先采用哪种方式出图</span>
                  </div>
                  <select class="form-select" v-model="imageConfig.provider" @change="handleSaveImageConfig" style="width: 240px;">
                    <option value="auto">自动优先 (通用API / 柏宝绘 / 原生)</option>
                    <option value="custom">仅使用 自定义通用绘图 API</option>
                    <option value="baibai">仅使用 柏宝绘 (STBaiBaiImage)</option>
                    <option value="nai">仅使用 NovelAI 官方接口</option>
                  </select>
                </div>
              </div>

              <!-- 自定义通用绘图 API (SiliconFlow / FLUX / SDXL / OpenAI 等) -->
              <div class="setting-card">
                <h4 style="margin: 0 0 10px 0; font-size: 0.98rem; color: var(--igs-settings-ink);">
                  <i class="fa-solid fa-server" style="color: var(--igs-settings-accent); margin-right: 8px;"></i>
                  自定义通用绘图 API (兼容 OpenAI / 硅基流动 SiliconFlow / WebUI)
                </h4>
                <p style="font-size: 0.82rem; color: var(--igs-settings-muted); margin: 0 0 14px 0;">
                  支持标准的 <code>/v1/images/generations</code> 格式。例如使用硅基流动 SiliconFlow 提供的免费/低价 FLUX 或 SDXL 模型，无需额外安装本地 SD 也能急速出图。
                </p>

                <div class="form-group">
                  <label class="form-label">接口地址 (Endpoint URL)</label>
                  <input type="text" class="form-input" v-model="imageConfig.customApi.endpoint" placeholder="https://api.siliconflow.cn/v1/images/generations" />
                </div>

                <div class="form-group">
                  <label class="form-label">API Key</label>
                  <div style="display: flex; gap: 8px;">
                    <input :type="showCustomApiKey ? 'text' : 'password'" class="form-input" v-model="imageConfig.customApi.apiKey" placeholder="sk-..." />
                    <button class="igs-btn igs-btn-secondary" style="padding: 0 12px;" @click="showCustomApiKey = !showCustomApiKey">
                      <i class="fa-solid" :class="showCustomApiKey ? 'fa-eye-slash' : 'fa-eye'"></i>
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">生图模型 (Model Name)</label>
                  <div style="display: flex; gap: 8px;">
                    <input type="text" class="form-input" v-model="imageConfig.customApi.model" placeholder="black-forest-labs/FLUX.1-schnell" />
                    <select class="form-select" style="width: 220px;" @change="imageConfig.customApi.model = $event.target.value">
                      <option value="">-- 快速填入推荐模型 --</option>
                      <option value="black-forest-labs/FLUX.1-schnell">FLUX.1-schnell (极速/高质)</option>
                      <option value="black-forest-labs/FLUX.1-dev">FLUX.1-dev (顶尖画质)</option>
                      <option value="stabilityai/stable-diffusion-3-5-large">SD 3.5 Large</option>
                      <option value="stabilityai/stable-diffusion-xl-base-1.0">SDXL 1.0</option>
                      <option value="dall-e-3">OpenAI DALL-E 3</option>
                    </select>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap;">
                  <button class="igs-btn igs-btn-primary" @click="handleSaveImageConfig">
                    <i class="fa-solid fa-floppy-disk"></i>
                    <span>保存配置</span>
                  </button>
                  <button class="igs-btn igs-btn-secondary" :disabled="imageTesting" @click="handleTestImageApi">
                    <i class="fa-solid" :class="imageTesting ? 'fa-spinner fa-spin' : 'fa-plug'"></i>
                    <span>{{ imageTesting ? '正在测试...' : '测试生图连接' }}</span>
                  </button>
                  <span v-if="imageTestResult" class="test-result-tag" :class="imageTestResult.ok ? 'res-ok' : 'res-err'">
                    <i class="fa-solid" :class="imageTestResult.ok ? 'fa-check' : 'fa-xmark'"></i>
                    <span>{{ imageTestResult.message }}</span>
                  </span>
                </div>
              </div>

              <!-- NovelAI 官方接口凭据 -->
              <div class="setting-card">
                <h4 style="margin: 0 0 10px 0; font-size: 0.98rem; color: var(--igs-settings-ink);">
                  <i class="fa-solid fa-key" style="color: var(--igs-settings-accent); margin-right: 8px;"></i>
                  NovelAI 官方接口凭据 (自动双向同步 IGS 原生配置)
                </h4>
                <p style="font-size: 0.82rem; color: var(--igs-settings-muted); margin: 0 0 14px 0;">
                  填入您的 NovelAI 官方 API Key。保存后将自动深度同步至原生 IGS bridge 配置，使原生阅读器补全与 Vue 界面生图同时生效。
                </p>

                <div class="form-group">
                  <label class="form-label">NovelAI API Key</label>
                  <div style="display: flex; gap: 8px;">
                    <input :type="showNaiApiKey ? 'text' : 'password'" class="form-input" v-model="imageConfig.nai.apiKey" placeholder="pst-..." />
                    <button class="igs-btn igs-btn-secondary" style="padding: 0 12px;" @click="showNaiApiKey = !showNaiApiKey">
                      <i class="fa-solid" :class="showNaiApiKey ? 'fa-eye-slash' : 'fa-eye'"></i>
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">NovelAI 模型</label>
                  <select class="form-select" v-model="imageConfig.nai.model">
                    <option value="nai-diffusion-4-curated-preview">NAI Diffusion V4 Curated (最新V4动漫)</option>
                    <option value="nai-diffusion-4-full">NAI Diffusion V4 Full (完整版)</option>
                    <option value="nai-diffusion-3">NAI Diffusion V3 (动漫V3)</option>
                    <option value="nai-diffusion-furry-3">NAI Furry V3 (兽人)</option>
                  </select>
                </div>

                <div style="margin-top: 14px;">
                  <button class="igs-btn igs-btn-primary" @click="handleSaveImageConfig">
                    <i class="fa-solid fa-floppy-disk"></i>
                    <span>保存并同步至 IGS</span>
                  </button>
                </div>
              </div>
            </section>

            <!-- 板块: 柏宝绘画风预设联动 -->
            <section v-if="activeTab === 'artist'" class="igs-patch-section">
              <h3 class="section-title">生图画风联动</h3>
              <p class="section-desc">
                联动柏宝绘内部画风预设库，为不同资产类别独立指定调用的预设；可在各分类中单独指定预设与微调词。
              </p>

              <!-- 状态与全局控制卡片 -->
              <div class="status-card">
                <div class="interceptor-status-row">
                  <span :class="isBaibaiDetected ? 'status-badge-ok' : 'status-badge-warn'">
                    <i class="fa-solid" :class="isBaibaiDetected ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
                    <span>{{ isBaibaiDetected ? '柏宝绘接口已连接' : '等待柏宝绘接口挂载' }}</span>
                  </span>
                  <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 600;">
                    <input type="checkbox" v-model="baibaiConfig.enabled" @change="handleSaveBaibaiConfig" />
                    <span>启用预设联动</span>
                  </label>
                </div>

                <div style="font-size: 0.82rem; color: var(--igs-settings-muted); line-height: 1.5; margin-top: 8px;">
                  推荐在柏宝绘全局设置中将画师串设为未选择，即可由本系统按场景独立分流调度。
                </div>

                <div class="artist-toolbar-actions">
                  <button class="igs-btn igs-btn-primary" @click="handleRefreshPresets">
                    <i class="fa-solid fa-arrows-rotate"></i>
                    <span>刷新</span>
                  </button>

                  <button class="igs-btn igs-btn-secondary" @click="handleResetAllToFollow">
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>重置跟随</span>
                  </button>
                </div>
              </div>

              <!-- 分区卡片列表 -->
              <div class="artist-kind-list">
                <div 
                  v-for="kind in baibaiKinds" 
                  :key="kind.id"
                  class="preset-item-card"
                  :class="{ 'is-disabled': baibaiConfig.kinds[kind.id] && !baibaiConfig.kinds[kind.id].enabled }"
                >
                  <div class="preset-item-header" @click="toggleArtistKindCollapse(kind.id)">
                    <div class="item-header-left">
                      <!-- 折叠指示手柄 -->
                      <i class="fa-solid collapse-toggle-icon" :class="isArtistKindExpanded(kind.id) ? 'fa-chevron-down' : 'fa-chevron-right'"></i>

                      <!-- 类别图标 -->
                      <span class="role-cycle-btn" style="cursor: default;">
                        <i class="fa-solid" :class="kind.icon"></i>
                      </span>

                      <!-- 类别名称 -->
                      <span class="item-name-input" style="cursor: pointer;">
                        {{ kind.label }}
                      </span>

                      <!-- 绑定的预设名称徽标 -->
                      <span class="item-slot-badge">
                        {{ getPresetDisplayName(baibaiConfig.kinds[kind.id]?.presetId) }}
                      </span>
                    </div>

                    <div class="item-header-actions">
                      <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; cursor: pointer;" @click.stop>
                        <input type="checkbox" v-model="baibaiConfig.kinds[kind.id].enabled" @change="handleSaveBaibaiConfig" />
                        <span>启用</span>
                      </label>
                    </div>
                  </div>

                  <!-- 展开后的预设绑定与详情区 -->
                  <div v-if="isArtistKindExpanded(kind.id)" class="preset-item-content">
                    <div class="artist-fields-container">
                      <!-- 预设选择下拉框 -->
                      <div class="artist-field-block">
                        <div class="artist-field-label-row">
                          <span>
                            <i class="fa-solid fa-palette" style="color: var(--igs-settings-accent);"></i>
                            绑定柏宝绘预设
                          </span>
                        </div>
                        <select 
                          v-model="baibaiConfig.kinds[kind.id].presetId"
                          class="igs-select-input"
                          @change="handleSaveBaibaiConfig"
                        >
                          <option value="follow">跟随柏宝绘当前设置</option>
                          <option value="none">不使用画师串 - 纯净画面</option>
                          <option v-for="preset in availablePresets" :key="preset.id" :value="preset.id">
                            {{ preset.name }}{{ preset.desc ? ' - ' + preset.desc : '' }}
                          </option>
                        </select>
                      </div>

                      <!-- 预设详情与标签预览 -->
                      <div v-if="getPresetDetails(baibaiConfig.kinds[kind.id]?.presetId)" class="preset-preview-box">
                        <div class="preset-preview-row">
                          <span class="preview-tag-title">正向画师词</span>
                          <span class="preview-tag-content">{{ getPresetDetails(baibaiConfig.kinds[kind.id]?.presetId)?.prompt || '无' }}</span>
                        </div>
                        <div v-if="getPresetDetails(baibaiConfig.kinds[kind.id]?.presetId)?.negative" class="preset-preview-row">
                          <span class="preview-tag-title">负向过滤词</span>
                          <span class="preview-tag-content">{{ getPresetDetails(baibaiConfig.kinds[kind.id]?.presetId)?.negative }}</span>
                        </div>
                      </div>

                      <!-- 附加专属微调词折叠区 -->
                      <details class="artist-extra-details">
                        <summary class="artist-extra-summary">
                          <i class="fa-solid fa-plus-minus"></i>
                          <span>附加微调专属词</span>
                        </summary>
                        <div class="artist-fields-container" style="margin-top: 10px;">
                          <div class="artist-field-block">
                            <div class="artist-field-label-row">
                              <span>
                                <i class="fa-solid fa-plus" style="color: var(--igs-settings-accent);"></i>
                                正向微调词
                              </span>
                              <button 
                                class="mini-icon-btn" 
                                title="全屏编辑正向微调词"
                                @click="handleOpenArtistEditor(kind.id, 'extraPositive', '正向微调词')"
                              >
                                <i class="fa-solid fa-expand" style="pointer-events: none;"></i>
                              </button>
                            </div>
                            <textarea 
                              v-model="baibaiConfig.kinds[kind.id].extraPositive"
                              class="artist-textarea"
                              placeholder="选定预设之外额外追加的正向词，例如：chibi, dynamic angle..."
                              @change="handleSaveBaibaiConfig"
                            ></textarea>
                          </div>

                          <div class="artist-field-block">
                            <div class="artist-field-label-row">
                              <span>
                                <i class="fa-solid fa-minus" style="color: var(--igs-settings-danger);"></i>
                                负向微调词
                              </span>
                              <button 
                                class="mini-icon-btn" 
                                title="全屏编辑负向微调词"
                                @click="handleOpenArtistEditor(kind.id, 'extraNegative', '负向微调词')"
                              >
                                <i class="fa-solid fa-expand" style="pointer-events: none;"></i>
                              </button>
                            </div>
                            <textarea 
                              v-model="baibaiConfig.kinds[kind.id].extraNegative"
                              class="artist-textarea"
                              placeholder="选定预设之外额外追加的负向词，例如：bad hands, lowres..."
                              @change="handleSaveBaibaiConfig"
                            ></textarea>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- 板块 3: 数据管理 -->
            <section v-if="activeTab === 'data'" class="igs-patch-section">
              <h3 class="section-title">数据管理</h3>
              <p class="section-desc">管理数据库源联动、状态栏映射规则与演出剧本缓存。</p>

              <!-- 柏宝书虚拟数据库联动卡片 -->
              <div class="status-card" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px;">
                  <div>
                    <h4 class="item-title">
                      <i class="fa-solid fa-book" style="color: var(--igs-settings-accent); margin-right: 6px;"></i>
                      数据库源 - 柏宝书联动
                    </h4>
                    <p class="item-desc">底层数据库已接入柏宝书，提供角色档案、服装线索、场景时空与纯数值仪表盘。</p>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="status-badge" :class="isBaiBaiBookDetected ? 'status-connected' : 'status-disconnected'">
                      <i class="fa-solid" :class="isBaiBaiBookDetected ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
                      <span>{{ isBaiBaiBookDetected ? '柏宝书接口已就绪' : '等待柏宝书挂载' }}</span>
                    </span>
                    <button class="mini-icon-btn" title="刷新状态" @click="refreshBaiBaiBookInfo">
                      <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                  </div>
                </div>

                <div style="font-size: 13px; color: var(--igs-settings-text-muted); line-height: 1.6; margin-bottom: 10px;">
                  <i class="fa-solid fa-filter" style="margin-right: 4px;"></i>
                  状态栏数值过滤：已开启纯数值白名单，仅允许数字与比例格式映射到状态栏，自动排除剧情陈述句。
                </div>

                <!-- 过滤提取出的变量预览 -->
                <div v-if="detectedNumericVars.length" style="background: rgba(0,0,0,0.03); border: 1px solid var(--igs-settings-border); border-radius: 6px; padding: 10px;">
                  <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px; color: var(--igs-settings-text);">
                    当前映射到状态栏的数值变量：
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <span v-for="v in detectedNumericVars" :key="v.path" style="background: var(--igs-settings-card-bg); border: 1px solid var(--igs-settings-border); border-radius: 4px; padding: 2px 8px; font-size: 12px;">
                      <strong>{{ v.label }}</strong>: {{ v.value }}
                    </span>
                  </div>
                </div>
                <div v-else style="font-size: 12px; color: var(--igs-settings-text-muted); font-style: italic;">
                  当前尚未检测到数值变量或未载入聊天。
                </div>
              </div>

              <div class="status-card">
                <div class="danger-zone-item">
                  <div>
                    <h4 class="item-title">清空当前楼层演出剧本</h4>
                    <p class="item-desc">仅删除当前楼层活跃分支的转译剧本，重置为未制作状态。</p>
                  </div>
                  <button class="igs-btn igs-btn-secondary" @click="handleResetCurrentFloor">
                    <i class="fa-solid fa-trash-can"></i>
                    <span>清空当前楼层</span>
                  </button>
                </div>

                <div class="danger-zone-divider"></div>

                <div class="danger-zone-item">
                  <div>
                    <h4 class="item-title" style="color: var(--igs-settings-danger);">重置一切</h4>
                    <p class="item-desc">彻底清除全部角色立绘、全聊天演出剧本、生图图库、数据库及所有本地缓存。重置后恢复至纯净初始状态。</p>
                  </div>
                  <button class="igs-btn igs-btn-danger" @click="handleFullReset">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>重置一切</span>
                  </button>
                </div>
              </div>
            </section>

            <!-- 板块 4: 关于补丁 -->
            <section v-if="activeTab === 'about'" class="igs-patch-section">
              <h3 class="section-title">关于</h3>
              <div class="status-card">
                <p><strong>版本信息：</strong>v2.0</p>
                <p><strong>核心架构：</strong></p>
                <ul style="padding-left: 20px; line-height: 1.8;">
                  <li><strong>双轨渲染解耦：</strong> 主模型 0 提示词污染，专注生成小说；副模型根据截获的主脚本标签语法精准改编演出。</li>
                  <li><strong>高性能存储：</strong> 毫秒级本地键值缓存，跨会话秒级读写海量演出剧本。</li>
                  <li><strong>分支与楼层感知：</strong> 精确绑定每层楼与每次分支剧本，焦点楼层精准开播。</li>
                </ul>
              </div>
            </section>
          </main>
        </div>

        <!-- 二次确认弹窗 -->
        <div v-if="confirmDialog.visible" class="igs-patch-dialog-backdrop">
          <div class="igs-patch-dialog-box">
            <h4 class="dialog-title">{{ confirmDialog.title }}</h4>
            <p class="dialog-content">{{ confirmDialog.content }}</p>
            <div class="dialog-actions">
              <button class="igs-btn igs-btn-secondary" @click="confirmDialog.visible = false">取消</button>
              <button class="igs-btn igs-btn-danger" @click="confirmDialog.onConfirm">确认执行</button>
            </div>
          </div>
        </div>

        <!-- 全屏编辑面板 -->
        <div v-if="expandEditor.visible" class="igs-expanded-editor-panel">
          <div class="expanded-editor-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-pen-to-square" style="color: var(--igs-settings-accent);"></i>
              <span style="font-weight: 600; font-size: 1rem; color: var(--igs-settings-ink);">{{ expandEditor.title }}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="expanded-char-count">{{ expandEditor.content ? expandEditor.content.length : 0 }} 字符</span>
              <button class="igs-patch-btn-close" @click="handleCloseExpandEditor" title="关闭">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <div class="expanded-editor-body">
            <textarea 
              v-model="expandEditor.content"
              class="expanded-editor-textarea"
              placeholder="在此输入完整的提示词内容..."
            ></textarea>
            <div class="expanded-editor-actions">
              <button class="igs-btn igs-btn-secondary" @click="handleCloseExpandEditor">取消</button>
              <button class="igs-btn igs-btn-primary" @click="handleSaveExpandEditor">
                <i class="fa-solid fa-check"></i>
                <span>保存</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    `,
};
