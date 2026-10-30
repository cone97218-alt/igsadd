/**
 * IGS 媒体资源中央服务 (Asset Service) - 完美对接版
 * 
 * 全面无缝对接 IGS 原生数据流与双轨架构：
 * 1. 作用域层级感知：支持「全部 (合并)」、「本卡 (专属)」、「全局 (通用)」三档模式
 * 2. 深度穿透 CharacterOutfits：彻底读取角色下的服装与多表情差分 (如 郁森·初始衣装 -> 平和)
 * 3. 角色元数据映射：支持 User 身份徽章、立绘基准高度调节、DNA/提示词备注
 * 4. 剧情 CG 画廊：对接 igs-illustrations 与标记库，完美区分已出图与待出图 (待生成)
 * 5. 场景背景与时段差分：全面支持分时段背景 (白天/深夜/清晨/黄昏)
 * 6. 换装衣柜与专属词：完整管理服装提示词 TAG 与参考图
 * 7. 道具图鉴与暂存池：账本道具与待入库素材
 * 8. 智能图片路径解析：支持 igs-gen:<id>、相对路径补全 (/user/images/...)、base64
 */

const STORAGE_KEY_BRIDGE = 'igs_bridge_config';
const DB_ILLUSTRATIONS = 'igs-illustrations';
const DB_CG_GALLERY = 'igs-cg-gallery';
const DB_GENERATED_ASSETS = 'igs-generated-assets';

