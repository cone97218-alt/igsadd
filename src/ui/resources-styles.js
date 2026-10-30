/**
 * 放映资源全屏控制台 CSS 样式表
 * 严格遵循主题变量、纯 FontAwesome 图标、零括号与极简按键规范
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
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

.igs-resources-overlay *, .igs-resources-overlay *::before, .igs-resources-overlay *::after {
  box-sizing: border-box;
}

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
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 顶部栏 */
.igs-resources-header {
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  background-color: var(--igs-settings-surface, #2a3036);
  flex-shrink: 0;
  gap: 16px;
}

.igs-resources-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.igs-resources-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--igs-settings-ink, #ffffff);
  display: flex;
  align-items: center;
  gap: 8px;
}

.igs-resources-header-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 420px;
  margin: 0 16px;
}

.igs-resources-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--igs-settings-field, #1f2428);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  border-radius: 8px;
  padding: 6px 12px;
  width: 100%;
}

.igs-resources-search-input {
  background: transparent;
  border: none;
  color: var(--igs-settings-ink, #fff);
  font-size: 0.85rem;
  width: 100%;
  outline: none;
}

.igs-resources-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 主内容布局：左侧/顶部选项卡 + 内容区 */
.igs-resources-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 侧边导航栏 */
.igs-resources-nav {
  width: 140px;
  flex-shrink: 0;
  background-color: var(--igs-settings-surface, #2a3036);
  border-right: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.igs-resources-nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: left;
}

.igs-resources-nav-btn:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.06));
  color: var(--igs-settings-ink, #ffffff);
}

.igs-resources-nav-btn.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
}

.igs-resources-nav-btn i {
  font-size: 15px;
  width: 18px;
  text-align: center;
}

.igs-resources-badge {
  font-size: 0.72rem;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(0,0,0,0.25);
  margin-left: auto;
  font-weight: bold;
}

/* 右侧内容主视口 */
.igs-resources-content {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 次级工具栏 - CG 筛选与操作 */
.igs-resources-subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.igs-resources-filter-chips {
  display: flex;
  gap: 6px;
}

.igs-resources-chip {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  background: var(--igs-settings-field, #1f2428);
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  cursor: pointer;
  transition: all 0.15s ease;
}

.igs-resources-chip.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border-color: transparent;
  font-weight: 700;
}

/* 卡片网格布局 */
.igs-resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

/* 单个资源卡片 */
.igs-resource-card {
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 12px;
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

/* 图片缩略图容器 (棋盘透明背景) */
.igs-resource-thumb-box {
  width: 100%;
  aspect-ratio: 3/4;
  background-color: #1a1e22;
  background-image: 
    linear-gradient(45deg, #15181b 25%, transparent 25%), 
    linear-gradient(-45deg, #15181b 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #15181b 75%), 
    linear-gradient(-45deg, transparent 75%, #15181b 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
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
  object-fit: contain;
  transition: transform 0.2s ease;
}

.igs-resource-card:hover .igs-resource-img {
  transform: scale(1.04);
}

.igs-resource-empty-thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.3));
  font-size: 0.8rem;
}

/* 卡片浮层操作按钮 */
.igs-resource-card-overlay-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.igs-resource-card:hover .igs-resource-card-overlay-actions {
  opacity: 1;
}

.igs-icon-tag-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 12px;
}

.igs-icon-tag-btn:hover {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  transform: scale(1.1);
}

.igs-icon-tag-btn.is-active {
  color: #ffd166;
}

/* 卡片底部信息 */
.igs-resource-info {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.igs-resource-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.igs-resource-name {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--igs-settings-ink, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.igs-resource-desc {
  font-size: 0.78rem;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

/* 表情差分/时段差分横向列表 */
.igs-resource-diff-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--igs-settings-line, rgba(255,255,255,0.06));
}

.igs-resource-diff-tag {
  font-size: 0.74rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--igs-settings-field, #1f2428);
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}

.igs-resource-diff-tag:hover {
  border-color: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-ink, #fff);
}

.igs-resource-diff-tag.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  font-weight: 600;
}

/* 主题色切换药丸与圆点 (桌面端基础样式) */
.igs-patch-theme-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--igs-settings-field, rgba(0,0,0,0.15));
  padding: 3px 6px;
  border-radius: 999px;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
}

.igs-patch-theme-swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  padding: 0;
  margin: 0;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
  outline: none;
  box-sizing: border-box;
  background-clip: padding-box;
}

.igs-patch-theme-swatch:hover {
  transform: scale(1.18);
}

