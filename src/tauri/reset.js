/**
 * 全量清空与重置服务 - 重置一切 (Nuclear Reset)
 * 彻底清除包括所有角色立绘、全聊天演出剧本、所有相关 IndexedDB 数据库、
 * localStorage 状态与配置、以及 TauriTavern KV 剧本存储，回归纯净初始状态。
 */

import { listStoredKeys, deleteStoredJson, setExtensionMetadata } from './adapter.js';
import { clearScriptMemoryStore } from '../director/pipeline.js';

const TARGET_IDB_DATABASES = [
    'vn',
    'igs-illustrations',
    'igs-cg-gallery',
    'igs-generated-assets',
    'igs-chat-records',
    'igs-director-runtime',
    'igs-cg-index',
    'igs-photo-album',
    'igs-wait-games',
];

function deleteSingleDb(name) {
    return new Promise((resolve) => {
        try {
            const req = window.indexedDB.deleteDatabase(name);
            req.onsuccess = () => resolve({ name, ok: true });
            req.onerror = () => resolve({ name, ok: false });
            req.onblocked = () => {
                console.warn(`[IGS-Patch] IndexedDB ${name} 删除被阻塞，请关闭其他页面`);
                resolve({ name, ok: false, blocked: true });
            };
        } catch (_) {
            resolve({ name, ok: false });
        }
    });
}

/**
 * 执行全量重置一切
 * @param {Object} options { silent: boolean }
 */
export async function resetAllGalData(options = {}) {
    const isSilent = options.silent === true;
    if (!isSilent) {
        const confirmed = window.confirm(
            '【最高警报】确定要重置一切吗？\n\n' +
            '这将永久抹除：\n' +
            '1. 所有角色的立绘、差分、衣柜、场景背景、CG图库与道具\n' +
            '2. 所有聊天会话的历史演出剧本与生成素材缓存\n' +
            '3. 全部 9 项 Galgame IndexedDB 数据库与本地存储配置\n' +
            '4. SillyTavern 消息挂载的演出剧本数据\n\n' +
            '重置后页面将完全恢复至初次未配置状态。此操作不可逆！'
        );
        if (!confirmed) return { ok: false, reason: 'user-cancelled' };
    }

    const report = {
        databasesDeleted: 0,
        localStorageKeysRemoved: 0,
        tauriStoreKeysDeleted: 0,
        chatMessagesCleaned: 0,
        igsShutDown: false,
    };

    // 1. 关闭正在运行的 IGS 实例
    try {
        const igs = window.IGS || window.ImmersiveGalgameSystem;
        if (igs && typeof igs.shutdown === 'function') {
            await igs.shutdown();
            report.igsShutDown = true;
        }
    } catch (err) {
        console.warn('[IGS-Patch] 关闭 IGS 实例异常:', err);
    }

    // 2. 清除所有相关 IndexedDB 数据库
    try {
        const dbNamesToDelete = new Set(TARGET_IDB_DATABASES);
        if (typeof window.indexedDB?.databases === 'function') {
            try {
                const existingDbs = await window.indexedDB.databases();
                for (const d of existingDbs) {
                    if (d?.name && (/^(igs|vn)/i.test(d.name))) {
                        dbNamesToDelete.add(d.name);
                    }
                }
            } catch (_) { }
        }

        const deletePromises = Array.from(dbNamesToDelete).map((dbName) => deleteSingleDb(dbName));
        const results = await Promise.all(deletePromises);
        report.databasesDeleted = results.filter(r => r.ok).length;
    } catch (err) {
        console.warn('[IGS-Patch] 删除 IndexedDB 异常:', err);
    }

    // 3. 清理 localStorage 中 IGS 相关的所有键
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (/^(igs|vn:|__IGS|tauri_fallback:igs_gal|st-baibai)/i.test(key) || key.includes('igs_gal'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        report.localStorageKeysRemoved = keysToRemove.length;
    } catch (err) {
        console.warn('[IGS-Patch] 清理 localStorage 异常:', err);
    }

    // 4. 清理 TauriTavern KV Store 与 Extension Metadata
    try {
        const tauriKeys = await listStoredKeys();
        if (Array.isArray(tauriKeys)) {
            for (const k of tauriKeys) {
                await deleteStoredJson(k);
            }
            report.tauriStoreKeysDeleted = tauriKeys.length;
        }
        await setExtensionMetadata(null);
    } catch (err) {
        console.warn('[IGS-Patch] 清理 TauriTavern 数据异常:', err);
    }

    // 5. 清理 SillyTavern 内存消息中的 extra 剧本数据
    try {
        const chat = window.SillyTavern?.getContext?.()?.chat;
        if (Array.isArray(chat)) {
            let cleaned = 0;
            for (const msg of chat) {
                if (msg?.extra) {
                    if (msg.extra.igs_patch_scripts) { delete msg.extra.igs_patch_scripts; cleaned++; }
                    if (msg.extra.igs_script) { delete msg.extra.igs_script; cleaned++; }
                    if (msg.extra.igs_gal) { delete msg.extra.igs_gal; cleaned++; }
                }
            }
            report.chatMessagesCleaned = cleaned;
            if (cleaned > 0) {
                try { window.SillyTavern?.getContext?.()?.saveChat?.(); } catch (_) { }
            }
        }
    } catch (_) { }

    // 6. 清理内存剧本缓存
    clearScriptMemoryStore();

    // 7. 广播全局重置事件
    try {
        window.dispatchEvent(new CustomEvent('igs:legacy-settings-updated', { detail: {} }));
    } catch (_) { }

    console.info('[IGS-Patch] Gal 系统重置一切完毕:', report);

    if (!isSilent) {
        const message = `已重置一切！\n已抹除 ${report.databasesDeleted} 个数据库、${report.localStorageKeysRemoved} 项本地存储及 ${report.tauriStoreKeysDeleted} 条剧本。`;
        if (window.toastr && typeof window.toastr.success === 'function') {
            window.toastr.success(message, '重置一切');
        } else {
            window.alert(message);
        }
    }

    return { ok: true, report };
}

export const fullResetGalSystem = resetAllGalData;
