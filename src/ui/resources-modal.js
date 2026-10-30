/**
 * 放映资源全屏控制台 (Vue 3 架构)
 * 极致空间利用与高颜值流线型设计：
 * 1. 响应式即时换肤：Vue 3 响应式追踪，一键秒切奶油风、浅色、地雷色、深色
 * 2. 深度主题色彩渗透：彻底修复输入框与文本域底色，完美融入当前主题
 * 3. 极简高效空间架构：合并多层冗余工具条，释放 75% 以上屏幕空间专供主体画幅与差分呈现
 * 4. 道具图鉴全面回归：提供完整道具图鉴网格、新增、下载、上传替换与删除
 * 5. 角色可切换式设计：横向药丸选择器，单角色深度聚焦，告别长列表堆叠
 * 6. 原生 IGS 全域资产覆盖：立绘、背景、衣柜、CG、道具、待确认六大板块
 * 
 * 规范：纯 FontAwesome 图标，严禁 Emoji；标题与按键严禁使用括号；极简按键风格
 */

import { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { patchState, setTheme, subscribeState, detectAndSyncIgsTheme } from '../state/state.js';
import { THEME_OPTIONS, generateThemeCssVariables } from './theme.js';
import { notifyToast } from './toast.js';
import { injectResourcesStyles } from './resources-styles.js';
import {
    getActiveCardScope,
    listCharacters,
    setCharacterHeight,
    setUserCharacter,
    saveCharacterOutfit,
    deleteCharacterOutfit,
    saveCharacterMood,
    deleteCharacterMood,
    listScenes,
    saveScene,
    deleteScene,
    saveSceneTime,
    deleteSceneTime,
    listWardrobe,
    saveWardrobeItem,
    deleteWardrobeItem,
    listAllCgs,
    toggleCgFavorite,
    toggleCgHidden,
    deleteCg,
    listItems,
    saveItem,
    deleteItem,
    listStagingAssets,
    acceptStagingAsset,
    discardStagingAsset,
    readFileAsDataUrl,
} from '../resources/asset-service.js';

export const isResourcesModalVisible = ref(false);

let appInstance = null;
let containerEl = null;

function getCandidateDocument() {
    try {
        if (window.parent && window.parent.document) return window.parent.document;
    } catch (_) { }
    try {
        if (window.top && window.top.document) return window.top.document;
    } catch (_) { }
    return document;
}

export function ensureResourcesMounted(targetDoc = null) {
    const doc = targetDoc || getCandidateDocument();
    if (!doc) return;

    injectResourcesStyles();

    let container = doc.getElementById('igs-patch-resources-modal-container');
    if (!container) {
        container = doc.createElement('div');
        container.id = 'igs-patch-resources-modal-container';
        (doc.body || doc.documentElement).appendChild(container);
    }
    containerEl = container;

    if (!appInstance) {
        try {
            appInstance = createApp(ResourcesModalRoot);
            appInstance.mount(containerEl);
            console.info('[IGS-Patch] 放映资源控制台 Vue 3 挂载成功。');
        } catch (err) {
            console.error('[IGS-Patch] 挂载 Vue 3 放映资源面板失败:', err);
        }
    } else if (containerEl && !doc.body.contains(containerEl)) {
        (doc.body || doc.documentElement).appendChild(containerEl);
    }
}

export function openResourcesModal(targetDoc = null) {
    console.info('[IGS-Patch] 正在呼出放映资源控制台...');
    injectResourcesStyles();
    detectAndSyncIgsTheme();
    ensureResourcesMounted(targetDoc);
    isResourcesModalVisible.value = true;
}

export function closeResourcesModal() {
    isResourcesModalVisible.value = false;
}

const ResourcesModalRoot = {
    setup() {
        const visible = isResourcesModalVisible;
        const activeTab = ref('characters');
        const searchQuery = ref('');
        const cgFilter = ref('all');
        const isLoading = ref(false);

        // 响应式主题状态 (彻底解决主题切换无效问题)
        const currentTheme = ref(patchState.theme || 'cream');
        const themeStyleVars = computed(() => {
            return generateThemeCssVariables(currentTheme.value);
        });

        const handleSetTheme = (themeName) => {
            currentTheme.value = themeName;
            setTheme(themeName);
        };

        // 作用域状态：全部 (all)、本卡 (card)、全局 (global)
        const scopeMode = ref('all');
        const activeCardScope = ref('');
        const scopeCounts = reactive({
            all: 0,
            card: 0,
            global: 0,
        });

        const characters = ref([]);
        const scenes = ref([]);
        const wardrobe = ref([]);
        const cgs = ref([]);
        const items = ref([]);
        const staging = ref([]);

        // 当前激活查看的角色名称（可切换式设计，告别平铺）
        const activeCharName = ref('');

        // 当前各个角色选中的服装 Tab
        const selectedOutfits = reactive({});

        // 全屏大图 Lightbox 状态
        const lightbox = reactive({
            visible: false,
            title: '',
            src: '',
            prompt: '',
            key: '',
            isFavorite: false,
            isHidden: false,
            isEventCg: false,
        });

        // 统一新增/编辑对话框
        const editDialog = reactive({
            visible: false,
            type: '', // 'char' | 'outfit' | 'mood' | 'scene' | 'sceneTime' | 'wardrobe' | 'item'
            title: '',
            parentName: '',
            secondaryName: '',
            form: {
                name: '',
                desc: '',
                character: '',
                prompt: '',
                scenesText: '',
                rawUrl: '',
            },
        });

        // 生图与提示词调试对话框
        const genDialog = reactive({
            visible: false,
            type: '', // 'mood' | 'cg' | 'scene' | 'item'
            title: '',
            charName: '',
            outfitName: '',
            moodName: '',
            prompt: '',
            negative: '',
            cgItem: null,
            isGenerating: false,
        });

        // 确认操作对话框
        const confirmDialog = reactive({
            visible: false,
            title: '',
            message: '',
            onConfirm: null,
        });

        // 隐藏的文件上传 input 引用目标
        const activeUploadTarget = reactive({
            type: '',
            charName: '',
            outfitName: '',
            moodName: '',
            sceneName: '',
            timeName: '',
            itemName: '',
        });

        const loadData = async () => {
            isLoading.value = true;
            try {
                activeCardScope.value = getActiveCardScope();

                // 并行统计全部、本卡、全局的数量
                const [charsAll, charsCard, charsGlobal] = await Promise.all([
                    listCharacters('all'),
                    listCharacters('card'),
                    listCharacters('global'),
                ]);

                scopeCounts.all = charsAll.length;
                scopeCounts.card = charsCard.length;
                scopeCounts.global = charsGlobal.length;

                // 按照当前作用域加载数据
                const curMode = scopeMode.value;
                const [curChars, curScenes, curWardrobe, curCgs, curItems, curStaging] = await Promise.all([
                    curMode === 'all' ? charsAll : (curMode === 'card' ? charsCard : charsGlobal),
                    listScenes(curMode),
                    listWardrobe(curMode),
                    listAllCgs(cgFilter.value),
                    listItems(curMode),
                    listStagingAssets(),
                ]);

                characters.value = curChars;
                scenes.value = curScenes;
                wardrobe.value = curWardrobe;
                cgs.value = curCgs;
                items.value = curItems;
                staging.value = curStaging;

                // 确保默认选中第一个角色
                if (curChars.length > 0) {
                    if (!activeCharName.value || !curChars.some(c => c.name === activeCharName.value)) {
                        activeCharName.value = curChars[0].name;
                    }
                } else {
                    activeCharName.value = '';
                }

                // 保证角色默认选中的服装初始化
                for (const c of curChars) {
                    if (!selectedOutfits[c.name]) {
                        selectedOutfits[c.name] = c.defaultOutfit || (c.outfits && c.outfits[0]?.name) || '';
                    }
                }
            } catch (err) {
                console.warn('[IGS-Patch] 加载素材异常:', err);
            } finally {
                isLoading.value = false;
            }
        };

        const setScope = (mode) => {
            scopeMode.value = mode;
            loadData();
        };

        // 当前选中的单一角色
        const activeCharacter = computed(() => {
            if (!characters.value.length) return null;
            const target = characters.value.find(c => c.name === activeCharName.value);
            return target || characters.value[0];
        });

        // 获取角色当前处于活动状态的服装对象
        const getCurrentOutfit = (charObj) => {
            if (!charObj || !charObj.outfits || !charObj.outfits.length) return null;
            const targetName = selectedOutfits[charObj.name] || charObj.defaultOutfit;
            const found = charObj.outfits.find(o => o.name === targetName);
            return found || charObj.outfits[0];
        };

        const filteredCharacters = computed(() => {
            const q = searchQuery.value.trim().toLowerCase();
            if (!q) return characters.value;
            return characters.value.filter(c => c.name.toLowerCase().includes(q));
        });

        const filteredScenes = computed(() => {
            const q = searchQuery.value.trim().toLowerCase();
            if (!q) return scenes.value;
            return scenes.value.filter(s => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
        });

        const filteredWardrobe = computed(() => {
            const q = searchQuery.value.trim().toLowerCase();
            if (!q) return wardrobe.value;
            return wardrobe.value.filter(w => w.name.toLowerCase().includes(q) || w.character.toLowerCase().includes(q) || w.prompt.toLowerCase().includes(q));
        });

        const filteredCgs = computed(() => {
            const q = searchQuery.value.trim().toLowerCase();
            if (!q) return cgs.value;
            return cgs.value.filter(c => c.label.toLowerCase().includes(q) || c.prompt.toLowerCase().includes(q));
        });

        const filteredItems = computed(() => {
            const q = searchQuery.value.trim().toLowerCase();
            if (!q) return items.value;
            return items.value.filter(i => i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
        });

        const filteredStaging = computed(() => {
            const q = searchQuery.value.trim().toLowerCase();
            if (!q) return staging.value;
            return staging.value.filter(s => s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q));
        });

        /* =================== Lightbox 查看器 =================== */
        const openLightbox = (title, src, prompt = '', meta = {}) => {
            if (!src) return;
            lightbox.title = title;
            lightbox.src = src;
            lightbox.prompt = prompt;
            lightbox.key = meta.key || '';
            lightbox.isFavorite = meta.isFavorite === true;
            lightbox.isHidden = meta.isHidden === true;
            lightbox.isEventCg = meta.isEventCg === true;
            lightbox.visible = true;
        };

        const closeLightbox = () => {
            lightbox.visible = false;
        };

        const handleDownloadImage = (src, title) => {
            if (!src) return;
            const a = document.createElement('a');
            a.href = src;
            a.download = `${title || 'image'}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            notifyToast('已开始下载', 'info');
        };

        const handleCopyPrompt = (prompt) => {
            if (!prompt) return;
            navigator.clipboard.writeText(prompt);
            notifyToast('提示词已复制', 'info');
        };

        /* =================== 角色与衣装属性操作 =================== */
        const handleSetHeight = (charObj, val) => {
            const num = parseInt(val, 10);
            if (isNaN(num) || num <= 0) return;
            charObj.height = num;
            setCharacterHeight(charObj.name, num, scopeMode.value);
            notifyToast(`基准高度已调整为 ${num}%`, 'info');
        };

        const handleToggleUser = (charObj) => {
            const nextState = !charObj.isUser;
            charObj.isUser = nextState;
            setUserCharacter(charObj.name, nextState, scopeMode.value);
            notifyToast(nextState ? `已设为主角身份` : `已取消主角身份`, 'info');
        };

        /* =================== 差分上传与快捷替换 =================== */
        const triggerDiffUpload = (charObj, outfitObj, moodObj) => {
            activeUploadTarget.type = 'mood';
            activeUploadTarget.charName = charObj.name;
            activeUploadTarget.outfitName = outfitObj.name;
            activeUploadTarget.moodName = moodObj.name;

            const input = document.getElementById('igs-patch-file-hidden-input');
            if (input) input.click();
        };

        const triggerItemUpload = (itemObj) => {
            activeUploadTarget.type = 'item';
            activeUploadTarget.itemName = itemObj.name;

            const input = document.getElementById('igs-patch-file-hidden-input');
            if (input) input.click();
        };

        const onHiddenFileChange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const dataUrl = await readFileAsDataUrl(file);
                if (activeUploadTarget.type === 'mood') {
                    saveCharacterMood(
                        activeUploadTarget.charName,
                        activeUploadTarget.moodName,
                        dataUrl,
                        activeUploadTarget.outfitName,
                        scopeMode.value
                    );
                    notifyToast('差分图片已替换', 'info');
                    await loadData();
                } else if (activeUploadTarget.type === 'item') {
                    saveItem(activeUploadTarget.itemName, dataUrl, '', scopeMode.value);
                    notifyToast('道具图标已更新', 'info');
                    await loadData();
                }
            } catch (_) {
                notifyToast('读取图片失败', 'error');
            } finally {
                e.target.value = '';
            }
        };

        /* =================== 生图与提示词对话框 =================== */
        const openGenPromptDialog = (type, charObj, outfitObj, targetObj) => {
            genDialog.type = type;
            genDialog.charName = charObj?.name || '';
            genDialog.outfitName = outfitObj?.name || '';
            genDialog.isGenerating = false;

            if (type === 'mood') {
                genDialog.moodName = targetObj?.name || '';
                genDialog.title = `${charObj.name} · ${targetObj.name}`;
                genDialog.prompt = targetObj.prompt || `${charObj.name}, ${outfitObj?.name || ''}, ${targetObj.name}`;
                genDialog.negative = '';
            } else if (type === 'cg') {
                genDialog.cgItem = targetObj;
                genDialog.title = targetObj.label || '剧情 CG';
                genDialog.prompt = targetObj.prompt || '';
                genDialog.negative = '';
            }

            genDialog.visible = true;
        };

        const handleExecuteGenerate = async () => {
            if (!genDialog.prompt.trim()) {
                notifyToast('提示词不能为空', 'warning');
                return;
            }

            genDialog.isGenerating = true;
            try {
                const baiBai = window.STBaiBaiImage || window.parent?.STBaiBaiImage;
                if (baiBai && typeof baiBai.generate === 'function') {
                    notifyToast('已向生图管线提交任务', 'info');
                    await baiBai.generate({
                        prompt: genDialog.prompt.trim(),
                        negative: genDialog.negative.trim(),
                        type: genDialog.type,
                    });
                    genDialog.visible = false;
                    await loadData();
                    return;
                }

                navigator.clipboard.writeText(genDialog.prompt.trim());
                notifyToast('生图提示词已复制到剪贴板', 'info');
                genDialog.visible = false;
            } catch (err) {
                notifyToast('提交生图异常', 'error');
            } finally {
                genDialog.isGenerating = false;
            }
        };

        /* =================== 新增与编辑资源 =================== */
        const handleTopAdd = () => {
            const typeMap = {
                characters: 'char',
                scenes: 'scene',
                wardrobe: 'wardrobe',
                items: 'item',
            };
            openAddDialog(typeMap[activeTab.value] || 'char', activeCharacter.value);
        };

        const openAddDialog = (type, parent = null, secondary = null) => {
            editDialog.type = type;
            editDialog.parentName = parent?.name || '';
            editDialog.secondaryName = secondary?.name || '';
            editDialog.form = {
                name: '',
                desc: '',
                character: parent?.name || '',
                prompt: '',
                scenesText: '',
                rawUrl: '',
            };

            const titleMap = {
                char: '新增角色立绘',
                outfit: `新增服装 - ${parent?.name}`,
                mood: `新增表情差分 - ${parent?.name}`,
                scene: '新增场景背景',
                sceneTime: `新增时段差分 - ${parent?.name}`,
                wardrobe: '新增换装衣柜',
                item: '新增道具图鉴',
            };
            editDialog.title = titleMap[type] || '新增资源';
            editDialog.visible = true;
        };

        const handleSaveEdit = async () => {
            const f = editDialog.form;
            if (!f.name.trim()) {
                notifyToast('名称不能为空', 'warning');
                return;
            }

            try {
                if (editDialog.type === 'char') {
                    saveCharacterMood(f.name.trim(), '默认', f.rawUrl.trim(), '初始衣装', scopeMode.value);
                    activeCharName.value = f.name.trim();
                } else if (editDialog.type === 'outfit') {
                    saveCharacterOutfit(editDialog.parentName, f.name.trim(), scopeMode.value);
                    selectedOutfits[editDialog.parentName] = f.name.trim();
                } else if (editDialog.type === 'mood') {
                    const outfit = editDialog.secondaryName || selectedOutfits[editDialog.parentName] || '初始衣装';
                    saveCharacterMood(editDialog.parentName, f.name.trim(), f.rawUrl.trim(), outfit, scopeMode.value);
                } else if (editDialog.type === 'scene') {
                    saveScene(f.name.trim(), f.rawUrl.trim(), f.desc.trim(), scopeMode.value);
                } else if (editDialog.type === 'sceneTime') {
                    saveSceneTime(editDialog.parentName, f.name.trim(), f.rawUrl.trim(), scopeMode.value);
                } else if (editDialog.type === 'wardrobe') {
                    saveWardrobeItem(f.name.trim(), f.rawUrl.trim(), f.prompt.trim(), f.character.trim(), scopeMode.value);
                } else if (editDialog.type === 'item') {
                    saveItem(f.name.trim(), f.rawUrl.trim(), f.desc.trim(), scopeMode.value);
                }

                notifyToast('保存成功', 'info');
                editDialog.visible = false;
                await loadData();
            } catch (err) {
                notifyToast('保存异常', 'error');
            }
        };

        const handleFormFileUpload = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const dataUrl = await readFileAsDataUrl(file);
                editDialog.form.rawUrl = dataUrl;
                notifyToast('图片载入就绪', 'info');
            } catch (_) {
                notifyToast('读取图片失败', 'error');
            }
        };

        /* =================== CG 收藏与隐藏 =================== */
        const handleCgFavorite = async (cg) => {
            const res = await toggleCgFavorite(cg.key, cg.isFavorite);
            if (res.ok) {
                cg.isFavorite = res.isFavorite;
                if (lightbox.visible && lightbox.key === cg.key) {
                    lightbox.isFavorite = res.isFavorite;
                }
                notifyToast(cg.isFavorite ? '已收藏' : '已取消收藏', 'info');
            }
        };

        const handleCgHidden = async (cg) => {
            const res = await toggleCgHidden(cg.key, cg.isHidden);
            if (res.ok) {
                cg.isHidden = res.isHidden;
                if (lightbox.visible && lightbox.key === cg.key) {
                    lightbox.isHidden = res.isHidden;
                }
                notifyToast(cg.isHidden ? '已隐藏' : '已取消隐藏', 'info');
                if (cgFilter.value === 'all' && cg.isHidden) {
                    cgs.value = cgs.value.filter(item => item.key !== cg.key);
                }
            }
        };

        /* =================== 删除动作 =================== */
        const triggerDelete = (title, message, action) => {
            confirmDialog.title = title;
            confirmDialog.message = message;
            confirmDialog.onConfirm = async () => {
                confirmDialog.visible = false;
                await action();
                await loadData();
                notifyToast('已删除', 'info');
            };
            confirmDialog.visible = true;
        };

        const handleDeleteCharacter = (charObj) => {
            triggerDelete('删除角色', `确定删除角色「${charObj.name}」及其全部衣装差分吗？`, () => {
                deleteCharacterOutfit(charObj.name, '', scopeMode.value);
            });
        };

        const handleDeleteOutfit = (charObj, outfitObj) => {
            triggerDelete('删除服装', `确定删除「${charObj.name}」的「${outfitObj.name}」吗？`, () => {
                deleteCharacterOutfit(charObj.name, outfitObj.name, scopeMode.value);
            });
        };

        const handleDeleteMood = (charName, moodName, outfitName) => {
            triggerDelete('删除差分', `确定删除表情差分「${moodName}」吗？`, () => {
                deleteCharacterMood(charName, moodName, outfitName, scopeMode.value);
            });
        };

        const handleDeleteScene = (sceneObj) => {
            triggerDelete('删除场景', `确定删除场景「${sceneObj.name}」及全部时段差分吗？`, () => {
                deleteScene(sceneObj.name, scopeMode.value);
            });
        };

        const handleDeleteSceneTime = (sceneName, timeName) => {
            triggerDelete('删除时段', `确定删除时段差分「${timeName}」吗？`, () => {
                deleteSceneTime(sceneName, timeName, scopeMode.value);
            });
        };

        const handleDeleteWardrobe = (item) => {
            triggerDelete('删除服装', `确定删除服装「${item.name}」吗？`, () => {
                deleteWardrobeItem(item.name, scopeMode.value);
            });
        };

        const handleDeleteCg = (cg) => {
            triggerDelete('删除CG', `确定删除此张 CG 图吗？此操作无法撤销。`, async () => {
                await deleteCg(cg.key, cg.isEventCg);
                if (lightbox.visible && lightbox.key === cg.key) {
                    closeLightbox();
                }
            });
        };

        const handleDeleteItem = (item) => {
            triggerDelete('删除道具', `确定删除道具「${item.name}」吗？`, () => {
                deleteItem(item.name, scopeMode.value);
            });
        };

        /* =================== 待确认素材入库 =================== */
        const handleAcceptStaging = async (stItem, targetType) => {
            const promptName = window.prompt('请输入入库名称：', stItem.name || '');
            if (!promptName) return;
            await acceptStagingAsset(stItem, promptName.trim(), targetType);
            await loadData();
            notifyToast('入库成功', 'info');
        };

        const handleDiscardStaging = async (stItem) => {
            await discardStagingAsset(stItem.key);
            staging.value = staging.value.filter(s => s.key !== stItem.key);
            notifyToast('已舍弃', 'info');
        };

        const setCgFilter = (mode) => {
            cgFilter.value = mode;
            loadData();
        };

        watch(visible, (isOpen) => {
            if (isOpen) {
                loadData();
            }
        });

        onMounted(() => {
            loadData();
            const unsub = subscribeState((s) => {
                if (s.theme && s.theme !== currentTheme.value) {
                    currentTheme.value = s.theme;
                }
            });

            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    if (lightbox.visible) {
                        closeLightbox();
                    } else if (genDialog.visible) {
                        genDialog.visible = false;
                    } else if (editDialog.visible) {
                        editDialog.visible = false;
                    } else if (confirmDialog.visible) {
                        confirmDialog.visible = false;
                    } else if (visible.value) {
                        closeResourcesModal();
                    }
                }
            };
            window.addEventListener('keydown', onKeyDown);
            onUnmounted(() => {
                window.removeEventListener('keydown', onKeyDown);
                unsub();
            });
        });

        return {
            visible,
            activeTab,
            searchQuery,
            cgFilter,
            isLoading,
            scopeMode,
            scopeCounts,
            activeCardScope,
            activeCharName,
            activeCharacter,
            selectedOutfits,
            currentTheme,
            themeOptions: THEME_OPTIONS,
            themeStyleVars,
            handleSetTheme,
            characters,
            scenes,
            wardrobe,
            cgs,
            items,
            staging,
            filteredCharacters,
            filteredScenes,
            filteredWardrobe,
            filteredCgs,
            filteredItems,
            filteredStaging,
            lightbox,
            openLightbox,
            closeLightbox,
            handleDownloadImage,
            handleCopyPrompt,
            handleSetHeight,
            handleToggleUser,
            getCurrentOutfit,
            triggerDiffUpload,
            triggerItemUpload,
            onHiddenFileChange,
            handleTopAdd,
            editDialog,
            openAddDialog,
            handleSaveEdit,
            handleFormFileUpload,
            genDialog,
            openGenPromptDialog,
            handleExecuteGenerate,
            confirmDialog,
            handleCgFavorite,
            handleCgHidden,
            handleDeleteCharacter,
            handleDeleteOutfit,
            handleDeleteMood,
            handleDeleteScene,
            handleDeleteSceneTime,
            handleDeleteWardrobe,
            handleDeleteCg,
            handleDeleteItem,
            handleAcceptStaging,
            handleDiscardStaging,
            setScope,
            setCgFilter,
            loadData,
            close: closeResourcesModal,
        };
    },

    template: `
    <div v-if="visible" class="igs-resources-overlay" :style="themeStyleVars" @click.self="close">
      <div class="igs-resources-window">
        <!-- 紧凑单行整合顶栏 -->
        <header class="igs-resources-header">
          <div class="igs-resources-title-row">
            <h2 class="igs-resources-title">
              <i class="fa-solid fa-photo-film" style="color: var(--igs-settings-accent); font-size: 15px;"></i>
              <span>放映资源</span>
            </h2>
          </div>

          <!-- 紧凑搜索框 -->
          <div class="igs-resources-header-tools">
            <div class="igs-resources-search-box">
              <i class="fa-solid fa-magnifying-glass" style="color: var(--igs-settings-ink-3); font-size: 11px;"></i>
              <input 
                v-model="searchQuery" 
                class="igs-resources-search-input" 
                placeholder="搜索资源..." 
              />
              <i v-if="searchQuery" class="fa-solid fa-xmark" style="font-size: 11px; cursor: pointer;" @click="searchQuery = ''"></i>
            </div>
          </div>

          <!-- 顶部右侧工具按钮 -->
          <div class="igs-resources-header-actions">
            <button 
              v-if="activeTab !== 'cgs' && activeTab !== 'review'" 
              class="igs-btn-primary-compact" 
              @click="handleTopAdd"
            >
              <i class="fa-solid fa-plus"></i>
              <span>新增</span>
            </button>

            <button class="igs-btn-icon-round" title="刷新列表" @click="loadData">
              <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': isLoading }"></i>
            </button>

            <!-- 主题切换：Vue 3 响应式实时更新 -->
            <div class="igs-patch-theme-group">
              <button 
                v-for="item in themeOptions" 
                :key="item.value" 
                class="igs-patch-theme-swatch"
                :class="{ 'is-active': currentTheme === item.value }"
                :title="item.label"
                :style="{ backgroundColor: item.swatch.accent, borderColor: item.swatch.base }"
                @click="handleSetTheme(item.value)"
              ></button>
            </div>

            <button class="igs-btn-icon-round" title="关闭" @click="close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        <!-- 导航与作用域一体化组合条 (极大节省空间) -->
        <div class="igs-nav-scope-bar">
          <div class="igs-nav-chips">
            <button 
              class="igs-nav-chip-btn" 
              :class="{ 'is-active': activeTab === 'characters' }" 
              @click="activeTab = 'characters'"
            >
              <i class="fa-solid fa-person"></i>
              <span>立绘</span>
              <span class="igs-nav-badge">{{ characters.length }}</span>
            </button>

            <button 
              class="igs-nav-chip-btn" 
              :class="{ 'is-active': activeTab === 'scenes' }" 
              @click="activeTab = 'scenes'"
            >
              <i class="fa-solid fa-image"></i>
              <span>背景</span>
              <span class="igs-nav-badge">{{ scenes.length }}</span>
            </button>

            <button 
              class="igs-nav-chip-btn" 
              :class="{ 'is-active': activeTab === 'wardrobe' }" 
              @click="activeTab = 'wardrobe'"
            >
              <i class="fa-solid fa-shirt"></i>
              <span>衣柜</span>
              <span class="igs-nav-badge">{{ wardrobe.length }}</span>
            </button>

            <button 
              class="igs-nav-chip-btn" 
              :class="{ 'is-active': activeTab === 'cgs' }" 
              @click="activeTab = 'cgs'"
            >
              <i class="fa-solid fa-film"></i>
              <span>CG</span>
              <span class="igs-nav-badge">{{ cgs.length }}</span>
            </button>

            <button 
              class="igs-nav-chip-btn" 
              :class="{ 'is-active': activeTab === 'items' }" 
              @click="activeTab = 'items'"
            >
              <i class="fa-solid fa-cube"></i>
              <span>道具</span>
              <span class="igs-nav-badge">{{ items.length }}</span>
            </button>

            <button 
              class="igs-nav-chip-btn" 
              :class="{ 'is-active': activeTab === 'review' }" 
              @click="activeTab = 'review'"
            >
              <i class="fa-solid fa-inbox"></i>
              <span>待确认</span>
              <span v-if="staging.length" class="igs-nav-badge" style="background: var(--igs-settings-accent); color: #111;">{{ staging.length }}</span>
            </button>
          </div>

          <!-- 右侧紧凑分段作用域切换 -->
          <div v-if="activeTab !== 'cgs' && activeTab !== 'review'" class="igs-scope-segmented">
            <button class="igs-scope-seg-opt" :class="{ 'is-active': scopeMode === 'all' }" @click="setScope('all')">
              <span>全部</span>
              <span style="opacity: 0.75; font-size: 10px;">{{ scopeCounts.all }}</span>
            </button>
            <button class="igs-scope-seg-opt" :class="{ 'is-active': scopeMode === 'card' }" @click="setScope('card')">
              <span>本卡</span>
              <span style="opacity: 0.75; font-size: 10px;">{{ scopeCounts.card }}</span>
            </button>
            <button class="igs-scope-seg-opt" :class="{ 'is-active': scopeMode === 'global' }" @click="setScope('global')">
              <span>全局</span>
              <span style="opacity: 0.75; font-size: 10px;">{{ scopeCounts.global }}</span>
            </button>
          </div>
        </div>

        <!-- 立绘模式：整合角色横向栏与属性工具 -->
        <div v-if="activeTab === 'characters' && filteredCharacters.length" class="igs-char-unified-bar">
          <div class="igs-char-pills-list">
            <button 
              v-for="c in filteredCharacters" 
              :key="c.name" 
              class="igs-char-pill-btn" 
              :class="{ 'is-active': activeCharName === c.name }"
              @click="activeCharName = c.name"
            >
              <img v-if="c.baseResolvedUrl || c.baseRawUrl" :src="c.baseResolvedUrl || c.baseRawUrl" class="igs-char-tab-avatar" />
              <i v-else class="fa-solid fa-user" style="font-size: 10px;"></i>
              <span>{{ c.name }}</span>
            </button>

            <button class="igs-char-add-tab-btn" @click="openAddDialog('char')">
              <i class="fa-solid fa-plus"></i>
              <span>角色</span>
            </button>
          </div>

          <!-- 角色右侧元数据工具：User身份切换、高度调整、删除 -->
          <div v-if="activeCharacter" class="igs-char-meta-tools">
            <span 
              class="igs-char-user-badge" 
              :style="{ opacity: activeCharacter.isUser ? 1 : 0.4 }"
              title="点击切换主角身份"
              @click="handleToggleUser(activeCharacter)"
            >User</span>

            <div class="igs-char-compact-height">
              <span>高度</span>
              <input 
                type="number" 
                :value="activeCharacter.height || 100" 
                @change="e => handleSetHeight(activeCharacter, e.target.value)" 
              />
              <span>%</span>
            </div>

            <button class="igs-diff-act-btn" style="width: 24px; height: 24px; font-size: 11px;" title="删除角色" @click="handleDeleteCharacter(activeCharacter)">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>

        <!-- 立绘模式：服装横向切换栏 -->
        <div v-if="activeTab === 'characters' && activeCharacter" class="igs-outfits-unified-bar">
          <div style="display: flex; align-items: center; gap: 6px; overflow-x: auto; flex: 1; scrollbar-width: none;">
            <button 
              v-for="outfit in activeCharacter.outfits" 
              :key="outfit.name" 
              class="igs-outfit-tab-btn" 
              :class="{ 'is-active': (selectedOutfits[activeCharacter.name] || activeCharacter.defaultOutfit || activeCharacter.outfits[0]?.name) === outfit.name }"
              @click="selectedOutfits[activeCharacter.name] = outfit.name"
            >
              <span>{{ outfit.name }}</span>
              <span v-if="outfit.isDefault" class="igs-outfit-default-tag">默认</span>
              <span style="opacity: 0.65; font-size: 11px;">{{ outfit.moodCount }}</span>
            </button>
          </div>

          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <button class="igs-outfit-action-btn" title="新增服装" @click="openAddDialog('outfit', activeCharacter)">
              <i class="fa-solid fa-plus"></i>
              <span>服装</span>
            </button>
            <button class="igs-outfit-action-btn" title="新增差分" @click="openAddDialog('mood', activeCharacter, getCurrentOutfit(activeCharacter))">
              <i class="fa-solid fa-plus"></i>
              <span>差分</span>
            </button>
          </div>
        </div>

        <!-- 主内容全屏网格视口 (释放 75% 垂直空间) -->
        <main class="igs-resources-content">
          <!-- 1. 立绘差分多列网格 (大图优先) -->
          <section v-if="activeTab === 'characters'">
            <div v-if="activeCharacter && getCurrentOutfit(activeCharacter) && getCurrentOutfit(activeCharacter).moods && getCurrentOutfit(activeCharacter).moods.length" class="igs-char-diffs-grid">
              <div v-for="m in getCurrentOutfit(activeCharacter).moods" :key="m.name" class="igs-diff-card">
                <div class="igs-diff-card-thumb" @click="openLightbox(activeCharacter.name + ' · ' + m.name, m.resolvedUrl || m.rawUrl)">
                  <img v-if="m.resolvedUrl || m.rawUrl" :src="m.resolvedUrl || m.rawUrl" class="igs-diff-card-img" />
                  <div v-else class="igs-resource-empty-thumb">
                    <i class="fa-solid fa-image fa-2x"></i>
                  </div>
                </div>

                <div class="igs-diff-card-info">
                  <span class="igs-diff-card-name">{{ m.name }}</span>
                  <div class="igs-diff-card-acts">
                    <button class="igs-diff-act-btn" title="生图" @click="openGenPromptDialog('mood', activeCharacter, getCurrentOutfit(activeCharacter), m)">
                      <i class="fa-solid fa-rotate"></i>
                    </button>
                    <button class="igs-diff-act-btn" title="下载" @click="handleDownloadImage(m.resolvedUrl || m.rawUrl, activeCharacter.name + '_' + m.name)">
                      <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="igs-diff-act-btn" title="上传替换" @click="triggerDiffUpload(activeCharacter, getCurrentOutfit(activeCharacter), m)">
                      <i class="fa-solid fa-upload"></i>
                    </button>
                    <button class="igs-diff-act-btn" title="删除" @click="handleDeleteMood(activeCharacter.name, m.name, getCurrentOutfit(activeCharacter).name)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-folder-open fa-3x" style="margin-bottom: 12px;"></i>
              <p>当前服装暂无表情差分，点击上方「+差分」即可添加</p>
            </div>
          </section>

          <!-- 2. 背景场景板块 -->
          <section v-if="activeTab === 'scenes'">
            <div v-if="filteredScenes.length" class="igs-resources-grid">
              <div v-for="s in filteredScenes" :key="s.name" class="igs-resource-card">
                <div class="igs-resource-thumb-box is-landscape" @click="openLightbox(s.name, s.baseResolvedUrl || s.baseRawUrl, s.desc)">
                  <img v-if="s.baseResolvedUrl || s.baseRawUrl" :src="s.baseResolvedUrl || s.baseRawUrl" class="igs-resource-img" />
                  <div v-else class="igs-resource-empty-thumb">
                    <i class="fa-solid fa-image fa-2x"></i>
                    <span>暂无背景</span>
                  </div>

                  <div class="igs-resource-card-overlay-actions" @click.stop>
                    <button class="igs-icon-tag-btn" title="新增时段差分" @click="openAddDialog('sceneTime', s)">
                      <i class="fa-solid fa-plus"></i>
                    </button>
                    <button class="igs-icon-tag-btn" title="删除场景" @click="handleDeleteScene(s)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="igs-resource-info">
                  <div class="igs-resource-name-row">
                    <span class="igs-resource-name">{{ s.name }}</span>
                    <span class="igs-resource-desc">{{ s.timeCount }} 时段</span>
                  </div>
                  <div v-if="s.desc" class="igs-resource-desc">{{ s.desc }}</div>

                  <div v-if="s.times && s.times.length" class="igs-resource-diff-row">
                    <span 
                      v-for="t in s.times" 
                      :key="t.name" 
                      class="igs-resource-diff-tag"
                      :title="t.name"
                      @click="openLightbox(s.name + ' · ' + t.name, t.resolvedUrl || t.rawUrl)"
                    >
                      <span>{{ t.name }}</span>
                      <i class="fa-solid fa-xmark" style="font-size: 10px;" title="删除此时段" @click.stop="handleDeleteSceneTime(s.name, t.name)"></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-folder-open fa-3x" style="margin-bottom: 12px;"></i>
              <p>暂无场景背景，点击右上角「新增」即可添加</p>
            </div>
          </section>

          <!-- 3. 换装衣柜板块 -->
          <section v-if="activeTab === 'wardrobe'">
            <div v-if="filteredWardrobe.length" class="igs-resources-grid">
              <div v-for="w in filteredWardrobe" :key="w.name" class="igs-resource-card">
                <div class="igs-resource-thumb-box" @click="openLightbox(w.name, w.resolvedUrl || w.rawUrl, w.prompt)">
                  <img v-if="w.resolvedUrl || w.rawUrl" :src="w.resolvedUrl || w.rawUrl" class="igs-resource-img" />
                  <div v-else class="igs-resource-empty-thumb">
                    <i class="fa-solid fa-shirt fa-2x"></i>
                    <span>参考图为空</span>
                  </div>

                  <div class="igs-resource-card-overlay-actions" @click.stop>
                    <button class="igs-icon-tag-btn" title="删除服装" @click="handleDeleteWardrobe(w)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="igs-resource-info">
                  <div class="igs-resource-name-row">
                    <span class="igs-resource-name">{{ w.name }}</span>
                    <span v-if="w.character" class="igs-resources-chip" style="padding: 2px 8px; font-size: 11px;">{{ w.character }}</span>
                  </div>
                  <div v-if="w.prompt" class="igs-resource-desc" :title="w.prompt">{{ w.prompt }}</div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-folder-open fa-3x" style="margin-bottom: 12px;"></i>
              <p>暂无衣柜服装，点击右上角「新增」即可添加</p>
            </div>
          </section>

          <!-- 4. CG 画廊板块 -->
          <section v-if="activeTab === 'cgs'">
            <div class="igs-resources-subbar">
              <div class="igs-resources-filter-chips">
                <button class="igs-resources-chip" :class="{ 'is-active': cgFilter === 'all' }" @click="setCgFilter('all')">全部</button>
                <button class="igs-resources-chip" :class="{ 'is-active': cgFilter === 'favorites' }" @click="setCgFilter('favorites')">收藏</button>
                <button class="igs-resources-chip" :class="{ 'is-active': cgFilter === 'hidden' }" @click="setCgFilter('hidden')">已隐藏</button>
              </div>
              <div style="font-size: 0.8rem; color: var(--igs-settings-ink-3);">
                共 {{ filteredCgs.length }} 张 CG
              </div>
            </div>

            <div v-if="filteredCgs.length" class="igs-resources-grid">
              <div v-for="cg in filteredCgs" :key="cg.key" class="igs-resource-card">
                <div class="igs-resource-thumb-box is-landscape" @click="!cg.isPending && openLightbox(cg.label, cg.resolvedUrl || cg.rawUrl, cg.prompt, cg)">
                  <img v-if="!cg.isPending && (cg.resolvedUrl || cg.rawUrl)" :src="cg.resolvedUrl || cg.rawUrl" class="igs-resource-img" />
                  
                  <div v-else class="igs-cg-pending-container">
                    <span class="igs-cg-badge-pending">待生成</span>
                    <i class="fa-solid fa-wand-magic-sparkles fa-2x" style="color: var(--igs-settings-accent); margin-bottom: 4px;"></i>
                    <button class="igs-cg-btn-generate" @click.stop="openGenPromptDialog('cg', null, null, cg)">
                      <i class="fa-solid fa-wand-magic-sparkles"></i>
                      <span>生图</span>
                    </button>
                  </div>

                  <div v-if="!cg.isPending" class="igs-resource-card-overlay-actions" @click.stop>
                    <button 
                      class="igs-icon-tag-btn" 
                      :class="{ 'is-active': cg.isFavorite }" 
                      :title="cg.isFavorite ? '取消收藏' : '收藏'"
                      @click="handleCgFavorite(cg)"
                    >
                      <i class="fa-solid fa-star"></i>
                    </button>
                    <button 
                      class="igs-icon-tag-btn" 
                      :class="{ 'is-active': cg.isHidden }" 
                      :title="cg.isHidden ? '取消隐藏' : '隐藏'"
                      @click="handleCgHidden(cg)"
                    >
                      <i class="fa-solid" :class="cg.isHidden ? 'fa-eye-slash' : 'fa-eye'"></i>
                    </button>
                    <button class="igs-icon-tag-btn" title="下载" @click="handleDownloadImage(cg.resolvedUrl || cg.rawUrl, cg.label)">
                      <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="igs-icon-tag-btn" title="删除" @click="handleDeleteCg(cg)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="igs-resource-info">
                  <div class="igs-resource-name-row">
                    <span class="igs-resource-name">{{ cg.label }}</span>
                    <i v-if="cg.isFavorite" class="fa-solid fa-star" style="color: #ffd166; font-size: 12px;"></i>
                  </div>
                  <div v-if="cg.prompt" class="igs-resource-desc" :title="cg.prompt">{{ cg.prompt }}</div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-photo-film fa-3x" style="margin-bottom: 12px;"></i>
              <p>暂无符合筛选的剧情 CG</p>
            </div>
          </section>

          <!-- 5. 道具图鉴板块 (全面支持与呈现) -->
          <section v-if="activeTab === 'items'">
            <div v-if="filteredItems.length" class="igs-resources-grid">
              <div v-for="it in filteredItems" :key="it.name" class="igs-resource-card">
                <div class="igs-resource-thumb-box is-square" @click="openLightbox(it.name, it.resolvedUrl || it.rawUrl, it.desc)">
                  <img v-if="it.resolvedUrl || it.rawUrl" :src="it.resolvedUrl || it.rawUrl" class="igs-resource-img" />
                  <div v-else class="igs-resource-empty-thumb">
                    <i class="fa-solid fa-cube fa-2x"></i>
                    <span>暂无图标</span>
                  </div>

                  <div class="igs-resource-card-overlay-actions" @click.stop>
                    <button class="igs-icon-tag-btn" title="上传图标" @click="triggerItemUpload(it)">
                      <i class="fa-solid fa-upload"></i>
                    </button>
                    <button class="igs-icon-tag-btn" title="删除道具" @click="handleDeleteItem(it)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="igs-resource-info">
                  <div class="igs-resource-name-row">
                    <span class="igs-resource-name">{{ it.name }}</span>
                  </div>
                  <div v-if="it.desc" class="igs-resource-desc">{{ it.desc }}</div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-cubes fa-3x" style="margin-bottom: 12px;"></i>
              <p>暂无物品道具图鉴，点击下方或右上角「新增」即可添加</p>
              <button class="igs-btn-primary-compact" style="margin: 12px auto 0;" @click="openAddDialog('item')">
                <i class="fa-solid fa-plus"></i>
                <span>新增道具</span>
              </button>
            </div>
          </section>

          <!-- 6. 待确认暂存池 -->
          <section v-if="activeTab === 'review'">
            <div v-if="filteredStaging.length" class="igs-resources-grid">
              <div v-for="st in filteredStaging" :key="st.key" class="igs-resource-card">
                <div class="igs-resource-thumb-box" @click="openLightbox(st.name, st.resolvedUrl || st.rawUrl)">
                  <img v-if="st.resolvedUrl || st.rawUrl" :src="st.resolvedUrl || st.rawUrl" class="igs-resource-img" />
                  <div v-else class="igs-resource-empty-thumb">
                    <i class="fa-solid fa-clock-rotate-left fa-2x"></i>
                    <span>待确认素材</span>
                  </div>

                  <div class="igs-resource-card-overlay-actions" @click.stop>
                    <button class="igs-icon-tag-btn" title="舍弃" @click="handleDiscardStaging(st)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="igs-resource-info">
                  <div class="igs-resource-name-row">
                    <span class="igs-resource-name">{{ st.name }}</span>
                    <span class="igs-resources-chip" style="padding: 2px 8px; font-size: 11px;">{{ st.type }}</span>
                  </div>

                  <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <button class="igs-btn-primary-compact" style="flex: 1; justify-content: center;" @click="handleAcceptStaging(st, 'characters')">
                      入库立绘
                    </button>
                    <button class="igs-btn-primary-compact" style="flex: 1; justify-content: center;" @click="handleAcceptStaging(st, 'scenes')">
                      入库背景
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-inbox fa-3x" style="margin-bottom: 12px;"></i>
              <p>暂无待确认素材</p>
            </div>
          </section>
        </main>
      </div>

      <!-- 隐藏的通用图片选择器 -->
      <input 
        id="igs-patch-file-hidden-input" 
        type="file" 
        accept="image/*" 
        style="display: none;" 
        @change="onHiddenFileChange" 
      />

      <!-- 全屏 Lightbox 大图预览 (置于顶层，彻底隔离父容器形变与遮罩重叠) -->
      <div v-if="lightbox.visible" class="igs-lightbox-overlay" @click.self="closeLightbox">
        <header class="igs-lightbox-topbar">
          <span class="igs-lightbox-title">{{ lightbox.title }}</span>
          <div class="igs-lightbox-top-actions">
            <button 
              v-if="lightbox.key && !lightbox.isEventCg" 
              class="igs-btn-icon-round" 
              :title="lightbox.isFavorite ? '取消收藏' : '收藏'"
              @click="handleCgFavorite(lightbox)"
            >
              <i class="fa-solid fa-star" :style="{ color: lightbox.isFavorite ? '#ffd166' : '#fff' }"></i>
            </button>
            <button 
              v-if="lightbox.prompt" 
              class="igs-btn-icon-round" 
              title="复制提示词" 
              @click="handleCopyPrompt(lightbox.prompt)"
            >
              <i class="fa-solid fa-copy"></i>
            </button>
            <button 
              class="igs-btn-icon-round" 
              title="下载原图" 
              @click="handleDownloadImage(lightbox.src, lightbox.title)"
            >
              <i class="fa-solid fa-download"></i>
            </button>
            <button class="igs-btn-icon-round" title="关闭" @click="closeLightbox">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        <main class="igs-lightbox-main" @click.self="closeLightbox">
          <img :src="lightbox.src" class="igs-lightbox-img" />
        </main>

        <footer v-if="lightbox.prompt" class="igs-lightbox-bottombar">
          <span>{{ lightbox.prompt }}</span>
        </footer>
      </div>

      <!-- 生图与提示词确认对话框 -->
      <div v-if="genDialog.visible" class="igs-dialog-overlay" @click.self="genDialog.visible = false">
        <div class="igs-dialog-box">
          <h3 class="igs-dialog-title">生图与提示词 · {{ genDialog.title }}</h3>
          
          <div class="igs-form-row">
            <label class="igs-form-label">生图提示词</label>
            <textarea 
              v-model="genDialog.prompt" 
              class="igs-form-textarea" 
              placeholder="输入或调整该素材的生成提示词..."
            ></textarea>
          </div>

          <div class="igs-form-row">
            <label class="igs-form-label">负面提示词</label>
            <input 
              v-model="genDialog.negative" 
              class="igs-form-input" 
              placeholder="可选 负面提示词" 
            />
          </div>

          <div class="igs-dialog-actions">
            <button class="igs-resources-chip" @click="genDialog.visible = false">取消</button>
            <button 
              class="igs-btn-primary-compact" 
              :disabled="genDialog.isGenerating"
              @click="handleExecuteGenerate"
            >
              <i class="fa-solid fa-wand-magic-sparkles" :class="{ 'fa-spin': genDialog.isGenerating }"></i>
              <span>确认生图</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 统一新增/编辑对话框 -->
      <div v-if="editDialog.visible" class="igs-dialog-overlay" @click.self="editDialog.visible = false">
        <div class="igs-dialog-box">
          <h3 class="igs-dialog-title">{{ editDialog.title }}</h3>

          <div class="igs-form-row">
            <label class="igs-form-label">名称</label>
            <input v-model="editDialog.form.name" class="igs-form-input" placeholder="输入名称..." />
          </div>

          <div v-if="editDialog.type === 'scene' || editDialog.type === 'item'" class="igs-form-row">
            <label class="igs-form-label">描述</label>
            <input v-model="editDialog.form.desc" class="igs-form-input" placeholder="简短描述..." />
          </div>

          <div v-if="editDialog.type === 'wardrobe'" class="igs-form-row">
            <label class="igs-form-label">归属角色</label>
            <input v-model="editDialog.form.character" class="igs-form-input" placeholder="角色名称..." />
          </div>

          <div v-if="editDialog.type === 'wardrobe'" class="igs-form-row">
            <label class="igs-form-label">服装提示词</label>
            <textarea v-model="editDialog.form.prompt" class="igs-form-textarea" placeholder="输入生成该服装的专用 TAG 提示词..."></textarea>
          </div>

          <div v-if="editDialog.type !== 'outfit'" class="igs-form-row">
            <label class="igs-form-label">图片素材</label>
            <div class="igs-file-dropzone" @click="$refs.editFileInput.click()">
              <i class="fa-solid fa-cloud-arrow-up fa-2x"></i>
              <span>点击上传本地图片文件</span>
              <input ref="editFileInput" type="file" accept="image/*" style="display:none;" @change="handleFormFileUpload" />
            </div>
            <input v-model="editDialog.form.rawUrl" class="igs-form-input" style="margin-top: 6px;" placeholder="或直接输入图片 URL / igs-gen 标识符..." />
          </div>

          <div class="igs-dialog-actions">
            <button class="igs-resources-chip" @click="editDialog.visible = false">取消</button>
            <button class="igs-btn-primary-compact" @click="handleSaveEdit">保存</button>
          </div>
        </div>
      </div>

      <!-- 统一确认操作弹窗 -->
      <div v-if="confirmDialog.visible" class="igs-dialog-overlay" @click.self="confirmDialog.visible = false">
        <div class="igs-dialog-box" style="width: 360px;">
          <h3 class="igs-dialog-title">{{ confirmDialog.title }}</h3>
          <p style="font-size: 0.88rem; color: var(--igs-settings-ink-2); margin: 6px 0;">{{ confirmDialog.message }}</p>
          <div class="igs-dialog-actions">
            <button class="igs-resources-chip" @click="confirmDialog.visible = false">取消</button>
            <button class="igs-btn-primary-compact" style="background: #e74c3c; color: #fff;" @click="confirmDialog.onConfirm">确认删除</button>
          </div>
        </div>
      </div>
    </div>
    `
};
