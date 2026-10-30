/**
 * 柏宝书 ST-BaiBai-Book 虚拟数据库适配桥 (Virtual Shujuku Adapter)
 * 
 * 核心机制：
 * 1. 虚拟注入 / 接管 window.AutoCardUpdaterAPI。
 * 2. 将柏宝书的现代只读 DTO (API v1) 动态映射为 IGS 识别的结构化虚拟表：
 *    - sheet_chars (重要角色表): 主角与 NPC 外貌特征、服装线索、当下想法与好感态度。
 *    - sheet_stats (状态数值表): 经过严格白名单过滤的纯数值属性 (HP/MP/金币等)，杜绝长文本与剧情变量污染状态栏。
 *    - sheet_map (场景地点表): 当前环境时空、地点层级与天气。
 *    - sheet_inventory (物品背包表): 随身携带与存放的道具装备。
 * 3. 支持细粒度楼层回溯：根据正在放映的楼层实时调用 STBaiBaiBook.getSnapshot({ floor })。
 * 4. 侦听 st-baibai-book:changed 事件，当摘要刷新时自动通知 IGS 更新视图。
 */

import { patchState, notifyStateChange } from '../state/state.js';
import { notifyToast } from '../ui/toast.js';

// 获取全局的 STBaiBaiBook 接口
export function getBaiBaiBookApi() {
    for (const w of getCandidateWindows()) {
        try {
            if (w.STBaiBaiBook && typeof w.STBaiBaiBook.getSnapshot === 'function') {
                return w.STBaiBaiBook;
            }
        } catch (_) { }
    }
    return null;
}

function getCandidateWindows() {
    const wins = [window];
    try {
        if (window.parent && !wins.includes(window.parent)) wins.push(window.parent);
    } catch (_) { }
    try {
        if (window.top && !wins.includes(window.top)) wins.push(window.top);
    } catch (_) { }
    try {
        const rootDoc = (window.top || window.parent || window).document;
        if (rootDoc) {
            const iframes = rootDoc.querySelectorAll('iframe');
            for (const f of iframes) {
                try {
                    const fw = f.contentWindow;
                    if (fw && !wins.includes(fw)) wins.push(fw);
                } catch (_) { }
            }
        }
    } catch (_) { }
    return wins;
}

/**
 * 判断一个值是否是纯数值类指标（供状态栏 HUD 白名单使用）
 * 允许：纯数字、带正负号的小数、分数字符串(如 80/100)、百分比(如 95%)
 * 严格拒绝：布尔值、长文本剧情叙述、数组/对象、包含标点符号的陈述句
 */
export function isNumericMetricValue(val) {
    if (typeof val === 'number') {
        return Number.isFinite(val);
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed || trimmed.length > 12) return false;
        // 排除句子标点与陈述符号
        if (/[。，！？,!?、\n\r\t:：]/.test(trimmed)) return false;
        // 匹配：100, -25.5, +10, 80/100, 95%
        return /^[-+]?\d+(?:\.\d+)?(?:\s*[\/%]\s*\d+(?:\.\d+)?)?$/.test(trimmed);
    }
    return false;
}

/**
 * 从柏宝书的 vars 树中递归提取所有经过白名单过滤的纯数值变量
 */
export function extractFilteredNumericVars(varsTree) {
    const list = [];
    if (!varsTree || typeof varsTree !== 'object') return list;

    function walk(node, prefix = '') {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return;

        for (const [key, val] of Object.entries(node)) {
            const fullPath = prefix ? `${prefix}.${key}` : key;
            if (isNumericMetricValue(val)) {
                // 清洗出易读的短标签（例如 "队伍.爱丽丝.好感度" -> "爱丽丝-好感度"）
                let label = key;
                if (prefix) {
                    const parts = fullPath.split('.');
                    label = parts.length > 2 ? `${parts[parts.length - 2]}-${parts[parts.length - 1]}` : fullPath;
                }
                list.push({
                    path: fullPath,
                    label,
                    value: typeof val === 'number' ? String(val) : String(val).trim(),
                });
            } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                walk(val, fullPath);
            }
        }
    }

    walk(varsTree);
    return list;
}