function getStorage() {
    return window.localStorage;
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

/**
 * 获取底层原始的桥接配置
 */
export function getRawBridgeConfig() {
    try {
        const raw = getStorage().getItem(STORAGE_KEY_BRIDGE);
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        return {};
    }
}

/**
 * 持久化保存桥接配置并向 IGS 宿主广播
 */
export function saveRawBridgeConfig(bridge) {
    try {
        getStorage().setItem(STORAGE_KEY_BRIDGE, JSON.stringify(bridge));
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

/**
 * 探测当前酒馆激活的角色卡作用域 Key (如 card:Seraphina 或 group:xxx)
 */
export function getActiveCardScope() {
    for (const w of getCandidateWindows()) {
        try {
            const ctx = w.SillyTavern?.getContext?.();
            if (ctx) {
                if (ctx.groupId != null && String(ctx.groupId) !== '') {
                    return `group:${ctx.groupId}`;
                }
                const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
                const card = ctx.characterId != null ? chars[ctx.characterId] : null;
                const name = (card && card.name && String(card.name).trim()) || (ctx.name2 && String(ctx.name2).trim());
                if (name) return `card:${name}`;
            }
        } catch (_) { }
    }

    // 回退探测：从已保存的 cards 中寻找
    const bridge = getRawBridgeConfig();
    const cards = Object.keys(bridge.sceneAssets?.cards || {});
    const userCards = cards.filter(c => c !== 'card:SillyTavern System');
    if (userCards.length > 0) return userCards[0];
    return cards[0] || '';
}

/**
 * 获取全部已存在素材的角色卡列表
 */
export function getAvailableCardScopes() {
    const bridge = getRawBridgeConfig();
    const cardsObj = bridge.sceneAssets?.cards || {};
    return Object.keys(cardsObj).map(key => ({
        key,
        label: key.replace(/^card:/, '').replace(/^group:/, '群聊: '),
    }));
}

/**
 * 根据作用域模式 ('all' | 'card' | 'global') 获取有效素材视图
 */
export function getScopedSceneAssets(scopeMode = 'all', customScopeKey = null) {
    const bridge = getRawBridgeConfig();
    const root = bridge.sceneAssets || {};
    const scopeKey = customScopeKey || getActiveCardScope();
    const card = (scopeKey && root.cards && root.cards[scopeKey]) ? root.cards[scopeKey] : null;

    if (scopeMode === 'card') {
        if (!card) return emptyAssetCollection(scopeKey);
        return {
            characters: card.characters || {},
            characterOutfits: card.characterOutfits || {},
            characterDefaultOutfits: card.characterDefaultOutfits || {},
            characterSpriteNotes: card.characterSpriteNotes || {},
            characterSpriteScales: card.characterSpriteScales || root.characterSpriteScales || {},
            userCharacter: card.userCharacter || root.userCharacter || '',
            scenes: card.scenes || {},
            wardrobe: card.wardrobe || {},
            eventCgs: card.eventCgs || {},
            statusAvatars: card.statusAvatars || {},
            characterDna: card.characterDna || {},
            generated: card.generated || {},
            scopeKey,
        };
    }

    if (scopeMode === 'global') {
        return {
            characters: root.characters || {},
            characterOutfits: root.characterOutfits || {},
            characterDefaultOutfits: root.characterDefaultOutfits || {},
            characterSpriteNotes: root.characterSpriteNotes || {},
            characterSpriteScales: root.characterSpriteScales || {},
            userCharacter: root.userCharacter || '',
            scenes: root.scenes || {},
            wardrobe: root.wardrobe || {},
            eventCgs: root.eventCgs || {},
            statusAvatars: root.statusAvatars || {},
            characterDna: root.characterDna || {},
            generated: root.generated || {},
            scopeKey: '',
        };
    }

    // scopeMode === 'all' (合并模式：本卡优先，全局兜底)
    const cardOutfits = card?.characterOutfits || {};
    const rootOutfits = root.characterOutfits || {};
    const mergedOutfits = { ...rootOutfits };
    for (const [charName, outfits] of Object.entries(cardOutfits)) {
        mergedOutfits[charName] = { ...(mergedOutfits[charName] || {}), ...outfits };
    }

    return {
        characters: { ...(root.characters || {}), ...(card?.characters || {}) },
        characterOutfits: mergedOutfits,
        characterDefaultOutfits: { ...(root.characterDefaultOutfits || {}), ...(card?.characterDefaultOutfits || {}) },
        characterSpriteNotes: { ...(root.characterSpriteNotes || {}), ...(card?.characterSpriteNotes || {}) },
        characterSpriteScales: { ...(root.characterSpriteScales || {}), ...(card?.characterSpriteScales || {}) },
        userCharacter: card?.userCharacter || root.userCharacter || '',
        scenes: { ...(root.scenes || {}), ...(card?.scenes || {}) },
        wardrobe: { ...(root.wardrobe || {}), ...(card?.wardrobe || {}) },
        eventCgs: { ...(root.eventCgs || {}), ...(card?.eventCgs || {}) },
        statusAvatars: { ...(root.statusAvatars || {}), ...(card?.statusAvatars || {}) },
        characterDna: { ...(root.characterDna || {}), ...(card?.characterDna || {}) },
        generated: {
            scenes: { ...(root.generated?.scenes || {}), ...(card?.generated?.scenes || {}) },
            characters: { ...(root.generated?.characters || {}), ...(card?.generated?.characters || {}) },
            items: { ...(root.generated?.items || {}), ...(card?.generated?.items || {}) },
        },
        scopeKey,
    };
}

function emptyAssetCollection(scopeKey = '') {
    return {
        characters: {},
        characterOutfits: {},
        characterDefaultOutfits: {},
        characterSpriteNotes: {},
        characterSpriteScales: {},
        userCharacter: '',
        scenes: {},
        wardrobe: {},
        eventCgs: {},
        statusAvatars: {},
        characterDna: {},
        generated: {},
        scopeKey,
    };
}

/**
 * 向指定作用域写入素材配置
 */
export function updateScopedSceneAssets(updater, scopeMode = 'all', customScopeKey = null) {
    const bridge = getRawBridgeConfig();
    if (!bridge.sceneAssets || typeof bridge.sceneAssets !== 'object') {
        bridge.sceneAssets = {};
    }
    const root = bridge.sceneAssets;
    const scopeKey = customScopeKey || getActiveCardScope();

    if (scopeMode === 'card' && scopeKey) {
        if (!root.cards || typeof root.cards !== 'object') root.cards = {};
        if (!root.cards[scopeKey] || typeof root.cards[scopeKey] !== 'object') {
            root.cards[scopeKey] = emptyAssetCollection(scopeKey);
        }
        updater(root.cards[scopeKey]);
    } else if (scopeMode === 'global') {
        updater(root);
    } else {
        // scopeMode === 'all': 如果有激活的角色卡，优先写进当前卡；否则写进全局
        if (scopeKey) {
            if (!root.cards || typeof root.cards !== 'object') root.cards = {};
            if (!root.cards[scopeKey] || typeof root.cards[scopeKey] !== 'object') {
                root.cards[scopeKey] = emptyAssetCollection(scopeKey);
            }
            updater(root.cards[scopeKey]);
        } else {
            updater(root);
        }
    }

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
 * 将任意图片地址解析为可直接显示的绝对/完整 URL
 */
const resolvedImageCache = new Map();

export async function resolveImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let cleanUrl = url.trim();
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
            if (db.objectStoreNames.contains('images')) {
                const tx = db.transaction('images', 'readonly');
                const store = tx.objectStore('images');
                const record = await new Promise((res) => {
                    const r = store.get(imageId);
                    r.onsuccess = () => res(r.result);
                    r.onerror = () => res(null);
                });
                db.close();

                if (record && (record.dataUrl || record.originalDataUrl)) {
                    let finalUrl = record.dataUrl || record.originalDataUrl;
                    if (!finalUrl.startsWith('data:') && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('blob:') && !finalUrl.startsWith('/')) {
                        finalUrl = '/' + finalUrl;
                    }
                    resolvedImageCache.set(imageId, finalUrl);
                    return finalUrl;
                }
            } else {
                db.close();
            }
        } catch (_) { }

        // 回退补齐酒馆本地图片服务绝对路径
        const fallbackUrl = `/user/images/igs-media/${imageId}.png`;
        resolvedImageCache.set(imageId, fallbackUrl);
        return fallbackUrl;
    }

    // 相对路径规范化 (如 user/images/... -> /user/images/...)
    if (!cleanUrl.startsWith('/') && (cleanUrl.startsWith('user/') || cleanUrl.startsWith('scripts/') || cleanUrl.startsWith('public/'))) {
        return '/' + cleanUrl;
    }

    return cleanUrl;
}

/* ========================================================================= */
/*                              角色与立绘管理                                */
/* ========================================================================= */

/**
 * 完整拉取角色立绘体系：深度融合 CharacterOutfits、默认衣装与表情差分
 */
export async function listCharacters(scopeMode = 'all', customScopeKey = null) {
    const assets = getScopedSceneAssets(scopeMode, customScopeKey);
    const charsObj = assets.characters || {};
    const outfitsObj = assets.characterOutfits || {};
    const defaultOutfits = assets.characterDefaultOutfits || {};
    const spriteNotes = assets.characterSpriteNotes || {};
    const spriteScales = assets.characterSpriteScales || {};
    const statusAvatars = assets.statusAvatars || {};
    const userCharName = String(assets.userCharacter || '').trim();

    // 汇总所有被提及的角色名字集合
    const allNames = new Set([
        ...Object.keys(charsObj),
        ...Object.keys(outfitsObj),
        ...Object.keys(spriteNotes),
        ...Object.keys(statusAvatars),
    ].filter(Boolean));

    const result = [];

    for (const name of allNames) {
        const isUser = userCharName === name;
        const height = Number(spriteScales[name]) || 100;
        const rawAvatar = statusAvatars[name] || '';
        const resolvedAvatar = await resolveImageUrl(rawAvatar);
        const note = spriteNotes[name] || '';

        // 1. 解析该角色下的全部服装
        const charOutfits = outfitsObj[name] || {};
        const defaultOutfitName = defaultOutfits[name]?.outfitName || Object.keys(charOutfits)[0] || '默认衣装';
        const outfitsList = [];

        for (const [outfitName, outfitData] of Object.entries(charOutfits)) {
            const isDefault = outfitName === defaultOutfitName;
            const moodMap = (outfitData && typeof outfitData === 'object' && outfitData.moods) ? outfitData.moods : {};
            const moodList = [];

            for (const [moodName, moodUrl] of Object.entries(moodMap)) {
                if (!moodUrl) continue;
                moodList.push({
                    name: moodName,
                    rawUrl: moodUrl,
                    resolvedUrl: await resolveImageUrl(moodUrl),
                });
            }

            outfitsList.push({
                name: outfitName,
                isDefault,
                prompt: outfitData?.prompt || '',
                moods: moodList,
                count: moodList.length,
            });
        }

        // 2. 检查是否有直接挂在 characters[name] 下的独立差分 (兜底旧版格式)
        const directChar = charsObj[name];
        const directMoodsObj = (directChar && typeof directChar === 'object' && directChar.moods) ? directChar.moods
            : (directChar && typeof directChar === 'object') ? directChar : {};
        const directMoodsList = [];

        for (const [mName, mUrl] of Object.entries(directMoodsObj)) {
            if (typeof mUrl === 'string' && mUrl.trim()) {
                directMoodsList.push({
                    name: mName,
                    rawUrl: mUrl,
                    resolvedUrl: await resolveImageUrl(mUrl),
                });
            }
        }

        // 如果存在直接差分且没有对应服装，则合成一份基础默认服装
        if (directMoodsList.length && !outfitsList.length) {
            outfitsList.push({
                name: defaultOutfitName,
                isDefault: true,
                prompt: '',
                moods: directMoodsList,
                count: directMoodsList.length,
            });
        }

        // 计算该角色的主预览缩略图
        let baseResolvedUrl = resolvedAvatar;
        let baseRawUrl = rawAvatar;

        if (!baseResolvedUrl && outfitsList.length) {
            const defOutfit = outfitsList.find(o => o.isDefault) || outfitsList[0];
            const firstMood = defOutfit.moods.find(m => m.name === '平和') || defOutfit.moods[0];
            if (firstMood) {
                baseResolvedUrl = firstMood.resolvedUrl;
                baseRawUrl = firstMood.rawUrl;
            }
        }

        const totalDiffCount = outfitsList.reduce((acc, cur) => acc + cur.moods.length, 0);

        result.push({
            name,
            isUser,
            height,
            avatarUrl: resolvedAvatar,
            baseRawUrl,
            baseResolvedUrl,
            note,
            outfits: outfitsList,
            moodCount: totalDiffCount,
            activeOutfitIndex: 0,
        });
    }

    return result.sort((a, b) => {
        if (a.isUser && !b.isUser) return -1;
        if (!a.isUser && b.isUser) return 1;
        return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
}

/**
 * 新增/保存角色
 */
export function saveCharacter(name, baseRawUrl = '', scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (!assets.characters) assets.characters = {};
        if (!assets.characters[name]) assets.characters[name] = {};
        if (!assets.characterOutfits) assets.characterOutfits = {};
        const defOutfitName = `${name}·初始衣装`;
        if (!assets.characterOutfits[name]) {
            assets.characterOutfits[name] = {
                [defOutfitName]: {
                    words: [],
                    moods: baseRawUrl ? { '平和': baseRawUrl } : {},
                    legacyOriginal: 1,
                    wardrobe: defOutfitName,
                }
            };
        }
        if (!assets.characterDefaultOutfits) assets.characterDefaultOutfits = {};
        assets.characterDefaultOutfits[name] = { version: 1, outfitName: defOutfitName, migrated: true };
    }, scopeMode);
}

/**
 * 删除角色
 */
export function deleteCharacter(name, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (assets.characters) delete assets.characters[name];
        if (assets.characterOutfits) delete assets.characterOutfits[name];
        if (assets.characterDefaultOutfits) delete assets.characterDefaultOutfits[name];
        if (assets.characterSpriteNotes) delete assets.characterSpriteNotes[name];
        if (assets.characterSpriteScales) delete assets.characterSpriteScales[name];
        if (assets.statusAvatars) delete assets.statusAvatars[name];
        if (assets.userCharacter === name) assets.userCharacter = '';
    }, scopeMode);
}