.igs-patch-theme-swatch.is-active {
  border-color: #ffffff;
  box-shadow: 0 0 0 1.5px var(--igs-settings-accent, #689f38);
  transform: scale(1.1);
}

/* 作用域筛选栏：全部 / 本卡 / 全局 */
.igs-resources-scope-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0 12px 0;
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.06));
  flex-wrap: wrap;
}

.igs-scope-pills {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--igs-settings-field, rgba(0,0,0,0.15));
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
}

.igs-scope-pill {
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.65));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.igs-scope-pill:hover {
  color: var(--igs-settings-ink, #ffffff);
}

.igs-scope-pill.is-active {
  background: var(--igs-settings-panel, #24292e);
  color: var(--igs-settings-ink, #ffffff);
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}

.igs-scope-count {
  font-size: 0.72rem;
  opacity: 0.75;
  font-weight: normal;
}

.igs-scope-tool-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  background: var(--igs-settings-field, rgba(0,0,0,0.15));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.igs-scope-tool-btn:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.08));
  color: var(--igs-settings-ink, #ffffff);
}

/* 角色横向切换选择器 */
.igs-char-selector-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 12px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  scrollbar-width: none;
}

.igs-char-selector-bar::-webkit-scrollbar {
  display: none;
}

.igs-char-tab-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.igs-char-tab-pill:hover {
  border-color: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-ink, #ffffff);
}

.igs-char-tab-pill.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border-color: transparent;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}

.igs-char-tab-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(0,0,0,0.2);
}

.igs-char-add-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  background: transparent;
  border: 1px dashed var(--igs-settings-line, rgba(255,255,255,0.2));
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.6));
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.igs-char-add-tab-btn:hover {
  border-color: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-ink, #ffffff);
}

/* 角色与衣装差分层级视图 */
.igs-char-item-card {
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.igs-char-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.igs-char-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.igs-char-avatar-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--igs-settings-field, rgba(0,0,0,0.2));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.12));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  flex-shrink: 0;
}

.igs-char-avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.igs-char-name-text {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--igs-settings-ink, #ffffff);
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
  transition: all 0.15s ease;
}

.igs-char-user-badge:hover {
  background: rgba(142, 68, 173, 0.3);
}

.igs-char-scope-switch {
  display: inline-flex;
  align-items: center;
  background: var(--igs-settings-field, rgba(0,0,0,0.18));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.igs-char-scope-opt {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
  cursor: pointer;
}

.igs-char-scope-opt.is-active {
  background: var(--igs-settings-panel, #24292e);
  color: var(--igs-settings-ink, #ffffff);
}

/* 立绘高度调节 */
.igs-char-height-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.82rem;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  padding-bottom: 4px;
}

.igs-char-height-input {
  width: 64px;
  background: var(--igs-settings-field, rgba(0,0,0,0.2));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.12));
  border-radius: 6px;
  padding: 4px 8px;
  color: var(--igs-settings-ink, #ffffff);
  font-size: 0.82rem;
  text-align: center;
  outline: none;
}

.igs-char-height-input:focus {
  border-color: var(--igs-settings-accent, #7fd6ca);
}

/* 服装标签栏 */
.igs-outfits-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 4px 0;
}

.igs-outfit-tab-btn {
  padding: 5px 12px;
  border-radius: 8px;
  background: var(--igs-settings-field, rgba(0,0,0,0.18));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.75));
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.igs-outfit-tab-btn:hover {
  border-color: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-ink, #ffffff);
}

.igs-outfit-tab-btn.is-active {
  background: var(--igs-settings-panel, #24292e);
  border-color: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-ink, #ffffff);
}

.igs-outfit-default-tag {
  font-size: 0.7rem;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(104, 159, 56, 0.2);
  color: var(--igs-settings-accent, #7fd6ca);
  font-weight: normal;
}

.igs-outfit-action-btn {
  padding: 5px 10px;
  border-radius: 8px;
  background: transparent;
  border: 1px dashed var(--igs-settings-line, rgba(255,255,255,0.15));
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.6));
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}

.igs-outfit-action-btn:hover {
  border-color: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-ink, #ffffff);
}

/* 差分列表与动作栏 */
.igs-char-diffs-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--igs-settings-field, rgba(0,0,0,0.12));
  border-radius: 10px;
  padding: 10px;
}

.igs-diff-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 8px;
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.06));
  border-radius: 8px;
  transition: all 0.15s ease;
}

.igs-diff-item-row:hover {
  border-color: var(--igs-settings-line-strong, rgba(255,255,255,0.18));
}

.igs-diff-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.igs-diff-thumb {
  width: 38px;
  height: 48px;
  border-radius: 6px;
  background: #1a1e22;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.igs-diff-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.igs-diff-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--igs-settings-ink, #ffffff);
}

