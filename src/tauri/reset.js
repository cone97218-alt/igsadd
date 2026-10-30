/**
 * 全量清空与重置服务
 * 彻底清除包括 IndexedDB 生图/素材缓存、localStorage 状态与配置、以及 TauriTavern KV 剧本存储
 */

import { listStoredKeys, deleteStoredJson, setExtensionMetadata } from './adapter.js';

/**
 * 执行彻底重置
 * @param {Object} options { silent: boolean }
 */
export async function resetAllGalData(options = {}) {
    const isSilent = options.silent === true;
    if (!isSilent) {
        const confirmed = window.confirm(
            '【警告】确定要彻底重置所有 Gal 系统数据吗？\n\n' +
            '这将清空：\n' +
            '1. IndexedDB 中所有生成的立绘、背景、CG与临时图片素材\n' +
            '2. 本地存储的演出剧本、状态记录与缓存\n' +
            '3. TauriTavern 中该聊天的所有副模型转译剧本与扩展数据\n\n' +
            '重置后建议刷新页面。此操作无法撤销！'
        );
        if (!confirmed) return { ok: false, reason: 'user-cancelled' };
    }

    const report = {
        indexedDbCleared: false,
        localStorageKeysRemoved: 0,
        tauriStoreKeysDeleted: 0,
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

    // 2. 清除 IndexedDB 中的 'vn' 数据库（IGS 的立绘、背景、生图与贴图全在此库）
    try {
        await new Promise((resolve) => {
            const req = window.indexedDB.deleteDatabase('vn');
            req.onsuccess = () => {
                report.indexedDbCleared = true;
                resolve();
            };
            req.onerror = () => {
                console.warn('[IGS-Patch] IndexedDB vn 删除失败');
                resolve();
            };
            req.onblocked = () => {
                console.warn('[IGS-Patch] IndexedDB vn 删除被阻塞，请关闭其他标签页');
                resolve();
            };
        });
    } catch (err) {
        console.warn('[IGS-Patch] 删除 IndexedDB 异常:', err);
    }

    // 3. 清理 localStorage 中 IGS 相关的所有键
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (/^(igs|vn:|__IGS)/i.test(key) || key.includes('igs_gal'))) {
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

    console.info('[IGS-Patch] Gal 系统重置完毕:', report);

    if (!isSilent) {
        const message = `Gal 系统已彻底重置！\n已清空生图库、${report.localStorageKeysRemoved} 项本地设置及 ${report.tauriStoreKeysDeleted} 条剧本缓存。`;
        if (window.toastr && typeof window.toastr.success === 'function') {
            window.toastr.success(message, 'IGS 补丁');
        } else {
            window.alert(message);
        }
    }

    return { ok: true, report };
}

export const fullResetGalSystem = resetAllGalData;