// 缓存上一次转换的虚拟表数据
let cachedFloorSnapshot = null;
let cachedFloorTables = null;
let cachedRevision = -1;

/**
 * 将柏宝书的快照 DTO 实时映射为 IGS 标准结构化表
 */
export function convertSnapshotToIgsTables(snapshot) {
    if (!snapshot) return {};

    const state = snapshot.state || {};
    const proto = snapshot.protagonist || {};
    const npcs = Array.isArray(snapshot.npcs) ? snapshot.npcs : [];
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const scenes = Array.isArray(snapshot.scenes) ? snapshot.scenes : [];
    const vars = snapshot.vars || {};

    const protoName = proto.identity || '主角';

    // 1. 重要角色表 (包含外貌、服装线索、好感度、当下想法)
    const charColumns = [
        '姓名', '性别', '年龄', '外貌特征', '穿着打扮', '所在地点', 
        '当下想法', '内心好感', '外在态度', '角色类型', '一句话介绍'
    ];
    const charRows = [];

    // 主角行
    charRows.push([
        protoName,
        proto.gender || '',
        proto.age || '',
        proto.appearance || '',
        proto.outfit || '',
        state.location || '',
        proto.condition || '',
        '',
        '',
        '主角',
        proto.identity || '主角'
    ]);

    // NPC 列表行
    for (const n of npcs) {
        if (!n || !n.name) continue;
        charRows.push([
            n.name,
            n.gender || '',
            n.age || '',
            n.desc || '',
            n.outfit || '',
            n.location || state.location || '',
            n.affinityNote || '',
            n.affinityInner != null ? String(n.affinityInner) : '',
            n.affinityOuter != null ? String(n.affinityOuter) : '',
            n.important ? '主要角色' : 'NPC',
            n.title || ''
        ]);
    }

    const sheetChars = {
        uid: 'sheet_chars',
        name: '重要角色表',
        orderNo: 1,
        content: [charColumns, ...charRows]
    };

    // 2. 状态数值表 (只映射严格白名单过滤后的纯数值属性)
    const numericVars = extractFilteredNumericVars(vars);
    let statsColumns = ['姓名'];
    let statsProtoRow = [protoName];
    let statsUserRow = ['user'];

    if (numericVars.length > 0) {
        for (const item of numericVars) {
            statsColumns.push(item.label);
            statsProtoRow.push(item.value);
            statsUserRow.push(item.value);
        }
    } else {
        // 兜底属性列，保证表结构完整
        statsColumns.push('状态');
        statsProtoRow.push('正常');
        statsUserRow.push('正常');
    }

    const sheetStats = {
        uid: 'sheet_stats',
        name: '状态数值表',
        orderNo: 2,
        content: [statsColumns, statsProtoRow, statsUserRow]
    };

    // 3. 场景地点表 (地图与时空)
    const mapColumns = ['row_id', '上级地点ID', '地点名称', 'x', 'y', '场景描述'];
    const mapRows = [];

    if (scenes.length > 0) {
        scenes.forEach((sc, idx) => {
            mapRows.push([
                sc.id || String(idx + 1),
                sc.parentId || '',
                sc.name || '',
                '0.5',
                '0.5',
                sc.desc || ''
            ]);
        });
    } else {
        mapRows.push([
            '1',
            '',
            state.location || '当前地点',
            '0.5',
            '0.5',
            state.time ? `时段: ${state.time}` : ''
        ]);
    }

    const sheetMap = {
        uid: 'sheet_map',
        name: '场景地点表',
        orderNo: 3,
        content: [mapColumns, ...mapRows]
    };

    // 4. 物品背包表
    const itemColumns = ['物品名称', '数量', '物品状态', '持有者', '描述'];
    const itemRows = [];

    for (const it of items) {
        if (!it || !it.name) continue;
        itemRows.push([
            it.name,
            it.qty != null ? String(it.qty) : '1',
            it.carried ? '装备中' : '背包',
            protoName,
            it.desc || ''
        ]);
    }

    const sheetInventory = {
        uid: 'sheet_inventory',
        name: '物品背包表',
        orderNo: 4,
        content: [itemColumns, ...itemRows]
    };

    return {
        sheet_chars: sheetChars,
        sheet_stats: sheetStats,
        sheet_map: sheetMap,
        sheet_inventory: sheetInventory,
    };
}

