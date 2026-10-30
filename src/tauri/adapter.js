/**
 * TauriTavern 专有 API 桥接模块
 * 封装 Rust 后端驱动的 chat 句柄、locate、searchMessages、store 及 metadata 操作
 */

const NAMESPACE = 'igs_gal';

let cachedHandle = null;

/**
 * 等待并获取 TauriTavern 当前会话的 handle
 */
export async function getTauriHandle() {
    try {
        const tauriReady = window.__TAURITAVERN__?.ready ?? window.__TAURITAVERN_MAIN_READY__;
        if (tauriReady) {
            await tauriReady;
        }
        const api = window.__TAURITAVERN__?.api?.chat;
        if (!api || !api.current || typeof api.current.handle !== 'function') {
            return null;
        }
        return api.current.handle();
    } catch (err) {
        console.warn('[IGS-Patch] 获取 TauriTavern Handle 失败:', err);
        return null;
    }
}

/**
 * 精准定位最后一条匹配的消息（调用 Rust 后端高效执行）
 * @param {Object} options { role, hasExtraKeys, scanLimit }
 */
export async function findLastMessage(options = {}) {
    const handle = await getTauriHandle();
    if (!handle?.locate?.findLastMessage) {
        // 降级：若非 TauriTavern 环境，使用本地回退
        return fallbackFindLastMessage(options);
    }
    return handle.locate.findLastMessage({
        role: options.role || 'assistant',
        hasExtraKeys: options.hasExtraKeys,
        scanLimit: options.scanLimit || 2000,
    });
}

/**
 * 全文检索历史消息
 * @param {string} query 检索关键词
 * @param {Object} filters
 */
export async function searchMessages(query, filters = {}) {
    const handle = await getTauriHandle();
    if (!handle?.searchMessages) {
        return [];
    }
    return handle.searchMessages({
        query,
        limit: filters.limit || 20,
        filters: {
            role: filters.role,
            startIndex: filters.startIndex,
            endIndex: filters.endIndex,
            scanLimit: filters.scanLimit || 5000,
        },
    });
}

/**
 * 读取当前聊天的 KV 存储数据
 * @param {string} key
 */
export async function getStoredJson(key) {
    const handle = await getTauriHandle();
    if (!handle?.store?.getJson) {
        // 降级到 localStorage
        const raw = localStorage.getItem(`tauri_fallback:${NAMESPACE}:${key}`);
        return raw ? JSON.parse(raw) : null;
    }
    return handle.store.getJson({ namespace: NAMESPACE, key });
}

/**
 * 写入当前聊天的 KV 存储数据
 * @param {string} key
 * @param {any} value
 */
export async function setStoredJson(key, value) {
    const handle = await getTauriHandle();
    if (!handle?.store?.setJson) {
        localStorage.setItem(`tauri_fallback:${NAMESPACE}:${key}`, JSON.stringify(value));
        return;
    }
    return handle.store.setJson({ namespace: NAMESPACE, key, value });
}

/**
 * 列出当前聊天下的所有 KV 键
 */
export async function listStoredKeys() {
    const handle = await getTauriHandle();
    if (!handle?.store?.listKeys) {
        return Object.keys(localStorage)
            .filter((k) => k.startsWith(`tauri_fallback:${NAMESPACE}:`))
            .map((k) => k.replace(`tauri_fallback:${NAMESPACE}:`, ''));
    }
    return handle.store.listKeys({ namespace: NAMESPACE });
}

/**
 * 删除指定的 KV 键
 * @param {string} key
 */
export async function deleteStoredJson(key) {
    const handle = await getTauriHandle();
    if (!handle?.store?.deleteJson) {
        localStorage.removeItem(`tauri_fallback:${NAMESPACE}:${key}`);
        return;
    }
    return handle.store.deleteJson({ namespace: NAMESPACE, key });
}

/**
 * 读取当前会话的扩展 metadata 配置
 */
export async function getExtensionMetadata() {
    const handle = await getTauriHandle();
    if (!handle?.metadata?.get) return null;
    const meta = await handle.metadata.get();
    return meta?.extensions?.[NAMESPACE] || null;
}

/**
 * 写入当前会话的扩展 metadata 配置
 * @param {any} value 为 null 时表示删除
 */
export async function setExtensionMetadata(value) {
    const handle = await getTauriHandle();
    if (!handle?.metadata?.setExtension) return;
    return handle.metadata.setExtension({ namespace: NAMESPACE, value });
}

// ---------------- 降级回退实现 ----------------
function fallbackFindLastMessage(options = {}) {
    const chat = window.SillyTavern?.getContext?.()?.chat;
    if (!Array.isArray(chat) || chat.length === 0) return null;
    const limit = options.scanLimit || 2000;
    const start = Math.max(0, chat.length - limit);
    for (let i = chat.length - 1; i >= start; i--) {
        const msg = chat[i];
        if (!msg) continue;
        if (options.role === 'assistant' && (msg.is_user || msg.is_system)) continue;
        if (options.role === 'user' && !msg.is_user) continue;
        if (Array.isArray(options.hasExtraKeys)) {
            const hasAll = options.hasExtraKeys.every((k) => msg.extra && Object.hasOwn(msg.extra, k));
            if (!hasAll) continue;
        }
        return { index: i, message: msg };
    }
    return null;
}