/**
 * 设为 User 主角立绘
 */
export function setUserCharacter(name, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        assets.userCharacter = name;
    }, scopeMode);
}

/**
 * 设置立绘基准高度
 */
export function setCharacterHeight(name, height, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (!assets.characterSpriteScales) assets.characterSpriteScales = {};
        assets.characterSpriteScales[name] = Number(height) || 100;
    }, scopeMode);
}

/**
 * 保存角色服装 (Outfit)
 */
export function saveCharacterOutfit(charName, outfitName, prompt = '', isDefault = false, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (!assets.characterOutfits) assets.characterOutfits = {};
        if (!assets.characterOutfits[charName]) assets.characterOutfits[charName] = {};
        const oldOutfit = assets.characterOutfits[charName][outfitName] || {};
        assets.characterOutfits[charName][outfitName] = {
            ...oldOutfit,
            words: [],
            prompt,
            moods: oldOutfit.moods || {},
            wardrobe: outfitName,
        };
        if (isDefault) {
            if (!assets.characterDefaultOutfits) assets.characterDefaultOutfits = {};
            assets.characterDefaultOutfits[charName] = { version: 1, outfitName, migrated: true };
        }
    }, scopeMode);
}

/**
 * 删除角色服装
 */
export function deleteCharacterOutfit(charName, outfitName, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (assets.characterOutfits?.[charName]) {
            delete assets.characterOutfits[charName][outfitName];
        }
    }, scopeMode);
}

