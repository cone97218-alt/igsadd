/**
 * 放映资源全屏控制台 CSS 样式表
 * 侧边栏布局架构：大标题与导航移至侧边栏，主视口空间最大化
 * 纯 FontAwesome 图标、零括号、极简按键规范
 */

export const RESOURCES_MODAL_CSS = `
/* 资源控制台专属样式 */
.igs-resources-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--igs-settings-backdrop, rgba(0,0,0,0.7));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  animation: igsPatchFadeIn 0.2s ease-out;
  color: var(--igs-settings-ink, #ffffff);
  box-sizing: border-box;
}

@keyframes igsPatchFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes igsPatchWindowZoom {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

.igs-resources-overlay *, .igs-resources-overlay *::before, .igs-resources-overlay *::after {
  box-sizing: border-box;
}

/* 主窗口：采用经典左侧侧边栏 + 右侧大主视口架构 */
.igs-resources-window {
  width: 1040px;
  max-width: 96vw;
  height: 86vh;
  max-height: 880px;
  background-color: var(--igs-settings-panel, #24292e);
  border: 1px solid var(--igs-settings-line-strong, rgba(255,255,255,0.15));
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: row;
  overflow: hidden;
  position: relative;
  animation: igsPatchWindowZoom 0.2s ease-out;
}

/* =========================================
   左侧精炼侧边栏 (Sidebar)
   ========================================= */
.igs-resources-sidebar {
  width: 140px;
  flex-shrink: 0;
  background-color: var(--igs-settings-surface, #2a3036);
  border-right: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 10px;
  z-index: 2;
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s ease;
  position: relative;
}

.igs-resources-sidebar.is-collapsed {
  width: 52px !important;
  padding: 12px 6px !important;
  align-items: center !important;
}

/* 侧边栏顶部大标题与折叠开关 */
.igs-sidebar-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 2px 12px 2px;
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  color: var(--igs-settings-ink, #ffffff);
  width: 100%;
}

.igs-resources-sidebar.is-collapsed .igs-sidebar-brand {
  justify-content: center;
  padding: 4px 0 10px 0;
}

.igs-sidebar-brand-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.igs-sidebar-brand-icon {
  font-size: 1.25rem;
  color: var(--igs-settings-accent, #7fd6ca);
  flex-shrink: 0;
}

.igs-sidebar-brand-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.igs-sidebar-collapse-btn {
  background: transparent;
  border: none;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.igs-sidebar-collapse-btn:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.08));
  color: var(--igs-settings-ink, #ffffff);
}

.igs-resources-sidebar.is-collapsed .igs-sidebar-nav-btn {
  padding: 10px 0;
  justify-content: center;
  width: 100%;
}

.igs-resources-sidebar.is-collapsed .igs-sidebar-nav-btn span {
  display: none;
}

.igs-resources-sidebar.is-collapsed .igs-sidebar-nav-btn i {
  font-size: 16px;
  margin: 0;
}

.igs-resources-sidebar.is-collapsed .igs-sidebar-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  padding: 1px 4px;
  font-size: 9px;
}

.igs-resources-sidebar.is-collapsed .igs-resources-theme-group {
  padding: 4px 2px;
  gap: 6px;
}

/* 侧边栏垂直导航项 */
.igs-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  flex: 1;
  width: 100%;
}

.igs-sidebar-nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: left;
}

.igs-sidebar-nav-btn:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.06));
  color: var(--igs-settings-ink, #ffffff);
}

.igs-sidebar-nav-btn.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  font-weight: 700;
}

.igs-sidebar-nav-btn i {
  font-size: 14px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.igs-sidebar-badge {
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(0,0,0,0.22);
  margin-left: auto;
  font-weight: bold;
}

/* 侧边栏底部操作区：主题切换圆圈与刷新 */
.igs-sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  align-items: center;
}

/* 侧边栏垂直主题切换条 (竖条设计，绝不污染设置界面的横条) */
.igs-resources-theme-group {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  background: var(--igs-settings-field, rgba(0,0,0,0.15)) !important;
  padding: 6px 4px !important;
  border-radius: 999px !important;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1)) !important;
}

.igs-resources-theme-swatch {
  width: 18px !important;
  height: 18px !important;
  border-radius: 50% !important;
  padding: 0 !important;
  margin: 0 !important;
  border: 2px solid transparent !important;
  cursor: pointer !important;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease !important;
  outline: none !important;
  box-sizing: border-box !important;
}

.igs-resources-theme-swatch.theme-cream {
  background-color: #85a76a !important;
  border-color: #f7f0e6 !important;
}

.igs-resources-theme-swatch.theme-light {
  background-color: #11110f !important;
  border-color: #fbfaf6 !important;
}

.igs-resources-theme-swatch.theme-landmine {
  background-color: #ffc4d4 !important;
  border-color: #2b2b2b !important;
}

.igs-resources-theme-swatch.theme-dark {
  background-color: #7fd6ca !important;
  border-color: #24292e !important;
}

.igs-resources-theme-swatch:hover {
  transform: scale(1.2) !important;
}

.igs-resources-theme-swatch.is-active {
  box-shadow: 0 0 0 2px var(--igs-settings-accent, #7fd6ca) !important;
  transform: scale(1.15) !important;
}

/* =========================================
   右侧全景主视口 (Main Body)
   ========================================= */
.igs-resources-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background-color: var(--igs-settings-panel, #24292e);
}

/* 极简单行顶栏 (Search + Scope + Actions) */
.igs-main-topbar {
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  background-color: var(--igs-settings-surface, #2a3036);
  flex-shrink: 0;
  gap: 10px;
  min-height: 44px;
}

.igs-topbar-search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--igs-settings-field, rgba(0,0,0,0.1));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  border-radius: 8px;
  padding: 4px 10px;
  flex: 1;
  max-width: 240px;
}

.igs-topbar-search-input {
  background: transparent !important;
  border: none !important;
  color: var(--igs-settings-ink, #fff) !important;
  font-size: 0.82rem !important;
  width: 100%;
  outline: none;
  padding: 0 !important;
}

/* 作用域分段药丸 */
.igs-scope-segmented {
  display: inline-flex;
  align-items: center;
  background: var(--igs-settings-field, rgba(0,0,0,0.15));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
  flex-shrink: 0;
}

.igs-scope-seg-opt {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.74rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.55));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.igs-scope-seg-opt.is-active {
  background: var(--igs-settings-panel, #24292e);
  color: var(--igs-settings-ink, #ffffff);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.igs-topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* 角色与控制一体化栏 */
.igs-char-unified-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: var(--igs-settings-field, rgba(0,0,0,0.05));
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.06));
  gap: 8px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.igs-char-unified-bar::-webkit-scrollbar {
  display: none;
}

.igs-char-pills-list {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.igs-char-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 16px;
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.igs-char-pill-btn.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border-color: transparent;
  font-weight: 700;
}

.igs-char-tab-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(0,0,0,0.2);
}

.igs-char-add-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 16px;
  background: transparent;
  border: 1px dashed var(--igs-settings-line, rgba(255,255,255,0.2));
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.6));
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
}

.igs-char-meta-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.igs-char-user-badge {
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(142, 68, 173, 0.18);
  border: 1px solid rgba(142, 68, 173, 0.4);
  color: #c39bd3;
  font-weight: 600;
  cursor: pointer;
}

.igs-char-compact-height {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.74rem;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
}

.igs-char-compact-height input {
  width: 44px !important;
  height: 22px !important;
  padding: 1px 3px !important;
  text-align: center;
  font-size: 0.74rem !important;
  border-radius: 4px !important;
}

/* 衣装紧凑栏 */
.igs-outfits-unified-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 14px;
  gap: 6px;
  background: var(--igs-settings-surface, #2a3036);
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.06));
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.igs-outfits-unified-bar::-webkit-scrollbar {
  display: none;
}

.igs-outfit-tab-btn {
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--igs-settings-field, rgba(0,0,0,0.18));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.75));
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.igs-outfit-tab-btn.is-active {
  background: var(--igs-settings-panel, #24292e);
  border-color: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-ink, #ffffff);
}

.igs-outfit-default-tag {
  font-size: 0.68rem;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(104, 159, 56, 0.2);
  color: var(--igs-settings-accent, #7fd6ca);
}

.igs-outfit-action-btn {
  padding: 4px 8px;
  border-radius: 6px;
  background: transparent;
  border: 1px dashed var(--igs-settings-line, rgba(255,255,255,0.15));
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.6));
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

/* 主内容可滚动区域 */
.igs-resources-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  min-height: 0;
}

/* 差分多列网格 (大图优先) */
.igs-char-diffs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.igs-diff-card {
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.15s ease;
}

.igs-diff-card:hover {
  border-color: var(--igs-settings-accent, #7fd6ca);
  transform: translateY(-2px);
}

.igs-diff-card-thumb {
  width: 100%;
  aspect-ratio: 3/4;
  background-color: #1a1e22;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.igs-diff-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.igs-diff-card-info {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--igs-settings-field, rgba(0,0,0,0.08));
}

.igs-diff-card-name {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--igs-settings-ink, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  line-height: 1.2;
}

.igs-diff-card-acts {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.igs-diff-act-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  background: var(--igs-settings-surface, #2a3036);
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.15s ease;
  padding: 0;
}

.igs-diff-act-btn:hover {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border-color: var(--igs-settings-accent, #7fd6ca);
}

/* 背景、衣柜、CG、道具通用卡片网格 */
.igs-resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.igs-resource-card {
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.15s ease, border-color 0.15s ease;
  position: relative;
}

.igs-resource-card:hover {
  transform: translateY(-2px);
  border-color: var(--igs-settings-accent, #7fd6ca);
}

.igs-resource-thumb-box {
  width: 100%;
  aspect-ratio: 3/4;
  background-color: #1a1e22;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.igs-resource-thumb-box.is-landscape {
  aspect-ratio: 16/9;
}

.igs-resource-thumb-box.is-square {
  aspect-ratio: 1/1;
}

.igs-resource-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.igs-resource-empty-thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.3));
  font-size: 0.78rem;
}

.igs-resource-card-overlay-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.igs-resource-card:hover .igs-resource-card-overlay-actions {
  opacity: 1;
}

.igs-icon-tag-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
}

.igs-icon-tag-btn:hover {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
}

.igs-icon-tag-btn.is-active {
  color: #ffd166;
}

.igs-resource-info {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.igs-resource-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.igs-resource-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--igs-settings-ink, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.igs-resource-desc {
  font-size: 0.75rem;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* CG 待生成卡片 */
.igs-cg-pending-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: radial-gradient(circle at center, rgba(127, 214, 202, 0.08) 0%, rgba(0, 0, 0, 0.4) 100%);
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  padding: 8px;
  text-align: center;
}

.igs-cg-badge-pending {
  position: absolute;
  top: 6px;
  left: 6px;
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(230, 126, 34, 0.85);
  color: #ffffff;
  font-weight: 700;
}

.igs-cg-btn-generate {
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border: none;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* CG 筛选药丸 */
.igs-resources-subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.igs-resources-filter-chips {
  display: flex;
  gap: 6px;
}

.igs-resources-chip {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.76rem;
  font-weight: 500;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  background: var(--igs-settings-field, #1f2428);
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  cursor: pointer;
}

.igs-resources-chip.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border-color: transparent;
  font-weight: 700;
}

/* 按钮规范 */
.igs-btn-icon-round {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: var(--igs-settings-field, #1f2428);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.8));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
}

.igs-btn-icon-round:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink, #fff);
}

.igs-btn-primary-compact {
  padding: 5px 12px;
  border-radius: 6px;
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  font-size: 0.8rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.igs-diff-act-btn {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  background: var(--igs-settings-field, rgba(0,0,0,0.15));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.75));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
}

.igs-diff-act-btn:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink, #ffffff);
  border-color: var(--igs-settings-accent, #7fd6ca);
}

/* =========================================
   全局输入框与文本域底色强制契合当前主题
   ========================================= */
.igs-resources-overlay input,
.igs-resources-overlay textarea,
.igs-dialog-overlay input,
.igs-dialog-overlay textarea,
.igs-form-input,
.igs-form-textarea,
.igs-dialog-box input,
.igs-dialog-box textarea,
textarea.igs-form-textarea {
  background-color: var(--igs-settings-field, #ebe2d5) !important;
  color: var(--igs-settings-ink, #514638) !important;
  border: 1px solid var(--igs-settings-line-strong, rgba(0,0,0,0.15)) !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
  font-size: 0.88rem !important;
  outline: none !important;
  font-family: inherit !important;
  box-sizing: border-box !important;
}

.igs-resources-overlay input::placeholder,
.igs-resources-overlay textarea::placeholder,
.igs-dialog-overlay input::placeholder,
.igs-dialog-overlay textarea::placeholder {
  color: var(--igs-settings-ink-3, rgba(0,0,0,0.4)) !important;
}

.igs-form-textarea {
  min-height: 80px !important;
  resize: vertical !important;
}

.igs-resources-overlay input:focus,
.igs-resources-overlay textarea:focus,
.igs-dialog-overlay input:focus,
.igs-dialog-overlay textarea:focus,
.igs-form-input:focus,
.igs-form-textarea:focus {
  border-color: var(--igs-settings-accent, #7fd6ca) !important;
}

/* =========================================
   弹窗全局居中居中居中 (彻底解决贴顶问题)
   ========================================= */
.igs-dialog-overlay {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483647 !important;
  background: rgba(0,0,0,0.72) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 24px 16px !important;
  overflow-y: auto !important;
  animation: igsPatchFadeIn 0.15s ease-out;
}

.igs-dialog-box {
  width: 440px !important;
  max-width: 92vw !important;
  max-height: min(85vh, 600px) !important;
  overflow-y: auto !important;
  background: var(--igs-settings-panel, #24292e) !important;
  border: 1px solid var(--igs-settings-line-strong, rgba(255,255,255,0.2)) !important;
  border-radius: 14px !important;
  padding: 20px !important;
  box-shadow: 0 20px 50px rgba(0,0,0,0.6) !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
  margin: auto !important;
  flex-shrink: 0 !important;
}

.igs-dialog-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--igs-settings-ink, #fff);
}

.igs-form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.igs-form-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
}

.igs-file-dropzone {
  border: 2px dashed var(--igs-settings-line, rgba(255,255,255,0.15));
  border-radius: 8px;
  padding: 14px;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
}

.igs-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

/* =========================================
   全屏 Lightbox 大图查看器
   ========================================= */
.igs-lightbox-overlay {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  height: 100dvh !important;
  z-index: 2147483647 !important;
  background: rgba(10, 12, 16, 0.96) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  display: flex !important;
  flex-direction: column !important;
  animation: igsPatchFadeIn 0.15s ease-out;
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 !important;
}

.igs-lightbox-topbar {
  padding: 10px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #181b20;
  border-bottom: 1px solid rgba(255,255,255,0.12);
  color: #ffffff;
  flex-shrink: 0;
  z-index: 10;
  min-height: 48px;
}

.igs-lightbox-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.igs-lightbox-top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.igs-lightbox-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: hidden;
  position: relative;
  min-height: 0;
  cursor: zoom-out;
}

.igs-lightbox-img {
  max-width: 95vw !important;
  max-height: calc(100dvh - 120px) !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
  border-radius: 8px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.85);
  display: block;
  margin: auto;
  cursor: default;
  transition: transform 0.2s ease;
}

.igs-lightbox-bottombar {
  padding: 10px 18px;
  background: #181b20;
  border-top: 1px solid rgba(255,255,255,0.12);
  font-size: 0.82rem;
  color: rgba(255,255,255,0.85);
  max-height: 100px;
  overflow-y: auto;
  line-height: 1.4;
  flex-shrink: 0;
}

/* =========================================
   移动端深度自适应 (@media <= 768px)
   ========================================= */
@media (max-width: 768px) {
  .igs-resources-overlay {
    padding: 0;
    align-items: stretch;
  }

  .igs-resources-window {
    width: 100vw;
    height: 100dvh;
    max-width: 100vw;
    max-height: 100dvh;
    border-radius: 0;
    border: none;
    flex-direction: row; /* 保持侧边栏在左侧！ */
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* 移动端侧边栏精简为 52px 宽的紧凑图标轨，折叠时彻底为 0 释放全部空间 */
  .igs-resources-sidebar {
    width: 52px;
    padding: 10px 4px;
    align-items: center;
    transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s ease;
  }

  .igs-resources-sidebar.is-collapsed {
    width: 0 !important;
    padding: 0 !important;
    border: none !important;
    overflow: hidden !important;
  }

  .igs-sidebar-brand {
    padding: 0 0 10px 0;
    justify-content: center;
    border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
    width: 100%;
  }

  .igs-sidebar-brand-title {
    display: none; /* 移动端隐藏大标题文字，仅保留图标 */
  }

  .igs-sidebar-nav-btn {
    padding: 10px 0;
    justify-content: center;
    border-radius: 8px;
    position: relative;
  }

  .igs-sidebar-nav-btn span {
    display: none; /* 移动端仅显示图标与微角标 */
  }

  .igs-sidebar-nav-btn i {
    font-size: 16px;
    margin: 0;
  }

  .igs-sidebar-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    padding: 1px 4px;
    font-size: 9px;
  }

  .igs-resources-sidebar .igs-resources-theme-group {
    padding: 4px 2px;
    gap: 4px;
  }

  /* 移动端主视口顶栏 */
  .igs-main-topbar {
    padding: 6px 8px;
    gap: 6px;
  }

  .igs-topbar-search-box {
    max-width: 130px;
    padding: 3px 6px;
  }

  .igs-topbar-search-input {
    font-size: 16px !important; /* 防止 iOS 缩放 */
  }

  .igs-scope-seg-opt {
    padding: 2px 5px;
    font-size: 11px;
  }

  .igs-char-diffs-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .igs-resources-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .igs-resource-card-overlay-actions {
    opacity: 1 !important;
  }
}
`;

export function injectResourcesStyles() {
    const docs = [document];
    try {
        if (window.parent?.document && !docs.includes(window.parent.document)) docs.push(window.parent.document);
    } catch (_) { }
    try {
        if (window.top?.document && !docs.includes(window.top.document)) docs.push(window.top.document);
    } catch (_) { }

    for (const doc of docs) {
        try {
            let styleEl = doc.getElementById('igs-patch-resources-styles');
            if (!styleEl) {
                styleEl = doc.createElement('style');
                styleEl.id = 'igs-patch-resources-styles';
                (doc.head || doc.body || doc.documentElement).appendChild(styleEl);
            }
            styleEl.textContent = RESOURCES_MODAL_CSS;
        } catch (_) { }
    }
}
