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
  background: rgba(0,0,0,0.88);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  animation: igsPatchFadeIn 0.15s ease-out;
}

.igs-lightbox-topbar {
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0,0,0,0.5);
  border-bottom: 1px solid rgba(255,255,255,0.1);
  color: #fff;
}

.igs-lightbox-title {
  font-size: 1rem;
  font-weight: 700;
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
  overflow: hidden;
  position: relative;
}

.igs-lightbox-img {
  max-width: 92vw;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.6);
}

.igs-lightbox-bottombar {
  padding: 12px 24px;
  background: rgba(0,0,0,0.6);
  border-top: 1px solid rgba(255,255,255,0.1);
  font-size: 0.85rem;
  color: rgba(255,255,255,0.8);
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.5;
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

/* 响应式适配 */
@media (max-width: 768px) {
  .igs-resources-body {
    flex-direction: column;
  }
  .igs-resources-nav {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
    padding: 8px;
  }
  .igs-resources-nav-btn {
    padding: 8px 12px;
    white-space: nowrap;
    width: auto;
  }
  .igs-resources-header-tools {
    max-width: 160px;
  }
}
`;

let stylesInjected = false;

export function injectResourcesStyles() {
    if (stylesInjected) return;
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
                doc.head.appendChild(styleEl);
            }
        } catch (_) { }
    }
    stylesInjected = true;
}