/**
 * 保存角色特定服装下的表情差分
 */
export function saveCharacterMood(characterName, moodName, moodRawUrl, outfitName = '', scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (!assets.characterOutfits) assets.characterOutfits = {};
        if (!assets.characterOutfits[characterName]) assets.characterOutfits[characterName] = {};
        
        let targetOutfit = outfitName;
        if (!targetOutfit) {
            const def = assets.characterDefaultOutfits?.[characterName]?.outfitName;
            targetOutfit = def || Object.keys(assets.characterOutfits[characterName])[0] || `${characterName}·初始衣装`;
        }

        if (!assets.characterOutfits[characterName][targetOutfit]) {
            assets.characterOutfits[characterName][targetOutfit] = { words: [], moods: {}, wardrobe: targetOutfit };
        }
        if (!assets.characterOutfits[characterName][targetOutfit].moods) {
            assets.characterOutfits[characterName][targetOutfit].moods = {};
        }
        assets.characterOutfits[characterName][targetOutfit].moods[moodName] = moodRawUrl;
    }, scopeMode);
}

/**
 * 删除角色差分
 */
export function deleteCharacterMood(characterName, moodName, outfitName = '', scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (assets.characterOutfits?.[characterName]) {
            if (outfitName && assets.characterOutfits[characterName][outfitName]?.moods) {
                delete assets.characterOutfits[characterName][outfitName].moods[moodName];
            } else {
                for (const o of Object.values(assets.characterOutfits[characterName])) {
                    if (o.moods && o.moods[moodName]) delete o.moods[moodName];
                }
            }
        }
        // 兜底删除直接差分
        if (assets.characters?.[characterName]?.[moodName]) {
            delete assets.characters[characterName][moodName];
        }
    }, scopeMode);
}

