/**
 * 放映资源全屏控制台 (Vue 3 架构)
 * 集中管理全部 IGS 生成与使用的媒体图片：
 * 1. 角色立绘与表情差分
 * 2. 场景与分时段背景
 * 3. 换装衣柜与专属词
 * 4. 剧情 CG 与画廊
 * 5. 物品道具图鉴
 * 6. 待确认暂存素材池
 * 
 * 规范：纯 FontAwesome 图标，严禁 Emoji；标题严禁使用括号；极简按键与全屏大图预览 Lightbox
 */

import { createApp, ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { patchState, setTheme, subscribeState, detectAndSyncIgsTheme } from '../state/state.js';
import { THEME_OPTIONS, generateThemeCssVariables } from './theme.js';
import { notifyToast } from './toast.js';
import { injectResourcesStyles } from './resources-styles.js';
import {
    listCharacters,
    saveCharacter,
    deleteCharacter,
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

export function openResourcesModal() {
    console.info('[IGS-Patch] 正在呼出放映资源控制台...');
    injectResourcesStyles();
    detectAndSyncIgsTheme();
    ensureMounted();
    isResourcesModalVisible.value = true;
}

export function closeResourcesModal() {
    isResourcesModalVisible.value = false;
}

function ensureMounted() {
    if (appInstance && containerEl && document.body.contains(containerEl)) return;

    injectResourcesStyles();
    containerEl = document.createElement('div');
    containerEl.id = 'igs-patch-resources-modal-container';
    document.body.appendChild(containerEl);

    appInstance = createApp(ResourcesModalRoot);
    appInstance.mount(containerEl);
}

const ResourcesModalRoot = {
    setup() {
        const visible = isResourcesModalVisible;
        const activeTab = ref('characters');
        const searchQuery = ref('');
        const cgFilter = ref('all');
        const isLoading = ref(false);

        const characters = ref([]);
        const scenes = ref([]);
        const wardrobe = ref([]);
        const cgs = ref([]);
        const items = ref([]);
        const staging = ref([]);

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
            type: '', // 'char' | 'mood' | 'scene' | 'sceneTime' | 'wardrobe' | 'item'
            title: '',
            parentName: '',
            form: {
                name: '',
                desc: '',
                character: '',
                prompt: '',
                scenesText: '',
                rawUrl: '',
            },
        });

        // 确认操作对话框
        const confirmDialog = reactive({
            visible: false,
            title: '',
            message: '',
            onConfirm: null,
        });

        // 全局主题响应式变量
        const themeStyleVars = computed(() => {
            return generateThemeCssVariables(patchState.theme);
        });

        const loadData = async () => {
            isLoading.value = true;
            try {
                const [charsList, scenesList, wardrobeList, cgsList, itemsList, stagingList] = await Promise.all([
                    listCharacters(),
                    listScenes(),
                    listWardrobe(),
                    listAllCgs(cgFilter.value),
                    listItems(),
                    listStagingAssets(),
                ]);
                characters.value = charsList;
                scenes.value = scenesList;
                wardrobe.value = wardrobeList;
                cgs.value = cgsList;
                items.value = itemsList;
                staging.value = stagingList;
            } catch (err) {
                console.warn('[IGS-Patch] 加载素材异常:', err);
            } finally {
                isLoading.value = false;
            }
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
            notifyToast('已开始下载图片', 'info');
        };

        const handleCopyPrompt = (prompt) => {
            if (!prompt) return;
            navigator.clipboard.writeText(prompt);
            notifyToast('提示词已复制', 'info');
        };

        /* =================== 对话框与表单 =================== */
        const openAddDialog = (type, parent = null) => {
            editDialog.type = type;
            editDialog.parentName = parent?.name || '';
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
                    saveCharacter(f.name.trim(), f.rawUrl.trim());
                } else if (editDialog.type === 'mood') {
                    saveCharacterMood(editDialog.parentName, f.name.trim(), f.rawUrl.trim());
                } else if (editDialog.type === 'scene') {
                    saveScene(f.name.trim(), f.rawUrl.trim(), f.desc.trim());
                } else if (editDialog.type === 'sceneTime') {
                    saveSceneTime(editDialog.parentName, f.name.trim(), f.rawUrl.trim());
                } else if (editDialog.type === 'wardrobe') {
                    saveWardrobeItem(f.name.trim(), {
                        character: f.character.trim(),
                        prompt: f.prompt.trim(),
                        rawUrl: f.rawUrl.trim(),
                        scenes: f.scenesText.split(/[,，\n]/).map(s => s.trim()).filter(Boolean),
                    });
                } else if (editDialog.type === 'item') {
                    saveItem(f.name.trim(), f.rawUrl.trim(), f.desc.trim());
                }

                notifyToast('保存成功', 'info');
                editDialog.visible = false;
                await loadData();
            } catch (err) {
                notifyToast('保存异常', 'error');
            }
        };

        const handleFileUpload = async (e) => {
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
            triggerDelete('删除角色', `确定删除角色「${charObj.name}」及全部表情差分吗？`, () => {
                deleteCharacter(charObj.name);
            });
        };

        const handleDeleteMood = (charName, moodName) => {
            triggerDelete('删除差分', `确定删除表情差分「${moodName}」吗？`, () => {
                deleteCharacterMood(charName, moodName);
            });
        };

        const handleDeleteScene = (sceneObj) => {
            triggerDelete('删除场景', `确定删除场景「${sceneObj.name}」及全部时段差分吗？`, () => {
                deleteScene(sceneObj.name);
            });
        };

        const handleDeleteSceneTime = (sceneName, timeName) => {
            triggerDelete('删除时段', `确定删除时段差分「${timeName}」吗？`, () => {
                deleteSceneTime(sceneName, timeName);
            });
        };

        const handleDeleteWardrobe = (item) => {
            triggerDelete('删除服装', `确定删除服装「${item.name}」吗？`, () => {
                deleteWardrobeItem(item.name);
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
                deleteItem(item.name);
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

        onMounted(() => {
            loadData();
            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    if (lightbox.visible) {
                        closeLightbox();
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
            onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
        });

        return {
            visible,
            activeTab,
            searchQuery,
            cgFilter,
            isLoading,
            themeOptions: THEME_OPTIONS,
            themeStyleVars,
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
            editDialog,
            openAddDialog,
            handleSaveEdit,
            handleFileUpload,
            confirmDialog,
            handleCgFavorite,
            handleCgHidden,
            handleDeleteCharacter,
            handleDeleteMood,
            handleDeleteScene,
            handleDeleteSceneTime,
            handleDeleteWardrobe,
            handleDeleteCg,
            handleDeleteItem,
            handleAcceptStaging,
            handleDiscardStaging,
            setCgFilter,
            loadData,
            setTheme,
            close: closeResourcesModal,
        };
    },

    template: `
    <div v-if="visible" class="igs-resources-overlay" :style="themeStyleVars" @click.self="close">
      <div class="igs-resources-window">
        <!-- 顶部工具条 -->
        <header class="igs-resources-header">
          <div class="igs-resources-title-row">
            <h2 class="igs-resources-title">
              <i class="fa-solid fa-photo-film" style="color: var(--igs-settings-accent);"></i>
              <span>放映资源</span>
            </h2>
          </div>

          <!-- 搜索框 -->
          <div class="igs-resources-header-tools">
            <div class="igs-resources-search-box">
              <i class="fa-solid fa-magnifying-glass" style="color: var(--igs-settings-ink-3);"></i>
              <input 
                v-model="searchQuery" 
                class="igs-resources-search-input" 
                placeholder="搜索资源..." 
              />
            </div>
          </div>

          <!-- 顶部右侧按键 -->
          <div class="igs-resources-header-actions">
            <!-- 快速新增按钮 -->
            <button 
              v-if="activeTab !== 'cgs' && activeTab !== 'review'" 
              class="igs-btn-primary-compact" 
              @click="openAddDialog(activeTab === 'characters' ? 'char' : activeTab === 'scenes' ? 'scene' : activeTab === 'wardrobe' ? 'wardrobe' : 'item')"
            >
              <i class="fa-solid fa-plus"></i>
              <span>新增</span>
            </button>

            <!-- 刷新 -->
            <button class="igs-btn-icon-round" title="刷新列表" @click="loadData">
              <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': isLoading }"></i>
            </button>

            <!-- 主题切换 -->
            <div class="igs-patch-theme-group">
              <button 
                v-for="item in themeOptions" 
                :key="item.id" 
                class="igs-patch-theme-swatch"
                :class="{ 'is-active': themeStyleVars['--igs-theme-name'] === item.id }"
                :title="item.label"
                :style="{ background: item.primary }"
                @click="setTheme(item.id)"
              ></button>
            </div>

            <!-- 关闭 -->
            <button class="igs-btn-icon-round" title="关闭" @click="close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        <!-- 主内容区 -->
        <div class="igs-resources-body">
          <!-- 侧边导航选项卡 -->
          <nav class="igs-resources-nav">
            <button 
              class="igs-resources-nav-btn" 
              :class="{ 'is-active': activeTab === 'characters' }" 
              @click="activeTab = 'characters'"
            >
              <i class="fa-solid fa-person"></i>
              <span>立绘</span>
              <span class="igs-resources-badge">{{ characters.length }}</span>
            </button>

            <button 
              class="igs-resources-nav-btn" 
              :class="{ 'is-active': activeTab === 'scenes' }" 
              @click="activeTab = 'scenes'"
            >
              <i class="fa-solid fa-image"></i>
              <span>背景</span>
              <span class="igs-resources-badge">{{ scenes.length }}</span>
            </button>

            <button 
              class="igs-resources-nav-btn" 
              :class="{ 'is-active': activeTab === 'wardrobe' }" 
              @click="activeTab = 'wardrobe'"
            >
              <i class="fa-solid fa-shirt"></i>
              <span>衣柜</span>
              <span class="igs-resources-badge">{{ wardrobe.length }}</span>
            </button>

            <button 
              class="igs-resources-nav-btn" 
              :class="{ 'is-active': activeTab === 'cgs' }" 
              @click="activeTab = 'cgs'"
            >
              <i class="fa-solid fa-film"></i>
              <span>CG</span>
              <span class="igs-resources-badge">{{ cgs.length }}</span>
            </button>

            <button 
              class="igs-resources-nav-btn" 
              :class="{ 'is-active': activeTab === 'items' }" 
              @click="activeTab = 'items'"
            >
              <i class="fa-solid fa-cube"></i>
              <span>道具</span>
              <span class="igs-resources-badge">{{ items.length }}</span>
            </button>

            <button 
              class="igs-resources-nav-btn" 
              :class="{ 'is-active': activeTab === 'review' }" 
              @click="activeTab = 'review'"
            >
              <i class="fa-solid fa-inbox"></i>
              <span>待确认</span>
              <span v-if="staging.length" class="igs-resources-badge" style="background: var(--igs-settings-accent); color: #111;">{{ staging.length }}</span>
            </button>
          </nav>

          <!-- 右侧卡片瀑布流 -->
          <main class="igs-resources-content">
            <!-- 1. 立绘板块 -->
            <section v-if="activeTab === 'characters'">
              <div v-if="filteredCharacters.length" class="igs-resources-grid">
                <div v-for="c in filteredCharacters" :key="c.name" class="igs-resource-card">
                  <!-- 主立绘缩略图 -->
                  <div class="igs-resource-thumb-box" @click="openLightbox(c.name, c.baseResolvedUrl || c.baseRawUrl)">
                    <img v-if="c.baseResolvedUrl || c.baseRawUrl" :src="c.baseResolvedUrl || c.baseRawUrl" class="igs-resource-img" />
                    <div v-else class="igs-resource-empty-thumb">
                      <i class="fa-solid fa-image-slash fa-2x"></i>
                      <span>暂无立绘</span>
                    </div>

                    <!-- 悬浮操作图标 -->
                    <div class="igs-resource-card-overlay-actions" @click.stop>
                      <button class="igs-icon-tag-btn" title="新增差分" @click="openAddDialog('mood', c)">
                        <i class="fa-solid fa-plus"></i>
                      </button>
                      <button class="igs-icon-tag-btn" title="删除角色" @click="handleDeleteCharacter(c)">
                        <i class="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>

                  <!-- 角色信息 -->
                  <div class="igs-resource-info">
                    <div class="igs-resource-name-row">
                      <span class="igs-resource-name">{{ c.name }}</span>
                      <span class="igs-resource-desc">{{ c.moodCount }} 差分</span>
                    </div>

                    <!-- 表情差分预览药丸 -->
                    <div v-if="c.moods && c.moods.length" class="igs-resource-diff-row">
                      <span 
                        v-for="m in c.moods" 
                        :key="m.name" 
                        class="igs-resource-diff-tag"
                        :title="m.name"
                        @click="openLightbox(c.name + ' · ' + m.name, m.resolvedUrl || m.rawUrl)"
                      >
                        <span>{{ m.name }}</span>
                        <i class="fa-solid fa-xmark" style="font-size: 10px;" title="删除此差分" @click.stop="handleDeleteMood(c.name, m.name)"></i>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
                <i class="fa-solid fa-folder-open fa-3x" style="margin-bottom: 12px;"></i>
                <p>暂无角色立绘，点击右上角「新增」即可添加</p>
              </div>
            </section>

            <!-- 2. 背景场景板块 -->
            <section v-if="activeTab === 'scenes'">
              <div v-if="filteredScenes.length" class="igs-resources-grid">
                <div v-for="s in filteredScenes" :key="s.name" class="igs-resource-card">
                  <!-- 背景缩略图 -->
                  <div class="igs-resource-thumb-box is-landscape" @click="openLightbox(s.name, s.baseResolvedUrl || s.baseRawUrl, s.desc)">
                    <img v-if="s.baseResolvedUrl || s.baseRawUrl" :src="s.baseResolvedUrl || s.baseRawUrl" class="igs-resource-img" />
                    <div v-else class="igs-resource-empty-thumb">
                      <i class="fa-solid fa-image-slash fa-2x"></i>
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

                    <!-- 时段差分预览药丸 -->
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
              <!-- CG 筛选药丸 -->
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
                  <div class="igs-resource-thumb-box is-landscape" @click="openLightbox(cg.label, cg.resolvedUrl || cg.rawUrl, cg.prompt, cg)">
                    <img v-if="cg.resolvedUrl || cg.rawUrl" :src="cg.resolvedUrl || cg.rawUrl" class="igs-resource-img" />
                    <div v-else class="igs-resource-empty-thumb">
                      <i class="fa-solid fa-film fa-2x"></i>
                      <span>读取中</span>
                    </div>

                    <!-- 悬浮图标：收藏 / 隐藏 / 删除 -->
                    <div class="igs-resource-card-overlay-actions" @click.stop>
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

            <!-- 5. 道具图鉴板块 -->
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
                <p>暂无物品道具图鉴，点击右上角「新增」即可添加</p>
              </div>
            </section>

            <!-- 6. 待确认暂存池 -->
            <section v-if="activeTab === 'review'">
              <div v-if="filteredStaging.length" class="igs-resources-grid">
                <div v-for="st in filteredStaging" :key="st.key" class="igs-resource-card">
                  <div class="igs-resource-thumb-box" @click="openLightbox(st.name, st.resolvedUrl || st.rawUrl)">
                    <img v-if="st.resolvedUrl || st.rawUrl" :src="st.resolvedUrl || st.rawUrl" class="igs-resource-img" />
                    <div v-else class="igs-resource-empty-thumb">
                      <i class="fa-solid fa-inbox fa-2x"></i>
                      <span>暂无图像</span>
                    </div>
                  </div>

                  <div class="igs-resource-info">
                    <div class="igs-resource-name-row">
                      <span class="igs-resource-name">{{ st.name }}</span>
                      <span class="igs-resources-chip" style="font-size: 11px; padding: 1px 6px;">{{ st.type }}</span>
                    </div>

                    <!-- 操作：入库到立绘 / 入库到背景 / 舍弃 -->
                    <div style="display: flex; gap: 4px; margin-top: 8px;">
                      <button class="igs-resources-chip is-active" style="flex: 1; padding: 4px 6px; font-size: 11px;" @click="handleAcceptStaging(st, st.type)">
                        入库
                      </button>
                      <button class="igs-resources-chip" style="padding: 4px 8px; font-size: 11px;" title="舍弃" @click="handleDiscardStaging(st)">
                        <i class="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
                <i class="fa-solid fa-circle-check fa-3x" style="margin-bottom: 12px; color: var(--igs-settings-accent);"></i>
                <p>当前没有待确认入库的暂存素材</p>
              </div>
            </section>
          </main>
        </div>

        <!-- =================== 全屏 Lightbox 大图查看器 =================== -->
        <div v-if="lightbox.visible" class="igs-lightbox-overlay" @click.self="closeLightbox">
          <div class="igs-lightbox-topbar">
            <span class="igs-lightbox-title">{{ lightbox.title }}</span>
            <div class="igs-lightbox-top-actions">
              <button 
                v-if="lightbox.key" 
                class="igs-btn-icon-round" 
                :title="lightbox.isFavorite ? '取消收藏' : '收藏'"
                :style="{ color: lightbox.isFavorite ? '#ffd166' : 'inherit' }"
                @click="handleCgFavorite(lightbox)"
              >
                <i class="fa-solid fa-star"></i>
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
              <button 
                v-if="lightbox.key" 
                class="igs-btn-icon-round" 
                title="删除此图" 
                @click="handleDeleteCg(lightbox)"
              >
                <i class="fa-solid fa-trash-can"></i>
              </button>
              <button class="igs-btn-icon-round" title="关闭大图" @click="closeLightbox">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <div class="igs-lightbox-main" @click="closeLightbox">
            <img :src="lightbox.src" class="igs-lightbox-img" @click.stop />
          </div>

          <div v-if="lightbox.prompt" class="igs-lightbox-bottombar">
            <div style="font-weight: bold; margin-bottom: 4px;">生图提示词：</div>
            <div style="font-family: monospace; word-break: break-all;">{{ lightbox.prompt }}</div>
          </div>
        </div>

        <!-- =================== 新增/编辑对话框 =================== -->
        <div v-if="editDialog.visible" class="igs-dialog-overlay" @click.self="editDialog.visible = false">
          <div class="igs-dialog-box">
            <h3 class="igs-dialog-title">{{ editDialog.title }}</h3>

            <div class="igs-form-row">
              <label class="igs-form-label">名称</label>
              <input v-model="editDialog.form.name" class="igs-form-input" placeholder="输入名称..." />
            </div>

            <div v-if="editDialog.type === 'scene' || editDialog.type === 'item'" class="igs-form-row">
              <label class="igs-form-label">说明描述</label>
              <input v-model="editDialog.form.desc" class="igs-form-input" placeholder="简短描述..." />
            </div>

            <div v-if="editDialog.type === 'wardrobe'" class="igs-form-row">
              <label class="igs-form-label">所属角色</label>
              <input v-model="editDialog.form.character" class="igs-form-input" placeholder="指定所属角色..." />
            </div>

            <div v-if="editDialog.type === 'wardrobe'" class="igs-form-row">
              <label class="igs-form-label">服装提示词</label>
              <textarea v-model="editDialog.form.prompt" class="igs-form-textarea" placeholder="英文提示词 TAG..."></textarea>
            </div>

            <!-- 图片输入：支持 URL 或本地文件上传 -->
            <div class="igs-form-row">
              <label class="igs-form-label">图片来源</label>
              <input v-model="editDialog.form.rawUrl" class="igs-form-input" placeholder="可直接填入图片地址或粘贴 DataUrl..." />
              
              <label class="igs-file-dropzone" style="margin-top: 6px;">
                <i class="fa-solid fa-cloud-arrow-up fa-2x"></i>
                <span>点击或拖拽上传本地图片</span>
                <input type="file" accept="image/*" style="display: none;" @change="handleFileUpload" />
              </label>
            </div>

            <div class="igs-dialog-actions">
              <button class="igs-resources-chip" @click="editDialog.visible = false">取消</button>
              <button class="igs-btn-primary-compact" @click="handleSaveEdit">保存</button>
            </div>
          </div>
        </div>

        <!-- =================== 确认对话框 =================== -->
        <div v-if="confirmDialog.visible" class="igs-dialog-overlay" @click.self="confirmDialog.visible = false">
          <div class="igs-dialog-box" style="width: 380px;">
            <h3 class="igs-dialog-title" style="color: var(--igs-settings-danger, #e76f51);">{{ confirmDialog.title }}</h3>
            <p style="font-size: 0.9rem; color: var(--igs-settings-ink-2); line-height: 1.5; margin: 0;">{{ confirmDialog.message }}</p>
            <div class="igs-dialog-actions">
              <button class="igs-resources-chip" @click="confirmDialog.visible = false">取消</button>
              <button class="igs-btn-primary-compact" style="background: var(--igs-settings-danger, #e76f51); color: #fff;" @click="confirmDialog.onConfirm">
                确认
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    `,
};