/**
 * 虚拟 AutoCardUpdaterAPI 实现
 */
class VirtualAutoCardUpdaterAPI {
    constructor() {
        this.callbacks = new Set();
        this._setupEventListener();
    }

    _setupEventListener() {
        for (const w of getCandidateWindows()) {
            try {
                w.addEventListener('st-baibai-book:changed', () => {
                    this._triggerCallbacks();
                });
            } catch (_) { }
        }
    }

    _triggerCallbacks() {
        // 清除快照缓存
        cachedFloorSnapshot = null;
        cachedFloorTables = null;

        for (const cb of this.callbacks) {
            try {
                if (typeof cb === 'function') cb();
            } catch (err) {
                console.warn('[IGS-Patch] 数据库更新回调异常:', err);
            }
        }
    }

    /**
     * 核心导出方法：IGS 读取表格数据时调用
     */
    exportTableAsJson() {
        const bookApi = getBaiBaiBookApi();
        if (!bookApi) {
            return {};
        }

        try {
            // 获取当前楼层快照
            const snapshot = bookApi.getSnapshot();
            if (!snapshot) return {};

            if (cachedRevision === snapshot.revision && cachedFloorTables) {
                return cachedFloorTables;
            }

            cachedRevision = snapshot.revision;
            cachedFloorSnapshot = snapshot;
            cachedFloorTables = convertSnapshotToIgsTables(snapshot);

            return cachedFloorTables;
        } catch (e) {
            console.error('[IGS-Patch] 导出柏宝书虚拟表异常:', e);
            return {};
        }
    }

    // 虚拟只读无害实现
    async updateCell(tableName, rowIndex, colName, value) {
        return { success: true, simulated: true };
    }

    async updateRow(tableName, rowIndex, patch) {
        return { success: true, simulated: true };
    }

    async insertRow(tableName, rowData) {
        return { success: true, simulated: true };
    }

    async deleteRow(tableName, rowIndex) {
        return { success: true, simulated: true };
    }

    async refreshDataAndWorldbook() {
        return { success: true, simulated: true };
    }

    registerTableUpdateCallback(cb) {
        if (typeof cb === 'function') {
            this.callbacks.add(cb);
        }
    }

    unregisterTableUpdateCallback(cb) {
        this.callbacks.delete(cb);
    }
}

let virtualApiInstance = null;

/**
 * 安装或激活柏宝书数据库桥接
 */
export function setupBaiBaiBookBridge() {
    const bookApi = getBaiBaiBookApi();
    if (!virtualApiInstance) {
        virtualApiInstance = new VirtualAutoCardUpdaterAPI();
    }

    for (const w of getCandidateWindows()) {
        try {
            // 无论宿主是否已有 AutoCardUpdaterAPI，只要激活了柏宝书模式，就挂载桥接器
            w.AutoCardUpdaterAPI = virtualApiInstance;
            w.__IGS_VIRTUAL_SHUJUKU__ = virtualApiInstance;
        } catch (_) { }
    }

    if (bookApi) {
        console.info(`[IGS-Patch] 柏宝书虚拟数据库桥接就绪 - 插件版本: ${bookApi.pluginVersion || 'v1'}`);
    } else {
        console.info('[IGS-Patch] 柏宝书虚拟数据库桥接已挂载 (等待柏宝书就绪)');
        for (const w of getCandidateWindows()) {
            try {
                w.addEventListener('st-baibai-book:ready', () => {
                    console.info('[IGS-Patch] 侦测到柏宝书已挂载，虚拟数据库桥接已激活。');
                    virtualApiInstance._triggerCallbacks();
                    notifyStateChange();
                }, { once: true });
            } catch (_) { }
        }
    }
}