/* ========================================================================= */
/*                              场景与背景管理                                */
/* ========================================================================= */

export async function listScenes(scopeMode = 'all', customScopeKey = null) {
    const assets = getScopedSceneAssets(scopeMode, customScopeKey);
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
            const tUrl = typeof timeVal === 'string' ? timeVal : (timeVal?.url || '');
            if (!tUrl) continue;
            timesList.push({
                name: timeName,
                rawUrl: tUrl,
                resolvedUrl: await resolveImageUrl(tUrl),
                desc: typeof timeVal === 'object' ? (timeVal.desc || '') : '',
            });
        }

        result.push({
            name,
            desc: sceneData.desc || '',
            baseRawUrl,
            baseResolvedUrl: baseResolved,
            timeCount: timesList.length,
            times: timesList,
        });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

export function saveScene(name, baseRawUrl, desc = '', scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (!assets.scenes) assets.scenes = {};
        if (!assets.scenes[name]) {
            assets.scenes[name] = { url: baseRawUrl, desc, times: {} };
        } else if (typeof assets.scenes[name] === 'object') {
            assets.scenes[name].url = baseRawUrl;
            if (desc) assets.scenes[name].desc = desc;
        } else {
            assets.scenes[name] = { url: baseRawUrl, desc, times: {} };
        }
    }, scopeMode);
}

export function deleteScene(name, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (assets.scenes) delete assets.scenes[name];
    }, scopeMode);
}

export function saveSceneTime(sceneName, timeName, timeRawUrl, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (!assets.scenes) assets.scenes = {};
        let sceneObj = assets.scenes[sceneName];
        if (!sceneObj || typeof sceneObj !== 'object') {
            sceneObj = { url: '', desc: '', times: {} };
            assets.scenes[sceneName] = sceneObj;
        }
        if (!sceneObj.times) sceneObj.times = {};
        sceneObj.times[timeName] = timeRawUrl;
    }, scopeMode);
}

export function deleteSceneTime(sceneName, timeName, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        const sceneObj = assets.scenes?.[sceneName];
        if (sceneObj && sceneObj.times) {
            delete sceneObj.times[timeName];
        }
    }, scopeMode);
}

/* ========================================================================= */
/*                              换装衣柜管理                                  */
/* ========================================================================= */