.igs-diff-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.igs-diff-act-btn {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  background: var(--igs-settings-field, rgba(0,0,0,0.15));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.75));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.igs-diff-act-btn:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink, #ffffff);
  border-color: var(--igs-settings-accent, #7fd6ca);
}

/* CG 待生成与卡片增强 */
.igs-cg-pending-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: radial-gradient(circle at center, rgba(127, 214, 202, 0.08) 0%, rgba(0, 0, 0, 0.4) 100%);
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  padding: 12px;
  text-align: center;
}

.igs-cg-badge-pending {
  position: absolute;
  top: 8px;
  left: 8px;
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(230, 126, 34, 0.85);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.igs-cg-btn-generate {
  padding: 5px 12px;
  border-radius: 6px;
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border: none;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: transform 0.15s ease;
}

.igs-cg-btn-generate:hover {
  transform: scale(1.05);
}

/* 按钮规范 */
.igs-btn-icon-round {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--igs-settings-field, #1f2428);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.8));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.igs-btn-icon-round:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink, #fff);
}

.igs-btn-primary-compact {
  padding: 6px 14px;
  border-radius: 8px;
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  font-size: 0.85rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.15s ease;
}

.igs-btn-primary-compact:hover {
  opacity: 0.9;
}

/* Lightbox 大图全屏查看器 */
.igs-lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: rgba(12, 14, 18, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  animation: igsPatchFadeIn 0.15s ease-out;
}

.igs-lightbox-topbar {
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #181b20;
  border-bottom: 1px solid rgba(255,255,255,0.12);
  color: #ffffff;
  flex-shrink: 0;
  z-index: 100;
}

.igs-lightbox-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #ffffff;
}

.igs-lightbox-top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.igs-lightbox-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
  position: relative;
  min-height: 0;
}

.igs-lightbox-img {
  max-width: 90vw;
  max-height: 82vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.8);
  display: block;
  margin: auto;
}

.igs-lightbox-bottombar {
  padding: 12px 24px;
  background: #181b20;
  border-top: 1px solid rgba(255,255,255,0.12);
  font-size: 0.85rem;
  color: rgba(255,255,255,0.85);
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.5;
  flex-shrink: 0;
}

/* 编辑与新增对话框 */
.igs-dialog-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
}

