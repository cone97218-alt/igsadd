/**
 * IGS 媒体资源中央服务 (Asset Service)
 * 
 * 统一抽象并管理 IGS 的全部图像与媒体资源：
 * 1. 角色立绘与表情差分 (Characters & Moods)
 * 2. 场景与分时段背景 (Scenes & Times)
 * 3. 换装衣柜与专属词 (Wardrobe & Outfits)
 * 4. 剧情 CG 与画廊 (CG Gallery & Event CGs, 对接 IndexedDB igs-illustrations 与 igs-cg-gallery)
 * 5. 物品与道具图鉴 (Items & Props)
 * 6. 待确认暂存素材 (Review & Staging, 对接 IndexedDB igs-generated-assets)
 * 
 * 支持自动将 igs-gen:<id> 内部格式解析为原生 dataUrl，支持图片增删改查并实时写回 localStorage 与 IndexedDB。
 */

const STORAGE_KEY_BRIDGE = 'igs_bridge_config';
const DB_ILLUSTRATIONS = 'igs-illustrations';
const DB_CG_GALLERY = 'igs-cg-gallery';
const DB_GENERATED_ASSETS = 'igs-generated-assets';

function getStorage() {
    return window.localStorage;
}

/**
 * 读取当前全局与角色卡生效的 sceneAssets
 */
export function getRawBridgeConfig() {
    try {
        const raw = getStorage().getItem(STORAGE_KEY_BRIDGE);
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        return {};
    }
}

export function saveRawBridgeConfig(bridge) {
    try {
        getStorage().setItem(STORAGE_KEY_BRIDGE, JSON.stringify(bridge));
        // 广播设置更新事件，使 IGS 原生运行时即刻感知
        broadcastSettingsUpdated(bridge);
        return true;
    } catch (err) {
        console.warn('[IGS-Patch] 保存配置失败:', err);
        return false;
    }
}

function broadcastSettingsUpdated(bridge) {
    for (const w of getCandidateWindows()) {
        try {
            w.dispatchEvent(new CustomEvent('igs:legacy-settings-updated', { detail: bridge }));
            if (w.eventSource && typeof w.eventSource.emit === 'function') {
                w.eventSource.emit('igs:legacy-settings-updated', bridge);
            }
        } catch (_) { }
    }
}

function getCandidateWindows() {
    const wins = [window];
    try {
        if (window.parent && !wins.includes(window.parent)) wins.push(window.parent);
    } catch (_) { }
    try {
        if (window.top && !wins.includes(window.top)) wins.push(window.top);
    } catch (_) { }
    return wins;
}

export function getSceneAssets() {
    const bridge = getRawBridgeConfig();
    const assets = bridge.sceneAssets || {};
    return {
        characters: assets.characters || {},
        scenes: assets.scenes || {},
        wardrobe: assets.wardrobe || {},
        eventCgs: assets.eventCgs || {},
        characterDna: assets.characterDna || {},
        characterOutfits: assets.characterOutfits || {},
        generated: assets.generated || {},
    };
}

export function updateSceneAssets(updater) {
    const bridge = getRawBridgeConfig();
    if (!bridge.sceneAssets || typeof bridge.sceneAssets !== 'object') {
        bridge.sceneAssets = {};
    }
    updater(bridge.sceneAssets);
    return saveRawBridgeConfig(bridge);
}

/* ========================================================================= */
/*                          IndexedDB 辅助操作封装                            */
/* ========================================================================= */

function openDb(name, version = undefined, onUpgrade = null) {
    return new Promise((resolve, reject) => {
        let req;
        try {
            if (!window.indexedDB) {
                return reject(new Error('IndexedDB not supported'));
            }
            req = typeof version === 'number' ? window.indexedDB.open(name, version) : window.indexedDB.open(name);
        } catch (err) {
            return reject(err);
        }
        req.onupgradeneeded = (e) => {
            if (typeof onUpgrade === 'function') onUpgrade(req.result, e);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error(`无法打开数据库: ${name}`));
    });
}