export async function listWardrobe(scopeMode = 'all', customScopeKey = null) {
    const assets = getScopedSceneAssets(scopeMode, customScopeKey);
    const wardrobeObj = assets.wardrobe || {};
    const result = [];

    for (const [name, data] of Object.entries(wardrobeObj)) {
        if (!name) continue;
        const item = (data && typeof data === 'object') ? data : { prompt: String(data || '') };
        const rawUrl = item.image || item.rawUrl || item.url || '';

        result.push({
            name,
            character: item.character || '',
            prompt: item.prompt || '',
            rawUrl,
            resolvedUrl: await resolveImageUrl(rawUrl),
            scenes: Array.isArray(item.scenes) ? item.scenes : [],
        });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

export function saveWardrobeItem(name, itemData, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (!assets.wardrobe) assets.wardrobe = {};
        assets.wardrobe[name] = {
            name,
            character: itemData.character || '',
            prompt: itemData.prompt || '',
            image: itemData.rawUrl || itemData.image || '',
            scenes: Array.isArray(itemData.scenes) ? itemData.scenes : [],
        };
    }, scopeMode);
}

export function deleteWardrobeItem(name, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (assets.wardrobe) delete assets.wardrobe[name];
    }, scopeMode);
}

/* ========================================================================= */
/*                            剧情 CG 与画廊管理                             */
/* ========================================================================= */

export async function listAllCgs(filter = 'all') {
    const list = [];

    // 1. 读取 IndexedDB igs-cg-gallery 收藏/隐藏标记
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

    // 2. 读取 IndexedDB igs-illustrations 中的插图槽位记录
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
                const isHidden = mark.hidden === true || s.hidden === true;
                const isFavorite = mark.favorite === true || s.favorite === true;

                if (filter === 'favorites' && !isFavorite) continue;
                if (filter === 'hidden' && !isHidden) continue;
                if (filter === 'all' && isHidden) continue;

                const rawDataUrl = s.dataUrl || s.imageUrl || s.originalDataUrl || '';
                const parts = String(s.floorKey || '').split('|');
                const floorNo = parts.length >= 2 ? parts[parts.length - 2] : '';
                const isPending = (s.status === 'pending') || (!rawDataUrl);

                // 提取完整生图描述与提示词
                let fullPrompt = s.prompt || s.caption || '';
                if (!fullPrompt && (s.scene || s.chars)) {
                    const charTags = Array.isArray(s.chars) ? s.chars.map(c => c.tags).filter(Boolean).join(', ') : '';
                    fullPrompt = [s.scene, charTags].filter(Boolean).join('\n');
                }

                list.push({
                    key: s.key,
                    floorKey: s.floorKey || '',
                    slot: s.slot || 1,
                    label: floorNo ? `第 ${floorNo} 楼` : s.key,
                    prompt: fullPrompt,
                    description: s.description || s.analysis || '',
                    status: s.status || (rawDataUrl ? 'done' : 'pending'),
                    isPending,
                    rawUrl: rawDataUrl,
                    resolvedUrl: isPending ? '' : await resolveImageUrl(rawDataUrl),
                    isFavorite,
                    isHidden,
                    isEventCg: false,
                });
            }
        }
        dbCg.close();
    } catch (_) { }

    // 3. 读取 sceneAssets.eventCgs (预置/事件 CG)
    const assets = getScopedSceneAssets('all');
    const eventCgs = assets.eventCgs || {};
    for (const [name, item] of Object.entries(eventCgs)) {
        if (!name) continue;
        const rawUrl = typeof item === 'string' ? item : (item?.url || '');
        if (filter === 'hidden') continue;

        list.push({
            key: `event_cg_${name}`,
            label: name,
            prompt: typeof item === 'object' ? (item.prompt || '') : '',
            description: '预置事件CG',
            status: 'done',
            isPending: false,
            rawUrl,
            resolvedUrl: await resolveImageUrl(rawUrl),
            isFavorite: true,
            isHidden: false,
            isEventCg: true,
        });
    }

    return list;
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
        return updateScopedSceneAssets((assets) => {
            if (assets.eventCgs) delete assets.eventCgs[name];
        }, 'all');
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

export async function listItems(scopeMode = 'all', customScopeKey = null) {
    const assets = getScopedSceneAssets(scopeMode, customScopeKey);
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

export function saveItem(name, rawUrl, desc = '', scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (!assets.generated) assets.generated = {};
        if (!assets.generated.items) assets.generated.items = {};
        assets.generated.items[name] = { url: rawUrl, desc };
    }, scopeMode);
}

export function deleteItem(name, scopeMode = 'all') {
    return updateScopedSceneAssets((assets) => {
        if (assets.generated?.items) {
            delete assets.generated.items[name];
        }
    }, scopeMode);
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
