/**
 * 极简右上角小弹窗通知 (Minimal Projector Toast)
 * 专为视觉小说放映制作设计：
 * 1. 固定在屏幕右上角 (top: 16px; right: 16px; z-index: 2147483647)
 * 2. 尺寸精致小巧，胶囊药丸风格，毛玻璃质感，字体 12px
 * 3. 强制携带统一前缀：“放映” 与纯 FontAwesome 图标
 * 4. 仅在制作开始与结束时显示，自动平滑淡入滑出，避免频繁打扰
 */

function getCandidateDocument() {
    try {
        if (window.top && window.top.document) return window.top.document;
    } catch (_) { }
    try {
        if (window.parent && window.parent.document) return window.parent.document;
    } catch (_) { }
    return document;
}

let activeToastEl = null;
let dismissTimer = null;

export function notifyToast(message, type = 'info', duration = 2200) {
    const doc = getCandidateDocument();
    if (!doc || !doc.body) {
        console.log(`[IGS-Patch] [放映] ${message}`);
        return;
    }

    // 格式化文本：确保带有“放映”前缀，无括号
    const cleanMsg = String(message || '').replace(/^放映[：:\s]*/, '').replace(/[()（）]/g, '');
    const displayText = `放映：${cleanMsg}`;

    // 确保容器存在
    let toastContainer = doc.getElementById('igs-patch-mini-toast-root');
    if (!toastContainer) {
        toastContainer = doc.createElement('div');
        toastContainer.id = 'igs-patch-mini-toast-root';
        toastContainer.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 2147483647;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
        `;
        (doc.body || doc.documentElement).appendChild(toastContainer);
    }

    // 清除上一个存在的 toast
    if (activeToastEl) {
        try {
            activeToastEl.remove();
        } catch (_) { }
        activeToastEl = null;
    }
    if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
    }

    // 紧凑配色配置
    const colors = {
        info: {
            bg: 'rgba(28, 30, 36, 0.90)',
            border: 'rgba(255, 255, 255, 0.16)',
            text: '#f1f3f5',
            icon: '#60a5fa',
            iconClass: 'fa-film',
        },
        success: {
            bg: 'rgba(18, 38, 26, 0.92)',
            border: 'rgba(74, 222, 128, 0.35)',
            text: '#dcfce7',
            icon: '#4ade80',
            iconClass: 'fa-circle-check',
        },
        warn: {
            bg: 'rgba(38, 28, 12, 0.92)',
            border: 'rgba(251, 191, 36, 0.35)',
            text: '#fef3c7',
            icon: '#fbbf24',
            iconClass: 'fa-triangle-exclamation',
        },
        error: {
            bg: 'rgba(40, 16, 16, 0.94)',
            border: 'rgba(248, 113, 113, 0.35)',
            text: '#fee2e2',
            icon: '#f87171',
            iconClass: 'fa-circle-exclamation',
        },
    };

    const scheme = colors[type] || colors.info;

    const toast = doc.createElement('div');
    toast.className = 'igs-mini-toast';
    toast.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 5px 13px;
        background: ${scheme.bg};
        color: ${scheme.text};
        border: 1px solid ${scheme.border};
        border-radius: 18px;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28), 0 1px 3px rgba(0, 0, 0, 0.18);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        transform: translateY(-8px);
        opacity: 0;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
        max-width: 260px;
        word-break: break-all;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;

    toast.innerHTML = `
        <i class="fa-solid ${scheme.iconClass}" style="color: ${scheme.icon}; font-size: 11px; flex-shrink: 0;" aria-hidden="true"></i>
        <span>${escapeHtml(displayText)}</span>
    `;

    toastContainer.appendChild(toast);
    activeToastEl = toast;

    // 触发进入动画
    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });

    // 自动淡出并销毁
    dismissTimer = setTimeout(() => {
        if (toast && toast.parentElement) {
            toast.style.transform = 'translateY(-6px)';
            toast.style.opacity = '0';
            setTimeout(() => {
                try {
                    toast.remove();
                } catch (_) { }
                if (activeToastEl === toast) activeToastEl = null;
            }, 220);
        }
    }, duration);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