/**
 * 将任意图片 URL 解析为真实的展示用 DataUrl
 * 支持包含 igs-gen: 的内部索引
 */
const resolvedImageCache = new Map();

export async function resolveImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const cleanUrl = url.trim();
    if (!cleanUrl) return '';

    if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') || cleanUrl.startsWith('blob:')) {
        return cleanUrl;
    }

    if (cleanUrl.startsWith('igs-gen:')) {
        const imageId = cleanUrl.replace('igs-gen:', '');
        if (resolvedImageCache.has(imageId)) {
            return resolvedImageCache.get(imageId);
        }

        try {
            const db = await openDb(DB_GENERATED_ASSETS);
            if (!db.objectStoreNames.contains('images')) {
                db.close();
                return '';
            }
            const tx = db.transaction('images', 'readonly');
            const store = tx.objectStore('images');
            const record = await new Promise((res) => {
                const r = store.get(imageId);
                r.onsuccess = () => res(r.result);
                r.onerror = () => res(null);
            });
            db.close();

            if (record && (record.dataUrl || record.originalDataUrl)) {
                const finalUrl = record.dataUrl || record.originalDataUrl;
                resolvedImageCache.set(imageId, finalUrl);
                return finalUrl;
            }
        } catch (_) { }
    }

    return cleanUrl;
}

/* ========================================================================= */
/*                              角色与立绘管理                                */
/* ========================================================================= */