.igs-dialog-box {
  width: 480px;
  max-width: 90vw;
  background: var(--igs-settings-panel, #24292e);
  border: 1px solid var(--igs-settings-line-strong, rgba(255,255,255,0.2));
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.igs-dialog-title {
  margin: 0;
  font-size: 1.1rem;
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

.igs-form-input, .igs-form-textarea {
  background: var(--igs-settings-field, #1f2428);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--igs-settings-ink, #fff);
  font-size: 0.88rem;
  outline: none;
  font-family: inherit;
}

.igs-form-textarea {
  min-height: 70px;
  resize: vertical;
}

.igs-form-input:focus, .igs-form-textarea:focus {
  border-color: var(--igs-settings-accent, #7fd6ca);
}

.igs-file-dropzone {
  border: 2px dashed var(--igs-settings-line, rgba(255,255,255,0.15));
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
}

.igs-file-dropzone:hover {
  border-color: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-ink, #fff);
}

.igs-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

/* =========================================
   移动端响应式深度适配 (@media <= 768px)
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
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* 顶部栏双行优雅排版：第一行标题与操作，第二行全宽搜索与新增 */
  .igs-resources-header {
    padding: 10px 12px;
    flex-wrap: wrap;
    gap: 8px;
    background-color: var(--igs-settings-surface, #2a3036);
  }

  .igs-resources-title-row {
    flex: 1;
    min-width: 110px;
  }

  .igs-resources-title {
    font-size: 1.05rem;
    gap: 6px;
  }

  .igs-resources-header-actions {
    margin-left: auto;
    gap: 6px;
    display: flex;
    align-items: center;
  }

  .igs-patch-theme-group {
    max-width: 96px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 2px;
    gap: 4px;
  }

  .igs-patch-theme-group::-webkit-scrollbar {
    display: none;
  }

  .igs-patch-theme-swatch {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .igs-btn-icon-round {
    width: 32px;
    height: 32px;
    font-size: 13px;
  }

  .igs-btn-primary-compact {
    padding: 5px 10px;
    font-size: 12px;
    gap: 4px;
    white-space: nowrap;
  }

  .igs-resources-header-tools {
    order: 3;
    width: 100%;
    max-width: 100%;
    margin: 2px 0 0 0;
    flex: 1 1 100%;
  }

  .igs-resources-search-box {
    padding: 6px 12px;
    border-radius: 8px;
    background: var(--igs-settings-field, #1f2428);
  }

  .igs-resources-search-input {
    font-size: 16px; /* 防止 iOS 自动聚焦拉近 */
  }

  /* 移动端横向滑动导航药丸 */
  .igs-resources-body {
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }

  .igs-resources-nav {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-right: none;
    border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
    padding: 6px 8px;
    gap: 4px;
    scrollbar-width: none;
    flex-shrink: 0;
  }

  .igs-resources-nav::-webkit-scrollbar {
    display: none;
  }

  .igs-resources-nav-btn {
    padding: 6px 10px;
    font-size: 0.82rem;
    white-space: nowrap;
    width: auto;
    border-radius: 8px;
    gap: 5px;
    flex-shrink: 0;
  }

  .igs-resources-nav-btn i {
    font-size: 13px;
    width: auto;
  }

  .igs-resources-badge {
    font-size: 10px;
    padding: 1px 5px;
    min-width: 16px;
  }

  /* 内容区域与双列相册 */
  .igs-resources-content {
    padding: 10px 8px;
    -webkit-overflow-scrolling: touch;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .igs-resources-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .igs-resource-card {
    border-radius: 10px;
  }

  /* 移动端触摸屏无 hover，右上角管理操作图标始终清晰可见 */
  .igs-resource-card-overlay-actions {
    opacity: 1 !important;
    top: 6px;
    right: 6px;
    gap: 4px;
  }

  .igs-icon-tag-btn {
    width: 30px;
    height: 30px;
    font-size: 12px;
    border-radius: 6px;
  }

  .igs-resource-info {
    padding: 8px;
    gap: 3px;
  }

  .igs-resource-name {
    font-size: 0.82rem;
  }

  .igs-resource-desc {
    font-size: 0.72rem;
  }

  .igs-resource-diff-row {
    gap: 4px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 2px;
  }

  .igs-resource-diff-row::-webkit-scrollbar {
    display: none;
  }

  .igs-resource-diff-tag {
    padding: 2px 6px;
    font-size: 11px;
    flex-shrink: 0;
  }

  /* CG 筛选药丸栏 */
  .igs-resources-subbar {
    padding: 0 4px 8px 4px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .igs-resources-filter-chips {
    gap: 4px;
  }

  .igs-resources-chip {
    padding: 4px 10px;
    font-size: 0.76rem;
  }

  /* 全屏 Lightbox 大图预览深度适配移动端与刘海屏 */
  .igs-lightbox-topbar {
    padding: 8px 10px;
    padding-top: max(8px, env(safe-area-inset-top));
    gap: 8px;
  }

  .igs-lightbox-title {
    font-size: 0.88rem;
    max-width: 140px;
  }

  .igs-lightbox-top-actions {
    gap: 4px;
  }

  .igs-lightbox-top-actions .igs-btn-icon-round {
    width: 34px;
    height: 34px;
    font-size: 14px;
  }

  .igs-lightbox-main {
    padding: 8px 4px;
  }

  .igs-lightbox-img {
    max-width: 100vw;
    max-height: calc(85dvh - 120px);
  }

  .igs-lightbox-bottombar {
    padding: 10px 12px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    font-size: 0.78rem;
    max-height: 28vh;
  }

  /* 弹出对话框居中与全屏适配 */
  .igs-dialog-overlay {
    padding: 10px;
    align-items: center;
  }

  .igs-dialog-box {
    width: 100% !important;
    max-width: 100% !important;
    max-height: 88dvh;
    overflow-y: auto;
    padding: 16px 14px;
    border-radius: 14px;
    gap: 12px;
  }

  .igs-form-input, .igs-form-textarea {
    font-size: 16px !important; /* 彻底防止 iOS 浏览器自动缩放页面 */
    padding: 10px 12px;
  }

  .igs-file-dropzone {
    padding: 14px;
  }

  /* 移动端触摸反馈 */
  .igs-btn-icon-round:active,
  .igs-icon-tag-btn:active,
  .igs-resources-nav-btn:active,
  .igs-resources-chip:active,
  .igs-btn-primary-compact:active {
    transform: scale(0.95);
    opacity: 0.85;
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
            if (!doc.getElementById('igs-patch-resources-styles')) {
                const styleEl = doc.createElement('style');
                styleEl.id = 'igs-patch-resources-styles';
                styleEl.textContent = RESOURCES_MODAL_CSS;
                (doc.head || doc.body || doc.documentElement).appendChild(styleEl);
            }
        } catch (_) { }
    }
}
