/**
 * 放映设置全屏控制台 CSS 样式表
 * 深度融合 IGS 0.37.x 原生设计规范与变量
 * 适配全平台（桌面端宽屏与移动端触控竖屏）
 */

export const SETTINGS_MODAL_CSS = `
/* 全屏半透明遮罩与模糊 */
.igs-patch-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--igs-settings-backdrop, rgba(0,0,0,0.65));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  animation: igsPatchFadeIn 0.2s ease-out;
  font-family: inherit;
  color: var(--igs-settings-ink, #ffffff);
  box-sizing: border-box;
}

@keyframes igsPatchFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

.igs-patch-overlay *, .igs-patch-overlay *::before, .igs-patch-overlay *::after {
  box-sizing: border-box;
}

/* 主窗口容器 */
.igs-patch-window {
  width: 920px;
  max-width: 95vw;
  height: 82vh;
  max-height: 800px;
  background-color: var(--igs-settings-panel, #24292e);
  border: 1px solid var(--igs-settings-line-strong, rgba(255,255,255,0.15));
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 顶部头部 */
.igs-patch-header {
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  background-color: var(--igs-settings-surface, #2a3036);
  flex-shrink: 0;
}

.igs-patch-title-box {
  display: flex;
  align-items: center;
  gap: 14px;
}

.igs-patch-icon {
  font-size: 22px;
  color: var(--igs-settings-accent, #7fd6ca);
}

.igs-patch-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--igs-settings-ink, #ffffff);
  line-height: 1.2;
}

.igs-patch-subtitle {
  font-size: 0.78rem;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
}

.igs-patch-header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

/* 主题选择色块 (强制保持水平排列，不受外部样式干扰) */
.igs-patch-header-actions .igs-patch-theme-group,
.igs-patch-theme-group {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 6px !important;
  background: var(--igs-settings-field, #1f2428);
  padding: 4px 6px;
  border-radius: 20px;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
}

.igs-patch-theme-swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  padding: 0;
  outline: none;
  transition: transform 0.15s ease;
}

.igs-patch-theme-swatch:hover {
  transform: scale(1.15);
}

.igs-patch-theme-swatch.is-active {
  box-shadow: 0 0 0 2px var(--igs-settings-accent, #7fd6ca);
}

.igs-patch-theme-swatch .swatch-base {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.igs-patch-theme-swatch .swatch-accent {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  border-radius: 4px 0 0 0;
}

.igs-patch-theme-swatch.theme-cream .swatch-base { background-color: #f7f0e6 !important; }
.igs-patch-theme-swatch.theme-cream .swatch-accent { background-color: #85a76a !important; }
.igs-patch-theme-swatch.theme-light .swatch-base { background-color: #fbfaf6 !important; }
.igs-patch-theme-swatch.theme-light .swatch-accent { background-color: #11110f !important; }
.igs-patch-theme-swatch.theme-landmine .swatch-base { background-color: #2b2b2b !important; }
.igs-patch-theme-swatch.theme-landmine .swatch-accent { background-color: #ffc4d4 !important; }
.igs-patch-theme-swatch.theme-dark .swatch-base { background-color: #24292e !important; }
.igs-patch-theme-swatch.theme-dark .swatch-accent { background-color: #7fd6ca !important; }

/* 关闭按钮 */
.igs-patch-btn-close {
  background: var(--igs-settings-close-bg, rgba(255,255,255,0.1));
  border: none;
  color: var(--igs-settings-ink-2, #ffffff);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
  font-size: 14px;
}

.igs-patch-btn-close:hover {
  background: var(--igs-settings-danger, #d07a74);
  color: #ffffff;
}

/* 核心主体 */
.igs-patch-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* 左侧导航 */
.igs-patch-nav {
  width: 200px;
  background-color: var(--igs-settings-surface, #2a3036);
  border-right: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.igs-patch-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  font-size: 0.92rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.igs-patch-nav-item i {
  font-size: 1rem;
  width: 20px;
  text-align: center;
}

.igs-patch-nav-item:hover {
  background: var(--igs-settings-highlight, rgba(255,255,255,0.05));
  color: var(--igs-settings-ink, #ffffff);
}

.igs-patch-nav-item.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-on-accent, #1f2428);
  font-weight: 600;
}

/* 右侧内容面板 */
.igs-patch-content {
  flex: 1;
  padding: 24px 30px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background-color: var(--igs-settings-panel, #24292e);
}

.section-title {
  margin: 0 0 6px 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--igs-settings-ink, #ffffff);
}

.section-desc {
  margin: 0 0 16px 0;
  font-size: 0.86rem;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.55));
  line-height: 1.5;
}

/* 模式切换卡片网格 */
.mode-cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.mode-card {
  padding: 18px 20px;
  border-radius: 12px;
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.mode-card:hover {
  border-color: var(--igs-settings-line-strong, rgba(255,255,255,0.25));
  transform: translateY(-2px);
}

.mode-card.is-selected {
  border-color: var(--igs-settings-accent, #7fd6ca);
  background: var(--igs-settings-field, #31383f);
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
}

.mode-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.mode-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--igs-settings-accent, #7fd6ca);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.radio-inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--igs-settings-accent, #7fd6ca);
}

.mode-title {
  font-weight: 700;
  font-size: 0.98rem;
  color: var(--igs-settings-ink, #ffffff);
}

.mode-badge {
  font-size: 0.72rem;
  padding: 3px 8px;
  border-radius: 12px;
  background: var(--igs-settings-highlight, rgba(255,255,255,0.1));
  color: var(--igs-settings-accent, #7fd6ca);
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mode-desc {
  margin: 0;
  font-size: 0.84rem;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  line-height: 1.55;
}

/* 状态容器卡片 */
.status-card {
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 12px;
  padding: 20px 22px;
}

.floor-stat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.92rem;
}

.stat-label {
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
}

.stat-val {
  font-weight: 600;
  color: var(--igs-settings-ink, #ffffff);
}

.stat-sep {
  color: var(--igs-settings-line, rgba(255,255,255,0.2));
}

.stat-tag {
  font-size: 0.8rem;
  padding: 3px 10px;
  border-radius: 6px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tag-ready {
  background: rgba(127, 214, 202, 0.15);
  color: var(--igs-settings-accent, #7fd6ca);
}

.tag-pending {
  background: rgba(255, 255, 255, 0.08);
  color: var(--igs-settings-ink-3, #888);
}

.producing-banner {
  margin-top: 14px;
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(127, 214, 202, 0.1);
  color: var(--igs-settings-accent, #7fd6ca);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.88rem;
}

.floor-actions {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}

.floor-empty {
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
  font-size: 0.9rem;
}

/* 按钮通用规范 */
.igs-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-radius: 8px;
  border: none;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.igs-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.igs-btn-primary {
  background: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-on-accent, #1f2428);
}

.igs-btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.igs-btn-accent {
  background: var(--igs-settings-highlight, #3a424a);
  color: var(--igs-settings-ink, #ffffff);
  border: 1px solid var(--igs-settings-line-strong, rgba(255,255,255,0.2));
}

.igs-btn-accent:hover:not(:disabled) {
  background: var(--igs-settings-field, #454e57);
}

.igs-btn-secondary {
  background: var(--igs-settings-field, #31383f);
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.8));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
}

.igs-btn-secondary:hover:not(:disabled) {
  background: var(--igs-settings-highlight, #3a424a);
  color: var(--igs-settings-ink, #ffffff);
}

.igs-btn-danger {
  background: var(--igs-settings-danger, #d07a74);
  color: #ffffff;
}

.igs-btn-danger:hover:not(:disabled) {
  filter: brightness(1.12);
}

/* 提示词拦截信息区 */
.interceptor-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-badge-ok {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--igs-settings-accent, #7fd6ca);
  font-weight: 600;
  font-size: 0.95rem;
}

.intercepted-meta {
  font-size: 0.85rem;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
}

.prompt-preview-box {
  margin-top: 14px;
  max-height: 240px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--igs-settings-field, #1f2428);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 12px 16px;
}

.prompt-preview-box pre {
  margin: 0;
  font-family: Consolas, Monaco, monospace;
  font-size: 0.82rem;
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.85));
}

/* 副模型网格 */
.llm-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.llm-info-item {
  font-size: 0.88rem;
}

.info-label {
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
}

.info-val {
  font-weight: 600;
  color: var(--igs-settings-ink, #ffffff);
}

.code-text {
  font-family: monospace;
  font-size: 0.82rem;
  word-break: break-all;
}

.llm-action-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 18px;
}

.test-result-tag {
  font-size: 0.84rem;
  padding: 4px 10px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.res-ok {
  background: rgba(127, 214, 202, 0.15);
  color: var(--igs-settings-accent, #7fd6ca);
}

.res-err {
  background: rgba(208, 122, 116, 0.15);
  color: var(--igs-settings-danger, #d07a74);
}

/* 提示词预设流水线 */
.preset-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preset-item-card {
  background: var(--igs-settings-surface, #f3ece1);
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.12));
  border-radius: 10px;
  padding: 12px 14px;
  transition: all 0.18s ease;
  color: var(--igs-settings-ink, #514638);
  overflow: hidden;
}

.preset-item-card:hover {
  border-color: var(--igs-settings-line-strong, rgba(116, 91, 62, 0.25));
}

.preset-item-card.is-disabled {
  opacity: 0.55;
}

.preset-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  min-height: 34px;
}

.collapse-toggle-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--igs-settings-ink-3, #9a8268);
  font-size: 0.8rem;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.preset-item-header:hover .collapse-toggle-icon {
  color: var(--igs-settings-accent, #85a76a);
}

.item-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.role-cycle-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.15));
  background: var(--igs-settings-field, #ebe2d5);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.role-cycle-btn:hover {
  transform: scale(1.06);
  border-color: var(--igs-settings-accent, #85a76a);
}

.role-cycle-btn.role-system {
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.4);
}

.role-cycle-btn.role-user {
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.4);
}

.role-cycle-btn.role-assistant {
  color: #8b5cf6;
  border-color: rgba(139, 92, 246, 0.4);
}

.item-name-input {
  background: transparent;
  border: 1px solid transparent;
  color: var(--igs-settings-ink, #514638);
  font-size: 0.92rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  flex: 1;
  min-width: 60px;
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-name-input:focus {
  background: var(--igs-settings-field, #ebe2d5);
  border-color: var(--igs-settings-line, rgba(116, 91, 62, 0.2));
  outline: none;
}

.item-slot-badge {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--igs-settings-paper, #efe4d7);
  color: var(--igs-settings-accent, #85a76a);
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.12));
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.item-header-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.mini-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.12));
  background: var(--igs-settings-field, #ebe2d5);
  color: var(--igs-settings-ink-2, #735f4a);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.82rem;
  transition: all 0.15s ease;
  flex-shrink: 0;
}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.82rem;
  transition: all 0.15s ease;
}

.mini-icon-btn:hover:not(:disabled) {
  color: var(--igs-settings-ink, #514638);
  border-color: var(--igs-settings-accent, #85a76a);
}

.mini-icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.mini-icon-btn.btn-danger:hover {
  color: var(--igs-settings-danger, #a76561);
  border-color: var(--igs-settings-danger, #a76561);
}

.preset-item-content {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.08));
}

.preset-textarea {
  width: 100%;
  min-height: 80px;
  background-color: var(--igs-settings-field, #ebe2d5) !important;
  background: var(--igs-settings-field, #ebe2d5) !important;
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.12)) !important;
  border-radius: 8px;
  color: var(--igs-settings-ink, #514638) !important;
  caret-color: var(--igs-settings-accent, #85a76a);
  font-size: 0.85rem;
  padding: 10px 12px;
  line-height: 1.55;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}

.preset-textarea::placeholder {
  color: var(--igs-settings-ink-3, rgba(116, 91, 62, 0.45));
}

.preset-textarea:focus {
  outline: none;
  border-color: var(--igs-settings-accent, #85a76a);
}

.slot-fixed-desc {
  font-size: 0.82rem;
  color: var(--igs-settings-ink-3, #9a8268);
  line-height: 1.6;
}

/* 正则裁剪规则盒子 */
.regex-panel-box {
  margin-top: 10px;
  background: var(--igs-settings-paper, #efe4d7);
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.12));
  border-radius: 8px;
  padding: 12px 14px;
}

.regex-rules-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.regex-rule-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  flex-wrap: wrap;
}

.regex-rule-input {
  background: var(--igs-settings-field, #ebe2d5);
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.15));
  border-radius: 6px;
  color: var(--igs-settings-ink, #514638);
  padding: 5px 8px;
  font-size: 0.82rem;
  font-family: monospace;
}

.preview-messages-container {
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.preview-msg-card {
  border-radius: 8px;
  padding: 10px 14px;
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.12));
}

.preview-msg-card.msg-system {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.25);
}

.preview-msg-card.msg-user {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.25);
}

.preview-msg-card.msg-assistant {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.25);
}

/* 全屏编辑面板：直接平铺覆盖控制台主窗口，彻底避免嵌套视口位移与外部溢出 */
.igs-expanded-editor-panel {
  position: absolute;
  inset: 0;
  z-index: 500;
  background-color: var(--igs-settings-panel, #f7f0e6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: igsPatchFadeIn 0.18s ease-out;
}

.expanded-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.12));
  background: var(--igs-settings-surface, #f3ece1);
  flex-shrink: 0;
}

.expanded-char-count {
  font-size: 0.8rem;
  color: var(--igs-settings-ink-3, #9a8268);
  padding: 2px 10px;
  border-radius: 12px;
  background: var(--igs-settings-field, #ebe2d5);
  font-weight: 500;
}

.expanded-editor-body {
  flex: 1;
  min-height: 0;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  background: var(--igs-settings-panel, #f7f0e6);
  overflow: hidden;
}

.expanded-editor-textarea {
  flex: 1;
  min-height: 0;
  height: 100%;
  width: 100%;
  background-color: var(--igs-settings-field, #ebe2d5) !important;
  background: var(--igs-settings-field, #ebe2d5) !important;
  color: var(--igs-settings-ink, #514638) !important;
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.12)) !important;
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 0.95rem;
  line-height: 1.65;
  font-family: inherit;
  resize: none;
  box-sizing: border-box;
}

.expanded-editor-textarea:focus {
  outline: none;
  border-color: var(--igs-settings-accent, #85a76a) !important;
}

.expanded-editor-actions {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 14px;
}

/* 分区画师面板样式 */
.artist-kind-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.artist-fields-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.artist-field-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.artist-field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--igs-settings-ink-2, #735f4a);
}

.artist-textarea {
  width: 100%;
  min-height: 60px;
  background-color: var(--igs-settings-field, #ebe2d5) !important;
  background: var(--igs-settings-field, #ebe2d5) !important;
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.12)) !important;
  border-radius: 8px;
  color: var(--igs-settings-ink, #514638) !important;
  caret-color: var(--igs-settings-accent, #85a76a);
  font-size: 0.84rem;
  padding: 8px 10px;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}

.artist-textarea:focus {
  outline: none;
  border-color: var(--igs-settings-accent, #85a76a) !important;
}

.artist-toolbar-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.igs-select-input {
  width: 100%;
  padding: 8px 12px;
  background-color: var(--igs-settings-field, #ebe2d5) !important;
  background: var(--igs-settings-field, #ebe2d5) !important;
  color: var(--igs-settings-ink, #514638) !important;
  border: 1px solid var(--igs-settings-line, rgba(116, 91, 62, 0.12)) !important;
  border-radius: 8px;
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.igs-select-input:focus {
  border-color: var(--igs-settings-accent, #85a76a) !important;
}

.preset-preview-box {
  margin-top: 8px;
  padding: 10px 12px;
  background-color: rgba(0, 0, 0, 0.03);
  border: 1px dashed var(--igs-settings-line, rgba(116, 91, 62, 0.2));
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.8rem;
  box-sizing: border-box;
}

.preset-preview-box.is-muted {
  background-color: transparent;
  border-style: dotted;
  color: var(--igs-settings-muted, #938676);
}

.preset-preview-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.preview-tag-title {
  font-weight: 600;
  font-size: 0.74rem;
  color: var(--igs-settings-accent, #85a76a);
  letter-spacing: 0.5px;
}

.preview-tag-content {
  color: var(--igs-settings-ink, #514638);
  font-family: Consolas, Monaco, monospace;
  font-size: 0.78rem;
  line-height: 1.45;
  word-break: break-all;
  max-height: 80px;
  overflow-y: auto;
  user-select: text;
}

.artist-extra-details {
  margin-top: 10px;
  border-top: 1px dashed var(--igs-settings-line, rgba(116, 91, 62, 0.15));
  padding-top: 8px;
}

.artist-extra-summary {
  font-size: 0.78rem;
  color: var(--igs-settings-muted, #938676);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  user-select: none;
  font-weight: 500;
}

.artist-extra-summary:hover {
  color: var(--igs-settings-ink, #514638);
}

/* 危险区项目 */
.danger-zone-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-title {
  margin: 0 0 4px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--igs-settings-ink, #ffffff);
}

.item-desc {
  margin: 0;
  font-size: 0.82rem;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
  line-height: 1.5;
}

.danger-zone-divider {
  height: 1px;
  background: var(--igs-settings-line, rgba(255,255,255,0.08));
  margin: 16px 0;
}

/* 二次确认弹窗 */
.igs-patch-dialog-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 600;
  padding: 20px;
  box-sizing: border-box;
}

.igs-patch-dialog-box {
  width: 440px;
  max-width: 90%;
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line-strong, rgba(255,255,255,0.2));
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.5);
}

.dialog-title {
  margin: 0 0 10px 0;
  font-size: 1.05rem;
  color: var(--igs-settings-ink, #ffffff);
}

.dialog-content {
  margin: 0 0 20px 0;
  font-size: 0.88rem;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* =========================================
   移动端响应式深度适配 (@media <= 768px)
   ========================================= */
@media (max-width: 768px) {
  .igs-patch-overlay {
    padding: 0;
    align-items: stretch;
  }

  .igs-patch-window {
    width: 100vw;
    height: 100dvh;
    max-width: 100vw;
    max-height: 100dvh;
    border-radius: 0;
    border: none;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .igs-patch-header {
    padding: 12px 14px;
  }

  .igs-patch-title {
    font-size: 1.05rem;
  }

  .igs-patch-subtitle {
    display: none;
  }

  .igs-patch-header-actions {
    gap: 10px;
  }

  .igs-patch-theme-swatch {
    width: 20px;
    height: 20px;
  }

  .igs-patch-body {
    flex-direction: column;
  }

  /* 移动端导航转为顶部横向轻量滑条 */
  .igs-patch-nav {
    width: 100%;
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding: 8px 10px;
    gap: 6px;
    scrollbar-width: none;
  }

  .igs-patch-nav::-webkit-scrollbar {
    display: none;
  }

  .igs-patch-nav-item {
    padding: 7px 12px;
    font-size: 0.82rem;
    white-space: nowrap;
    border-radius: 8px;
    gap: 6px;
  }

  .igs-patch-nav-item i {
    font-size: 0.9rem;
    width: auto;
  }

  .igs-patch-content {
    padding: 14px 12px;
  }

  /* 模式卡片单列全宽排列 */
  .mode-cards-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .mode-card {
    padding: 14px 16px;
  }

  .status-card {
    padding: 14px;
  }

  .floor-stat-row {
    flex-wrap: wrap;
    gap: 6px;
    font-size: 0.84rem;
  }

  .stat-sep {
    display: none;
  }

  .floor-stat-row > * {
    margin-right: 4px;
  }

  .floor-actions {
    flex-direction: column;
    width: 100%;
    gap: 8px;
  }

  .floor-actions .igs-btn {
    width: 100%;
    justify-content: center;
    padding: 12px 14px;
  }

  .interceptor-status-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .interceptor-action-buttons {
    flex-direction: column;
    width: 100%;
  }

  .interceptor-action-buttons .igs-btn {
    width: 100%;
    justify-content: center;
  }

  .llm-info-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .llm-action-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .llm-action-row .igs-btn {
    width: 100%;
    justify-content: center;
  }

  .danger-zone-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .danger-zone-item .igs-btn {
    width: 100%;
    justify-content: center;
  }

  .igs-patch-dialog-backdrop {
    padding: 0;
  }

  .igs-patch-dialog-box {
    width: 90vw;
    padding: 18px;
  }

  .igs-expanded-editor-window {
    width: 100vw;
    height: 100dvh;
    max-width: 100vw;
    max-height: 100dvh;
    border-radius: 0;
    border: none;
    margin: 0;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .expanded-editor-textarea,
  .igs-form-input,
  .igs-form-textarea {
    font-size: 16px !important; /* 彻底防止 iOS Safari 聚焦拉近放大 */
  }

  /* 触摸操作即时反馈 */
  .igs-btn:active,
  .igs-patch-nav-item:active,
  .igs-icon-btn:active,
  .mode-card:active {
    transform: scale(0.98);
    opacity: 0.85;
  }
}
`;

/**
 * 注入样式表到宿主文档
 */
export function injectSettingsStyles() {
    const docs = [document];
    try {
        if (window.parent?.document && !docs.includes(window.parent.document)) docs.push(window.parent.document);
    } catch (_) { }
    try {
        if (window.top?.document && !docs.includes(window.top.document)) docs.push(window.top.document);
    } catch (_) { }

    for (const doc of docs) {
        if (!doc.getElementById('igs-patch-settings-css')) {
            const style = doc.createElement('style');
            style.id = 'igs-patch-settings-css';
            style.textContent = SETTINGS_MODAL_CSS;
            (doc.head || doc.body || doc.documentElement).appendChild(style);
        }
    }
}