export async function listCharacters() {
    const assets = getSceneAssets();
    const charsObj = assets.characters || {};
    const result = [];

    for (const [name, data] of Object.entries(charsObj)) {
        if (!name) continue;
        const charData = (data && typeof data === 'object') ? data : { base: String(data || '') };
        const baseRawUrl = charData.base || '';
        const baseResolved = await resolveImageUrl(baseRawUrl);

        const moodsObj = (charData.moods && typeof charData.moods === 'object') ? charData.moods : {};
        const moodsList = [];

        for (const [moodName, moodUrl] of Object.entries(moodsObj)) {
            moodsList.push({
                name: moodName,
                rawUrl: moodUrl,
                resolvedUrl: await resolveImageUrl(moodUrl),
            });
        }

        result.push({
            name,
            baseRawUrl,
            baseResolvedUrl: baseResolved,
            moodCount: moodsList.length,
            moods: moodsList,
            expanded: false,
        });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

export function saveCharacter(name, baseRawUrl) {
    return updateSceneAssets((assets) => {
        if (!assets.characters) assets.characters = {};
        if (!assets.characters[name]) {
            assets.characters[name] = { base: baseRawUrl, moods: {} };
        } else if (typeof assets.characters[name] === 'object') {
            assets.characters[name].base = baseRawUrl;
        } else {
            assets.characters[name] = { base: baseRawUrl, moods: {} };
        }
    });
}

export function deleteCharacter(name) {
    return updateSceneAssets((assets) => {
        if (assets.characters) {
            delete assets.characters[name];
        }
    });
}

export function saveCharacterMood(characterName, moodName, moodRawUrl) {
    return updateSceneAssets((assets) => {
        if (!assets.characters) assets.characters = {};
        let charObj = assets.characters[characterName];
        if (!charObj || typeof charObj !== 'object') {
            charObj = { base: '', moods: {} };
            assets.characters[characterName] = charObj;
        }
        if (!charObj.moods) charObj.moods = {};
        charObj.moods[moodName] = moodRawUrl;
    });
}

export function deleteCharacterMood(characterName, moodName) {
    return updateSceneAssets((assets) => {
        const charObj = assets.characters?.[characterName];
        if (charObj && charObj.moods) {
            delete charObj.moods[moodName];
        }
    });
}

/* ========================================================================= */
/*                              场景与背景管理                                */
/* ========================================================================= */

export async function listScenes() {
    const assets = getSceneAssets();
    const scenesObj = assets.scenes || {};
    const result = [];

    for (const [name, data] of Object.entries(scenesObj)) {
        if (!name) continue;
        const sceneData = (data && typeof data === 'object') ? data : { url: String(data || '') };
        const baseRawUrl = sceneData.url || '';
        const baseResolved = await resolveImageUrl(baseRawUrl);

        const timesObj = (sceneData.times && typeof sceneData.times === 'object') ? sceneData.times : {};
        const timesList = [];

        for (const [timeName, timeVal] of Object.entries(timesObj)) {
            const timeRawUrl = typeof timeVal === 'string' ? timeVal : (timeVal?.url || '');
            timesList.push({
                name: timeName,
                rawUrl: timeRawUrl,
                resolvedUrl: await resolveImageUrl(timeRawUrl),
            });
        }

        result.push({
            name,
            desc: sceneData.desc || '',
            baseRawUrl,
            baseResolvedUrl: baseResolved,
            timeCount: timesList.length,
            times: timesList,
            expanded: false,
        });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

export function saveScene(name, baseRawUrl, desc = '') {
    return updateSceneAssets((assets) => {
        if (!assets.scenes) assets.scenes = {};
        let scObj = assets.scenes[name];
        if (!scObj || typeof scObj !== 'object') {
            scObj = { url: baseRawUrl, times: {}, desc };
            assets.scenes[name] = scObj;
        } else {
            scObj.url = baseRawUrl;
            if (desc !== undefined) scObj.desc = desc;
        }
    });
}

export function deleteScene(name) {
    return updateSceneAssets((assets) => {
        if (assets.scenes) {
            delete assets.scenes[name];
        }
    });
}

export function saveSceneTime(sceneName, timeName, timeRawUrl) {
    return updateSceneAssets((assets) => {
        if (!assets.scenes) assets.scenes = {};
        let scObj = assets.scenes[sceneName];
        if (!scObj || typeof scObj !== 'object') {
            scObj = { url: '', times: {}, desc: '' };
            assets.scenes[sceneName] = scObj;
        }
        if (!scObj.times) scObj.times = {};
        scObj.times[timeName] = timeRawUrl;
    });
}

export function deleteSceneTime(sceneName, timeName) {
    return updateSceneAssets((assets) => {
        const scObj = assets.scenes?.[sceneName];
        if (scObj && scObj.times) {
            delete scObj.times[timeName];
        }
    });
}

/* ========================================================================= */
/*                              换装衣柜管理                                  */
/* ========================================================================= */

export async function listWardrobe() {
    const assets = getSceneAssets();
    const wardrobeObj = assets.wardrobe || {};
    const result = [];

    for (const [name, data] of Object.entries(wardrobeObj)) {
        if (!name) continue;
        const item = (data && typeof data === 'object') ? data : {};
        const rawUrl = item.image || item.url || '';
        const resolved = await resolveImageUrl(rawUrl);

        result.push({
            name,
            character: item.character || '',
            prompt: item.prompt || '',
            scenes: Array.isArray(item.scenes) ? item.scenes : [],
            rawUrl,
            resolvedUrl: resolved,
        });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

export function saveWardrobeItem(name, itemData) {
    return updateSceneAssets((assets) => {
        if (!assets.wardrobe) assets.wardrobe = {};
        assets.wardrobe[name] = {
            name,
            character: itemData.character || '',
            prompt: itemData.prompt || '',
            image: itemData.rawUrl || itemData.image || '',
            scenes: Array.isArray(itemData.scenes) ? itemData.scenes : [],
        };
    });
}

export function deleteWardrobeItem(name) {
    return updateSceneAssets((assets) => {
        if (assets.wardrobe) {
            delete assets.wardrobe[name];
        }
    });
}

/* ========================================================================= */
/*                            剧情 CG 与画廊管理                             */
/* ========================================================================= */

export async function listAllCgs(filter = 'all') {
    const list = [];

    // 1. 读取 IndexedDB igs-cg-gallery 的标记 (收藏与隐藏)
    const marksMap = new Map();
    try {
        const dbMarks = await openDb(DB_CG_GALLERY);
        if (dbMarks.objectStoreNames.contains('marks')) {
            const tx = dbMarks.transaction('marks', 'readonly');
            const allMarks = await new Promise((res) => {
                const req = tx.objectStore('marks').getAll();
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => res([]);
            });
            for (const m of allMarks) {
                if (m && m.key) marksMap.set(m.key, m);
            }
        }
        dbMarks.close();
    } catch (_) { }

    // 2. 读取 IndexedDB igs-illustrations 中的槽位记录
    try {
        const dbCg = await openDb(DB_ILLUSTRATIONS);
        if (dbCg.objectStoreNames.contains('slots')) {
            const tx = dbCg.transaction('slots', 'readonly');
            const allSlots = await new Promise((res) => {
                const req = tx.objectStore('slots').getAll();
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => res([]);
            });

            for (const s of allSlots) {
                if (!s || !s.key) continue;
                const mark = marksMap.get(s.key) || {};
                const isHidden = mark.hidden === true;
                const isFavorite = mark.favorite === true;

                if (filter === 'favorites' && !isFavorite) continue;
                if (filter === 'hidden' && !isHidden) continue;
                if (filter === 'all' && isHidden) continue;

                const rawDataUrl = s.dataUrl || s.originalDataUrl || '';
                const parts = String(s.floorKey || '').split('|');
                const floorNo = parts.length >= 2 ? parts[parts.length - 2] : '';

                list.push({
                    key: s.key,
                    floorKey: s.floorKey || '',
                    slot: s.slot || 1,
                    label: floorNo ? `第 ${floorNo} 楼` : s.key,
                    prompt: s.prompt || s.caption || '',
                    rawUrl: rawDataUrl,
                    resolvedUrl: await resolveImageUrl(rawDataUrl),
                    isFavorite,
                    isHidden,
                    isEventCg: false,
                });
            }
        }
        dbCg.close();
    } catch (_) { }

    // 3. 读取 sceneAssets.eventCgs (预置/事件 CG)
    const assets = getSceneAssets();
    const eventCgs = assets.eventCgs || {};
    for (const [name, item] of Object.entries(eventCgs)) {
        if (!name) continue;
        const rawUrl = typeof item === 'string' ? item : (item?.url || '');
        const isHidden = false;
        const isFavorite = true;

        if (filter === 'hidden') continue;

        list.push({
            key: `event_cg_${name}`,
            label: name,
            prompt: item?.desc || name,
            rawUrl,
            resolvedUrl: await resolveImageUrl(rawUrl),
            isFavorite,
            isHidden,
            isEventCg: true,
        });
    }

    return list.reverse();
}

export async function toggleCgFavorite(cgKey, currentVal) {
    const nextVal = !currentVal;
    try {
        const dbMarks = await openDb(DB_CG_GALLERY, undefined, (db) => {
            if (!db.objectStoreNames.contains('marks')) db.createObjectStore('marks', { keyPath: 'key' });
        });
        const tx = dbMarks.transaction('marks', 'readwrite');
        const store = tx.objectStore('marks');
        const existing = await new Promise((res) => {
            const req = store.get(cgKey);
            req.onsuccess = () => res(req.result || { key: cgKey });
            req.onerror = () => res({ key: cgKey });
        });
        existing.favorite = nextVal;
        existing.updatedAt = new Date().toISOString();
        store.put(existing);
        dbMarks.close();
        return { ok: true, isFavorite: nextVal };
    } catch (err) {
        console.warn('[IGS-Patch] 切换收藏状态异常:', err);
        return { ok: false };
    }
}

export async function toggleCgHidden(cgKey, currentVal) {
    const nextVal = !currentVal;
    try {
        const dbMarks = await openDb(DB_CG_GALLERY, undefined, (db) => {
            if (!db.objectStoreNames.contains('marks')) db.createObjectStore('marks', { keyPath: 'key' });
        });
        const tx = dbMarks.transaction('marks', 'readwrite');
        const store = tx.objectStore('marks');
        const existing = await new Promise((res) => {
            const req = store.get(cgKey);
            req.onsuccess = () => res(req.result || { key: cgKey });
            req.onerror = () => res({ key: cgKey });
        });
        existing.hidden = nextVal;
        existing.updatedAt = new Date().toISOString();
        store.put(existing);
        dbMarks.close();
        return { ok: true, isHidden: nextVal };
    } catch (err) {
        console.warn('[IGS-Patch] 切换隐藏状态异常:', err);
        return { ok: false };
    }
}

export async function deleteCg(cgKey, isEventCg = false) {
    if (isEventCg) {
        const name = cgKey.replace('event_cg_', '');
        return updateSceneAssets((assets) => {
            if (assets.eventCgs) delete assets.eventCgs[name];
        });
    }

    try {
        const dbCg = await openDb(DB_ILLUSTRATIONS);
        const tx = dbCg.transaction('slots', 'readwrite');
        tx.objectStore('slots').delete(cgKey);
        dbCg.close();
        return true;
    } catch (err) {
        console.warn('[IGS-Patch] 删除 CG 异常:', err);
        return false;
    }
}

/* ========================================================================= */
/*                              道具与物品管理                                */
/* ========================================================================= */

export async function listItems() {
    const assets = getSceneAssets();
    const generatedItems = assets.generated?.items || {};
    const result = [];

    for (const [name, data] of Object.entries(generatedItems)) {
        if (!name) continue;
        const item = (data && typeof data === 'object') ? data : { url: String(data || '') };
        const rawUrl = item.url || item.image || '';

        result.push({
            name,
            desc: item.desc || '',
            rawUrl,
            resolvedUrl: await resolveImageUrl(rawUrl),
        });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

export function saveItem(name, rawUrl, desc = '') {
    return updateSceneAssets((assets) => {
        if (!assets.generated) assets.generated = {};
        if (!assets.generated.items) assets.generated.items = {};
        assets.generated.items[name] = { url: rawUrl, desc };
    });
}

export function deleteItem(name) {
    return updateSceneAssets((assets) => {
        if (assets.generated?.items) {
            delete assets.generated.items[name];
        }
    });
}

/* ========================================================================= */
/*                             待确认暂存素材池                               */
/* ========================================================================= */

export async function listStagingAssets() {
    const list = [];
    try {
        const db = await openDb(DB_GENERATED_ASSETS);
        if (db.objectStoreNames.contains('assets')) {
            const tx = db.transaction('assets', 'readonly');
            const all = await new Promise((res) => {
                const req = tx.objectStore('assets').getAll();
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => res([]);
            });

            for (const item of all) {
                if (item && item.status === 'temp') {
                    const rawUrl = item.imageId ? `igs-gen:${item.imageId}` : (item.dataUrl || '');
                    list.push({
                        key: item.key || item.id,
                        type: item.type || 'sprite',
                        name: item.name || '未命名',
                        rawUrl,
                        resolvedUrl: await resolveImageUrl(rawUrl),
                    });
                }
            }
        }
        db.close();
    } catch (_) { }

    return list;
}

export async function acceptStagingAsset(item, targetName, targetType) {
    const resolvedUrl = item.rawUrl;
    if (targetType === 'sprite') {
        saveCharacter(targetName, resolvedUrl);
    } else if (targetType === 'background') {
        saveScene(targetName, resolvedUrl);
    } else if (targetType === 'item') {
        saveItem(targetName, resolvedUrl);
    }
    await discardStagingAsset(item.key);
    return true;
}

export async function discardStagingAsset(key) {
    try {
        const db = await openDb(DB_GENERATED_ASSETS);
        const tx = db.transaction('assets', 'readwrite');
        tx.objectStore('assets').delete(key);
        db.close();
        return true;
    } catch (_) {
        return false;
    }
}

/* ========================================================================= */
/*                              文件转换辅助                                  */
/* ========================================================================= */

export function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}
