(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/tauri/adapter.js
  var adapter_exports = {};
  __export(adapter_exports, {
    deleteStoredJson: () => deleteStoredJson,
    findLastMessage: () => findLastMessage,
    getActiveChatId: () => getActiveChatId,
    getExtensionMetadata: () => getExtensionMetadata,
    getStoredJson: () => getStoredJson,
    getTauriHandle: () => getTauriHandle,
    listStoredKeys: () => listStoredKeys,
    searchMessages: () => searchMessages,
    setExtensionMetadata: () => setExtensionMetadata,
    setStoredJson: () => setStoredJson
  });
  async function getTauriHandle() {
    try {
      const tauriReady = window.__TAURITAVERN__?.ready ?? window.__TAURITAVERN_MAIN_READY__;
      if (tauriReady) {
        await tauriReady;
      }
      const api = window.__TAURITAVERN__?.api?.chat;
      if (!api || !api.current || typeof api.current.handle !== "function") {
        return null;
      }
      return api.current.handle();
    } catch (err) {
      console.warn("[IGS-Patch] \u83B7\u53D6 TauriTavern Handle \u5931\u8D25:", err);
      return null;
    }
  }
  async function findLastMessage(options = {}) {
    const handle = await getTauriHandle();
    if (!handle?.locate?.findLastMessage) {
      return fallbackFindLastMessage(options);
    }
    return handle.locate.findLastMessage({
      role: options.role || "assistant",
      hasExtraKeys: options.hasExtraKeys,
      scanLimit: options.scanLimit || 2e3
    });
  }
  async function searchMessages(query, filters = {}) {
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
        scanLimit: filters.scanLimit || 5e3
      }
    });
  }
  async function getStoredJson(key) {
    const handle = await getTauriHandle();
    if (!handle?.store?.getJson) {
      const storage = typeof window !== "undefined" ? window.localStorage : null;
      const raw = storage?.getItem(`tauri_fallback:${NAMESPACE}:${key}`);
      return raw ? JSON.parse(raw) : null;
    }
    return handle.store.getJson({ namespace: NAMESPACE, key });
  }
  async function setStoredJson(key, value) {
    const handle = await getTauriHandle();
    if (!handle?.store?.setJson) {
      const storage = typeof window !== "undefined" ? window.localStorage : null;
      storage?.setItem(`tauri_fallback:${NAMESPACE}:${key}`, JSON.stringify(value));
      return;
    }
    return handle.store.setJson({ namespace: NAMESPACE, key, value });
  }
  async function listStoredKeys() {
    const handle = await getTauriHandle();
    if (!handle?.store?.listKeys) {
      const storage = typeof window !== "undefined" ? window.localStorage : null;
      if (!storage) return [];
      return Object.keys(storage).filter((k) => k.startsWith(`tauri_fallback:${NAMESPACE}:`)).map((k) => k.replace(`tauri_fallback:${NAMESPACE}:`, ""));
    }
    return handle.store.listKeys({ namespace: NAMESPACE });
  }
  async function deleteStoredJson(key) {
    const handle = await getTauriHandle();
    if (!handle?.store?.deleteJson) {
      const storage = typeof window !== "undefined" ? window.localStorage : null;
      storage?.removeItem(`tauri_fallback:${NAMESPACE}:${key}`);
      return;
    }
    return handle.store.deleteJson({ namespace: NAMESPACE, key });
  }
  async function getExtensionMetadata() {
    const handle = await getTauriHandle();
    if (!handle?.metadata?.get) return null;
    const meta = await handle.metadata.get();
    return meta?.extensions?.[NAMESPACE] || null;
  }
  async function setExtensionMetadata(value) {
    const handle = await getTauriHandle();
    if (!handle?.metadata?.setExtension) return;
    return handle.metadata.setExtension({ namespace: NAMESPACE, value });
  }
  function getActiveChatId() {
    const wins = [window];
    try {
      if (window.parent && !wins.includes(window.parent)) wins.push(window.parent);
    } catch (_) {
    }
    try {
      if (window.top && !wins.includes(window.top)) wins.push(window.top);
    } catch (_) {
    }
    for (const w of wins) {
      try {
        const ctx = w.SillyTavern?.getContext?.();
        if (ctx) {
          if (ctx.chatId) return String(ctx.chatId);
          if (ctx.groupId != null && String(ctx.groupId) !== "") return `group_${ctx.groupId}`;
          if (ctx.characterId != null) {
            const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
            const card = chars[ctx.characterId];
            if (card?.name) return `char_${card.name}`;
            return `char_${ctx.characterId}`;
          }
        }
      } catch (_) {
      }
    }
    return "default";
  }
  function fallbackFindLastMessage(options = {}) {
    const chat = window.SillyTavern?.getContext?.()?.chat;
    if (!Array.isArray(chat) || chat.length === 0) return null;
    const limit = options.scanLimit || 2e3;
    const start = Math.max(0, chat.length - limit);
    for (let i = chat.length - 1; i >= start; i--) {
      const msg = chat[i];
      if (!msg) continue;
      if (options.role === "assistant" && (msg.is_user || msg.is_system)) continue;
      if (options.role === "user" && !msg.is_user) continue;
      if (Array.isArray(options.hasExtraKeys)) {
        const hasAll = options.hasExtraKeys.every((k) => msg.extra && Object.hasOwn(msg.extra, k));
        if (!hasAll) continue;
      }
      return { index: i, message: msg };
    }
    return null;
  }
  var NAMESPACE;
  var init_adapter = __esm({
    "src/tauri/adapter.js"() {
      NAMESPACE = "igs_gal";
    }
  });

  // src/state/state.js
  function subscribeState(listener) {
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
  }
  function notifyStateChange() {
    for (const listener of stateListeners) {
      try {
        listener(patchState);
      } catch (e) {
        console.warn("[IGS-Patch] \u72B6\u6001\u76D1\u542C\u5668\u6267\u884C\u5F02\u5E38:", e);
      }
    }
  }
  async function initConfig() {
    try {
      const savedMode = localStorage.getItem(STORAGE_KEY_PROD_MODE);
      if (savedMode === "manual" || savedMode === "auto") {
        patchState.productionMode = savedMode;
      }
      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
      if (savedTheme) {
        patchState.theme = savedTheme;
      } else {
        detectAndSyncIgsTheme();
      }
    } catch (_) {
    }
    notifyStateChange();
  }
  function setProductionMode(mode) {
    if (mode !== "auto" && mode !== "manual") return;
    patchState.productionMode = mode;
    try {
      localStorage.setItem(STORAGE_KEY_PROD_MODE, mode);
    } catch (_) {
    }
    notifyStateChange();
  }
  function saveInterceptedRule(key, content, meta = {}) {
    if (!key || !content) return;
    const strContent = String(content).trim();
    if (!strContent) return;
    patchState.interceptedPrompt.rawKeys[key] = {
      content: strContent,
      meta,
      at: Date.now()
    };
    if (key === "igs-scene-assets-format-rule") {
      patchState.interceptedPrompt.system = strContent;
    } else if (key === "igs-scene-assets-depth0") {
      patchState.interceptedPrompt.depth0 = strContent;
    } else {
      const existingIdx = patchState.interceptedPrompt.segments.findIndex((s) => s.id === key);
      if (existingIdx >= 0) {
        patchState.interceptedPrompt.segments[existingIdx] = { id: key, content: strContent, meta };
      } else {
        patchState.interceptedPrompt.segments.push({ id: key, content: strContent, meta });
      }
    }
    patchState.interceptedPrompt.updatedAt = Date.now();
    patchState.interceptedPrompt.charCount = (patchState.interceptedPrompt.system.length || 0) + (patchState.interceptedPrompt.depth0.length || 0) + patchState.interceptedPrompt.segments.reduce((acc, s) => acc + (s.content?.length || 0), 0);
    console.info(`[IGS-Patch] \u5DF2\u6210\u529F\u622A\u83B7\u5E76\u66F4\u65B0 IGS \u6807\u7B7E\u89C4\u5219 [${key}]\uFF0C\u5F53\u524D\u62E6\u622A\u89C4\u5219\u603B\u5B57\u6570: ${patchState.interceptedPrompt.charCount}`);
    notifyStateChange();
  }
  function updateProductionStatus(partial) {
    Object.assign(patchState.productionStatus, partial);
    notifyStateChange();
  }
  function setTheme(themeName) {
    patchState.theme = themeName;
    try {
      localStorage.setItem(STORAGE_KEY_THEME, themeName);
    } catch (_) {
    }
    notifyStateChange();
  }
  function detectAndSyncIgsTheme() {
    try {
      const candidates = [window, window.parent, window.top].filter(Boolean);
      for (const w of candidates) {
        const igs = w.IGS || w.ImmersiveGalgameSystem;
        const settings = igs?.getUnifiedSettings?.();
        const igsTheme = settings?.bridge?.settingsTheme || localStorage.getItem("igs:settings:theme");
        if (igsTheme) {
          patchState.theme = igsTheme;
          return igsTheme;
        }
      }
    } catch (_) {
    }
    return patchState.theme;
  }
  var STORAGE_KEY_PROD_MODE, STORAGE_KEY_THEME, patchState, stateListeners;
  var init_state = __esm({
    "src/state/state.js"() {
      init_adapter();
      STORAGE_KEY_PROD_MODE = "igs:patch:production_mode";
      STORAGE_KEY_THEME = "igs:patch:ui_theme";
      patchState = {
        // 制作模式：'auto' (自动制作) | 'manual' (手动制作)
        productionMode: "auto",
        // 拦截到的 IGS 原生提示词与标签规则
        interceptedPrompt: {
          system: "",
          depth0: "",
          segments: [],
          rawKeys: {},
          updatedAt: null,
          charCount: 0
        },
        // 演出制作运行时状态
        productionStatus: {
          isProducing: false,
          floor: null,
          progress: "",
          error: null,
          lastSuccessAt: null
        },
        // UI 配色主题：'cream' | 'light' | 'landmine' | 'dark'
        theme: "cream"
      };
      stateListeners = /* @__PURE__ */ new Set();
    }
  });

  // src/prompt-presets/preset-manager.js
  function getPromptPreset() {
    if (currentPreset) return currentPreset;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.floorRegexRules)) {
          ensureFixedSlots(parsed.items);
          currentPreset = parsed;
          return currentPreset;
        }
      }
    } catch (_) {
    }
    currentPreset = JSON.parse(JSON.stringify(DEFAULT_PROMPT_PRESET));
    return currentPreset;
  }
  function savePromptPreset(preset) {
    if (!preset || !Array.isArray(preset.items)) return;
    ensureFixedSlots(preset.items);
    currentPreset = preset;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preset));
    } catch (_) {
    }
  }
  function resetPromptPreset() {
    currentPreset = JSON.parse(JSON.stringify(DEFAULT_PROMPT_PRESET));
    savePromptPreset(currentPreset);
    return currentPreset;
  }
  function ensureFixedSlots(items) {
    const hasIgs = items.some((it) => it.type === "slot_igs_rules");
    if (!hasIgs) {
      items.unshift({
        id: "slot_igs_rules",
        type: "slot_igs_rules",
        role: "system",
        name: "\u4E3B\u811A\u672C\u63D0\u793A\u8BCD",
        enabled: true,
        removable: false
      });
    }
    const hasFloor = items.some((it) => it.type === "slot_floor_text");
    if (!hasFloor) {
      items.push({
        id: "slot_floor_text",
        type: "slot_floor_text",
        role: "user",
        name: "\u697C\u5C42\u539F\u6587",
        prefix: "\u3010\u5C0F\u8BF4\u539F\u6587\u3011\n",
        suffix: "",
        enabled: true,
        removable: false
      });
    }
  }
  function clipFloorText(rawText, customRules = null) {
    if (!rawText || typeof rawText !== "string") return "";
    let text = rawText;
    const preset = getPromptPreset();
    const rules = Array.isArray(customRules) ? customRules : preset.floorRegexRules || [];
    for (const rule of rules) {
      if (!rule || rule.enabled === false || !rule.pattern) continue;
      try {
        const re = new RegExp(rule.pattern, rule.flags || "g");
        text = text.replace(re, rule.replacement != null ? rule.replacement : "");
      } catch (err) {
        console.warn("[IGS-Patch] \u6B63\u5219\u89C4\u5219\u6267\u884C\u5F02\u5E38:", rule.name, err);
      }
    }
    return text.trim();
  }
  function compilePromptMessages(rawFloorText, contextMeta = {}) {
    const preset = getPromptPreset();
    const items = preset.items || [];
    const messages = [];
    const effectiveGrammar = resolveEffectiveGrammar();
    const clippedText = clipFloorText(rawFloorText, preset.floorRegexRules);
    for (const item of items) {
      if (!item || item.enabled === false) continue;
      let content = "";
      if (item.type === "slot_igs_rules") {
        content = effectiveGrammar;
      } else if (item.type === "slot_floor_text") {
        const prefix = item.prefix || "";
        const suffix = item.suffix || "";
        content = `${prefix}${clippedText}${suffix}`.trim();
      } else {
        content = String(item.content || "").trim();
      }
      if (!content) continue;
      messages.push({
        role: item.role || "system",
        content
      });
    }
    if (messages.length === 0) {
      messages.push({ role: "system", content: effectiveGrammar });
      messages.push({ role: "user", content: clippedText });
    }
    return messages;
  }
  function cycleRole(role) {
    if (role === "system") return "user";
    if (role === "user") return "assistant";
    return "system";
  }
  function getRoleIconClass(role) {
    if (role === "system") return "fa-gear";
    if (role === "user") return "fa-user";
    return "fa-robot";
  }
  function getRoleDisplayName(role) {
    if (role === "system") return "\u7CFB\u7EDF";
    if (role === "user") return "\u7528\u6237";
    return "AI";
  }
  var STORAGE_KEY, DEFAULT_PROMPT_PRESET, currentPreset;
  var init_preset_manager = __esm({
    "src/prompt-presets/preset-manager.js"() {
      init_grammar_prompt();
      STORAGE_KEY = "igs:patch:prompt_preset_v2";
      DEFAULT_PROMPT_PRESET = {
        version: 2,
        name: "\u6807\u51C6\u5BFC\u6F14\u9884\u8BBE",
        items: [
          {
            id: "slot_igs_rules",
            type: "slot_igs_rules",
            role: "system",
            // 'system' | 'user' | 'assistant'
            name: "\u4E3B\u811A\u672C\u63D0\u793A\u8BCD",
            enabled: true,
            removable: false
          },
          {
            id: "custom_director_guide",
            type: "custom",
            role: "system",
            name: "\u5BFC\u6F14\u4EFB\u52A1\u6307\u5F15",
            content: `\u4F60\u662F\u4E00\u4F4D\u4E13\u4E1A\u7684\u89C6\u89C9\u5C0F\u8BF4\u6F14\u51FA\u5BFC\u6F14\u3002\u8BF7\u4E25\u683C\u9075\u5FAA\u4E0A\u8FF0\u89C6\u89C9\u5C0F\u8BF4\u6807\u7B7E\u8BED\u6CD5\u89C4\u8303\uFF0C\u5C06\u7ED9\u5B9A\u7684\u3010\u5C0F\u8BF4\u539F\u6587\u3011\u6539\u5199\u4E3A\u6C89\u6D78\u5F0F\u89C6\u89C9\u5C0F\u8BF4\u6F14\u51FA\u5267\u672C\u3002

\u5236\u4F5C\u8981\u6C42\uFF1A
1. \u5267\u60C5\u5FE0\u5B9E\uFF1A\u5B8C\u6574\u4FDD\u7559\u539F\u6587\u7684\u60C5\u8282\u3001\u5BF9\u767D\u3001\u52A8\u4F5C\u4E0E\u5FC3\u58F0\uFF0C\u4E0D\u5F97\u64C5\u81EA\u5220\u51CF\u6216\u6269\u5199\u6545\u4E8B\u3002
2. \u6807\u7B7E\u89C4\u8303\uFF1A
   - \u89D2\u8272\u8BF4\u51FA\u7684\u53F0\u8BCD\uFF0C\u4F7F\u7528 [igs-char:\u89D2\u8272\u540D|\u60C5\u7EEA|\u53F0\u8BCD\u5185\u5BB9]
   - \u89D2\u8272\u7684\u5FC3\u7406\u6D3B\u52A8\u6216\u5FC3\u58F0\uFF0C\u4F7F\u7528 [igs-thought:\u89D2\u8272\u540D|\u60C5\u7EEA|\u5FC3\u58F0\u5185\u5BB9]
   - \u65C1\u767D\u4E0E\u73AF\u5883\u52A8\u4F5C\u63CF\u5199\uFF0C\u76F4\u63A5\u8F93\u51FA\u7EAF\u6587\u672C\u81EA\u7136\u6BB5\u843D\uFF0C\u4E25\u7981\u9644\u52A0\u4EFB\u4F55 speaker \u6807\u7B7E\u6216\u524D\u7F00
   - \u573A\u666F\u4E0E\u73AF\u5883\u5207\u6362\uFF0C\u4F7F\u7528 [igs-scene:\u5730\u70B9|\u65F6\u6BB5|\u5929\u6C14]
   - \u5173\u952E\u6C1B\u56F4\u6E32\u67D3\u9002\u5EA6\u6DFB\u52A0 [igs-fx:bgm|...] \u6216\u7279\u6548\u6807\u7B7E
3. \u8F93\u51FA\u683C\u5F0F\uFF1A\u76F4\u63A5\u8F93\u51FA\u8F6C\u6362\u540E\u7684\u5267\u672C\u6B63\u6587\uFF0C\u4E25\u7981\u8F93\u51FA\u4EFB\u4F55\u5F00\u573A\u767D\u3001\u5E9F\u8BDD\u89E3\u91CA\u6216 Markdown \u4EE3\u7801\u5757\u5305\u88F9\u3002`,
            enabled: true,
            removable: true
          },
          {
            id: "slot_floor_text",
            type: "slot_floor_text",
            role: "user",
            name: "\u697C\u5C42\u539F\u6587",
            prefix: "\u3010\u5C0F\u8BF4\u539F\u6587\u3011\n",
            suffix: "",
            enabled: true,
            removable: false
          }
        ],
        floorRegexRules: [
          { id: "fence", name: "\u6E05\u9664\u4EE3\u7801\u5757", pattern: "^```[a-z]*\\s*\\n|\\n```\\s*$", replacement: "", flags: "gim", enabled: true },
          { id: "html", name: "\u6E05\u9664HTML\u6807\u7B7E", pattern: "<[^>]+>", replacement: "", flags: "g", enabled: true },
          { id: "old_tags", name: "\u6E05\u9664\u6B8B\u7559\u6807\u7B7E", pattern: "\\[(igs-[a-z0-9_-]+|speaker|emotion|location):[^\\]]*\\]", replacement: "", flags: "gi", enabled: true },
          { id: "md_img", name: "\u6E05\u9664\u56FE\u7247\u8BED\u6CD5", pattern: "!\\[.*?\\]\\(.*?\\)", replacement: "", flags: "g", enabled: true },
          { id: "empty_lines", name: "\u89C4\u8303\u591A\u4F59\u7A7A\u884C", pattern: "\\n{3,}", replacement: "\\n\\n", flags: "g", enabled: true }
        ]
      };
      currentPreset = null;
    }
  });

  // src/director/grammar-prompt.js
  function resolveEffectiveGrammar() {
    const parts = [];
    if (patchState.interceptedPrompt.system) {
      parts.push(patchState.interceptedPrompt.system);
    }
    if (patchState.interceptedPrompt.depth0) {
      parts.push(patchState.interceptedPrompt.depth0);
    }
    if (Array.isArray(patchState.interceptedPrompt.segments) && patchState.interceptedPrompt.segments.length > 0) {
      for (const seg of patchState.interceptedPrompt.segments) {
        if (seg?.content) parts.push(seg.content);
      }
    }
    if (parts.length > 0) {
      return parts.join("\n\n");
    }
    return FALLBACK_DEFAULT_GRAMMAR;
  }
  function buildDirectorRequestPayload(rawArticle, contextMeta = {}) {
    return compilePromptMessages(rawArticle, contextMeta);
  }
  var FALLBACK_DEFAULT_GRAMMAR;
  var init_grammar_prompt = __esm({
    "src/director/grammar-prompt.js"() {
      init_state();
      init_preset_manager();
      FALLBACK_DEFAULT_GRAMMAR = `[igs\u6807\u7B7E\u8BED\u6CD5]
[igs-scene:\u5730\u70B9|\u65F6\u6BB5|\u5929\u6C14] \u573A\u666F\u5207\u6362\uFF08\u65F6\u6BB5\uFF1A\u9ECE\u660E/\u767D\u5929/\u9EC4\u660F/\u591C\u665A/\u6DF1\u591C\uFF1B\u5929\u6C14\uFF1A\u6674\u6717/\u9634\u5929/\u96E8\u5929/\u66B4\u96E8/\u96EA\u5929/\u5927\u98CE\uFF09
[igs-char:\u89D2\u8272\u540D|\u60C5\u7EEA|\u53F0\u8BCD\u5185\u5BB9] \u89D2\u8272\u5BF9\u767D\uFF08\u60C5\u7EEA\uFF1A\u5F00\u5FC3/\u5FAE\u7B11/\u5F97\u610F/\u6E29\u67D4/\u751F\u6C14/\u6124\u6012/\u59D4\u5C48/\u5BB3\u7F9E/\u8138\u7EA2/\u60B2\u4F24/\u54ED\u6CE3/\u60CA\u8BB6/\u9707\u60CA/\u601D\u8003/\u7591\u60D1/\u51B7\u6DE1/\u91CA\u7136/\u8BA4\u771F/\u75B2\u60EB/\u5BB3\u6015/\u5E73\u9759\uFF09
[igs-thought:\u89D2\u8272\u540D|\u60C5\u7EEA|\u5FC3\u58F0\u5185\u5BB9] \u89D2\u8272\u5FC3\u7406\u6D3B\u52A8\u3001\u5185\u5FC3\u72EC\u767D
\u65C1\u767D\u4E0E\u73AF\u5883\u52A8\u4F5C\u63CF\u5199\uFF1A\u76F4\u63A5\u8F93\u51FA\u7EAF\u6587\u672C\u81EA\u7136\u6BB5\u843D\uFF0C\u65E0\u9700\u4EFB\u4F55\u6807\u7B7E\u5305\u88F9\uFF0C\u6BB5\u4E0E\u6BB5\u4E4B\u95F4\u7A7A\u4E00\u884C\u3002
[igs-fx:bgm|\u66F2\u540D\u6216\u60C5\u7EEA] \u80CC\u666F\u97F3\u4E50\uFF08\u5982\uFF1A[igs-fx:bgm|\u9759\u8C27]\u3001[igs-fx:bgm|\u6E29\u99A8]\u3001[igs-fx:bgm|\u7D27\u5F20]\uFF09
[igs-fx:heart|\u89D2\u8272\u540D] \u597D\u611F\u5FC3\u52A8
[igs-fx:sweat|\u89D2\u8272\u540D] \u5C34\u5C2C\u65E0\u5948
[igs-fx:shock|\u89D2\u8272\u540D] \u9707\u60CA\u7279\u5199`;
    }
  });

  // src/director/secondary-llm.js
  function getCandidateWindows2() {
    const list = [window];
    try {
      if (window.parent && window.parent !== window && !list.includes(window.parent)) list.push(window.parent);
    } catch (_) {
    }
    try {
      if (window.top && window.top !== window && !list.includes(window.top)) list.push(window.top);
    } catch (_) {
    }
    return list;
  }
  function getIgsSecondaryLlmConfig() {
    try {
      for (const w of getCandidateWindows2()) {
        const igs = w.IGS || w.ImmersiveGalgameSystem;
        const unified = igs?.getUnifiedSettings?.();
        const config = unified?.bridge?.autoIllustration?.llm;
        if (config) return config;
      }
    } catch (err) {
      console.warn("[IGS-Patch] \u8BFB\u53D6 IGS \u526F LLM \u914D\u7F6E\u5931\u8D25:", err);
    }
    return null;
  }
  function normalizePromptMessages(promptData) {
    if (Array.isArray(promptData)) return promptData;
    if (promptData && Array.isArray(promptData.messages)) return promptData.messages;
    if (promptData && (promptData.system || promptData.user)) {
      const list = [];
      if (promptData.system) list.push({ role: "system", content: promptData.system });
      if (promptData.user) list.push({ role: "user", content: promptData.user });
      return list;
    }
    return [{ role: "user", content: String(promptData || "") }];
  }
  async function requestSecondaryLlm(promptData, overrideOptions = {}) {
    const config = getIgsSecondaryLlmConfig();
    const timeoutMs = overrideOptions.timeoutMs || DEFAULT_TIMEOUT_MS;
    const messages = normalizePromptMessages(promptData);
    for (const w of getCandidateWindows2()) {
      const igs = w.IGS || w.ImmersiveGalgameSystem;
      if (typeof igs?.requestSecondaryText === "function") {
        try {
          const sysContent = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
          const userContent = messages.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
          const result = await igs.requestSecondaryText({
            system: sysContent,
            user: userContent,
            messages
          }, config || {});
          const text = extractContent(result);
          if (text) return text;
        } catch (err) {
          console.warn("[IGS-Patch] \u901A\u8FC7 IGS.requestSecondaryText \u8BF7\u6C42\u5931\u8D25\uFF0C\u5C1D\u8BD5\u72EC\u7ACB\u8C03\u7528:", err);
        }
      }
    }
    if (config && config.source === "openai" && config.endpoint) {
      return requestOpenAiCompat(messages, config, timeoutMs);
    }
    return requestTavernRaw(messages, timeoutMs);
  }
  async function testSecondaryLlmConnection() {
    const startTime = Date.now();
    try {
      const testPayload = [
        { role: "system", content: 'You are a test assistant. Reply with "pong" only.' },
        { role: "user", content: "ping" }
      ];
      const reply = await requestSecondaryLlm(testPayload, { timeoutMs: 15e3 });
      const latency = Date.now() - startTime;
      return {
        ok: true,
        latency,
        reply: String(reply).slice(0, 100)
      };
    } catch (err) {
      return {
        ok: false,
        latency: Date.now() - startTime,
        error: err.message || String(err)
      };
    }
  }
  async function requestOpenAiCompat(messages, config, timeoutMs) {
    let endpoint = String(config.endpoint || "").trim().replace(/\/+$/, "");
    if (!endpoint.endsWith("/chat/completions")) {
      endpoint = /\/v\d+$/i.test(endpoint) ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      "Content-Type": "application/json",
      ...config.apiKey ? { "Authorization": `Bearer ${config.apiKey.trim()}` } : {},
      ...config.customHeaders || {}
    };
    const payload = {
      model: config.model || "gpt-4o-mini",
      messages: Array.isArray(messages) ? messages : [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user }
      ],
      temperature: 0.3,
      stream: false,
      ...config.customBody || {}
    };
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`\u526F API HTTP \u9519\u8BEF ${response.status}: ${errText.slice(0, 200)}`);
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("\u526F API \u672A\u8FD4\u56DE\u6709\u6548\u7684 choices[0].message.content");
      }
      return content.trim();
    } finally {
      clearTimeout(timer);
    }
  }
  async function requestTavernRaw(messages, timeoutMs) {
    const list = Array.isArray(messages) ? messages : [
      { role: "system", content: messages.system },
      { role: "user", content: messages.user }
    ];
    for (const w of getCandidateWindows2()) {
      const helper = w.TavernHelper;
      if (helper && typeof helper.generateRaw === "function") {
        const result = await helper.generateRaw({
          should_stream: false,
          should_silence: true,
          // 静默生成：不广播事件、不显示停止按钮
          ordered_prompts: list
        });
        return String(result || "").trim();
      }
      const ctx = w.SillyTavern?.getContext?.();
      if (ctx && typeof ctx.generateRaw === "function") {
        const sys = list.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
        const user = list.filter((m) => m.role !== "system").map((m) => m.content).join("\n\n");
        const result = await ctx.generateRaw({
          systemPrompt: sys,
          prompt: user
        });
        return String(result || "").trim();
      }
    }
    throw new Error("\u672A\u68C0\u6D4B\u5230\u53EF\u7528\u7684\u526F API \u65B9\u5F0F\uFF08\u65E2\u65E0\u72EC\u7ACB OpenAI \u914D\u7F6E\uFF0C\u4E5F\u65E0\u6CD5\u8C03\u7528 generateRaw\uFF09");
  }
  function extractContent(raw) {
    if (typeof raw === "string") return raw;
    if (raw?.content) return raw.content;
    if (raw?.choices?.[0]?.message?.content) return raw.choices[0].message.content;
    return null;
  }
  var DEFAULT_TIMEOUT_MS;
  var init_secondary_llm = __esm({
    "src/director/secondary-llm.js"() {
      DEFAULT_TIMEOUT_MS = 6e4;
    }
  });

  // src/ui/toast.js
  function getCandidateDocument() {
    try {
      if (window.top && window.top.document) return window.top.document;
    } catch (_) {
    }
    try {
      if (window.parent && window.parent.document) return window.parent.document;
    } catch (_) {
    }
    return document;
  }
  function notifyToast(message, type = "info", duration = 2200) {
    const doc2 = getCandidateDocument();
    if (!doc2 || !doc2.body) {
      console.log(`[IGS-Patch] [\u653E\u6620] ${message}`);
      return;
    }
    const cleanMsg = String(message || "").replace(/^放映[：:\s]*/, "").replace(/[()（）]/g, "");
    const displayText = `\u653E\u6620\uFF1A${cleanMsg}`;
    let toastContainer = doc2.getElementById("igs-patch-mini-toast-root");
    if (!toastContainer) {
      toastContainer = doc2.createElement("div");
      toastContainer.id = "igs-patch-mini-toast-root";
      toastContainer.style.cssText = `
            position: fixed;
            top: max(16px, env(safe-area-inset-top));
            right: max(16px, env(safe-area-inset-right));
            z-index: 2147483647;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
        `;
      (doc2.body || doc2.documentElement).appendChild(toastContainer);
    }
    if (activeToastEl) {
      try {
        activeToastEl.remove();
      } catch (_) {
      }
      activeToastEl = null;
    }
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    const colors = {
      info: {
        bg: "rgba(28, 30, 36, 0.90)",
        border: "rgba(255, 255, 255, 0.16)",
        text: "#f1f3f5",
        icon: "#60a5fa",
        iconClass: "fa-film"
      },
      success: {
        bg: "rgba(18, 38, 26, 0.92)",
        border: "rgba(74, 222, 128, 0.35)",
        text: "#dcfce7",
        icon: "#4ade80",
        iconClass: "fa-circle-check"
      },
      warn: {
        bg: "rgba(38, 28, 12, 0.92)",
        border: "rgba(251, 191, 36, 0.35)",
        text: "#fef3c7",
        icon: "#fbbf24",
        iconClass: "fa-triangle-exclamation"
      },
      error: {
        bg: "rgba(40, 16, 16, 0.94)",
        border: "rgba(248, 113, 113, 0.35)",
        text: "#fee2e2",
        icon: "#f87171",
        iconClass: "fa-circle-exclamation"
      }
    };
    const scheme = colors[type] || colors.info;
    const toast = doc2.createElement("div");
    toast.className = "igs-mini-toast";
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
    requestAnimationFrame(() => {
      toast.style.transform = "translateY(0)";
      toast.style.opacity = "1";
    });
    dismissTimer = setTimeout(() => {
      if (toast && toast.parentElement) {
        toast.style.transform = "translateY(-6px)";
        toast.style.opacity = "0";
        setTimeout(() => {
          try {
            toast.remove();
          } catch (_) {
          }
          if (activeToastEl === toast) activeToastEl = null;
        }, 220);
      }
    }, duration);
  }
  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var activeToastEl, dismissTimer;
  var init_toast = __esm({
    "src/ui/toast.js"() {
      activeToastEl = null;
      dismissTimer = null;
    }
  });

  // src/director/pipeline.js
  var pipeline_exports = {};
  __export(pipeline_exports, {
    attachScriptToMessage: () => attachScriptToMessage,
    checkFloorScriptExists: () => checkFloorScriptExists,
    clearScriptMemoryStore: () => clearScriptMemoryStore,
    convertMessageToGal: () => convertMessageToGal,
    getActiveSwipeId: () => getActiveSwipeId,
    getCurrentVisibleFloorInfo: () => getCurrentVisibleFloorInfo,
    getScriptMemKey: () => getScriptMemKey,
    getScriptStoreKey: () => getScriptStoreKey,
    handleMessageDeleted: () => handleMessageDeleted,
    handleMessageSwiped: () => handleMessageSwiped,
    normalizeGalScript: () => normalizeGalScript,
    processLatestAssistantMessage: () => processLatestAssistantMessage,
    refreshIgsStage: () => refreshIgsStage,
    scriptMemoryStore: () => scriptMemoryStore
  });
  function clearScriptMemoryStore() {
    scriptMemoryStore.clear();
  }
  function getCandidateWindows3() {
    const list = [window];
    try {
      if (window.parent && window.parent !== window && !list.includes(window.parent)) list.push(window.parent);
    } catch (_) {
    }
    try {
      if (window.top && window.top !== window && !list.includes(window.top)) list.push(window.top);
    } catch (_) {
    }
    return list;
  }
  function getActiveSwipeId(messageId) {
    const mid = Number(messageId);
    if (isNaN(mid)) return 0;
    for (const w of getCandidateWindows3()) {
      try {
        const chat = w.SillyTavern?.getContext?.()?.chat;
        if (Array.isArray(chat) && chat[mid]) {
          return Number(chat[mid].swipe_id) || 0;
        }
      } catch (_) {
      }
    }
    return 0;
  }
  function getCurrentVisibleFloorInfo() {
    let chat = null;
    let targetDoc = null;
    for (const w of getCandidateWindows3()) {
      try {
        const ctx = w.SillyTavern?.getContext?.();
        if (Array.isArray(ctx?.chat)) {
          chat = ctx.chat;
        }
        if (w.document && w.document.querySelector("#chat")) {
          targetDoc = w.document;
        }
      } catch (_) {
      }
    }
    if (!chat || !Array.isArray(chat)) {
      return null;
    }
    let bestMid = null;
    if (targetDoc) {
      const chatContainer = targetDoc.querySelector("#chat");
      if (chatContainer) {
        const chatRect = chatContainer.getBoundingClientRect();
        const centerY = chatRect.top + chatRect.height * 0.45;
        const mesNodes = Array.from(chatContainer.querySelectorAll(".mes[mesid], [data-mesid], .mes"));
        let bestDist = Infinity;
        for (const node of mesNodes) {
          const rawId = node.getAttribute("mesid") || node.getAttribute("data-mesid");
          if (rawId == null) continue;
          const mid = parseInt(rawId, 10);
          if (isNaN(mid) || !chat[mid]) continue;
          const msg2 = chat[mid];
          if (msg2.is_user) continue;
          const rect = node.getBoundingClientRect();
          if (rect.bottom >= chatRect.top && rect.top <= chatRect.bottom) {
            const nodeCenterY = (rect.top + rect.bottom) / 2;
            const dist = Math.abs(nodeCenterY - centerY);
            if (dist < bestDist) {
              bestDist = dist;
              bestMid = mid;
            }
          }
        }
      }
    }
    if (bestMid == null) {
      for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i] && !chat[i].is_user) {
          bestMid = i;
          break;
        }
      }
    }
    if (bestMid == null || !chat[bestMid]) return null;
    const msg = chat[bestMid];
    const swipeId = Number(msg.swipe_id) || 0;
    const swipes = Array.isArray(msg.swipes) ? msg.swipes : [msg.mes || msg.text || ""];
    const currentSwipeText = (swipes[swipeId] != null ? swipes[swipeId] : msg.mes || msg.text || "").trim();
    return {
      floor: bestMid,
      swipeId,
      totalSwipes: Math.max(1, swipes.length),
      text: currentSwipeText,
      characterName: msg.name || "",
      msg
    };
  }
  async function checkFloorScriptExists(messageId, swipeId = null) {
    if (messageId == null) return false;
    const mid = Number(messageId);
    const sid = swipeId != null ? Number(swipeId) : getActiveSwipeId(mid);
    const memKey = getScriptMemKey(mid, sid);
    if (scriptMemoryStore.has(memKey)) return true;
    for (const w of getCandidateWindows3()) {
      try {
        const msg = w.SillyTavern?.getContext?.()?.chat?.[mid];
        if (msg?.extra?.igs_patch_scripts?.[sid]) {
          const cached = msg.extra.igs_patch_scripts[sid];
          scriptMemoryStore.set(memKey, cached);
          attachScriptToMessage(mid, cached, sid);
          return true;
        }
      } catch (_) {
      }
    }
    try {
      const storeKey = getScriptStoreKey(mid, sid);
      let cached = await getStoredJson(storeKey);
      if (!cached) {
        cached = await getStoredJson(`script_${mid}_s${sid}`);
      }
      if (cached && typeof cached === "string" && cached.trim()) {
        scriptMemoryStore.set(memKey, cached);
        attachScriptToMessage(mid, cached, sid);
        return true;
      }
    } catch (_) {
    }
    return false;
  }
  function attachScriptToMessage(messageId, script, swipeId = 0) {
    if (messageId == null || !script) return;
    const mid = Number(messageId);
    const sid = Number(swipeId) || 0;
    const memKey = getScriptMemKey(mid, sid);
    scriptMemoryStore.set(memKey, script);
    scriptMemoryStore.set(`${mid}_${sid}`, script);
    for (const w of getCandidateWindows3()) {
      try {
        const chat = w.SillyTavern?.getContext?.()?.chat;
        if (Array.isArray(chat) && chat[mid]) {
          const msg = chat[mid];
          msg.extra = msg.extra || {};
          msg.extra.igs_patch_scripts = msg.extra.igs_patch_scripts || {};
          msg.extra.igs_patch_scripts[sid] = script;
          const activeSid = Number(msg.swipe_id) || 0;
          if (activeSid === sid) {
            msg.text = script;
            msg.visibleText = script;
            msg.displayText = script;
            msg.plainText = script;
            msg.formattedText = script;
            msg.rawHtml = script;
          }
        }
      } catch (_) {
      }
    }
  }
  function normalizeGalScript(rawScript) {
    if (!rawScript || typeof rawScript !== "string") return "";
    let text = rawScript.trim();
    text = text.replace(/^```[a-z]*\s*\n/i, "").replace(/\n```\s*$/i, "");
    text = text.replace(/\r\n/g, "\n");
    const blocks = text.split(/\n{2,}/);
    const normalizedBlocks = [];
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      if (/^\[igs-(?:scene|char|thought|fx):/i.test(trimmed)) {
        normalizedBlocks.push(trimmed);
        continue;
      }
      if (/^\[(?:speaker|角色|说话人):\s*(?:旁白|叙述|解说|Narrator)\s*\]/i.test(trimmed)) {
        const pureText = trimmed.replace(/^\[(?:speaker|角色|说话人):\s*(?:旁白|叙述|解说|Narrator)\s*\]\s*(?:\[(?:emotion|情绪):[^\]]*\])?\s*/i, "").trim();
        if (pureText) normalizedBlocks.push(pureText);
        continue;
      }
      const thoughtMatch = trimmed.match(/^\[(?:speaker|角色|说话人):\s*([^(\])]+?)\s*[(（](?:心理|心声|内心|想法)[)）]\s*\](?:\s*\[(?:emotion|情绪):\s*([^\]]+?)\s*\])?\s*([\s\S]+)$/i);
      if (thoughtMatch) {
        const charName = thoughtMatch[1].trim();
        const emotion = (thoughtMatch[2] || "\u5E73\u9759").trim();
        const content = thoughtMatch[3].trim();
        normalizedBlocks.push(`[igs-thought:${charName}|${emotion}|${content}]`);
        continue;
      }
      const charMatch = trimmed.match(/^\[(?:speaker|角色|说话人):\s*([^\]]+?)\s*\](?:\s*\[(?:emotion|情绪):\s*([^\]]+?)\s*\])?\s*([\s\S]+)$/i);
      if (charMatch) {
        const charName = charMatch[1].trim();
        if (charName === "\u65C1\u767D" || charName === "\u53D9\u8FF0" || charName === "Narrator") {
          const pureText = (charMatch[3] || "").trim();
          if (pureText) normalizedBlocks.push(pureText);
        } else {
          const emotion = (charMatch[2] || "\u5E73\u9759").trim();
          const content = charMatch[3].trim();
          normalizedBlocks.push(`[igs-char:${charName}|${emotion}|${content}]`);
        }
        continue;
      }
      normalizedBlocks.push(trimmed);
    }
    return normalizedBlocks.join("\n\n");
  }
  async function convertMessageToGal(messageId, rawText, contextMeta = {}, force = false) {
    if (messageId == null || !rawText || !rawText.trim()) {
      return null;
    }
    const mid = Number(messageId);
    const sid = contextMeta.swipeId != null ? Number(contextMeta.swipeId) : getActiveSwipeId(mid);
    const storeKey = getScriptStoreKey(mid, sid);
    const memKey = getScriptMemKey(mid, sid);
    if (!force) {
      if (scriptMemoryStore.has(memKey)) {
        const cached = scriptMemoryStore.get(memKey);
        attachScriptToMessage(mid, cached, sid);
        refreshIgsStage(mid);
        return cached;
      }
      let stored = await getStoredJson(storeKey);
      if (!stored) {
        stored = await getStoredJson(`script_${mid}_s${sid}`);
      }
      if (stored && typeof stored === "string" && stored.trim()) {
        attachScriptToMessage(mid, stored, sid);
        refreshIgsStage(mid);
        return stored;
      }
    }
    try {
      console.info(`[IGS-Patch] \u6B63\u5728\u4F7F\u7528\u526F API \u8F6C\u8BD1\u7B2C ${mid} \u697C (\u5206\u652F ${sid}) \u4E3A Gal \u6F14\u51FA...`);
      updateProductionStatus({
        isProducing: true,
        floor: mid,
        swipeId: sid,
        progress: `\u6B63\u5728\u6539\u5199\u7B2C ${mid} \u697C\u6F14\u51FA...`,
        error: null
      });
      notifyToast(`\u7B2C ${mid} \u697C\u5F00\u59CB\u5236\u4F5C`, "info", 1800);
      const payload = buildDirectorRequestPayload(rawText, contextMeta);
      const converted = await requestSecondaryLlm(payload);
      if (!converted || !converted.trim()) {
        throw new Error("\u526F API \u8FD4\u56DE\u5267\u672C\u4E3A\u7A7A");
      }
      const normalized = normalizeGalScript(converted);
      await setStoredJson(storeKey, normalized);
      attachScriptToMessage(mid, normalized, sid);
      console.info(`[IGS-Patch] \u7B2C ${mid} \u697C (\u5206\u652F ${sid}) \u6F14\u51FA\u5236\u4F5C\u5B8C\u6210\u5E76\u5DF2\u5B58\u5165\u5B58\u50A8\u3002`);
      updateProductionStatus({
        isProducing: false,
        floor: mid,
        swipeId: sid,
        progress: "\u5236\u4F5C\u5B8C\u6210",
        error: null,
        lastSuccessAt: Date.now()
      });
      notifyToast(`\u7B2C ${mid} \u697C\u5236\u4F5C\u5C31\u7EEA`, "success", 2200);
      refreshIgsStage(mid);
      return normalized;
    } catch (err) {
      console.error(`[IGS-Patch] \u7B2C ${mid} \u697C (\u5206\u652F ${sid}) \u8F6C\u8BD1\u5931\u8D25:`, err);
      updateProductionStatus({
        isProducing: false,
        floor: mid,
        swipeId: sid,
        progress: "\u5236\u4F5C\u5931\u8D25",
        error: err.message || String(err)
      });
      notifyToast(`\u7B2C ${mid} \u697C\u5236\u4F5C\u5931\u8D25: ${err.message}`, "error", 3e3);
      throw err;
    }
  }
  function handleMessageSwiped(messageId) {
    const mid = Number(messageId);
    if (isNaN(mid)) return;
    for (const w of getCandidateWindows3()) {
      try {
        const chat = w.SillyTavern?.getContext?.()?.chat;
        if (Array.isArray(chat) && chat[mid]) {
          const msg = chat[mid];
          const sid = Number(msg.swipe_id) || 0;
          const scopedKey = getScriptMemKey(mid, sid);
          const legacyKey = `${mid}_${sid}`;
          const script = scriptMemoryStore.get(scopedKey) || scriptMemoryStore.get(legacyKey) || msg.extra?.igs_patch_scripts?.[sid];
          if (script) {
            msg.text = script;
            msg.visibleText = script;
            msg.displayText = script;
            msg.plainText = script;
            msg.formattedText = script;
            msg.rawHtml = script;
            console.info(`[IGS-Patch] \u7B2C ${mid} \u697C\u5207\u6362\u81F3\u5206\u652F ${sid}\uFF0C\u5DF2\u540C\u6B65\u5E94\u7528\u8BE5\u5206\u652F\u5267\u672C`);
          } else {
            delete msg.text;
            delete msg.visibleText;
            delete msg.displayText;
            delete msg.plainText;
            delete msg.formattedText;
            delete msg.rawHtml;
            console.info(`[IGS-Patch] \u7B2C ${mid} \u697C\u5207\u6362\u81F3\u5206\u652F ${sid}\uFF0C\u8BE5\u5206\u652F\u5C1A\u672A\u5236\u4F5C\u6F14\u51FA`);
          }
          refreshIgsStage(mid);
        }
      } catch (_) {
      }
    }
  }
  async function handleMessageDeleted(messageId) {
    const mid = Number(messageId);
    if (isNaN(mid)) return;
    const chatId = getActiveChatId();
    for (const key of scriptMemoryStore.keys()) {
      if (key.startsWith(`${chatId}_${mid}_`) || key.startsWith(`${mid}_`)) {
        scriptMemoryStore.delete(key);
      }
    }
    try {
      const keys = await listStoredKeys();
      if (Array.isArray(keys)) {
        for (const k of keys) {
          if (k.startsWith(`script_${chatId}_${mid}_`) || k.startsWith(`script_${mid}_`)) {
            await deleteStoredJson(k);
          }
        }
      }
    } catch (_) {
    }
    console.info(`[IGS-Patch] \u5DF2\u5F7B\u5E95\u6E05\u7406\u7B2C ${mid} \u697C\u7684\u5168\u90E8\u6F14\u51FA\u5267\u672C\u7F13\u5B58`);
  }
  function refreshIgsStage(messageId) {
    for (const w of getCandidateWindows3()) {
      try {
        const igs = w.IGS || w.ImmersiveGalgameSystem;
        if (!igs) continue;
        if (typeof igs.refresh === "function") {
          igs.refresh({ messageId });
        }
        if (typeof igs.renderScene === "function") {
          igs.renderScene();
        }
      } catch (err) {
        console.warn("[IGS-Patch] \u5237\u65B0 IGS \u821E\u53F0\u5F02\u5E38:", err);
      }
    }
  }
  async function processLatestAssistantMessage() {
    const hit = await findLastMessage({ role: "assistant", scanLimit: 50 });
    if (!hit || !hit.message) return null;
    const mid = hit.index;
    const sid = Number(hit.message.swipe_id) || 0;
    const rawText = hit.message.mes || hit.message.text || "";
    return convertMessageToGal(mid, rawText, { swipeId: sid });
  }
  var scriptMemoryStore, getScriptStoreKey, getScriptMemKey;
  var init_pipeline = __esm({
    "src/director/pipeline.js"() {
      init_adapter();
      init_grammar_prompt();
      init_secondary_llm();
      init_toast();
      init_state();
      scriptMemoryStore = /* @__PURE__ */ new Map();
      getScriptStoreKey = (mid, sid) => `script_${getActiveChatId()}_${mid}_s${sid}`;
      getScriptMemKey = (mid, sid) => `${getActiveChatId()}_${mid}_${sid}`;
    }
  });

  // src/index.js
  init_state();
  init_adapter();

  // src/interceptor/prompt-blocker.js
  init_state();
  var BLOCKED_KEY_PREFIX = "igs-scene-assets-";
  var BLOCKED_EXACT_KEYS = /* @__PURE__ */ new Set([
    "igs-scene-assets-format-rule",
    "igs-scene-assets-depth0",
    "igs-stats-state"
  ]);
  var shadowPromptRecords = /* @__PURE__ */ new Map();
  function shouldInterceptKey(key) {
    if (!key) return false;
    const str = String(key);
    return BLOCKED_EXACT_KEYS.has(str) || str.startsWith(BLOCKED_KEY_PREFIX) || str.startsWith("igs-");
  }
  function getCandidateWindows() {
    const list = [window];
    try {
      if (window.parent && window.parent !== window && !list.includes(window.parent)) {
        list.push(window.parent);
      }
    } catch (_) {
    }
    try {
      if (window.top && window.top !== window && !list.includes(window.top)) {
        list.push(window.top);
      }
    } catch (_) {
    }
    try {
      const rootDoc = (window.top || window.parent || window).document;
      if (rootDoc) {
        const iframes = rootDoc.querySelectorAll("iframe");
        for (const f of iframes) {
          try {
            const fw = f.contentWindow;
            if (fw && !list.includes(fw)) list.push(fw);
          } catch (_) {
          }
        }
      }
    } catch (_) {
    }
    return list;
  }
  function setupPromptBlocker() {
    hookAllCandidateWindows();
    setTimeout(triggerIgsPromptResync, 500);
    setTimeout(triggerIgsPromptResync, 2e3);
    setInterval(hookAllCandidateWindows, 2e3);
    console.info("[IGS-Patch] \u63D0\u793A\u8BCD\u62E6\u622A\u5668\u5DF2\u542F\u52A8\uFF1A\u4E3B\u6A21\u578B\u7CFB\u7EDF\u63D0\u793A\u8BCD\u4FDD\u6301\u7EAF\u51C0\uFF0CIGS\u89C4\u5219\u5DF2\u8F6C\u5B58\u526F\u6A21\u578B\u3002");
  }
  function hookAllCandidateWindows() {
    const wins = getCandidateWindows();
    for (const win of wins) {
      hookSillyTavernGetContext(win);
      hookTavernHelper(win);
      scanAndAdoptExistingPrompts(win);
    }
  }
  function hookSillyTavernGetContext(win) {
    try {
      if (!win.SillyTavern || typeof win.SillyTavern.getContext !== "function") return;
      if (!win.SillyTavern.getContext.__isIgsPatchHooked) {
        const originalGetContext = win.SillyTavern.getContext.bind(win.SillyTavern);
        const hookedGetContext = function(...args) {
          const ctx = originalGetContext(...args);
          if (ctx) {
            wrapContextInstance(ctx, win);
          }
          return ctx;
        };
        hookedGetContext.__isIgsPatchHooked = true;
        win.SillyTavern.getContext = hookedGetContext;
        console.info("[IGS-Patch] \u6210\u529F\u52AB\u6301 SillyTavern.getContext \u51FD\u6570");
      }
      const currentCtx = win.SillyTavern.getContext();
      if (currentCtx) {
        wrapContextInstance(currentCtx, win);
      }
    } catch (err) {
    }
  }
  function wrapContextInstance(ctx, win) {
    if (!ctx) return;
    if (typeof ctx.setExtensionPrompt === "function" && !ctx.setExtensionPrompt.__isIgsPatchHooked) {
      const originalSet = ctx.setExtensionPrompt.bind(ctx);
      const hookedSet = function(key, content, position, depth, scan, role) {
        if (shouldInterceptKey(key)) {
          saveInterceptedRule(key, content, { position, depth, scan, role });
          shadowPromptRecords.set(key, {
            value: String(content || ""),
            position: Number(position) || 0,
            depth: Math.max(0, Number(depth) || 0),
            scan: Boolean(scan),
            role: Number(role) || 0
          });
          originalSet(key, "", position, depth, scan, role);
          return;
        }
        return originalSet(key, content, position, depth, scan, role);
      };
      hookedSet.__isIgsPatchHooked = true;
      ctx.setExtensionPrompt = hookedSet;
    }
    if (ctx.extensionPrompts && !ctx.extensionPrompts.__isIgsPatchProxy) {
      const rawTarget = ctx.extensionPrompts;
      ctx.extensionPrompts = new Proxy(rawTarget, {
        get(target, prop, receiver) {
          if (prop === "__isIgsPatchProxy") return true;
          if (prop === "__rawTarget") return target;
          if (typeof prop === "string" && shouldInterceptKey(prop)) {
            if (shadowPromptRecords.has(prop)) {
              return shadowPromptRecords.get(prop);
            }
          }
          return Reflect.get(target, prop, receiver);
        },
        // 当酒馆使用 Object.keys, Object.entries, for..in 收集提示词送往主模型时：彻底滤除！
        ownKeys(target) {
          const keys = Reflect.ownKeys(target);
          return keys.filter((k) => typeof k !== "string" || !shouldInterceptKey(k));
        },
        getOwnPropertyDescriptor(target, prop) {
          if (typeof prop === "string" && shouldInterceptKey(prop)) {
            return void 0;
          }
          return Reflect.getOwnPropertyDescriptor(target, prop);
        },
        has(target, prop) {
          if (typeof prop === "string" && shouldInterceptKey(prop)) {
            return false;
          }
          return Reflect.has(target, prop);
        },
        deleteProperty(target, prop) {
          if (typeof prop === "string" && shouldInterceptKey(prop)) {
            shadowPromptRecords.delete(prop);
          }
          return Reflect.deleteProperty(target, prop);
        }
      });
    }
    hookEventSource(ctx);
  }
  function scanAndAdoptExistingPrompts(win) {
    try {
      const ctx = win.SillyTavern?.getContext?.();
      if (!ctx || !ctx.extensionPrompts) return;
      const raw = ctx.extensionPrompts.__rawTarget || ctx.extensionPrompts;
      const keys = /* @__PURE__ */ new Set([
        ...Reflect.ownKeys(raw),
        "igs-scene-assets-format-rule",
        "igs-scene-assets-depth0",
        "igs-stats-state"
      ]);
      for (let i = 0; i < 30; i++) keys.add(`igs-scene-assets-entry-${i}`);
      for (const k of keys) {
        if (typeof k === "string" && shouldInterceptKey(k)) {
          const record = raw[k] || shadowPromptRecords.get(k);
          if (record && record.value && String(record.value).trim()) {
            saveInterceptedRule(k, record.value, record);
            shadowPromptRecords.set(k, { ...record });
            try {
              delete raw[k];
            } catch (_) {
              record.value = "";
            }
          }
        }
      }
    } catch (_) {
    }
  }
  function hookTavernHelper(win) {
    try {
      const helper = win.TavernHelper;
      if (helper && typeof helper.injectPrompts === "function" && !helper.injectPrompts.__isIgsPatchHooked) {
        const originalInject = helper.injectPrompts.bind(helper);
        const hookedInject = function(prompts, ...args) {
          if (Array.isArray(prompts)) {
            for (const p2 of prompts) {
              if (p2 && shouldInterceptKey(p2.id)) {
                saveInterceptedRule(p2.id, p2.content, p2);
                shadowPromptRecords.set(p2.id, {
                  value: p2.content,
                  position: 0,
                  depth: 0,
                  scan: false,
                  role: 0
                });
              }
            }
            const filtered = prompts.filter((p2) => !shouldInterceptKey(p2?.id));
            return originalInject(filtered, ...args);
          }
          return originalInject(prompts, ...args);
        };
        hookedInject.__isIgsPatchHooked = true;
        helper.injectPrompts = hookedInject;
      }
    } catch (_) {
    }
  }
  function hookEventSource(ctx) {
    try {
      const eventSource = ctx.eventSource;
      const eventTypes = ctx.event_types || ctx.eventTypes || {};
      if (!eventSource || typeof eventSource.on !== "function") return;
      if (eventSource.__igsPromptFilterAttached) return;
      eventSource.__igsPromptFilterAttached = true;
      const scrubMessages = (data) => {
        if (!data) return;
        const messages = data.messages || data.prompt;
        if (Array.isArray(messages)) {
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const content = typeof msg === "string" ? msg : msg?.content;
            if (typeof content === "string") {
              if (content.includes("[igs\u6807\u7B7E\u8BED\u6CD5]") || content.includes("\u3010\u573A\u666F\u4E0E\u53F0\u8BCD\u3011") || content.includes("igs-scene-assets")) {
                if (content.length < 5e3 && (content.startsWith("[igs\u6807\u7B7E\u8BED\u6CD5]") || content.startsWith("\u3010\u573A\u666F\u4E0E\u53F0\u8BCD\u3011") || content.startsWith("igs-scene-assets"))) {
                  messages.splice(i, 1);
                } else {
                  const cleaned = content.replace(/\[igs标签语法\][\s\S]*?(?=\n\n[^\n]|\[|$)/gi, "").replace(/【场景与台词】[\s\S]*?(?=\n\n[^\n]|\[|$)/gi, "");
                  if (typeof msg === "string") {
                    messages[i] = cleaned.trim();
                  } else if (msg) {
                    msg.content = cleaned.trim();
                  }
                }
              }
            }
          }
        }
      };
      if (eventTypes.CHAT_COMPLETION_PROMPT_READY) {
        eventSource.on(eventTypes.CHAT_COMPLETION_PROMPT_READY, scrubMessages);
      }
      if (eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS) {
        eventSource.on(eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS, scrubMessages);
      }
    } catch (_) {
    }
  }
  function triggerIgsPromptResync() {
    console.info("[IGS-Patch] \u4E3B\u52A8\u89E6\u53D1 IGS \u573A\u666F\u89C4\u5219\u91CD\u540C\u6B65...");
    for (const win of getCandidateWindows()) {
      try {
        const ctx = win.SillyTavern?.getContext?.();
        const eventSource = ctx?.eventSource;
        const eventTypes = ctx?.event_types || ctx?.eventTypes || {};
        const chatChangedEvent = eventTypes.CHAT_CHANGED || "chat_changed";
        if (eventSource && typeof eventSource.emit === "function") {
          eventSource.emit(chatChangedEvent, ctx.chatId);
        }
        const igs = win.IGS || win.ImmersiveGalgameSystem;
        if (igs && typeof igs.refresh === "function") {
          igs.refresh();
        }
        scanAndAdoptExistingPrompts(win);
      } catch (_) {
      }
    }
  }

  // src/interceptor/render-hook.js
  init_adapter();
  init_pipeline();
  function getCandidateWindows4() {
    const wins = [window];
    try {
      if (window.parent && !wins.includes(window.parent)) wins.push(window.parent);
    } catch (_) {
    }
    try {
      if (window.top && !wins.includes(window.top)) wins.push(window.top);
    } catch (_) {
    }
    try {
      const rootDoc = (window.top || window.parent || window).document;
      if (rootDoc) {
        const iframes = rootDoc.querySelectorAll("iframe");
        for (const f of iframes) {
          try {
            const fw = f.contentWindow;
            if (fw && !wins.includes(fw)) wins.push(fw);
          } catch (_) {
          }
        }
      }
    } catch (_) {
    }
    return wins;
  }
  async function preloadScriptToMemory(messageId, swipeId = 0) {
    if (messageId == null) return null;
    const mid = Number(messageId);
    const sid = Number(swipeId) || 0;
    const memKey = getScriptMemKey(mid, sid);
    if (scriptMemoryStore.has(memKey)) {
      const cached = scriptMemoryStore.get(memKey);
      const normalized = normalizeGalScript(cached);
      if (normalized !== cached) {
        scriptMemoryStore.set(memKey, normalized);
      }
      attachScriptToMessage(mid, normalized, sid);
      return normalized;
    }
    const key = getScriptStoreKey(mid, sid);
    let script = await getStoredJson(key);
    if (!script) {
      script = await getStoredJson(`script_${mid}_s${sid}`);
    }
    if (script) {
      const normalized = normalizeGalScript(script);
      scriptMemoryStore.set(memKey, normalized);
      attachScriptToMessage(mid, normalized, sid);
      return normalized;
    }
    return null;
  }
  async function syncAllStoredScriptsToChat() {
    try {
      const keys = await listStoredKeys();
      if (!Array.isArray(keys)) return;
      const currentChatId = getActiveChatId();
      for (const k of keys) {
        const scopedMatch = k.match(/^script_(.+)_(\d+)_s(\d+)$/);
        if (scopedMatch) {
          const cId = scopedMatch[1];
          if (cId === currentChatId) {
            const mid = parseInt(scopedMatch[2], 10);
            const sid = parseInt(scopedMatch[3], 10);
            await preloadScriptToMemory(mid, sid);
          }
          continue;
        }
        const match = k.match(/^script_(\d+)_s(\d+)$/);
        if (match) {
          const mid = parseInt(match[1], 10);
          const sid = parseInt(match[2], 10);
          await preloadScriptToMemory(mid, sid);
        } else if (k.startsWith("script_")) {
          const mid = parseInt(k.replace("script_", ""), 10);
          if (!isNaN(mid)) {
            await preloadScriptToMemory(mid, 0);
          }
        }
      }
    } catch (err) {
      console.warn("[IGS-Patch] \u5168\u91CF\u540C\u6B65\u5267\u672C\u5230\u5185\u5B58\u5F02\u5E38:", err);
    }
  }
  function setupRenderHook() {
    const wins = getCandidateWindows4();
    wins.forEach((w) => {
      hookTavernHelperInWindow(w);
      observeIgsInWindow(w, (igs) => {
        hookIgsInstance(igs, w);
      });
    });
    syncAllStoredScriptsToChat();
  }
  function hookTavernHelperInWindow(win) {
    try {
      const helper = win.TavernHelper;
      if (helper && typeof helper.getChatMessages === "function" && !helper.__tauri_patch_hooked) {
        helper.__tauri_patch_hooked = true;
        const originalGetChatMessages = helper.getChatMessages.bind(helper);
        helper.getChatMessages = function(range2, ...rest) {
          const messages = originalGetChatMessages(range2, ...rest);
          if (!Array.isArray(messages)) return messages;
          return messages.map((msg, i) => {
            const realId = findRealFloorIndex(msg, i, win);
            const swipeId = Number(msg.swipe_id) || 0;
            const scopedKey = getScriptMemKey(realId, swipeId);
            const legacyKey = `${realId}_${swipeId}`;
            const rawScript = scriptMemoryStore.get(scopedKey) || scriptMemoryStore.get(legacyKey) || msg.extra?.igs_patch_scripts?.[swipeId];
            if (rawScript) {
              const script = normalizeGalScript(rawScript);
              return {
                ...msg,
                id: realId,
                text: script,
                visibleText: script,
                displayText: script,
                plainText: script,
                formattedText: script,
                rawHtml: script,
                mes: script,
                element: null
                // 强制清空 element，阻止 dom-visible-override 覆盖
              };
            } else if (msg && typeof msg.mes === "string" && msg.mes.includes("[speaker:")) {
              const cleaned = normalizeGalScript(msg.mes);
              return {
                ...msg,
                text: cleaned,
                visibleText: cleaned,
                displayText: cleaned,
                plainText: cleaned,
                formattedText: cleaned,
                rawHtml: cleaned,
                mes: cleaned,
                element: null
              };
            }
            return msg;
          });
        };
        console.info("[IGS-Patch] \u5DF2\u6210\u529F\u6302\u94A9 TavernHelper.getChatMessages");
      }
    } catch (_) {
    }
  }
  function findRealFloorIndex(msg, defaultIdx, win) {
    const chat = win.SillyTavern?.getContext?.()?.chat || window.SillyTavern?.getContext?.()?.chat;
    if (Array.isArray(chat)) {
      const directIdx = chat.indexOf(msg);
      if (directIdx !== -1) return directIdx;
      const contentIdx = chat.findIndex((m) => m && msg && m.mes === msg.mes && Boolean(m.is_user) === Boolean(msg.is_user));
      if (contentIdx !== -1) return contentIdx;
    }
    return Number(msg?.id ?? defaultIdx);
  }
  function hookIgsInstance(igs, ownerWin) {
    if (!igs || igs.__tauri_patch_hooked) return;
    igs.__tauri_patch_hooked = true;
    if (typeof igs.openViewerFromMessage === "function") {
      const originalOpen = igs.openViewerFromMessage.bind(igs);
      igs.openViewerFromMessage = async function(messageId, mode, openOptions = {}) {
        const mid = Number(messageId);
        const chat = ownerWin.SillyTavern?.getContext?.()?.chat || window.SillyTavern?.getContext?.()?.chat;
        const sid = Number(chat?.[mid]?.swipe_id) || 0;
        const script = await preloadScriptToMemory(mid, sid);
        let resolvedMode = mode;
        let resolvedOptions = openOptions;
        if (mode && typeof mode === "object" && !Array.isArray(mode)) {
          resolvedMode = mode.mode;
          resolvedOptions = mode;
        } else if (!resolvedOptions || typeof resolvedOptions !== "object") {
          resolvedOptions = {};
        }
        if (script && !resolvedOptions.message) {
          const baseMsg = chat?.[mid] || {};
          resolvedOptions.message = {
            ...baseMsg,
            id: mid,
            text: script,
            visibleText: script,
            displayText: script,
            plainText: script,
            formattedText: script,
            rawHtml: script,
            mes: script,
            element: null
            // 强制清空 element，阻止 dom-visible-override 覆盖
          };
        }
        return originalOpen(messageId, resolvedMode, resolvedOptions);
      };
    }
    if (typeof igs.openLatestAvailable === "function") {
      const originalOpenLatest = igs.openLatestAvailable.bind(igs);
      igs.openLatestAvailable = async function(mode, options = {}) {
        const chat = ownerWin.SillyTavern?.getContext?.()?.chat || window.SillyTavern?.getContext?.()?.chat;
        let targetMid = null;
        let targetSid = 0;
        if (Array.isArray(chat) && chat.length > 0) {
          for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i] && !chat[i].is_user) {
              targetMid = i;
              targetSid = Number(chat[i].swipe_id) || 0;
              break;
            }
          }
        }
        let resolvedMode = mode;
        let resolvedOptions = options;
        if (mode && typeof mode === "object" && !Array.isArray(mode)) {
          resolvedMode = mode.mode;
          resolvedOptions = mode;
        } else if (!resolvedOptions || typeof resolvedOptions !== "object") {
          resolvedOptions = {};
        }
        if (targetMid != null) {
          const script = await preloadScriptToMemory(targetMid, targetSid);
          if (script && !resolvedOptions.message) {
            const baseMsg = chat[targetMid] || {};
            resolvedOptions.message = {
              ...baseMsg,
              id: targetMid,
              text: script,
              visibleText: script,
              displayText: script,
              plainText: script,
              formattedText: script,
              rawHtml: script,
              mes: script,
              element: null
              // 强制清空 element，阻止 dom-visible-override 覆盖
            };
          }
        }
        return originalOpenLatest(resolvedMode, resolvedOptions);
      };
    }
  }
  function observeIgsInWindow(win, onFound) {
    if (win.IGS || win.ImmersiveGalgameSystem) {
      onFound(win.IGS || win.ImmersiveGalgameSystem);
      return;
    }
    let intervalId = setInterval(() => {
      if (win.IGS || win.ImmersiveGalgameSystem) {
        clearInterval(intervalId);
        onFound(win.IGS || win.ImmersiveGalgameSystem);
      }
    }, 500);
    setTimeout(() => clearInterval(intervalId), 3e4);
  }

  // src/index.js
  init_pipeline();

  // src/ui/qr-hijack.js
  init_state();
  init_pipeline();
  init_toast();
  var QR_BUTTON_NAME = "Gal\u6A21\u62DF";
  function getCandidateDocuments() {
    const docs = [document];
    try {
      if (window.parent && window.parent.document && !docs.includes(window.parent.document)) {
        docs.push(window.parent.document);
      }
    } catch (_) {
    }
    try {
      if (window.top && window.top.document && !docs.includes(window.top.document)) {
        docs.push(window.top.document);
      }
    } catch (_) {
    }
    return docs;
  }
  function getCandidateWindows5() {
    const list = [window];
    try {
      if (window.parent && window.parent !== window && !list.includes(window.parent)) list.push(window.parent);
    } catch (_) {
    }
    try {
      if (window.top && window.top !== window && !list.includes(window.top)) list.push(window.top);
    } catch (_) {
    }
    return list;
  }
  function setupQrHijack() {
    scanAndTransformAll();
    const docs = getCandidateDocuments();
    for (const doc2 of docs) {
      try {
        const observer = new MutationObserver(() => {
          scanAndTransformDoc(doc2);
        });
        observer.observe(doc2.body, { childList: true, subtree: true });
      } catch (_) {
      }
    }
    setInterval(scanAndTransformAll, 1500);
    console.info("[IGS-Patch] QR \u680F\u653E\u6620\u952E\u91CD\u6784\u4E0E\u52AB\u6301\u5668\u5DF2\u5C31\u7EEA\u3002");
  }
  function scanAndTransformAll() {
    for (const doc2 of getCandidateDocuments()) {
      scanAndTransformDoc(doc2);
    }
  }
  function scanAndTransformDoc(doc2) {
    if (!doc2 || !doc2.body || typeof doc2.querySelectorAll !== "function") return;
    const candidates = doc2.querySelectorAll(".qr--button, [data-qr-name], .qr-btn, #qr--bar button, #qr--bar .menu_button, .quick-reply-button");
    for (const el of candidates) {
      if (isTargetQrButton(el)) {
        transformButton(el);
      }
    }
    const allButtons = doc2.querySelectorAll("#qr--bar button, .qr--bar button, .quick_reply_container button");
    for (const el of allButtons) {
      if (isTargetQrButton(el)) {
        transformButton(el);
      }
    }
  }
  function isTargetQrButton(el) {
    if (!el) return false;
    const name = el.getAttribute("data-qr-name") || el.dataset?.qrName;
    if (name === QR_BUTTON_NAME) return true;
    const text = el.textContent?.trim();
    if (text === QR_BUTTON_NAME) return true;
    if (el.dataset?.igsPatchProjector === "1") return true;
    return false;
  }
  function transformButton(btn) {
    if (!btn) return;
    btn.dataset.igsPatchProjector = "1";
    if (btn.dataset.igsPatchIconApplied !== "1" || !btn.querySelector("i.fa-film")) {
      btn.dataset.igsPatchIconApplied = "1";
      btn.innerHTML = '<i class="fa-solid fa-film" aria-hidden="true"></i>';
      btn.title = "\u653E\u6620";
      btn.setAttribute("aria-label", "\u653E\u6620");
      btn.style.display = "inline-flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.minWidth = "34px";
      btn.style.padding = "0 8px";
    }
    if (!btn.__igsPatchClickHooked) {
      btn.__igsPatchClickHooked = true;
      btn.addEventListener("click", handleProjectorButtonClick, true);
    }
  }
  async function handleProjectorButtonClick(e) {
    const target = getCurrentVisibleFloorInfo();
    if (!target) {
      return;
    }
    const mid = target.floor;
    const sid = target.swipeId;
    const isProduced = await checkFloorScriptExists(mid, sid);
    const mode = patchState.productionMode;
    if (mode === "manual") {
      if (!isProduced) {
        e.stopImmediatePropagation();
        e.preventDefault();
        try {
          await convertMessageToGal(mid, target.text, { swipeId: sid, characterName: target.characterName }, true);
        } catch (_) {
        }
        return;
      }
      e.stopImmediatePropagation();
      e.preventDefault();
      openViewerAtFloor(mid);
    } else {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (!isProduced) {
        try {
          await convertMessageToGal(mid, target.text, { swipeId: sid, characterName: target.characterName }, true);
        } catch (_) {
        }
      }
      openViewerAtFloor(mid);
    }
  }
  function openViewerAtFloor(messageId) {
    for (const w of getCandidateWindows5()) {
      const igs = w.IGS || w.ImmersiveGalgameSystem;
      if (igs) {
        if (typeof igs.openViewerFromMessage === "function") {
          igs.openViewerFromMessage(messageId);
          return;
        }
        if (typeof igs.openLatestAvailable === "function") {
          igs.openLatestAvailable();
          return;
        }
      }
    }
  }

  // node_modules/@vue/runtime-dom/dist/runtime-dom.esm-bundler.js
  var runtime_dom_esm_bundler_exports = {};
  __export(runtime_dom_esm_bundler_exports, {
    BaseTransition: () => BaseTransition,
    BaseTransitionPropsValidators: () => BaseTransitionPropsValidators,
    Comment: () => Comment,
    DeprecationTypes: () => DeprecationTypes,
    EffectScope: () => EffectScope,
    ErrorCodes: () => ErrorCodes,
    ErrorTypeStrings: () => ErrorTypeStrings,
    Fragment: () => Fragment,
    KeepAlive: () => KeepAlive,
    ReactiveEffect: () => ReactiveEffect,
    Static: () => Static,
    Suspense: () => Suspense,
    Teleport: () => Teleport,
    Text: () => Text,
    TrackOpTypes: () => TrackOpTypes,
    Transition: () => Transition,
    TransitionGroup: () => TransitionGroup,
    TriggerOpTypes: () => TriggerOpTypes,
    VueElement: () => VueElement,
    assertNumber: () => assertNumber,
    callWithAsyncErrorHandling: () => callWithAsyncErrorHandling,
    callWithErrorHandling: () => callWithErrorHandling,
    camelize: () => camelize,
    capitalize: () => capitalize,
    cloneVNode: () => cloneVNode,
    compatUtils: () => compatUtils,
    computed: () => computed2,
    createApp: () => createApp,
    createBlock: () => createBlock,
    createCommentVNode: () => createCommentVNode,
    createElementBlock: () => createElementBlock,
    createElementVNode: () => createBaseVNode,
    createHydrationRenderer: () => createHydrationRenderer,
    createPropsRestProxy: () => createPropsRestProxy,
    createRenderer: () => createRenderer,
    createSSRApp: () => createSSRApp,
    createSlots: () => createSlots,
    createStaticVNode: () => createStaticVNode,
    createTextVNode: () => createTextVNode,
    createVNode: () => createVNode,
    customRef: () => customRef,
    defineAsyncComponent: () => defineAsyncComponent,
    defineComponent: () => defineComponent,
    defineCustomElement: () => defineCustomElement,
    defineEmits: () => defineEmits,
    defineExpose: () => defineExpose,
    defineModel: () => defineModel,
    defineOptions: () => defineOptions,
    defineProps: () => defineProps,
    defineSSRCustomElement: () => defineSSRCustomElement,
    defineSlots: () => defineSlots,
    devtools: () => devtools,
    effect: () => effect,
    effectScope: () => effectScope,
    getCurrentInstance: () => getCurrentInstance,
    getCurrentScope: () => getCurrentScope,
    getCurrentWatcher: () => getCurrentWatcher,
    getTransitionRawChildren: () => getTransitionRawChildren,
    guardReactiveProps: () => guardReactiveProps,
    h: () => h,
    handleError: () => handleError,
    hasInjectionContext: () => hasInjectionContext,
    hydrate: () => hydrate,
    hydrateOnIdle: () => hydrateOnIdle,
    hydrateOnInteraction: () => hydrateOnInteraction,
    hydrateOnMediaQuery: () => hydrateOnMediaQuery,
    hydrateOnVisible: () => hydrateOnVisible,
    initCustomFormatter: () => initCustomFormatter,
    initDirectivesForSSR: () => initDirectivesForSSR,
    inject: () => inject,
    isMemoSame: () => isMemoSame,
    isProxy: () => isProxy,
    isReactive: () => isReactive,
    isReadonly: () => isReadonly,
    isRef: () => isRef2,
    isRuntimeOnly: () => isRuntimeOnly,
    isShallow: () => isShallow,
    isVNode: () => isVNode,
    markRaw: () => markRaw,
    mergeDefaults: () => mergeDefaults,
    mergeModels: () => mergeModels,
    mergeProps: () => mergeProps,
    nextTick: () => nextTick,
    nodeOps: () => nodeOps,
    normalizeClass: () => normalizeClass,
    normalizeProps: () => normalizeProps,
    normalizeStyle: () => normalizeStyle,
    onActivated: () => onActivated,
    onBeforeMount: () => onBeforeMount,
    onBeforeUnmount: () => onBeforeUnmount,
    onBeforeUpdate: () => onBeforeUpdate,
    onDeactivated: () => onDeactivated,
    onErrorCaptured: () => onErrorCaptured,
    onMounted: () => onMounted,
    onRenderTracked: () => onRenderTracked,
    onRenderTriggered: () => onRenderTriggered,
    onScopeDispose: () => onScopeDispose,
    onServerPrefetch: () => onServerPrefetch,
    onUnmounted: () => onUnmounted,
    onUpdated: () => onUpdated,
    onWatcherCleanup: () => onWatcherCleanup,
    openBlock: () => openBlock,
    patchProp: () => patchProp,
    popScopeId: () => popScopeId,
    provide: () => provide,
    proxyRefs: () => proxyRefs,
    pushScopeId: () => pushScopeId,
    queuePostFlushCb: () => queuePostFlushCb,
    reactive: () => reactive,
    readonly: () => readonly,
    ref: () => ref,
    registerRuntimeCompiler: () => registerRuntimeCompiler,
    render: () => render,
    renderList: () => renderList,
    renderSlot: () => renderSlot,
    resolveComponent: () => resolveComponent,
    resolveDirective: () => resolveDirective,
    resolveDynamicComponent: () => resolveDynamicComponent,
    resolveFilter: () => resolveFilter,
    resolveTransitionHooks: () => resolveTransitionHooks,
    setBlockTracking: () => setBlockTracking,
    setDevtoolsHook: () => setDevtoolsHook,
    setTransitionHooks: () => setTransitionHooks,
    shallowReactive: () => shallowReactive,
    shallowReadonly: () => shallowReadonly,
    shallowRef: () => shallowRef,
    ssrContextKey: () => ssrContextKey,
    ssrUtils: () => ssrUtils,
    stop: () => stop,
    toDisplayString: () => toDisplayString,
    toHandlerKey: () => toHandlerKey,
    toHandlers: () => toHandlers,
    toRaw: () => toRaw,
    toRef: () => toRef,
    toRefs: () => toRefs,
    toValue: () => toValue,
    transformVNodeArgs: () => transformVNodeArgs,
    triggerRef: () => triggerRef,
    unref: () => unref,
    useAttrs: () => useAttrs,
    useCssModule: () => useCssModule,
    useCssVars: () => useCssVars,
    useHost: () => useHost,
    useId: () => useId,
    useModel: () => useModel,
    useSSRContext: () => useSSRContext,
    useShadowRoot: () => useShadowRoot,
    useSlots: () => useSlots,
    useTemplateRef: () => useTemplateRef,
    useTransitionState: () => useTransitionState,
    vModelCheckbox: () => vModelCheckbox,
    vModelDynamic: () => vModelDynamic,
    vModelRadio: () => vModelRadio,
    vModelSelect: () => vModelSelect,
    vModelText: () => vModelText,
    vShow: () => vShow,
    version: () => version,
    warn: () => warn2,
    watch: () => watch2,
    watchEffect: () => watchEffect,
    watchPostEffect: () => watchPostEffect,
    watchSyncEffect: () => watchSyncEffect,
    withAsyncContext: () => withAsyncContext,
    withCtx: () => withCtx,
    withDefaults: () => withDefaults,
    withDirectives: () => withDirectives,
    withKeys: () => withKeys,
    withMemo: () => withMemo,
    withModifiers: () => withModifiers,
    withScopeId: () => withScopeId
  });

  // node_modules/@vue/shared/dist/shared.esm-bundler.js
  /**
  * @vue/shared v3.5.44
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  // @__NO_SIDE_EFFECTS__
  function makeMap(str) {
    const map = /* @__PURE__ */ Object.create(null);
    for (const key of str.split(",")) map[key] = 1;
    return (val) => val in map;
  }
  var EMPTY_OBJ = false ? Object.freeze({}) : {};
  var EMPTY_ARR = false ? Object.freeze([]) : [];
  var NOOP = () => {
  };
  var NO = () => false;
  var isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // uppercase letter
  (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
  var isModelListener = (key) => key.startsWith("onUpdate:");
  var extend = Object.assign;
  var remove = (arr, el) => {
    const i = arr.indexOf(el);
    if (i > -1) {
      arr.splice(i, 1);
    }
  };
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var hasOwn = (val, key) => hasOwnProperty.call(val, key);
  var isArray = Array.isArray;
  var isMap = (val) => toTypeString(val) === "[object Map]";
  var isSet = (val) => toTypeString(val) === "[object Set]";
  var isDate = (val) => toTypeString(val) === "[object Date]";
  var isRegExp = (val) => toTypeString(val) === "[object RegExp]";
  var isFunction = (val) => typeof val === "function";
  var isString = (val) => typeof val === "string";
  var isSymbol = (val) => typeof val === "symbol";
  var isObject = (val) => val !== null && typeof val === "object";
  var isPromise = (val) => {
    return (isObject(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
  };
  var objectToString = Object.prototype.toString;
  var toTypeString = (value) => objectToString.call(value);
  var toRawType = (value) => {
    return toTypeString(value).slice(8, -1);
  };
  var isPlainObject = (val) => toTypeString(val) === "[object Object]";
  var isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
  var isReservedProp = /* @__PURE__ */ makeMap(
    // the leading comma is intentional so empty string "" is also included
    ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
  );
  var isBuiltInDirective = /* @__PURE__ */ makeMap(
    "bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo"
  );
  var cacheStringFunction = (fn) => {
    const cache = /* @__PURE__ */ Object.create(null);
    return ((str) => {
      const hit = cache[str];
      return hit || (cache[str] = fn(str));
    });
  };
  var camelizeRE = /-\w/g;
  var camelize = cacheStringFunction(
    (str) => {
      return str.replace(camelizeRE, (c) => c.slice(1).toUpperCase());
    }
  );
  var hyphenateRE = /\B([A-Z])/g;
  var hyphenate = cacheStringFunction(
    (str) => str.replace(hyphenateRE, "-$1").toLowerCase()
  );
  var capitalize = cacheStringFunction((str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
  var toHandlerKey = cacheStringFunction(
    (str) => {
      const s = str ? `on${capitalize(str)}` : ``;
      return s;
    }
  );
  var hasChanged = (value, oldValue) => !Object.is(value, oldValue);
  var invokeArrayFns = (fns, ...arg) => {
    for (let i = 0; i < fns.length; i++) {
      fns[i](...arg);
    }
  };
  var def = (obj, key, value, writable = false) => {
    Object.defineProperty(obj, key, {
      configurable: true,
      enumerable: false,
      writable,
      value
    });
  };
  var looseToNumber = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? val : n;
  };
  var toNumber = (val) => {
    const n = isString(val) ? Number(val) : NaN;
    return isNaN(n) ? val : n;
  };
  var _globalThis;
  var getGlobalThis = () => {
    return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
  };
  function genCacheKey(source, options) {
    return source + JSON.stringify(
      options,
      (_, val) => typeof val === "function" ? val.toString() : val
    );
  }
  var GLOBALS_ALLOWED = "Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol";
  var isGloballyAllowed = /* @__PURE__ */ makeMap(GLOBALS_ALLOWED);
  var range = 2;
  function generateCodeFrame(source, start = 0, end = source.length) {
    start = Math.max(0, Math.min(start, source.length));
    end = Math.max(0, Math.min(end, source.length));
    if (start > end) return "";
    let lines = source.split(/(\r?\n)/);
    const newlineSequences = lines.filter((_, idx) => idx % 2 === 1);
    lines = lines.filter((_, idx) => idx % 2 === 0);
    let count = 0;
    const res = [];
    for (let i = 0; i < lines.length; i++) {
      count += lines[i].length + (newlineSequences[i] && newlineSequences[i].length || 0);
      if (count >= start) {
        for (let j = i - range; j <= i + range || end > count; j++) {
          if (j < 0 || j >= lines.length) continue;
          const line = j + 1;
          res.push(
            `${line}${" ".repeat(Math.max(3 - String(line).length, 0))}|  ${lines[j]}`
          );
          const lineLength = lines[j].length;
          const newLineSeqLength = newlineSequences[j] && newlineSequences[j].length || 0;
          if (j === i) {
            const pad = start - (count - (lineLength + newLineSeqLength));
            const length = Math.max(
              1,
              end > count ? lineLength - pad : end - start
            );
            res.push(`   |  ` + " ".repeat(pad) + "^".repeat(length));
          } else if (j > i) {
            if (end > count) {
              const length = Math.max(Math.min(end - count, lineLength), 1);
              res.push(`   |  ` + "^".repeat(length));
            }
            count += lineLength + newLineSeqLength;
          }
        }
        break;
      }
    }
    return res.join("\n");
  }
  function normalizeStyle(value) {
    if (isArray(value)) {
      const res = {};
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);
        if (normalized) {
          for (const key in normalized) {
            res[key] = normalized[key];
          }
        }
      }
      return res;
    } else if (isString(value) || isObject(value)) {
      return value;
    }
  }
  var listDelimiterRE = /;(?![^(]*\))/g;
  var propertyDelimiterRE = /:([^]+)/;
  var styleCommentRE = /"(?:[^"\\]|\\[^])*"|'(?:[^'\\]|\\[^])*'|\\[^]|\/\*[^]*?\*\//g;
  function parseStringStyle(cssText) {
    const ret = {};
    cssText.replace(styleCommentRE, (match) => match.startsWith("/*") ? "" : match).split(listDelimiterRE).forEach((item) => {
      if (item) {
        const tmp = item.split(propertyDelimiterRE);
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
      }
    });
    return ret;
  }
  function normalizeClass(value) {
    let res = "";
    if (isString(value)) {
      res = value;
    } else if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const normalized = normalizeClass(value[i]);
        if (normalized) {
          res += normalized + " ";
        }
      }
    } else if (isObject(value)) {
      for (const name in value) {
        if (value[name]) {
          res += name + " ";
        }
      }
    }
    return res.trim();
  }
  function normalizeProps(props) {
    if (!props) return null;
    let { class: klass, style } = props;
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass);
    }
    if (style) {
      props.style = normalizeStyle(style);
    }
    return props;
  }
  var HTML_TAGS = "html,body,base,head,link,meta,style,title,address,article,aside,footer,header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,summary,template,blockquote,iframe,tfoot";
  var SVG_TAGS = "svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,text,textPath,title,tspan,unknown,use,view";
  var MATH_TAGS = "annotation,annotation-xml,maction,maligngroup,malignmark,math,menclose,merror,mfenced,mfrac,mfraction,mglyph,mi,mlabeledtr,mlongdiv,mmultiscripts,mn,mo,mover,mpadded,mphantom,mprescripts,mroot,mrow,ms,mscarries,mscarry,msgroup,msline,mspace,msqrt,msrow,mstack,mstyle,msub,msubsup,msup,mtable,mtd,mtext,mtr,munder,munderover,none,semantics";
  var VOID_TAGS = "area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr";
  var isHTMLTag = /* @__PURE__ */ makeMap(HTML_TAGS);
  var isSVGTag = /* @__PURE__ */ makeMap(SVG_TAGS);
  var isMathMLTag = /* @__PURE__ */ makeMap(MATH_TAGS);
  var isVoidTag = /* @__PURE__ */ makeMap(VOID_TAGS);
  var specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,playsinline,readonly`;
  var isSpecialBooleanAttr = /* @__PURE__ */ makeMap(specialBooleanAttrs);
  var isBooleanAttr = /* @__PURE__ */ makeMap(
    specialBooleanAttrs + `,async,autofocus,autoplay,controls,default,defer,disabled,inert,loop,open,required,reversed,scoped,seamless,checked,muted,multiple,selected`
  );
  function includeBooleanAttr(value) {
    return !!value || value === "";
  }
  function looseCompareArrays(a, b, seen2) {
    if (a.length !== b.length) return false;
    let equal = true;
    for (let i = 0; equal && i < a.length; i++) {
      equal = looseEqual(a[i], b[i], seen2);
    }
    return equal;
  }
  function looseCompareCollections(a, b, seen2) {
    if (a.size !== b.size) return false;
    const candidates = Array.from(b);
    const matched = new Uint8Array(candidates.length);
    for (const item of a) {
      let index = -1;
      for (let i = 0; i < candidates.length; i++) {
        if (!matched[i] && looseEqual(item, candidates[i], seen2)) {
          index = i;
          break;
        }
      }
      if (index < 0) return false;
      matched[index] = 1;
    }
    return true;
  }
  function looseCompareObjects(a, b, seen2) {
    let aValidType = isMap(a);
    let bValidType = isMap(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareCollections(a, b, seen2) : false;
    }
    aValidType = isSet(a);
    bValidType = isSet(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareCollections(a, b, seen2) : false;
    }
    const aKeysCount = Object.keys(a).length;
    const bKeysCount = Object.keys(b).length;
    if (aKeysCount !== bKeysCount) {
      return false;
    }
    for (const key in a) {
      const aHasKey = a.hasOwnProperty(key);
      const bHasKey = b.hasOwnProperty(key);
      if (aHasKey && !bHasKey || !aHasKey && bHasKey || !looseEqual(a[key], b[key], seen2)) {
        return false;
      }
    }
    return String(a) === String(b);
  }
  function looseCompareNested(a, b, seen2, compare) {
    if (!seen2) {
      seen2 = [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()];
    }
    const [seenA, seenB] = seen2;
    if (seenA.has(a) || seenB.has(b)) {
      return seenA.get(a) === b && seenB.get(b) === a;
    }
    seenA.set(a, b);
    seenB.set(b, a);
    const equal = compare(a, b, seen2);
    seenA.delete(a);
    seenB.delete(b);
    return equal;
  }
  function looseEqual(a, b, seen2) {
    if (a === b) return true;
    let aValidType = isDate(a);
    let bValidType = isDate(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? a.getTime() === b.getTime() : false;
    }
    aValidType = isSymbol(a);
    bValidType = isSymbol(b);
    if (aValidType || bValidType) {
      return a === b;
    }
    aValidType = isArray(a);
    bValidType = isArray(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareNested(a, b, seen2, looseCompareArrays) : false;
    }
    aValidType = isObject(a);
    bValidType = isObject(b);
    if (aValidType || bValidType) {
      if (!aValidType || !bValidType) {
        return false;
      }
      return looseCompareNested(a, b, seen2, looseCompareObjects);
    }
    return String(a) === String(b);
  }
  function looseIndexOf(arr, val) {
    return arr.findIndex((item) => looseEqual(item, val));
  }
  var isRef = (val) => {
    return !!(val && val["__v_isRef"] === true);
  };
  var toDisplayString = (val) => {
    return isString(val) ? val : val == null ? "" : isArray(val) || isObject(val) && (val.toString === objectToString || !isFunction(val.toString)) ? isRef(val) ? toDisplayString(val.value) : JSON.stringify(val, replacer, 2) : String(val);
  };
  var replacer = (_key, val) => {
    if (isRef(val)) {
      return replacer(_key, val.value);
    } else if (isMap(val)) {
      return {
        [`Map(${val.size})`]: [...val.entries()].reduce(
          (entries, [key, val2], i) => {
            entries[stringifySymbol(key, i) + " =>"] = val2;
            return entries;
          },
          {}
        )
      };
    } else if (isSet(val)) {
      return {
        [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v))
      };
    } else if (isSymbol(val)) {
      return stringifySymbol(val);
    } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
      return String(val);
    }
    return val;
  };
  var stringifySymbol = (v, i = "") => {
    var _a;
    return (
      // Symbol.description in es2019+ so we need to cast here to pass
      // the lib: es2016 check
      isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v
    );
  };
  function normalizeCssVarValue(value) {
    if (value == null) {
      return "initial";
    }
    if (typeof value === "string") {
      return value === "" ? " " : value;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      if (false) {
        console.warn(
          "[Vue warn] Invalid value used for CSS binding. Expected a string or a finite number but received:",
          value
        );
      }
    }
    return String(value);
  }

  // node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js
  /**
  * @vue/reactivity v3.5.44
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  function warn(msg, ...args) {
    console.warn(`[Vue warn] ${msg}`, ...args);
  }
  var activeEffectScope;
  var EffectScope = class {
    // TODO isolatedDeclarations "__v_skip"
    constructor(detached = false) {
      this.detached = detached;
      this._active = true;
      this._on = 0;
      this.effects = [];
      this.cleanups = [];
      this._isPaused = false;
      this._warnOnRun = true;
      this.__v_skip = true;
      if (!detached && activeEffectScope) {
        if (activeEffectScope.active) {
          this.parent = activeEffectScope;
          this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
            this
          ) - 1;
        } else {
          this._active = false;
          this._warnOnRun = false;
        }
      }
    }
    get active() {
      return this._active;
    }
    pause() {
      if (this._active) {
        this._isPaused = true;
        let i, l;
        if (this.scopes) {
          const scopes = this.scopes.slice();
          for (i = 0, l = scopes.length; i < l; i++) {
            scopes[i].pause();
          }
        }
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].pause();
        }
      }
    }
    /**
     * Resumes the effect scope, including all child scopes and effects.
     */
    resume() {
      if (this._active) {
        if (this._isPaused) {
          this._isPaused = false;
          let i, l;
          if (this.scopes) {
            const scopes = this.scopes.slice();
            for (i = 0, l = scopes.length; i < l; i++) {
              scopes[i].resume();
            }
          }
          const effects = this.effects.slice();
          for (i = 0, l = effects.length; i < l; i++) {
            effects[i].resume();
          }
        }
      }
    }
    run(fn) {
      if (this._active) {
        const currentEffectScope = activeEffectScope;
        try {
          activeEffectScope = this;
          return fn();
        } finally {
          activeEffectScope = currentEffectScope;
        }
      } else if (false) {
        warn(`cannot run an inactive effect scope.`);
      }
    }
    /**
     * This should only be called on non-detached scopes
     * @internal
     */
    on() {
      if (++this._on === 1) {
        this.prevScope = activeEffectScope;
        activeEffectScope = this;
      }
    }
    /**
     * This should only be called on non-detached scopes
     * @internal
     */
    off() {
      if (this._on > 0 && --this._on === 0) {
        if (activeEffectScope === this) {
          activeEffectScope = this.prevScope;
        } else {
          let current = activeEffectScope;
          while (current) {
            if (current.prevScope === this) {
              current.prevScope = this.prevScope;
              break;
            }
            current = current.prevScope;
          }
        }
        this.prevScope = void 0;
      }
    }
    stop(fromParent) {
      if (this._active) {
        this._active = false;
        let i, l;
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].stop();
        }
        this.effects.length = 0;
        for (i = 0, l = this.cleanups.length; i < l; i++) {
          this.cleanups[i]();
        }
        this.cleanups.length = 0;
        if (this.scopes) {
          const scopes = this.scopes.slice();
          for (i = 0, l = scopes.length; i < l; i++) {
            scopes[i].stop(true);
          }
          this.scopes.length = 0;
        }
        if (!this.detached && this.parent && !fromParent) {
          const last = this.parent.scopes.pop();
          if (last && last !== this) {
            this.parent.scopes[this.index] = last;
            last.index = this.index;
          }
        }
        this.parent = void 0;
      }
    }
  };
  function effectScope(detached) {
    return new EffectScope(detached);
  }
  function getCurrentScope() {
    return activeEffectScope;
  }
  function onScopeDispose(fn, failSilently = false) {
    if (activeEffectScope) {
      activeEffectScope.cleanups.push(fn);
    } else if (false) {
      warn(
        `onScopeDispose() is called when there is no active effect scope to be associated with.`
      );
    }
  }
  var activeSub;
  var pausedQueueEffects = /* @__PURE__ */ new WeakSet();
  var ReactiveEffect = class {
    constructor(fn) {
      this.fn = fn;
      this.deps = void 0;
      this.depsTail = void 0;
      this.flags = 1 | 4;
      this.next = void 0;
      this.cleanup = void 0;
      this.scheduler = void 0;
      if (activeEffectScope) {
        if (activeEffectScope.active) {
          activeEffectScope.effects.push(this);
        } else {
          this.flags &= -2;
        }
      }
    }
    pause() {
      this.flags |= 64;
    }
    resume() {
      if (this.flags & 64) {
        this.flags &= -65;
        if (pausedQueueEffects.has(this)) {
          pausedQueueEffects.delete(this);
          this.trigger();
        }
      }
    }
    /**
     * @internal
     */
    notify() {
      if (this.flags & 2 && !(this.flags & 32)) {
        return;
      }
      if (!(this.flags & 8)) {
        batch(this);
      }
    }
    run() {
      if (!(this.flags & 1)) {
        return this.fn();
      }
      this.flags |= 2;
      cleanupEffect(this);
      prepareDeps(this);
      const prevEffect = activeSub;
      const prevShouldTrack = shouldTrack;
      activeSub = this;
      shouldTrack = true;
      try {
        return this.fn();
      } finally {
        if (false) {
          warn(
            "Active effect was not restored correctly - this is likely a Vue internal bug."
          );
        }
        cleanupDeps(this);
        activeSub = prevEffect;
        shouldTrack = prevShouldTrack;
        this.flags &= -3;
      }
    }
    stop() {
      if (this.flags & 1) {
        for (let link = this.deps; link; link = link.nextDep) {
          removeSub(link);
        }
        this.deps = this.depsTail = void 0;
        cleanupEffect(this);
        this.onStop && this.onStop();
        this.flags &= -2;
      }
    }
    trigger() {
      if (this.flags & 64) {
        pausedQueueEffects.add(this);
      } else if (this.scheduler) {
        this.scheduler();
      } else {
        this.runIfDirty();
      }
    }
    /**
     * @internal
     */
    runIfDirty() {
      if (isDirty(this)) {
        this.run();
      }
    }
    get dirty() {
      return isDirty(this);
    }
  };
  var batchDepth = 0;
  var batchedSub;
  var batchedComputed;
  function batch(sub, isComputed = false) {
    sub.flags |= 8;
    if (isComputed) {
      sub.next = batchedComputed;
      batchedComputed = sub;
      return;
    }
    sub.next = batchedSub;
    batchedSub = sub;
  }
  function startBatch() {
    batchDepth++;
  }
  function endBatch() {
    if (--batchDepth > 0) {
      return;
    }
    if (batchedComputed) {
      let e = batchedComputed;
      batchedComputed = void 0;
      while (e) {
        const next = e.next;
        e.next = void 0;
        e.flags &= -9;
        e = next;
      }
    }
    let error;
    while (batchedSub) {
      let e = batchedSub;
      batchedSub = void 0;
      while (e) {
        const next = e.next;
        e.next = void 0;
        e.flags &= -9;
        if (e.flags & 1) {
          try {
            ;
            e.trigger();
          } catch (err) {
            if (!error) error = err;
          }
        }
        e = next;
      }
    }
    if (error) throw error;
  }
  function prepareDeps(sub) {
    for (let link = sub.deps; link; link = link.nextDep) {
      link.version = -1;
      link.prevActiveLink = link.dep.activeLink;
      link.dep.activeLink = link;
    }
  }
  function cleanupDeps(sub) {
    let head;
    let tail = sub.depsTail;
    let link = tail;
    while (link) {
      const prev = link.prevDep;
      if (link.version === -1) {
        if (link === tail) tail = prev;
        removeSub(link);
        removeDep(link);
      } else {
        head = link;
      }
      link.dep.activeLink = link.prevActiveLink;
      link.prevActiveLink = void 0;
      link = prev;
    }
    sub.deps = head;
    sub.depsTail = tail;
  }
  function isDirty(sub) {
    for (let link = sub.deps; link; link = link.nextDep) {
      if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) {
        return true;
      }
    }
    if (sub._dirty) {
      return true;
    }
    return false;
  }
  function refreshComputed(computed3) {
    if (computed3.flags & 4 && !(computed3.flags & 16)) {
      return;
    }
    computed3.flags &= -17;
    if (computed3.globalVersion === globalVersion) {
      return;
    }
    computed3.globalVersion = globalVersion;
    if (!computed3.isSSR && computed3.flags & 128 && (!computed3.deps && !computed3._dirty || !isDirty(computed3))) {
      return;
    }
    computed3.flags |= 2;
    const dep = computed3.dep;
    const prevSub = activeSub;
    const prevShouldTrack = shouldTrack;
    activeSub = computed3;
    shouldTrack = true;
    try {
      prepareDeps(computed3);
      const value = computed3.fn(computed3._value);
      if (dep.version === 0 || hasChanged(value, computed3._value)) {
        computed3.flags |= 128;
        computed3._value = value;
        dep.version++;
      }
    } catch (err) {
      dep.version++;
      throw err;
    } finally {
      activeSub = prevSub;
      shouldTrack = prevShouldTrack;
      cleanupDeps(computed3);
      computed3.flags &= -3;
    }
  }
  function removeSub(link, soft = false) {
    const { dep, prevSub, nextSub } = link;
    if (prevSub) {
      prevSub.nextSub = nextSub;
      link.prevSub = void 0;
    }
    if (nextSub) {
      nextSub.prevSub = prevSub;
      link.nextSub = void 0;
    }
    if (false) {
      dep.subsHead = nextSub;
    }
    if (dep.subs === link) {
      dep.subs = prevSub;
      if (!prevSub && dep.computed) {
        dep.computed.flags &= -5;
        for (let l = dep.computed.deps; l; l = l.nextDep) {
          removeSub(l, true);
        }
      }
    }
    if (!soft && !--dep.sc && dep.map) {
      dep.map.delete(dep.key);
    }
  }
  function removeDep(link) {
    const { prevDep, nextDep } = link;
    if (prevDep) {
      prevDep.nextDep = nextDep;
      link.prevDep = void 0;
    }
    if (nextDep) {
      nextDep.prevDep = prevDep;
      link.nextDep = void 0;
    }
  }
  function effect(fn, options) {
    if (fn.effect instanceof ReactiveEffect) {
      fn = fn.effect.fn;
    }
    const e = new ReactiveEffect(fn);
    if (options) {
      extend(e, options);
    }
    try {
      e.run();
    } catch (err) {
      e.stop();
      throw err;
    }
    const runner = e.run.bind(e);
    runner.effect = e;
    return runner;
  }
  function stop(runner) {
    runner.effect.stop();
  }
  var shouldTrack = true;
  var trackStack = [];
  function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
  }
  function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === void 0 ? true : last;
  }
  function cleanupEffect(e) {
    const { cleanup } = e;
    e.cleanup = void 0;
    if (cleanup) {
      const prevSub = activeSub;
      activeSub = void 0;
      try {
        cleanup();
      } finally {
        activeSub = prevSub;
      }
    }
  }
  var globalVersion = 0;
  var Link = class {
    constructor(sub, dep) {
      this.sub = sub;
      this.dep = dep;
      this.version = dep.version;
      this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
    }
  };
  var Dep = class {
    // TODO isolatedDeclarations "__v_skip"
    constructor(computed3) {
      this.computed = computed3;
      this.version = 0;
      this.activeLink = void 0;
      this.subs = void 0;
      this.map = void 0;
      this.key = void 0;
      this.sc = 0;
      this.__v_skip = true;
      if (false) {
        this.subsHead = void 0;
      }
    }
    track(debugInfo) {
      if (!activeSub || !shouldTrack || activeSub === this.computed) {
        return;
      }
      let link = this.activeLink;
      if (link === void 0 || link.sub !== activeSub) {
        link = this.activeLink = new Link(activeSub, this);
        if (!activeSub.deps) {
          activeSub.deps = activeSub.depsTail = link;
        } else {
          link.prevDep = activeSub.depsTail;
          activeSub.depsTail.nextDep = link;
          activeSub.depsTail = link;
        }
        addSub(link);
      } else if (link.version === -1) {
        link.version = this.version;
        if (link.nextDep) {
          const next = link.nextDep;
          next.prevDep = link.prevDep;
          if (link.prevDep) {
            link.prevDep.nextDep = next;
          }
          link.prevDep = activeSub.depsTail;
          link.nextDep = void 0;
          activeSub.depsTail.nextDep = link;
          activeSub.depsTail = link;
          if (activeSub.deps === link) {
            activeSub.deps = next;
          }
        }
      }
      if (false) {
        activeSub.onTrack(
          extend(
            {
              effect: activeSub
            },
            debugInfo
          )
        );
      }
      return link;
    }
    trigger(debugInfo) {
      this.version++;
      globalVersion++;
      this.notify(debugInfo);
    }
    notify(debugInfo) {
      startBatch();
      try {
        if (false) {
          for (let head = this.subsHead; head; head = head.nextSub) {
            if (head.sub.onTrigger && !(head.sub.flags & 8)) {
              head.sub.onTrigger(
                extend(
                  {
                    effect: head.sub
                  },
                  debugInfo
                )
              );
            }
          }
        }
        for (let link = this.subs; link; link = link.prevSub) {
          if (link.sub.notify()) {
            ;
            link.sub.dep.notify();
          }
        }
      } finally {
        endBatch();
      }
    }
  };
  function addSub(link) {
    link.dep.sc++;
    if (link.sub.flags & 4) {
      const computed3 = link.dep.computed;
      if (computed3 && !link.dep.subs) {
        computed3.flags |= 4 | 16;
        for (let l = computed3.deps; l; l = l.nextDep) {
          addSub(l);
        }
      }
      const currentTail = link.dep.subs;
      if (currentTail !== link) {
        link.prevSub = currentTail;
        if (currentTail) currentTail.nextSub = link;
      }
      if (false) {
        link.dep.subsHead = link;
      }
      link.dep.subs = link;
    }
  }
  var targetMap = /* @__PURE__ */ new WeakMap();
  var ITERATE_KEY = /* @__PURE__ */ Symbol(
    false ? "Object iterate" : ""
  );
  var MAP_KEY_ITERATE_KEY = /* @__PURE__ */ Symbol(
    false ? "Map keys iterate" : ""
  );
  var ARRAY_ITERATE_KEY = /* @__PURE__ */ Symbol(
    false ? "Array iterate" : ""
  );
  function track(target, type, key) {
    if (shouldTrack && activeSub) {
      let depsMap = targetMap.get(target);
      if (!depsMap) {
        targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
      }
      let dep = depsMap.get(key);
      if (!dep) {
        depsMap.set(key, dep = new Dep());
        dep.map = depsMap;
        dep.key = key;
      }
      if (false) {
        dep.track({
          target,
          type,
          key
        });
      } else {
        dep.track();
      }
    }
  }
  function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);
    if (!depsMap) {
      globalVersion++;
      return;
    }
    const run = (dep) => {
      if (dep) {
        if (false) {
          dep.trigger({
            target,
            type,
            key,
            newValue,
            oldValue,
            oldTarget
          });
        } else {
          dep.trigger();
        }
      }
    };
    startBatch();
    if (type === "clear") {
      depsMap.forEach(run);
    } else {
      const targetIsArray = isArray(target);
      const isArrayIndex = targetIsArray && isIntegerKey(key);
      if (targetIsArray && key === "length") {
        const newLength = Number(newValue);
        depsMap.forEach((dep, key2) => {
          if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !isSymbol(key2) && key2 >= newLength) {
            run(dep);
          }
        });
      } else {
        if (key !== void 0 || depsMap.has(void 0)) {
          run(depsMap.get(key));
        }
        if (isArrayIndex) {
          run(depsMap.get(ARRAY_ITERATE_KEY));
        }
        switch (type) {
          case "add":
            if (!targetIsArray) {
              run(depsMap.get(ITERATE_KEY));
              if (isMap(target)) {
                run(depsMap.get(MAP_KEY_ITERATE_KEY));
              }
            } else if (isArrayIndex) {
              run(depsMap.get("length"));
            }
            break;
          case "delete":
            if (!targetIsArray) {
              run(depsMap.get(ITERATE_KEY));
              if (isMap(target)) {
                run(depsMap.get(MAP_KEY_ITERATE_KEY));
              }
            }
            break;
          case "set":
            if (isMap(target)) {
              run(depsMap.get(ITERATE_KEY));
            }
            break;
        }
      }
    }
    endBatch();
  }
  function getDepFromReactive(object, key) {
    const depMap = targetMap.get(object);
    return depMap && depMap.get(key);
  }
  function reactiveReadArray(array) {
    const raw = /* @__PURE__ */ toRaw(array);
    if (raw === array) return raw;
    track(raw, "iterate", ARRAY_ITERATE_KEY);
    if (/* @__PURE__ */ isShallow(array)) return raw;
    if (!/* @__PURE__ */ isReadonly(array)) return raw.map(toReactive);
    return /* @__PURE__ */ isReactive(array) ? raw.map((item) => toReadonly(toReactive(item))) : raw.map(toReadonly);
  }
  function shallowReadArray(arr) {
    track(arr = /* @__PURE__ */ toRaw(arr), "iterate", ARRAY_ITERATE_KEY);
    return arr;
  }
  function toWrapped(target, item) {
    if (/* @__PURE__ */ isReadonly(target)) {
      return /* @__PURE__ */ isReactive(target) ? toReadonly(toReactive(item)) : toReadonly(item);
    }
    return toReactive(item);
  }
  var arrayInstrumentations = {
    __proto__: null,
    [Symbol.iterator]() {
      return iterator(this, Symbol.iterator, (item) => toWrapped(this, item));
    },
    concat(...args) {
      return reactiveReadArray(this).concat(
        ...args.map((x) => isArray(x) ? reactiveReadArray(x) : x)
      );
    },
    entries() {
      return iterator(this, "entries", (value) => {
        value[1] = toWrapped(this, value[1]);
        return value;
      });
    },
    every(fn, thisArg) {
      return apply(this, "every", fn, thisArg, void 0, arguments);
    },
    filter(fn, thisArg) {
      return apply(
        this,
        "filter",
        fn,
        thisArg,
        (v) => v.map((item) => toWrapped(this, item)),
        arguments
      );
    },
    find(fn, thisArg) {
      return apply(
        this,
        "find",
        fn,
        thisArg,
        (item) => toWrapped(this, item),
        arguments
      );
    },
    findIndex(fn, thisArg) {
      return apply(this, "findIndex", fn, thisArg, void 0, arguments);
    },
    findLast(fn, thisArg) {
      return apply(
        this,
        "findLast",
        fn,
        thisArg,
        (item) => toWrapped(this, item),
        arguments
      );
    },
    findLastIndex(fn, thisArg) {
      return apply(this, "findLastIndex", fn, thisArg, void 0, arguments);
    },
    // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
    forEach(fn, thisArg) {
      return apply(this, "forEach", fn, thisArg, void 0, arguments);
    },
    includes(...args) {
      return searchProxy(this, "includes", args);
    },
    indexOf(...args) {
      return searchProxy(this, "indexOf", args);
    },
    join(separator) {
      return reactiveReadArray(this).join(separator);
    },
    // keys() iterator only reads `length`, no optimization required
    lastIndexOf(...args) {
      return searchProxy(this, "lastIndexOf", args);
    },
    map(fn, thisArg) {
      return apply(this, "map", fn, thisArg, void 0, arguments);
    },
    pop() {
      return noTracking(this, "pop");
    },
    push(...args) {
      return noTracking(this, "push", args);
    },
    reduce(fn, ...args) {
      return reduce(this, "reduce", fn, args);
    },
    reduceRight(fn, ...args) {
      return reduce(this, "reduceRight", fn, args);
    },
    shift() {
      return noTracking(this, "shift");
    },
    // slice could use ARRAY_ITERATE but also seems to beg for range tracking
    some(fn, thisArg) {
      return apply(this, "some", fn, thisArg, void 0, arguments);
    },
    splice(...args) {
      return noTracking(this, "splice", args);
    },
    toReversed() {
      return reactiveReadArray(this).toReversed();
    },
    toSorted(comparer) {
      return reactiveReadArray(this).toSorted(comparer);
    },
    toSpliced(...args) {
      return reactiveReadArray(this).toSpliced(...args);
    },
    unshift(...args) {
      return noTracking(this, "unshift", args);
    },
    values() {
      return iterator(this, "values", (item) => toWrapped(this, item));
    }
  };
  function iterator(self2, method, wrapValue) {
    const arr = shallowReadArray(self2);
    const methodFn = arr[method];
    const iter = methodFn.call(arr);
    if (arr !== self2 && !/* @__PURE__ */ isShallow(self2)) {
      if (iter[Symbol.toStringTag] === "Array Iterator") {
        const wrapped = Object.create(Object.getPrototypeOf(iter));
        wrapped.next = () => wrapResult(iter.next(), wrapValue);
        if (methodFn !== arrayProto[method]) {
          Object.defineProperties(wrapped, {
            return: {
              get() {
                const fn = iter.return;
                return typeof fn === "function" ? fn.bind(iter) : fn;
              }
            },
            throw: {
              get() {
                const fn = iter.throw;
                return typeof fn === "function" ? fn.bind(iter) : fn;
              }
            }
          });
        }
        return wrapped;
      }
      iter._next = iter.next;
      iter.next = () => wrapResult(iter._next(), wrapValue);
    }
    return iter;
  }
  function wrapResult(result, wrapValue) {
    if (!result.done) {
      result.value = wrapValue(result.value);
    }
    return result;
  }
  var arrayProto = Array.prototype;
  function apply(self2, method, fn, thisArg, wrappedRetFn, args) {
    const arr = shallowReadArray(self2);
    const needsWrap = arr !== self2 && !/* @__PURE__ */ isShallow(self2);
    const methodFn = arr[method];
    if (methodFn !== arrayProto[method]) {
      const result2 = methodFn.apply(self2, args);
      return needsWrap ? toReactive(result2) : result2;
    }
    let wrappedFn = fn;
    if (arr !== self2) {
      if (needsWrap) {
        wrappedFn = function(item, index) {
          return fn.call(this, toWrapped(self2, item), index, self2);
        };
      } else if (fn.length > 2) {
        wrappedFn = function(item, index) {
          return fn.call(this, item, index, self2);
        };
      }
    }
    const result = methodFn.call(arr, wrappedFn, thisArg);
    return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
  }
  function reduce(self2, method, fn, args) {
    const arr = shallowReadArray(self2);
    const needsWrap = arr !== self2 && !/* @__PURE__ */ isShallow(self2);
    let wrappedFn = fn;
    let wrapInitialAccumulator = false;
    if (arr !== self2) {
      if (needsWrap) {
        wrapInitialAccumulator = args.length === 0;
        wrappedFn = function(acc, item, index) {
          if (wrapInitialAccumulator) {
            wrapInitialAccumulator = false;
            acc = toWrapped(self2, acc);
          }
          return fn.call(this, acc, toWrapped(self2, item), index, self2);
        };
      } else if (fn.length > 3) {
        wrappedFn = function(acc, item, index) {
          return fn.call(this, acc, item, index, self2);
        };
      }
    }
    const result = arr[method](wrappedFn, ...args);
    return wrapInitialAccumulator ? toWrapped(self2, result) : result;
  }
  function searchProxy(self2, method, args) {
    const arr = /* @__PURE__ */ toRaw(self2);
    track(arr, "iterate", ARRAY_ITERATE_KEY);
    const res = arr[method](...args);
    if ((res === -1 || res === false) && /* @__PURE__ */ isProxy(args[0])) {
      args[0] = /* @__PURE__ */ toRaw(args[0]);
      return arr[method](...args);
    }
    return res;
  }
  function noTracking(self2, method, args = []) {
    pauseTracking();
    startBatch();
    const res = (/* @__PURE__ */ toRaw(self2))[method].apply(self2, args);
    endBatch();
    resetTracking();
    return res;
  }
  var isNonTrackableKeys = /* @__PURE__ */ makeMap(`__proto__,__v_isRef,__isVue`);
  var builtInSymbols = new Set(
    /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol)
  );
  function hasOwnProperty2(key) {
    if (!isSymbol(key)) key = String(key);
    const obj = /* @__PURE__ */ toRaw(this);
    track(obj, "has", key);
    return obj.hasOwnProperty(key);
  }
  var BaseReactiveHandler = class {
    constructor(_isReadonly = false, _isShallow = false) {
      this._isReadonly = _isReadonly;
      this._isShallow = _isShallow;
    }
    get(target, key, receiver) {
      if (key === "__v_skip") return target["__v_skip"];
      const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
      if (key === "__v_isReactive") {
        return !isReadonly2;
      } else if (key === "__v_isReadonly") {
        return isReadonly2;
      } else if (key === "__v_isShallow") {
        return isShallow2;
      } else if (key === "__v_raw") {
        if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || // receiver is not the reactive proxy, but has the same prototype
        // this means the receiver is a user proxy of the reactive proxy
        Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
          return target;
        }
        return;
      }
      const targetIsArray = isArray(target);
      if (!isReadonly2) {
        let fn;
        if (targetIsArray && (fn = arrayInstrumentations[key])) {
          return fn;
        }
        if (key === "hasOwnProperty") {
          return hasOwnProperty2;
        }
      }
      const res = Reflect.get(
        target,
        key,
        // if this is a proxy wrapping a ref, return methods using the raw ref
        // as receiver so that we don't have to call `toRaw` on the ref in all
        // its class methods
        /* @__PURE__ */ isRef2(target) ? target : receiver
      );
      if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
        return res;
      }
      if (!isReadonly2) {
        track(target, "get", key);
      }
      if (isShallow2) {
        return res;
      }
      if (/* @__PURE__ */ isRef2(res)) {
        const value = targetIsArray && isIntegerKey(key) ? res : res.value;
        return isReadonly2 && isObject(value) ? /* @__PURE__ */ readonly(value) : value;
      }
      if (isObject(res)) {
        return isReadonly2 ? /* @__PURE__ */ readonly(res) : /* @__PURE__ */ reactive(res);
      }
      return res;
    }
  };
  var MutableReactiveHandler = class extends BaseReactiveHandler {
    constructor(isShallow2 = false) {
      super(false, isShallow2);
    }
    set(target, key, value, receiver) {
      let oldValue = target[key];
      const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key);
      if (!this._isShallow) {
        const isOldValueReadonly = /* @__PURE__ */ isReadonly(oldValue);
        if (!/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
          oldValue = /* @__PURE__ */ toRaw(oldValue);
          value = /* @__PURE__ */ toRaw(value);
        }
        if (!isArrayWithIntegerKey && /* @__PURE__ */ isRef2(oldValue) && !/* @__PURE__ */ isRef2(value)) {
          if (isOldValueReadonly) {
            if (false) {
              warn(
                `Set operation on key "${String(key)}" failed: target is readonly.`,
                target[key]
              );
            }
            return true;
          } else {
            oldValue.value = value;
            return true;
          }
        }
      }
      const hadKey = isArrayWithIntegerKey ? Number(key) < target.length : hasOwn(target, key);
      const result = Reflect.set(
        target,
        key,
        value,
        /* @__PURE__ */ isRef2(target) ? target : receiver
      );
      if (target === /* @__PURE__ */ toRaw(receiver) && result) {
        if (!hadKey) {
          trigger(target, "add", key, value);
        } else if (hasChanged(value, oldValue)) {
          trigger(target, "set", key, value, oldValue);
        }
      }
      return result;
    }
    deleteProperty(target, key) {
      const hadKey = hasOwn(target, key);
      const oldValue = target[key];
      const result = Reflect.deleteProperty(target, key);
      if (result && hadKey) {
        trigger(target, "delete", key, void 0, oldValue);
      }
      return result;
    }
    has(target, key) {
      const result = Reflect.has(target, key);
      if (!isSymbol(key) || !builtInSymbols.has(key)) {
        track(target, "has", key);
      }
      return result;
    }
    ownKeys(target) {
      track(
        target,
        "iterate",
        isArray(target) ? "length" : ITERATE_KEY
      );
      return Reflect.ownKeys(target);
    }
  };
  var ReadonlyReactiveHandler = class extends BaseReactiveHandler {
    constructor(isShallow2 = false) {
      super(true, isShallow2);
    }
    set(target, key) {
      if (false) {
        warn(
          `Set operation on key "${String(key)}" failed: target is readonly.`,
          target
        );
      }
      return true;
    }
    deleteProperty(target, key) {
      if (false) {
        warn(
          `Delete operation on key "${String(key)}" failed: target is readonly.`,
          target
        );
      }
      return true;
    }
  };
  var mutableHandlers = /* @__PURE__ */ new MutableReactiveHandler();
  var readonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler();
  var shallowReactiveHandlers = /* @__PURE__ */ new MutableReactiveHandler(true);
  var shallowReadonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler(true);
  var toShallow = (value) => value;
  var getProto = (v) => Reflect.getPrototypeOf(v);
  function createIterableMethod(method, isReadonly2, isShallow2) {
    return function(...args) {
      const target = this["__v_raw"];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const targetIsMap = isMap(rawTarget);
      const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
      const isKeyOnly = method === "keys" && targetIsMap;
      const innerIterator = target[method](...args);
      const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
      !isReadonly2 && track(
        rawTarget,
        "iterate",
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
      );
      return extend(
        // inheriting all iterator properties
        Object.create(innerIterator),
        {
          // iterator protocol
          next() {
            const { value, done } = innerIterator.next();
            return done ? { value, done } : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done
            };
          }
        }
      );
    };
  }
  function createReadonlyMethod(type) {
    return function(...args) {
      if (false) {
        const key = args[0] ? `on key "${args[0]}" ` : ``;
        warn(
          `${capitalize(type)} operation ${key}failed: target is readonly.`,
          /* @__PURE__ */ toRaw(this)
        );
      }
      return type === "delete" ? false : type === "clear" ? void 0 : this;
    };
  }
  function createInstrumentations(readonly2, shallow) {
    const instrumentations = {
      get(key) {
        const target = this["__v_raw"];
        const rawTarget = /* @__PURE__ */ toRaw(target);
        const rawKey = /* @__PURE__ */ toRaw(key);
        if (!readonly2) {
          if (hasChanged(key, rawKey)) {
            track(rawTarget, "get", key);
          }
          track(rawTarget, "get", rawKey);
        }
        const { has } = getProto(rawTarget);
        const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
        if (has.call(rawTarget, key)) {
          return wrap(target.get(key));
        } else if (has.call(rawTarget, rawKey)) {
          return wrap(target.get(rawKey));
        } else if (target !== rawTarget) {
          target.get(key);
        }
      },
      get size() {
        const target = this["__v_raw"];
        !readonly2 && track(/* @__PURE__ */ toRaw(target), "iterate", ITERATE_KEY);
        return target.size;
      },
      has(key) {
        const target = this["__v_raw"];
        const rawTarget = /* @__PURE__ */ toRaw(target);
        const rawKey = /* @__PURE__ */ toRaw(key);
        if (!readonly2) {
          if (hasChanged(key, rawKey)) {
            track(rawTarget, "has", key);
          }
          track(rawTarget, "has", rawKey);
        }
        return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
      },
      forEach(callback, thisArg) {
        const observed = this;
        const target = observed["__v_raw"];
        const rawTarget = /* @__PURE__ */ toRaw(target);
        const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
        !readonly2 && track(rawTarget, "iterate", ITERATE_KEY);
        return target.forEach((value, key) => {
          return callback.call(thisArg, wrap(value), wrap(key), observed);
        });
      }
    };
    extend(
      instrumentations,
      readonly2 ? {
        add: createReadonlyMethod("add"),
        set: createReadonlyMethod("set"),
        delete: createReadonlyMethod("delete"),
        clear: createReadonlyMethod("clear")
      } : {
        add(value) {
          const target = /* @__PURE__ */ toRaw(this);
          const proto = getProto(target);
          const rawValue = /* @__PURE__ */ toRaw(value);
          const valueToAdd = !shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value) ? rawValue : value;
          const hadKey = proto.has.call(target, valueToAdd) || hasChanged(value, valueToAdd) && proto.has.call(target, value) || hasChanged(rawValue, valueToAdd) && proto.has.call(target, rawValue);
          if (!hadKey) {
            target.add(valueToAdd);
            trigger(target, "add", valueToAdd, valueToAdd);
          }
          return this;
        },
        set(key, value) {
          if (!shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
            value = /* @__PURE__ */ toRaw(value);
          }
          const target = /* @__PURE__ */ toRaw(this);
          const { has, get } = getProto(target);
          let hadKey = has.call(target, key);
          if (!hadKey) {
            key = /* @__PURE__ */ toRaw(key);
            hadKey = has.call(target, key);
          } else if (false) {
            checkIdentityKeys(target, has, key);
          }
          const oldValue = get.call(target, key);
          target.set(key, value);
          if (!hadKey) {
            trigger(target, "add", key, value);
          } else if (hasChanged(value, oldValue)) {
            trigger(target, "set", key, value, oldValue);
          }
          return this;
        },
        delete(key) {
          const target = /* @__PURE__ */ toRaw(this);
          const { has, get } = getProto(target);
          let hadKey = has.call(target, key);
          if (!hadKey) {
            key = /* @__PURE__ */ toRaw(key);
            hadKey = has.call(target, key);
          } else if (false) {
            checkIdentityKeys(target, has, key);
          }
          const oldValue = get ? get.call(target, key) : void 0;
          const result = target.delete(key);
          if (hadKey) {
            trigger(target, "delete", key, void 0, oldValue);
          }
          return result;
        },
        clear() {
          const target = /* @__PURE__ */ toRaw(this);
          const hadItems = target.size !== 0;
          const oldTarget = false ? isMap(target) ? new Map(target) : new Set(target) : void 0;
          const result = target.clear();
          if (hadItems) {
            trigger(
              target,
              "clear",
              void 0,
              void 0,
              oldTarget
            );
          }
          return result;
        }
      }
    );
    const iteratorMethods = [
      "keys",
      "values",
      "entries",
      Symbol.iterator
    ];
    iteratorMethods.forEach((method) => {
      instrumentations[method] = createIterableMethod(method, readonly2, shallow);
    });
    return instrumentations;
  }
  function createInstrumentationGetter(isReadonly2, shallow) {
    const instrumentations = createInstrumentations(isReadonly2, shallow);
    return (target, key, receiver) => {
      if (key === "__v_isReactive") {
        return !isReadonly2;
      } else if (key === "__v_isReadonly") {
        return isReadonly2;
      } else if (key === "__v_isShallow") {
        return shallow;
      } else if (key === "__v_raw") {
        return target;
      }
      return Reflect.get(
        hasOwn(instrumentations, key) && key in target ? instrumentations : target,
        key,
        receiver
      );
    };
  }
  var mutableCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(false, false)
  };
  var shallowCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(false, true)
  };
  var readonlyCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(true, false)
  };
  var shallowReadonlyCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(true, true)
  };
  var reactiveMap = /* @__PURE__ */ new WeakMap();
  var shallowReactiveMap = /* @__PURE__ */ new WeakMap();
  var readonlyMap = /* @__PURE__ */ new WeakMap();
  var shallowReadonlyMap = /* @__PURE__ */ new WeakMap();
  function targetTypeMap(rawType) {
    switch (rawType) {
      case "Object":
      case "Array":
        return 1;
      case "Map":
      case "Set":
      case "WeakMap":
      case "WeakSet":
        return 2;
      default:
        return 0;
    }
  }
  // @__NO_SIDE_EFFECTS__
  function reactive(target) {
    if (/* @__PURE__ */ isReadonly(target)) {
      return target;
    }
    return createReactiveObject(
      target,
      false,
      mutableHandlers,
      mutableCollectionHandlers,
      reactiveMap
    );
  }
  // @__NO_SIDE_EFFECTS__
  function shallowReactive(target) {
    return createReactiveObject(
      target,
      false,
      shallowReactiveHandlers,
      shallowCollectionHandlers,
      shallowReactiveMap
    );
  }
  // @__NO_SIDE_EFFECTS__
  function readonly(target) {
    return createReactiveObject(
      target,
      true,
      readonlyHandlers,
      readonlyCollectionHandlers,
      readonlyMap
    );
  }
  // @__NO_SIDE_EFFECTS__
  function shallowReadonly(target) {
    return createReactiveObject(
      target,
      true,
      shallowReadonlyHandlers,
      shallowReadonlyCollectionHandlers,
      shallowReadonlyMap
    );
  }
  function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
    if (!isObject(target)) {
      if (false) {
        warn(
          `value cannot be made ${isReadonly2 ? "readonly" : "reactive"}: ${String(
            target
          )}`
        );
      }
      return target;
    }
    if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) {
      return target;
    }
    if (target["__v_skip"] || !Object.isExtensible(target)) {
      return target;
    }
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
      return existingProxy;
    }
    const targetType = targetTypeMap(toRawType(target));
    if (targetType === 0) {
      return target;
    }
    const proxy = new Proxy(
      target,
      targetType === 2 ? collectionHandlers : baseHandlers
    );
    proxyMap.set(target, proxy);
    return proxy;
  }
  // @__NO_SIDE_EFFECTS__
  function isReactive(value) {
    if (/* @__PURE__ */ isReadonly(value)) {
      return /* @__PURE__ */ isReactive(value["__v_raw"]);
    }
    return !!(value && value["__v_isReactive"]);
  }
  // @__NO_SIDE_EFFECTS__
  function isReadonly(value) {
    return !!(value && value["__v_isReadonly"]);
  }
  // @__NO_SIDE_EFFECTS__
  function isShallow(value) {
    return !!(value && value["__v_isShallow"]);
  }
  // @__NO_SIDE_EFFECTS__
  function isProxy(value) {
    return value ? !!value["__v_raw"] : false;
  }
  // @__NO_SIDE_EFFECTS__
  function toRaw(observed) {
    const raw = observed && observed["__v_raw"];
    return raw ? /* @__PURE__ */ toRaw(raw) : observed;
  }
  function markRaw(value) {
    if (!hasOwn(value, "__v_skip") && Object.isExtensible(value)) {
      def(value, "__v_skip", true);
    }
    return value;
  }
  var toReactive = (value) => isObject(value) ? /* @__PURE__ */ reactive(value) : value;
  var toReadonly = (value) => isObject(value) ? /* @__PURE__ */ readonly(value) : value;
  // @__NO_SIDE_EFFECTS__
  function isRef2(r) {
    return r ? r["__v_isRef"] === true : false;
  }
  // @__NO_SIDE_EFFECTS__
  function ref(value) {
    return createRef(value, false);
  }
  // @__NO_SIDE_EFFECTS__
  function shallowRef(value) {
    return createRef(value, true);
  }
  function createRef(rawValue, shallow) {
    if (/* @__PURE__ */ isRef2(rawValue)) {
      return rawValue;
    }
    return new RefImpl(rawValue, shallow);
  }
  var RefImpl = class {
    constructor(value, isShallow2) {
      this.dep = new Dep();
      this["__v_isRef"] = true;
      this["__v_isShallow"] = false;
      this._rawValue = isShallow2 ? value : /* @__PURE__ */ toRaw(value);
      this._value = isShallow2 ? value : toReactive(value);
      this["__v_isShallow"] = isShallow2;
    }
    get value() {
      if (false) {
        this.dep.track({
          target: this,
          type: "get",
          key: "value"
        });
      } else {
        this.dep.track();
      }
      return this._value;
    }
    set value(newValue) {
      const oldValue = this._rawValue;
      const useDirectValue = this["__v_isShallow"] || /* @__PURE__ */ isShallow(newValue) || /* @__PURE__ */ isReadonly(newValue);
      newValue = useDirectValue ? newValue : /* @__PURE__ */ toRaw(newValue);
      if (hasChanged(newValue, oldValue)) {
        this._rawValue = newValue;
        this._value = useDirectValue ? newValue : toReactive(newValue);
        if (false) {
          this.dep.trigger({
            target: this,
            type: "set",
            key: "value",
            newValue,
            oldValue
          });
        } else {
          this.dep.trigger();
        }
      }
    }
  };
  function triggerRef(ref2) {
    if (ref2.dep) {
      if (false) {
        ref2.dep.trigger({
          target: ref2,
          type: "set",
          key: "value",
          newValue: ref2._value
        });
      } else {
        ref2.dep.trigger();
      }
    }
  }
  function unref(ref2) {
    return /* @__PURE__ */ isRef2(ref2) ? ref2.value : ref2;
  }
  function toValue(source) {
    return isFunction(source) ? source() : unref(source);
  }
  var shallowUnwrapHandlers = {
    get: (target, key, receiver) => key === "__v_raw" ? target : unref(Reflect.get(target, key, receiver)),
    set: (target, key, value, receiver) => {
      const oldValue = target[key];
      if (/* @__PURE__ */ isRef2(oldValue) && !/* @__PURE__ */ isRef2(value)) {
        oldValue.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    }
  };
  function proxyRefs(objectWithRefs) {
    return /* @__PURE__ */ isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
  }
  var CustomRefImpl = class {
    constructor(factory) {
      this["__v_isRef"] = true;
      this._value = void 0;
      const dep = this.dep = new Dep();
      const { get, set } = factory(dep.track.bind(dep), dep.trigger.bind(dep));
      this._get = get;
      this._set = set;
    }
    get value() {
      return this._value = this._get();
    }
    set value(newVal) {
      this._set(newVal);
    }
  };
  function customRef(factory) {
    return new CustomRefImpl(factory);
  }
  // @__NO_SIDE_EFFECTS__
  function toRefs(object) {
    if (false) {
      warn(`toRefs() expects a reactive object but received a plain one.`);
    }
    const ret = isArray(object) ? new Array(object.length) : {};
    for (const key in object) {
      ret[key] = propertyToRef(object, key);
    }
    return ret;
  }
  var ObjectRefImpl = class {
    constructor(_object, key, _defaultValue) {
      this._object = _object;
      this._defaultValue = _defaultValue;
      this["__v_isRef"] = true;
      this._value = void 0;
      this._key = isSymbol(key) ? key : String(key);
      this._raw = /* @__PURE__ */ toRaw(_object);
      let shallow = true;
      let obj = _object;
      if (!isArray(_object) || isSymbol(this._key) || !isIntegerKey(this._key)) {
        do {
          shallow = !/* @__PURE__ */ isProxy(obj) || /* @__PURE__ */ isShallow(obj);
        } while (shallow && (obj = obj["__v_raw"]));
      }
      this._shallow = shallow;
    }
    get value() {
      let val = this._object[this._key];
      if (this._shallow) {
        val = unref(val);
      }
      return this._value = val === void 0 ? this._defaultValue : val;
    }
    set value(newVal) {
      if (this._shallow && /* @__PURE__ */ isRef2(this._raw[this._key])) {
        const nestedRef = this._object[this._key];
        if (/* @__PURE__ */ isRef2(nestedRef)) {
          nestedRef.value = newVal;
          return;
        }
      }
      this._object[this._key] = newVal;
    }
    get dep() {
      return getDepFromReactive(this._raw, this._key);
    }
  };
  var GetterRefImpl = class {
    constructor(_getter) {
      this._getter = _getter;
      this["__v_isRef"] = true;
      this["__v_isReadonly"] = true;
      this._value = void 0;
    }
    get value() {
      return this._value = this._getter();
    }
  };
  // @__NO_SIDE_EFFECTS__
  function toRef(source, key, defaultValue) {
    if (/* @__PURE__ */ isRef2(source)) {
      return source;
    } else if (isFunction(source)) {
      return new GetterRefImpl(source);
    } else if (isObject(source) && arguments.length > 1) {
      return propertyToRef(source, key, defaultValue);
    } else {
      return /* @__PURE__ */ ref(source);
    }
  }
  function propertyToRef(source, key, defaultValue) {
    return new ObjectRefImpl(source, key, defaultValue);
  }
  var ComputedRefImpl = class {
    constructor(fn, setter, isSSR) {
      this.fn = fn;
      this.setter = setter;
      this._value = void 0;
      this.dep = new Dep(this);
      this.__v_isRef = true;
      this.deps = void 0;
      this.depsTail = void 0;
      this.flags = 16;
      this.globalVersion = globalVersion - 1;
      this.next = void 0;
      this.effect = this;
      this["__v_isReadonly"] = !setter;
      this.isSSR = isSSR;
    }
    /**
     * @internal
     */
    notify() {
      this.flags |= 16;
      if (!(this.flags & 8) && // avoid infinite self recursion
      activeSub !== this) {
        batch(this, true);
        return true;
      } else if (false) ;
    }
    get value() {
      const link = false ? this.dep.track({
        target: this,
        type: "get",
        key: "value"
      }) : this.dep.track();
      refreshComputed(this);
      if (link) {
        link.version = this.dep.version;
      }
      return this._value;
    }
    set value(newValue) {
      if (this.setter) {
        this.setter(newValue);
      } else if (false) {
        warn("Write operation failed: computed value is readonly");
      }
    }
  };
  // @__NO_SIDE_EFFECTS__
  function computed(getterOrOptions, debugOptions, isSSR = false) {
    let getter;
    let setter;
    if (isFunction(getterOrOptions)) {
      getter = getterOrOptions;
    } else {
      getter = getterOrOptions.get;
      setter = getterOrOptions.set;
    }
    const cRef = new ComputedRefImpl(getter, setter, isSSR);
    if (false) {
      cRef.onTrack = debugOptions.onTrack;
      cRef.onTrigger = debugOptions.onTrigger;
    }
    return cRef;
  }
  var TrackOpTypes = {
    "GET": "get",
    "HAS": "has",
    "ITERATE": "iterate"
  };
  var TriggerOpTypes = {
    "SET": "set",
    "ADD": "add",
    "DELETE": "delete",
    "CLEAR": "clear"
  };
  var INITIAL_WATCHER_VALUE = {};
  var cleanupMap = /* @__PURE__ */ new WeakMap();
  var activeWatcher = void 0;
  function getCurrentWatcher() {
    return activeWatcher;
  }
  function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
    if (owner) {
      let cleanups = cleanupMap.get(owner);
      if (!cleanups) cleanupMap.set(owner, cleanups = []);
      cleanups.push(cleanupFn);
    } else if (false) {
      warn(
        `onWatcherCleanup() was called when there was no active watcher to associate with.`
      );
    }
  }
  function watch(source, cb, options = EMPTY_OBJ) {
    const { immediate, deep, once, scheduler, augmentJob, call } = options;
    const warnInvalidSource = (s) => {
      (options.onWarn || warn)(
        `Invalid watch source: `,
        s,
        `A watch source can only be a getter/effect function, a ref, a reactive object, or an array of these types.`
      );
    };
    const reactiveGetter = (source2) => {
      if (deep) return source2;
      if (/* @__PURE__ */ isShallow(source2) || deep === false || deep === 0)
        return traverse(source2, 1);
      return traverse(source2);
    };
    let effect2;
    let getter;
    let cleanup;
    let boundCleanup;
    let forceTrigger = false;
    let isMultiSource = false;
    if (/* @__PURE__ */ isRef2(source)) {
      getter = () => source.value;
      forceTrigger = /* @__PURE__ */ isShallow(source);
    } else if (/* @__PURE__ */ isReactive(source)) {
      getter = () => reactiveGetter(source);
      forceTrigger = true;
    } else if (isArray(source)) {
      isMultiSource = true;
      forceTrigger = source.some((s) => /* @__PURE__ */ isReactive(s) || /* @__PURE__ */ isShallow(s));
      getter = () => source.map((s) => {
        if (/* @__PURE__ */ isRef2(s)) {
          return s.value;
        } else if (/* @__PURE__ */ isReactive(s)) {
          return reactiveGetter(s);
        } else if (isFunction(s)) {
          return call ? call(s, 2) : s();
        } else {
        }
      });
    } else if (isFunction(source)) {
      if (cb) {
        getter = call ? () => call(source, 2) : source;
      } else {
        getter = () => {
          if (cleanup) {
            pauseTracking();
            try {
              cleanup();
            } finally {
              resetTracking();
            }
          }
          const currentEffect = activeWatcher;
          activeWatcher = effect2;
          try {
            return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
          } finally {
            activeWatcher = currentEffect;
          }
        };
      }
    } else {
      getter = NOOP;
    }
    if (cb && deep) {
      const baseGetter = getter;
      const depth = deep === true ? Infinity : deep;
      getter = () => traverse(baseGetter(), depth);
    }
    const scope = getCurrentScope();
    const watchHandle = () => {
      effect2.stop();
      if (scope && scope.active) {
        remove(scope.effects, effect2);
      }
    };
    if (once && cb) {
      const _cb = cb;
      cb = (...args) => {
        try {
          return _cb(...args);
        } finally {
          watchHandle();
        }
      };
    }
    let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
    const job = (immediateFirstRun) => {
      if (!(effect2.flags & 1) || !effect2.dirty && !immediateFirstRun) {
        return;
      }
      if (cb) {
        const newValue = effect2.run();
        if (immediateFirstRun || deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue))) {
          const currentWatcher = activeWatcher;
          pauseTracking();
          try {
            if (cleanup) {
              cleanup();
            }
            activeWatcher = effect2;
            const args = [
              newValue,
              // pass undefined as the old value when it's changed for the first time
              oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
              boundCleanup
            ];
            oldValue = newValue;
            call ? call(cb, 3, args) : (
              // @ts-expect-error
              cb(...args)
            );
          } finally {
            activeWatcher = currentWatcher;
            resetTracking();
          }
        }
      } else {
        effect2.run();
      }
    };
    if (augmentJob) {
      augmentJob(job);
    }
    effect2 = new ReactiveEffect(getter);
    effect2.scheduler = scheduler ? () => scheduler(job, false) : job;
    boundCleanup = (fn) => onWatcherCleanup(fn, false, effect2);
    cleanup = effect2.onStop = () => {
      const cleanups = cleanupMap.get(effect2);
      if (cleanups) {
        if (call) {
          call(cleanups, 4);
        } else {
          for (const cleanup2 of cleanups) cleanup2();
        }
        cleanupMap.delete(effect2);
      }
    };
    if (false) {
      effect2.onTrack = options.onTrack;
      effect2.onTrigger = options.onTrigger;
    }
    if (cb) {
      if (immediate) {
        job(true);
      } else {
        oldValue = effect2.run();
      }
    } else if (scheduler) {
      scheduler(job.bind(null, true), true);
    } else {
      effect2.run();
    }
    watchHandle.pause = effect2.pause.bind(effect2);
    watchHandle.resume = effect2.resume.bind(effect2);
    watchHandle.stop = watchHandle;
    return watchHandle;
  }
  function traverse(value, depth = Infinity, seen2) {
    if (depth <= 0 || !isObject(value) || value["__v_skip"]) {
      return value;
    }
    seen2 = seen2 || /* @__PURE__ */ new Map();
    if ((seen2.get(value) || 0) >= depth) {
      return value;
    }
    seen2.set(value, depth);
    depth--;
    if (/* @__PURE__ */ isRef2(value)) {
      traverse(value.value, depth, seen2);
    } else if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        traverse(value[i], depth, seen2);
      }
    } else if (isSet(value) || isMap(value)) {
      value.forEach((v) => {
        traverse(v, depth, seen2);
      });
    } else if (isPlainObject(value)) {
      for (const key in value) {
        traverse(value[key], depth, seen2);
      }
      for (const key of Object.getOwnPropertySymbols(value)) {
        if (Object.prototype.propertyIsEnumerable.call(value, key)) {
          traverse(value[key], depth, seen2);
        }
      }
    }
    return value;
  }

  // node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js
  /**
  * @vue/runtime-core v3.5.44
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  var stack = [];
  function pushWarningContext(vnode) {
    stack.push(vnode);
  }
  function popWarningContext() {
    stack.pop();
  }
  var isWarning = false;
  function warn$1(msg, ...args) {
    if (isWarning) return;
    isWarning = true;
    pauseTracking();
    const instance = stack.length ? stack[stack.length - 1].component : null;
    const appWarnHandler = instance && instance.appContext.config.warnHandler;
    const trace = getComponentTrace();
    if (appWarnHandler) {
      callWithErrorHandling(
        appWarnHandler,
        instance,
        11,
        [
          // eslint-disable-next-line no-restricted-syntax
          msg + args.map((a) => {
            var _a, _b;
            return (_b = (_a = a.toString) == null ? void 0 : _a.call(a)) != null ? _b : JSON.stringify(a);
          }).join(""),
          instance && instance.proxy,
          trace.map(
            ({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`
          ).join("\n"),
          trace
        ]
      );
    } else {
      const warnArgs = [`[Vue warn]: ${msg}`, ...args];
      if (trace.length && // avoid spamming console during tests
      true) {
        warnArgs.push(`
`, ...formatTrace(trace));
      }
      console.warn(...warnArgs);
    }
    resetTracking();
    isWarning = false;
  }
  function getComponentTrace() {
    let currentVNode = stack[stack.length - 1];
    if (!currentVNode) {
      return [];
    }
    const normalizedStack = [];
    while (currentVNode) {
      const last = normalizedStack[0];
      if (last && last.vnode === currentVNode) {
        last.recurseCount++;
      } else {
        normalizedStack.push({
          vnode: currentVNode,
          recurseCount: 0
        });
      }
      const parentInstance = currentVNode.component && currentVNode.component.parent;
      currentVNode = parentInstance && parentInstance.vnode;
    }
    return normalizedStack;
  }
  function formatTrace(trace) {
    const logs = [];
    trace.forEach((entry, i) => {
      logs.push(...i === 0 ? [] : [`
`], ...formatTraceEntry(entry));
    });
    return logs;
  }
  function formatTraceEntry({ vnode, recurseCount }) {
    const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
    const isRoot = vnode.component ? vnode.component.parent == null : false;
    const open = ` at <${formatComponentName(
      vnode.component,
      vnode.type,
      isRoot
    )}`;
    const close = `>` + postfix;
    return vnode.props ? [open, ...formatProps(vnode.props), close] : [open + close];
  }
  function formatProps(props) {
    const res = [];
    const keys = Object.keys(props);
    keys.slice(0, 3).forEach((key) => {
      res.push(...formatProp(key, props[key]));
    });
    if (keys.length > 3) {
      res.push(` ...`);
    }
    return res;
  }
  function formatProp(key, value, raw) {
    if (isString(value)) {
      value = JSON.stringify(value);
      return raw ? value : [`${key}=${value}`];
    } else if (typeof value === "number" || typeof value === "boolean" || value == null) {
      return raw ? value : [`${key}=${value}`];
    } else if (isRef2(value)) {
      value = formatProp(key, toRaw(value.value), true);
      return raw ? value : [`${key}=Ref<`, value, `>`];
    } else if (isFunction(value)) {
      return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
    } else {
      value = toRaw(value);
      return raw ? value : [`${key}=`, value];
    }
  }
  function assertNumber(val, type) {
    if (true) return;
    if (val === void 0) {
      return;
    } else if (typeof val !== "number") {
      warn$1(`${type} is not a valid number - got ${JSON.stringify(val)}.`);
    } else if (isNaN(val)) {
      warn$1(`${type} is NaN - the duration expression might be incorrect.`);
    }
  }
  var ErrorCodes = {
    "SETUP_FUNCTION": 0,
    "0": "SETUP_FUNCTION",
    "RENDER_FUNCTION": 1,
    "1": "RENDER_FUNCTION",
    "NATIVE_EVENT_HANDLER": 5,
    "5": "NATIVE_EVENT_HANDLER",
    "COMPONENT_EVENT_HANDLER": 6,
    "6": "COMPONENT_EVENT_HANDLER",
    "VNODE_HOOK": 7,
    "7": "VNODE_HOOK",
    "DIRECTIVE_HOOK": 8,
    "8": "DIRECTIVE_HOOK",
    "TRANSITION_HOOK": 9,
    "9": "TRANSITION_HOOK",
    "APP_ERROR_HANDLER": 10,
    "10": "APP_ERROR_HANDLER",
    "APP_WARN_HANDLER": 11,
    "11": "APP_WARN_HANDLER",
    "FUNCTION_REF": 12,
    "12": "FUNCTION_REF",
    "ASYNC_COMPONENT_LOADER": 13,
    "13": "ASYNC_COMPONENT_LOADER",
    "SCHEDULER": 14,
    "14": "SCHEDULER",
    "COMPONENT_UPDATE": 15,
    "15": "COMPONENT_UPDATE",
    "APP_UNMOUNT_CLEANUP": 16,
    "16": "APP_UNMOUNT_CLEANUP"
  };
  var ErrorTypeStrings$1 = {
    ["sp"]: "serverPrefetch hook",
    ["bc"]: "beforeCreate hook",
    ["c"]: "created hook",
    ["bm"]: "beforeMount hook",
    ["m"]: "mounted hook",
    ["bu"]: "beforeUpdate hook",
    ["u"]: "updated",
    ["bum"]: "beforeUnmount hook",
    ["um"]: "unmounted hook",
    ["a"]: "activated hook",
    ["da"]: "deactivated hook",
    ["ec"]: "errorCaptured hook",
    ["rtc"]: "renderTracked hook",
    ["rtg"]: "renderTriggered hook",
    [0]: "setup function",
    [1]: "render function",
    [2]: "watcher getter",
    [3]: "watcher callback",
    [4]: "watcher cleanup function",
    [5]: "native event handler",
    [6]: "component event handler",
    [7]: "vnode hook",
    [8]: "directive hook",
    [9]: "transition hook",
    [10]: "app errorHandler",
    [11]: "app warnHandler",
    [12]: "ref function",
    [13]: "async component loader",
    [14]: "scheduler flush",
    [15]: "component update",
    [16]: "app unmount cleanup function"
  };
  function callWithErrorHandling(fn, instance, type, args) {
    try {
      return args ? fn(...args) : fn();
    } catch (err) {
      handleError(err, instance, type);
    }
  }
  function callWithAsyncErrorHandling(fn, instance, type, args) {
    if (isFunction(fn)) {
      const res = callWithErrorHandling(fn, instance, type, args);
      if (res && isPromise(res)) {
        res.catch((err) => {
          handleError(err, instance, type);
        });
      }
      return res;
    }
    if (isArray(fn)) {
      const values = [];
      for (let i = 0; i < fn.length; i++) {
        values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
      }
      return values;
    } else if (false) {
      warn$1(
        `Invalid value type passed to callWithAsyncErrorHandling(): ${typeof fn}`
      );
    }
  }
  function handleError(err, instance, type, throwInDev = true) {
    const contextVNode = instance ? instance.vnode : null;
    const { errorHandler, throwUnhandledErrorInProduction } = instance && instance.appContext.config || EMPTY_OBJ;
    if (instance) {
      let cur = instance.parent;
      const exposedInstance = instance.proxy;
      const errorInfo = false ? ErrorTypeStrings$1[type] : `https://vuejs.org/error-reference/#runtime-${type}`;
      while (cur) {
        const errorCapturedHooks = cur.ec;
        if (errorCapturedHooks) {
          for (let i = 0; i < errorCapturedHooks.length; i++) {
            if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) {
              return;
            }
          }
        }
        cur = cur.parent;
      }
      if (errorHandler) {
        pauseTracking();
        callWithErrorHandling(errorHandler, null, 10, [
          err,
          exposedInstance,
          errorInfo
        ]);
        resetTracking();
        return;
      }
    }
    logError(err, type, contextVNode, throwInDev, throwUnhandledErrorInProduction);
  }
  function logError(err, type, contextVNode, throwInDev = true, throwInProd = false) {
    if (false) {
      const info = ErrorTypeStrings$1[type];
      if (contextVNode) {
        pushWarningContext(contextVNode);
      }
      warn$1(`Unhandled error${info ? ` during execution of ${info}` : ``}`);
      if (contextVNode) {
        popWarningContext();
      }
      if (throwInDev) {
        throw err;
      } else {
        console.error(err);
      }
    } else if (throwInProd) {
      throw err;
    } else {
      console.error(err);
    }
  }
  var queue = [];
  var flushIndex = -1;
  var pendingPostFlushCbs = [];
  var activePostFlushCbs = null;
  var postFlushIndex = 0;
  var resolvedPromise = /* @__PURE__ */ Promise.resolve();
  var currentFlushPromise = null;
  function nextTick(fn) {
    const p2 = currentFlushPromise || resolvedPromise;
    return fn ? p2.then(this ? fn.bind(this) : fn) : p2;
  }
  function findInsertionIndex(id) {
    let start = flushIndex + 1;
    let end = queue.length;
    while (start < end) {
      const middle = start + end >>> 1;
      const middleJob = queue[middle];
      const middleJobId = getId(middleJob);
      if (middleJobId < id || middleJobId === id && middleJob.flags & 2) {
        start = middle + 1;
      } else {
        end = middle;
      }
    }
    return start;
  }
  function queueJob(job) {
    if (!(job.flags & 1)) {
      const jobId = getId(job);
      const lastJob = queue[queue.length - 1];
      if (!lastJob || // fast path when the job id is larger than the tail
      !(job.flags & 2) && jobId >= getId(lastJob)) {
        queue.push(job);
      } else {
        queue.splice(findInsertionIndex(jobId), 0, job);
      }
      job.flags |= 1;
      queueFlush();
    }
  }
  function queueFlush() {
    if (!currentFlushPromise) {
      currentFlushPromise = resolvedPromise.then(flushJobs);
    }
  }
  function queuePostFlushCb(cb) {
    if (!isArray(cb)) {
      if (activePostFlushCbs && cb.id === -1) {
        activePostFlushCbs.splice(postFlushIndex + 1, 0, cb);
      } else if (!(cb.flags & 1)) {
        pendingPostFlushCbs.push(cb);
        cb.flags |= 1;
      }
    } else {
      for (let i = 0; i < cb.length; i++) {
        pendingPostFlushCbs.push(cb[i]);
      }
    }
    queueFlush();
  }
  function flushPreFlushCbs(instance, minUid, seen2, i = flushIndex + 1) {
    if (false) {
      seen2 = seen2 || /* @__PURE__ */ new Map();
    }
    for (; i < queue.length; i++) {
      const cb = queue[i];
      if (cb && cb.flags & 2) {
        if (instance && cb.id !== instance.uid || minUid !== void 0 && !(cb.id >= minUid)) {
          continue;
        }
        if (false) {
          continue;
        }
        queue.splice(i, 1);
        i = instance ? i - 1 : flushIndex;
        if (cb.flags & 4) {
          cb.flags &= -2;
        }
        cb();
        if (!(cb.flags & 4)) {
          cb.flags &= -2;
        }
      }
    }
  }
  function flushPostFlushCbs(seen2, skip, minUid = 0) {
    if (pendingPostFlushCbs.length) {
      let cbs = pendingPostFlushCbs;
      let kept = 0;
      if (skip) {
        cbs = [];
        for (let i = 0; i < pendingPostFlushCbs.length; i++) {
          const cb = pendingPostFlushCbs[i];
          if (cb.i !== void 0 ? !cb.i || cb.i.uid < minUid : skip.has(cb)) {
            pendingPostFlushCbs[kept++] = cb;
          } else {
            cbs.push(cb);
          }
        }
      }
      const deduped = [...new Set(cbs)].sort((a, b) => getId(a) - getId(b));
      pendingPostFlushCbs.length = kept;
      if (activePostFlushCbs) {
        for (let i = 0; i < deduped.length; i++) {
          activePostFlushCbs.push(deduped[i]);
        }
        return;
      }
      activePostFlushCbs = deduped;
      if (false) {
        seen2 = seen2 || /* @__PURE__ */ new Map();
      }
      for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
        const cb = activePostFlushCbs[postFlushIndex];
        if (false) {
          continue;
        }
        if (cb.flags & 4) {
          cb.flags &= -2;
        }
        if (!(cb.flags & 8)) cb();
        cb.flags &= -2;
      }
      activePostFlushCbs = null;
      postFlushIndex = 0;
    }
  }
  var isFlushing = false;
  function flushOnAppMount(fn, minUid) {
    if (isFlushing) {
      fn();
      return;
    }
    const queued = minUid === void 0 ? void 0 : new Set(pendingPostFlushCbs);
    fn();
    isFlushing = true;
    try {
      flushPreFlushCbs(void 0, minUid);
      flushPostFlushCbs(void 0, queued, minUid);
    } finally {
      isFlushing = false;
    }
  }
  var getId = (job) => job.id == null ? job.flags & 2 ? -1 : Infinity : job.id;
  function flushJobs(seen2) {
    if (false) {
      seen2 = seen2 || /* @__PURE__ */ new Map();
    }
    const check = false ? (job) => checkRecursiveUpdates(seen2, job) : NOOP;
    try {
      for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
        const job = queue[flushIndex];
        if (job && !(job.flags & 8)) {
          if (false) {
            continue;
          }
          if (job.flags & 4) {
            job.flags &= ~1;
          }
          callWithErrorHandling(
            job,
            job.i,
            job.i ? 15 : 14
          );
          if (!(job.flags & 4)) {
            job.flags &= ~1;
          }
        }
      }
    } finally {
      for (; flushIndex < queue.length; flushIndex++) {
        const job = queue[flushIndex];
        if (job) {
          job.flags &= -2;
        }
      }
      flushIndex = -1;
      queue.length = 0;
      flushPostFlushCbs(seen2);
      currentFlushPromise = null;
      if (queue.length || pendingPostFlushCbs.length) {
        flushJobs(seen2);
      }
    }
  }
  var isHmrUpdating = false;
  if (false) {
    getGlobalThis().__VUE_HMR_RUNTIME__ = {
      createRecord: tryWrap(createRecord),
      rerender: tryWrap(rerender),
      reload: tryWrap(reload)
    };
  }
  var devtools$1;
  var buffer = [];
  var devtoolsNotInstalled = false;
  function setDevtoolsHook$1(hook, target) {
    var _a, _b;
    devtools$1 = hook;
    if (devtools$1) {
      devtools$1.enabled = true;
      buffer.forEach(({ event, args }) => devtools$1.emit(event, ...args));
      buffer = [];
    } else if (
      // handle late devtools injection - only do this if we are in an actual
      // browser environment to avoid the timer handle stalling test runner exit
      // (#4815)
      typeof window !== "undefined" && // some envs mock window but not fully
      window.HTMLElement && // also exclude jsdom
      // eslint-disable-next-line no-restricted-syntax
      !((_b = (_a = window.navigator) == null ? void 0 : _a.userAgent) == null ? void 0 : _b.includes("jsdom"))
    ) {
      const replay = target.__VUE_DEVTOOLS_HOOK_REPLAY__ = target.__VUE_DEVTOOLS_HOOK_REPLAY__ || [];
      replay.push((newHook) => {
        setDevtoolsHook$1(newHook, target);
      });
      setTimeout(() => {
        if (!devtools$1) {
          target.__VUE_DEVTOOLS_HOOK_REPLAY__ = null;
          devtoolsNotInstalled = true;
          buffer = [];
        }
      }, 3e3);
    } else {
      devtoolsNotInstalled = true;
      buffer = [];
    }
  }
  var currentRenderingInstance = null;
  var currentScopeId = null;
  function setCurrentRenderingInstance(instance) {
    const prev = currentRenderingInstance;
    currentRenderingInstance = instance;
    currentScopeId = instance && instance.type.__scopeId || null;
    return prev;
  }
  function pushScopeId(id) {
    currentScopeId = id;
  }
  function popScopeId() {
    currentScopeId = null;
  }
  var withScopeId = (_id) => withCtx;
  function withCtx(fn, ctx = currentRenderingInstance, isNonScopedSlot) {
    if (!ctx) return fn;
    if (fn._n) {
      return fn;
    }
    const renderFnWithContext = (...args) => {
      if (renderFnWithContext._d) {
        setBlockTracking(-1);
      }
      const prevInstance = setCurrentRenderingInstance(ctx);
      const prevStackSize = blockStack.length;
      let res;
      try {
        res = fn(...args);
      } finally {
        for (let i = blockStack.length; i > prevStackSize; i--) closeBlock();
        setCurrentRenderingInstance(prevInstance);
        if (renderFnWithContext._d) {
          setBlockTracking(1);
        }
      }
      if (false) {
        devtoolsComponentUpdated(ctx);
      }
      return res;
    };
    renderFnWithContext._n = true;
    renderFnWithContext._c = true;
    renderFnWithContext._d = true;
    return renderFnWithContext;
  }
  function withDirectives(vnode, directives) {
    if (currentRenderingInstance === null) {
      return vnode;
    }
    const instance = getComponentPublicInstance(currentRenderingInstance);
    const bindings = vnode.dirs || (vnode.dirs = []);
    for (let i = 0; i < directives.length; i++) {
      let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i];
      if (dir) {
        if (isFunction(dir)) {
          dir = {
            mounted: dir,
            updated: dir
          };
        }
        if (dir.deep) {
          traverse(value);
        }
        bindings.push({
          dir,
          instance,
          value,
          oldValue: void 0,
          arg,
          modifiers
        });
      }
    }
    return vnode;
  }
  function invokeDirectiveHook(vnode, prevVNode, instance, name) {
    const bindings = vnode.dirs;
    const oldBindings = prevVNode && prevVNode.dirs;
    for (let i = 0; i < bindings.length; i++) {
      const binding = bindings[i];
      if (oldBindings) {
        binding.oldValue = oldBindings[i].value;
      }
      let hook = binding.dir[name];
      if (hook) {
        pauseTracking();
        callWithAsyncErrorHandling(hook, instance, 8, [
          vnode.el,
          binding,
          vnode,
          prevVNode
        ]);
        resetTracking();
      }
    }
  }
  function provide(key, value) {
    if (false) {
      if (!currentInstance || currentInstance.isMounted) {
        warn$1(`provide() can only be used inside setup().`);
      }
    }
    if (currentInstance) {
      let provides = currentInstance.provides;
      const parentProvides = currentInstance.parent && currentInstance.parent.provides;
      if (parentProvides === provides) {
        provides = currentInstance.provides = Object.create(parentProvides);
      }
      provides[key] = value;
    }
  }
  function inject(key, defaultValue, treatDefaultAsFactory = false) {
    const instance = getCurrentInstance();
    if (instance || currentApp) {
      let provides = currentApp ? currentApp._context.provides : instance ? instance.parent == null || instance.ce ? instance.vnode.appContext && instance.vnode.appContext.provides : instance.parent.provides : void 0;
      if (provides && key in provides) {
        return provides[key];
      } else if (arguments.length > 1) {
        return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
      } else if (false) {
        warn$1(`injection "${String(key)}" not found.`);
      }
    } else if (false) {
      warn$1(`inject() can only be used inside setup() or functional components.`);
    }
  }
  function hasInjectionContext() {
    return !!(getCurrentInstance() || currentApp);
  }
  var ssrContextKey = /* @__PURE__ */ Symbol.for("v-scx");
  var useSSRContext = () => {
    {
      const ctx = inject(ssrContextKey);
      if (!ctx) {
      }
      return ctx;
    }
  };
  function watchEffect(effect2, options) {
    return doWatch(effect2, null, options);
  }
  function watchPostEffect(effect2, options) {
    return doWatch(
      effect2,
      null,
      false ? extend({}, options, { flush: "post" }) : { flush: "post" }
    );
  }
  function watchSyncEffect(effect2, options) {
    return doWatch(
      effect2,
      null,
      false ? extend({}, options, { flush: "sync" }) : { flush: "sync" }
    );
  }
  function watch2(source, cb, options) {
    if (false) {
      warn$1(
        `\`watch(fn, options?)\` signature has been moved to a separate API. Use \`watchEffect(fn, options?)\` instead. \`watch\` now only supports \`watch(source, cb, options?) signature.`
      );
    }
    return doWatch(source, cb, options);
  }
  function doWatch(source, cb, options = EMPTY_OBJ) {
    const { immediate, deep, flush, once } = options;
    if (false) {
      if (immediate !== void 0) {
        warn$1(
          `watch() "immediate" option is only respected when using the watch(source, callback, options?) signature.`
        );
      }
      if (deep !== void 0) {
        warn$1(
          `watch() "deep" option is only respected when using the watch(source, callback, options?) signature.`
        );
      }
      if (once !== void 0) {
        warn$1(
          `watch() "once" option is only respected when using the watch(source, callback, options?) signature.`
        );
      }
    }
    const baseWatchOptions = extend({}, options);
    if (false) baseWatchOptions.onWarn = warn$1;
    const runsImmediately = cb && immediate || !cb && flush !== "post";
    let ssrCleanup;
    if (isInSSRComponentSetup) {
      if (flush === "sync") {
        const ctx = useSSRContext();
        ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = []);
      } else if (!runsImmediately) {
        const watchStopHandle = () => {
        };
        watchStopHandle.stop = NOOP;
        watchStopHandle.resume = NOOP;
        watchStopHandle.pause = NOOP;
        return watchStopHandle;
      }
    }
    const instance = currentInstance;
    baseWatchOptions.call = (fn, type, args) => callWithAsyncErrorHandling(fn, instance, type, args);
    let isPre = false;
    if (flush === "post") {
      baseWatchOptions.scheduler = (job) => {
        job.i = instance;
        queuePostRenderEffect(job, instance && instance.suspense);
      };
    } else if (flush !== "sync") {
      isPre = true;
      baseWatchOptions.scheduler = (job, isFirstRun) => {
        if (isFirstRun) {
          job();
        } else {
          queueJob(job);
        }
      };
    }
    baseWatchOptions.augmentJob = (job) => {
      if (cb) {
        job.flags |= 4;
      }
      if (isPre) {
        job.flags |= 2;
        if (instance) {
          job.id = instance.uid;
          job.i = instance;
        }
      }
    };
    const watchHandle = watch(source, cb, baseWatchOptions);
    if (isInSSRComponentSetup) {
      if (ssrCleanup) {
        ssrCleanup.push(watchHandle);
      } else if (runsImmediately) {
        watchHandle();
      }
    }
    return watchHandle;
  }
  function instanceWatch(source, value, options) {
    const publicThis = this.proxy;
    const getter = isString(source) ? source.includes(".") ? createPathGetter(publicThis, source) : () => publicThis[source] : source.bind(publicThis, publicThis);
    let cb;
    if (isFunction(value)) {
      cb = value;
    } else {
      cb = value.handler;
      options = value;
    }
    const reset2 = setCurrentInstance(this);
    const res = doWatch(getter, cb.bind(publicThis), options);
    reset2();
    return res;
  }
  function createPathGetter(ctx, path) {
    const segments = path.split(".");
    return () => {
      let cur = ctx;
      for (let i = 0; i < segments.length && cur; i++) {
        cur = cur[segments[i]];
      }
      return cur;
    };
  }
  var pendingMounts = /* @__PURE__ */ new WeakMap();
  var TeleportEndKey = /* @__PURE__ */ Symbol("_vte");
  var isTeleport = (type) => type.__isTeleport;
  var isTeleportDisabled = (props) => props && (props.disabled || props.disabled === "");
  var isTeleportDeferred = (props) => props && (props.defer || props.defer === "");
  var isTargetSVG = (target) => typeof SVGElement !== "undefined" && target instanceof SVGElement;
  var isTargetMathML = (target) => typeof MathMLElement === "function" && target instanceof MathMLElement;
  var resolveTarget = (props, select) => {
    const targetSelector = props && props.to;
    if (isString(targetSelector)) {
      if (!select) {
        return null;
      } else {
        const target = select(targetSelector);
        if (false) {
          warn$1(
            `Failed to locate Teleport target with selector "${targetSelector}". Note the target element must exist before the component is mounted - i.e. the target cannot be rendered by the component itself, and ideally should be outside of the entire Vue component tree.`
          );
        }
        return target;
      }
    } else {
      if (false) {
        warn$1(`Invalid Teleport target: ${targetSelector}`);
      }
      return targetSelector;
    }
  };
  var TeleportImpl = {
    name: "Teleport",
    __isTeleport: true,
    process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals) {
      const {
        mc: mountChildren,
        pc: patchChildren,
        pbc: patchBlockChildren,
        o: { insert, querySelector, createText, createComment, parentNode }
      } = internals;
      const disabled = isTeleportDisabled(n2.props);
      let { dynamicChildren } = n2;
      if (false) {
        optimized = false;
        dynamicChildren = null;
      }
      const mount = (vnode, container2, anchor2) => {
        if (vnode.shapeFlag & 16) {
          mountChildren(
            vnode.children,
            container2,
            anchor2,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        }
      };
      const mountToTarget = (vnode = n2) => {
        const disabled2 = isTeleportDisabled(vnode.props);
        const target = vnode.target = resolveTarget(vnode.props, querySelector);
        const targetAnchor = prepareAnchor(target, vnode, createText, insert);
        if (target) {
          if (namespace !== "svg" && isTargetSVG(target)) {
            namespace = "svg";
          } else if (namespace !== "mathml" && isTargetMathML(target)) {
            namespace = "mathml";
          }
          if (parentComponent && parentComponent.isCE) {
            (parentComponent.ce._teleportTargets || (parentComponent.ce._teleportTargets = /* @__PURE__ */ new Set())).add(target);
          }
          if (!disabled2) {
            mount(vnode, target, targetAnchor);
            updateCssVars(vnode, false);
          }
        } else if (false) {
          warn$1("Invalid Teleport target on mount:", target, `(${typeof target})`);
        }
      };
      const queuePendingMount = (vnode) => {
        const mountJob = () => {
          if (pendingMounts.get(vnode) !== mountJob) return;
          pendingMounts.delete(vnode);
          if (isTeleportDisabled(vnode.props)) {
            const mountContainer = parentNode(vnode.el) || container;
            mount(vnode, mountContainer, vnode.anchor);
            updateCssVars(vnode, true);
          }
          mountToTarget(vnode);
        };
        pendingMounts.set(vnode, mountJob);
        queuePostRenderEffect(mountJob, parentSuspense);
      };
      if (n1 == null) {
        const placeholder = n2.el = false ? createComment("teleport start") : createText("");
        const mainAnchor = n2.anchor = false ? createComment("teleport end") : createText("");
        insert(placeholder, container, anchor);
        insert(mainAnchor, container, anchor);
        if (isTeleportDeferred(n2.props) || parentSuspense && parentSuspense.pendingBranch) {
          queuePendingMount(n2);
          return;
        }
        if (disabled) {
          mount(n2, container, mainAnchor);
          updateCssVars(n2, true);
        }
        mountToTarget();
      } else {
        n2.el = n1.el;
        const mainAnchor = n2.anchor = n1.anchor;
        const pendingMount = pendingMounts.get(n1);
        if (pendingMount) {
          pendingMount.flags |= 8;
          pendingMounts.delete(n1);
          queuePendingMount(n2);
          return;
        }
        n2.targetStart = n1.targetStart;
        const target = n2.target = n1.target;
        const targetAnchor = n2.targetAnchor = n1.targetAnchor;
        const wasDisabled = isTeleportDisabled(n1.props);
        const currentContainer = wasDisabled ? container : target;
        const currentAnchor = wasDisabled ? mainAnchor : targetAnchor;
        if (namespace === "svg" || isTargetSVG(target)) {
          namespace = "svg";
        } else if (namespace === "mathml" || isTargetMathML(target)) {
          namespace = "mathml";
        }
        if (dynamicChildren) {
          patchBlockChildren(
            n1.dynamicChildren,
            dynamicChildren,
            currentContainer,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds
          );
          traverseStaticChildren(n1, n2, true);
        } else if (!optimized) {
          patchChildren(
            n1,
            n2,
            currentContainer,
            currentAnchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            false
          );
        }
        if (disabled) {
          if (!wasDisabled) {
            moveTeleport(
              n2,
              container,
              mainAnchor,
              internals,
              1
            );
          } else {
            if (n2.props && n1.props && n2.props.to !== n1.props.to) {
              n2.props.to = n1.props.to;
            }
          }
        } else {
          if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
            const nextTarget = resolveTarget(n2.props, querySelector);
            if (nextTarget) {
              n2.target = nextTarget;
              moveTeleport(
                n2,
                nextTarget,
                null,
                internals,
                0
              );
            } else if (false) {
              warn$1(
                "Invalid Teleport target on update:",
                target,
                `(${typeof target})`
              );
            }
          } else if (wasDisabled) {
            moveTeleport(
              n2,
              target,
              targetAnchor,
              internals,
              1
            );
          }
        }
        updateCssVars(n2, disabled);
      }
    },
    remove(vnode, parentComponent, parentSuspense, { um: unmount, o: { remove: hostRemove } }, doRemove) {
      const {
        shapeFlag,
        children,
        anchor,
        targetStart,
        targetAnchor,
        target,
        props
      } = vnode;
      const disabled = isTeleportDisabled(props);
      const shouldRemove = doRemove || !disabled;
      const pendingMount = pendingMounts.get(vnode);
      if (pendingMount) {
        pendingMount.flags |= 8;
        pendingMounts.delete(vnode);
      }
      if (target) {
        hostRemove(targetStart);
        hostRemove(targetAnchor);
      }
      doRemove && hostRemove(anchor);
      if (!pendingMount && (disabled || target) && shapeFlag & 16) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          unmount(
            child,
            parentComponent,
            parentSuspense,
            shouldRemove,
            !!child.dynamicChildren
          );
        }
      }
    },
    move: moveTeleport,
    hydrate: hydrateTeleport
  };
  function moveTeleport(vnode, container, parentAnchor, { o: { insert }, m: move }, moveType = 2) {
    if (moveType === 0) {
      if (vnode.targetStart) {
        insert(vnode.targetStart, container, parentAnchor);
      }
      insert(vnode.targetAnchor, container, parentAnchor);
      parentAnchor = vnode.targetAnchor;
    }
    const { el, anchor, shapeFlag, children, props } = vnode;
    const isReorder = moveType === 2;
    if (isReorder) {
      insert(el, container, parentAnchor);
    }
    if (!pendingMounts.has(vnode) && (!isReorder || isTeleportDisabled(props))) {
      if (shapeFlag & 16) {
        for (let i = 0; i < children.length; i++) {
          move(
            children[i],
            container,
            parentAnchor,
            2
          );
        }
      }
    }
    if (isReorder) {
      insert(anchor, container, parentAnchor);
    }
  }
  function hydrateTeleport(node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized, {
    o: { nextSibling, parentNode, querySelector, insert, createText }
  }, hydrateChildren) {
    function hydrateAnchor(target2, targetNode) {
      let targetAnchor = targetNode;
      while (targetAnchor) {
        if (targetAnchor && targetAnchor.nodeType === 8) {
          if (targetAnchor.data === "teleport start anchor") {
            vnode.targetStart = targetAnchor;
          } else if (targetAnchor.data === "teleport anchor") {
            vnode.targetAnchor = targetAnchor;
            target2._lpa = vnode.targetAnchor && nextSibling(vnode.targetAnchor);
            break;
          }
        }
        targetAnchor = nextSibling(targetAnchor);
      }
    }
    function hydrateDisabledTeleport(node2, vnode2) {
      vnode2.anchor = hydrateChildren(
        nextSibling(node2),
        vnode2,
        parentNode(node2),
        parentComponent,
        parentSuspense,
        slotScopeIds,
        optimized
      );
    }
    const target = vnode.target = resolveTarget(
      vnode.props,
      querySelector
    );
    const disabled = isTeleportDisabled(vnode.props);
    if (target) {
      const targetNode = target._lpa || target.firstChild;
      if (vnode.shapeFlag & 16) {
        if (disabled) {
          hydrateDisabledTeleport(node, vnode);
          hydrateAnchor(target, targetNode);
          if (!vnode.targetAnchor) {
            prepareAnchor(
              target,
              vnode,
              createText,
              insert,
              // if target is the same as the main view, insert anchors before current node
              // to avoid hydrating mismatch
              parentNode(node) === target ? node : null
            );
          }
        } else {
          vnode.anchor = nextSibling(node);
          hydrateAnchor(target, targetNode);
          if (!vnode.targetAnchor) {
            prepareAnchor(target, vnode, createText, insert);
          }
          hydrateChildren(
            targetNode && nextSibling(targetNode),
            vnode,
            target,
            parentComponent,
            parentSuspense,
            slotScopeIds,
            optimized
          );
        }
      }
      updateCssVars(vnode, disabled);
    } else if (disabled) {
      if (vnode.shapeFlag & 16) {
        hydrateDisabledTeleport(node, vnode);
        vnode.targetStart = node;
        vnode.targetAnchor = nextSibling(node);
      }
    }
    return vnode.anchor && nextSibling(vnode.anchor);
  }
  var Teleport = TeleportImpl;
  function updateCssVars(vnode, isDisabled) {
    const ctx = vnode.ctx;
    if (ctx && ctx.ut) {
      let node, anchor;
      if (isDisabled) {
        node = vnode.el;
        anchor = vnode.anchor;
      } else {
        node = vnode.targetStart;
        anchor = vnode.targetAnchor;
      }
      while (node && node !== anchor) {
        if (node.nodeType === 1) node.setAttribute("data-v-owner", ctx.uid);
        node = node.nextSibling;
      }
      ctx.ut();
    }
  }
  function prepareAnchor(target, vnode, createText, insert, anchor = null) {
    const targetStart = vnode.targetStart = createText("");
    const targetAnchor = vnode.targetAnchor = createText("");
    targetStart[TeleportEndKey] = targetAnchor;
    if (target) {
      insert(targetStart, target, anchor);
      insert(targetAnchor, target, anchor);
    }
    return targetAnchor;
  }
  var leaveCbKey = /* @__PURE__ */ Symbol("_leaveCb");
  var enterCbKey = /* @__PURE__ */ Symbol("_enterCb");
  function useTransitionState() {
    const state = {
      isMounted: false,
      isLeaving: false,
      isUnmounting: false,
      leavingVNodes: /* @__PURE__ */ new Map()
    };
    onMounted(() => {
      state.isMounted = true;
    });
    onBeforeUnmount(() => {
      state.isUnmounting = true;
    });
    return state;
  }
  var TransitionHookValidator = [Function, Array];
  var BaseTransitionPropsValidators = {
    mode: String,
    appear: Boolean,
    persisted: Boolean,
    // enter
    onBeforeEnter: TransitionHookValidator,
    onEnter: TransitionHookValidator,
    onAfterEnter: TransitionHookValidator,
    onEnterCancelled: TransitionHookValidator,
    // leave
    onBeforeLeave: TransitionHookValidator,
    onLeave: TransitionHookValidator,
    onAfterLeave: TransitionHookValidator,
    onLeaveCancelled: TransitionHookValidator,
    // appear
    onBeforeAppear: TransitionHookValidator,
    onAppear: TransitionHookValidator,
    onAfterAppear: TransitionHookValidator,
    onAppearCancelled: TransitionHookValidator
  };
  var BaseTransitionImpl = {
    name: `BaseTransition`,
    props: BaseTransitionPropsValidators,
    setup(props, { slots }) {
      const instance = getCurrentInstance();
      const state = useTransitionState();
      return () => {
        const children = slots.default && getTransitionRawChildren(slots.default(), true);
        const child = children && children.length ? findNonCommentChild(children) : (
          // Keep explicit default-slot conditionals on the same transition path
          // as regular v-if branches, which render a comment placeholder.
          instance.subTree ? createCommentVNode() : void 0
        );
        if (!child) {
          return;
        }
        const rawProps = toRaw(props);
        const { mode } = rawProps;
        if (false) {
          warn$1(`invalid <transition> mode: ${mode}`);
        }
        if (state.isLeaving) {
          return emptyPlaceholder(child);
        }
        const innerChild = getInnerChild$1(child);
        if (!innerChild) {
          return emptyPlaceholder(child);
        }
        let enterHooks = resolveTransitionHooks(
          innerChild,
          rawProps,
          state,
          instance,
          // #11061, ensure enterHooks is fresh after clone
          (hooks) => enterHooks = hooks
        );
        if (innerChild.type !== Comment) {
          setTransitionHooks(innerChild, enterHooks);
        }
        let oldInnerChild = instance.subTree && getInnerChild$1(instance.subTree);
        if (oldInnerChild && oldInnerChild.type !== Comment && !isSameVNodeType(oldInnerChild, innerChild) && getTransitionRoot(instance.subTree)) {
          let leavingHooks = resolveTransitionHooks(
            oldInnerChild,
            rawProps,
            state,
            instance
          );
          setTransitionHooks(oldInnerChild, leavingHooks);
          if (mode === "out-in" && innerChild.type !== Comment) {
            state.isLeaving = true;
            leavingHooks.afterLeave = () => {
              state.isLeaving = false;
              if (!(instance.job.flags & 8)) {
                instance.update();
              }
              delete leavingHooks.afterLeave;
              oldInnerChild = void 0;
            };
            return emptyPlaceholder(child);
          } else if (mode === "in-out" && innerChild.type !== Comment) {
            leavingHooks.delayLeave = (el, earlyRemove, delayedLeave) => {
              const leavingVNodesCache = getLeavingNodesForType(
                state,
                oldInnerChild
              );
              leavingVNodesCache[String(oldInnerChild.key)] = oldInnerChild;
              el[leaveCbKey] = () => {
                earlyRemove();
                el[leaveCbKey] = void 0;
                delete enterHooks.delayedLeave;
                oldInnerChild = void 0;
              };
              enterHooks.delayedLeave = () => {
                delayedLeave();
                delete enterHooks.delayedLeave;
                oldInnerChild = void 0;
              };
            };
          } else {
            oldInnerChild = void 0;
          }
        } else if (oldInnerChild) {
          oldInnerChild = void 0;
        }
        return child;
      };
    }
  };
  function findNonCommentChild(children) {
    let child = children[0];
    if (children.length > 1) {
      let hasFound = false;
      for (const c of children) {
        if (c.type !== Comment) {
          if (false) {
            warn$1(
              "<transition> can only be used on a single element or component. Use <transition-group> for lists."
            );
            break;
          }
          child = c;
          hasFound = true;
          if (true) break;
        }
      }
    }
    return child;
  }
  var BaseTransition = BaseTransitionImpl;
  function getLeavingNodesForType(state, vnode) {
    const { leavingVNodes } = state;
    let leavingVNodesCache = leavingVNodes.get(vnode.type);
    if (!leavingVNodesCache) {
      leavingVNodesCache = /* @__PURE__ */ Object.create(null);
      leavingVNodes.set(vnode.type, leavingVNodesCache);
    }
    return leavingVNodesCache;
  }
  function resolveTransitionHooks(vnode, props, state, instance, postClone) {
    const {
      appear,
      mode,
      persisted = false,
      onBeforeEnter,
      onEnter,
      onAfterEnter,
      onEnterCancelled,
      onBeforeLeave,
      onLeave,
      onAfterLeave,
      onLeaveCancelled,
      onBeforeAppear,
      onAppear,
      onAfterAppear,
      onAppearCancelled
    } = props;
    const key = String(vnode.key);
    const leavingVNodesCache = getLeavingNodesForType(state, vnode);
    const callHook3 = (hook, args) => {
      hook && callWithAsyncErrorHandling(
        hook,
        instance,
        9,
        args
      );
    };
    const callAsyncHook = (hook, args) => {
      const done = args[1];
      callHook3(hook, args);
      if (isArray(hook)) {
        if (hook.every((hook2) => hook2.length <= 1)) done();
      } else if (hook.length <= 1) {
        done();
      }
    };
    const hooks = {
      mode,
      persisted,
      beforeEnter(el) {
        let hook = onBeforeEnter;
        if (!state.isMounted) {
          if (appear) {
            hook = onBeforeAppear || onBeforeEnter;
          } else {
            return;
          }
        }
        if (el[leaveCbKey]) {
          el[leaveCbKey](
            true
            /* cancelled */
          );
        }
        const leavingVNode = leavingVNodesCache[key];
        if (leavingVNode && isSameVNodeType(vnode, leavingVNode)) {
          let leavingCb = leavingVNode.el[leaveCbKey];
          if (!leavingCb) {
            const leavingRoot = getTransitionRoot(leavingVNode);
            leavingCb = leavingRoot && leavingRoot.el[leaveCbKey];
          }
          if (leavingCb) {
            leavingCb();
          }
        }
        callHook3(hook, [el]);
      },
      enter(el) {
        if (!isHmrUpdating && leavingVNodesCache[key] === vnode) return;
        let hook = onEnter;
        let afterHook = onAfterEnter;
        let cancelHook = onEnterCancelled;
        if (!state.isMounted) {
          if (appear) {
            hook = onAppear || onEnter;
            afterHook = onAfterAppear || onAfterEnter;
            cancelHook = onAppearCancelled || onEnterCancelled;
          } else {
            return;
          }
        }
        let called = false;
        el[enterCbKey] = (cancelled) => {
          if (called) return;
          called = true;
          if (cancelled) {
            callHook3(cancelHook, [el]);
          } else {
            callHook3(afterHook, [el]);
          }
          if (hooks.delayedLeave) {
            hooks.delayedLeave();
          }
          el[enterCbKey] = void 0;
        };
        const done = el[enterCbKey].bind(null, false);
        if (hook) {
          callAsyncHook(hook, [el, done]);
        } else {
          done();
        }
      },
      leave(el, remove2) {
        const key2 = String(vnode.key);
        if (el[enterCbKey]) {
          el[enterCbKey](
            true
            /* cancelled */
          );
        }
        if (state.isUnmounting) {
          return remove2();
        }
        callHook3(onBeforeLeave, [el]);
        let called = false;
        el[leaveCbKey] = (cancelled) => {
          if (called) return;
          called = true;
          remove2();
          if (cancelled) {
            callHook3(onLeaveCancelled, [el]);
          } else {
            callHook3(onAfterLeave, [el]);
          }
          el[leaveCbKey] = void 0;
          if (leavingVNodesCache[key2] === vnode) {
            delete leavingVNodesCache[key2];
          }
        };
        const done = el[leaveCbKey].bind(null, false);
        leavingVNodesCache[key2] = vnode;
        if (onLeave) {
          callAsyncHook(onLeave, [el, done]);
        } else {
          done();
        }
      },
      clone(vnode2) {
        const hooks2 = resolveTransitionHooks(
          vnode2,
          props,
          state,
          instance,
          postClone
        );
        if (postClone) postClone(hooks2);
        return hooks2;
      }
    };
    return hooks;
  }
  function emptyPlaceholder(vnode) {
    if (isKeepAlive(vnode)) {
      vnode = cloneVNode(vnode);
      vnode.children = null;
      return vnode;
    }
  }
  function getInnerChild$1(vnode) {
    if (!isKeepAlive(vnode)) {
      if (isTeleport(vnode.type) && vnode.children) {
        return findNonCommentChild(vnode.children);
      }
      return vnode;
    }
    if (vnode.component) {
      return vnode.component.subTree;
    }
    const { shapeFlag, children } = vnode;
    if (children) {
      if (shapeFlag & 16) {
        return children[0];
      }
      if (shapeFlag & 32 && isFunction(children.default)) {
        return children.default();
      }
    }
  }
  function setTransitionHooks(vnode, hooks) {
    if (vnode.shapeFlag & 6 && vnode.component) {
      vnode.transition = hooks;
      const subTree = vnode.component.subTree;
      setTransitionHooks(
        isTeleport(subTree.type) ? getInnerChild$1(subTree) || subTree : subTree,
        hooks
      );
    } else if (vnode.shapeFlag & 128) {
      vnode.ssContent.transition = hooks.clone(vnode.ssContent);
      vnode.ssFallback.transition = hooks.clone(vnode.ssFallback);
    } else {
      vnode.transition = hooks;
      if (vnode.type === Fragment && isArray(vnode.children)) {
        const child = filterSingleRoot(vnode.children, false);
        if (child) {
          setTransitionHooks(child, hooks);
        }
      }
    }
  }
  function getTransitionRawChildren(children, keepComment = false, parentKey) {
    let ret = [];
    let keyedFragmentCount = 0;
    for (let i = 0; i < children.length; i++) {
      let child = children[i];
      const key = parentKey == null ? child.key : String(parentKey) + String(child.key != null ? child.key : i);
      if (child.type === Fragment) {
        if (child.patchFlag & 128) keyedFragmentCount++;
        ret = ret.concat(
          getTransitionRawChildren(child.children, keepComment, key)
        );
      } else if (keepComment || child.type !== Comment) {
        ret.push(key != null ? cloneVNode(child, { key }) : child);
      }
    }
    if (keyedFragmentCount > 1) {
      for (let i = 0; i < ret.length; i++) {
        ret[i].patchFlag = -2;
      }
    }
    return ret;
  }
  function getTransitionRoot(vnode) {
    if (vnode.component) {
      return getTransitionRoot(vnode.component.subTree);
    }
    if (vnode.type === Fragment) {
      const child = isArray(vnode.children) && filterSingleRoot(vnode.children, false);
      return child ? getTransitionRoot(child) : void 0;
    }
    if (vnode.type !== Comment) {
      return vnode;
    }
  }
  // @__NO_SIDE_EFFECTS__
  function defineComponent(options, extraOptions) {
    return isFunction(options) ? (
      // #8236: extend call and options.name access are considered side-effects
      // by Rollup, so we have to wrap it in a pure-annotated IIFE.
      /* @__PURE__ */ (() => extend({ name: options.name }, extraOptions, { setup: options }))()
    ) : options;
  }
  function useId() {
    const i = getCurrentInstance();
    if (i) {
      return (i.appContext.config.idPrefix || "v") + "-" + i.ids[0] + i.ids[1]++;
    } else if (false) {
      warn$1(
        `useId() is called when there is no active component instance to be associated with.`
      );
    }
    return "";
  }
  function markAsyncBoundary(instance) {
    instance.ids = [instance.ids[0] + instance.ids[2]++ + "-", 0, 0];
  }
  function useTemplateRef(key) {
    const i = getCurrentInstance();
    const r = shallowRef(null);
    if (i) {
      const refs = i.refs === EMPTY_OBJ ? i.refs = {} : i.refs;
      if (false) {
        warn$1(`useTemplateRef('${key}') already exists.`);
      } else {
        Object.defineProperty(refs, key, {
          enumerable: true,
          get: () => r.value,
          set: (val) => r.value = val
        });
      }
    } else if (false) {
      warn$1(
        `useTemplateRef() is called when there is no active component instance to be associated with.`
      );
    }
    const ret = false ? readonly(r) : r;
    if (false) {
      knownTemplateRefs.add(ret);
    }
    return ret;
  }
  function isTemplateRefKey(refs, key) {
    let desc;
    return !!((desc = Object.getOwnPropertyDescriptor(refs, key)) && !desc.configurable);
  }
  var pendingSetRefMap = /* @__PURE__ */ new WeakMap();
  function setRef(rawRef, oldRawRef, parentSuspense, vnode, isUnmount = false) {
    if (isArray(rawRef)) {
      rawRef.forEach(
        (r, i) => setRef(
          r,
          oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef),
          parentSuspense,
          vnode,
          isUnmount
        )
      );
      return;
    }
    if (isAsyncWrapper(vnode) && !isUnmount) {
      if (vnode.shapeFlag & 512 && vnode.type.__asyncResolved && vnode.component.subTree.component) {
        setRef(rawRef, oldRawRef, parentSuspense, vnode.component.subTree);
      }
      return;
    }
    const refValue = vnode.shapeFlag & 4 ? getComponentPublicInstance(vnode.component) : vnode.el;
    const value = isUnmount ? null : refValue;
    const { i: owner, r: ref2 } = rawRef;
    if (false) {
      warn$1(
        `Missing ref owner context. ref cannot be used on hoisted vnodes. A vnode with ref must be created inside the render function.`
      );
      return;
    }
    const oldRef = oldRawRef && oldRawRef.r;
    const refs = owner.refs === EMPTY_OBJ ? owner.refs = {} : owner.refs;
    const setupState = owner.setupState;
    const rawSetupState = toRaw(setupState);
    const canSetSetupRef = setupState === EMPTY_OBJ ? NO : (key) => {
      if (false) {
        if (hasOwn(rawSetupState, key) && !isRef2(rawSetupState[key])) {
          warn$1(
            `Template ref "${key}" used on a non-ref value. It will not work in the production build.`
          );
        }
        if (knownTemplateRefs.has(rawSetupState[key])) {
          return false;
        }
      }
      if (isTemplateRefKey(refs, key)) {
        return false;
      }
      return hasOwn(rawSetupState, key);
    };
    const canSetRef = (ref22, key) => {
      if (false) {
        return false;
      }
      if (key && isTemplateRefKey(refs, key)) {
        return false;
      }
      return true;
    };
    if (oldRef != null && oldRef !== ref2) {
      invalidatePendingSetRef(oldRawRef);
      if (isString(oldRef)) {
        refs[oldRef] = null;
        if (canSetSetupRef(oldRef)) {
          setupState[oldRef] = null;
        }
      } else if (isRef2(oldRef)) {
        const oldRawRefAtom = oldRawRef;
        if (canSetRef(oldRef, oldRawRefAtom.k)) {
          oldRef.value = null;
        }
        if (oldRawRefAtom.k) refs[oldRawRefAtom.k] = null;
      }
    }
    if (isFunction(ref2)) {
      callWithErrorHandling(ref2, owner, 12, [value, refs]);
    } else {
      const _isString = isString(ref2);
      const _isRef = isRef2(ref2);
      if (_isString || _isRef) {
        const doSet = () => {
          if (rawRef.f) {
            const existing = _isString ? canSetSetupRef(ref2) ? setupState[ref2] : refs[ref2] : canSetRef(ref2) || !rawRef.k ? ref2.value : refs[rawRef.k];
            if (isUnmount) {
              isArray(existing) && remove(existing, refValue);
            } else {
              if (!isArray(existing)) {
                if (_isString) {
                  refs[ref2] = [refValue];
                  if (canSetSetupRef(ref2)) {
                    setupState[ref2] = refs[ref2];
                  }
                } else {
                  const newVal = [refValue];
                  if (canSetRef(ref2, rawRef.k)) {
                    ref2.value = newVal;
                  }
                  if (rawRef.k) refs[rawRef.k] = newVal;
                }
              } else if (!existing.includes(refValue)) {
                existing.push(refValue);
              }
            }
          } else if (_isString) {
            refs[ref2] = value;
            if (canSetSetupRef(ref2)) {
              setupState[ref2] = value;
            }
          } else if (_isRef) {
            if (canSetRef(ref2, rawRef.k)) {
              ref2.value = value;
            }
            if (rawRef.k) refs[rawRef.k] = value;
          } else if (false) {
            warn$1("Invalid template ref type:", ref2, `(${typeof ref2})`);
          }
        };
        if (value) {
          const job = () => {
            doSet();
            pendingSetRefMap.delete(rawRef);
          };
          job.id = -1;
          pendingSetRefMap.set(rawRef, job);
          queuePostRenderEffect(job, parentSuspense);
        } else {
          invalidatePendingSetRef(rawRef);
          doSet();
        }
      } else if (false) {
        warn$1("Invalid template ref type:", ref2, `(${typeof ref2})`);
      }
    }
  }
  function invalidatePendingSetRef(rawRef) {
    const pendingSetRef = pendingSetRefMap.get(rawRef);
    if (pendingSetRef) {
      pendingSetRef.flags |= 8;
      pendingSetRefMap.delete(rawRef);
    }
  }
  var hasLoggedMismatchError = false;
  var logMismatchError = () => {
    if (hasLoggedMismatchError) {
      return;
    }
    console.error("Hydration completed but contains mismatches.");
    hasLoggedMismatchError = true;
  };
  var isSVGContainer = (container) => container.namespaceURI.includes("svg") && container.tagName !== "foreignObject";
  var isMathMLContainer = (container) => container.namespaceURI.includes("MathML");
  var getContainerType = (container) => {
    if (container.nodeType !== 1) return void 0;
    if (isSVGContainer(container)) return "svg";
    if (isMathMLContainer(container)) return "mathml";
    return void 0;
  };
  var isComment = (node) => node.nodeType === 8;
  function createHydrationFunctions(rendererInternals) {
    const {
      mt: mountComponent,
      p: patch,
      o: {
        patchProp: patchProp2,
        createText,
        nextSibling,
        parentNode,
        remove: remove2,
        insert,
        createComment
      }
    } = rendererInternals;
    const hydrate2 = (vnode, container) => {
      if (!container.hasChildNodes()) {
        patch(null, vnode, container);
        flushPostFlushCbs();
        container._vnode = vnode;
        return;
      }
      hydrateNode(container.firstChild, vnode, null, null, null);
      flushPostFlushCbs();
      container._vnode = vnode;
    };
    const hydrateNode = (node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized = false) => {
      optimized = optimized || !!vnode.dynamicChildren;
      const isFragmentStart = isComment(node) && node.data === "[";
      const onMismatch = () => handleMismatch(
        node,
        vnode,
        parentComponent,
        parentSuspense,
        slotScopeIds,
        isFragmentStart
      );
      const { type, ref: ref2, shapeFlag, patchFlag } = vnode;
      let domType = node.nodeType;
      vnode.el = node;
      if (false) {
        def(node, "__vnode", vnode, true);
        def(node, "__vueParentComponent", parentComponent, true);
      }
      if (patchFlag === -2) {
        optimized = false;
        vnode.dynamicChildren = null;
      }
      let nextNode = null;
      switch (type) {
        case Text:
          if (domType !== 3) {
            if (vnode.children === "") {
              insert(vnode.el = createText(""), parentNode(node), node);
              nextNode = node;
            } else {
              nextNode = onMismatch();
            }
          } else {
            if (node.data !== vnode.children) {
              logMismatchError();
              node.data = vnode.children;
            }
            nextNode = nextSibling(node);
          }
          break;
        case Comment:
          if (isTemplateNode2(node)) {
            nextNode = nextSibling(node);
            replaceNode(
              vnode.el = node.content.firstChild,
              node,
              parentComponent
            );
          } else if (domType !== 8 || isFragmentStart) {
            nextNode = onMismatch();
          } else {
            nextNode = nextSibling(node);
          }
          break;
        case Static:
          if (isFragmentStart) {
            node = nextSibling(node);
            domType = node.nodeType;
          }
          if (domType === 1 || domType === 3) {
            nextNode = node;
            const needToAdoptContent = !vnode.children.length;
            for (let i = 0; i < vnode.staticCount; i++) {
              if (needToAdoptContent)
                vnode.children += nextNode.nodeType === 1 ? nextNode.outerHTML : nextNode.data;
              if (i === vnode.staticCount - 1) {
                vnode.anchor = nextNode;
              }
              nextNode = nextSibling(nextNode);
            }
            return isFragmentStart ? nextSibling(nextNode) : nextNode;
          } else {
            onMismatch();
          }
          break;
        case Fragment:
          if (!isFragmentStart) {
            nextNode = onMismatch();
          } else {
            nextNode = hydrateFragment(
              node,
              vnode,
              parentComponent,
              parentSuspense,
              slotScopeIds,
              optimized
            );
          }
          break;
        default:
          if (shapeFlag & 1) {
            if ((domType !== 1 || vnode.type.toLowerCase() !== node.tagName.toLowerCase()) && !isTemplateNode2(node)) {
              nextNode = onMismatch();
            } else {
              nextNode = hydrateElement(
                node,
                vnode,
                parentComponent,
                parentSuspense,
                slotScopeIds,
                optimized
              );
            }
          } else if (shapeFlag & 6) {
            vnode.slotScopeIds = slotScopeIds;
            const container = parentNode(node);
            if (isFragmentStart) {
              nextNode = locateClosingAnchor(node);
            } else if (isComment(node) && node.data === "teleport start") {
              nextNode = locateClosingAnchor(node, node.data, "teleport end");
            } else {
              nextNode = nextSibling(node);
            }
            mountComponent(
              vnode,
              container,
              null,
              parentComponent,
              parentSuspense,
              getContainerType(container),
              optimized
            );
            if ((isAsyncWrapper(vnode) || vnode.component.asyncDep) && !vnode.component.subTree) {
              let subTree;
              if (isFragmentStart) {
                subTree = createVNode(Static);
                subTree.anchor = nextNode ? nextNode.previousSibling : container.lastChild;
              } else {
                subTree = node.nodeType === 3 ? createTextVNode("") : createVNode(
                  node.nodeType === 8 ? Comment : "div"
                );
              }
              subTree.el = node;
              vnode.component.subTree = subTree;
            }
          } else if (shapeFlag & 64) {
            if (domType !== 8) {
              nextNode = onMismatch();
            } else {
              nextNode = vnode.type.hydrate(
                node,
                vnode,
                parentComponent,
                parentSuspense,
                slotScopeIds,
                optimized,
                rendererInternals,
                hydrateChildren
              );
            }
          } else if (shapeFlag & 128) {
            nextNode = vnode.type.hydrate(
              node,
              vnode,
              parentComponent,
              parentSuspense,
              getContainerType(parentNode(node)),
              slotScopeIds,
              optimized,
              rendererInternals,
              hydrateNode
            );
          } else if (false) {
            warn$1("Invalid HostVNode type:", type, `(${typeof type})`);
          }
      }
      if (ref2 != null) {
        setRef(ref2, null, parentSuspense, vnode);
      }
      return nextNode;
    };
    const hydrateElement = (el, vnode, parentComponent, parentSuspense, slotScopeIds, optimized) => {
      optimized = optimized || !!vnode.dynamicChildren;
      const {
        type,
        dynamicProps,
        props,
        patchFlag,
        shapeFlag,
        dirs,
        transition
      } = vnode;
      const forcePatch = type === "input" || type === "option";
      const hasDynamicProps = !!dynamicProps;
      if (forcePatch || hasDynamicProps || patchFlag !== -1) {
        if (dirs) {
          invokeDirectiveHook(vnode, null, parentComponent, "created");
        }
        let needCallTransitionHooks = false;
        if (isTemplateNode2(el)) {
          needCallTransitionHooks = needTransition(
            null,
            // no need check parentSuspense in hydration
            transition
          ) && parentComponent && parentComponent.vnode.props && parentComponent.vnode.props.appear;
          const content = el.content.firstChild;
          if (needCallTransitionHooks) {
            const cls = content.getAttribute("class");
            if (cls) content.$cls = cls;
            transition.beforeEnter(content);
          }
          replaceNode(content, el, parentComponent);
          vnode.el = el = content;
        }
        if (shapeFlag & 16 && // skip if element has innerHTML / textContent
        !(props && (props.innerHTML || props.textContent))) {
          let next = hydrateChildren(
            el.firstChild,
            vnode,
            el,
            parentComponent,
            parentSuspense,
            slotScopeIds,
            optimized
          );
          if (next && !isMismatchAllowed(
            el,
            1
            /* CHILDREN */
          )) {
            logMismatchError();
          }
          while (next) {
            const cur = next;
            next = next.nextSibling;
            remove2(cur);
          }
        } else if (shapeFlag & 8) {
          let clientText = vnode.children;
          if (clientText[0] === "\n" && (el.tagName === "PRE" || el.tagName === "TEXTAREA")) {
            clientText = clientText.slice(1);
          }
          const { textContent } = el;
          if (textContent !== clientText && // innerHTML normalize \r\n or \r into a single \n in the DOM
          textContent !== clientText.replace(/\r\n|\r/g, "\n")) {
            if (!isMismatchAllowed(
              el,
              0
              /* TEXT */
            )) {
              logMismatchError();
            }
            el.textContent = vnode.children;
          }
        }
        if (props) {
          if (forcePatch || hasDynamicProps || !optimized || patchFlag & (16 | 32)) {
            const isCustomElement = el.tagName.includes("-");
            const namespace = el.namespaceURI.includes("svg") ? "svg" : el.namespaceURI.includes("MathML") ? "mathml" : void 0;
            for (const key in props) {
              if (false) {
                logMismatchError();
              }
              if (forcePatch && (key.endsWith("value") || key === "indeterminate") || isOn(key) && !isReservedProp(key) || // force hydrate v-bind with .prop modifiers
              key[0] === "." || isCustomElement && !isReservedProp(key) || dynamicProps && dynamicProps.includes(key)) {
                if (isUnchangedResourceProp(el, key, props[key])) {
                  continue;
                }
                patchProp2(el, key, null, props[key], namespace, parentComponent);
              }
            }
          } else if (props.onClick) {
            patchProp2(
              el,
              "onClick",
              null,
              props.onClick,
              void 0,
              parentComponent
            );
          } else if (patchFlag & 4 && isReactive(props.style)) {
            for (const key in props.style) props.style[key];
          }
        }
        let vnodeHooks;
        if (vnodeHooks = props && props.onVnodeBeforeMount) {
          invokeVNodeHook(vnodeHooks, parentComponent, vnode);
        }
        if (dirs) {
          invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
        }
        if ((vnodeHooks = props && props.onVnodeMounted) || dirs || needCallTransitionHooks) {
          queueEffectWithSuspense(() => {
            vnodeHooks && invokeVNodeHook(vnodeHooks, parentComponent, vnode);
            needCallTransitionHooks && transition.enter(el);
            dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
          }, parentSuspense);
        }
      }
      return el.nextSibling;
    };
    const hydrateChildren = (node, parentVNode, container, parentComponent, parentSuspense, slotScopeIds, optimized) => {
      optimized = optimized || !!parentVNode.dynamicChildren;
      const children = parentVNode.children;
      const l = children.length;
      let hasCheckedMismatch = false;
      for (let i = 0; i < l; i++) {
        const vnode = optimized ? children[i] : children[i] = normalizeVNode(children[i]);
        const isText = vnode.type === Text;
        if (node) {
          if (isText && !optimized) {
            if (i + 1 < l && normalizeVNode(children[i + 1]).type === Text) {
              insert(
                createText(
                  node.data.slice(vnode.children.length)
                ),
                container,
                nextSibling(node)
              );
              node.data = vnode.children;
            }
          }
          node = hydrateNode(
            node,
            vnode,
            parentComponent,
            parentSuspense,
            slotScopeIds,
            optimized
          );
        } else if (isText && !vnode.children) {
          insert(vnode.el = createText(""), container);
        } else {
          if (!hasCheckedMismatch) {
            hasCheckedMismatch = true;
            if (!isMismatchAllowed(
              container,
              1
              /* CHILDREN */
            )) {
              logMismatchError();
            }
          }
          patch(
            null,
            vnode,
            container,
            null,
            parentComponent,
            parentSuspense,
            getContainerType(container),
            slotScopeIds
          );
        }
      }
      return node;
    };
    const hydrateFragment = (node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized) => {
      const { slotScopeIds: fragmentSlotScopeIds } = vnode;
      if (fragmentSlotScopeIds) {
        slotScopeIds = slotScopeIds ? slotScopeIds.concat(fragmentSlotScopeIds) : fragmentSlotScopeIds;
      }
      const container = parentNode(node);
      const next = hydrateChildren(
        nextSibling(node),
        vnode,
        container,
        parentComponent,
        parentSuspense,
        slotScopeIds,
        optimized
      );
      if (next && isComment(next) && next.data === "]") {
        return nextSibling(vnode.anchor = next);
      } else {
        logMismatchError();
        insert(vnode.anchor = createComment(`]`), container, next);
        return next;
      }
    };
    const handleMismatch = (node, vnode, parentComponent, parentSuspense, slotScopeIds, isFragment) => {
      if (!isNodeMismatchAllowed(node, vnode)) {
        logMismatchError();
      }
      vnode.el = null;
      if (isFragment) {
        const end = locateClosingAnchor(node);
        while (true) {
          const next2 = nextSibling(node);
          if (next2 && next2 !== end) {
            remove2(next2);
          } else {
            break;
          }
        }
      }
      const next = nextSibling(node);
      const container = parentNode(node);
      remove2(node);
      patch(
        null,
        vnode,
        container,
        next,
        parentComponent,
        parentSuspense,
        getContainerType(container),
        slotScopeIds
      );
      if (parentComponent) {
        parentComponent.vnode.el = vnode.el;
        updateHOCHostEl(parentComponent, vnode.el);
      }
      return next;
    };
    const locateClosingAnchor = (node, open = "[", close = "]") => {
      let match = 0;
      while (node) {
        node = nextSibling(node);
        if (node && isComment(node)) {
          if (node.data === open) match++;
          if (node.data === close) {
            if (match === 0) {
              return nextSibling(node);
            } else {
              match--;
            }
          }
        }
      }
      return node;
    };
    const replaceNode = (newNode, oldNode, parentComponent) => {
      const parentNode2 = oldNode.parentNode;
      if (parentNode2) {
        parentNode2.replaceChild(newNode, oldNode);
      }
      let parent = parentComponent;
      while (parent) {
        if (parent.vnode.el === oldNode) {
          parent.vnode.el = parent.subTree.el = newNode;
        }
        parent = parent.parent;
      }
    };
    const isTemplateNode2 = (node) => {
      return node.nodeType === 1 && node.tagName === "TEMPLATE";
    };
    return [hydrate2, hydrateNode];
  }
  var resourceProps = /* @__PURE__ */ new Set(["src", "srcset", "href", "poster"]);
  function isUnchangedResourceProp(el, key, clientValue) {
    if (!resourceProps.has(key)) {
      return false;
    }
    return el.getAttribute(key) === (clientValue == null ? null : `${clientValue}`);
  }
  var allowMismatchAttr = "data-allow-mismatch";
  var MismatchTypeString = {
    [
      0
      /* TEXT */
    ]: "text",
    [
      1
      /* CHILDREN */
    ]: "children",
    [
      2
      /* CLASS */
    ]: "class",
    [
      3
      /* STYLE */
    ]: "style",
    [
      4
      /* ATTRIBUTE */
    ]: "attribute"
  };
  function isMismatchAllowed(el, allowedType) {
    if (allowedType === 0 || allowedType === 1) {
      while (el && !el.hasAttribute(allowMismatchAttr)) {
        el = el.parentElement;
      }
    }
    return isMismatchAllowedByAttr(
      el && el.getAttribute(allowMismatchAttr),
      allowedType
    );
  }
  function isMismatchAllowedByAttr(allowedAttr, allowedType) {
    if (allowedAttr == null) {
      return false;
    } else if (allowedAttr === "") {
      return true;
    } else {
      const list = allowedAttr.split(",");
      if (allowedType === 0 && list.includes("children")) {
        return true;
      }
      return list.includes(MismatchTypeString[allowedType]);
    }
  }
  function isNodeMismatchAllowed(node, vnode) {
    return isMismatchAllowed(
      node.parentElement,
      1
      /* CHILDREN */
    ) || isMismatchAllowedByNode(node) || isMismatchAllowedByVNode(vnode);
  }
  function isMismatchAllowedByNode(node) {
    return node.nodeType === 1 && isMismatchAllowedByAttr(
      node.getAttribute(allowMismatchAttr),
      1
      /* CHILDREN */
    );
  }
  function isMismatchAllowedByVNode({ props }) {
    const allowedAttr = props && props[allowMismatchAttr];
    return typeof allowedAttr === "string" && isMismatchAllowedByAttr(
      allowedAttr,
      1
      /* CHILDREN */
    );
  }
  var requestIdleCallback = getGlobalThis().requestIdleCallback || ((cb) => setTimeout(cb, 1));
  var cancelIdleCallback = getGlobalThis().cancelIdleCallback || ((id) => clearTimeout(id));
  var hydrateOnIdle = (timeout = 1e4) => (hydrate2) => {
    const id = requestIdleCallback(hydrate2, { timeout });
    return () => cancelIdleCallback(id);
  };
  function elementIsVisibleInViewport(el) {
    const { top, left, bottom, right } = el.getBoundingClientRect();
    const { innerHeight, innerWidth } = window;
    return (top > 0 && top < innerHeight || bottom > 0 && bottom < innerHeight) && (left > 0 && left < innerWidth || right > 0 && right < innerWidth);
  }
  var hydrateOnVisible = (opts) => (hydrate2, forEach) => {
    const ob = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        ob.disconnect();
        hydrate2();
        break;
      }
    }, opts);
    const observe = (el) => {
      if (elementIsVisibleInViewport(el)) {
        hydrate2();
        ob.disconnect();
        return false;
      }
      if (getComputedStyle(el).display === "contents") {
        for (let i = 0; i < el.children.length; i++) {
          if (observe(el.children[i]) === false) return false;
        }
      }
      ob.observe(el);
    };
    forEach((el) => {
      if (!(el instanceof Element)) return;
      return observe(el);
    });
    return () => ob.disconnect();
  };
  var hydrateOnMediaQuery = (query) => (hydrate2) => {
    if (query) {
      const mql = matchMedia(query);
      if (mql.matches) {
        hydrate2();
      } else {
        mql.addEventListener("change", hydrate2, { once: true });
        return () => mql.removeEventListener("change", hydrate2);
      }
    }
  };
  var hydrateOnInteraction = (interactions = []) => (hydrate2, forEach) => {
    if (isString(interactions)) interactions = [interactions];
    let hasHydrated = false;
    const doHydrate = (e) => {
      if (!hasHydrated) {
        hasHydrated = true;
        teardown();
        hydrate2();
        e.target.dispatchEvent(new e.constructor(e.type, e));
      }
    };
    const teardown = () => {
      forEach((el) => {
        for (const i of interactions) {
          el.removeEventListener(i, doHydrate);
        }
      });
    };
    forEach((el) => {
      for (const i of interactions) {
        el.addEventListener(i, doHydrate, { once: true });
      }
    });
    return teardown;
  };
  function forEachElement(node, cb) {
    if (isComment(node) && node.data === "[") {
      let depth = 1;
      let next = node.nextSibling;
      while (next) {
        if (next.nodeType === 1) {
          const result = cb(next);
          if (result === false) {
            break;
          }
        } else if (isComment(next)) {
          if (next.data === "]") {
            if (--depth === 0) break;
          } else if (next.data === "[") {
            depth++;
          }
        }
        next = next.nextSibling;
      }
    } else {
      cb(node);
    }
  }
  var isAsyncWrapper = (i) => !!i.type.__asyncLoader;
  // @__NO_SIDE_EFFECTS__
  function defineAsyncComponent(source) {
    if (isFunction(source)) {
      source = { loader: source };
    }
    const {
      loader,
      loadingComponent,
      errorComponent,
      delay = 200,
      hydrate: hydrateStrategy,
      timeout,
      // undefined = never times out
      suspensible = true,
      onError: userOnError
    } = source;
    let pendingRequest = null;
    let resolvedComp;
    let retries = 0;
    const retry = () => {
      retries++;
      pendingRequest = null;
      return load();
    };
    const load = () => {
      let thisRequest;
      return pendingRequest || (thisRequest = pendingRequest = loader().catch((err) => {
        err = err instanceof Error ? err : new Error(String(err));
        if (userOnError) {
          return new Promise((resolve2, reject) => {
            const userRetry = () => resolve2(retry());
            const userFail = () => reject(err);
            userOnError(err, userRetry, userFail, retries + 1);
          });
        } else {
          throw err;
        }
      }).then((comp) => {
        if (thisRequest !== pendingRequest && pendingRequest) {
          return pendingRequest;
        }
        if (false) {
          warn$1(
            `Async component loader resolved to undefined. If you are using retry(), make sure to return its return value.`
          );
        }
        if (comp && (comp.__esModule || comp[Symbol.toStringTag] === "Module")) {
          comp = comp.default;
        }
        if (false) {
          throw new Error(`Invalid async component load result: ${comp}`);
        }
        resolvedComp = comp;
        return comp;
      }));
    };
    return /* @__PURE__ */ defineComponent({
      name: "AsyncComponentWrapper",
      __asyncLoader: load,
      __asyncHydrate(el, instance, hydrate2) {
        const wasConnected = el.isConnected;
        let patched = false;
        (instance.bu || (instance.bu = [])).push(() => patched = true);
        const performHydrate = () => {
          if (patched) {
            if (false) {
              warn$1(
                `Skipping lazy hydration for component '${getComponentName(resolvedComp) || resolvedComp.__file}': it was updated before lazy hydration performed.`
              );
            }
            return;
          }
          if (!el.parentNode || wasConnected && !el.isConnected) return;
          hydrate2();
        };
        const doHydrate = hydrateStrategy ? () => {
          const teardown = hydrateStrategy(
            performHydrate,
            (cb) => forEachElement(el, cb)
          );
          if (teardown) {
            (instance.bum || (instance.bum = [])).push(teardown);
          }
        } : performHydrate;
        if (resolvedComp) {
          doHydrate();
        } else {
          load().then(() => !instance.isUnmounted && doHydrate());
        }
      },
      get __asyncResolved() {
        return resolvedComp;
      },
      setup() {
        const instance = currentInstance;
        markAsyncBoundary(instance);
        if (resolvedComp) {
          return () => createInnerComp(resolvedComp, instance);
        }
        const onError = (err) => {
          pendingRequest = null;
          handleError(
            err,
            instance,
            13,
            !errorComponent
          );
        };
        if (suspensible && instance.suspense || isInSSRComponentSetup) {
          return load().then((comp) => {
            return () => createInnerComp(comp, instance);
          }).catch((err) => {
            onError(err);
            return () => errorComponent ? createVNode(errorComponent, {
              error: err
            }) : null;
          });
        }
        const loaded = ref(false);
        const error = ref();
        const delayed = ref(!!delay);
        let timeoutTimer;
        let delayTimer;
        onUnmounted(() => {
          if (timeoutTimer != null) clearTimeout(timeoutTimer);
          if (delayTimer != null) clearTimeout(delayTimer);
        });
        if (delay) {
          delayTimer = setTimeout(() => {
            if (instance.isUnmounted) return;
            delayed.value = false;
          }, delay);
        }
        if (timeout != null) {
          timeoutTimer = setTimeout(() => {
            if (instance.isUnmounted) return;
            if (!loaded.value && !error.value) {
              const err = new Error(
                `Async component timed out after ${timeout}ms.`
              );
              onError(err);
              error.value = err;
            }
          }, timeout);
        }
        load().then(() => {
          if (instance.isUnmounted) return;
          loaded.value = true;
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            instance.parent.update();
          }
        }).catch((err) => {
          if (instance.isUnmounted) {
            pendingRequest = null;
            return;
          }
          onError(err);
          error.value = err;
        });
        return () => {
          if (loaded.value && resolvedComp) {
            return createInnerComp(resolvedComp, instance);
          } else if (error.value && errorComponent) {
            return createVNode(errorComponent, {
              error: error.value
            });
          } else if (loadingComponent && !delayed.value) {
            return createInnerComp(
              loadingComponent,
              instance
            );
          }
        };
      }
    });
  }
  function createInnerComp(comp, parent) {
    const { ref: ref2, props, children, ce } = parent.vnode;
    const vnode = createVNode(comp, props, children);
    vnode.ref = ref2;
    vnode.ce = ce;
    delete parent.vnode.ce;
    return vnode;
  }
  var isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
  var KeepAliveImpl = {
    name: `KeepAlive`,
    // Marker for special handling inside the renderer. We are not using a ===
    // check directly on KeepAlive in the renderer, because importing it directly
    // would prevent it from being tree-shaken.
    __isKeepAlive: true,
    props: {
      include: [String, RegExp, Array],
      exclude: [String, RegExp, Array],
      max: [String, Number]
    },
    setup(props, { slots }) {
      const instance = getCurrentInstance();
      const sharedContext = instance.ctx;
      if (!sharedContext.renderer) {
        return () => {
          const children = slots.default && slots.default();
          return children && children.length === 1 ? children[0] : children;
        };
      }
      const cache = /* @__PURE__ */ new Map();
      const keys = /* @__PURE__ */ new Set();
      let current = null;
      if (false) {
        instance.__v_cache = cache;
      }
      const parentSuspense = instance.suspense;
      const {
        renderer: {
          p: patch,
          m: move,
          um: _unmount,
          o: { createElement }
        }
      } = sharedContext;
      const storageContainer = createElement("div");
      sharedContext.activate = (vnode, container, anchor, namespace, optimized) => {
        const instance2 = vnode.component;
        move(vnode, container, anchor, 0, parentSuspense);
        patch(
          instance2.vnode,
          vnode,
          container,
          anchor,
          instance2,
          parentSuspense,
          namespace,
          vnode.slotScopeIds,
          optimized
        );
        queuePostRenderEffect(() => {
          instance2.isDeactivated = false;
          if (instance2.a) {
            invokeArrayFns(instance2.a);
          }
          const vnodeHook = vnode.props && vnode.props.onVnodeMounted;
          if (vnodeHook) {
            invokeVNodeHook(vnodeHook, instance2.parent, vnode);
          }
        }, parentSuspense);
        if (false) {
          devtoolsComponentAdded(instance2);
        }
      };
      sharedContext.deactivate = (vnode) => {
        const instance2 = vnode.component;
        invalidateMount(instance2.m);
        invalidateMount(instance2.a);
        move(vnode, storageContainer, null, 1, parentSuspense);
        queuePostRenderEffect(() => {
          if (instance2.da) {
            invokeArrayFns(instance2.da);
          }
          const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted;
          if (vnodeHook) {
            invokeVNodeHook(vnodeHook, instance2.parent, vnode);
          }
          instance2.isDeactivated = true;
        }, parentSuspense);
        if (false) {
          devtoolsComponentAdded(instance2);
        }
        if (false) {
          instance2.__keepAliveStorageContainer = storageContainer;
        }
      };
      function unmount(vnode) {
        resetShapeFlag(vnode);
        _unmount(vnode, instance, parentSuspense, true);
      }
      function pruneCache(filter) {
        cache.forEach((vnode, key) => {
          const name = getComponentName(
            isAsyncWrapper(vnode) ? vnode.type.__asyncResolved || {} : vnode.type
          );
          if (name && !filter(name)) {
            pruneCacheEntry(key);
          }
        });
      }
      function pruneCacheEntry(key) {
        const cached = cache.get(key);
        if (cached && (!current || !isSameVNodeType(cached, current))) {
          unmount(cached);
        } else if (current) {
          resetShapeFlag(current);
          if (cached) resetShapeFlag(cached);
        }
        cache.delete(key);
        keys.delete(key);
      }
      watch2(
        () => [props.include, props.exclude],
        ([include, exclude]) => {
          include && pruneCache((name) => matches(include, name));
          exclude && pruneCache((name) => !matches(exclude, name));
        },
        // prune post-render after `current` has been updated
        { flush: "post", deep: true }
      );
      let pendingCacheKey = null;
      const cacheSubtree = () => {
        if (pendingCacheKey != null) {
          if (isSuspense(instance.subTree.type)) {
            queuePostRenderEffect(() => {
              const vnode = getInnerChild(instance.subTree);
              if (vnode.component) {
                cache.set(pendingCacheKey, vnode);
              }
            }, instance.subTree.suspense);
          } else {
            cache.set(pendingCacheKey, getInnerChild(instance.subTree));
          }
        }
      };
      onMounted(cacheSubtree);
      onUpdated(cacheSubtree);
      onBeforeUnmount(() => {
        cache.forEach((cached) => {
          const { subTree, suspense } = instance;
          const vnode = getInnerChild(subTree);
          if (cached.type === vnode.type && cached.key === vnode.key) {
            resetShapeFlag(vnode);
            const da = vnode.component.da;
            da && queuePostRenderEffect(da, suspense);
            return;
          }
          unmount(cached);
        });
      });
      return () => {
        pendingCacheKey = null;
        if (!slots.default) {
          return current = null;
        }
        const children = slots.default();
        const rawVNode = children[0];
        if (children.length > 1) {
          if (false) {
            warn$1(`KeepAlive should contain exactly one component child.`);
          }
          current = null;
          return children;
        } else if (!isVNode(rawVNode) || !(rawVNode.shapeFlag & 4) && !(rawVNode.shapeFlag & 128)) {
          current = null;
          return rawVNode;
        }
        let vnode = getInnerChild(rawVNode);
        if (vnode.type === Comment) {
          current = null;
          return vnode;
        }
        const comp = vnode.type;
        const name = getComponentName(
          isAsyncWrapper(vnode) ? vnode.type.__asyncResolved || {} : comp
        );
        const { include, exclude, max } = props;
        if (include && (!name || !matches(include, name)) || exclude && name && matches(exclude, name)) {
          vnode.shapeFlag &= -257;
          current = vnode;
          return rawVNode;
        }
        const key = vnode.key == null ? comp : vnode.key;
        const cachedVNode = cache.get(key);
        if (vnode.el) {
          vnode = cloneVNode(vnode);
          if (rawVNode.shapeFlag & 128) {
            rawVNode.ssContent = vnode;
          }
        }
        pendingCacheKey = key;
        if (cachedVNode) {
          vnode.el = cachedVNode.el;
          vnode.component = cachedVNode.component;
          if (vnode.transition) {
            setTransitionHooks(vnode, vnode.transition);
          }
          vnode.shapeFlag |= 512;
          keys.delete(key);
          keys.add(key);
        } else {
          keys.add(key);
          if (max && keys.size > parseInt(max, 10)) {
            pruneCacheEntry(keys.values().next().value);
          }
        }
        vnode.shapeFlag |= 256;
        current = vnode;
        return isSuspense(rawVNode.type) ? rawVNode : vnode;
      };
    }
  };
  var KeepAlive = KeepAliveImpl;
  function matches(pattern, name) {
    if (isArray(pattern)) {
      return pattern.some((p2) => matches(p2, name));
    } else if (isString(pattern)) {
      return pattern.split(",").includes(name);
    } else if (isRegExp(pattern)) {
      pattern.lastIndex = 0;
      return pattern.test(name);
    }
    return false;
  }
  function onActivated(hook, target) {
    registerKeepAliveHook(hook, "a", target);
  }
  function onDeactivated(hook, target) {
    registerKeepAliveHook(hook, "da", target);
  }
  function registerKeepAliveHook(hook, type, target = currentInstance) {
    const wrappedHook = hook.__wdc || (hook.__wdc = () => {
      let current = target;
      while (current) {
        if (current.isDeactivated) {
          return;
        }
        current = current.parent;
      }
      return hook();
    });
    injectHook(type, wrappedHook, target);
    if (target) {
      let current = target.parent;
      while (current && current.parent) {
        if (isKeepAlive(current.parent.vnode)) {
          injectToKeepAliveRoot(wrappedHook, type, target, current);
        }
        current = current.parent;
      }
    }
  }
  function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
    const injected = injectHook(
      type,
      hook,
      keepAliveRoot,
      true
      /* prepend */
    );
    onUnmounted(() => {
      remove(keepAliveRoot[type], injected);
    }, target);
  }
  function resetShapeFlag(vnode) {
    vnode.shapeFlag &= -257;
    vnode.shapeFlag &= -513;
  }
  function getInnerChild(vnode) {
    return vnode.shapeFlag & 128 ? vnode.ssContent : vnode;
  }
  function injectHook(type, hook, target = currentInstance, prepend = false) {
    if (target) {
      const hooks = target[type] || (target[type] = []);
      const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
        pauseTracking();
        const reset2 = setCurrentInstance(target);
        const res = callWithAsyncErrorHandling(hook, target, type, args);
        reset2();
        resetTracking();
        return res;
      });
      if (prepend) {
        hooks.unshift(wrappedHook);
      } else {
        hooks.push(wrappedHook);
      }
      return wrappedHook;
    } else if (false) {
      const apiName = toHandlerKey(ErrorTypeStrings$1[type].replace(/ hook$/, ""));
      warn$1(
        `${apiName} is called when there is no active component instance to be associated with. Lifecycle injection APIs can only be used during execution of setup(). If you are using async setup(), make sure to register lifecycle hooks before the first await statement.`
      );
    }
  }
  var createHook = (lifecycle) => (hook, target = currentInstance) => {
    if (!isInSSRComponentSetup || lifecycle === "sp") {
      injectHook(lifecycle, (...args) => hook(...args), target);
    }
  };
  var onBeforeMount = createHook("bm");
  var onMounted = createHook("m");
  var onBeforeUpdate = createHook(
    "bu"
  );
  var onUpdated = createHook("u");
  var onBeforeUnmount = createHook(
    "bum"
  );
  var onUnmounted = createHook("um");
  var onServerPrefetch = createHook(
    "sp"
  );
  var onRenderTriggered = createHook("rtg");
  var onRenderTracked = createHook("rtc");
  function onErrorCaptured(hook, target = currentInstance) {
    injectHook("ec", hook, target);
  }
  var COMPONENTS = "components";
  var DIRECTIVES = "directives";
  function resolveComponent(name, maybeSelfReference) {
    return resolveAsset(COMPONENTS, name, true, maybeSelfReference) || name;
  }
  var NULL_DYNAMIC_COMPONENT = /* @__PURE__ */ Symbol.for("v-ndc");
  function resolveDynamicComponent(component) {
    if (isString(component)) {
      return resolveAsset(COMPONENTS, component, false) || component;
    } else {
      return component || NULL_DYNAMIC_COMPONENT;
    }
  }
  function resolveDirective(name) {
    return resolveAsset(DIRECTIVES, name);
  }
  function resolveAsset(type, name, warnMissing = true, maybeSelfReference = false) {
    const instance = currentRenderingInstance || currentInstance;
    if (instance) {
      const Component = instance.type;
      if (type === COMPONENTS) {
        const selfName = getComponentName(
          Component,
          false
        );
        if (selfName && (selfName === name || selfName === camelize(name) || selfName === capitalize(camelize(name)))) {
          return Component;
        }
      }
      const res = (
        // local registration
        // check instance[type] first which is resolved for options API
        resolve(instance[type] || Component[type], name) || // global registration
        resolve(instance.appContext[type], name)
      );
      if (!res && maybeSelfReference) {
        return Component;
      }
      if (false) {
        const extra = type === COMPONENTS ? `
If this is a native custom element, make sure to exclude it from component resolution via compilerOptions.isCustomElement.` : ``;
        warn$1(`Failed to resolve ${type.slice(0, -1)}: ${name}${extra}`);
      }
      return res;
    } else if (false) {
      warn$1(
        `resolve${capitalize(type.slice(0, -1))} can only be used in render() or setup().`
      );
    }
  }
  function resolve(registry, name) {
    return registry && (registry[name] || registry[camelize(name)] || registry[capitalize(camelize(name))]);
  }
  function renderList(source, renderItem, cache, index) {
    let ret;
    const cached = cache && cache[index];
    const sourceIsArray = isArray(source);
    if (sourceIsArray || isString(source)) {
      const sourceIsReactiveArray = sourceIsArray && isReactive(source);
      let needsWrap = false;
      let isReadonlySource = false;
      if (sourceIsReactiveArray) {
        needsWrap = !isShallow(source);
        isReadonlySource = isReadonly(source);
        source = shallowReadArray(source);
      }
      ret = new Array(source.length);
      for (let i = 0, l = source.length; i < l; i++) {
        ret[i] = renderItem(
          needsWrap ? isReadonlySource ? toReadonly(toReactive(source[i])) : toReactive(source[i]) : source[i],
          i,
          void 0,
          cached && cached[i]
        );
      }
    } else if (typeof source === "number") {
      if (!Number.isInteger(source) || source < 0) {
        if (false) {
          warn$1(
            `The v-for range expects a positive integer value but got ${source}.`
          );
        }
        ret = [];
      } else {
        ret = new Array(source);
        for (let i = 0; i < source; i++) {
          ret[i] = renderItem(i + 1, i, void 0, cached && cached[i]);
        }
      }
    } else if (isObject(source)) {
      if (source[Symbol.iterator]) {
        ret = Array.from(
          source,
          (item, i) => renderItem(item, i, void 0, cached && cached[i])
        );
      } else {
        const keys = Object.keys(source);
        ret = new Array(keys.length);
        for (let i = 0, l = keys.length; i < l; i++) {
          const key = keys[i];
          ret[i] = renderItem(source[key], key, i, cached && cached[i]);
        }
      }
    } else {
      ret = [];
    }
    if (cache) {
      cache[index] = ret;
    }
    return ret;
  }
  function createSlots(slots, dynamicSlots) {
    for (let i = 0; i < dynamicSlots.length; i++) {
      const slot = dynamicSlots[i];
      if (isArray(slot)) {
        for (let j = 0; j < slot.length; j++) {
          slots[slot[j].name] = slot[j].fn;
        }
      } else if (slot) {
        slots[slot.name] = slot.key ? (...args) => {
          const res = slot.fn(...args);
          if (res) res.key = slot.key;
          return res;
        } : slot.fn;
      }
    }
    return slots;
  }
  function renderSlot(slots, name, props, fallback, noSlotted, branchKey) {
    if (props == null) props = {};
    if (currentRenderingInstance.ce || currentRenderingInstance.parent && isAsyncWrapper(currentRenderingInstance.parent) && currentRenderingInstance.parent.ce) {
      const slotProps = branchKey != null && props.key == null ? extend({}, props, { key: branchKey }) : props;
      const hasProps = Object.keys(slotProps).length > 0;
      if (name !== "default") slotProps.name = name;
      return openBlock(), createBlock(
        Fragment,
        null,
        [createVNode("slot", slotProps, fallback && fallback())],
        hasProps ? -2 : 64
      );
    }
    let slot = slots[name];
    if (false) {
      warn$1(
        `SSR-optimized slot function detected in a non-SSR-optimized render function. You need to mark this component with $dynamic-slots in the parent template.`
      );
      slot = () => [];
    }
    if (slot && slot._c) {
      slot._d = false;
    }
    const prevStackSize = blockStack.length;
    openBlock();
    let rendered;
    try {
      const validSlotContent = slot && ensureValidVNode(slot(props));
      const slotKey = props.key || branchKey || // slot content array of a dynamic conditional slot may have a branch
      // key attached in the `createSlots` helper, respect that
      validSlotContent && validSlotContent.key;
      rendered = createBlock(
        Fragment,
        {
          key: (slotKey && !isSymbol(slotKey) ? slotKey : `_${name}`) + // #7256 force differentiate fallback content from actual content
          (!validSlotContent && fallback ? "_fb" : "")
        },
        validSlotContent || (fallback ? fallback() : []),
        validSlotContent && slots._ === 1 ? 64 : -2
      );
    } catch (err) {
      for (let i = blockStack.length; i > prevStackSize; i--) closeBlock();
      throw err;
    } finally {
      if (slot && slot._c) {
        slot._d = true;
      }
    }
    if (!noSlotted && rendered.scopeId) {
      rendered.slotScopeIds = [rendered.scopeId + "-s"];
    }
    return rendered;
  }
  function ensureValidVNode(vnodes) {
    return vnodes.some((child) => {
      if (!isVNode(child)) return true;
      if (child.type === Comment) return false;
      if (child.type === Fragment && !ensureValidVNode(child.children))
        return false;
      return true;
    }) ? vnodes : null;
  }
  function toHandlers(obj, preserveCaseIfNecessary) {
    const ret = {};
    if (false) {
      warn$1(`v-on with no argument expects an object value.`);
      return ret;
    }
    for (const key in obj) {
      ret[preserveCaseIfNecessary && /[A-Z]/.test(key) ? `on:${key}` : toHandlerKey(key)] = obj[key];
    }
    return ret;
  }
  var getPublicInstance = (i) => {
    if (!i) return null;
    if (isStatefulComponent(i)) return getComponentPublicInstance(i);
    return getPublicInstance(i.parent);
  };
  var publicPropertiesMap = (
    // Move PURE marker to new line to workaround compiler discarding it
    // due to type annotation
    /* @__PURE__ */ extend(/* @__PURE__ */ Object.create(null), {
      $: (i) => i,
      $el: (i) => false ? getDevRootFragmentEl(i) : i.vnode.el,
      $data: (i) => i.data,
      $props: (i) => false ? shallowReadonly(i.props) : i.props,
      $attrs: (i) => false ? shallowReadonly(i.attrs) : i.attrs,
      $slots: (i) => false ? shallowReadonly(i.slots) : i.slots,
      $refs: (i) => false ? shallowReadonly(i.refs) : i.refs,
      $parent: (i) => getPublicInstance(i.parent),
      $root: (i) => getPublicInstance(i.root),
      $host: (i) => i.ce,
      $emit: (i) => i.emit,
      $options: (i) => true ? resolveMergedOptions(i) : i.type,
      $forceUpdate: (i) => i.f || (i.f = () => {
        queueJob(i.update);
      }),
      $nextTick: (i) => i.n || (i.n = nextTick.bind(i.proxy)),
      $watch: (i) => true ? instanceWatch.bind(i) : NOOP
    })
  );
  var hasSetupBinding = (state, key) => state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key);
  var PublicInstanceProxyHandlers = {
    get({ _: instance }, key) {
      if (key === "__v_skip") {
        return true;
      }
      const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
      if (false) {
        return true;
      }
      if (key[0] !== "$") {
        const n = accessCache[key];
        if (n !== void 0) {
          switch (n) {
            case 1:
              return setupState[key];
            case 2:
              return data[key];
            case 4:
              return ctx[key];
            case 3:
              return props[key];
          }
        } else if (hasSetupBinding(setupState, key)) {
          accessCache[key] = 1;
          return setupState[key];
        } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
          accessCache[key] = 2;
          return data[key];
        } else if (hasOwn(props, key)) {
          accessCache[key] = 3;
          return props[key];
        } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
          accessCache[key] = 4;
          return ctx[key];
        } else if (shouldCacheAccess) {
          accessCache[key] = 0;
        }
      }
      const publicGetter = publicPropertiesMap[key];
      let cssModule, globalProperties;
      if (publicGetter) {
        if (key === "$attrs") {
          track(instance.attrs, "get", "");
        } else if (false) {
          track(instance, "get", key);
        }
        return publicGetter(instance);
      } else if (
        // css module (injected by vue-loader)
        (cssModule = type.__cssModules) && (cssModule = cssModule[key])
      ) {
        return cssModule;
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache[key] = 4;
        return ctx[key];
      } else if (
        // global properties
        globalProperties = appContext.config.globalProperties, hasOwn(globalProperties, key)
      ) {
        {
          return globalProperties[key];
        }
      } else if (false) {
        if (data !== EMPTY_OBJ && isReservedPrefix(key[0]) && hasOwn(data, key)) {
          warn$1(
            `Property ${JSON.stringify(
              key
            )} must be accessed via $data because it starts with a reserved character ("$" or "_") and is not proxied on the render context.`
          );
        } else if (instance === currentRenderingInstance) {
          warn$1(
            `Property ${JSON.stringify(key)} was accessed during render but is not defined on instance.`
          );
        }
      }
    },
    set({ _: instance }, key, value) {
      const { data, setupState, ctx } = instance;
      if (hasSetupBinding(setupState, key)) {
        setupState[key] = value;
        return true;
      } else if (false) {
        warn$1(`Cannot mutate <script setup> binding "${key}" from Options API.`);
        return false;
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        data[key] = value;
        return true;
      } else if (hasOwn(instance.props, key)) {
        return false;
      }
      if (key[0] === "$" && key.slice(1) in instance) {
        return false;
      } else {
        if (false) {
          Object.defineProperty(ctx, key, {
            enumerable: true,
            configurable: true,
            value
          });
        } else {
          ctx[key] = value;
        }
      }
      return true;
    },
    has({
      _: { data, setupState, accessCache, ctx, appContext, props, type }
    }, key) {
      let cssModules;
      return !!(accessCache[key] || data !== EMPTY_OBJ && key[0] !== "$" && hasOwn(data, key) || hasSetupBinding(setupState, key) || hasOwn(props, key) || hasOwn(ctx, key) || hasOwn(publicPropertiesMap, key) || hasOwn(appContext.config.globalProperties, key) || (cssModules = type.__cssModules) && cssModules[key]);
    },
    defineProperty(target, key, descriptor) {
      if (descriptor.get != null) {
        target._.accessCache[key] = 0;
      } else if (hasOwn(descriptor, "value")) {
        this.set(target, key, descriptor.value, null);
      }
      return Reflect.defineProperty(target, key, descriptor);
    }
  };
  if (false) {
    PublicInstanceProxyHandlers.ownKeys = (target) => {
      warn$1(
        `Avoid app logic that relies on enumerating keys on a component instance. The keys will be empty in production mode to avoid performance overhead.`
      );
      return Reflect.ownKeys(target);
    };
  }
  var RuntimeCompiledPublicInstanceProxyHandlers = /* @__PURE__ */ extend({}, PublicInstanceProxyHandlers, {
    get(target, key) {
      if (key === Symbol.unscopables) {
        return;
      }
      return PublicInstanceProxyHandlers.get(target, key, target);
    },
    has(_, key) {
      const has = key[0] !== "_" && !isGloballyAllowed(key);
      if (false) {
        warn$1(
          `Property ${JSON.stringify(
            key
          )} should not start with _ which is a reserved prefix for Vue internals.`
        );
      }
      return has;
    }
  });
  function defineProps() {
    if (false) {
      warnRuntimeUsage(`defineProps`);
    }
    return null;
  }
  function defineEmits() {
    if (false) {
      warnRuntimeUsage(`defineEmits`);
    }
    return null;
  }
  function defineExpose(exposed) {
    if (false) {
      warnRuntimeUsage(`defineExpose`);
    }
  }
  function defineOptions(options) {
    if (false) {
      warnRuntimeUsage(`defineOptions`);
    }
  }
  function defineSlots() {
    if (false) {
      warnRuntimeUsage(`defineSlots`);
    }
    return null;
  }
  function defineModel() {
    if (false) {
      warnRuntimeUsage("defineModel");
    }
  }
  function withDefaults(props, defaults) {
    if (false) {
      warnRuntimeUsage(`withDefaults`);
    }
    return null;
  }
  function useSlots() {
    return getContext("useSlots").slots;
  }
  function useAttrs() {
    return getContext("useAttrs").attrs;
  }
  function getContext(calledFunctionName) {
    const i = getCurrentInstance();
    if (false) {
      warn$1(`${calledFunctionName}() called without active instance.`);
    }
    return i.setupContext || (i.setupContext = createSetupContext(i));
  }
  function normalizePropsOrEmits(props) {
    return isArray(props) ? props.reduce(
      (normalized, p2) => (normalized[p2] = null, normalized),
      {}
    ) : props;
  }
  function mergeDefaults(raw, defaults) {
    const props = normalizePropsOrEmits(raw);
    for (const key in defaults) {
      if (key.startsWith("__skip")) continue;
      let opt = props[key];
      if (opt) {
        if (isArray(opt) || isFunction(opt)) {
          opt = props[key] = { type: opt, default: defaults[key] };
        } else {
          opt.default = defaults[key];
        }
      } else if (opt === null) {
        opt = props[key] = { default: defaults[key] };
      } else if (false) {
        warn$1(`props default key "${key}" has no corresponding declaration.`);
      }
      if (opt && defaults[`__skip_${key}`]) {
        opt.skipFactory = true;
      }
    }
    return props;
  }
  function mergeModels(a, b) {
    if (!a || !b) return a || b;
    if (isArray(a) && isArray(b)) return a.concat(b);
    return extend({}, normalizePropsOrEmits(a), normalizePropsOrEmits(b));
  }
  function createPropsRestProxy(props, excludedKeys) {
    const ret = {};
    for (const key in props) {
      if (!excludedKeys.includes(key)) {
        Object.defineProperty(ret, key, {
          enumerable: true,
          get: () => props[key]
        });
      }
    }
    return ret;
  }
  function withAsyncContext(getAwaitable) {
    const ctx = getCurrentInstance();
    const inSSRSetup = isInSSRComponentSetup;
    if (false) {
      warn$1(
        `withAsyncContext called without active current instance. This is likely a bug.`
      );
    }
    let awaitable = getAwaitable();
    unsetCurrentInstance();
    if (inSSRSetup) {
      setInSSRSetupState(false);
    }
    const restore = () => {
      setCurrentInstance(ctx);
      if (inSSRSetup) {
        setInSSRSetupState(true);
      }
    };
    const cleanup = () => {
      if (getCurrentInstance() !== ctx) ctx.scope.off();
      unsetCurrentInstance();
      if (inSSRSetup) {
        setInSSRSetupState(false);
      }
    };
    if (isPromise(awaitable)) {
      awaitable = awaitable.catch((e) => {
        restore();
        Promise.resolve().then(() => Promise.resolve().then(cleanup));
        throw e;
      });
    }
    return [
      awaitable,
      () => {
        restore();
        Promise.resolve().then(cleanup);
      }
    ];
  }
  var shouldCacheAccess = true;
  function applyOptions(instance) {
    const options = resolveMergedOptions(instance);
    const publicThis = instance.proxy;
    const ctx = instance.ctx;
    shouldCacheAccess = false;
    if (options.beforeCreate) {
      callHook(options.beforeCreate, instance, "bc");
    }
    const {
      // state
      data: dataOptions,
      computed: computedOptions,
      methods,
      watch: watchOptions,
      provide: provideOptions,
      inject: injectOptions,
      // lifecycle
      created,
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
      activated,
      deactivated,
      beforeDestroy,
      beforeUnmount,
      destroyed,
      unmounted,
      render: render2,
      renderTracked,
      renderTriggered,
      errorCaptured,
      serverPrefetch,
      // public API
      expose,
      inheritAttrs,
      // assets
      components,
      directives,
      filters
    } = options;
    const checkDuplicateProperties = false ? createDuplicateChecker() : null;
    if (false) {
      const [propsOptions] = instance.propsOptions;
      if (propsOptions) {
        for (const key in propsOptions) {
          checkDuplicateProperties("Props", key);
        }
      }
    }
    if (injectOptions) {
      resolveInjections(injectOptions, ctx, checkDuplicateProperties);
    }
    if (methods) {
      for (const key in methods) {
        const methodHandler = methods[key];
        if (isFunction(methodHandler)) {
          if (false) {
            Object.defineProperty(ctx, key, {
              value: methodHandler.bind(publicThis),
              configurable: true,
              enumerable: true,
              writable: true
            });
          } else {
            ctx[key] = methodHandler.bind(publicThis);
          }
          if (false) {
            checkDuplicateProperties("Methods", key);
          }
        } else if (false) {
          warn$1(
            `Method "${key}" has type "${typeof methodHandler}" in the component definition. Did you reference the function correctly?`
          );
        }
      }
    }
    if (dataOptions) {
      if (false) {
        warn$1(
          `The data option must be a function. Plain object usage is no longer supported.`
        );
      }
      const data = dataOptions.call(publicThis, publicThis);
      if (false) {
        warn$1(
          `data() returned a Promise - note data() cannot be async; If you intend to perform data fetching before component renders, use async setup() + <Suspense>.`
        );
      }
      if (!isObject(data)) {
      } else {
        instance.data = reactive(data);
        if (false) {
          for (const key in data) {
            checkDuplicateProperties("Data", key);
            if (!isReservedPrefix(key[0])) {
              Object.defineProperty(ctx, key, {
                configurable: true,
                enumerable: true,
                get: () => data[key],
                set: NOOP
              });
            }
          }
        }
      }
    }
    shouldCacheAccess = true;
    if (computedOptions) {
      for (const key in computedOptions) {
        const opt = computedOptions[key];
        const get = isFunction(opt) ? opt.bind(publicThis, publicThis) : isFunction(opt.get) ? opt.get.bind(publicThis, publicThis) : NOOP;
        if (false) {
          warn$1(`Computed property "${key}" has no getter.`);
        }
        const set = !isFunction(opt) && isFunction(opt.set) ? opt.set.bind(publicThis) : false ? () => {
          warn$1(
            `Write operation failed: computed property "${key}" is readonly.`
          );
        } : NOOP;
        const c = computed2({
          get,
          set
        });
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          get: () => c.value,
          set: (v) => c.value = v
        });
        if (false) {
          checkDuplicateProperties("Computed", key);
        }
      }
    }
    if (watchOptions) {
      for (const key in watchOptions) {
        createWatcher(watchOptions[key], ctx, publicThis, key);
      }
    }
    if (provideOptions) {
      const provides = isFunction(provideOptions) ? provideOptions.call(publicThis) : provideOptions;
      Reflect.ownKeys(provides).forEach((key) => {
        provide(key, provides[key]);
      });
    }
    if (created) {
      callHook(created, instance, "c");
    }
    function registerLifecycleHook(register, hook) {
      if (isArray(hook)) {
        hook.forEach((_hook) => register(_hook.bind(publicThis)));
      } else if (hook) {
        register(hook.bind(publicThis));
      }
    }
    registerLifecycleHook(onBeforeMount, beforeMount);
    registerLifecycleHook(onMounted, mounted);
    registerLifecycleHook(onBeforeUpdate, beforeUpdate);
    registerLifecycleHook(onUpdated, updated);
    registerLifecycleHook(onActivated, activated);
    registerLifecycleHook(onDeactivated, deactivated);
    registerLifecycleHook(onErrorCaptured, errorCaptured);
    registerLifecycleHook(onRenderTracked, renderTracked);
    registerLifecycleHook(onRenderTriggered, renderTriggered);
    registerLifecycleHook(onBeforeUnmount, beforeUnmount);
    registerLifecycleHook(onUnmounted, unmounted);
    registerLifecycleHook(onServerPrefetch, serverPrefetch);
    if (isArray(expose)) {
      if (expose.length) {
        const exposed = instance.exposed || (instance.exposed = {});
        expose.forEach((key) => {
          Object.defineProperty(exposed, key, {
            get: () => publicThis[key],
            set: (val) => publicThis[key] = val,
            enumerable: true
          });
        });
      } else if (!instance.exposed) {
        instance.exposed = {};
      }
    }
    if (render2 && instance.render === NOOP) {
      instance.render = render2;
    }
    if (inheritAttrs != null) {
      instance.inheritAttrs = inheritAttrs;
    }
    if (components) instance.components = components;
    if (directives) instance.directives = directives;
    if (serverPrefetch) {
      markAsyncBoundary(instance);
    }
  }
  function resolveInjections(injectOptions, ctx, checkDuplicateProperties = NOOP) {
    if (isArray(injectOptions)) {
      injectOptions = normalizeInject(injectOptions);
    }
    for (const key in injectOptions) {
      const opt = injectOptions[key];
      let injected;
      if (isObject(opt)) {
        if ("default" in opt) {
          injected = inject(
            opt.from || key,
            opt.default,
            true
          );
        } else {
          injected = inject(opt.from || key);
        }
      } else {
        injected = inject(opt);
      }
      if (isRef2(injected)) {
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          get: () => injected.value,
          set: (v) => injected.value = v
        });
      } else {
        ctx[key] = injected;
      }
      if (false) {
        checkDuplicateProperties("Inject", key);
      }
    }
  }
  function callHook(hook, instance, type) {
    callWithAsyncErrorHandling(
      isArray(hook) ? hook.map((h2) => h2.bind(instance.proxy)) : hook.bind(instance.proxy),
      instance,
      type
    );
  }
  function createWatcher(raw, ctx, publicThis, key) {
    let getter = key.includes(".") ? createPathGetter(publicThis, key) : () => publicThis[key];
    if (isString(raw)) {
      const handler = ctx[raw];
      if (isFunction(handler)) {
        {
          watch2(getter, handler);
        }
      } else if (false) {
        warn$1(`Invalid watch handler specified by key "${raw}"`, handler);
      }
    } else if (isFunction(raw)) {
      {
        watch2(getter, raw.bind(publicThis));
      }
    } else if (isObject(raw)) {
      if (isArray(raw)) {
        raw.forEach((r) => createWatcher(r, ctx, publicThis, key));
      } else {
        const handler = isFunction(raw.handler) ? raw.handler.bind(publicThis) : ctx[raw.handler];
        if (isFunction(handler)) {
          watch2(getter, handler, raw);
        } else if (false) {
          warn$1(`Invalid watch handler specified by key "${raw.handler}"`, handler);
        }
      }
    } else if (false) {
      warn$1(`Invalid watch option: "${key}"`, raw);
    }
  }
  function resolveMergedOptions(instance) {
    const base = instance.type;
    const { mixins, extends: extendsOptions } = base;
    const {
      mixins: globalMixins,
      optionsCache: cache,
      config: { optionMergeStrategies }
    } = instance.appContext;
    const cached = cache.get(base);
    let resolved;
    if (cached) {
      resolved = cached;
    } else if (!globalMixins.length && !mixins && !extendsOptions) {
      {
        resolved = base;
      }
    } else {
      resolved = {};
      if (globalMixins.length) {
        globalMixins.forEach(
          (m) => mergeOptions(resolved, m, optionMergeStrategies, true)
        );
      }
      mergeOptions(resolved, base, optionMergeStrategies);
    }
    if (isObject(base)) {
      cache.set(base, resolved);
    }
    return resolved;
  }
  function mergeOptions(to, from, strats, asMixin = false) {
    const { mixins, extends: extendsOptions } = from;
    if (extendsOptions) {
      mergeOptions(to, extendsOptions, strats, true);
    }
    if (mixins) {
      mixins.forEach(
        (m) => mergeOptions(to, m, strats, true)
      );
    }
    for (const key in from) {
      if (asMixin && key === "expose") {
      } else {
        const strat = internalOptionMergeStrats[key] || strats && strats[key];
        to[key] = strat ? strat(to[key], from[key]) : from[key];
      }
    }
    return to;
  }
  var internalOptionMergeStrats = {
    data: mergeDataFn,
    props: mergeEmitsOrPropsOptions,
    emits: mergeEmitsOrPropsOptions,
    // objects
    methods: mergeObjectOptions,
    computed: mergeObjectOptions,
    // lifecycle
    beforeCreate: mergeAsArray,
    created: mergeAsArray,
    beforeMount: mergeAsArray,
    mounted: mergeAsArray,
    beforeUpdate: mergeAsArray,
    updated: mergeAsArray,
    beforeDestroy: mergeAsArray,
    beforeUnmount: mergeAsArray,
    destroyed: mergeAsArray,
    unmounted: mergeAsArray,
    activated: mergeAsArray,
    deactivated: mergeAsArray,
    errorCaptured: mergeAsArray,
    serverPrefetch: mergeAsArray,
    // assets
    components: mergeObjectOptions,
    directives: mergeObjectOptions,
    // watch
    watch: mergeWatchOptions,
    // provide / inject
    provide: mergeDataFn,
    inject: mergeInject
  };
  function mergeDataFn(to, from) {
    if (!from) {
      return to;
    }
    if (!to) {
      return from;
    }
    return function mergedDataFn() {
      return extend(
        isFunction(to) ? to.call(this, this) : to,
        isFunction(from) ? from.call(this, this) : from
      );
    };
  }
  function mergeInject(to, from) {
    return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
  }
  function normalizeInject(raw) {
    if (isArray(raw)) {
      const res = {};
      for (let i = 0; i < raw.length; i++) {
        res[raw[i]] = raw[i];
      }
      return res;
    }
    return raw;
  }
  function mergeAsArray(to, from) {
    return to ? [...new Set([].concat(to, from))] : from;
  }
  function mergeObjectOptions(to, from) {
    return to ? extend(/* @__PURE__ */ Object.create(null), to, from) : from;
  }
  function mergeEmitsOrPropsOptions(to, from) {
    if (to) {
      if (isArray(to) && isArray(from)) {
        return [.../* @__PURE__ */ new Set([...to, ...from])];
      }
      return extend(
        /* @__PURE__ */ Object.create(null),
        normalizePropsOrEmits(to),
        normalizePropsOrEmits(from != null ? from : {})
      );
    } else {
      return from;
    }
  }
  function mergeWatchOptions(to, from) {
    if (!to) return from;
    if (!from) return to;
    const merged = extend(/* @__PURE__ */ Object.create(null), to);
    for (const key in from) {
      merged[key] = mergeAsArray(to[key], from[key]);
    }
    return merged;
  }
  function createAppContext() {
    return {
      app: null,
      config: {
        isNativeTag: NO,
        performance: false,
        globalProperties: {},
        optionMergeStrategies: {},
        errorHandler: void 0,
        warnHandler: void 0,
        compilerOptions: {}
      },
      mixins: [],
      components: {},
      directives: {},
      provides: /* @__PURE__ */ Object.create(null),
      optionsCache: /* @__PURE__ */ new WeakMap(),
      propsCache: /* @__PURE__ */ new WeakMap(),
      emitsCache: /* @__PURE__ */ new WeakMap()
    };
  }
  var uid$1 = 0;
  function createAppAPI(render2, hydrate2) {
    return function createApp2(rootComponent, rootProps = null) {
      if (!isFunction(rootComponent)) {
        rootComponent = extend({}, rootComponent);
      }
      if (rootProps != null && !isObject(rootProps)) {
        rootProps = null;
      }
      const context = createAppContext();
      const installedPlugins = /* @__PURE__ */ new WeakSet();
      const pluginCleanupFns = [];
      let isMounted = false;
      const app = context.app = {
        _uid: uid$1++,
        _component: rootComponent,
        _props: rootProps,
        _container: null,
        _context: context,
        _instance: null,
        version,
        get config() {
          return context.config;
        },
        set config(v) {
          if (false) {
            warn$1(
              `app.config cannot be replaced. Modify individual options instead.`
            );
          }
        },
        use(plugin, ...options) {
          if (installedPlugins.has(plugin)) {
          } else if (plugin && isFunction(plugin.install)) {
            installedPlugins.add(plugin);
            plugin.install(app, ...options);
          } else if (isFunction(plugin)) {
            installedPlugins.add(plugin);
            plugin(app, ...options);
          } else if (false) {
            warn$1(
              `A plugin must either be a function or an object with an "install" function.`
            );
          }
          return app;
        },
        mixin(mixin) {
          if (true) {
            if (!context.mixins.includes(mixin)) {
              context.mixins.push(mixin);
            } else if (false) {
              warn$1(
                "Mixin has already been applied to target app" + (mixin.name ? `: ${mixin.name}` : "")
              );
            }
          } else if (false) {
            warn$1("Mixins are only available in builds supporting Options API");
          }
          return app;
        },
        component(name, component) {
          if (false) {
            validateComponentName(name, context.config);
          }
          if (!component) {
            return context.components[name];
          }
          if (false) {
            warn$1(`Component "${name}" has already been registered in target app.`);
          }
          context.components[name] = component;
          return app;
        },
        directive(name, directive) {
          if (false) {
            validateDirectiveName(name);
          }
          if (!directive) {
            return context.directives[name];
          }
          if (false) {
            warn$1(`Directive "${name}" has already been registered in target app.`);
          }
          context.directives[name] = directive;
          return app;
        },
        mount(rootContainer, isHydrate, namespace) {
          if (!isMounted) {
            if (false) {
              warn$1(
                `There is already an app instance mounted on the host container.
 If you want to mount another app on the same host container, you need to unmount the previous app by calling \`app.unmount()\` first.`
              );
            }
            const vnode = app._ceVNode || createVNode(rootComponent, rootProps);
            vnode.appContext = context;
            if (namespace === true) {
              namespace = "svg";
            } else if (namespace === false) {
              namespace = void 0;
            }
            if (false) {
              context.reload = () => {
                const cloned = cloneVNode(vnode);
                cloned.el = null;
                render2(cloned, rootContainer, namespace);
              };
            }
            if (isHydrate && hydrate2) {
              hydrate2(vnode, rootContainer);
            } else {
              render2(vnode, rootContainer, namespace);
            }
            isMounted = true;
            app._container = rootContainer;
            rootContainer.__vue_app__ = app;
            if (false) {
              app._instance = vnode.component;
              devtoolsInitApp(app, version);
            }
            return getComponentPublicInstance(vnode.component);
          } else if (false) {
            warn$1(
              `App has already been mounted.
If you want to remount the same app, move your app creation logic into a factory function and create fresh app instances for each mount - e.g. \`const createMyApp = () => createApp(App)\``
            );
          }
        },
        onUnmount(cleanupFn) {
          if (false) {
            warn$1(
              `Expected function as first argument to app.onUnmount(), but got ${typeof cleanupFn}`
            );
          }
          pluginCleanupFns.push(cleanupFn);
        },
        unmount() {
          if (isMounted) {
            callWithAsyncErrorHandling(
              pluginCleanupFns,
              app._instance,
              16
            );
            render2(null, app._container);
            if (false) {
              app._instance = null;
              devtoolsUnmountApp(app);
            }
            delete app._container.__vue_app__;
          } else if (false) {
            warn$1(`Cannot unmount an app that is not mounted.`);
          }
        },
        provide(key, value) {
          if (false) {
            if (hasOwn(context.provides, key)) {
              warn$1(
                `App already provides property with key "${String(key)}". It will be overwritten with the new value.`
              );
            } else {
              warn$1(
                `App already provides property with key "${String(key)}" inherited from its parent element. It will be overwritten with the new value.`
              );
            }
          }
          context.provides[key] = value;
          return app;
        },
        runWithContext(fn) {
          const lastApp = currentApp;
          currentApp = app;
          try {
            return fn();
          } finally {
            currentApp = lastApp;
          }
        }
      };
      return app;
    };
  }
  var currentApp = null;
  function useModel(props, name, options = EMPTY_OBJ) {
    const i = getCurrentInstance();
    if (false) {
      warn$1(`useModel() called without active instance.`);
      return ref();
    }
    const camelizedName = camelize(name);
    if (false) {
      warn$1(`useModel() called with prop "${name}" which is not declared.`);
      return ref();
    }
    const hyphenatedName = hyphenate(name);
    const modifiers = getModelModifiers(props, camelizedName);
    const res = customRef((track2, trigger2) => {
      let localValue;
      let prevSetValue = EMPTY_OBJ;
      let prevEmittedValue;
      watchSyncEffect(() => {
        const propValue = props[camelizedName];
        if (hasChanged(localValue, propValue)) {
          localValue = propValue;
          trigger2();
        }
      });
      return {
        get() {
          track2();
          return options.get ? options.get(localValue) : localValue;
        },
        set(value) {
          const emittedValue = options.set ? options.set(value) : value;
          if (!hasChanged(emittedValue, localValue) && !(prevSetValue !== EMPTY_OBJ && hasChanged(value, prevSetValue))) {
            return;
          }
          const rawProps = i.vnode.props;
          const hasVModel = !!(rawProps && // check if parent has passed v-model
          (name in rawProps || camelizedName in rawProps || hyphenatedName in rawProps) && (`onUpdate:${name}` in rawProps || `onUpdate:${camelizedName}` in rawProps || `onUpdate:${hyphenatedName}` in rawProps));
          if (!hasVModel) {
            localValue = value;
            trigger2();
          }
          i.emit(`update:${name}`, emittedValue);
          if (hasChanged(value, prevSetValue) && (hasChanged(value, emittedValue) && !hasChanged(emittedValue, prevEmittedValue) || // #13524: browsers differ in when they flush microtasks between
          // event listeners. If a v-model listener emits an intermediate value
          // and a following listener restores the model to its previous prop
          // value before parent updates are flushed, the parent render can be
          // deduped as having no prop change. Force a local update so DOM state
          // such as an input's value is synchronized back to the current model.
          hasVModel && prevSetValue !== EMPTY_OBJ && !hasChanged(emittedValue, localValue))) {
            trigger2();
          }
          prevSetValue = value;
          prevEmittedValue = emittedValue;
        }
      };
    });
    res[Symbol.iterator] = () => {
      let i2 = 0;
      return {
        next() {
          if (i2 < 2) {
            return { value: i2++ ? modifiers || EMPTY_OBJ : res, done: false };
          } else {
            return { done: true };
          }
        }
      };
    };
    return res;
  }
  var getModelModifiers = (props, modelName) => {
    return modelName === "modelValue" || modelName === "model-value" ? props.modelModifiers : props[`${modelName}Modifiers`] || props[`${camelize(modelName)}Modifiers`] || props[`${hyphenate(modelName)}Modifiers`];
  };
  function emit(instance, event, ...rawArgs) {
    if (instance.isUnmounted) return;
    const props = instance.vnode.props || EMPTY_OBJ;
    if (false) {
      const {
        emitsOptions,
        propsOptions: [propsOptions]
      } = instance;
      if (emitsOptions) {
        if (!(event in emitsOptions) && true) {
          if (!propsOptions || !(toHandlerKey(camelize(event)) in propsOptions)) {
            warn$1(
              `Component emitted event "${event}" but it is neither declared in the emits option nor as an "${toHandlerKey(camelize(event))}" prop.`
            );
          }
        } else {
          const validator = emitsOptions[event];
          if (isFunction(validator)) {
            const isValid = validator(...rawArgs);
            if (!isValid) {
              warn$1(
                `Invalid event arguments: event validation failed for event "${event}".`
              );
            }
          }
        }
      }
    }
    let args = rawArgs;
    const isModelListener2 = event.startsWith("update:");
    const modifiers = isModelListener2 && getModelModifiers(props, event.slice(7));
    if (modifiers) {
      if (modifiers.trim) {
        args = rawArgs.map((a) => isString(a) ? a.trim() : a);
      }
      if (modifiers.number) {
        args = args.map(looseToNumber);
      }
    }
    if (false) {
      devtoolsComponentEmit(instance, event, args);
    }
    if (false) {
      const lowerCaseEvent = event.toLowerCase();
      if (lowerCaseEvent !== event && props[toHandlerKey(lowerCaseEvent)]) {
        warn$1(
          `Event "${lowerCaseEvent}" is emitted in component ${formatComponentName(
            instance,
            instance.type
          )} but the handler is registered for "${event}". Note that HTML attributes are case-insensitive and you cannot use v-on to listen to camelCase events when using in-DOM templates. You should probably use "${hyphenate(
            event
          )}" instead of "${event}".`
        );
      }
    }
    let handlerName;
    let handler = props[handlerName = toHandlerKey(event)] || // also try camelCase event handler (#2249)
    props[handlerName = toHandlerKey(camelize(event))];
    if (!handler && isModelListener2) {
      handler = props[handlerName = toHandlerKey(hyphenate(event))];
    }
    if (handler) {
      callWithAsyncErrorHandling(
        handler,
        instance,
        6,
        args
      );
    }
    const onceHandler = props[handlerName + `Once`];
    if (onceHandler) {
      if (!instance.emitted) {
        instance.emitted = {};
      } else if (instance.emitted[handlerName]) {
        return;
      }
      instance.emitted[handlerName] = true;
      callWithAsyncErrorHandling(
        onceHandler,
        instance,
        6,
        args
      );
    }
  }
  var mixinEmitsCache = /* @__PURE__ */ new WeakMap();
  function normalizeEmitsOptions(comp, appContext, asMixin = false) {
    const cache = asMixin ? mixinEmitsCache : appContext.emitsCache;
    const cached = cache.get(comp);
    if (cached !== void 0) {
      return cached;
    }
    const raw = comp.emits;
    let normalized = {};
    let hasExtends = false;
    if (!isFunction(comp)) {
      const extendEmits = (raw2) => {
        const normalizedFromExtend = normalizeEmitsOptions(raw2, appContext, true);
        if (normalizedFromExtend) {
          hasExtends = true;
          extend(normalized, normalizedFromExtend);
        }
      };
      if (!asMixin && appContext.mixins.length) {
        appContext.mixins.forEach(extendEmits);
      }
      if (comp.extends) {
        extendEmits(comp.extends);
      }
      if (comp.mixins) {
        comp.mixins.forEach(extendEmits);
      }
    }
    if (!raw && !hasExtends) {
      if (isObject(comp)) {
        cache.set(comp, null);
      }
      return null;
    }
    if (isArray(raw)) {
      raw.forEach((key) => normalized[key] = null);
    } else {
      extend(normalized, raw);
    }
    if (isObject(comp)) {
      cache.set(comp, normalized);
    }
    return normalized;
  }
  function isEmitListener(options, key) {
    if (!options || !isOn(key)) {
      return false;
    }
    key = key.slice(2);
    key = key === "Once" ? key : key.replace(/Once$/, "");
    return hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, hyphenate(key)) || hasOwn(options, key);
  }
  function renderComponentRoot(instance) {
    const {
      type: Component,
      vnode,
      proxy,
      withProxy,
      propsOptions: [propsOptions],
      slots,
      attrs,
      emit: emit2,
      render: render2,
      renderCache,
      props,
      data,
      setupState,
      ctx,
      inheritAttrs
    } = instance;
    const prev = setCurrentRenderingInstance(instance);
    let result;
    let fallthroughAttrs;
    if (false) {
      accessedAttrs = false;
    }
    try {
      if (vnode.shapeFlag & 4) {
        const proxyToUse = withProxy || proxy;
        const thisProxy = false ? new Proxy(proxyToUse, {
          get(target, key, receiver) {
            warn$1(
              `Property '${String(
                key
              )}' was accessed via 'this'. Avoid using 'this' in templates.`
            );
            return Reflect.get(target, key, receiver);
          }
        }) : proxyToUse;
        result = normalizeVNode(
          render2.call(
            thisProxy,
            proxyToUse,
            renderCache,
            false ? shallowReadonly(props) : props,
            setupState,
            data,
            ctx
          )
        );
        fallthroughAttrs = attrs;
      } else {
        const render22 = Component;
        if (false) {
          markAttrsAccessed();
        }
        result = normalizeVNode(
          render22.length > 1 ? render22(
            false ? shallowReadonly(props) : props,
            false ? {
              get attrs() {
                markAttrsAccessed();
                return shallowReadonly(attrs);
              },
              slots,
              emit: emit2
            } : { attrs, slots, emit: emit2 }
          ) : render22(
            false ? shallowReadonly(props) : props,
            null
          )
        );
        fallthroughAttrs = Component.props ? attrs : getFunctionalFallthrough(attrs);
      }
    } catch (err) {
      blockStack.length = 0;
      handleError(err, instance, 1);
      result = createVNode(Comment);
    }
    let root = result;
    let setRoot = void 0;
    if (false) {
      [root, setRoot] = getChildRoot(result);
    }
    if (fallthroughAttrs && inheritAttrs !== false) {
      const keys = Object.keys(fallthroughAttrs);
      const { shapeFlag } = root;
      if (keys.length) {
        if (shapeFlag & (1 | 6)) {
          if (propsOptions && keys.some(isModelListener)) {
            fallthroughAttrs = filterModelListeners(
              fallthroughAttrs,
              propsOptions
            );
          }
          root = cloneVNode(root, fallthroughAttrs, false, true);
        } else if (false) {
          const allAttrs = Object.keys(attrs);
          const eventAttrs = [];
          const extraAttrs = [];
          for (let i = 0, l = allAttrs.length; i < l; i++) {
            const key = allAttrs[i];
            if (isOn(key)) {
              if (!isModelListener(key)) {
                eventAttrs.push(key[2].toLowerCase() + key.slice(3));
              }
            } else {
              extraAttrs.push(key);
            }
          }
          if (extraAttrs.length) {
            warn$1(
              `Extraneous non-props attributes (${extraAttrs.join(", ")}) were passed to component but could not be automatically inherited because component renders fragment or text or teleport root nodes.`
            );
          }
          if (eventAttrs.length) {
            warn$1(
              `Extraneous non-emits event listeners (${eventAttrs.join(", ")}) were passed to component but could not be automatically inherited because component renders fragment or text root nodes. If the listener is intended to be a component custom event listener only, declare it using the "emits" option.`
            );
          }
        }
      }
    }
    if (vnode.dirs) {
      if (false) {
        warn$1(
          `Runtime directive used on component with non-element root node. The directives will not function as intended.`
        );
      }
      root = cloneVNode(root, null, false, true);
      root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs;
    }
    if (vnode.transition) {
      const child = isTeleport(root.type) ? getInnerChild$1(root) || root : root;
      if (false) {
        warn$1(
          `Component inside <Transition> renders non-element root node that cannot be animated.`
        );
      }
      setTransitionHooks(child, vnode.transition);
    }
    if (false) {
      setRoot(root);
    } else {
      result = root;
    }
    setCurrentRenderingInstance(prev);
    return result;
  }
  function filterSingleRoot(children, recurse = true) {
    let singleRoot;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (isVNode(child)) {
        if (child.type !== Comment || child.children === "v-if") {
          if (singleRoot) {
            return;
          } else {
            singleRoot = child;
            if (false) {
              return filterSingleRoot(singleRoot.children);
            }
          }
        }
      } else {
        return;
      }
    }
    return singleRoot;
  }
  var getFunctionalFallthrough = (attrs) => {
    let res;
    for (const key in attrs) {
      if (key === "class" || key === "style" || isOn(key)) {
        (res || (res = {}))[key] = attrs[key];
      }
    }
    return res;
  };
  var filterModelListeners = (attrs, props) => {
    const res = {};
    for (const key in attrs) {
      if (!isModelListener(key) || !(key.slice(9) in props)) {
        res[key] = attrs[key];
      }
    }
    return res;
  };
  function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
    const { props: prevProps, children: prevChildren, component } = prevVNode;
    const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
    const emits = component.emitsOptions;
    if (false) {
      return true;
    }
    if (nextVNode.dirs || nextVNode.transition) {
      return true;
    }
    if (optimized && patchFlag >= 0) {
      if (patchFlag & 1024) {
        return true;
      }
      if (patchFlag & 16) {
        if (!prevProps) {
          return !!nextProps;
        }
        return hasPropsChanged(prevProps, nextProps, emits);
      } else if (patchFlag & 8) {
        const dynamicProps = nextVNode.dynamicProps;
        for (let i = 0; i < dynamicProps.length; i++) {
          const key = dynamicProps[i];
          if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emits, key)) {
            return true;
          }
        }
      }
    } else {
      if (prevChildren || nextChildren) {
        if (!nextChildren || !nextChildren.$stable) {
          return true;
        }
      }
      if (prevProps === nextProps) {
        return false;
      }
      if (!prevProps) {
        return !!nextProps;
      }
      if (!nextProps) {
        return true;
      }
      return hasPropsChanged(prevProps, nextProps, emits);
    }
    return false;
  }
  function hasPropsChanged(prevProps, nextProps, emitsOptions) {
    const nextKeys = Object.keys(nextProps);
    if (nextKeys.length !== Object.keys(prevProps).length) {
      return true;
    }
    for (let i = 0; i < nextKeys.length; i++) {
      const key = nextKeys[i];
      if (!hasOwn(prevProps, key) || hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emitsOptions, key)) {
        return true;
      }
    }
    return false;
  }
  function hasPropValueChanged(nextProps, prevProps, key) {
    const nextProp = nextProps[key];
    const prevProp = prevProps[key];
    if (key === "style" && isObject(nextProp) && isObject(prevProp)) {
      return !looseEqual(nextProp, prevProp);
    }
    return nextProp !== prevProp;
  }
  function updateHOCHostEl({ vnode, parent, suspense }, el) {
    while (parent) {
      const root = parent.subTree;
      if (root.suspense && root.suspense.activeBranch === vnode) {
        root.suspense.vnode.el = root.el = el;
        vnode = root;
      }
      if (root === vnode) {
        (vnode = parent.vnode).el = el;
        parent = parent.parent;
      } else {
        break;
      }
    }
    if (suspense && suspense.activeBranch === vnode) {
      suspense.vnode.el = el;
    }
  }
  var internalObjectProto = {};
  var createInternalObject = () => Object.create(internalObjectProto);
  var isInternalObject = (obj) => Object.getPrototypeOf(obj) === internalObjectProto;
  function initProps(instance, rawProps, isStateful, isSSR = false) {
    const props = {};
    const attrs = createInternalObject();
    instance.propsDefaults = /* @__PURE__ */ Object.create(null);
    setFullProps(instance, rawProps, props, attrs);
    for (const key in instance.propsOptions[0]) {
      if (!(key in props)) {
        props[key] = void 0;
      }
    }
    if (false) {
      validateProps(rawProps || {}, props, instance);
    }
    if (isStateful) {
      instance.props = isSSR ? props : shallowReactive(props);
    } else {
      if (!instance.type.props) {
        instance.props = attrs;
      } else {
        instance.props = props;
      }
    }
    instance.attrs = attrs;
  }
  function updateProps(instance, rawProps, rawPrevProps, optimized) {
    const {
      props,
      attrs,
      vnode: { patchFlag }
    } = instance;
    const rawCurrentProps = toRaw(props);
    const [options] = instance.propsOptions;
    let hasAttrsChanged = false;
    if (
      // always force full diff in dev
      // - #1942 if hmr is enabled with sfc component
      // - vite#872 non-sfc component used by sfc component
      (optimized || patchFlag > 0) && !(patchFlag & 16)
    ) {
      if (patchFlag & 8) {
        const propsToUpdate = instance.vnode.dynamicProps;
        for (let i = 0; i < propsToUpdate.length; i++) {
          let key = propsToUpdate[i];
          if (isEmitListener(instance.emitsOptions, key)) {
            continue;
          }
          const value = rawProps[key];
          if (options) {
            if (hasOwn(attrs, key)) {
              if (value !== attrs[key]) {
                attrs[key] = value;
                hasAttrsChanged = true;
              }
            } else {
              const camelizedKey = camelize(key);
              props[camelizedKey] = resolvePropValue(
                options,
                rawCurrentProps,
                camelizedKey,
                value,
                instance,
                false
              );
            }
          } else {
            if (value !== attrs[key]) {
              attrs[key] = value;
              hasAttrsChanged = true;
            }
          }
        }
      }
    } else {
      if (setFullProps(instance, rawProps, props, attrs)) {
        hasAttrsChanged = true;
      }
      let kebabKey;
      for (const key in rawCurrentProps) {
        if (!rawProps || // for camelCase
        !hasOwn(rawProps, key) && // it's possible the original props was passed in as kebab-case
        // and converted to camelCase (#955)
        ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey))) {
          if (options) {
            if (rawPrevProps && // for camelCase
            (rawPrevProps[key] !== void 0 || // for kebab-case
            rawPrevProps[kebabKey] !== void 0)) {
              props[key] = resolvePropValue(
                options,
                rawCurrentProps,
                key,
                void 0,
                instance,
                true
              );
            }
          } else {
            delete props[key];
          }
        }
      }
      if (attrs !== rawCurrentProps) {
        for (const key in attrs) {
          if (!rawProps || !hasOwn(rawProps, key) && true) {
            delete attrs[key];
            hasAttrsChanged = true;
          }
        }
      }
    }
    if (hasAttrsChanged) {
      trigger(instance.attrs, "set", "");
    }
    if (false) {
      validateProps(rawProps || {}, props, instance);
    }
  }
  function setFullProps(instance, rawProps, props, attrs) {
    const [options, needCastKeys] = instance.propsOptions;
    let hasAttrsChanged = false;
    let rawCastValues;
    if (rawProps) {
      for (let key in rawProps) {
        if (isReservedProp(key)) {
          continue;
        }
        const value = rawProps[key];
        let camelKey;
        if (options && hasOwn(options, camelKey = camelize(key))) {
          if (!needCastKeys || !needCastKeys.includes(camelKey)) {
            props[camelKey] = value;
          } else {
            (rawCastValues || (rawCastValues = {}))[camelKey] = value;
          }
        } else if (!isEmitListener(instance.emitsOptions, key)) {
          if (!(key in attrs) || value !== attrs[key]) {
            attrs[key] = value;
            hasAttrsChanged = true;
          }
        }
      }
    }
    if (needCastKeys) {
      const rawCurrentProps = toRaw(props);
      const castValues = rawCastValues || EMPTY_OBJ;
      for (let i = 0; i < needCastKeys.length; i++) {
        const key = needCastKeys[i];
        props[key] = resolvePropValue(
          options,
          rawCurrentProps,
          key,
          castValues[key],
          instance,
          !hasOwn(castValues, key)
        );
      }
    }
    return hasAttrsChanged;
  }
  function resolvePropValue(options, props, key, value, instance, isAbsent) {
    const opt = options[key];
    if (opt != null) {
      const hasDefault = hasOwn(opt, "default");
      if (hasDefault && value === void 0) {
        const defaultValue = opt.default;
        if (opt.type !== Function && !opt.skipFactory && isFunction(defaultValue)) {
          const { propsDefaults } = instance;
          if (key in propsDefaults) {
            value = propsDefaults[key];
          } else {
            const reset2 = setCurrentInstance(instance);
            value = propsDefaults[key] = defaultValue.call(
              null,
              props
            );
            reset2();
          }
        } else {
          value = defaultValue;
        }
        if (instance.ce) {
          instance.ce._setProp(key, value);
        }
      }
      if (opt[
        0
        /* shouldCast */
      ]) {
        if (isAbsent && !hasDefault) {
          value = false;
        } else if (opt[
          1
          /* shouldCastTrue */
        ] && (value === "" || value === hyphenate(key))) {
          value = true;
        }
      }
    }
    return value;
  }
  var mixinPropsCache = /* @__PURE__ */ new WeakMap();
  function normalizePropsOptions(comp, appContext, asMixin = false) {
    const cache = asMixin ? mixinPropsCache : appContext.propsCache;
    const cached = cache.get(comp);
    if (cached) {
      return cached;
    }
    const raw = comp.props;
    const normalized = {};
    const needCastKeys = [];
    let hasExtends = false;
    if (!isFunction(comp)) {
      const extendProps = (raw2) => {
        hasExtends = true;
        const [props, keys] = normalizePropsOptions(raw2, appContext, true);
        extend(normalized, props);
        if (keys) needCastKeys.push(...keys);
      };
      if (!asMixin && appContext.mixins.length) {
        appContext.mixins.forEach(extendProps);
      }
      if (comp.extends) {
        extendProps(comp.extends);
      }
      if (comp.mixins) {
        comp.mixins.forEach(extendProps);
      }
    }
    if (!raw && !hasExtends) {
      if (isObject(comp)) {
        cache.set(comp, EMPTY_ARR);
      }
      return EMPTY_ARR;
    }
    if (isArray(raw)) {
      for (let i = 0; i < raw.length; i++) {
        if (false) {
          warn$1(`props must be strings when using array syntax.`, raw[i]);
        }
        const normalizedKey = camelize(raw[i]);
        if (validatePropName(normalizedKey)) {
          normalized[normalizedKey] = EMPTY_OBJ;
        }
      }
    } else if (raw) {
      if (false) {
        warn$1(`invalid props options`, raw);
      }
      for (const key in raw) {
        const normalizedKey = camelize(key);
        if (validatePropName(normalizedKey)) {
          const opt = raw[key];
          const prop = normalized[normalizedKey] = isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt);
          const propType = prop.type;
          let shouldCast = false;
          let shouldCastTrue = true;
          if (isArray(propType)) {
            for (let index = 0; index < propType.length; ++index) {
              const type = propType[index];
              const typeName = isFunction(type) && type.name;
              if (typeName === "Boolean") {
                shouldCast = true;
                break;
              } else if (typeName === "String") {
                shouldCastTrue = false;
              }
            }
          } else {
            shouldCast = isFunction(propType) && propType.name === "Boolean";
          }
          prop[
            0
            /* shouldCast */
          ] = shouldCast;
          prop[
            1
            /* shouldCastTrue */
          ] = shouldCastTrue;
          if (shouldCast || hasOwn(prop, "default")) {
            needCastKeys.push(normalizedKey);
          }
        }
      }
    }
    const res = [normalized, needCastKeys];
    if (isObject(comp)) {
      cache.set(comp, res);
    }
    return res;
  }
  function validatePropName(key) {
    if (key[0] !== "$" && !isReservedProp(key)) {
      return true;
    } else if (false) {
      warn$1(`Invalid prop name: "${key}" is a reserved property.`);
    }
    return false;
  }
  var isInternalKey = (key) => key === "_" || key === "_ctx" || key === "$stable";
  var normalizeSlotValue = (value) => isArray(value) ? value.map(normalizeVNode) : [normalizeVNode(value)];
  var normalizeSlot = (key, rawSlot, ctx) => {
    if (rawSlot._n) {
      return rawSlot;
    }
    const normalized = withCtx((...args) => {
      if (false) {
        warn$1(
          `Slot "${key}" invoked outside of the render function: this will not track dependencies used in the slot. Invoke the slot function inside the render function instead.`
        );
      }
      return normalizeSlotValue(rawSlot(...args));
    }, ctx);
    normalized._c = false;
    return normalized;
  };
  var normalizeObjectSlots = (rawSlots, slots, instance) => {
    const ctx = rawSlots._ctx;
    for (const key in rawSlots) {
      if (isInternalKey(key)) continue;
      const value = rawSlots[key];
      if (isFunction(value)) {
        slots[key] = normalizeSlot(key, value, ctx);
      } else if (value != null) {
        if (false) {
          warn$1(
            `Non-function value encountered for slot "${key}". Prefer function slots for better performance.`
          );
        }
        const normalized = normalizeSlotValue(value);
        slots[key] = () => normalized;
      }
    }
  };
  var normalizeVNodeSlots = (instance, children) => {
    if (false) {
      warn$1(
        `Non-function value encountered for default slot. Prefer function slots for better performance.`
      );
    }
    const normalized = normalizeSlotValue(children);
    instance.slots.default = () => normalized;
  };
  var assignSlots = (slots, children, optimized) => {
    for (const key in children) {
      if (optimized || !isInternalKey(key)) {
        slots[key] = children[key];
      }
    }
  };
  var initSlots = (instance, children, optimized) => {
    const slots = instance.slots = createInternalObject();
    if (instance.vnode.shapeFlag & 32) {
      const type = children._;
      if (type) {
        assignSlots(slots, children, optimized);
        if (optimized) {
          def(slots, "_", type, true);
        }
      } else {
        normalizeObjectSlots(children, slots);
      }
    } else if (children) {
      normalizeVNodeSlots(instance, children);
    }
  };
  var updateSlots = (instance, children, optimized) => {
    const { vnode, slots } = instance;
    let needDeletionCheck = true;
    let deletionComparisonTarget = EMPTY_OBJ;
    if (vnode.shapeFlag & 32) {
      const type = children._;
      if (type) {
        if (false) {
          assignSlots(slots, children, optimized);
          trigger(instance, "set", "$slots");
        } else if (optimized && type === 1) {
          needDeletionCheck = false;
        } else {
          assignSlots(slots, children, optimized);
        }
      } else {
        needDeletionCheck = !children.$stable;
        normalizeObjectSlots(children, slots);
      }
      deletionComparisonTarget = children;
    } else if (children) {
      normalizeVNodeSlots(instance, children);
      deletionComparisonTarget = { default: 1 };
    }
    if (needDeletionCheck) {
      for (const key in slots) {
        if (!isInternalKey(key) && deletionComparisonTarget[key] == null) {
          delete slots[key];
        }
      }
    }
  };
  function initFeatureFlags() {
    const needWarn = [];
    if (false) {
      getGlobalThis().__VUE_OPTIONS_API__ = true;
    }
    if (false) {
      getGlobalThis().__VUE_PROD_DEVTOOLS__ = false;
    }
    if (false) {
      getGlobalThis().__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;
    }
    if (false) {
      const multi = needWarn.length > 1;
      console.warn(
        `Feature flag${multi ? `s` : ``} ${needWarn.join(", ")} ${multi ? `are` : `is`} not explicitly defined. You are running the esm-bundler build of Vue, which expects these compile-time feature flags to be globally injected via the bundler config in order to get better tree-shaking in the production bundle.

For more details, see https://link.vuejs.org/feature-flags.`
      );
    }
  }
  var queuePostRenderEffect = queueEffectWithSuspense;
  function createRenderer(options) {
    return baseCreateRenderer(options);
  }
  function createHydrationRenderer(options) {
    return baseCreateRenderer(options, createHydrationFunctions);
  }
  function baseCreateRenderer(options, createHydrationFns) {
    {
      initFeatureFlags();
    }
    const target = getGlobalThis();
    target.__VUE__ = true;
    if (false) {
      setDevtoolsHook$1(target.__VUE_DEVTOOLS_GLOBAL_HOOK__, target);
    }
    const {
      insert: hostInsert,
      remove: hostRemove,
      patchProp: hostPatchProp,
      createElement: hostCreateElement,
      createText: hostCreateText,
      createComment: hostCreateComment,
      setText: hostSetText,
      setElementText: hostSetElementText,
      parentNode: hostParentNode,
      nextSibling: hostNextSibling,
      setScopeId: hostSetScopeId = NOOP,
      insertStaticContent: hostInsertStaticContent
    } = options;
    const patch = (n1, n2, container, anchor = null, parentComponent = null, parentSuspense = null, namespace = void 0, slotScopeIds = null, optimized = false ? false : !!n2.dynamicChildren) => {
      if (n1 === n2) {
        return;
      }
      if (n1 && !isSameVNodeType(n1, n2)) {
        anchor = getNextHostNode(n1);
        unmount(n1, parentComponent, parentSuspense, true);
        n1 = null;
      }
      if (n2.patchFlag === -2) {
        optimized = false;
        n2.dynamicChildren = null;
      }
      if (n2.dynamicChildren && n1 && n1.dynamicChildren && n1.dynamicChildren.hasOnce) {
        if (n2.dynamicChildren === EMPTY_ARR) {
          n2.dynamicChildren = [];
        }
        n2.dynamicChildren.hasOnce = true;
      }
      const { type, ref: ref2, shapeFlag } = n2;
      switch (type) {
        case Text:
          processText(n1, n2, container, anchor);
          break;
        case Comment:
          processCommentNode(n1, n2, container, anchor);
          break;
        case Static:
          if (n1 == null) {
            mountStaticNode(n2, container, anchor, namespace);
          } else if (false) {
            patchStaticNode(n1, n2, container, namespace);
          }
          break;
        case Fragment:
          processFragment(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          break;
        default:
          if (shapeFlag & 1) {
            processElement(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else if (shapeFlag & 6) {
            processComponent(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else if (shapeFlag & 64) {
            type.process(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized,
              internals
            );
          } else if (shapeFlag & 128) {
            type.process(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized,
              internals
            );
          } else if (false) {
            warn$1("Invalid VNode type:", type, `(${typeof type})`);
          }
      }
      if (ref2 != null && parentComponent) {
        setRef(ref2, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
      } else if (ref2 == null && n1 && n1.ref != null) {
        setRef(n1.ref, null, parentSuspense, n1, true);
      }
    };
    const processText = (n1, n2, container, anchor) => {
      if (n1 == null) {
        hostInsert(
          n2.el = hostCreateText(n2.children),
          container,
          anchor
        );
      } else {
        const el = n2.el = n1.el;
        if (n2.children !== n1.children) {
          hostSetText(el, n2.children);
        }
      }
    };
    const processCommentNode = (n1, n2, container, anchor) => {
      if (n1 == null) {
        hostInsert(
          n2.el = hostCreateComment(n2.children || ""),
          container,
          anchor
        );
      } else {
        n2.el = n1.el;
      }
    };
    const mountStaticNode = (n2, container, anchor, namespace) => {
      [n2.el, n2.anchor] = hostInsertStaticContent(
        n2.children,
        container,
        anchor,
        namespace,
        n2.el,
        n2.anchor
      );
    };
    const patchStaticNode = (n1, n2, container, namespace) => {
      if (n2.children !== n1.children) {
        const anchor = hostNextSibling(n1.anchor);
        removeStaticNode(n1);
        [n2.el, n2.anchor] = hostInsertStaticContent(
          n2.children,
          container,
          anchor,
          namespace
        );
      } else {
        n2.el = n1.el;
        n2.anchor = n1.anchor;
      }
    };
    const moveStaticNode = ({ el, anchor }, container, nextSibling) => {
      let next;
      while (el && el !== anchor) {
        next = hostNextSibling(el);
        hostInsert(el, container, nextSibling);
        el = next;
      }
      hostInsert(anchor, container, nextSibling);
    };
    const removeStaticNode = ({ el, anchor }) => {
      let next;
      while (el && el !== anchor) {
        next = hostNextSibling(el);
        hostRemove(el);
        el = next;
      }
      hostRemove(anchor);
    };
    const processElement = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      if (n2.type === "svg") {
        namespace = "svg";
      } else if (n2.type === "math") {
        namespace = "mathml";
      }
      if (n1 == null) {
        mountElement(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } else {
        const customElement = n1.el && n1.el._isVueCE ? n1.el : null;
        try {
          if (customElement) {
            customElement._beginPatch();
          }
          patchElement(
            n1,
            n2,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } finally {
          if (customElement) {
            customElement._endPatch();
          }
        }
      }
    };
    const mountElement = (vnode, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      let el;
      let vnodeHook;
      const { props, shapeFlag, transition, dirs } = vnode;
      el = vnode.el = hostCreateElement(
        vnode.type,
        namespace,
        props && props.is,
        props
      );
      if (shapeFlag & 8) {
        hostSetElementText(el, vnode.children);
      } else if (shapeFlag & 16) {
        mountChildren(
          vnode.children,
          el,
          null,
          parentComponent,
          parentSuspense,
          resolveChildrenNamespace(vnode, namespace),
          slotScopeIds,
          optimized
        );
      }
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, "created");
      }
      setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent);
      if (props) {
        for (const key in props) {
          if (key !== "value" && !isReservedProp(key)) {
            hostPatchProp(el, key, null, props[key], namespace, parentComponent);
          }
        }
        if ("value" in props) {
          hostPatchProp(el, "value", null, props.value, namespace);
        }
        if (vnodeHook = props.onVnodeBeforeMount) {
          invokeVNodeHook(vnodeHook, parentComponent, vnode);
        }
      }
      if (false) {
        def(el, "__vnode", vnode, true);
        def(el, "__vueParentComponent", parentComponent, true);
      }
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
      }
      const needCallTransitionHooks = needTransition(parentSuspense, transition);
      if (needCallTransitionHooks) {
        transition.beforeEnter(el);
      }
      hostInsert(el, container, anchor);
      if ((vnodeHook = props && props.onVnodeMounted) || needCallTransitionHooks || dirs) {
        const isHmr = false;
        queuePostRenderEffect(() => {
          let prev;
          if (false) prev = setHmrUpdating(isHmr);
          try {
            vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
            needCallTransitionHooks && transition.enter(el);
            dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
          } finally {
            if (false) setHmrUpdating(prev);
          }
        }, parentSuspense);
      }
    };
    const setScopeId = (el, vnode, scopeId, slotScopeIds, parentComponent) => {
      if (scopeId) {
        hostSetScopeId(el, scopeId);
      }
      if (slotScopeIds) {
        for (let i = 0; i < slotScopeIds.length; i++) {
          hostSetScopeId(el, slotScopeIds[i]);
        }
      }
      if (parentComponent) {
        let subTree = parentComponent.subTree;
        if (false) {
          subTree = filterSingleRoot(subTree.children) || subTree;
        }
        if (vnode === subTree || isSuspense(subTree.type) && (subTree.ssContent === vnode || subTree.ssFallback === vnode)) {
          const parentVNode = parentComponent.vnode;
          setScopeId(
            el,
            parentVNode,
            parentVNode.scopeId,
            parentVNode.slotScopeIds,
            parentComponent.parent
          );
        }
      }
    };
    const mountChildren = (children, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, start = 0) => {
      for (let i = start; i < children.length; i++) {
        const child = children[i] = optimized ? cloneIfMounted(children[i]) : normalizeVNode(children[i]);
        patch(
          null,
          child,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      }
    };
    const patchElement = (n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      const el = n2.el = n1.el;
      if (false) {
        el.__vnode = n2;
      }
      let { patchFlag, dynamicChildren, dirs } = n2;
      patchFlag |= n1.patchFlag & 16;
      const oldProps = n1.props || EMPTY_OBJ;
      const newProps = n2.props || EMPTY_OBJ;
      let vnodeHook;
      parentComponent && toggleRecurse(parentComponent, false);
      if (vnodeHook = newProps.onVnodeBeforeUpdate) {
        invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
      }
      if (dirs) {
        invokeDirectiveHook(n2, n1, parentComponent, "beforeUpdate");
      }
      parentComponent && toggleRecurse(parentComponent, true);
      if (
        // #6385 the old vnode may be a user-wrapped non-isomorphic block
        // Force full diff when block metadata is unstable.
        dynamicChildren && (!n1.dynamicChildren || n1.dynamicChildren.length !== dynamicChildren.length)
      ) {
        patchFlag = 0;
        optimized = false;
        dynamicChildren = null;
      }
      if (oldProps.innerHTML && newProps.innerHTML == null || oldProps.textContent && newProps.textContent == null) {
        hostSetElementText(el, "");
      }
      if (dynamicChildren) {
        patchBlockChildren(
          n1.dynamicChildren,
          dynamicChildren,
          el,
          parentComponent,
          parentSuspense,
          resolveChildrenNamespace(n2, namespace),
          slotScopeIds
        );
        if (false) {
          traverseStaticChildren(n1, n2);
        }
      } else if (!optimized) {
        patchChildren(
          n1,
          n2,
          el,
          null,
          parentComponent,
          parentSuspense,
          resolveChildrenNamespace(n2, namespace),
          slotScopeIds,
          false
        );
      }
      if (patchFlag > 0) {
        if (patchFlag & 16) {
          patchProps(el, oldProps, newProps, parentComponent, namespace);
        } else {
          if (patchFlag & 2) {
            if (oldProps.class !== newProps.class) {
              hostPatchProp(el, "class", null, newProps.class, namespace);
            }
          }
          if (patchFlag & 4) {
            hostPatchProp(el, "style", oldProps.style, newProps.style, namespace);
          }
          if (patchFlag & 8) {
            const propsToUpdate = n2.dynamicProps;
            for (let i = 0; i < propsToUpdate.length; i++) {
              const key = propsToUpdate[i];
              const prev = oldProps[key];
              const next = newProps[key];
              if (next !== prev || key === "value") {
                hostPatchProp(el, key, prev, next, namespace, parentComponent);
              }
            }
          }
        }
        if (patchFlag & 1) {
          if (n1.children !== n2.children) {
            hostSetElementText(el, n2.children);
          }
        }
      } else if (!optimized && dynamicChildren == null) {
        patchProps(el, oldProps, newProps, parentComponent, namespace);
      }
      if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
        queuePostRenderEffect(() => {
          vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
          dirs && invokeDirectiveHook(n2, n1, parentComponent, "updated");
        }, parentSuspense);
      }
    };
    const patchBlockChildren = (oldChildren, newChildren, fallbackContainer, parentComponent, parentSuspense, namespace, slotScopeIds) => {
      for (let i = 0; i < newChildren.length; i++) {
        const oldVNode = oldChildren[i];
        const newVNode = newChildren[i];
        const oldEl = oldVNode.el || resolveAsyncComponentPlaceholder(oldVNode);
        const container = (
          // oldVNode may be an errored async setup() component inside Suspense
          // which will not have a mounted element
          oldEl && // - In the case of a Fragment, we need to provide the actual parent
          // of the Fragment itself so it can move its children.
          (oldVNode.type === Fragment || // - In the case of different nodes, there is going to be a replacement
          // which also requires the correct parent container
          !isSameVNodeType(oldVNode, newVNode) || // - In the case of a component, it could contain anything.
          oldVNode.shapeFlag & (6 | 64 | 128)) ? hostParentNode(oldEl) : (
            // In other cases, the parent container is not actually used so we
            // just pass the block element here to avoid a DOM parentNode call.
            fallbackContainer
          )
        );
        patch(
          oldVNode,
          newVNode,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          true
        );
      }
    };
    const patchProps = (el, oldProps, newProps, parentComponent, namespace) => {
      if (oldProps !== newProps) {
        if (oldProps !== EMPTY_OBJ) {
          for (const key in oldProps) {
            if (!isReservedProp(key) && !(key in newProps)) {
              hostPatchProp(
                el,
                key,
                oldProps[key],
                null,
                namespace,
                parentComponent
              );
            }
          }
        }
        for (const key in newProps) {
          if (isReservedProp(key)) continue;
          const next = newProps[key];
          const prev = oldProps[key];
          if (next !== prev && key !== "value") {
            hostPatchProp(el, key, prev, next, namespace, parentComponent);
          }
        }
        if ("value" in newProps) {
          hostPatchProp(el, "value", oldProps.value, newProps.value, namespace);
        }
      }
    };
    const processFragment = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      const fragmentStartAnchor = n2.el = n1 ? n1.el : hostCreateText("");
      const fragmentEndAnchor = n2.anchor = n1 ? n1.anchor : hostCreateText("");
      let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2;
      if (false) {
        patchFlag = 0;
        optimized = false;
        dynamicChildren = null;
      }
      if (fragmentSlotScopeIds) {
        slotScopeIds = slotScopeIds ? slotScopeIds.concat(fragmentSlotScopeIds) : fragmentSlotScopeIds;
      }
      if (n1 == null) {
        hostInsert(fragmentStartAnchor, container, anchor);
        hostInsert(fragmentEndAnchor, container, anchor);
        mountChildren(
          // #10007
          // such fragment like `<></>` will be compiled into
          // a fragment which doesn't have a children.
          // In this case fallback to an empty array
          n2.children || [],
          container,
          fragmentEndAnchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } else {
        if (patchFlag > 0 && patchFlag & 64 && dynamicChildren && // #2715 the previous fragment could've been a BAILed one as a result
        // of renderSlot() with no valid children
        n1.dynamicChildren && n1.dynamicChildren.length === dynamicChildren.length) {
          patchBlockChildren(
            n1.dynamicChildren,
            dynamicChildren,
            container,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds
          );
          if (false) {
            traverseStaticChildren(n1, n2);
          } else if (
            // #2080 if the stable fragment has a key, it's a <template v-for> that may
            //  get moved around. Make sure all root level vnodes inherit el.
            // #2134 or if it's a component root, it may also get moved around
            // as the component is being moved.
            n2.key != null || parentComponent && n2 === parentComponent.subTree
          ) {
            traverseStaticChildren(
              n1,
              n2,
              true
              /* shallow */
            );
          }
        } else {
          patchChildren(
            n1,
            n2,
            container,
            fragmentEndAnchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        }
      }
    };
    const processComponent = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      n2.slotScopeIds = slotScopeIds;
      if (n1 == null) {
        if (n2.shapeFlag & 512) {
          parentComponent.ctx.activate(
            n2,
            container,
            anchor,
            namespace,
            optimized
          );
        } else {
          mountComponent(
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            optimized
          );
        }
      } else {
        updateComponent(n1, n2, optimized);
      }
    };
    const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, namespace, optimized) => {
      const instance = initialVNode.component = createComponentInstance(
        initialVNode,
        parentComponent,
        parentSuspense
      );
      if (false) {
        registerHMR(instance);
      }
      if (false) {
        pushWarningContext(initialVNode);
        startMeasure(instance, `mount`);
      }
      if (isKeepAlive(initialVNode)) {
        instance.ctx.renderer = internals;
      }
      {
        if (false) {
          startMeasure(instance, `init`);
        }
        setupComponent(instance, false, optimized);
        if (false) {
          endMeasure(instance, `init`);
        }
      }
      if (false) initialVNode.el = null;
      if (instance.asyncDep) {
        parentSuspense && parentSuspense.registerDep(
          instance,
          setupRenderEffect,
          optimized,
          namespace
        );
        if (!initialVNode.el) {
          const placeholder = instance.subTree = createVNode(Comment);
          processCommentNode(null, placeholder, container, anchor);
          initialVNode.placeholder = placeholder.el;
        }
      } else {
        setupRenderEffect(
          instance,
          initialVNode,
          container,
          anchor,
          parentSuspense,
          namespace,
          optimized
        );
      }
      if (false) {
        popWarningContext();
        endMeasure(instance, `mount`);
      }
    };
    const updateComponent = (n1, n2, optimized) => {
      const instance = n2.component = n1.component;
      if (shouldUpdateComponent(n1, n2, optimized)) {
        if (instance.asyncDep && !instance.asyncResolved) {
          if (false) {
            pushWarningContext(n2);
          }
          n2.el = n1.el;
          n2.placeholder = n1.placeholder;
          updateComponentPreRender(instance, n2, optimized);
          if (false) {
            popWarningContext();
          }
          return;
        } else {
          instance.next = n2;
          instance.update();
        }
      } else {
        n2.el = n1.el;
        n2.placeholder = n1.placeholder;
        instance.vnode = n2;
      }
    };
    const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, namespace, optimized) => {
      const componentUpdateFn = () => {
        if (!instance.isMounted) {
          let vnodeHook;
          const { el, props } = initialVNode;
          const { bm, m, parent, root, type } = instance;
          const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);
          toggleRecurse(instance, false);
          if (bm) {
            invokeArrayFns(bm);
          }
          if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeBeforeMount)) {
            invokeVNodeHook(vnodeHook, parent, initialVNode);
          }
          toggleRecurse(instance, true);
          if (el && hydrateNode) {
            const hydrateSubTree = () => {
              if (false) {
                startMeasure(instance, `render`);
              }
              instance.subTree = renderComponentRoot(instance);
              if (false) {
                endMeasure(instance, `render`);
              }
              if (false) {
                startMeasure(instance, `hydrate`);
              }
              hydrateNode(
                el,
                instance.subTree,
                instance,
                parentSuspense,
                null
              );
              if (false) {
                endMeasure(instance, `hydrate`);
              }
            };
            if (isAsyncWrapperVNode && type.__asyncHydrate) {
              type.__asyncHydrate(
                el,
                instance,
                hydrateSubTree
              );
            } else {
              hydrateSubTree();
            }
          } else {
            if (root.ce && root.ce._hasShadowRoot()) {
              root.ce._injectChildStyle(
                type,
                instance.parent ? instance.parent.type : void 0
              );
            }
            if (false) {
              startMeasure(instance, `render`);
            }
            const subTree = instance.subTree = renderComponentRoot(instance);
            if (false) {
              endMeasure(instance, `render`);
            }
            if (false) {
              startMeasure(instance, `patch`);
            }
            patch(
              null,
              subTree,
              container,
              anchor,
              instance,
              parentSuspense,
              namespace
            );
            if (false) {
              endMeasure(instance, `patch`);
            }
            initialVNode.el = subTree.el;
          }
          if (m) {
            queuePostRenderEffect(m, parentSuspense);
          }
          if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeMounted)) {
            const scopedInitialVNode = initialVNode;
            queuePostRenderEffect(
              () => invokeVNodeHook(vnodeHook, parent, scopedInitialVNode),
              parentSuspense
            );
          }
          if (initialVNode.shapeFlag & 256 || parent && isAsyncWrapper(parent.vnode) && parent.vnode.shapeFlag & 256) {
            instance.a && queuePostRenderEffect(instance.a, parentSuspense);
          }
          instance.isMounted = true;
          if (false) {
            devtoolsComponentAdded(instance);
          }
          initialVNode = container = anchor = null;
        } else {
          let { next, bu, u, parent, vnode } = instance;
          {
            const nonHydratedAsyncRoot = locateNonHydratedAsyncRoot(instance);
            if (nonHydratedAsyncRoot) {
              if (next) {
                next.el = vnode.el;
                updateComponentPreRender(instance, next, optimized);
              }
              nonHydratedAsyncRoot.asyncDep.then(() => {
                queuePostRenderEffect(() => {
                  if (!instance.isUnmounted) update();
                }, parentSuspense);
              });
              return;
            }
          }
          let originNext = next;
          let vnodeHook;
          if (false) {
            pushWarningContext(next || instance.vnode);
          }
          toggleRecurse(instance, false);
          if (next) {
            next.el = vnode.el;
            updateComponentPreRender(instance, next, optimized);
          } else {
            next = vnode;
          }
          if (bu) {
            invokeArrayFns(bu);
          }
          if (vnodeHook = next.props && next.props.onVnodeBeforeUpdate) {
            invokeVNodeHook(vnodeHook, parent, next, vnode);
          }
          toggleRecurse(instance, true);
          if (false) {
            startMeasure(instance, `render`);
          }
          const nextTree = renderComponentRoot(instance);
          if (false) {
            endMeasure(instance, `render`);
          }
          const prevTree = instance.subTree;
          instance.subTree = nextTree;
          if (false) {
            startMeasure(instance, `patch`);
          }
          patch(
            prevTree,
            nextTree,
            // parent may have changed if it's in a teleport
            hostParentNode(prevTree.el),
            // anchor may have changed if it's in a fragment
            getNextHostNode(prevTree),
            instance,
            parentSuspense,
            namespace
          );
          if (false) {
            endMeasure(instance, `patch`);
          }
          next.el = nextTree.el;
          if (originNext === null) {
            updateHOCHostEl(instance, nextTree.el);
          }
          if (u) {
            queuePostRenderEffect(u, parentSuspense);
          }
          if (vnodeHook = next.props && next.props.onVnodeUpdated) {
            queuePostRenderEffect(
              () => invokeVNodeHook(vnodeHook, parent, next, vnode),
              parentSuspense
            );
          }
          if (false) {
            devtoolsComponentUpdated(instance);
          }
          if (false) {
            popWarningContext();
          }
        }
      };
      instance.scope.on();
      const effect2 = instance.effect = new ReactiveEffect(componentUpdateFn);
      instance.scope.off();
      const update = instance.update = effect2.run.bind(effect2);
      const job = instance.job = effect2.runIfDirty.bind(effect2);
      job.i = instance;
      job.id = instance.uid;
      effect2.scheduler = () => queueJob(job);
      toggleRecurse(instance, true);
      if (false) {
        effect2.onTrack = instance.rtc ? (e) => invokeArrayFns(instance.rtc, e) : void 0;
        effect2.onTrigger = instance.rtg ? (e) => invokeArrayFns(instance.rtg, e) : void 0;
      }
      update();
    };
    const updateComponentPreRender = (instance, nextVNode, optimized) => {
      nextVNode.component = instance;
      const prevProps = instance.vnode.props;
      instance.vnode = nextVNode;
      instance.next = null;
      updateProps(instance, nextVNode.props, prevProps, optimized);
      updateSlots(instance, nextVNode.children, optimized);
      pauseTracking();
      flushPreFlushCbs(instance);
      resetTracking();
    };
    const patchChildren = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized = false) => {
      const c1 = n1 && n1.children;
      const prevShapeFlag = n1 ? n1.shapeFlag : 0;
      const c2 = n2.children;
      const { patchFlag, shapeFlag } = n2;
      if (patchFlag > 0) {
        if (patchFlag & 128) {
          patchKeyedChildren(
            c1,
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          return;
        } else if (patchFlag & 256) {
          patchUnkeyedChildren(
            c1,
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          return;
        }
      }
      if (shapeFlag & 8) {
        if (prevShapeFlag & 16) {
          unmountChildren(c1, parentComponent, parentSuspense);
        }
        if (c2 !== c1) {
          hostSetElementText(container, c2);
        }
      } else {
        if (prevShapeFlag & 16) {
          if (shapeFlag & 16) {
            patchKeyedChildren(
              c1,
              c2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else {
            unmountChildren(c1, parentComponent, parentSuspense, true);
          }
        } else {
          if (prevShapeFlag & 8) {
            hostSetElementText(container, "");
          }
          if (shapeFlag & 16) {
            mountChildren(
              c2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          }
        }
      }
    };
    const patchUnkeyedChildren = (c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      c1 = c1 || EMPTY_ARR;
      c2 = c2 || EMPTY_ARR;
      const oldLength = c1.length;
      const newLength = c2.length;
      const commonLength = Math.min(oldLength, newLength);
      let i;
      for (i = 0; i < commonLength; i++) {
        const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
        patch(
          c1[i],
          nextChild,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      }
      if (oldLength > newLength) {
        unmountChildren(
          c1,
          parentComponent,
          parentSuspense,
          true,
          false,
          commonLength
        );
      } else {
        mountChildren(
          c2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized,
          commonLength
        );
      }
    };
    const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      let i = 0;
      const l2 = c2.length;
      let e1 = c1.length - 1;
      let e2 = l2 - 1;
      while (i <= e1 && i <= e2) {
        const n1 = c1[i];
        const n2 = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
        if (isSameVNodeType(n1, n2)) {
          patch(
            n1,
            n2,
            container,
            null,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else {
          break;
        }
        i++;
      }
      while (i <= e1 && i <= e2) {
        const n1 = c1[e1];
        const n2 = c2[e2] = optimized ? cloneIfMounted(c2[e2]) : normalizeVNode(c2[e2]);
        if (isSameVNodeType(n1, n2)) {
          patch(
            n1,
            n2,
            container,
            null,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else {
          break;
        }
        e1--;
        e2--;
      }
      if (i > e1) {
        if (i <= e2) {
          const nextPos = e2 + 1;
          const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
          while (i <= e2) {
            patch(
              null,
              c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]),
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
            i++;
          }
        }
      } else if (i > e2) {
        while (i <= e1) {
          unmount(c1[i], parentComponent, parentSuspense, true);
          i++;
        }
      } else {
        const s1 = i;
        const s2 = i;
        const keyToNewIndexMap = /* @__PURE__ */ new Map();
        for (i = s2; i <= e2; i++) {
          const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
          if (nextChild.key != null) {
            if (false) {
              warn$1(
                `Duplicate keys found during update:`,
                JSON.stringify(nextChild.key),
                `Make sure keys are unique.`
              );
            }
            keyToNewIndexMap.set(nextChild.key, i);
          }
        }
        let j;
        let patched = 0;
        const toBePatched = e2 - s2 + 1;
        let moved = false;
        let maxNewIndexSoFar = 0;
        const newIndexToOldIndexMap = new Array(toBePatched);
        for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
        for (i = s1; i <= e1; i++) {
          const prevChild = c1[i];
          if (patched >= toBePatched) {
            unmount(prevChild, parentComponent, parentSuspense, true);
            continue;
          }
          let newIndex;
          if (prevChild.key != null) {
            newIndex = keyToNewIndexMap.get(prevChild.key);
          } else {
            for (j = s2; j <= e2; j++) {
              if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j])) {
                newIndex = j;
                break;
              }
            }
          }
          if (newIndex === void 0) {
            unmount(prevChild, parentComponent, parentSuspense, true);
          } else {
            newIndexToOldIndexMap[newIndex - s2] = i + 1;
            if (newIndex >= maxNewIndexSoFar) {
              maxNewIndexSoFar = newIndex;
            } else {
              moved = true;
            }
            patch(
              prevChild,
              c2[newIndex],
              container,
              null,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
            patched++;
          }
        }
        const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : EMPTY_ARR;
        j = increasingNewIndexSequence.length - 1;
        for (i = toBePatched - 1; i >= 0; i--) {
          const nextIndex = s2 + i;
          const nextChild = c2[nextIndex];
          const anchorVNode = c2[nextIndex + 1];
          const anchor = nextIndex + 1 < l2 ? (
            // #13559, #14173 fallback to el placeholder for unresolved async component
            anchorVNode.el || resolveAsyncComponentPlaceholder(anchorVNode)
          ) : parentAnchor;
          if (newIndexToOldIndexMap[i] === 0) {
            patch(
              null,
              nextChild,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else if (moved) {
            if (j < 0 || i !== increasingNewIndexSequence[j]) {
              move(nextChild, container, anchor, 2);
            } else {
              j--;
            }
          }
        }
      }
    };
    const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
      const { el, type, transition, children, shapeFlag } = vnode;
      if (shapeFlag & 6) {
        move(vnode.component.subTree, container, anchor, moveType);
        return;
      }
      if (shapeFlag & 128) {
        vnode.suspense.move(container, anchor, moveType);
        return;
      }
      if (shapeFlag & 64) {
        type.move(vnode, container, anchor, internals);
        return;
      }
      if (type === Fragment) {
        hostInsert(el, container, anchor);
        for (let i = 0; i < children.length; i++) {
          move(children[i], container, anchor, moveType);
        }
        hostInsert(vnode.anchor, container, anchor);
        return;
      }
      if (type === Static) {
        moveStaticNode(vnode, container, anchor);
        return;
      }
      const needTransition2 = moveType !== 2 && shapeFlag & 1 && transition;
      if (needTransition2) {
        if (moveType === 0) {
          if (transition.persisted && !el[leaveCbKey]) {
            hostInsert(el, container, anchor);
          } else {
            transition.beforeEnter(el);
            hostInsert(el, container, anchor);
            queuePostRenderEffect(() => transition.enter(el), parentSuspense);
          }
        } else {
          const { leave, delayLeave, afterLeave } = transition;
          const remove22 = () => {
            if (vnode.ctx.isUnmounted) {
              hostRemove(el);
            } else {
              hostInsert(el, container, anchor);
            }
          };
          const performLeave = () => {
            const wasLeaving = el._isLeaving || !!el[leaveCbKey];
            if (el._isLeaving) {
              el[leaveCbKey](
                true
                /* cancelled */
              );
            }
            if (transition.persisted && !wasLeaving) {
              remove22();
            } else {
              leave(el, () => {
                remove22();
                afterLeave && afterLeave();
              });
            }
          };
          if (delayLeave) {
            delayLeave(el, remove22, performLeave);
          } else {
            performLeave();
          }
        }
      } else {
        hostInsert(el, container, anchor);
      }
    };
    const unmount = (vnode, parentComponent, parentSuspense, doRemove = false, optimized = false) => {
      const {
        type,
        props,
        ref: ref2,
        children,
        dynamicChildren,
        shapeFlag,
        patchFlag,
        dirs,
        cacheIndex,
        memo
      } = vnode;
      if (patchFlag === -2 || dynamicChildren && dynamicChildren.hasOnce) {
        optimized = false;
      }
      if (ref2 != null) {
        pauseTracking();
        setRef(ref2, null, parentSuspense, vnode, true);
        resetTracking();
      }
      if (cacheIndex != null && (!vnode.ctx || vnode.ctx === parentComponent)) {
        parentComponent.renderCache[cacheIndex] = void 0;
      }
      if (shapeFlag & 256) {
        parentComponent.ctx.deactivate(vnode);
        return;
      }
      const shouldInvokeDirs = shapeFlag & 1 && dirs;
      const shouldInvokeVnodeHook = !isAsyncWrapper(vnode);
      let vnodeHook;
      if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeBeforeUnmount)) {
        invokeVNodeHook(vnodeHook, parentComponent, vnode);
      }
      if (shapeFlag & 6) {
        unmountComponent(vnode.component, parentSuspense, doRemove);
      } else {
        if (shapeFlag & 128) {
          vnode.suspense.unmount(parentSuspense, doRemove);
          return;
        }
        if (shouldInvokeDirs) {
          invokeDirectiveHook(vnode, null, parentComponent, "beforeUnmount");
        }
        if (shapeFlag & 64) {
          vnode.type.remove(
            vnode,
            parentComponent,
            parentSuspense,
            internals,
            doRemove
          );
        } else if (dynamicChildren && // #5154
        // when v-once is used inside a block, setBlockTracking(-1) marks the
        // parent block with hasOnce: true
        // so that it doesn't take the fast path during unmount - otherwise
        // components nested in v-once are never unmounted.
        !dynamicChildren.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
        (type !== Fragment || patchFlag > 0 && patchFlag & 64)) {
          unmountChildren(
            dynamicChildren,
            parentComponent,
            parentSuspense,
            false,
            true
          );
        } else if (type === Fragment && patchFlag & (128 | 256) || !optimized && shapeFlag & 16) {
          unmountChildren(children, parentComponent, parentSuspense);
        }
        if (doRemove) {
          remove2(vnode);
        }
      }
      const shouldInvalidateMemo = memo != null && cacheIndex == null;
      if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeUnmounted) || shouldInvokeDirs || shouldInvalidateMemo) {
        queuePostRenderEffect(() => {
          vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
          shouldInvokeDirs && invokeDirectiveHook(vnode, null, parentComponent, "unmounted");
          if (shouldInvalidateMemo) {
            vnode.el = null;
          }
        }, parentSuspense);
      }
    };
    const remove2 = (vnode) => {
      const { type, el, anchor, transition } = vnode;
      const isFragment = type === Fragment;
      if (isFragment && !transition) {
        removeFragment(el, anchor);
        return;
      }
      if (type === Static) {
        removeStaticNode(vnode);
        if (transition && !transition.persisted && transition.afterLeave) {
          transition.afterLeave();
        }
        return;
      }
      const leavingNode = isFragment ? getTransitionRoot(vnode) : vnode;
      const performRemove = () => {
        if (isFragment) {
          if (hostParentNode(el)) {
            removeFragment(el, anchor);
          }
        } else {
          hostRemove(el);
        }
        if (transition && !transition.persisted && transition.afterLeave) {
          transition.afterLeave();
        }
      };
      if (leavingNode && leavingNode.shapeFlag & 1 && transition && !transition.persisted) {
        const { leave, delayLeave } = transition;
        const leavingEl = leavingNode.el;
        const performLeave = () => leave(leavingEl, performRemove);
        if (delayLeave) {
          delayLeave(leavingEl, performRemove, performLeave);
        } else {
          performLeave();
        }
      } else {
        performRemove();
      }
    };
    const removeFragment = (cur, end) => {
      let next;
      while (cur !== end) {
        next = hostNextSibling(cur);
        hostRemove(cur);
        cur = next;
      }
      hostRemove(end);
    };
    const unmountComponent = (instance, parentSuspense, doRemove) => {
      if (false) {
        unregisterHMR(instance);
      }
      const { bum, scope, job, subTree, um, m, a } = instance;
      invalidateMount(m);
      invalidateMount(a);
      if (bum) {
        invokeArrayFns(bum);
      }
      scope.stop();
      if (job) {
        job.flags |= 8;
        unmount(subTree, instance, parentSuspense, doRemove);
      } else if (instance.vnode.el && subTree) {
        subTree.transition = instance.vnode.transition;
        unmount(subTree, instance, parentSuspense, doRemove);
      }
      if (um) {
        queuePostRenderEffect(um, parentSuspense);
      }
      queuePostRenderEffect(() => {
        instance.isUnmounted = true;
      }, parentSuspense);
      if (false) {
        devtoolsComponentRemoved(instance);
      }
    };
    const unmountChildren = (children, parentComponent, parentSuspense, doRemove = false, optimized = false, start = 0) => {
      for (let i = start; i < children.length; i++) {
        unmount(children[i], parentComponent, parentSuspense, doRemove, optimized);
      }
    };
    const getNextHostNode = (vnode) => {
      if (vnode.shapeFlag & 6) {
        return getNextHostNode(vnode.component.subTree);
      }
      if (vnode.shapeFlag & 128) {
        return vnode.suspense.next();
      }
      const el = hostNextSibling(vnode.anchor || vnode.el);
      const teleportEnd = el && el[TeleportEndKey];
      return teleportEnd ? hostNextSibling(teleportEnd) : el;
    };
    const render2 = (vnode, container, namespace) => {
      const minUid = vnode && container._vnode ? void 0 : vnode && vnode.component ? vnode.component.uid : getNextUid();
      flushOnAppMount(() => {
        if (vnode == null) {
          if (container._vnode) {
            unmount(container._vnode, null, null, true);
          }
        } else {
          patch(
            container._vnode || null,
            vnode,
            container,
            null,
            null,
            null,
            namespace
          );
        }
        container._vnode = vnode;
      }, minUid);
    };
    const internals = {
      p: patch,
      um: unmount,
      m: move,
      r: remove2,
      mt: mountComponent,
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      n: getNextHostNode,
      o: options
    };
    let hydrate2;
    let hydrateNode;
    if (createHydrationFns) {
      [hydrate2, hydrateNode] = createHydrationFns(
        internals
      );
    }
    return {
      render: render2,
      hydrate: hydrate2,
      createApp: createAppAPI(render2, hydrate2)
    };
  }
  function resolveChildrenNamespace({ type, props }, currentNamespace) {
    return currentNamespace === "svg" && type === "foreignObject" || currentNamespace === "mathml" && type === "annotation-xml" && props && props.encoding && props.encoding.includes("html") ? void 0 : currentNamespace;
  }
  function toggleRecurse({ effect: effect2, job }, allowed) {
    if (allowed) {
      effect2.flags |= 32;
      job.flags |= 4;
    } else {
      effect2.flags &= -33;
      job.flags &= -5;
    }
  }
  function needTransition(parentSuspense, transition) {
    return (!parentSuspense || parentSuspense && !parentSuspense.pendingBranch) && transition && !transition.persisted;
  }
  function traverseStaticChildren(n1, n2, shallow = false) {
    const ch1 = n1.children;
    const ch2 = n2.children;
    if (isArray(ch1) && isArray(ch2)) {
      for (let i = 0; i < ch1.length; i++) {
        const c1 = ch1[i];
        let c2 = ch2[i];
        if (c2.shapeFlag & 1 && !c2.dynamicChildren) {
          if (c2.patchFlag <= 0 || c2.patchFlag === 32) {
            c2 = ch2[i] = cloneIfMounted(ch2[i]);
            c2.el = c1.el;
          }
          if (!shallow && c2.patchFlag !== -2)
            traverseStaticChildren(c1, c2);
        }
        if (c2.type === Text) {
          if (c2.patchFlag === -1) {
            c2 = ch2[i] = cloneIfMounted(c2);
          }
          c2.el = c1.el;
        }
        if (c2.type === Comment && !c2.el) {
          c2.el = c1.el;
        }
        if (false) {
          c2.el && (c2.el.__vnode = c2);
        }
      }
    }
  }
  function getSequence(arr) {
    const p2 = arr.slice();
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;
    for (i = 0; i < len; i++) {
      const arrI = arr[i];
      if (arrI !== 0) {
        j = result[result.length - 1];
        if (arr[j] < arrI) {
          p2[i] = j;
          result.push(i);
          continue;
        }
        u = 0;
        v = result.length - 1;
        while (u < v) {
          c = u + v >> 1;
          if (arr[result[c]] < arrI) {
            u = c + 1;
          } else {
            v = c;
          }
        }
        if (arrI < arr[result[u]]) {
          if (u > 0) {
            p2[i] = result[u - 1];
          }
          result[u] = i;
        }
      }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
      result[u] = v;
      v = p2[v];
    }
    return result;
  }
  function locateNonHydratedAsyncRoot(instance) {
    const subComponent = instance.subTree.component;
    if (subComponent) {
      if (subComponent.asyncDep && !subComponent.asyncResolved) {
        return subComponent;
      } else {
        return locateNonHydratedAsyncRoot(subComponent);
      }
    }
  }
  function invalidateMount(hooks) {
    if (hooks) {
      for (let i = 0; i < hooks.length; i++)
        hooks[i].flags |= 8;
    }
  }
  function resolveAsyncComponentPlaceholder(anchorVnode) {
    if (anchorVnode.placeholder) {
      return anchorVnode.placeholder;
    }
    const instance = anchorVnode.component;
    if (instance) {
      return resolveAsyncComponentPlaceholder(instance.subTree);
    }
    return null;
  }
  var isSuspense = (type) => type.__isSuspense;
  var suspenseId = 0;
  var SuspenseImpl = {
    name: "Suspense",
    // In order to make Suspense tree-shakable, we need to avoid importing it
    // directly in the renderer. The renderer checks for the __isSuspense flag
    // on a vnode's type and calls the `process` method, passing in renderer
    // internals.
    __isSuspense: true,
    process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, rendererInternals) {
      if (n1 == null) {
        mountSuspense(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized,
          rendererInternals
        );
      } else {
        if (parentSuspense && parentSuspense.deps > 0 && !n1.suspense.isInFallback && !parentSuspense.isHydrating) {
          n2.suspense = n1.suspense;
          n2.suspense.vnode = n2;
          n2.el = n1.el;
          return;
        }
        patchSuspense(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          namespace,
          slotScopeIds,
          optimized,
          rendererInternals
        );
      }
    },
    hydrate: hydrateSuspense,
    normalize: normalizeSuspenseChildren
  };
  var Suspense = SuspenseImpl;
  function triggerEvent(vnode, name) {
    const eventListener = vnode.props && vnode.props[name];
    if (isFunction(eventListener)) {
      eventListener();
    }
  }
  function mountSuspense(vnode, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, rendererInternals) {
    const {
      p: patch,
      o: { createElement }
    } = rendererInternals;
    const hiddenContainer = createElement("div");
    const suspense = vnode.suspense = createSuspenseBoundary(
      vnode,
      parentSuspense,
      parentComponent,
      container,
      hiddenContainer,
      anchor,
      namespace,
      slotScopeIds,
      optimized,
      rendererInternals
    );
    patch(
      null,
      suspense.pendingBranch = vnode.ssContent,
      hiddenContainer,
      null,
      parentComponent,
      suspense,
      namespace,
      slotScopeIds
    );
    if (suspense.deps > 0) {
      triggerEvent(vnode, "onPending");
      triggerEvent(vnode, "onFallback");
      patch(
        null,
        vnode.ssFallback,
        container,
        anchor,
        parentComponent,
        null,
        // fallback tree will not have suspense context
        namespace,
        slotScopeIds
      );
      setActiveBranch(suspense, vnode.ssFallback);
    } else {
      suspense.resolve(false, true);
    }
  }
  function patchSuspense(n1, n2, container, anchor, parentComponent, namespace, slotScopeIds, optimized, { p: patch, um: unmount, o: { createElement } }) {
    const suspense = n2.suspense = n1.suspense;
    suspense.vnode = n2;
    n2.el = n1.el;
    const newBranch = n2.ssContent;
    const newFallback = n2.ssFallback;
    const { activeBranch, pendingBranch, isInFallback, isHydrating } = suspense;
    if (pendingBranch) {
      suspense.pendingBranch = newBranch;
      if (isSameVNodeType(pendingBranch, newBranch)) {
        suspense.deps++;
        patch(
          pendingBranch,
          newBranch,
          // a hydrating pending branch is adopted SSR DOM, already in place
          isHydrating ? container : suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized
        );
        suspense.deps--;
        if (suspense.deps <= 0) {
          suspense.resolve();
        } else if (isInFallback) {
          if (!isHydrating && !suspense.isFallbackMountPending) {
            patch(
              activeBranch,
              newFallback,
              container,
              anchor,
              parentComponent,
              null,
              // fallback tree will not have suspense context
              namespace,
              slotScopeIds,
              optimized
            );
            setActiveBranch(suspense, newFallback);
          }
        }
      } else {
        suspense.pendingId = suspenseId++;
        if (isHydrating) {
          suspense.isHydrating = false;
          suspense.activeBranch = pendingBranch;
        } else {
          unmount(pendingBranch, parentComponent, suspense);
        }
        suspense.deps = 0;
        suspense.effects.length = 0;
        suspense.hiddenContainer = createElement("div");
        if (isInFallback) {
          patch(
            null,
            newBranch,
            suspense.hiddenContainer,
            null,
            parentComponent,
            suspense,
            namespace,
            slotScopeIds,
            optimized
          );
          if (suspense.deps <= 0) {
            suspense.resolve();
          } else if (!suspense.isFallbackMountPending) {
            patch(
              activeBranch,
              newFallback,
              container,
              anchor,
              parentComponent,
              null,
              // fallback tree will not have suspense context
              namespace,
              slotScopeIds,
              optimized
            );
            setActiveBranch(suspense, newFallback);
          }
        } else if (activeBranch && isSameVNodeType(activeBranch, newBranch)) {
          patch(
            activeBranch,
            newBranch,
            container,
            anchor,
            parentComponent,
            suspense,
            namespace,
            slotScopeIds,
            optimized
          );
          suspense.resolve(true);
        } else {
          patch(
            null,
            newBranch,
            suspense.hiddenContainer,
            null,
            parentComponent,
            suspense,
            namespace,
            slotScopeIds,
            optimized
          );
          if (suspense.deps <= 0) {
            suspense.resolve();
          }
        }
      }
    } else {
      if (activeBranch && isSameVNodeType(activeBranch, newBranch)) {
        patch(
          activeBranch,
          newBranch,
          container,
          anchor,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized
        );
        setActiveBranch(suspense, newBranch);
      } else {
        triggerEvent(n2, "onPending");
        suspense.pendingBranch = newBranch;
        if (newBranch.shapeFlag & 512) {
          suspense.pendingId = newBranch.component.suspenseId;
        } else {
          suspense.pendingId = suspenseId++;
        }
        patch(
          null,
          newBranch,
          suspense.hiddenContainer,
          null,
          parentComponent,
          suspense,
          namespace,
          slotScopeIds,
          optimized
        );
        if (suspense.deps <= 0) {
          suspense.resolve();
        } else {
          const { timeout, pendingId } = suspense;
          if (timeout > 0) {
            setTimeout(() => {
              if (suspense.pendingId === pendingId) {
                suspense.fallback(newFallback);
              }
            }, timeout);
          } else if (timeout === 0) {
            suspense.fallback(newFallback);
          }
        }
      }
    }
  }
  function createSuspenseBoundary(vnode, parentSuspense, parentComponent, container, hiddenContainer, anchor, namespace, slotScopeIds, optimized, rendererInternals, isHydrating = false) {
    if (false) {
      hasWarned = true;
      console[console.info ? "info" : "log"](
        `<Suspense> is an experimental feature and its API will likely change.`
      );
    }
    const {
      p: patch,
      m: move,
      um: unmount,
      n: next,
      o: { parentNode, remove: remove2 }
    } = rendererInternals;
    let parentSuspenseId;
    const isSuspensible = isVNodeSuspensible(vnode);
    if (isSuspensible) {
      if (parentSuspense && parentSuspense.pendingBranch) {
        parentSuspenseId = parentSuspense.pendingId;
        parentSuspense.deps++;
      }
    }
    const timeout = vnode.props ? toNumber(vnode.props.timeout) : void 0;
    if (false) {
      assertNumber(timeout, `Suspense timeout`);
    }
    const initialAnchor = anchor;
    const suspense = {
      vnode,
      parent: parentSuspense,
      parentComponent,
      namespace,
      container,
      hiddenContainer,
      deps: 0,
      pendingId: suspenseId++,
      timeout: typeof timeout === "number" ? timeout : -1,
      activeBranch: null,
      isFallbackMountPending: false,
      pendingBranch: null,
      isInFallback: !isHydrating,
      isHydrating,
      isUnmounted: false,
      effects: [],
      resolve(resume = false, sync = false) {
        if (false) {
          if (!resume && !suspense.pendingBranch) {
            throw new Error(
              `suspense.resolve() is called without a pending branch.`
            );
          }
          if (suspense.isUnmounted) {
            throw new Error(
              `suspense.resolve() is called on an already unmounted suspense boundary.`
            );
          }
        }
        const {
          vnode: vnode2,
          activeBranch,
          pendingBranch,
          pendingId,
          effects,
          parentComponent: parentComponent2,
          container: container2,
          isInFallback
        } = suspense;
        let delayEnter = false;
        if (suspense.isHydrating) {
          suspense.isHydrating = false;
        } else if (!resume) {
          delayEnter = activeBranch && pendingBranch.transition && pendingBranch.transition.mode === "out-in";
          let hasUpdatedAnchor = false;
          if (delayEnter) {
            activeBranch.transition.afterLeave = () => {
              if (pendingId === suspense.pendingId) {
                move(
                  pendingBranch,
                  container2,
                  anchor === initialAnchor && !hasUpdatedAnchor ? next(activeBranch) : anchor,
                  0
                );
                queuePostFlushCb(effects);
                if (isInFallback && vnode2.ssFallback) {
                  vnode2.ssFallback.el = null;
                }
              }
            };
          }
          if (activeBranch && !suspense.isFallbackMountPending) {
            if (parentNode(activeBranch.el) === container2) {
              anchor = next(activeBranch);
              hasUpdatedAnchor = true;
            }
            unmount(activeBranch, parentComponent2, suspense, true);
            if (!delayEnter && isInFallback && vnode2.ssFallback) {
              queuePostRenderEffect(() => vnode2.ssFallback.el = null, suspense);
            }
          }
          if (!delayEnter) {
            move(pendingBranch, container2, anchor, 0);
          }
        }
        suspense.isFallbackMountPending = false;
        setActiveBranch(suspense, pendingBranch);
        suspense.pendingBranch = null;
        suspense.isInFallback = false;
        let parent = suspense.parent;
        let hasUnresolvedAncestor = false;
        while (parent) {
          if (parent.pendingBranch) {
            for (let i = 0; i < effects.length; i++) {
              parent.effects.push(effects[i]);
            }
            hasUnresolvedAncestor = true;
            break;
          }
          parent = parent.parent;
        }
        if (!hasUnresolvedAncestor && !delayEnter) {
          queuePostFlushCb(effects);
        }
        suspense.effects = [];
        if (isSuspensible) {
          if (parentSuspense && parentSuspense.pendingBranch && parentSuspenseId === parentSuspense.pendingId) {
            parentSuspenseId = void 0;
            parentSuspense.deps--;
            if (parentSuspense.deps === 0 && !sync) {
              parentSuspense.resolve();
            }
          }
        }
        triggerEvent(vnode2, "onResolve");
      },
      fallback(fallbackVNode) {
        if (!suspense.pendingBranch) {
          return;
        }
        const { vnode: vnode2, activeBranch, parentComponent: parentComponent2, container: container2, namespace: namespace2 } = suspense;
        triggerEvent(vnode2, "onFallback");
        const anchor2 = next(activeBranch);
        const mountFallback = () => {
          suspense.isFallbackMountPending = false;
          if (!suspense.isInFallback) {
            return;
          }
          const latestFallback = suspense.vnode.ssFallback;
          patch(
            null,
            latestFallback,
            container2,
            anchor2,
            parentComponent2,
            null,
            // fallback tree will not have suspense context
            namespace2,
            slotScopeIds,
            optimized
          );
          setActiveBranch(suspense, latestFallback);
        };
        const delayEnter = fallbackVNode.transition && fallbackVNode.transition.mode === "out-in";
        if (delayEnter) {
          suspense.isFallbackMountPending = true;
          activeBranch.transition.afterLeave = mountFallback;
        }
        suspense.isInFallback = true;
        unmount(
          activeBranch,
          parentComponent2,
          null,
          // no suspense so unmount hooks fire now
          true
          // shouldRemove
        );
        if (!delayEnter) {
          mountFallback();
        }
      },
      move(container2, anchor2, type) {
        suspense.activeBranch && move(suspense.activeBranch, container2, anchor2, type);
        suspense.container = container2;
      },
      next() {
        return suspense.activeBranch && next(suspense.activeBranch);
      },
      // `namespace` intentionally shadows the boundary's own: the dep must be
      // mounted with the namespace of the position it was rendered at, which can
      // differ from the boundary's (e.g. a component nested inside an <svg>).
      registerDep(instance, setupRenderEffect, optimized2, namespace2) {
        const isInPendingSuspense = !!suspense.pendingBranch;
        if (isInPendingSuspense) {
          suspense.deps++;
        }
        const hydratedEl = instance.vnode.el;
        instance.asyncDep.catch((err) => {
          handleError(err, instance, 0);
        }).then((asyncSetupResult) => {
          if (instance.isUnmounted || suspense.isUnmounted || suspense.pendingId !== instance.suspenseId) {
            return;
          }
          unsetCurrentInstance();
          if (!instance.scope.active) {
            if (isInPendingSuspense && --suspense.deps === 0) {
              suspense.resolve();
            }
            return;
          }
          instance.asyncResolved = true;
          const { vnode: vnode2 } = instance;
          if (false) {
            pushWarningContext(vnode2);
          }
          handleSetupResult(instance, asyncSetupResult, false);
          if (hydratedEl) {
            vnode2.el = hydratedEl;
          }
          const placeholder = !hydratedEl && instance.subTree.el;
          setupRenderEffect(
            instance,
            vnode2,
            // component may have been moved before resolve.
            // if this is not a hydration, instance.subTree will be the comment
            // placeholder.
            parentNode(hydratedEl || instance.subTree.el),
            // anchor will not be used if this is hydration, so only need to
            // consider the comment placeholder case.
            hydratedEl ? null : next(instance.subTree),
            suspense,
            namespace2,
            optimized2
          );
          if (placeholder) {
            vnode2.placeholder = null;
            remove2(placeholder);
          }
          updateHOCHostEl(instance, vnode2.el);
          if (false) {
            popWarningContext();
          }
          if (isInPendingSuspense && --suspense.deps === 0) {
            suspense.resolve();
          }
        });
      },
      unmount(parentSuspense2, doRemove) {
        suspense.isUnmounted = true;
        if (suspense.activeBranch) {
          unmount(
            suspense.activeBranch,
            parentComponent,
            parentSuspense2,
            doRemove
          );
        }
        if (suspense.pendingBranch) {
          unmount(
            suspense.pendingBranch,
            parentComponent,
            parentSuspense2,
            doRemove
          );
        }
      }
    };
    return suspense;
  }
  function hydrateSuspense(node, vnode, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, rendererInternals, hydrateNode) {
    const suspense = vnode.suspense = createSuspenseBoundary(
      vnode,
      parentSuspense,
      parentComponent,
      node.parentNode,
      // eslint-disable-next-line no-restricted-globals
      document.createElement("div"),
      null,
      namespace,
      slotScopeIds,
      optimized,
      rendererInternals,
      true
    );
    const result = hydrateNode(
      node,
      suspense.pendingBranch = vnode.ssContent,
      parentComponent,
      suspense,
      slotScopeIds,
      optimized
    );
    if (suspense.deps === 0) {
      suspense.resolve(false, true);
    }
    return result;
  }
  function normalizeSuspenseChildren(vnode) {
    const { shapeFlag, children } = vnode;
    const isSlotChildren = shapeFlag & 32;
    vnode.ssContent = normalizeSuspenseSlot(
      isSlotChildren ? children.default : children
    );
    vnode.ssFallback = isSlotChildren ? normalizeSuspenseSlot(children.fallback) : createVNode(Comment);
  }
  function normalizeSuspenseSlot(s) {
    let block;
    if (isFunction(s)) {
      const trackBlock = isBlockTreeEnabled && s._c;
      if (trackBlock) {
        s._d = false;
        openBlock();
      }
      s = s();
      if (trackBlock) {
        s._d = true;
        block = currentBlock;
        closeBlock();
      }
    }
    if (isArray(s)) {
      const singleChild = filterSingleRoot(s);
      if (false) {
        warn$1(`<Suspense> slots expect a single root node.`);
      }
      s = singleChild;
    }
    s = normalizeVNode(s);
    if (block && !s.dynamicChildren) {
      s.dynamicChildren = block.filter((c) => c !== s);
    }
    return s;
  }
  function queueEffectWithSuspense(fn, suspense) {
    if (suspense && suspense.pendingBranch) {
      if (isArray(fn)) {
        suspense.effects.push(...fn);
      } else {
        suspense.effects.push(fn);
      }
    } else {
      queuePostFlushCb(fn);
    }
  }
  function setActiveBranch(suspense, branch) {
    suspense.activeBranch = branch;
    const { vnode, parentComponent } = suspense;
    let el = branch.el;
    while (!el && branch.component) {
      branch = branch.component.subTree;
      el = branch.el;
    }
    vnode.el = el;
    if (parentComponent && parentComponent.subTree === vnode) {
      parentComponent.vnode.el = el;
      updateHOCHostEl(parentComponent, el);
    }
  }
  function isVNodeSuspensible(vnode) {
    const suspensible = vnode.props && vnode.props.suspensible;
    return suspensible != null && suspensible !== false;
  }
  var Fragment = /* @__PURE__ */ Symbol.for("v-fgt");
  var Text = /* @__PURE__ */ Symbol.for("v-txt");
  var Comment = /* @__PURE__ */ Symbol.for("v-cmt");
  var Static = /* @__PURE__ */ Symbol.for("v-stc");
  var blockStack = [];
  var currentBlock = null;
  function openBlock(disableTracking = false) {
    blockStack.push(currentBlock = disableTracking ? null : []);
  }
  function closeBlock() {
    blockStack.pop();
    currentBlock = blockStack[blockStack.length - 1] || null;
  }
  var isBlockTreeEnabled = 1;
  function setBlockTracking(value, inVOnce = false) {
    isBlockTreeEnabled += value;
    if (value < 0 && currentBlock && inVOnce) {
      currentBlock.hasOnce = true;
    }
  }
  function setupBlock(vnode) {
    vnode.dynamicChildren = isBlockTreeEnabled > 0 ? currentBlock || EMPTY_ARR : null;
    closeBlock();
    if (isBlockTreeEnabled > 0 && currentBlock) {
      currentBlock.push(vnode);
    }
    return vnode;
  }
  function createElementBlock(type, props, children, patchFlag, dynamicProps, shapeFlag) {
    return setupBlock(
      createBaseVNode(
        type,
        props,
        children,
        patchFlag,
        dynamicProps,
        shapeFlag,
        true
      )
    );
  }
  function createBlock(type, props, children, patchFlag, dynamicProps) {
    return setupBlock(
      createVNode(
        type,
        props,
        children,
        patchFlag,
        dynamicProps,
        true
      )
    );
  }
  function isVNode(value) {
    return value ? value.__v_isVNode === true : false;
  }
  function isSameVNodeType(n1, n2) {
    if (false) {
      const dirtyInstances = hmrDirtyComponents.get(n2.type);
      if (dirtyInstances && dirtyInstances.has(n1.component)) {
        n1.shapeFlag &= -257;
        n2.shapeFlag &= -513;
        return false;
      }
    }
    return n1.type === n2.type && n1.key === n2.key;
  }
  var vnodeArgsTransformer;
  function transformVNodeArgs(transformer) {
    vnodeArgsTransformer = transformer;
  }
  var normalizeKey = ({ key }) => key != null ? key : null;
  var normalizeRef = ({
    ref: ref2,
    ref_key,
    ref_for
  }) => {
    if (typeof ref2 === "number") {
      ref2 = "" + ref2;
    }
    return ref2 != null ? isString(ref2) || isRef2(ref2) || isFunction(ref2) ? { i: currentRenderingInstance, r: ref2, k: ref_key, f: !!ref_for } : ref2 : null;
  };
  function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1, isBlockNode = false, needFullChildrenNormalization = false) {
    const vnode = {
      __v_isVNode: true,
      __v_skip: true,
      type,
      props,
      key: props && normalizeKey(props),
      ref: props && normalizeRef(props),
      scopeId: currentScopeId,
      slotScopeIds: null,
      children,
      component: null,
      suspense: null,
      ssContent: null,
      ssFallback: null,
      dirs: null,
      transition: null,
      el: null,
      anchor: null,
      target: null,
      targetStart: null,
      targetAnchor: null,
      staticCount: 0,
      shapeFlag,
      patchFlag,
      dynamicProps,
      dynamicChildren: null,
      appContext: null,
      ctx: currentRenderingInstance
    };
    if (needFullChildrenNormalization) {
      normalizeChildren(vnode, children);
      if (shapeFlag & 128) {
        type.normalize(vnode);
      }
    } else if (children) {
      vnode.shapeFlag |= isString(children) ? 8 : 16;
    }
    if (false) {
      warn$1(`VNode created with invalid key (NaN). VNode type:`, vnode.type);
    }
    if (false) {
      const overwritingProp = props.innerHTML != null ? "innerHTML" : props.textContent != null ? "textContent" : null;
      if (overwritingProp && hasContentChildren(vnode.children)) {
        warn$1(
          `The \`${overwritingProp}\` prop on <${vnode.type}> will override its children. Remove either the \`${overwritingProp}\` prop or the children.`
        );
      }
    }
    if (isBlockTreeEnabled > 0 && // avoid a block node from tracking itself
    !isBlockNode && // has current parent block
    currentBlock && // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    (vnode.patchFlag > 0 || shapeFlag & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
    // vnode should not be considered dynamic due to handler caching.
    vnode.patchFlag !== 32) {
      currentBlock.push(vnode);
    }
    return vnode;
  }
  var createVNode = false ? createVNodeWithArgsTransform : _createVNode;
  function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
    if (!type || type === NULL_DYNAMIC_COMPONENT) {
      if (false) {
        warn$1(`Invalid vnode type when creating vnode: ${type}.`);
      }
      type = Comment;
    }
    if (isVNode(type)) {
      const cloned = cloneVNode(
        type,
        props,
        true
        /* mergeRef: true */
      );
      if (children) {
        normalizeChildren(cloned, children);
      }
      if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
        if (cloned.shapeFlag & 6) {
          currentBlock[currentBlock.indexOf(type)] = cloned;
        } else {
          currentBlock.push(cloned);
        }
      }
      cloned.patchFlag = -2;
      return cloned;
    }
    if (isClassComponent(type)) {
      type = type.__vccOpts;
    }
    if (props) {
      props = guardReactiveProps(props);
      let { class: klass, style } = props;
      if (klass && !isString(klass)) {
        props.class = normalizeClass(klass);
      }
      if (isObject(style)) {
        if (isProxy(style) && !isArray(style)) {
          style = extend({}, style);
        }
        props.style = normalizeStyle(style);
      }
    }
    const shapeFlag = isString(type) ? 1 : isSuspense(type) ? 128 : isTeleport(type) ? 64 : isObject(type) ? 4 : isFunction(type) ? 2 : 0;
    if (false) {
      type = toRaw(type);
      warn$1(
        `Vue received a Component that was made a reactive object. This can lead to unnecessary performance overhead and should be avoided by marking the component with \`markRaw\` or using \`shallowRef\` instead of \`ref\`.`,
        `
Component that was made reactive: `,
        type
      );
    }
    return createBaseVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      shapeFlag,
      isBlockNode,
      true
    );
  }
  function guardReactiveProps(props) {
    if (!props) return null;
    return isProxy(props) || isInternalObject(props) ? extend({}, props) : props;
  }
  function cloneVNode(vnode, extraProps, mergeRef = false, cloneTransition = false) {
    const { props, ref: ref2, patchFlag, children, transition } = vnode;
    const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
    const cloned = {
      __v_isVNode: true,
      __v_skip: true,
      type: vnode.type,
      props: mergedProps,
      key: mergedProps && normalizeKey(mergedProps),
      ref: extraProps && extraProps.ref ? (
        // #2078 in the case of <component :is="vnode" ref="extra"/>
        // if the vnode itself already has a ref, cloneVNode will need to merge
        // the refs so the single vnode can be set on multiple refs
        mergeRef && ref2 ? isArray(ref2) ? ref2.concat(normalizeRef(extraProps)) : [ref2, normalizeRef(extraProps)] : normalizeRef(extraProps)
      ) : ref2,
      scopeId: vnode.scopeId,
      slotScopeIds: vnode.slotScopeIds,
      children: false ? children.map(deepCloneVNode) : children,
      target: vnode.target,
      targetStart: vnode.targetStart,
      targetAnchor: vnode.targetAnchor,
      staticCount: vnode.staticCount,
      shapeFlag: vnode.shapeFlag,
      // if the vnode is cloned with extra props, we can no longer assume its
      // existing patch flag to be reliable and need to add the FULL_PROPS flag.
      // note: preserve flag for fragments since they use the flag for children
      // fast paths only.
      patchFlag: extraProps && vnode.type !== Fragment ? patchFlag === -1 ? 16 : patchFlag | 16 : patchFlag,
      dynamicProps: vnode.dynamicProps,
      dynamicChildren: vnode.dynamicChildren,
      appContext: vnode.appContext,
      dirs: vnode.dirs,
      transition,
      // These should technically only be non-null on mounted VNodes. However,
      // they *should* be copied for kept-alive vnodes. So we just always copy
      // them since them being non-null during a mount doesn't affect the logic as
      // they will simply be overwritten.
      component: vnode.component,
      suspense: vnode.suspense,
      ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
      ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
      placeholder: vnode.placeholder,
      el: vnode.el,
      anchor: vnode.anchor,
      ctx: vnode.ctx,
      ce: vnode.ce,
      cacheIndex: vnode.cacheIndex
    };
    if (transition && cloneTransition) {
      setTransitionHooks(
        cloned,
        transition.clone(cloned)
      );
    }
    return cloned;
  }
  function createTextVNode(text = " ", flag = 0) {
    return createVNode(Text, null, text, flag);
  }
  function createStaticVNode(content, numberOfNodes) {
    const vnode = createVNode(Static, null, content);
    vnode.staticCount = numberOfNodes;
    return vnode;
  }
  function createCommentVNode(text = "", asBlock = false) {
    return asBlock ? (openBlock(), createBlock(Comment, null, text)) : createVNode(Comment, null, text);
  }
  function normalizeVNode(child) {
    if (child == null || typeof child === "boolean") {
      return createVNode(Comment);
    } else if (isArray(child)) {
      return createVNode(
        Fragment,
        null,
        // #3666, avoid reference pollution when reusing vnode
        child.slice()
      );
    } else if (isVNode(child)) {
      return cloneIfMounted(child);
    } else {
      return createVNode(Text, null, String(child));
    }
  }
  function cloneIfMounted(child) {
    return child.el === null && child.patchFlag !== -1 || child.memo ? child : cloneVNode(child);
  }
  function normalizeChildren(vnode, children) {
    let type = 0;
    const { shapeFlag } = vnode;
    if (children == null) {
      children = null;
    } else if (isArray(children)) {
      type = 16;
    } else if (typeof children === "object") {
      if (shapeFlag & (1 | 64)) {
        const slot = children.default;
        if (slot) {
          slot._c && (slot._d = false);
          normalizeChildren(vnode, slot());
          slot._c && (slot._d = true);
        }
        return;
      } else {
        type = 32;
        const slotFlag = children._;
        if (!slotFlag && !isInternalObject(children)) {
          children._ctx = currentRenderingInstance;
        } else if (slotFlag === 3 && currentRenderingInstance) {
          if (currentRenderingInstance.slots._ === 1) {
            children._ = 1;
          } else {
            children._ = 2;
            vnode.patchFlag |= 1024;
          }
        }
      }
    } else if (isFunction(children)) {
      if (shapeFlag & (1 | 64)) {
        normalizeChildren(vnode, { default: children });
        return;
      }
      children = { default: children, _ctx: currentRenderingInstance };
      type = 32;
    } else {
      children = String(children);
      if (shapeFlag & 64) {
        type = 16;
        children = [createTextVNode(children)];
      } else {
        type = 8;
      }
    }
    vnode.children = children;
    vnode.shapeFlag |= type;
  }
  function mergeProps(...args) {
    const ret = {};
    for (let i = 0; i < args.length; i++) {
      const toMerge = args[i];
      for (const key in toMerge) {
        if (key === "class") {
          if (ret.class !== toMerge.class) {
            ret.class = normalizeClass([ret.class, toMerge.class]);
          }
        } else if (key === "style") {
          ret.style = normalizeStyle([ret.style, toMerge.style]);
        } else if (isOn(key)) {
          const existing = ret[key];
          const incoming = toMerge[key];
          if (incoming && existing !== incoming && !(isArray(existing) && existing.includes(incoming))) {
            ret[key] = existing ? [].concat(existing, incoming) : incoming;
          } else if (incoming == null && existing == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
          // the model listener.
          !isModelListener(key)) {
            ret[key] = incoming;
          }
        } else if (key !== "") {
          ret[key] = toMerge[key];
        }
      }
    }
    return ret;
  }
  function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
    callWithAsyncErrorHandling(hook, instance, 7, [
      vnode,
      prevVNode
    ]);
  }
  var emptyAppContext = createAppContext();
  var uid = 0;
  function getNextUid() {
    return uid;
  }
  function createComponentInstance(vnode, parent, suspense) {
    const type = vnode.type;
    const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
    const instance = {
      uid: uid++,
      vnode,
      type,
      parent,
      appContext,
      root: null,
      // to be immediately set
      next: null,
      subTree: null,
      // will be set synchronously right after creation
      effect: null,
      update: null,
      // will be set synchronously right after creation
      job: null,
      scope: new EffectScope(
        true
        /* detached */
      ),
      render: null,
      proxy: null,
      exposed: null,
      exposeProxy: null,
      withProxy: null,
      provides: parent ? parent.provides : Object.create(appContext.provides),
      ids: parent ? parent.ids : ["", 0, 0],
      accessCache: null,
      renderCache: [],
      // local resolved assets
      components: null,
      directives: null,
      // resolved props and emits options
      propsOptions: normalizePropsOptions(type, appContext),
      emitsOptions: normalizeEmitsOptions(type, appContext),
      // emit
      emit: null,
      // to be set immediately
      emitted: null,
      // props default value
      propsDefaults: EMPTY_OBJ,
      // inheritAttrs
      inheritAttrs: type.inheritAttrs,
      // state
      ctx: EMPTY_OBJ,
      data: EMPTY_OBJ,
      props: EMPTY_OBJ,
      attrs: EMPTY_OBJ,
      slots: EMPTY_OBJ,
      refs: EMPTY_OBJ,
      setupState: EMPTY_OBJ,
      setupContext: null,
      // suspense related
      suspense,
      suspenseId: suspense ? suspense.pendingId : 0,
      asyncDep: null,
      asyncResolved: false,
      // lifecycle hooks
      // not using enums here because it results in computed properties
      isMounted: false,
      isUnmounted: false,
      isDeactivated: false,
      bc: null,
      c: null,
      bm: null,
      m: null,
      bu: null,
      u: null,
      um: null,
      bum: null,
      da: null,
      a: null,
      rtg: null,
      rtc: null,
      ec: null,
      sp: null
    };
    if (false) {
      instance.ctx = createDevRenderContext(instance);
    } else {
      instance.ctx = { _: instance };
    }
    instance.root = parent ? parent.root : instance;
    instance.emit = emit.bind(null, instance);
    if (vnode.ce) {
      vnode.ce(instance);
    }
    return instance;
  }
  var currentInstance = null;
  var getCurrentInstance = () => currentInstance || currentRenderingInstance;
  var internalSetCurrentInstance;
  var setInSSRSetupState;
  {
    const g = getGlobalThis();
    const registerGlobalSetter = (key, setter) => {
      let setters;
      if (!(setters = g[key])) setters = g[key] = [];
      setters.push(setter);
      return (v) => {
        if (setters.length > 1) setters.forEach((set) => set(v));
        else setters[0](v);
      };
    };
    internalSetCurrentInstance = registerGlobalSetter(
      `__VUE_INSTANCE_SETTERS__`,
      (v) => currentInstance = v
    );
    setInSSRSetupState = registerGlobalSetter(
      `__VUE_SSR_SETTERS__`,
      (v) => isInSSRComponentSetup = v
    );
  }
  var setCurrentInstance = (instance) => {
    const prev = currentInstance;
    internalSetCurrentInstance(instance);
    instance.scope.on();
    return () => {
      instance.scope.off();
      internalSetCurrentInstance(prev);
    };
  };
  var unsetCurrentInstance = () => {
    currentInstance && currentInstance.scope.off();
    internalSetCurrentInstance(null);
  };
  function isStatefulComponent(instance) {
    return instance.vnode.shapeFlag & 4;
  }
  var isInSSRComponentSetup = false;
  function setupComponent(instance, isSSR = false, optimized = false) {
    isSSR && setInSSRSetupState(isSSR);
    const { props, children } = instance.vnode;
    const isStateful = isStatefulComponent(instance);
    initProps(instance, props, isStateful, isSSR);
    initSlots(instance, children, optimized || isSSR);
    const setupResult = isStateful ? setupStatefulComponent(instance, isSSR) : void 0;
    isSSR && setInSSRSetupState(false);
    return setupResult;
  }
  function setupStatefulComponent(instance, isSSR) {
    const Component = instance.type;
    if (false) {
      if (Component.name) {
        validateComponentName(Component.name, instance.appContext.config);
      }
      if (Component.components) {
        const names = Object.keys(Component.components);
        for (let i = 0; i < names.length; i++) {
          validateComponentName(names[i], instance.appContext.config);
        }
      }
      if (Component.directives) {
        const names = Object.keys(Component.directives);
        for (let i = 0; i < names.length; i++) {
          validateDirectiveName(names[i]);
        }
      }
      if (Component.compilerOptions && isRuntimeOnly()) {
        warn$1(
          `"compilerOptions" is only supported when using a build of Vue that includes the runtime compiler. Since you are using a runtime-only build, the options should be passed via your build tool config instead.`
        );
      }
    }
    instance.accessCache = /* @__PURE__ */ Object.create(null);
    instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
    if (false) {
      exposePropsOnRenderContext(instance);
    }
    const { setup } = Component;
    if (setup) {
      pauseTracking();
      const setupContext = instance.setupContext = setup.length > 1 ? createSetupContext(instance) : null;
      const reset2 = setCurrentInstance(instance);
      const setupResult = callWithErrorHandling(
        setup,
        instance,
        0,
        [
          false ? shallowReadonly(instance.props) : instance.props,
          setupContext
        ]
      );
      const isAsyncSetup = isPromise(setupResult);
      resetTracking();
      reset2();
      if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) {
        markAsyncBoundary(instance);
      }
      if (isAsyncSetup) {
        setupResult.then(unsetCurrentInstance, unsetCurrentInstance);
        if (isSSR) {
          return setupResult.then((resolvedResult) => {
            setInSSRSetupState(true);
            try {
              handleSetupResult(instance, resolvedResult, isSSR);
            } finally {
              setInSSRSetupState(false);
            }
          }).catch((e) => {
            handleError(e, instance, 0);
          });
        } else {
          instance.asyncDep = setupResult;
          if (false) {
            const name = formatComponentName(instance, Component);
            warn$1(
              `Component <${name}>: setup function returned a promise, but no <Suspense> boundary was found in the parent component tree. A component with async setup() must be nested in a <Suspense> in order to be rendered.`
            );
          }
        }
      } else {
        handleSetupResult(instance, setupResult, isSSR);
      }
    } else {
      finishComponentSetup(instance, isSSR);
    }
  }
  function handleSetupResult(instance, setupResult, isSSR) {
    if (isFunction(setupResult)) {
      if (instance.type.__ssrInlineRender) {
        instance.ssrRender = setupResult;
      } else {
        instance.render = setupResult;
      }
    } else if (isObject(setupResult)) {
      if (false) {
        warn$1(
          `setup() should not return VNodes directly - return a render function instead.`
        );
      }
      if (false) {
        instance.devtoolsRawSetupState = setupResult;
      }
      instance.setupState = proxyRefs(setupResult);
      if (false) {
        exposeSetupStateOnRenderContext(instance);
      }
    } else if (false) {
      warn$1(
        `setup() should return an object. Received: ${setupResult === null ? "null" : typeof setupResult}`
      );
    }
    finishComponentSetup(instance, isSSR);
  }
  var compile;
  var installWithProxy;
  function registerRuntimeCompiler(_compile) {
    compile = _compile;
    installWithProxy = (i) => {
      if (i.render._rc) {
        i.withProxy = new Proxy(i.ctx, RuntimeCompiledPublicInstanceProxyHandlers);
      }
    };
  }
  var isRuntimeOnly = () => !compile;
  function finishComponentSetup(instance, isSSR, skipOptions) {
    const Component = instance.type;
    if (!instance.render) {
      if (!isSSR && compile && !Component.render) {
        const template = Component.template || resolveMergedOptions(instance).template;
        if (template) {
          if (false) {
            startMeasure(instance, `compile`);
          }
          const { isCustomElement, compilerOptions } = instance.appContext.config;
          const { delimiters, compilerOptions: componentCompilerOptions } = Component;
          const finalCompilerOptions = extend(
            extend(
              {
                isCustomElement,
                delimiters
              },
              compilerOptions
            ),
            componentCompilerOptions
          );
          Component.render = compile(template, finalCompilerOptions);
          if (false) {
            endMeasure(instance, `compile`);
          }
        }
      }
      instance.render = Component.render || NOOP;
      if (installWithProxy) {
        installWithProxy(instance);
      }
    }
    if (true) {
      const reset2 = setCurrentInstance(instance);
      pauseTracking();
      try {
        applyOptions(instance);
      } finally {
        resetTracking();
        reset2();
      }
    }
    if (false) {
      if (!compile && Component.template) {
        warn$1(
          `Component provided template option but runtime compilation is not supported in this build of Vue. Configure your bundler to alias "vue" to "vue/dist/vue.esm-bundler.js".`
        );
      } else {
        warn$1(`Component is missing template or render function: `, Component);
      }
    }
  }
  var attrsProxyHandlers = false ? {
    get(target, key) {
      markAttrsAccessed();
      track(target, "get", "");
      return target[key];
    },
    set() {
      warn$1(`setupContext.attrs is readonly.`);
      return false;
    },
    deleteProperty() {
      warn$1(`setupContext.attrs is readonly.`);
      return false;
    }
  } : {
    get(target, key) {
      track(target, "get", "");
      return target[key];
    }
  };
  function createSetupContext(instance) {
    const expose = (exposed) => {
      if (false) {
        if (instance.exposed) {
          warn$1(`expose() should be called only once per setup().`);
        }
        if (exposed != null) {
          let exposedType = typeof exposed;
          if (exposedType === "object") {
            if (isArray(exposed)) {
              exposedType = "array";
            } else if (isRef2(exposed)) {
              exposedType = "ref";
            }
          }
          if (exposedType !== "object") {
            warn$1(
              `expose() should be passed a plain object, received ${exposedType}.`
            );
          }
        }
      }
      instance.exposed = exposed || {};
    };
    if (false) {
      let attrsProxy;
      let slotsProxy;
      return Object.freeze({
        get attrs() {
          return attrsProxy || (attrsProxy = new Proxy(instance.attrs, attrsProxyHandlers));
        },
        get slots() {
          return slotsProxy || (slotsProxy = getSlotsProxy(instance));
        },
        get emit() {
          return (event, ...args) => instance.emit(event, ...args);
        },
        expose
      });
    } else {
      return {
        attrs: new Proxy(instance.attrs, attrsProxyHandlers),
        slots: instance.slots,
        emit: instance.emit,
        expose
      };
    }
  }
  function getComponentPublicInstance(instance) {
    if (instance.exposed) {
      return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key) {
          if (key in target) {
            return target[key];
          } else if (key in publicPropertiesMap) {
            return publicPropertiesMap[key](instance);
          }
        },
        has(target, key) {
          return key in target || key in publicPropertiesMap;
        }
      }));
    } else {
      return instance.proxy;
    }
  }
  var classifyRE = /(?:^|[-_])\w/g;
  var classify = (str) => str.replace(classifyRE, (c) => c.toUpperCase()).replace(/[-_]/g, "");
  function getComponentName(Component, includeInferred = true) {
    return isFunction(Component) ? Component.displayName || Component.name : Component.name || includeInferred && Component.__name;
  }
  function formatComponentName(instance, Component, isRoot = false) {
    let name = getComponentName(Component);
    if (!name && Component.__file) {
      const match = Component.__file.match(/([^/\\]+)\.\w+$/);
      if (match) {
        name = match[1];
      }
    }
    if (!name && instance) {
      const inferFromRegistry = (registry) => {
        for (const key in registry) {
          if (registry[key] === Component) {
            return key;
          }
        }
      };
      name = inferFromRegistry(instance.components) || instance.parent && inferFromRegistry(
        instance.parent.type.components
      ) || inferFromRegistry(instance.appContext.components);
    }
    return name ? classify(name) : isRoot ? `App` : `Anonymous`;
  }
  function isClassComponent(value) {
    return isFunction(value) && "__vccOpts" in value;
  }
  var computed2 = (getterOrOptions, debugOptions) => {
    const c = computed(getterOrOptions, debugOptions, isInSSRComponentSetup);
    if (false) {
      const i = getCurrentInstance();
      if (i && i.appContext.config.warnRecursiveComputed) {
        c._warnRecursive = true;
      }
    }
    return c;
  };
  function h(type, propsOrChildren, children) {
    try {
      setBlockTracking(-1);
      const l = arguments.length;
      if (l === 2) {
        if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
          if (isVNode(propsOrChildren)) {
            return createVNode(type, null, [propsOrChildren]);
          }
          return createVNode(type, propsOrChildren);
        } else {
          return createVNode(type, null, propsOrChildren);
        }
      } else {
        if (l > 3) {
          children = Array.prototype.slice.call(arguments, 2);
        } else if (l === 3 && isVNode(children)) {
          children = [children];
        }
        return createVNode(type, propsOrChildren, children);
      }
    } finally {
      setBlockTracking(1);
    }
  }
  function initCustomFormatter() {
    if (true) {
      return;
    }
    const vueStyle = { style: "color:#3ba776" };
    const numberStyle = { style: "color:#1677ff" };
    const stringStyle = { style: "color:#f5222d" };
    const keywordStyle = { style: "color:#eb2f96" };
    const formatter = {
      __vue_custom_formatter: true,
      header(obj) {
        if (!isObject(obj)) {
          return null;
        }
        if (obj.__isVue) {
          return ["div", vueStyle, `VueInstance`];
        } else if (isRef2(obj)) {
          pauseTracking();
          const value = obj.value;
          resetTracking();
          return [
            "div",
            {},
            ["span", vueStyle, genRefFlag(obj)],
            "<",
            formatValue(value),
            `>`
          ];
        } else if (isReactive(obj)) {
          return [
            "div",
            {},
            ["span", vueStyle, isShallow(obj) ? "ShallowReactive" : "Reactive"],
            "<",
            formatValue(obj),
            `>${isReadonly(obj) ? ` (readonly)` : ``}`
          ];
        } else if (isReadonly(obj)) {
          return [
            "div",
            {},
            ["span", vueStyle, isShallow(obj) ? "ShallowReadonly" : "Readonly"],
            "<",
            formatValue(obj),
            ">"
          ];
        }
        return null;
      },
      hasBody(obj) {
        return obj && obj.__isVue;
      },
      body(obj) {
        if (obj && obj.__isVue) {
          return [
            "div",
            {},
            ...formatInstance(obj.$)
          ];
        }
      }
    };
    function formatInstance(instance) {
      const blocks = [];
      if (instance.type.props && instance.props) {
        blocks.push(createInstanceBlock("props", toRaw(instance.props)));
      }
      if (instance.setupState !== EMPTY_OBJ) {
        blocks.push(createInstanceBlock("setup", instance.setupState));
      }
      if (instance.data !== EMPTY_OBJ) {
        blocks.push(createInstanceBlock("data", toRaw(instance.data)));
      }
      const computed3 = extractKeys(instance, "computed");
      if (computed3) {
        blocks.push(createInstanceBlock("computed", computed3));
      }
      const injected = extractKeys(instance, "inject");
      if (injected) {
        blocks.push(createInstanceBlock("injected", injected));
      }
      blocks.push([
        "div",
        {},
        [
          "span",
          {
            style: keywordStyle.style + ";opacity:0.66"
          },
          "$ (internal): "
        ],
        ["object", { object: instance }]
      ]);
      return blocks;
    }
    function createInstanceBlock(type, target) {
      target = extend({}, target);
      if (!Object.keys(target).length) {
        return ["span", {}];
      }
      return [
        "div",
        { style: "line-height:1.25em;margin-bottom:0.6em" },
        [
          "div",
          {
            style: "color:#476582"
          },
          type
        ],
        [
          "div",
          {
            style: "padding-left:1.25em"
          },
          ...Object.keys(target).map((key) => {
            return [
              "div",
              {},
              ["span", keywordStyle, key + ": "],
              formatValue(target[key], false)
            ];
          })
        ]
      ];
    }
    function formatValue(v, asRaw = true) {
      if (typeof v === "number") {
        return ["span", numberStyle, v];
      } else if (typeof v === "string") {
        return ["span", stringStyle, JSON.stringify(v)];
      } else if (typeof v === "boolean") {
        return ["span", keywordStyle, v];
      } else if (isObject(v)) {
        return ["object", { object: asRaw ? toRaw(v) : v }];
      } else {
        return ["span", stringStyle, String(v)];
      }
    }
    function extractKeys(instance, type) {
      const Comp = instance.type;
      if (isFunction(Comp)) {
        return;
      }
      const extracted = {};
      for (const key in instance.ctx) {
        if (isKeyOfType(Comp, key, type)) {
          extracted[key] = instance.ctx[key];
        }
      }
      return extracted;
    }
    function isKeyOfType(Comp, key, type) {
      const opts = Comp[type];
      if (isArray(opts) && opts.includes(key) || isObject(opts) && key in opts) {
        return true;
      }
      if (Comp.extends && isKeyOfType(Comp.extends, key, type)) {
        return true;
      }
      if (Comp.mixins && Comp.mixins.some((m) => isKeyOfType(m, key, type))) {
        return true;
      }
    }
    function genRefFlag(v) {
      if (isShallow(v)) {
        return `ShallowRef`;
      }
      if (v.effect) {
        return `ComputedRef`;
      }
      return `Ref`;
    }
    if (window.devtoolsFormatters) {
      window.devtoolsFormatters.push(formatter);
    } else {
      window.devtoolsFormatters = [formatter];
    }
  }
  function withMemo(memo, render2, cache, index) {
    const cached = cache[index];
    if (cached && isMemoSame(cached, memo)) {
      return cached;
    }
    const ret = render2();
    ret.memo = memo.slice();
    ret.cacheIndex = index;
    return cache[index] = ret;
  }
  function isMemoSame(cached, memo) {
    const prev = cached.memo;
    if (prev.length != memo.length) {
      return false;
    }
    for (let i = 0; i < prev.length; i++) {
      if (hasChanged(prev[i], memo[i])) {
        return false;
      }
    }
    if (isBlockTreeEnabled > 0 && currentBlock) {
      currentBlock.push(cached);
    }
    return true;
  }
  var version = "3.5.44";
  var warn2 = false ? warn$1 : NOOP;
  var ErrorTypeStrings = ErrorTypeStrings$1;
  var devtools = true ? devtools$1 : void 0;
  var setDevtoolsHook = true ? setDevtoolsHook$1 : NOOP;
  var _ssrUtils = {
    createComponentInstance,
    setupComponent,
    renderComponentRoot,
    setCurrentRenderingInstance,
    isVNode,
    normalizeVNode,
    getComponentPublicInstance,
    ensureValidVNode,
    pushWarningContext,
    popWarningContext
  };
  var ssrUtils = _ssrUtils;
  var resolveFilter = null;
  var compatUtils = null;
  var DeprecationTypes = null;

  // node_modules/@vue/runtime-dom/dist/runtime-dom.esm-bundler.js
  /**
  * @vue/runtime-dom v3.5.44
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  var policy = void 0;
  var tt = typeof window !== "undefined" && window.trustedTypes;
  if (tt) {
    try {
      policy = /* @__PURE__ */ tt.createPolicy("vue", {
        createHTML: (val) => val
      });
    } catch (e) {
    }
  }
  var unsafeToTrustedHTML = policy ? (val) => policy.createHTML(val) : (val) => val;
  var svgNS = "http://www.w3.org/2000/svg";
  var mathmlNS = "http://www.w3.org/1998/Math/MathML";
  var doc = typeof document !== "undefined" ? document : null;
  var templateContainer = doc && /* @__PURE__ */ doc.createElement("template");
  var nodeOps = {
    insert: (child, parent, anchor) => {
      parent.insertBefore(child, anchor || null);
    },
    remove: (child) => {
      const parent = child.parentNode;
      if (parent) {
        parent.removeChild(child);
      }
    },
    createElement: (tag, namespace, is, props) => {
      const el = namespace === "svg" ? doc.createElementNS(svgNS, tag) : namespace === "mathml" ? doc.createElementNS(mathmlNS, tag) : is ? doc.createElement(tag, { is }) : doc.createElement(tag);
      if (tag === "select" && props && props.multiple != null) {
        el.setAttribute("multiple", props.multiple);
      }
      return el;
    },
    createText: (text) => doc.createTextNode(text),
    createComment: (text) => doc.createComment(text),
    setText: (node, text) => {
      node.nodeValue = text;
    },
    setElementText: (el, text) => {
      el.textContent = text;
    },
    parentNode: (node) => node.parentNode,
    nextSibling: (node) => node.nextSibling,
    querySelector: (selector) => doc.querySelector(selector),
    setScopeId(el, id) {
      el.setAttribute(id, "");
    },
    // __UNSAFE__
    // Reason: innerHTML.
    // Static content here can only come from compiled templates.
    // As long as the user only uses trusted templates, this is safe.
    insertStaticContent(content, parent, anchor, namespace, start, end) {
      const before = anchor ? anchor.previousSibling : parent.lastChild;
      if (start && (start === end || start.nextSibling)) {
        while (true) {
          parent.insertBefore(start.cloneNode(true), anchor);
          if (start === end || !(start = start.nextSibling)) break;
        }
      } else {
        templateContainer.innerHTML = unsafeToTrustedHTML(
          namespace === "svg" ? `<svg>${content}</svg>` : namespace === "mathml" ? `<math>${content}</math>` : content
        );
        const template = templateContainer.content;
        if (namespace === "svg" || namespace === "mathml") {
          const wrapper = template.firstChild;
          while (wrapper.firstChild) {
            template.appendChild(wrapper.firstChild);
          }
          template.removeChild(wrapper);
        }
        parent.insertBefore(template, anchor);
      }
      return [
        // first
        before ? before.nextSibling : parent.firstChild,
        // last
        anchor ? anchor.previousSibling : parent.lastChild
      ];
    }
  };
  var TRANSITION = "transition";
  var ANIMATION = "animation";
  var vtcKey = /* @__PURE__ */ Symbol("_vtc");
  var DOMTransitionPropsValidators = {
    name: String,
    type: String,
    css: {
      type: Boolean,
      default: true
    },
    duration: [String, Number, Object],
    enterFromClass: String,
    enterActiveClass: String,
    enterToClass: String,
    appearFromClass: String,
    appearActiveClass: String,
    appearToClass: String,
    leaveFromClass: String,
    leaveActiveClass: String,
    leaveToClass: String
  };
  var TransitionPropsValidators = /* @__PURE__ */ extend(
    {},
    BaseTransitionPropsValidators,
    DOMTransitionPropsValidators
  );
  var decorate$1 = (t) => {
    t.displayName = "Transition";
    t.props = TransitionPropsValidators;
    return t;
  };
  var Transition = /* @__PURE__ */ decorate$1(
    (props, { slots }) => h(BaseTransition, resolveTransitionProps(props), slots)
  );
  var callHook2 = (hook, args = []) => {
    if (isArray(hook)) {
      hook.forEach((h2) => h2(...args));
    } else if (hook) {
      hook(...args);
    }
  };
  var hasExplicitCallback = (hook) => {
    return hook ? isArray(hook) ? hook.some((h2) => h2.length > 1) : hook.length > 1 : false;
  };
  function resolveTransitionProps(rawProps) {
    const baseProps = {};
    for (const key in rawProps) {
      if (!(key in DOMTransitionPropsValidators)) {
        baseProps[key] = rawProps[key];
      }
    }
    if (rawProps.css === false) {
      return baseProps;
    }
    const {
      name = "v",
      type,
      duration,
      enterFromClass = `${name}-enter-from`,
      enterActiveClass = `${name}-enter-active`,
      enterToClass = `${name}-enter-to`,
      appearFromClass = enterFromClass,
      appearActiveClass = enterActiveClass,
      appearToClass = enterToClass,
      leaveFromClass = `${name}-leave-from`,
      leaveActiveClass = `${name}-leave-active`,
      leaveToClass = `${name}-leave-to`
    } = rawProps;
    const durations = normalizeDuration(duration);
    const enterDuration = durations && durations[0];
    const leaveDuration = durations && durations[1];
    const {
      onBeforeEnter,
      onEnter,
      onEnterCancelled,
      onLeave,
      onLeaveCancelled,
      onBeforeAppear = onBeforeEnter,
      onAppear = onEnter,
      onAppearCancelled = onEnterCancelled
    } = baseProps;
    const finishEnter = (el, isAppear, done, isCancelled) => {
      el._enterCancelled = isCancelled;
      removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
      removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
      done && done();
    };
    const finishLeave = (el, done) => {
      el._isLeaving = false;
      removeTransitionClass(el, leaveFromClass);
      removeTransitionClass(el, leaveToClass);
      removeTransitionClass(el, leaveActiveClass);
      done && done();
    };
    const makeEnterHook = (isAppear) => {
      return (el, done) => {
        const hook = isAppear ? onAppear : onEnter;
        const resolve2 = () => finishEnter(el, isAppear, done);
        callHook2(hook, [el, resolve2]);
        nextFrame(() => {
          removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass);
          addTransitionClass(el, isAppear ? appearToClass : enterToClass);
          if (!hasExplicitCallback(hook)) {
            whenTransitionEnds(el, type, enterDuration, resolve2);
          }
        });
      };
    };
    return extend(baseProps, {
      onBeforeEnter(el) {
        callHook2(onBeforeEnter, [el]);
        addTransitionClass(el, enterFromClass);
        addTransitionClass(el, enterActiveClass);
      },
      onBeforeAppear(el) {
        callHook2(onBeforeAppear, [el]);
        addTransitionClass(el, appearFromClass);
        addTransitionClass(el, appearActiveClass);
      },
      onEnter: makeEnterHook(false),
      onAppear: makeEnterHook(true),
      onLeave(el, done) {
        el._isLeaving = true;
        const resolve2 = () => finishLeave(el, done);
        addTransitionClass(el, leaveFromClass);
        if (!el._enterCancelled) {
          forceReflow(el);
          addTransitionClass(el, leaveActiveClass);
        } else {
          addTransitionClass(el, leaveActiveClass);
          forceReflow(el);
        }
        nextFrame(() => {
          if (!el._isLeaving) {
            return;
          }
          removeTransitionClass(el, leaveFromClass);
          addTransitionClass(el, leaveToClass);
          if (!hasExplicitCallback(onLeave)) {
            whenTransitionEnds(el, type, leaveDuration, resolve2);
          }
        });
        callHook2(onLeave, [el, resolve2]);
      },
      onEnterCancelled(el) {
        finishEnter(el, false, void 0, true);
        callHook2(onEnterCancelled, [el]);
      },
      onAppearCancelled(el) {
        finishEnter(el, true, void 0, true);
        callHook2(onAppearCancelled, [el]);
      },
      onLeaveCancelled(el) {
        finishLeave(el);
        callHook2(onLeaveCancelled, [el]);
      }
    });
  }
  function normalizeDuration(duration) {
    if (duration == null) {
      return null;
    } else if (isObject(duration)) {
      return [NumberOf(duration.enter), NumberOf(duration.leave)];
    } else {
      const n = NumberOf(duration);
      return [n, n];
    }
  }
  function NumberOf(val) {
    const res = toNumber(val);
    if (false) {
      assertNumber(res, "<transition> explicit duration");
    }
    return res;
  }
  function addTransitionClass(el, cls) {
    cls.split(/\s+/).forEach((c) => c && el.classList.add(c));
    (el[vtcKey] || (el[vtcKey] = /* @__PURE__ */ new Set())).add(cls);
  }
  function removeTransitionClass(el, cls) {
    cls.split(/\s+/).forEach((c) => c && el.classList.remove(c));
    const _vtc = el[vtcKey];
    if (_vtc) {
      _vtc.delete(cls);
      if (!_vtc.size) {
        el[vtcKey] = void 0;
      }
    }
  }
  function nextFrame(cb) {
    requestAnimationFrame(() => {
      requestAnimationFrame(cb);
    });
  }
  var endId = 0;
  function whenTransitionEnds(el, expectedType, explicitTimeout, resolve2) {
    const id = el._endId = ++endId;
    const resolveIfNotStale = () => {
      if (id === el._endId) {
        resolve2();
      }
    };
    if (explicitTimeout != null) {
      return setTimeout(resolveIfNotStale, explicitTimeout);
    }
    const { type, timeout, propCount } = getTransitionInfo(el, expectedType);
    if (!type) {
      return resolve2();
    }
    const endEvent = type + "end";
    let ended = 0;
    const end = () => {
      el.removeEventListener(endEvent, onEnd);
      resolveIfNotStale();
    };
    const onEnd = (e) => {
      if (e.target === el && ++ended >= propCount) {
        end();
      }
    };
    setTimeout(() => {
      if (ended < propCount) {
        end();
      }
    }, timeout + 1);
    el.addEventListener(endEvent, onEnd);
  }
  function getTransitionInfo(el, expectedType) {
    const styles = window.getComputedStyle(el);
    const getStyleProperties = (key) => (styles[key] || "").split(", ");
    const transitionDelays = getStyleProperties(`${TRANSITION}Delay`);
    const transitionDurations = getStyleProperties(`${TRANSITION}Duration`);
    const transitionTimeout = getTimeout(transitionDelays, transitionDurations);
    const animationDelays = getStyleProperties(`${ANIMATION}Delay`);
    const animationDurations = getStyleProperties(`${ANIMATION}Duration`);
    const animationTimeout = getTimeout(animationDelays, animationDurations);
    let type = null;
    let timeout = 0;
    let propCount = 0;
    if (expectedType === TRANSITION) {
      if (transitionTimeout > 0) {
        type = TRANSITION;
        timeout = transitionTimeout;
        propCount = transitionDurations.length;
      }
    } else if (expectedType === ANIMATION) {
      if (animationTimeout > 0) {
        type = ANIMATION;
        timeout = animationTimeout;
        propCount = animationDurations.length;
      }
    } else {
      timeout = Math.max(transitionTimeout, animationTimeout);
      type = timeout > 0 ? transitionTimeout > animationTimeout ? TRANSITION : ANIMATION : null;
      propCount = type ? type === TRANSITION ? transitionDurations.length : animationDurations.length : 0;
    }
    const hasTransform = type === TRANSITION && /\b(?:transform|all)(?:,|$)/.test(
      getStyleProperties(`${TRANSITION}Property`).toString()
    );
    return {
      type,
      timeout,
      propCount,
      hasTransform
    };
  }
  function getTimeout(delays, durations) {
    while (delays.length < durations.length) {
      delays = delays.concat(delays);
    }
    return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])));
  }
  function toMs(s) {
    if (s === "auto") return 0;
    return Number(s.slice(0, -1).replace(",", ".")) * 1e3;
  }
  function forceReflow(el) {
    const targetDocument = el ? el.ownerDocument : document;
    return targetDocument.body.offsetHeight;
  }
  function patchClass(el, value, isSVG) {
    const transitionClasses = el[vtcKey];
    if (transitionClasses) {
      value = (value ? [value, ...transitionClasses] : [...transitionClasses]).join(" ");
    }
    if (value == null) {
      el.removeAttribute("class");
    } else if (isSVG) {
      el.setAttribute("class", value);
    } else {
      el.className = value;
    }
  }
  var vShowOriginalDisplay = /* @__PURE__ */ Symbol("_vod");
  var vShowHidden = /* @__PURE__ */ Symbol("_vsh");
  var vShow = {
    // used for prop mismatch check during hydration
    name: "show",
    beforeMount(el, { value }, { transition }) {
      el[vShowOriginalDisplay] = el.style.display === "none" ? "" : el.style.display;
      if (transition && value) {
        transition.beforeEnter(el);
      } else {
        setDisplay(el, value);
      }
    },
    mounted(el, { value }, { transition }) {
      if (transition && value) {
        transition.enter(el);
      }
    },
    updated(el, { value, oldValue }, { transition }) {
      if (!value === !oldValue) return;
      if (transition) {
        if (value) {
          transition.beforeEnter(el);
          setDisplay(el, true);
          transition.enter(el);
        } else {
          transition.leave(el, () => {
            setDisplay(el, false);
          });
        }
      } else {
        setDisplay(el, value);
      }
    },
    beforeUnmount(el, { value }) {
      setDisplay(el, value);
    }
  };
  function setDisplay(el, value) {
    el.style.display = value ? el[vShowOriginalDisplay] : "none";
    el[vShowHidden] = !value;
  }
  function initVShowForSSR() {
    vShow.getSSRProps = ({ value }) => {
      if (!value) {
        return { style: { display: "none" } };
      }
    };
  }
  var CSS_VAR_TEXT = /* @__PURE__ */ Symbol(false ? "CSS_VAR_TEXT" : "");
  function useCssVars(getter) {
    const instance = getCurrentInstance();
    if (!instance) {
      return;
    }
    const updateTeleports = instance.ut = (vars = getter(instance.proxy)) => {
      Array.from(
        document.querySelectorAll(`[data-v-owner="${instance.uid}"]`)
      ).forEach((node) => setVarsOnNode(node, vars));
    };
    if (false) {
      instance.getCssVars = () => getter(instance.proxy);
    }
    const setVars = () => {
      const vars = getter(instance.proxy);
      if (instance.ce) {
        setVarsOnNode(instance.ce, vars);
      } else {
        setVarsOnVNode(instance.subTree, vars);
      }
      updateTeleports(vars);
    };
    onBeforeUpdate(() => {
      queuePostFlushCb(setVars);
    });
    onMounted(() => {
      watch2(setVars, NOOP, { flush: "post" });
      const ob = new MutationObserver(setVars);
      ob.observe(instance.subTree.el.parentNode, { childList: true });
      onUnmounted(() => ob.disconnect());
    });
  }
  function setVarsOnVNode(vnode, vars) {
    if (vnode.shapeFlag & 128) {
      const suspense = vnode.suspense;
      vnode = suspense.activeBranch;
      if (suspense.pendingBranch && !suspense.isHydrating) {
        suspense.effects.push(() => {
          setVarsOnVNode(suspense.activeBranch, vars);
        });
      }
    }
    while (vnode.component) {
      vnode = vnode.component.subTree;
    }
    if (vnode.shapeFlag & 1 && vnode.el) {
      setVarsOnNode(vnode.el, vars);
    } else if (vnode.type === Fragment) {
      vnode.children.forEach((c) => setVarsOnVNode(c, vars));
    } else if (vnode.type === Static) {
      let { el, anchor } = vnode;
      while (el) {
        setVarsOnNode(el, vars);
        if (el === anchor) break;
        el = el.nextSibling;
      }
    }
  }
  function setVarsOnNode(el, vars) {
    if (el.nodeType === 1) {
      const style = el.style;
      let cssText = "";
      for (const key in vars) {
        const value = normalizeCssVarValue(vars[key]);
        style.setProperty(`--${key}`, value);
        cssText += `--${key}: ${value};`;
      }
      style[CSS_VAR_TEXT] = cssText;
    }
  }
  var displayRE = /(?:^|;)\s*display\s*:/;
  function patchStyle(el, prev, next) {
    const style = el.style;
    const isCssString = isString(next);
    let hasControlledDisplay = false;
    if (next && !isCssString) {
      if (prev) {
        if (!isString(prev)) {
          for (const key in prev) {
            if (next[key] == null) {
              setStyle(style, key, "");
            }
          }
        } else {
          for (const prevStyle of prev.split(";")) {
            const key = prevStyle.slice(0, prevStyle.indexOf(":")).trim();
            if (next[key] == null) {
              setStyle(style, key, "");
            }
          }
        }
      }
      for (const key in next) {
        if (key === "display") {
          hasControlledDisplay = true;
        }
        const value = next[key];
        if (value != null) {
          if (!shouldPreserveTextareaResizeStyle(
            el,
            key,
            !isString(prev) && prev ? prev[key] : void 0,
            value
          )) {
            setStyle(style, key, value);
          }
        } else {
          setStyle(style, key, "");
        }
      }
    } else {
      if (isCssString) {
        if (prev !== next) {
          const cssVarText = style[CSS_VAR_TEXT];
          if (cssVarText) {
            next += ";" + cssVarText;
          }
          style.cssText = next;
          hasControlledDisplay = displayRE.test(next);
        }
      } else if (prev) {
        el.removeAttribute("style");
      }
    }
    if (vShowOriginalDisplay in el) {
      if (!isCssString || prev !== next) {
        el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : "";
      }
      if (el[vShowHidden]) {
        style.display = "none";
      }
    }
  }
  var importantRE = /\s*!important$/;
  function setStyle(style, name, val) {
    if (isArray(val)) {
      val.forEach((v) => setStyle(style, name, v));
    } else {
      if (val == null) val = "";
      if (false) {
        if (semicolonRE.test(val)) {
          warn2(
            `Unexpected semicolon at the end of '${name}' style value: '${val}'`
          );
        }
      }
      if (name.startsWith("--")) {
        if (importantRE.test(val)) {
          style.setProperty(name, val.replace(importantRE, ""), "important");
        } else {
          style.setProperty(name, val);
        }
      } else {
        const prefixed = autoPrefix(style, name);
        if (importantRE.test(val)) {
          style.setProperty(
            hyphenate(prefixed),
            val.replace(importantRE, ""),
            "important"
          );
        } else {
          style[prefixed] = val;
        }
      }
    }
  }
  var prefixes = ["Webkit", "Moz", "ms"];
  var prefixCache = {};
  function autoPrefix(style, rawName) {
    const cached = prefixCache[rawName];
    if (cached) {
      return cached;
    }
    let name = camelize(rawName);
    if (name !== "filter" && name in style) {
      return prefixCache[rawName] = name;
    }
    name = capitalize(name);
    for (let i = 0; i < prefixes.length; i++) {
      const prefixed = prefixes[i] + name;
      if (prefixed in style) {
        return prefixCache[rawName] = prefixed;
      }
    }
    return rawName;
  }
  function shouldPreserveTextareaResizeStyle(el, key, prev, next) {
    return el.tagName === "TEXTAREA" && (key === "width" || key === "height") && isString(next) && prev === next;
  }
  var xlinkNS = "http://www.w3.org/1999/xlink";
  function patchAttr(el, key, value, isSVG, instance, isBoolean = isSpecialBooleanAttr(key)) {
    if (isSVG && key.startsWith("xlink:")) {
      if (value == null) {
        el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
      } else {
        el.setAttributeNS(xlinkNS, key, value);
      }
    } else {
      if (value == null || isBoolean && !includeBooleanAttr(value)) {
        el.removeAttribute(key);
      } else {
        el.setAttribute(
          key,
          isBoolean ? "" : isSymbol(value) ? String(value) : value
        );
      }
    }
  }
  function patchDOMProp(el, key, value, parentComponent, attrName) {
    if (key === "innerHTML" || key === "textContent") {
      if (value != null) {
        el[key] = key === "innerHTML" ? unsafeToTrustedHTML(value) : value;
      }
      return;
    }
    const tag = el.tagName;
    if (key === "value" && tag !== "PROGRESS" && // custom elements may use _value internally
    !tag.includes("-")) {
      const oldValue = tag === "OPTION" ? el.getAttribute("value") || "" : el.value;
      const newValue = value == null ? (
        // #11647: value should be set as empty string for null and undefined,
        // but <input type="checkbox"> should be set as 'on'.
        el.type === "checkbox" ? "on" : ""
      ) : String(value);
      if (oldValue !== newValue || !("_value" in el)) {
        el.value = newValue;
      }
      if (value == null) {
        el.removeAttribute(key);
      }
      el._value = value;
      return;
    }
    let needRemove = false;
    if (value === "" || value == null) {
      const type = typeof el[key];
      if (type === "boolean") {
        value = includeBooleanAttr(value);
      } else if (value == null && type === "string") {
        value = "";
        needRemove = true;
      } else if (type === "number") {
        value = 0;
        needRemove = true;
      }
    }
    try {
      el[key] = value;
    } catch (e) {
      if (false) {
        warn2(
          `Failed setting prop "${key}" on <${tag.toLowerCase()}>: value ${value} is invalid.`,
          e
        );
      }
    }
    needRemove && el.removeAttribute(attrName || key);
  }
  function addEventListener(el, event, handler, options) {
    el.addEventListener(event, handler, options);
  }
  function removeEventListener(el, event, handler, options) {
    el.removeEventListener(event, handler, options);
  }
  var veiKey = /* @__PURE__ */ Symbol("_vei");
  function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
    const invokers = el[veiKey] || (el[veiKey] = {});
    const existingInvoker = invokers[rawName];
    if (nextValue && existingInvoker) {
      existingInvoker.value = false ? sanitizeEventValue(nextValue, rawName) : nextValue;
    } else {
      const [name, options] = parseName(rawName);
      if (nextValue) {
        const invoker = invokers[rawName] = createInvoker(
          false ? sanitizeEventValue(nextValue, rawName) : nextValue,
          instance
        );
        addEventListener(el, name, invoker, options);
      } else if (existingInvoker) {
        removeEventListener(el, name, existingInvoker, options);
        invokers[rawName] = void 0;
      }
    }
  }
  var optionsModifierRE = /(Once|Passive|Capture)$/;
  var optionsModifierEventRE = /^on:?(?:Once|Passive|Capture)$/;
  function parseName(name) {
    let options;
    let m;
    while ((m = name.match(optionsModifierRE)) && !optionsModifierEventRE.test(name)) {
      if (!options) options = {};
      name = name.slice(0, name.length - m[1].length);
      options[m[1].toLowerCase()] = true;
    }
    const event = name[2] === ":" ? name.slice(3) : hyphenate(name.slice(2));
    return [event, options];
  }
  var cachedNow = 0;
  var p = /* @__PURE__ */ Promise.resolve();
  var getNow = () => cachedNow || (p.then(() => cachedNow = 0), cachedNow = Date.now());
  function createInvoker(initialValue, instance) {
    const invoker = (e) => {
      if (!e._vts) {
        e._vts = Date.now();
      } else if (e._vts <= invoker.attached) {
        return;
      }
      const value = invoker.value;
      if (isArray(value)) {
        const originalStop = e.stopImmediatePropagation;
        e.stopImmediatePropagation = () => {
          originalStop.call(e);
          e._stopped = true;
        };
        const handlers = value.slice();
        const args = [e];
        for (let i = 0; i < handlers.length; i++) {
          if (e._stopped) {
            break;
          }
          const handler = handlers[i];
          if (handler) {
            callWithAsyncErrorHandling(
              handler,
              instance,
              5,
              args
            );
          }
        }
      } else {
        callWithAsyncErrorHandling(
          value,
          instance,
          5,
          [e]
        );
      }
    };
    invoker.value = initialValue;
    invoker.attached = getNow();
    return invoker;
  }
  var isNativeOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // lowercase letter
  key.charCodeAt(2) > 96 && key.charCodeAt(2) < 123;
  var patchProp = (el, key, prevValue, nextValue, namespace, parentComponent) => {
    const isSVG = namespace === "svg";
    if (key === "class") {
      patchClass(el, nextValue, isSVG);
    } else if (key === "style") {
      patchStyle(el, prevValue, nextValue);
    } else if (isOn(key)) {
      if (!isModelListener(key)) {
        patchEvent(el, key, prevValue, nextValue, parentComponent);
      }
    } else if (key[0] === "." ? (key = key.slice(1), true) : key[0] === "^" ? (key = key.slice(1), false) : shouldSetAsProp(el, key, nextValue, isSVG)) {
      patchDOMProp(el, key, nextValue);
      if (!el.tagName.includes("-") && (key === "value" || key === "checked" || key === "selected")) {
        patchAttr(el, key, nextValue, isSVG, parentComponent, key !== "value");
      }
    } else if (
      // #11081 force set props for possible async custom element
      el._isVueCE && // #12408 check if it's declared prop or it's async custom element
      (shouldSetAsPropForVueCE(el, key) || // @ts-expect-error _def is private
      el._def.__asyncLoader && (/[A-Z]/.test(key) || !isString(nextValue)))
    ) {
      patchDOMProp(el, camelize(key), nextValue, parentComponent, key);
    } else {
      if (key === "true-value") {
        el._trueValue = nextValue;
      } else if (key === "false-value") {
        el._falseValue = nextValue;
      }
      patchAttr(el, key, nextValue, isSVG);
    }
  };
  function shouldSetAsProp(el, key, value, isSVG) {
    if (isSVG) {
      if (key === "innerHTML" || key === "textContent") {
        return true;
      }
      if (key in el && isNativeOn(key) && isFunction(value)) {
        return true;
      }
      return false;
    }
    if (key === "spellcheck" || key === "draggable" || key === "translate" || key === "autocorrect") {
      return false;
    }
    if (key === "sandbox" && el.tagName === "IFRAME") {
      return false;
    }
    if (key === "form") {
      return false;
    }
    if (key === "list" && el.tagName === "INPUT") {
      return false;
    }
    if (key === "type" && el.tagName === "TEXTAREA") {
      return false;
    }
    if (key === "width" || key === "height") {
      const tag = el.tagName;
      if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SOURCE") {
        return false;
      }
    }
    if (isNativeOn(key) && isString(value)) {
      return false;
    }
    return key in el;
  }
  function shouldSetAsPropForVueCE(el, key) {
    const props = (
      // @ts-expect-error _def is private
      el._def.props
    );
    if (!props) {
      return false;
    }
    const camelKey = camelize(key);
    return Array.isArray(props) ? props.some((prop) => camelize(prop) === camelKey) : Object.keys(props).some((prop) => camelize(prop) === camelKey);
  }
  var REMOVAL = {};
  // @__NO_SIDE_EFFECTS__
  function defineCustomElement(options, extraOptions, _createApp) {
    let Comp = defineComponent(options, extraOptions);
    if (isPlainObject(Comp)) Comp = extend({}, Comp, extraOptions);
    class VueCustomElement extends VueElement {
      constructor(initialProps) {
        super(Comp, initialProps, _createApp);
      }
    }
    VueCustomElement.def = Comp;
    return VueCustomElement;
  }
  var defineSSRCustomElement = (/* @__NO_SIDE_EFFECTS__ */ (options, extraOptions) => {
    return /* @__PURE__ */ defineCustomElement(options, extraOptions, createSSRApp);
  });
  var BaseClass = typeof HTMLElement !== "undefined" ? HTMLElement : class {
  };
  var VueElement = class _VueElement extends BaseClass {
    constructor(_def, _props = {}, _createApp = createApp) {
      super();
      this._def = _def;
      this._props = _props;
      this._createApp = _createApp;
      this._isVueCE = true;
      this._instance = null;
      this._app = null;
      this._nonce = this._def.nonce;
      this._connected = false;
      this._resolved = false;
      this._patching = false;
      this._dirty = false;
      this._numberProps = null;
      this._styleChildren = /* @__PURE__ */ new WeakSet();
      this._styleAnchors = /* @__PURE__ */ new WeakMap();
      this._ob = null;
      if (this.shadowRoot && _createApp !== createApp) {
        this._root = this.shadowRoot;
      } else {
        if (false) {
          warn2(
            `Custom element has pre-rendered declarative shadow root but is not defined as hydratable. Use \`defineSSRCustomElement\`.`
          );
        }
        if (_def.shadowRoot !== false) {
          this.attachShadow(
            extend({}, _def.shadowRootOptions, {
              mode: "open"
            })
          );
          this._root = this.shadowRoot;
        } else {
          this._root = this;
        }
      }
    }
    connectedCallback() {
      if (!this.isConnected) return;
      if (!this.shadowRoot && !this._resolved) {
        this._parseSlots();
      }
      this._connected = true;
      let parent = this;
      while (parent = parent && // #12479 should check assignedSlot first to get correct parent
      (parent.assignedSlot || parent.parentNode || parent.host)) {
        if (parent instanceof _VueElement) {
          this._parent = parent;
          break;
        }
      }
      if (!this._instance) {
        if (this._resolved) {
          this._mount(this._def);
        } else {
          if (parent && parent._pendingResolve) {
            this._pendingResolve = parent._pendingResolve.then(() => {
              this._pendingResolve = void 0;
              if (this.isConnected) {
                return this._resolveDef();
              }
            });
          } else {
            this._resolveDef();
          }
        }
      }
    }
    _setParent(parent = this._parent) {
      if (parent) {
        this._instance.parent = parent._instance;
        this._inheritParentContext(parent);
      }
    }
    _inheritParentContext(parent = this._parent) {
      if (parent && this._app) {
        Object.setPrototypeOf(
          this._app._context.provides,
          parent._instance.provides
        );
      }
    }
    disconnectedCallback() {
      this._connected = false;
      nextTick(() => {
        if (!this._connected) {
          if (this._ob) {
            this._ob.disconnect();
            this._ob = null;
          }
          this._app && this._app.unmount();
          if (this._instance) this._instance.ce = void 0;
          this._app = this._instance = null;
          if (this._teleportTargets) {
            this._teleportTargets.clear();
            this._teleportTargets = void 0;
          }
        }
      });
    }
    _processMutations(mutations) {
      for (const m of mutations) {
        this._setAttr(m.attributeName);
      }
    }
    /**
     * resolve inner component definition (handle possible async component)
     */
    _resolveDef() {
      if (this._pendingResolve) {
        return this._pendingResolve;
      }
      for (let i = 0; i < this.attributes.length; i++) {
        this._setAttr(this.attributes[i].name);
      }
      this._ob = new MutationObserver(this._processMutations.bind(this));
      this._ob.observe(this, { attributes: true });
      const resolve2 = (def2, isAsync = false) => {
        this._resolved = true;
        this._pendingResolve = void 0;
        const { props, styles } = def2;
        let numberProps;
        if (props && !isArray(props)) {
          for (const key in props) {
            const opt = props[key];
            if (opt === Number || opt && opt.type === Number) {
              if (key in this._props) {
                this._props[key] = toNumber(this._props[key]);
              }
              (numberProps || (numberProps = /* @__PURE__ */ Object.create(null)))[camelize(key)] = true;
            }
          }
        }
        this._numberProps = numberProps;
        this._resolveProps(def2);
        if (this.shadowRoot) {
          this._applyStyles(styles);
        } else if (false) {
          warn2(
            "Custom element style injection is not supported when using shadowRoot: false"
          );
        }
        if (this._connected) {
          this._mount(def2);
        }
      };
      const asyncDef = this._def.__asyncLoader;
      if (asyncDef) {
        this._pendingResolve = asyncDef().then((def2) => {
          def2.configureApp = this._def.configureApp;
          resolve2(this._def = def2, true);
        });
        return this._pendingResolve;
      } else {
        resolve2(this._def);
      }
    }
    _mount(def2) {
      if (false) {
        def2.name = "VueElement";
      }
      this._app = this._createApp(def2);
      this._inheritParentContext();
      if (def2.configureApp) {
        def2.configureApp(this._app);
      }
      this._app._ceVNode = this._createVNode();
      this._app.mount(this._root);
      const exposed = this._instance && this._instance.exposed;
      if (!exposed) return;
      for (const key in exposed) {
        if (!hasOwn(this, key)) {
          Object.defineProperty(this, key, {
            // unwrap ref to be consistent with public instance behavior
            get: () => unref(exposed[key])
          });
        } else if (false) {
          warn2(`Exposed property "${key}" already exists on custom element.`);
        }
      }
    }
    _resolveProps(def2) {
      const { props } = def2;
      const declaredPropKeys = isArray(props) ? props : Object.keys(props || {});
      for (const key of Object.keys(this)) {
        if (key[0] !== "_" && declaredPropKeys.includes(key)) {
          this._setProp(key, this[key]);
        }
      }
      for (const key of declaredPropKeys.map(camelize)) {
        if (false) {
          warn2(
            `Custom element prop "${key}" conflicts with an existing property on the element and will overwrite it.`
          );
        }
        Object.defineProperty(this, key, {
          get() {
            return this._getProp(key);
          },
          set(val) {
            this._setProp(key, val, true, !this._patching);
          }
        });
      }
    }
    _setAttr(key) {
      if (key.startsWith("data-v-")) return;
      const has = this.hasAttribute(key);
      let value = has ? this.getAttribute(key) : REMOVAL;
      const camelKey = camelize(key);
      if (has && this._numberProps && this._numberProps[camelKey]) {
        value = toNumber(value);
      }
      this._setProp(camelKey, value, false, true);
    }
    /**
     * @internal
     */
    _getProp(key) {
      return this._props[key];
    }
    /**
     * @internal
     */
    _setProp(key, val, shouldReflect = true, shouldUpdate = false) {
      if (val !== this._props[key]) {
        this._dirty = true;
        if (val === REMOVAL) {
          delete this._props[key];
        } else {
          this._props[key] = val;
          if (key === "key" && this._app) {
            this._app._ceVNode.key = val;
          }
        }
        if (shouldUpdate && this._instance) {
          this._update();
        }
        if (shouldReflect) {
          const ob = this._ob;
          if (ob) {
            this._processMutations(ob.takeRecords());
            ob.disconnect();
          }
          if (val === true) {
            this.setAttribute(hyphenate(key), "");
          } else if (typeof val === "string" || typeof val === "number") {
            this.setAttribute(hyphenate(key), val + "");
          } else if (!val) {
            this.removeAttribute(hyphenate(key));
          }
          ob && ob.observe(this, { attributes: true });
        }
      }
    }
    _update() {
      const vnode = this._createVNode();
      if (this._app) vnode.appContext = this._app._context;
      render(vnode, this._root);
    }
    _createVNode() {
      const baseProps = {};
      if (!this.shadowRoot) {
        baseProps.onVnodeMounted = baseProps.onVnodeUpdated = this._renderSlots.bind(this);
      }
      const vnode = createVNode(this._def, extend(baseProps, this._props));
      if (!this._instance) {
        vnode.ce = (instance) => {
          this._instance = instance;
          instance.ce = this;
          instance.isCE = true;
          if (false) {
            instance.ceReload = (newStyles) => {
              if (this._styles) {
                this._styles.forEach((s) => this._root.removeChild(s));
                this._styles.length = 0;
              }
              this._styleAnchors.delete(this._def);
              this._applyStyles(newStyles);
              this._instance = null;
              this._update();
            };
          }
          const dispatch = (event, args) => {
            this.dispatchEvent(
              new CustomEvent(
                event,
                isPlainObject(args[0]) ? extend({ detail: args }, args[0]) : { detail: args }
              )
            );
          };
          instance.emit = (event, ...args) => {
            dispatch(event, args);
            if (hyphenate(event) !== event) {
              dispatch(hyphenate(event), args);
            }
          };
          this._setParent();
        };
      }
      return vnode;
    }
    _applyStyles(styles, owner, parentComp) {
      if (!styles) return;
      if (owner) {
        if (owner === this._def || this._styleChildren.has(owner)) {
          return;
        }
        this._styleChildren.add(owner);
      }
      const nonce = this._nonce;
      const root = this.shadowRoot;
      const insertionAnchor = parentComp ? this._getStyleAnchor(parentComp) || this._getStyleAnchor(this._def) : this._getRootStyleInsertionAnchor(root);
      let last = null;
      for (let i = styles.length - 1; i >= 0; i--) {
        const s = document.createElement("style");
        if (nonce) s.setAttribute("nonce", nonce);
        s.textContent = styles[i];
        root.insertBefore(s, last || insertionAnchor);
        last = s;
        if (i === 0) {
          if (!parentComp) this._styleAnchors.set(this._def, s);
          if (owner) this._styleAnchors.set(owner, s);
        }
        if (false) {
          if (owner) {
            if (owner.__hmrId) {
              if (!this._childStyles) this._childStyles = /* @__PURE__ */ new Map();
              let entry = this._childStyles.get(owner.__hmrId);
              if (!entry) {
                this._childStyles.set(owner.__hmrId, entry = []);
              }
              entry.push(s);
            }
          } else {
            (this._styles || (this._styles = [])).push(s);
          }
        }
      }
    }
    _getStyleAnchor(comp) {
      if (!comp) {
        return null;
      }
      const anchor = this._styleAnchors.get(comp);
      if (anchor && anchor.parentNode === this.shadowRoot) {
        return anchor;
      }
      if (anchor) {
        this._styleAnchors.delete(comp);
      }
      return null;
    }
    _getRootStyleInsertionAnchor(root) {
      for (let i = 0; i < root.childNodes.length; i++) {
        const node = root.childNodes[i];
        if (!(node instanceof HTMLStyleElement)) {
          return node;
        }
      }
      return null;
    }
    /**
     * Only called when shadowRoot is false
     */
    _parseSlots() {
      const slots = this._slots = {};
      let n;
      while (n = this.firstChild) {
        const slotName = n.nodeType === 1 && n.getAttribute("slot") || "default";
        (slots[slotName] || (slots[slotName] = [])).push(n);
        this.removeChild(n);
      }
    }
    /**
     * Only called when shadowRoot is false
     */
    _renderSlots() {
      const outlets = this._getSlots();
      const scopeId = this._instance.type.__scopeId;
      for (let i = 0; i < outlets.length; i++) {
        const o = outlets[i];
        const slotName = o.getAttribute("name") || "default";
        const content = this._slots[slotName];
        const parent = o.parentNode;
        if (content) {
          for (const n of content) {
            if (scopeId && n.nodeType === 1) {
              const id = scopeId + "-s";
              const walker = document.createTreeWalker(n, 1);
              n.setAttribute(id, "");
              let child;
              while (child = walker.nextNode()) {
                child.setAttribute(id, "");
              }
            }
            parent.insertBefore(n, o);
          }
        } else {
          while (o.firstChild) parent.insertBefore(o.firstChild, o);
        }
        parent.removeChild(o);
      }
    }
    /**
     * @internal
     */
    _getSlots() {
      const roots = [this];
      if (this._teleportTargets) {
        roots.push(...this._teleportTargets);
      }
      const slots = /* @__PURE__ */ new Set();
      for (const root of roots) {
        const found = root.querySelectorAll("slot");
        for (let i = 0; i < found.length; i++) {
          slots.add(found[i]);
        }
      }
      return Array.from(slots);
    }
    /**
     * @internal
     */
    _injectChildStyle(comp, parentComp) {
      this._applyStyles(comp.styles, comp, parentComp);
    }
    /**
     * @internal
     */
    _beginPatch() {
      this._patching = true;
      this._dirty = false;
    }
    /**
     * @internal
     */
    _endPatch() {
      this._patching = false;
      if (this._dirty && this._instance) {
        this._update();
      }
    }
    /**
     * @internal
     */
    _hasShadowRoot() {
      return this._def.shadowRoot !== false;
    }
    /**
     * @internal
     */
    _removeChildStyle(comp) {
      if (false) {
        this._styleChildren.delete(comp);
        this._styleAnchors.delete(comp);
        if (this._childStyles && comp.__hmrId) {
          const oldStyles = this._childStyles.get(comp.__hmrId);
          if (oldStyles) {
            oldStyles.forEach((s) => this._root.removeChild(s));
            oldStyles.length = 0;
          }
        }
      }
    }
  };
  function useHost(caller) {
    const instance = getCurrentInstance();
    const el = instance && instance.ce;
    if (el) {
      return el;
    } else if (false) {
      if (!instance) {
        warn2(
          `${caller || "useHost"} called without an active component instance.`
        );
      } else {
        warn2(
          `${caller || "useHost"} can only be used in components defined via defineCustomElement.`
        );
      }
    }
    return null;
  }
  function useShadowRoot() {
    const el = false ? useHost("useShadowRoot") : useHost();
    return el && el.shadowRoot;
  }
  function useCssModule(name = "$style") {
    {
      const instance = getCurrentInstance();
      if (!instance) {
        return EMPTY_OBJ;
      }
      const modules = instance.type.__cssModules;
      if (!modules) {
        return EMPTY_OBJ;
      }
      const mod = modules[name];
      if (!mod) {
        return EMPTY_OBJ;
      }
      return mod;
    }
  }
  var positionMap = /* @__PURE__ */ new WeakMap();
  var newPositionMap = /* @__PURE__ */ new WeakMap();
  var moveCbKey = /* @__PURE__ */ Symbol("_moveCb");
  var enterCbKey2 = /* @__PURE__ */ Symbol("_enterCb");
  var pendingGroups = /* @__PURE__ */ new WeakMap();
  var decorate = (t) => {
    delete t.props.mode;
    return t;
  };
  var TransitionGroupImpl = /* @__PURE__ */ decorate({
    name: "TransitionGroup",
    props: /* @__PURE__ */ extend({}, TransitionPropsValidators, {
      tag: String,
      moveClass: String
    }),
    setup(props, { slots }) {
      const instance = getCurrentInstance();
      const state = useTransitionState();
      let prevChildren;
      let children;
      let origins;
      let moves;
      const willMove = () => {
        if (moves === void 0) {
          moves = prevChildren.length > 0 && hasCSSTransform(
            prevChildren[0].el,
            instance.vnode.el,
            resolveMoveClass(props)
          );
        }
        return moves;
      };
      onUpdated(() => {
        pendingGroups.delete(instance);
        if (!willMove()) {
          prevChildren = [];
          origins = void 0;
          return;
        }
        const moveClass = resolveMoveClass(props);
        prevChildren.forEach(callPendingCbs);
        const shift = origins && getOriginShift(origins, instance.vnode.el);
        origins = void 0;
        prevChildren.forEach((c) => recordPosition(c, shift));
        const movedChildren = prevChildren.filter(applyTranslation);
        forceReflow(instance.vnode.el);
        movedChildren.forEach((c) => {
          const el = c.el;
          const style = el.style;
          addTransitionClass(el, moveClass);
          style.transform = style.webkitTransform = style.transitionDuration = "";
          const cb = el[moveCbKey] = (e) => {
            if (e && e.target !== el) {
              return;
            }
            if (!e || e.propertyName.endsWith("transform")) {
              el.removeEventListener("transitionend", cb);
              el[moveCbKey] = null;
              removeTransitionClass(el, moveClass);
            }
          };
          el.addEventListener("transitionend", cb);
        });
        prevChildren = [];
      });
      return () => {
        const rawProps = toRaw(props);
        const cssTransitionProps = resolveTransitionProps(rawProps);
        let tag = rawProps.tag || Fragment;
        prevChildren = [];
        moves = void 0;
        if (children) {
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.el && child.el instanceof Element && // Hidden v-show nodes have no previous layout box to animate from.
            !child.el[vShowHidden]) {
              prevChildren.push(child);
              setTransitionHooks(
                child,
                resolveTransitionHooks(
                  child,
                  cssTransitionProps,
                  state,
                  instance
                )
              );
              positionMap.set(child, getPosition(child.el));
            }
          }
        }
        children = slots.default ? getTransitionRawChildren(slots.default()) : [];
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.key != null) {
            setTransitionHooks(
              child,
              resolveTransitionHooks(child, cssTransitionProps, state, instance)
            );
          } else if (false) {
            warn2(`<TransitionGroup> children must be keyed.`);
          }
        }
        if (prevChildren.length) {
          origins = getOrigins(instance);
          pendingGroups.set(instance, willMove);
        }
        return createVNode(tag, null, children);
      };
    }
  });
  var TransitionGroup = TransitionGroupImpl;
  function callPendingCbs(c) {
    const el = c.el;
    if (el[moveCbKey]) {
      el[moveCbKey]();
    }
    if (el[enterCbKey2]) {
      el[enterCbKey2]();
    }
  }
  function resolveMoveClass(props) {
    return props.moveClass || `${props.name || "v"}-move`;
  }
  function recordPosition(c, shift) {
    newPositionMap.set(c, getPosition(c.el, shift));
  }
  function applyTranslation(c) {
    const oldPos = positionMap.get(c);
    const newPos = newPositionMap.get(c);
    const dx = oldPos.left - newPos.left;
    const dy = oldPos.top - newPos.top;
    if (dx || dy) {
      const el = c.el;
      const s = el.style;
      const rect = el.getBoundingClientRect();
      let scaleX = 1;
      let scaleY = 1;
      if (el.offsetWidth) scaleX = rect.width / el.offsetWidth;
      if (el.offsetHeight) scaleY = rect.height / el.offsetHeight;
      if (!Number.isFinite(scaleX) || scaleX === 0) scaleX = 1;
      if (!Number.isFinite(scaleY) || scaleY === 0) scaleY = 1;
      if (Math.abs(scaleX - 1) < 0.01) scaleX = 1;
      if (Math.abs(scaleY - 1) < 0.01) scaleY = 1;
      s.transform = s.webkitTransform = `translate(${dx / scaleX}px,${dy / scaleY}px)`;
      s.transitionDuration = "0s";
      return c;
    }
  }
  function getPosition(el, shift) {
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left - (shift ? shift.left : 0),
      top: rect.top - (shift ? shift.top : 0)
    };
  }
  function getOrigins(instance) {
    let origins;
    for (let group = instance.parent; group; group = group.parent) {
      const willMove = pendingGroups.get(group);
      if (willMove) {
        const item = findItem(group.vnode.el, instance.vnode.el);
        if (item) {
          (origins || (origins = [])).push(
            extend(getPosition(item), { item, willMove })
          );
        }
      }
    }
    return origins;
  }
  function findItem(root, node) {
    const container = root.nodeType === 1 ? root : root.parentNode;
    while (node && node.parentNode !== container) {
      node = node.parentNode;
    }
    if (node && node.nodeType === 1) {
      return node;
    }
  }
  function getOriginShift(origins, root) {
    const origin = origins.find((o) => o.willMove() && o.item.contains(root));
    return origin && getPosition(origin.item, origin);
  }
  function hasCSSTransform(el, root, moveClass) {
    const clone = el.cloneNode();
    const _vtc = el[vtcKey];
    if (_vtc) {
      _vtc.forEach((cls) => {
        cls.split(/\s+/).forEach((c) => c && clone.classList.remove(c));
      });
    }
    moveClass.split(/\s+/).forEach((c) => c && clone.classList.add(c));
    clone.style.display = "none";
    const container = root.nodeType === 1 ? root : root.parentNode;
    container.appendChild(clone);
    const { hasTransform } = getTransitionInfo(clone);
    container.removeChild(clone);
    return hasTransform;
  }
  var getModelAssigner = (vnode) => {
    const fn = vnode.props["onUpdate:modelValue"] || false;
    return isArray(fn) ? (value) => invokeArrayFns(fn, value) : fn;
  };
  function onCompositionStart(e) {
    e.target.composing = true;
  }
  function onCompositionEnd(e) {
    const target = e.target;
    if (target.composing) {
      target.composing = false;
      target.dispatchEvent(new Event("input"));
    }
  }
  var assignKey = /* @__PURE__ */ Symbol("_assign");
  var initialValueKey = /* @__PURE__ */ Symbol("_initialValue");
  function castValue(value, trim, number) {
    if (trim) value = value.trim();
    if (number) value = looseToNumber(value);
    return value;
  }
  var vModelText = {
    created(el, { modifiers: { lazy, trim, number } }, vnode) {
      if (el.parentNode) {
        if (el.type === "text") {
          el[initialValueKey] = el.defaultValue.replace(/[\r\n]/g, "");
        } else if (el.type === "textarea") {
          el[initialValueKey] = el.defaultValue.replace(/\r\n?/g, "\n");
        }
      }
      el[assignKey] = getModelAssigner(vnode);
      const castToNumber = number || vnode.props && vnode.props.type === "number";
      addEventListener(el, lazy ? "change" : "input", (e) => {
        if (e.target.composing) return;
        el[assignKey](castValue(el.value, trim, castToNumber));
      });
      if (trim || castToNumber) {
        addEventListener(el, "change", () => {
          el.value = castValue(el.value, trim, castToNumber);
        });
      }
      if (!lazy) {
        addEventListener(el, "compositionstart", onCompositionStart);
        addEventListener(el, "compositionend", onCompositionEnd);
        addEventListener(el, "change", onCompositionEnd);
      }
    },
    // set value on mounted so it's after min/max for type="range"
    mounted(el, { value, modifiers: { trim, number } }) {
      const newValue = value == null ? "" : value;
      const initialValue = el[initialValueKey];
      delete el[initialValueKey];
      if (initialValue !== void 0 && (el.type === "text" || el.type === "textarea") && el.value !== initialValue) {
        el[assignKey](castValue(el.value, trim, number));
      } else {
        el.value = newValue;
      }
    },
    beforeUpdate(el, { value, oldValue, modifiers: { lazy, trim, number } }, vnode) {
      el[assignKey] = getModelAssigner(vnode);
      if (el.composing) return;
      const elValue = (number || el.type === "number") && !/^0\d/.test(el.value) ? looseToNumber(el.value) : el.value;
      const newValue = value == null ? "" : value;
      if (elValue === newValue) {
        return;
      }
      const rootNode = el.getRootNode();
      if ((rootNode instanceof Document || rootNode instanceof ShadowRoot) && rootNode.activeElement === el && el.type !== "range") {
        if (lazy && value === oldValue) {
          return;
        }
        if (trim && el.value.trim() === newValue) {
          return;
        }
      }
      el.value = newValue;
    }
  };
  var vModelCheckbox = {
    // #4096 array checkboxes need to be deep traversed
    deep: true,
    created(el, _, vnode) {
      el[assignKey] = getModelAssigner(vnode);
      addEventListener(el, "change", () => {
        const modelValue = el._modelValue;
        const elementValue = getValue(el);
        const checked = el.checked;
        const assign = el[assignKey];
        if (isArray(modelValue)) {
          const index = looseIndexOf(modelValue, elementValue);
          const found = index !== -1;
          if (checked && !found) {
            assign(modelValue.concat(elementValue));
          } else if (!checked && found) {
            const filtered = [...modelValue];
            filtered.splice(index, 1);
            assign(filtered);
          }
        } else if (isSet(modelValue)) {
          const cloned = new Set(modelValue);
          if (checked) {
            cloned.add(elementValue);
          } else {
            cloned.delete(elementValue);
          }
          assign(cloned);
        } else {
          assign(getCheckboxValue(el, checked));
        }
      });
    },
    // set initial checked on mount to wait for true-value/false-value
    mounted: setChecked,
    beforeUpdate(el, binding, vnode) {
      el[assignKey] = getModelAssigner(vnode);
      setChecked(el, binding, vnode);
    }
  };
  function setChecked(el, { value, oldValue }, vnode) {
    el._modelValue = value;
    let checked;
    if (isArray(value)) {
      checked = looseIndexOf(value, vnode.props.value) > -1;
    } else if (isSet(value)) {
      checked = value.has(vnode.props.value);
    } else {
      if (value === oldValue) return;
      checked = looseEqual(value, getCheckboxValue(el, true));
    }
    if (el.checked !== checked) {
      el.checked = checked;
    }
  }
  var vModelRadio = {
    created(el, { value }, vnode) {
      el.checked = looseEqual(value, vnode.props.value);
      el[assignKey] = getModelAssigner(vnode);
      addEventListener(el, "change", () => {
        el[assignKey](getValue(el));
      });
    },
    beforeUpdate(el, { value, oldValue }, vnode) {
      el[assignKey] = getModelAssigner(vnode);
      if (value !== oldValue) {
        el.checked = looseEqual(value, vnode.props.value);
      }
    }
  };
  var vModelSelect = {
    // <select multiple> value need to be deep traversed
    deep: true,
    created(el, { value, modifiers: { number } }, vnode) {
      el._modelValue = value;
      addEventListener(el, "change", () => {
        const selectedVal = Array.prototype.filter.call(el.options, (o) => o.selected).map(
          (o) => number ? looseToNumber(getValue(o)) : getValue(o)
        );
        const multiple = el.multiple;
        const assignedValue = multiple ? isSet(el._modelValue) ? new Set(selectedVal) : selectedVal : selectedVal[0];
        const pending = el._pendingValue = [
          multiple,
          multiple ? isArray(assignedValue) ? selectedVal.slice() : selectedVal : assignedValue
        ];
        try {
          el[assignKey](assignedValue);
        } finally {
          nextTick(() => {
            if (el._pendingValue === pending) {
              el._pendingValue = void 0;
            }
          });
        }
      });
      el[assignKey] = getModelAssigner(vnode);
    },
    // set value in mounted & updated because <select> relies on its children
    // <option>s.
    mounted(el, { value }) {
      setSelected(el, value);
    },
    beforeUpdate(el, { value }, vnode) {
      el._modelValue = value;
      el[assignKey] = getModelAssigner(vnode);
    },
    updated(el, { value }) {
      const pending = el._pendingValue;
      el._pendingValue = void 0;
      if (!pending || pending[0] !== el.multiple || !isSameSelectValue(value, pending[1], pending[0])) {
        setSelected(el, value);
      }
    }
  };
  function isSameSelectValue(value, assignedValue, multiple) {
    if (!multiple) return looseEqual(value, assignedValue);
    if (isArray(value)) return looseEqual(value, assignedValue);
    if (isSet(value)) {
      if (value.size !== assignedValue.length) return false;
      for (const item of assignedValue) {
        if (!value.has(item)) return false;
      }
      return true;
    }
    return false;
  }
  function setSelected(el, value) {
    const isMultiple = el.multiple;
    const isArrayValue = isArray(value);
    if (isMultiple && !isArrayValue && !isSet(value)) {
      return;
    }
    for (let i = 0, l = el.options.length; i < l; i++) {
      const option = el.options[i];
      const optionValue = getValue(option);
      if (isMultiple) {
        if (isArrayValue) {
          const optionType = typeof optionValue;
          if (optionType === "string" || optionType === "number") {
            option.selected = value.some((v) => String(v) === String(optionValue));
          } else {
            option.selected = looseIndexOf(value, optionValue) > -1;
          }
        } else {
          option.selected = value.has(optionValue);
        }
      } else if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) el.selectedIndex = i;
        return;
      }
    }
    if (!isMultiple && el.selectedIndex !== -1) {
      el.selectedIndex = -1;
    }
  }
  function getValue(el) {
    return "_value" in el ? el._value : el.value;
  }
  function getCheckboxValue(el, checked) {
    const key = checked ? "_trueValue" : "_falseValue";
    return key in el ? el[key] : checked;
  }
  var vModelDynamic = {
    created(el, binding, vnode) {
      callModelHook(el, binding, vnode, null, "created");
    },
    mounted(el, binding, vnode) {
      callModelHook(el, binding, vnode, null, "mounted");
    },
    beforeUpdate(el, binding, vnode, prevVNode) {
      callModelHook(el, binding, vnode, prevVNode, "beforeUpdate");
    },
    updated(el, binding, vnode, prevVNode) {
      callModelHook(el, binding, vnode, prevVNode, "updated");
    }
  };
  function resolveDynamicModel(tagName, type) {
    switch (tagName) {
      case "SELECT":
        return vModelSelect;
      case "TEXTAREA":
        return vModelText;
      default:
        switch (type) {
          case "checkbox":
            return vModelCheckbox;
          case "radio":
            return vModelRadio;
          default:
            return vModelText;
        }
    }
  }
  function callModelHook(el, binding, vnode, prevVNode, hook) {
    const modelToUse = resolveDynamicModel(
      el.tagName,
      vnode.props && vnode.props.type
    );
    const fn = modelToUse[hook];
    fn && fn(el, binding, vnode, prevVNode);
  }
  function initVModelForSSR() {
    vModelText.getSSRProps = ({ value }) => ({ value });
    vModelRadio.getSSRProps = ({ value }, vnode) => {
      if (vnode.props && looseEqual(vnode.props.value, value)) {
        return { checked: true };
      }
    };
    vModelCheckbox.getSSRProps = ({ value }, vnode) => {
      if (isArray(value)) {
        if (vnode.props && looseIndexOf(value, vnode.props.value) > -1) {
          return { checked: true };
        }
      } else if (isSet(value)) {
        if (vnode.props && value.has(vnode.props.value)) {
          return { checked: true };
        }
      } else if (value) {
        return { checked: true };
      }
    };
    vModelDynamic.getSSRProps = (binding, vnode) => {
      if (typeof vnode.type !== "string") {
        return;
      }
      const modelToUse = resolveDynamicModel(
        // resolveDynamicModel expects an uppercase tag name, but vnode.type is lowercase
        vnode.type.toUpperCase(),
        vnode.props && vnode.props.type
      );
      if (modelToUse.getSSRProps) {
        return modelToUse.getSSRProps(binding, vnode);
      }
    };
  }
  var systemModifiers = ["ctrl", "shift", "alt", "meta"];
  var modifierGuards = {
    stop: (e) => e.stopPropagation(),
    prevent: (e) => e.preventDefault(),
    self: (e) => e.target !== e.currentTarget,
    ctrl: (e) => !e.ctrlKey,
    shift: (e) => !e.shiftKey,
    alt: (e) => !e.altKey,
    meta: (e) => !e.metaKey,
    left: (e) => "button" in e && e.button !== 0,
    middle: (e) => "button" in e && e.button !== 1,
    right: (e) => "button" in e && e.button !== 2,
    exact: (e, modifiers) => systemModifiers.some((m) => e[`${m}Key`] && !modifiers.includes(m))
  };
  var withModifiers = (fn, modifiers) => {
    if (!fn) return fn;
    const cache = fn._withMods || (fn._withMods = {});
    const cacheKey = modifiers.join(".");
    return cache[cacheKey] || (cache[cacheKey] = ((event, ...args) => {
      for (let i = 0; i < modifiers.length; i++) {
        const guard = modifierGuards[modifiers[i]];
        if (guard && guard(event, modifiers)) return;
      }
      return fn(event, ...args);
    }));
  };
  var keyNames = {
    esc: "escape",
    space: " ",
    up: "arrow-up",
    left: "arrow-left",
    right: "arrow-right",
    down: "arrow-down",
    delete: "backspace"
  };
  var withKeys = (fn, modifiers) => {
    const cache = fn._withKeys || (fn._withKeys = {});
    const cacheKey = modifiers.join(".");
    return cache[cacheKey] || (cache[cacheKey] = ((event) => {
      if (!("key" in event)) {
        return;
      }
      const eventKey = hyphenate(event.key);
      if (modifiers.some(
        (k) => k === eventKey || keyNames[k] === eventKey
      )) {
        return fn(event);
      }
    }));
  };
  var rendererOptions = /* @__PURE__ */ extend({ patchProp }, nodeOps);
  var renderer;
  var enabledHydration = false;
  function ensureRenderer() {
    return renderer || (renderer = createRenderer(rendererOptions));
  }
  function ensureHydrationRenderer() {
    renderer = enabledHydration ? renderer : createHydrationRenderer(rendererOptions);
    enabledHydration = true;
    return renderer;
  }
  var render = ((...args) => {
    ensureRenderer().render(...args);
  });
  var hydrate = ((...args) => {
    ensureHydrationRenderer().hydrate(...args);
  });
  var createApp = ((...args) => {
    const app = ensureRenderer().createApp(...args);
    if (false) {
      injectNativeTagCheck(app);
      injectCompilerOptionsCheck(app);
    }
    const { mount } = app;
    app.mount = (containerOrSelector) => {
      const container = normalizeContainer(containerOrSelector);
      if (!container) return;
      const component = app._component;
      if (!isFunction(component) && !component.render && !component.template) {
        component.template = container.innerHTML;
      }
      if (container.nodeType === 1) {
        container.textContent = "";
      }
      const proxy = mount(container, false, resolveRootNamespace(container));
      if (container instanceof Element) {
        container.removeAttribute("v-cloak");
        container.setAttribute("data-v-app", "");
      }
      return proxy;
    };
    return app;
  });
  var createSSRApp = ((...args) => {
    const app = ensureHydrationRenderer().createApp(...args);
    if (false) {
      injectNativeTagCheck(app);
      injectCompilerOptionsCheck(app);
    }
    const { mount } = app;
    app.mount = (containerOrSelector) => {
      const container = normalizeContainer(containerOrSelector);
      if (container) {
        return mount(container, true, resolveRootNamespace(container));
      }
    };
    return app;
  });
  function resolveRootNamespace(container) {
    if (container instanceof SVGElement) {
      return "svg";
    }
    if (typeof MathMLElement === "function" && container instanceof MathMLElement) {
      return "mathml";
    }
  }
  function normalizeContainer(container) {
    if (isString(container)) {
      const res = document.querySelector(container);
      if (false) {
        warn2(
          `Failed to mount app: mount target selector "${container}" returned null.`
        );
      }
      return res;
    }
    if (false) {
      warn2(
        `mounting on a ShadowRoot with \`{mode: "closed"}\` may lead to unpredictable bugs`
      );
    }
    return container;
  }
  var ssrDirectiveInitialized = false;
  var initDirectivesForSSR = () => {
    if (!ssrDirectiveInitialized) {
      ssrDirectiveInitialized = true;
      initVModelForSSR();
      initVShowForSSR();
    }
  };

  // node_modules/@vue/compiler-core/dist/compiler-core.esm-bundler.js
  /**
  * @vue/compiler-core v3.5.44
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  var FRAGMENT = /* @__PURE__ */ Symbol(false ? `Fragment` : ``);
  var TELEPORT = /* @__PURE__ */ Symbol(false ? `Teleport` : ``);
  var SUSPENSE = /* @__PURE__ */ Symbol(false ? `Suspense` : ``);
  var KEEP_ALIVE = /* @__PURE__ */ Symbol(false ? `KeepAlive` : ``);
  var BASE_TRANSITION = /* @__PURE__ */ Symbol(
    false ? `BaseTransition` : ``
  );
  var OPEN_BLOCK = /* @__PURE__ */ Symbol(false ? `openBlock` : ``);
  var CREATE_BLOCK = /* @__PURE__ */ Symbol(false ? `createBlock` : ``);
  var CREATE_ELEMENT_BLOCK = /* @__PURE__ */ Symbol(
    false ? `createElementBlock` : ``
  );
  var CREATE_VNODE = /* @__PURE__ */ Symbol(false ? `createVNode` : ``);
  var CREATE_ELEMENT_VNODE = /* @__PURE__ */ Symbol(
    false ? `createElementVNode` : ``
  );
  var CREATE_COMMENT = /* @__PURE__ */ Symbol(
    false ? `createCommentVNode` : ``
  );
  var CREATE_TEXT = /* @__PURE__ */ Symbol(
    false ? `createTextVNode` : ``
  );
  var CREATE_STATIC = /* @__PURE__ */ Symbol(
    false ? `createStaticVNode` : ``
  );
  var RESOLVE_COMPONENT = /* @__PURE__ */ Symbol(
    false ? `resolveComponent` : ``
  );
  var RESOLVE_DYNAMIC_COMPONENT = /* @__PURE__ */ Symbol(
    false ? `resolveDynamicComponent` : ``
  );
  var RESOLVE_DIRECTIVE = /* @__PURE__ */ Symbol(
    false ? `resolveDirective` : ``
  );
  var RESOLVE_FILTER = /* @__PURE__ */ Symbol(
    false ? `resolveFilter` : ``
  );
  var WITH_DIRECTIVES = /* @__PURE__ */ Symbol(
    false ? `withDirectives` : ``
  );
  var RENDER_LIST = /* @__PURE__ */ Symbol(false ? `renderList` : ``);
  var RENDER_SLOT = /* @__PURE__ */ Symbol(false ? `renderSlot` : ``);
  var CREATE_SLOTS = /* @__PURE__ */ Symbol(false ? `createSlots` : ``);
  var TO_DISPLAY_STRING = /* @__PURE__ */ Symbol(
    false ? `toDisplayString` : ``
  );
  var MERGE_PROPS = /* @__PURE__ */ Symbol(false ? `mergeProps` : ``);
  var NORMALIZE_CLASS = /* @__PURE__ */ Symbol(
    false ? `normalizeClass` : ``
  );
  var NORMALIZE_STYLE = /* @__PURE__ */ Symbol(
    false ? `normalizeStyle` : ``
  );
  var NORMALIZE_PROPS = /* @__PURE__ */ Symbol(
    false ? `normalizeProps` : ``
  );
  var GUARD_REACTIVE_PROPS = /* @__PURE__ */ Symbol(
    false ? `guardReactiveProps` : ``
  );
  var TO_HANDLERS = /* @__PURE__ */ Symbol(false ? `toHandlers` : ``);
  var CAMELIZE = /* @__PURE__ */ Symbol(false ? `camelize` : ``);
  var CAPITALIZE = /* @__PURE__ */ Symbol(false ? `capitalize` : ``);
  var TO_HANDLER_KEY = /* @__PURE__ */ Symbol(
    false ? `toHandlerKey` : ``
  );
  var SET_BLOCK_TRACKING = /* @__PURE__ */ Symbol(
    false ? `setBlockTracking` : ``
  );
  var PUSH_SCOPE_ID = /* @__PURE__ */ Symbol(false ? `pushScopeId` : ``);
  var POP_SCOPE_ID = /* @__PURE__ */ Symbol(false ? `popScopeId` : ``);
  var WITH_CTX = /* @__PURE__ */ Symbol(false ? `withCtx` : ``);
  var UNREF = /* @__PURE__ */ Symbol(false ? `unref` : ``);
  var IS_REF = /* @__PURE__ */ Symbol(false ? `isRef` : ``);
  var WITH_MEMO = /* @__PURE__ */ Symbol(false ? `withMemo` : ``);
  var IS_MEMO_SAME = /* @__PURE__ */ Symbol(false ? `isMemoSame` : ``);
  var helperNameMap = {
    [FRAGMENT]: `Fragment`,
    [TELEPORT]: `Teleport`,
    [SUSPENSE]: `Suspense`,
    [KEEP_ALIVE]: `KeepAlive`,
    [BASE_TRANSITION]: `BaseTransition`,
    [OPEN_BLOCK]: `openBlock`,
    [CREATE_BLOCK]: `createBlock`,
    [CREATE_ELEMENT_BLOCK]: `createElementBlock`,
    [CREATE_VNODE]: `createVNode`,
    [CREATE_ELEMENT_VNODE]: `createElementVNode`,
    [CREATE_COMMENT]: `createCommentVNode`,
    [CREATE_TEXT]: `createTextVNode`,
    [CREATE_STATIC]: `createStaticVNode`,
    [RESOLVE_COMPONENT]: `resolveComponent`,
    [RESOLVE_DYNAMIC_COMPONENT]: `resolveDynamicComponent`,
    [RESOLVE_DIRECTIVE]: `resolveDirective`,
    [RESOLVE_FILTER]: `resolveFilter`,
    [WITH_DIRECTIVES]: `withDirectives`,
    [RENDER_LIST]: `renderList`,
    [RENDER_SLOT]: `renderSlot`,
    [CREATE_SLOTS]: `createSlots`,
    [TO_DISPLAY_STRING]: `toDisplayString`,
    [MERGE_PROPS]: `mergeProps`,
    [NORMALIZE_CLASS]: `normalizeClass`,
    [NORMALIZE_STYLE]: `normalizeStyle`,
    [NORMALIZE_PROPS]: `normalizeProps`,
    [GUARD_REACTIVE_PROPS]: `guardReactiveProps`,
    [TO_HANDLERS]: `toHandlers`,
    [CAMELIZE]: `camelize`,
    [CAPITALIZE]: `capitalize`,
    [TO_HANDLER_KEY]: `toHandlerKey`,
    [SET_BLOCK_TRACKING]: `setBlockTracking`,
    [PUSH_SCOPE_ID]: `pushScopeId`,
    [POP_SCOPE_ID]: `popScopeId`,
    [WITH_CTX]: `withCtx`,
    [UNREF]: `unref`,
    [IS_REF]: `isRef`,
    [WITH_MEMO]: `withMemo`,
    [IS_MEMO_SAME]: `isMemoSame`
  };
  function registerRuntimeHelpers(helpers) {
    Object.getOwnPropertySymbols(helpers).forEach((s) => {
      helperNameMap[s] = helpers[s];
    });
  }
  var locStub = {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
    source: ""
  };
  function createRoot(children, source = "") {
    return {
      type: 0,
      source,
      children,
      helpers: /* @__PURE__ */ new Set(),
      components: [],
      directives: [],
      hoists: [],
      imports: [],
      cached: [],
      temps: 0,
      codegenNode: void 0,
      loc: locStub
    };
  }
  function createVNodeCall(context, tag, props, children, patchFlag, dynamicProps, directives, isBlock = false, disableTracking = false, isComponent2 = false, loc = locStub) {
    if (context) {
      if (isBlock) {
        context.helper(OPEN_BLOCK);
        context.helper(getVNodeBlockHelper(context.inSSR, isComponent2));
      } else {
        context.helper(getVNodeHelper(context.inSSR, isComponent2));
      }
      if (directives) {
        context.helper(WITH_DIRECTIVES);
      }
    }
    return {
      type: 13,
      tag,
      props,
      children,
      patchFlag,
      dynamicProps,
      directives,
      isBlock,
      disableTracking,
      isComponent: isComponent2,
      loc
    };
  }
  function createArrayExpression(elements, loc = locStub) {
    return {
      type: 17,
      loc,
      elements
    };
  }
  function createObjectExpression(properties, loc = locStub) {
    return {
      type: 15,
      loc,
      properties
    };
  }
  function createObjectProperty(key, value) {
    return {
      type: 16,
      loc: locStub,
      key: isString(key) ? createSimpleExpression(key, true) : key,
      value
    };
  }
  function createSimpleExpression(content, isStatic = false, loc = locStub, constType = 0) {
    return {
      type: 4,
      loc,
      content,
      isStatic,
      constType: isStatic ? 3 : constType
    };
  }
  function createCompoundExpression(children, loc = locStub) {
    return {
      type: 8,
      loc,
      children
    };
  }
  function createCallExpression(callee, args = [], loc = locStub) {
    return {
      type: 14,
      loc,
      callee,
      arguments: args
    };
  }
  function createFunctionExpression(params, returns = void 0, newline = false, isSlot = false, loc = locStub) {
    return {
      type: 18,
      params,
      returns,
      newline,
      isSlot,
      loc
    };
  }
  function createConditionalExpression(test, consequent, alternate, newline = true) {
    return {
      type: 19,
      test,
      consequent,
      alternate,
      newline,
      loc: locStub
    };
  }
  function createCacheExpression(index, value, needPauseTracking = false, inVOnce = false) {
    return {
      type: 20,
      index,
      value,
      needPauseTracking,
      inVOnce,
      needArraySpread: false,
      loc: locStub
    };
  }
  function createBlockStatement(body) {
    return {
      type: 21,
      body,
      loc: locStub
    };
  }
  function getVNodeHelper(ssr, isComponent2) {
    return ssr || isComponent2 ? CREATE_VNODE : CREATE_ELEMENT_VNODE;
  }
  function getVNodeBlockHelper(ssr, isComponent2) {
    return ssr || isComponent2 ? CREATE_BLOCK : CREATE_ELEMENT_BLOCK;
  }
  function convertToBlock(node, { helper, removeHelper, inSSR }) {
    if (!node.isBlock) {
      node.isBlock = true;
      removeHelper(getVNodeHelper(inSSR, node.isComponent));
      helper(OPEN_BLOCK);
      helper(getVNodeBlockHelper(inSSR, node.isComponent));
    }
  }
  var defaultDelimitersOpen = new Uint8Array([123, 123]);
  var defaultDelimitersClose = new Uint8Array([125, 125]);
  function isTagStartChar(c) {
    return c >= 97 && c <= 122 || c >= 65 && c <= 90;
  }
  function isWhitespace(c) {
    return c === 32 || c === 10 || c === 9 || c === 12 || c === 13;
  }
  function isEndOfTagSection(c) {
    return c === 47 || c === 62 || isWhitespace(c);
  }
  function toCharCodes(str) {
    const ret = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      ret[i] = str.charCodeAt(i);
    }
    return ret;
  }
  var Sequences = {
    Cdata: new Uint8Array([67, 68, 65, 84, 65, 91]),
    // CDATA[
    CdataEnd: new Uint8Array([93, 93, 62]),
    // ]]>
    CommentEnd: new Uint8Array([45, 45, 62]),
    // `-->`
    ScriptEnd: new Uint8Array([60, 47, 115, 99, 114, 105, 112, 116]),
    // `<\/script`
    StyleEnd: new Uint8Array([60, 47, 115, 116, 121, 108, 101]),
    // `</style`
    TitleEnd: new Uint8Array([60, 47, 116, 105, 116, 108, 101]),
    // `</title`
    TextareaEnd: new Uint8Array([
      60,
      47,
      116,
      101,
      120,
      116,
      97,
      114,
      101,
      97
    ])
    // `</textarea
  };
  var Tokenizer = class {
    constructor(stack3, cbs) {
      this.stack = stack3;
      this.cbs = cbs;
      this.state = 1;
      this.buffer = "";
      this.sectionStart = 0;
      this.index = 0;
      this.entityStart = 0;
      this.baseState = 1;
      this.inRCDATA = false;
      this.inXML = false;
      this.inVPre = false;
      this.newlines = [];
      this.mode = 0;
      this.delimiterOpen = defaultDelimitersOpen;
      this.delimiterClose = defaultDelimitersClose;
      this.delimiterIndex = -1;
      this.currentSequence = void 0;
      this.sequenceIndex = 0;
    }
    get inSFCRoot() {
      return this.mode === 2 && this.stack.length === 0;
    }
    reset() {
      this.state = 1;
      this.mode = 0;
      this.buffer = "";
      this.sectionStart = 0;
      this.index = 0;
      this.baseState = 1;
      this.inRCDATA = false;
      this.currentSequence = void 0;
      this.newlines.length = 0;
      this.delimiterOpen = defaultDelimitersOpen;
      this.delimiterClose = defaultDelimitersClose;
    }
    /**
     * Generate Position object with line / column information using recorded
     * newline positions. We know the index is always going to be an already
     * processed index, so all the newlines up to this index should have been
     * recorded.
     */
    getPos(index) {
      let line = 1;
      let column = index + 1;
      const length = this.newlines.length;
      let j = -1;
      if (length > 100) {
        let l = -1;
        let r = length;
        while (l + 1 < r) {
          const m = l + r >>> 1;
          this.newlines[m] < index ? l = m : r = m;
        }
        j = l;
      } else {
        for (let i = length - 1; i >= 0; i--) {
          if (index > this.newlines[i]) {
            j = i;
            break;
          }
        }
      }
      if (j >= 0) {
        line = j + 2;
        column = index - this.newlines[j];
      }
      return {
        column,
        line,
        offset: index
      };
    }
    peek() {
      return this.buffer.charCodeAt(this.index + 1);
    }
    stateText(c) {
      if (c === 60) {
        if (this.index > this.sectionStart) {
          this.cbs.ontext(this.sectionStart, this.index);
        }
        this.state = 5;
        this.sectionStart = this.index;
      } else if (!this.inVPre && c === this.delimiterOpen[0]) {
        this.state = 2;
        this.delimiterIndex = 0;
        this.stateInterpolationOpen(c);
      }
    }
    stateInterpolationOpen(c) {
      if (c === this.delimiterOpen[this.delimiterIndex]) {
        if (this.delimiterIndex === this.delimiterOpen.length - 1) {
          const start = this.index + 1 - this.delimiterOpen.length;
          if (start > this.sectionStart) {
            this.cbs.ontext(this.sectionStart, start);
          }
          this.state = 3;
          this.sectionStart = start;
        } else {
          this.delimiterIndex++;
        }
      } else if (this.inRCDATA) {
        this.state = 32;
        this.stateInRCDATA(c);
      } else {
        this.state = 1;
        this.stateText(c);
      }
    }
    stateInterpolation(c) {
      if (c === this.delimiterClose[0]) {
        this.state = 4;
        this.delimiterIndex = 0;
        this.stateInterpolationClose(c);
      }
    }
    stateInterpolationClose(c) {
      if (c === this.delimiterClose[this.delimiterIndex]) {
        if (this.delimiterIndex === this.delimiterClose.length - 1) {
          this.cbs.oninterpolation(this.sectionStart, this.index + 1);
          if (this.inRCDATA) {
            this.state = 32;
          } else {
            this.state = 1;
          }
          this.sectionStart = this.index + 1;
        } else {
          this.delimiterIndex++;
        }
      } else {
        this.state = 3;
        this.stateInterpolation(c);
      }
    }
    stateSpecialStartSequence(c) {
      const isEnd = this.sequenceIndex === this.currentSequence.length;
      const isMatch = isEnd ? (
        // If we are at the end of the sequence, make sure the tag name has ended
        isEndOfTagSection(c)
      ) : (
        // Otherwise, do a case-insensitive comparison
        (c | 32) === this.currentSequence[this.sequenceIndex]
      );
      if (!isMatch) {
        this.inRCDATA = false;
      } else if (!isEnd) {
        this.sequenceIndex++;
        return;
      }
      this.sequenceIndex = 0;
      this.state = 6;
      this.stateInTagName(c);
    }
    /** Look for an end tag. For <title> and <textarea>, also decode entities. */
    stateInRCDATA(c) {
      if (this.sequenceIndex === this.currentSequence.length) {
        if (c === 62 || isWhitespace(c)) {
          const endOfText = this.index - this.currentSequence.length;
          if (this.sectionStart < endOfText) {
            const actualIndex = this.index;
            this.index = endOfText;
            this.cbs.ontext(this.sectionStart, endOfText);
            this.index = actualIndex;
          }
          this.sectionStart = endOfText + 2;
          this.stateInClosingTagName(c);
          this.inRCDATA = false;
          return;
        }
        this.sequenceIndex = 0;
      }
      if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
        this.sequenceIndex += 1;
      } else if (this.sequenceIndex === 0) {
        if (this.currentSequence === Sequences.TitleEnd || this.currentSequence === Sequences.TextareaEnd && !this.inSFCRoot) {
          if (!this.inVPre && c === this.delimiterOpen[0]) {
            this.state = 2;
            this.delimiterIndex = 0;
            this.stateInterpolationOpen(c);
          }
        } else if (this.fastForwardTo(60)) {
          this.sequenceIndex = 1;
        }
      } else {
        this.sequenceIndex = Number(c === 60);
      }
    }
    stateCDATASequence(c) {
      if (c === Sequences.Cdata[this.sequenceIndex]) {
        if (++this.sequenceIndex === Sequences.Cdata.length) {
          this.state = 28;
          this.currentSequence = Sequences.CdataEnd;
          this.sequenceIndex = 0;
          this.sectionStart = this.index + 1;
        }
      } else {
        this.sequenceIndex = 0;
        this.state = 23;
        this.stateInDeclaration(c);
      }
    }
    /**
     * When we wait for one specific character, we can speed things up
     * by skipping through the buffer until we find it.
     *
     * @returns Whether the character was found.
     */
    fastForwardTo(c) {
      while (++this.index < this.buffer.length) {
        const cc = this.buffer.charCodeAt(this.index);
        if (cc === 10) {
          this.newlines.push(this.index);
        }
        if (cc === c) {
          return true;
        }
      }
      this.index = this.buffer.length - 1;
      return false;
    }
    /**
     * Comments and CDATA end with `-->` and `]]>`.
     *
     * Their common qualities are:
     * - Their end sequences have a distinct character they start with.
     * - That character is then repeated, so we have to check multiple repeats.
     * - All characters but the start character of the sequence can be skipped.
     */
    stateInCommentLike(c) {
      if (c === this.currentSequence[this.sequenceIndex]) {
        if (++this.sequenceIndex === this.currentSequence.length) {
          if (this.currentSequence === Sequences.CdataEnd) {
            this.cbs.oncdata(this.sectionStart, this.index - 2);
          } else {
            this.cbs.oncomment(this.sectionStart, this.index - 2);
          }
          this.sequenceIndex = 0;
          this.sectionStart = this.index + 1;
          this.state = 1;
        }
      } else if (this.sequenceIndex === 0) {
        if (this.fastForwardTo(this.currentSequence[0])) {
          this.sequenceIndex = 1;
        }
      } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
        this.sequenceIndex = 0;
      }
    }
    startSpecial(sequence, offset) {
      this.enterRCDATA(sequence, offset);
      this.state = 31;
    }
    enterRCDATA(sequence, offset) {
      this.inRCDATA = true;
      this.currentSequence = sequence;
      this.sequenceIndex = offset;
    }
    stateBeforeTagName(c) {
      if (c === 33) {
        this.state = 22;
        this.sectionStart = this.index + 1;
      } else if (c === 63) {
        this.state = 24;
        this.sectionStart = this.index + 1;
      } else if (isTagStartChar(c)) {
        this.sectionStart = this.index;
        if (this.mode === 0) {
          this.state = 6;
        } else if (this.inSFCRoot) {
          this.state = 34;
        } else if (!this.inXML) {
          if (c === 116) {
            this.state = 30;
          } else {
            this.state = c === 115 ? 29 : 6;
          }
        } else {
          this.state = 6;
        }
      } else if (c === 47) {
        this.state = 8;
      } else {
        this.state = 1;
        this.stateText(c);
      }
    }
    stateInTagName(c) {
      if (isEndOfTagSection(c)) {
        this.handleTagName(c);
      }
    }
    stateInSFCRootTagName(c) {
      if (isEndOfTagSection(c)) {
        const tag = this.buffer.slice(this.sectionStart, this.index);
        if (tag !== "template") {
          this.enterRCDATA(toCharCodes(`</` + tag), 0);
        }
        this.handleTagName(c);
      }
    }
    handleTagName(c) {
      this.cbs.onopentagname(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = 11;
      this.stateBeforeAttrName(c);
    }
    stateBeforeClosingTagName(c) {
      if (isWhitespace(c)) ;
      else if (c === 62) {
        if (false) {
          this.cbs.onerr(14, this.index);
        }
        this.state = 1;
        this.sectionStart = this.index + 1;
      } else {
        this.state = isTagStartChar(c) ? 9 : 27;
        this.sectionStart = this.index;
      }
    }
    stateInClosingTagName(c) {
      if (c === 62 || isWhitespace(c)) {
        this.cbs.onclosetag(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.state = 10;
        this.stateAfterClosingTagName(c);
      }
    }
    stateAfterClosingTagName(c) {
      if (c === 62) {
        this.state = 1;
        this.sectionStart = this.index + 1;
      }
    }
    stateBeforeAttrName(c) {
      if (c === 62) {
        this.cbs.onopentagend(this.index);
        if (this.inRCDATA) {
          this.state = 32;
        } else {
          this.state = 1;
        }
        this.sectionStart = this.index + 1;
      } else if (c === 47) {
        this.state = 7;
        if (false) {
          this.cbs.onerr(22, this.index);
        }
      } else if (c === 60 && this.peek() === 47) {
        this.cbs.onopentagend(this.index);
        this.state = 5;
        this.sectionStart = this.index;
      } else if (!isWhitespace(c)) {
        if (false) {
          this.cbs.onerr(
            19,
            this.index
          );
        }
        this.handleAttrStart(c);
      }
    }
    handleAttrStart(c) {
      if (c === 118 && this.peek() === 45) {
        this.state = 13;
        this.sectionStart = this.index;
      } else if (c === 46 || c === 58 || c === 64 || c === 35) {
        this.cbs.ondirname(this.index, this.index + 1);
        this.state = 14;
        this.sectionStart = this.index + 1;
      } else {
        this.state = 12;
        this.sectionStart = this.index;
      }
    }
    stateInSelfClosingTag(c) {
      if (c === 62) {
        this.cbs.onselfclosingtag(this.index);
        this.state = 1;
        this.sectionStart = this.index + 1;
        this.inRCDATA = false;
      } else if (!isWhitespace(c)) {
        this.state = 11;
        this.stateBeforeAttrName(c);
      }
    }
    stateInAttrName(c) {
      if (c === 61 || isEndOfTagSection(c)) {
        this.cbs.onattribname(this.sectionStart, this.index);
        this.handleAttrNameEnd(c);
      } else if (false) {
        this.cbs.onerr(
          17,
          this.index
        );
      }
    }
    stateInDirName(c) {
      if (c === 61 || isEndOfTagSection(c)) {
        this.cbs.ondirname(this.sectionStart, this.index);
        this.handleAttrNameEnd(c);
      } else if (c === 58) {
        this.cbs.ondirname(this.sectionStart, this.index);
        this.state = 14;
        this.sectionStart = this.index + 1;
      } else if (c === 46) {
        this.cbs.ondirname(this.sectionStart, this.index);
        this.state = 16;
        this.sectionStart = this.index + 1;
      }
    }
    stateInDirArg(c) {
      if (c === 61 || isEndOfTagSection(c)) {
        this.cbs.ondirarg(this.sectionStart, this.index);
        this.handleAttrNameEnd(c);
      } else if (c === 91) {
        this.state = 15;
      } else if (c === 46) {
        this.cbs.ondirarg(this.sectionStart, this.index);
        this.state = 16;
        this.sectionStart = this.index + 1;
      }
    }
    stateInDynamicDirArg(c) {
      if (c === 93) {
        this.state = 14;
      } else if (c === 61 || isEndOfTagSection(c)) {
        this.cbs.ondirarg(this.sectionStart, this.index + 1);
        this.handleAttrNameEnd(c);
        if (false) {
          this.cbs.onerr(
            27,
            this.index
          );
        }
      }
    }
    stateInDirModifier(c) {
      if (c === 61 || isEndOfTagSection(c)) {
        this.cbs.ondirmodifier(this.sectionStart, this.index);
        this.handleAttrNameEnd(c);
      } else if (c === 46) {
        this.cbs.ondirmodifier(this.sectionStart, this.index);
        this.sectionStart = this.index + 1;
      }
    }
    handleAttrNameEnd(c) {
      this.sectionStart = this.index;
      this.state = 17;
      this.cbs.onattribnameend(this.index);
      this.stateAfterAttrName(c);
    }
    stateAfterAttrName(c) {
      if (c === 61) {
        this.state = 18;
      } else if (c === 47 || c === 62) {
        this.cbs.onattribend(0, this.sectionStart);
        this.sectionStart = -1;
        this.state = 11;
        this.stateBeforeAttrName(c);
      } else if (!isWhitespace(c)) {
        this.cbs.onattribend(0, this.sectionStart);
        this.handleAttrStart(c);
      }
    }
    stateBeforeAttrValue(c) {
      if (c === 34) {
        this.state = 19;
        this.sectionStart = this.index + 1;
      } else if (c === 39) {
        this.state = 20;
        this.sectionStart = this.index + 1;
      } else if (!isWhitespace(c)) {
        this.sectionStart = this.index;
        this.state = 21;
        this.stateInAttrValueNoQuotes(c);
      }
    }
    handleInAttrValue(c, quote) {
      if (c === quote || this.fastForwardTo(quote)) {
        this.cbs.onattribdata(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.cbs.onattribend(
          quote === 34 ? 3 : 2,
          this.index + 1
        );
        this.state = 11;
      }
    }
    stateInAttrValueDoubleQuotes(c) {
      this.handleInAttrValue(c, 34);
    }
    stateInAttrValueSingleQuotes(c) {
      this.handleInAttrValue(c, 39);
    }
    stateInAttrValueNoQuotes(c) {
      if (isWhitespace(c) || c === 62) {
        this.cbs.onattribdata(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.cbs.onattribend(1, this.index);
        this.state = 11;
        this.stateBeforeAttrName(c);
      } else if (c === 39 || c === 60 || c === 61 || c === 96) {
        this.cbs.onerr(
          18,
          this.index
        );
      } else ;
    }
    stateBeforeDeclaration(c) {
      if (c === 91) {
        this.state = 26;
        this.sequenceIndex = 0;
      } else {
        this.state = c === 45 ? 25 : 23;
      }
    }
    stateInDeclaration(c) {
      if (c === 62 || this.fastForwardTo(62)) {
        this.state = 1;
        this.sectionStart = this.index + 1;
      }
    }
    stateInProcessingInstruction(c) {
      if (c === 62 || this.fastForwardTo(62)) {
        this.cbs.onprocessinginstruction(this.sectionStart, this.index);
        this.state = 1;
        this.sectionStart = this.index + 1;
      }
    }
    stateBeforeComment(c) {
      if (c === 45) {
        this.state = 28;
        this.currentSequence = Sequences.CommentEnd;
        this.sequenceIndex = 2;
        this.sectionStart = this.index + 1;
      } else {
        this.state = 23;
      }
    }
    stateInSpecialComment(c) {
      if (c === 62 || this.fastForwardTo(62)) {
        this.cbs.oncomment(this.sectionStart, this.index);
        this.state = 1;
        this.sectionStart = this.index + 1;
      }
    }
    stateBeforeSpecialS(c) {
      if (c === Sequences.ScriptEnd[3]) {
        this.startSpecial(Sequences.ScriptEnd, 4);
      } else if (c === Sequences.StyleEnd[3]) {
        this.startSpecial(Sequences.StyleEnd, 4);
      } else {
        this.state = 6;
        this.stateInTagName(c);
      }
    }
    stateBeforeSpecialT(c) {
      if (c === Sequences.TitleEnd[3]) {
        this.startSpecial(Sequences.TitleEnd, 4);
      } else if (c === Sequences.TextareaEnd[3]) {
        this.startSpecial(Sequences.TextareaEnd, 4);
      } else {
        this.state = 6;
        this.stateInTagName(c);
      }
    }
    startEntity() {
    }
    stateInEntity() {
    }
    /**
     * Iterates through the buffer, calling the function corresponding to the current state.
     *
     * States that are more likely to be hit are higher up, as a performance improvement.
     */
    parse(input) {
      this.buffer = input;
      while (this.index < this.buffer.length) {
        const c = this.buffer.charCodeAt(this.index);
        if (c === 10 && this.state !== 33) {
          this.newlines.push(this.index);
        }
        switch (this.state) {
          case 1: {
            this.stateText(c);
            break;
          }
          case 2: {
            this.stateInterpolationOpen(c);
            break;
          }
          case 3: {
            this.stateInterpolation(c);
            break;
          }
          case 4: {
            this.stateInterpolationClose(c);
            break;
          }
          case 31: {
            this.stateSpecialStartSequence(c);
            break;
          }
          case 32: {
            this.stateInRCDATA(c);
            break;
          }
          case 26: {
            this.stateCDATASequence(c);
            break;
          }
          case 19: {
            this.stateInAttrValueDoubleQuotes(c);
            break;
          }
          case 12: {
            this.stateInAttrName(c);
            break;
          }
          case 13: {
            this.stateInDirName(c);
            break;
          }
          case 14: {
            this.stateInDirArg(c);
            break;
          }
          case 15: {
            this.stateInDynamicDirArg(c);
            break;
          }
          case 16: {
            this.stateInDirModifier(c);
            break;
          }
          case 28: {
            this.stateInCommentLike(c);
            break;
          }
          case 27: {
            this.stateInSpecialComment(c);
            break;
          }
          case 11: {
            this.stateBeforeAttrName(c);
            break;
          }
          case 6: {
            this.stateInTagName(c);
            break;
          }
          case 34: {
            this.stateInSFCRootTagName(c);
            break;
          }
          case 9: {
            this.stateInClosingTagName(c);
            break;
          }
          case 5: {
            this.stateBeforeTagName(c);
            break;
          }
          case 17: {
            this.stateAfterAttrName(c);
            break;
          }
          case 20: {
            this.stateInAttrValueSingleQuotes(c);
            break;
          }
          case 18: {
            this.stateBeforeAttrValue(c);
            break;
          }
          case 8: {
            this.stateBeforeClosingTagName(c);
            break;
          }
          case 10: {
            this.stateAfterClosingTagName(c);
            break;
          }
          case 29: {
            this.stateBeforeSpecialS(c);
            break;
          }
          case 30: {
            this.stateBeforeSpecialT(c);
            break;
          }
          case 21: {
            this.stateInAttrValueNoQuotes(c);
            break;
          }
          case 7: {
            this.stateInSelfClosingTag(c);
            break;
          }
          case 23: {
            this.stateInDeclaration(c);
            break;
          }
          case 22: {
            this.stateBeforeDeclaration(c);
            break;
          }
          case 25: {
            this.stateBeforeComment(c);
            break;
          }
          case 24: {
            this.stateInProcessingInstruction(c);
            break;
          }
          case 33: {
            this.stateInEntity();
            break;
          }
        }
        this.index++;
      }
      this.cleanup();
      this.finish();
    }
    /**
     * Remove data that has already been consumed from the buffer.
     */
    cleanup() {
      if (this.sectionStart !== this.index) {
        if (this.state === 1 || this.state === 32 && this.sequenceIndex === 0) {
          this.cbs.ontext(this.sectionStart, this.index);
          this.sectionStart = this.index;
        } else if (this.state === 19 || this.state === 20 || this.state === 21) {
          this.cbs.onattribdata(this.sectionStart, this.index);
          this.sectionStart = this.index;
        }
      }
    }
    finish() {
      this.handleTrailingData();
      this.cbs.onend();
    }
    /** Handle any trailing data. */
    handleTrailingData() {
      const endIndex = this.buffer.length;
      if (this.sectionStart >= endIndex) {
        return;
      }
      if (this.state === 28) {
        if (this.currentSequence === Sequences.CdataEnd) {
          this.cbs.oncdata(this.sectionStart, endIndex);
        } else {
          this.cbs.oncomment(this.sectionStart, endIndex);
        }
      } else if (this.state === 6 || this.state === 11 || this.state === 18 || this.state === 17 || this.state === 12 || this.state === 13 || this.state === 14 || this.state === 15 || this.state === 16 || this.state === 20 || this.state === 19 || this.state === 21 || this.state === 9) ;
      else {
        this.cbs.ontext(this.sectionStart, endIndex);
      }
    }
    emitCodePoint(cp, consumed) {
    }
  };
  function getCompatValue(key, { compatConfig }) {
    const value = compatConfig && compatConfig[key];
    if (key === "MODE") {
      return value || 3;
    } else {
      return value;
    }
  }
  function isCompatEnabled(key, context) {
    const mode = getCompatValue("MODE", context);
    const value = getCompatValue(key, context);
    return mode === 3 ? value === true : value !== false;
  }
  function checkCompatEnabled(key, context, loc, ...args) {
    const enabled = isCompatEnabled(key, context);
    if (false) {
      warnDeprecation(key, context, loc, ...args);
    }
    return enabled;
  }
  function defaultOnError(error) {
    throw error;
  }
  function defaultOnWarn(msg) {
  }
  function createCompilerError(code, loc, messages, additionalMessage) {
    const msg = false ? (messages || errorMessages)[code] + (additionalMessage || ``) : `https://vuejs.org/error-reference/#compiler-${code}`;
    const error = new SyntaxError(String(msg));
    error.code = code;
    error.loc = loc;
    return error;
  }
  var isStaticExp = (p2) => p2.type === 4 && p2.isStatic;
  function isCoreComponent(tag) {
    switch (tag) {
      case "Teleport":
      case "teleport":
        return TELEPORT;
      case "Suspense":
      case "suspense":
        return SUSPENSE;
      case "KeepAlive":
      case "keep-alive":
        return KEEP_ALIVE;
      case "BaseTransition":
      case "base-transition":
        return BASE_TRANSITION;
    }
  }
  var nonIdentifierRE = /^$|^\d|[^\$\w\xA0-\uFFFF]/;
  var isSimpleIdentifier = (name) => !nonIdentifierRE.test(name);
  var validFirstIdentCharRE = /[A-Za-z_$\xA0-\uFFFF]/;
  var validIdentCharRE = /[\.\?\w$\xA0-\uFFFF]/;
  var whitespaceRE = /\s+[.[]\s*|\s*[.[]\s+/g;
  var getExpSource = (exp) => exp.type === 4 ? exp.content : exp.loc.source;
  var isMemberExpressionBrowser = (exp) => {
    const path = getExpSource(exp).trim().replace(whitespaceRE, (s) => s.trim());
    let state = 0;
    let stateStack = [];
    let currentOpenBracketCount = 0;
    let currentOpenParensCount = 0;
    let currentStringType = null;
    for (let i = 0; i < path.length; i++) {
      const char = path.charAt(i);
      switch (state) {
        case 0:
          if (char === "[") {
            stateStack.push(state);
            state = 1;
            currentOpenBracketCount++;
          } else if (char === "(") {
            stateStack.push(state);
            state = 2;
            currentOpenParensCount++;
          } else if (!(i === 0 ? validFirstIdentCharRE : validIdentCharRE).test(char)) {
            return false;
          }
          break;
        case 1:
          if (char === `'` || char === `"` || char === "`") {
            stateStack.push(state);
            state = 3;
            currentStringType = char;
          } else if (char === `[`) {
            currentOpenBracketCount++;
          } else if (char === `]`) {
            if (!--currentOpenBracketCount) {
              state = stateStack.pop();
            }
          }
          break;
        case 2:
          if (char === `'` || char === `"` || char === "`") {
            stateStack.push(state);
            state = 3;
            currentStringType = char;
          } else if (char === `(`) {
            currentOpenParensCount++;
          } else if (char === `)`) {
            if (i === path.length - 1) {
              return false;
            }
            if (!--currentOpenParensCount) {
              state = stateStack.pop();
            }
          }
          break;
        case 3:
          if (char === currentStringType) {
            state = stateStack.pop();
            currentStringType = null;
          }
          break;
      }
    }
    return !currentOpenBracketCount && !currentOpenParensCount;
  };
  var isMemberExpression = isMemberExpressionBrowser;
  var fnExpRE = /^\s*(?:async\s*)?(?:\([^)]*?\)|[\w$_]+)\s*(?::[^=]+)?=>|^\s*(?:async\s+)?function(?:\s+[\w$]+)?\s*\(/;
  var isFnExpressionBrowser = (exp) => fnExpRE.test(getExpSource(exp));
  var isFnExpression = isFnExpressionBrowser;
  function findDir(node, name, allowEmpty = false) {
    for (let i = 0; i < node.props.length; i++) {
      const p2 = node.props[i];
      if (p2.type === 7 && (allowEmpty || p2.exp) && (isString(name) ? p2.name === name : name.test(p2.name))) {
        return p2;
      }
    }
  }
  function findProp(node, name, dynamicOnly = false, allowEmpty = false) {
    for (let i = 0; i < node.props.length; i++) {
      const p2 = node.props[i];
      if (p2.type === 6) {
        if (dynamicOnly) continue;
        if (p2.name === name && (p2.value || allowEmpty)) {
          return p2;
        }
      } else if (p2.name === "bind" && (p2.exp || allowEmpty) && isStaticArgOf(p2.arg, name)) {
        return p2;
      }
    }
  }
  function isStaticArgOf(arg, name) {
    return !!(arg && isStaticExp(arg) && arg.content === name);
  }
  function hasDynamicKeyVBind(node) {
    return node.props.some(
      (p2) => p2.type === 7 && p2.name === "bind" && (!p2.arg || // v-bind="obj"
      p2.arg.type !== 4 || // v-bind:[_ctx.foo]
      !p2.arg.isStatic)
      // v-bind:[foo]
    );
  }
  function isText$1(node) {
    return node.type === 5 || node.type === 2;
  }
  function isVPre(p2) {
    return p2.type === 7 && p2.name === "pre";
  }
  function isVSlot(p2) {
    return p2.type === 7 && p2.name === "slot";
  }
  function isTemplateNode(node) {
    return node.type === 1 && node.tagType === 3;
  }
  function isSlotOutlet(node) {
    return node.type === 1 && node.tagType === 2;
  }
  var propsHelperSet = /* @__PURE__ */ new Set([NORMALIZE_PROPS, GUARD_REACTIVE_PROPS]);
  function getUnnormalizedProps(props, callPath = []) {
    if (props && !isString(props) && props.type === 14) {
      const callee = props.callee;
      if (!isString(callee) && propsHelperSet.has(callee)) {
        return getUnnormalizedProps(
          props.arguments[0],
          callPath.concat(props)
        );
      }
    }
    return [props, callPath];
  }
  function injectProp(node, prop, context) {
    if (node.type !== 13 && injectSlotKey(node, prop)) {
      return;
    }
    let propsWithInjection;
    let props = node.type === 13 ? node.props : node.arguments[2];
    let callPath = [];
    let parentCall;
    if (props && !isString(props) && props.type === 14) {
      const ret = getUnnormalizedProps(props);
      props = ret[0];
      callPath = ret[1];
      parentCall = callPath[callPath.length - 1];
    }
    if (props == null || isString(props)) {
      propsWithInjection = createObjectExpression([prop]);
    } else if (props.type === 14) {
      const first = props.arguments[0];
      if (!isString(first) && first.type === 15) {
        if (!hasProp(prop, first)) {
          first.properties.unshift(prop);
        }
      } else {
        if (props.callee === TO_HANDLERS) {
          propsWithInjection = createCallExpression(context.helper(MERGE_PROPS), [
            createObjectExpression([prop]),
            props
          ]);
        } else {
          props.arguments.unshift(createObjectExpression([prop]));
        }
      }
      !propsWithInjection && (propsWithInjection = props);
    } else if (props.type === 15) {
      if (!hasProp(prop, props)) {
        props.properties.unshift(prop);
      }
      propsWithInjection = props;
    } else {
      propsWithInjection = createCallExpression(context.helper(MERGE_PROPS), [
        createObjectExpression([prop]),
        props
      ]);
      if (parentCall && parentCall.callee === GUARD_REACTIVE_PROPS) {
        parentCall = callPath[callPath.length - 2];
      }
    }
    if (node.type === 13) {
      if (parentCall) {
        parentCall.arguments[0] = propsWithInjection;
      } else {
        node.props = propsWithInjection;
      }
    } else {
      if (parentCall) {
        parentCall.arguments[0] = propsWithInjection;
      } else {
        node.arguments[2] = propsWithInjection;
      }
    }
  }
  function injectSlotKey(node, prop) {
    var _a, _b, _c;
    if (prop.key.type !== 4 || prop.key.content !== "key") {
      return false;
    }
    const props = node.arguments[2];
    if (props && !isString(props)) {
      const [unnormalizedProps] = getUnnormalizedProps(props);
      if (unnormalizedProps && !isString(unnormalizedProps) && unnormalizedProps.type === 15 && hasProp(prop, unnormalizedProps)) {
        return true;
      }
    }
    (_a = node.arguments)[2] || (_a[2] = "{}");
    (_b = node.arguments)[3] || (_b[3] = "undefined");
    (_c = node.arguments)[4] || (_c[4] = "undefined");
    node.arguments[5] = prop.value;
    return true;
  }
  function hasProp(prop, props) {
    let result = false;
    if (prop.key.type === 4) {
      const propKeyName = prop.key.content;
      result = props.properties.some(
        (p2) => p2.key.type === 4 && p2.key.content === propKeyName
      );
    }
    return result;
  }
  function toValidAssetId(name, type) {
    return `_${type}_${name.replace(/[^\w]/g, (searchValue, replaceValue) => {
      return searchValue === "-" ? "_" : name.charCodeAt(replaceValue).toString();
    })}`;
  }
  function getMemoedVNodeCall(node) {
    if (node.type === 14 && node.callee === WITH_MEMO) {
      return node.arguments[1].returns;
    } else {
      return node;
    }
  }
  var forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+(\S[\s\S]*)/;
  function isAllWhitespace(str) {
    for (let i = 0; i < str.length; i++) {
      if (!isWhitespace(str.charCodeAt(i))) {
        return false;
      }
    }
    return true;
  }
  function isWhitespaceText(node) {
    return node.type === 2 && isAllWhitespace(node.content) || node.type === 12 && isWhitespaceText(node.content);
  }
  function isCommentOrWhitespace(node) {
    return node.type === 3 || isWhitespaceText(node);
  }
  var defaultParserOptions = {
    parseMode: "base",
    ns: 0,
    delimiters: [`{{`, `}}`],
    getNamespace: () => 0,
    isVoidTag: NO,
    isPreTag: NO,
    isIgnoreNewlineTag: NO,
    isCustomElement: NO,
    onError: defaultOnError,
    onWarn: defaultOnWarn,
    comments: false,
    prefixIdentifiers: false
  };
  var currentOptions = defaultParserOptions;
  var currentRoot = null;
  var currentInput = "";
  var currentOpenTag = null;
  var currentProp = null;
  var currentAttrValue = "";
  var currentAttrStartIndex = -1;
  var currentAttrEndIndex = -1;
  var inPre = 0;
  var inVPre = false;
  var currentVPreBoundary = null;
  var stack2 = [];
  var tokenizer = new Tokenizer(stack2, {
    onerr: emitError,
    ontext(start, end) {
      onText(getSlice(start, end), start, end);
    },
    ontextentity(char, start, end) {
      onText(char, start, end);
    },
    oninterpolation(start, end) {
      if (inVPre) {
        return onText(getSlice(start, end), start, end);
      }
      let innerStart = start + tokenizer.delimiterOpen.length;
      let innerEnd = end - tokenizer.delimiterClose.length;
      while (isWhitespace(currentInput.charCodeAt(innerStart))) {
        innerStart++;
      }
      while (isWhitespace(currentInput.charCodeAt(innerEnd - 1))) {
        innerEnd--;
      }
      let exp = getSlice(innerStart, innerEnd);
      if (exp.includes("&")) {
        {
          exp = currentOptions.decodeEntities(exp, false);
        }
      }
      addNode({
        type: 5,
        content: createExp(exp, false, getLoc(innerStart, innerEnd)),
        loc: getLoc(start, end)
      });
    },
    onopentagname(start, end) {
      const name = getSlice(start, end);
      currentOpenTag = {
        type: 1,
        tag: name,
        ns: currentOptions.getNamespace(name, stack2[0], currentOptions.ns),
        tagType: 0,
        // will be refined on tag close
        props: [],
        children: [],
        loc: getLoc(start - 1, end),
        codegenNode: void 0
      };
    },
    onopentagend(end) {
      endOpenTag(end);
    },
    onclosetag(start, end) {
      const name = getSlice(start, end);
      if (!currentOptions.isVoidTag(name)) {
        let found = false;
        for (let i = 0; i < stack2.length; i++) {
          const e = stack2[i];
          if (e.tag.toLowerCase() === name.toLowerCase()) {
            found = true;
            if (i > 0) {
              emitError(24, stack2[0].loc.start.offset);
            }
            for (let j = 0; j <= i; j++) {
              const el = stack2.shift();
              onCloseTag(el, end, j < i);
            }
            break;
          }
        }
        if (!found) {
          emitError(23, backTrack(start, 60));
        }
      }
    },
    onselfclosingtag(end) {
      const name = currentOpenTag.tag;
      currentOpenTag.isSelfClosing = true;
      endOpenTag(end);
      if (stack2[0] && stack2[0].tag === name) {
        onCloseTag(stack2.shift(), end);
      }
    },
    onattribname(start, end) {
      currentProp = {
        type: 6,
        name: getSlice(start, end),
        nameLoc: getLoc(start, end),
        value: void 0,
        loc: getLoc(start)
      };
    },
    ondirname(start, end) {
      const raw = getSlice(start, end);
      const name = raw === "." || raw === ":" ? "bind" : raw === "@" ? "on" : raw === "#" ? "slot" : raw.slice(2);
      if (!inVPre && name === "") {
        emitError(26, start);
      }
      if (inVPre || name === "") {
        currentProp = {
          type: 6,
          name: raw,
          nameLoc: getLoc(start, end),
          value: void 0,
          loc: getLoc(start)
        };
      } else {
        currentProp = {
          type: 7,
          name,
          rawName: raw,
          exp: void 0,
          arg: void 0,
          modifiers: raw === "." ? [createSimpleExpression("prop")] : [],
          loc: getLoc(start)
        };
        if (name === "pre") {
          inVPre = tokenizer.inVPre = true;
          currentVPreBoundary = currentOpenTag;
          const props = currentOpenTag.props;
          for (let i = 0; i < props.length; i++) {
            if (props[i].type === 7) {
              props[i] = dirToAttr(props[i]);
            }
          }
        }
      }
    },
    ondirarg(start, end) {
      if (start === end) return;
      const arg = getSlice(start, end);
      if (inVPre && !isVPre(currentProp)) {
        currentProp.name += arg;
        setLocEnd(currentProp.nameLoc, end);
      } else {
        const isStatic = arg[0] !== `[`;
        currentProp.arg = createExp(
          isStatic ? arg : arg.slice(1, -1),
          isStatic,
          getLoc(start, end),
          isStatic ? 3 : 0
        );
      }
    },
    ondirmodifier(start, end) {
      const mod = getSlice(start, end);
      if (inVPre && !isVPre(currentProp)) {
        currentProp.name += "." + mod;
        setLocEnd(currentProp.nameLoc, end);
      } else if (currentProp.name === "slot") {
        const arg = currentProp.arg;
        if (arg) {
          arg.content += "." + mod;
          setLocEnd(arg.loc, end);
        }
      } else {
        const exp = createSimpleExpression(mod, true, getLoc(start, end));
        currentProp.modifiers.push(exp);
      }
    },
    onattribdata(start, end) {
      currentAttrValue += getSlice(start, end);
      if (currentAttrStartIndex < 0) currentAttrStartIndex = start;
      currentAttrEndIndex = end;
    },
    onattribentity(char, start, end) {
      currentAttrValue += char;
      if (currentAttrStartIndex < 0) currentAttrStartIndex = start;
      currentAttrEndIndex = end;
    },
    onattribnameend(end) {
      const start = currentProp.loc.start.offset;
      const name = getSlice(start, end);
      if (currentProp.type === 7) {
        currentProp.rawName = name;
      }
      if (currentOpenTag.props.some(
        (p2) => (p2.type === 7 ? p2.rawName : p2.name) === name
      )) {
        emitError(2, start);
      }
    },
    onattribend(quote, end) {
      if (currentOpenTag && currentProp) {
        setLocEnd(currentProp.loc, end);
        if (quote !== 0) {
          if (currentAttrValue.includes("&")) {
            currentAttrValue = currentOptions.decodeEntities(
              currentAttrValue,
              true
            );
          }
          if (currentProp.type === 6) {
            if (currentProp.name === "class") {
              currentAttrValue = condense(currentAttrValue).trim();
            }
            if (quote === 1 && !currentAttrValue) {
              emitError(13, end);
            }
            currentProp.value = {
              type: 2,
              content: currentAttrValue,
              loc: quote === 1 ? getLoc(currentAttrStartIndex, currentAttrEndIndex) : getLoc(currentAttrStartIndex - 1, currentAttrEndIndex + 1)
            };
            if (tokenizer.inSFCRoot && currentOpenTag.tag === "template" && currentProp.name === "lang" && currentAttrValue && currentAttrValue !== "html") {
              tokenizer.enterRCDATA(toCharCodes(`</template`), 0);
            }
          } else {
            let expParseMode = 0;
            currentProp.exp = createExp(
              currentAttrValue,
              false,
              getLoc(currentAttrStartIndex, currentAttrEndIndex),
              0,
              expParseMode
            );
            if (currentProp.name === "for") {
              currentProp.forParseResult = parseForExpression(currentProp.exp);
            }
            let syncIndex = -1;
            if (currentProp.name === "bind" && (syncIndex = currentProp.modifiers.findIndex(
              (mod) => mod.content === "sync"
            )) > -1 && checkCompatEnabled(
              "COMPILER_V_BIND_SYNC",
              currentOptions,
              currentProp.loc,
              currentProp.arg.loc.source
            )) {
              currentProp.name = "model";
              currentProp.modifiers.splice(syncIndex, 1);
            }
          }
        }
        if (currentProp.type !== 7 || currentProp.name !== "pre") {
          currentOpenTag.props.push(currentProp);
        }
      }
      currentAttrValue = "";
      currentAttrStartIndex = currentAttrEndIndex = -1;
    },
    oncomment(start, end) {
      if (currentOptions.comments) {
        addNode({
          type: 3,
          content: getSlice(start, end),
          loc: getLoc(start - 4, end + 3)
        });
      }
    },
    onend() {
      const end = currentInput.length;
      if (false) {
        switch (tokenizer.state) {
          case 5:
          case 8:
            emitError(5, end);
            break;
          case 3:
          case 4:
            emitError(
              25,
              tokenizer.sectionStart
            );
            break;
          case 28:
            if (tokenizer.currentSequence === Sequences.CdataEnd) {
              emitError(6, end);
            } else {
              emitError(7, end);
            }
            break;
          case 6:
          case 7:
          case 9:
          case 11:
          case 12:
          case 13:
          case 14:
          case 15:
          case 16:
          case 17:
          case 18:
          case 19:
          // "
          case 20:
          // '
          case 21:
            emitError(9, end);
            break;
        }
      }
      for (let index = 0; index < stack2.length; index++) {
        onCloseTag(stack2[index], end - 1);
        emitError(24, stack2[index].loc.start.offset);
      }
    },
    oncdata(start, end) {
      if ((stack2[0] ? stack2[0].ns : currentOptions.ns) !== 0) {
        onText(getSlice(start, end), start, end);
      } else {
        emitError(1, start - 9);
      }
    },
    onprocessinginstruction(start) {
      if ((stack2[0] ? stack2[0].ns : currentOptions.ns) === 0) {
        emitError(
          21,
          start - 1
        );
      }
    }
  });
  var forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/;
  var stripParensRE = /^\(|\)$/g;
  function parseForExpression(input) {
    const loc = input.loc;
    const exp = input.content;
    const inMatch = exp.match(forAliasRE);
    if (!inMatch) return;
    const [, LHS, RHS] = inMatch;
    const createAliasExpression = (content, offset, asParam = false) => {
      const start = loc.start.offset + offset;
      const end = start + content.length;
      return createExp(
        content,
        false,
        getLoc(start, end),
        0,
        asParam ? 1 : 0
        /* Normal */
      );
    };
    const result = {
      source: createAliasExpression(RHS.trim(), exp.indexOf(RHS, LHS.length)),
      value: void 0,
      key: void 0,
      index: void 0,
      finalized: false
    };
    let valueContent = LHS.trim().replace(stripParensRE, "").trim();
    const trimmedOffset = LHS.indexOf(valueContent);
    const iteratorMatch = valueContent.match(forIteratorRE);
    if (iteratorMatch) {
      valueContent = valueContent.replace(forIteratorRE, "").trim();
      const keyContent = iteratorMatch[1].trim();
      let keyOffset;
      if (keyContent) {
        keyOffset = exp.indexOf(keyContent, trimmedOffset + valueContent.length);
        result.key = createAliasExpression(keyContent, keyOffset, true);
      }
      if (iteratorMatch[2]) {
        const indexContent = iteratorMatch[2].trim();
        if (indexContent) {
          result.index = createAliasExpression(
            indexContent,
            exp.indexOf(
              indexContent,
              result.key ? keyOffset + keyContent.length : trimmedOffset + valueContent.length
            ),
            true
          );
        }
      }
    }
    if (valueContent) {
      result.value = createAliasExpression(valueContent, trimmedOffset, true);
    }
    return result;
  }
  function getSlice(start, end) {
    return currentInput.slice(start, end);
  }
  function endOpenTag(end) {
    if (tokenizer.inSFCRoot) {
      currentOpenTag.innerLoc = getLoc(end + 1, end + 1);
    }
    addNode(currentOpenTag);
    const { tag, ns } = currentOpenTag;
    if (ns === 0 && currentOptions.isPreTag(tag)) {
      inPre++;
    }
    if (currentOptions.isVoidTag(tag)) {
      onCloseTag(currentOpenTag, end);
    } else {
      stack2.unshift(currentOpenTag);
      if (ns === 1 || ns === 2) {
        tokenizer.inXML = true;
      }
    }
    currentOpenTag = null;
  }
  function onText(content, start, end) {
    {
      const tag = stack2[0] && stack2[0].tag;
      if (tag !== "script" && tag !== "style" && content.includes("&")) {
        content = currentOptions.decodeEntities(content, false);
      }
    }
    const parent = stack2[0] || currentRoot;
    const lastNode = parent.children[parent.children.length - 1];
    if (lastNode && lastNode.type === 2) {
      lastNode.content += content;
      setLocEnd(lastNode.loc, end);
    } else {
      parent.children.push({
        type: 2,
        content,
        loc: getLoc(start, end)
      });
    }
  }
  function onCloseTag(el, end, isImplied = false) {
    if (isImplied) {
      setLocEnd(el.loc, backTrack(end, 60));
    } else {
      setLocEnd(el.loc, lookAhead(end, 62) + 1);
    }
    if (tokenizer.inSFCRoot) {
      if (el.children.length) {
        el.innerLoc.end = extend({}, el.children[el.children.length - 1].loc.end);
      } else {
        el.innerLoc.end = extend({}, el.innerLoc.start);
      }
      el.innerLoc.source = getSlice(
        el.innerLoc.start.offset,
        el.innerLoc.end.offset
      );
    }
    const { tag, ns, children } = el;
    if (!inVPre) {
      if (tag === "slot") {
        el.tagType = 2;
      } else if (isFragmentTemplate(el)) {
        el.tagType = 3;
      } else if (isComponent(el)) {
        el.tagType = 1;
      }
    }
    if (!tokenizer.inRCDATA) {
      el.children = condenseWhitespace(children);
    }
    if (ns === 0 && currentOptions.isIgnoreNewlineTag(tag)) {
      const first = children[0];
      if (first && first.type === 2) {
        first.content = first.content.replace(/^\r?\n/, "");
      }
    }
    if (ns === 0 && currentOptions.isPreTag(tag)) {
      inPre--;
    }
    if (currentVPreBoundary === el) {
      inVPre = tokenizer.inVPre = false;
      currentVPreBoundary = null;
    }
    if (tokenizer.inXML && (stack2[0] ? stack2[0].ns : currentOptions.ns) === 0) {
      tokenizer.inXML = false;
    }
    {
      const props = el.props;
      if (false) {
        let hasIf = false;
        let hasFor = false;
        for (let i = 0; i < props.length; i++) {
          const p2 = props[i];
          if (p2.type === 7) {
            if (p2.name === "if") {
              hasIf = true;
            } else if (p2.name === "for") {
              hasFor = true;
            }
          }
          if (hasIf && hasFor) {
            warnDeprecation(
              "COMPILER_V_IF_V_FOR_PRECEDENCE",
              currentOptions,
              el.loc
            );
            break;
          }
        }
      }
      if (!tokenizer.inSFCRoot && isCompatEnabled(
        "COMPILER_NATIVE_TEMPLATE",
        currentOptions
      ) && el.tag === "template" && !isFragmentTemplate(el)) {
        const parent = stack2[0] || currentRoot;
        const index = parent.children.indexOf(el);
        parent.children.splice(index, 1, ...el.children);
      }
      const inlineTemplateProp = props.find(
        (p2) => p2.type === 6 && p2.name === "inline-template"
      );
      if (inlineTemplateProp && checkCompatEnabled(
        "COMPILER_INLINE_TEMPLATE",
        currentOptions,
        inlineTemplateProp.loc
      ) && el.children.length) {
        inlineTemplateProp.value = {
          type: 2,
          content: getSlice(
            el.children[0].loc.start.offset,
            el.children[el.children.length - 1].loc.end.offset
          ),
          loc: inlineTemplateProp.loc
        };
      }
    }
  }
  function lookAhead(index, c) {
    let i = index;
    while (currentInput.charCodeAt(i) !== c && i < currentInput.length - 1) i++;
    return i;
  }
  function backTrack(index, c) {
    let i = index;
    while (currentInput.charCodeAt(i) !== c && i >= 0) i--;
    return i;
  }
  var specialTemplateDir = /* @__PURE__ */ new Set(["if", "else", "else-if", "for", "slot"]);
  function isFragmentTemplate({ tag, props }) {
    if (tag === "template") {
      for (let i = 0; i < props.length; i++) {
        if (props[i].type === 7 && specialTemplateDir.has(props[i].name)) {
          return true;
        }
      }
    }
    return false;
  }
  function isComponent({ tag, props }) {
    if (currentOptions.isCustomElement(tag)) {
      return false;
    }
    if (tag === "component" || isUpperCase(tag.charCodeAt(0)) || isCoreComponent(tag) || currentOptions.isBuiltInComponent && currentOptions.isBuiltInComponent(tag) || currentOptions.isNativeTag && !currentOptions.isNativeTag(tag)) {
      return true;
    }
    for (let i = 0; i < props.length; i++) {
      const p2 = props[i];
      if (p2.type === 6) {
        if (p2.name === "is" && p2.value) {
          if (p2.value.content.startsWith("vue:")) {
            return true;
          } else if (checkCompatEnabled(
            "COMPILER_IS_ON_ELEMENT",
            currentOptions,
            p2.loc
          )) {
            return true;
          }
        }
      } else if (
        // :is on plain element - only treat as component in compat mode
        p2.name === "bind" && isStaticArgOf(p2.arg, "is") && checkCompatEnabled(
          "COMPILER_IS_ON_ELEMENT",
          currentOptions,
          p2.loc
        )
      ) {
        return true;
      }
    }
    return false;
  }
  function isUpperCase(c) {
    return c > 64 && c < 91;
  }
  var windowsNewlineRE = /\r\n/g;
  function condenseWhitespace(nodes) {
    const shouldCondense = currentOptions.whitespace !== "preserve";
    let removedWhitespace = false;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === 2) {
        if (!inPre) {
          if (isAllWhitespace(node.content)) {
            const prev = nodes[i - 1] && nodes[i - 1].type;
            const next = nodes[i + 1] && nodes[i + 1].type;
            if (!prev || !next || shouldCondense && (prev === 3 && (next === 3 || next === 1) || prev === 1 && (next === 3 || next === 1 && hasNewlineChar(node.content)))) {
              removedWhitespace = true;
              nodes[i] = null;
            } else {
              node.content = " ";
            }
          } else if (shouldCondense) {
            node.content = condense(node.content);
          }
        } else {
          node.content = node.content.replace(windowsNewlineRE, "\n");
        }
      }
    }
    return removedWhitespace ? nodes.filter(Boolean) : nodes;
  }
  function hasNewlineChar(str) {
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c === 10 || c === 13) {
        return true;
      }
    }
    return false;
  }
  function condense(str) {
    let ret = "";
    let prevCharIsWhitespace = false;
    for (let i = 0; i < str.length; i++) {
      if (isWhitespace(str.charCodeAt(i))) {
        if (!prevCharIsWhitespace) {
          ret += " ";
          prevCharIsWhitespace = true;
        }
      } else {
        ret += str[i];
        prevCharIsWhitespace = false;
      }
    }
    return ret;
  }
  function addNode(node) {
    (stack2[0] || currentRoot).children.push(node);
  }
  function getLoc(start, end) {
    return {
      start: tokenizer.getPos(start),
      // @ts-expect-error allow late attachment
      end: end == null ? end : tokenizer.getPos(end),
      // @ts-expect-error allow late attachment
      source: end == null ? end : getSlice(start, end)
    };
  }
  function cloneLoc(loc) {
    return getLoc(loc.start.offset, loc.end.offset);
  }
  function setLocEnd(loc, end) {
    loc.end = tokenizer.getPos(end);
    loc.source = getSlice(loc.start.offset, end);
  }
  function dirToAttr(dir) {
    const attr = {
      type: 6,
      name: dir.rawName,
      nameLoc: getLoc(
        dir.loc.start.offset,
        dir.loc.start.offset + dir.rawName.length
      ),
      value: void 0,
      loc: dir.loc
    };
    if (dir.exp) {
      const loc = dir.exp.loc;
      if (loc.end.offset < dir.loc.end.offset) {
        loc.start.offset--;
        loc.start.column--;
        loc.end.offset++;
        loc.end.column++;
      }
      attr.value = {
        type: 2,
        content: dir.exp.content,
        loc
      };
    }
    return attr;
  }
  function createExp(content, isStatic = false, loc, constType = 0, parseMode = 0) {
    const exp = createSimpleExpression(content, isStatic, loc, constType);
    return exp;
  }
  function emitError(code, index, message) {
    currentOptions.onError(
      createCompilerError(code, getLoc(index, index), void 0, message)
    );
  }
  function reset() {
    tokenizer.reset();
    currentOpenTag = null;
    currentProp = null;
    currentAttrValue = "";
    currentAttrStartIndex = -1;
    currentAttrEndIndex = -1;
    stack2.length = 0;
  }
  function baseParse(input, options) {
    reset();
    currentInput = input;
    currentOptions = extend({}, defaultParserOptions);
    if (options) {
      let key;
      for (key in options) {
        if (options[key] != null) {
          currentOptions[key] = options[key];
        }
      }
    }
    if (false) {
      if (!currentOptions.decodeEntities) {
        throw new Error(
          `[@vue/compiler-core] decodeEntities option is required in browser builds.`
        );
      }
    }
    tokenizer.mode = currentOptions.parseMode === "html" ? 1 : currentOptions.parseMode === "sfc" ? 2 : 0;
    tokenizer.inXML = currentOptions.ns === 1 || currentOptions.ns === 2;
    const delimiters = options && options.delimiters;
    if (delimiters) {
      tokenizer.delimiterOpen = toCharCodes(delimiters[0]);
      tokenizer.delimiterClose = toCharCodes(delimiters[1]);
    }
    const root = currentRoot = createRoot([], input);
    tokenizer.parse(currentInput);
    root.loc = getLoc(0, input.length);
    root.children = condenseWhitespace(root.children);
    currentRoot = null;
    return root;
  }
  function cacheStatic(root, context) {
    walk(
      root,
      void 0,
      context,
      // Root node is unfortunately non-hoistable due to potential parent
      // fallthrough attributes.
      !!getSingleElementRoot(root)
    );
  }
  function getSingleElementRoot(root) {
    const children = root.children.filter((x) => x.type !== 3);
    return children.length === 1 && children[0].type === 1 && !isSlotOutlet(children[0]) ? children[0] : null;
  }
  function walk(node, parent, context, doNotHoistNode = false, inFor = false) {
    const { children } = node;
    const toCache = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.type === 1 && child.tagType === 0) {
        const constantType = doNotHoistNode ? 0 : getConstantType(child, context);
        if (constantType > 0) {
          if (constantType >= 2) {
            child.codegenNode.patchFlag = -1;
            toCache.push(child);
            continue;
          }
        } else {
          const codegenNode = child.codegenNode;
          if (codegenNode.type === 13) {
            const flag = codegenNode.patchFlag;
            if ((flag === void 0 || flag === 512 || flag === 1) && getGeneratedPropsConstantType(child, context) >= 2) {
              const props = getNodeProps(child);
              if (props) {
                codegenNode.props = context.hoist(props);
              }
            }
            if (codegenNode.dynamicProps) {
              codegenNode.dynamicProps = context.hoist(codegenNode.dynamicProps);
            }
          }
        }
      } else if (child.type === 12) {
        const constantType = doNotHoistNode ? 0 : getConstantType(child, context);
        if (constantType >= 2) {
          if (child.codegenNode.type === 14 && child.codegenNode.arguments.length > 0) {
            child.codegenNode.arguments.push(
              -1 + (false ? ` /* ${PatchFlagNames[-1]} */` : ``)
            );
          }
          toCache.push(child);
          continue;
        }
      }
      if (child.type === 1) {
        const isComponent2 = child.tagType === 1;
        if (isComponent2) {
          context.scopes.vSlot++;
        }
        walk(child, node, context, false, inFor);
        if (isComponent2) {
          context.scopes.vSlot--;
        }
      } else if (child.type === 11) {
        walk(child, node, context, child.children.length === 1, true);
      } else if (child.type === 9) {
        for (let i2 = 0; i2 < child.branches.length; i2++) {
          walk(
            child.branches[i2],
            node,
            context,
            child.branches[i2].children.length === 1,
            inFor
          );
        }
      }
    }
    let cachedAsArray = false;
    if (toCache.length === children.length && node.type === 1) {
      if (node.tagType === 0 && node.codegenNode && node.codegenNode.type === 13 && isArray(node.codegenNode.children)) {
        node.codegenNode.children = getCacheExpression(
          createArrayExpression(node.codegenNode.children)
        );
        cachedAsArray = true;
      } else if (node.tagType === 1 && node.codegenNode && node.codegenNode.type === 13 && node.codegenNode.children && !isArray(node.codegenNode.children) && node.codegenNode.children.type === 15) {
        const slot = getSlotNode(node.codegenNode, "default");
        if (slot) {
          slot.returns = getCacheExpression(
            createArrayExpression(slot.returns)
          );
          cachedAsArray = true;
        }
      } else if (node.tagType === 3 && parent && parent.type === 1 && parent.tagType === 1 && parent.codegenNode && parent.codegenNode.type === 13 && parent.codegenNode.children && !isArray(parent.codegenNode.children) && parent.codegenNode.children.type === 15) {
        const slotName = findDir(node, "slot", true);
        const slot = slotName && slotName.arg && getSlotNode(parent.codegenNode, slotName.arg);
        if (slot) {
          slot.returns = getCacheExpression(
            createArrayExpression(slot.returns)
          );
          cachedAsArray = true;
        }
      }
    }
    if (!cachedAsArray) {
      for (const child of toCache) {
        child.codegenNode = context.cache(child.codegenNode);
      }
    }
    function getCacheExpression(value) {
      const exp = context.cache(value);
      exp.needArraySpread = true;
      return exp;
    }
    function getSlotNode(node2, name) {
      if (node2.children && !isArray(node2.children) && node2.children.type === 15) {
        const slot = node2.children.properties.find(
          (p2) => p2.key === name || p2.key.content === name
        );
        return slot && slot.value;
      }
    }
    if (toCache.length && context.transformHoist) {
      context.transformHoist(children, context, node);
    }
  }
  function getConstantType(node, context) {
    const { constantCache } = context;
    switch (node.type) {
      case 1:
        if (node.tagType !== 0) {
          return 0;
        }
        const cached = constantCache.get(node);
        if (cached !== void 0) {
          return cached;
        }
        const codegenNode = node.codegenNode;
        if (codegenNode.type !== 13) {
          return 0;
        }
        if (codegenNode.isBlock && node.tag !== "svg" && node.tag !== "foreignObject" && node.tag !== "math") {
          return 0;
        }
        if (codegenNode.patchFlag === void 0) {
          let returnType2 = 3;
          const generatedPropsType = getGeneratedPropsConstantType(node, context);
          if (generatedPropsType === 0) {
            constantCache.set(node, 0);
            return 0;
          }
          if (generatedPropsType < returnType2) {
            returnType2 = generatedPropsType;
          }
          for (let i = 0; i < node.children.length; i++) {
            const childType = getConstantType(node.children[i], context);
            if (childType === 0) {
              constantCache.set(node, 0);
              return 0;
            }
            if (childType < returnType2) {
              returnType2 = childType;
            }
          }
          if (returnType2 > 1) {
            for (let i = 0; i < node.props.length; i++) {
              const p2 = node.props[i];
              if (p2.type === 7 && p2.name === "bind" && p2.exp) {
                const expType = getConstantType(p2.exp, context);
                if (expType === 0) {
                  constantCache.set(node, 0);
                  return 0;
                }
                if (expType < returnType2) {
                  returnType2 = expType;
                }
              }
            }
          }
          if (codegenNode.isBlock) {
            for (let i = 0; i < node.props.length; i++) {
              const p2 = node.props[i];
              if (p2.type === 7) {
                constantCache.set(node, 0);
                return 0;
              }
            }
            context.removeHelper(OPEN_BLOCK);
            context.removeHelper(
              getVNodeBlockHelper(context.inSSR, codegenNode.isComponent)
            );
            codegenNode.isBlock = false;
            context.helper(getVNodeHelper(context.inSSR, codegenNode.isComponent));
          }
          constantCache.set(node, returnType2);
          return returnType2;
        } else {
          constantCache.set(node, 0);
          return 0;
        }
      case 2:
      case 3:
        return 3;
      case 9:
      case 11:
      case 10:
        return 0;
      case 5:
      case 12:
        return getConstantType(node.content, context);
      case 4:
        return node.constType;
      case 8:
        let returnType = 3;
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (isString(child) || isSymbol(child)) {
            continue;
          }
          const childType = getConstantType(child, context);
          if (childType === 0) {
            return 0;
          } else if (childType < returnType) {
            returnType = childType;
          }
        }
        return returnType;
      case 20:
        return 2;
      default:
        if (false) ;
        return 0;
    }
  }
  var allowHoistedHelperSet = /* @__PURE__ */ new Set([
    NORMALIZE_CLASS,
    NORMALIZE_STYLE,
    NORMALIZE_PROPS,
    GUARD_REACTIVE_PROPS
  ]);
  function getConstantTypeOfHelperCall(value, context) {
    if (value.type === 14 && !isString(value.callee) && allowHoistedHelperSet.has(value.callee)) {
      const arg = value.arguments[0];
      if (arg.type === 4) {
        return getConstantType(arg, context);
      } else if (arg.type === 14) {
        return getConstantTypeOfHelperCall(arg, context);
      }
    }
    return 0;
  }
  function getGeneratedPropsConstantType(node, context) {
    let returnType = 3;
    const props = getNodeProps(node);
    if (props && props.type === 15) {
      const { properties } = props;
      for (let i = 0; i < properties.length; i++) {
        const { key, value } = properties[i];
        const keyType = getConstantType(key, context);
        if (keyType === 0) {
          return keyType;
        }
        if (keyType < returnType) {
          returnType = keyType;
        }
        let valueType;
        if (value.type === 4) {
          valueType = getConstantType(value, context);
        } else if (value.type === 14) {
          valueType = getConstantTypeOfHelperCall(value, context);
        } else {
          valueType = 0;
        }
        if (valueType === 0) {
          return valueType;
        }
        if (valueType < returnType) {
          returnType = valueType;
        }
      }
    }
    return returnType;
  }
  function getNodeProps(node) {
    const codegenNode = node.codegenNode;
    if (codegenNode.type === 13) {
      return codegenNode.props;
    }
  }
  function createTransformContext(root, {
    filename = "",
    prefixIdentifiers = false,
    hoistStatic = false,
    hmr = false,
    cacheHandlers = false,
    nodeTransforms = [],
    directiveTransforms = {},
    transformHoist = null,
    isBuiltInComponent = NOOP,
    isCustomElement = NOOP,
    expressionPlugins = [],
    scopeId = null,
    slotted = true,
    ssr = false,
    inSSR = false,
    ssrCssVars = ``,
    bindingMetadata = EMPTY_OBJ,
    inline = false,
    isTS = false,
    onError = defaultOnError,
    onWarn = defaultOnWarn,
    compatConfig
  }) {
    const nameMatch = filename.replace(/\?.*$/, "").match(/([^/\\]+)\.\w+$/);
    const context = {
      // options
      filename,
      selfName: nameMatch && capitalize(camelize(nameMatch[1])),
      prefixIdentifiers,
      hoistStatic,
      hmr,
      cacheHandlers,
      nodeTransforms,
      directiveTransforms,
      transformHoist,
      isBuiltInComponent,
      isCustomElement,
      expressionPlugins,
      scopeId,
      slotted,
      ssr,
      inSSR,
      ssrCssVars,
      bindingMetadata,
      inline,
      isTS,
      onError,
      onWarn,
      compatConfig,
      // state
      root,
      helpers: /* @__PURE__ */ new Map(),
      components: /* @__PURE__ */ new Set(),
      directives: /* @__PURE__ */ new Set(),
      hoists: [],
      imports: [],
      cached: [],
      constantCache: /* @__PURE__ */ new WeakMap(),
      vForMemoKeyedNodes: /* @__PURE__ */ new WeakSet(),
      temps: 0,
      identifiers: /* @__PURE__ */ Object.create(null),
      scopes: {
        vFor: 0,
        vSlot: 0,
        vPre: 0,
        vOnce: 0
      },
      parent: null,
      grandParent: null,
      currentNode: root,
      childIndex: 0,
      inVOnce: false,
      // methods
      helper(name) {
        const count = context.helpers.get(name) || 0;
        context.helpers.set(name, count + 1);
        return name;
      },
      removeHelper(name) {
        const count = context.helpers.get(name);
        if (count) {
          const currentCount = count - 1;
          if (!currentCount) {
            context.helpers.delete(name);
          } else {
            context.helpers.set(name, currentCount);
          }
        }
      },
      helperString(name) {
        return `_${helperNameMap[context.helper(name)]}`;
      },
      replaceNode(node) {
        if (false) {
          if (!context.currentNode) {
            throw new Error(`Node being replaced is already removed.`);
          }
          if (!context.parent) {
            throw new Error(`Cannot replace root node.`);
          }
        }
        context.parent.children[context.childIndex] = context.currentNode = node;
      },
      removeNode(node) {
        if (false) {
          throw new Error(`Cannot remove root node.`);
        }
        const list = context.parent.children;
        const removalIndex = node ? list.indexOf(node) : context.currentNode ? context.childIndex : -1;
        if (false) {
          throw new Error(`node being removed is not a child of current parent`);
        }
        if (!node || node === context.currentNode) {
          context.currentNode = null;
          context.onNodeRemoved();
        } else {
          if (context.childIndex > removalIndex) {
            context.childIndex--;
            context.onNodeRemoved();
          }
        }
        context.parent.children.splice(removalIndex, 1);
      },
      onNodeRemoved: NOOP,
      addIdentifiers(exp) {
      },
      removeIdentifiers(exp) {
      },
      hoist(exp) {
        if (isString(exp)) exp = createSimpleExpression(exp);
        context.hoists.push(exp);
        const identifier = createSimpleExpression(
          `_hoisted_${context.hoists.length}`,
          false,
          exp.loc,
          2
        );
        identifier.hoisted = exp;
        return identifier;
      },
      cache(exp, isVNode2 = false, inVOnce = false) {
        const cacheExp = createCacheExpression(
          context.cached.length,
          exp,
          isVNode2,
          inVOnce
        );
        context.cached.push(cacheExp);
        return cacheExp;
      }
    };
    {
      context.filters = /* @__PURE__ */ new Set();
    }
    return context;
  }
  function transform(root, options) {
    const context = createTransformContext(root, options);
    traverseNode(root, context);
    if (options.hoistStatic) {
      cacheStatic(root, context);
    }
    if (!options.ssr) {
      createRootCodegen(root, context);
    }
    root.helpers = /* @__PURE__ */ new Set([...context.helpers.keys()]);
    root.components = [...context.components];
    root.directives = [...context.directives];
    root.imports = context.imports;
    root.hoists = context.hoists;
    root.temps = context.temps;
    root.cached = context.cached;
    root.transformed = true;
    {
      root.filters = [...context.filters];
    }
  }
  function createRootCodegen(root, context) {
    const { helper } = context;
    const { children } = root;
    if (children.length === 1) {
      const singleElementRootChild = getSingleElementRoot(root);
      if (singleElementRootChild && singleElementRootChild.codegenNode) {
        const codegenNode = singleElementRootChild.codegenNode;
        if (codegenNode.type === 13) {
          convertToBlock(codegenNode, context);
        }
        root.codegenNode = codegenNode;
      } else {
        root.codegenNode = children[0];
      }
    } else if (children.length > 1) {
      let patchFlag = 64;
      if (false) {
        patchFlag |= 2048;
      }
      root.codegenNode = createVNodeCall(
        context,
        helper(FRAGMENT),
        void 0,
        root.children,
        patchFlag,
        void 0,
        void 0,
        true,
        void 0,
        false
      );
    } else ;
  }
  function traverseChildren(parent, context) {
    let i = 0;
    const nodeRemoved = () => {
      i--;
    };
    for (; i < parent.children.length; i++) {
      const child = parent.children[i];
      if (isString(child)) continue;
      context.grandParent = context.parent;
      context.parent = parent;
      context.childIndex = i;
      context.onNodeRemoved = nodeRemoved;
      traverseNode(child, context);
    }
  }
  function traverseNode(node, context) {
    context.currentNode = node;
    const { nodeTransforms } = context;
    const exitFns = [];
    for (let i2 = 0; i2 < nodeTransforms.length; i2++) {
      const onExit = nodeTransforms[i2](node, context);
      if (onExit) {
        if (isArray(onExit)) {
          exitFns.push(...onExit);
        } else {
          exitFns.push(onExit);
        }
      }
      if (!context.currentNode) {
        return;
      } else {
        node = context.currentNode;
      }
    }
    switch (node.type) {
      case 3:
        if (!context.ssr) {
          context.helper(CREATE_COMMENT);
        }
        break;
      case 5:
        if (!context.ssr) {
          context.helper(TO_DISPLAY_STRING);
        }
        break;
      // for container types, further traverse downwards
      case 9:
        for (let i2 = 0; i2 < node.branches.length; i2++) {
          traverseNode(node.branches[i2], context);
        }
        break;
      case 10:
      case 11:
      case 1:
      case 0:
        traverseChildren(node, context);
        break;
    }
    context.currentNode = node;
    let i = exitFns.length;
    while (i--) {
      exitFns[i]();
    }
  }
  function createStructuralDirectiveTransform(name, fn) {
    const matches2 = isString(name) ? (n) => n === name : (n) => name.test(n);
    return (node, context) => {
      if (node.type === 1) {
        const { props } = node;
        if (node.tagType === 3 && props.some(isVSlot)) {
          return;
        }
        const exitFns = [];
        for (let i = 0; i < props.length; i++) {
          const prop = props[i];
          if (prop.type === 7 && matches2(prop.name)) {
            props.splice(i, 1);
            i--;
            const onExit = fn(node, prop, context);
            if (onExit) exitFns.push(onExit);
          }
        }
        return exitFns;
      }
    };
  }
  var PURE_ANNOTATION = `/*@__PURE__*/`;
  var aliasHelper = (s) => `${helperNameMap[s]}: _${helperNameMap[s]}`;
  function createCodegenContext(ast, {
    mode = "function",
    prefixIdentifiers = mode === "module",
    sourceMap = false,
    filename = `template.vue.html`,
    scopeId = null,
    optimizeImports = false,
    runtimeGlobalName = `Vue`,
    runtimeModuleName = `vue`,
    ssrRuntimeModuleName = "vue/server-renderer",
    ssr = false,
    isTS = false,
    inSSR = false
  }) {
    const context = {
      mode,
      prefixIdentifiers,
      sourceMap,
      filename,
      scopeId,
      optimizeImports,
      runtimeGlobalName,
      runtimeModuleName,
      ssrRuntimeModuleName,
      ssr,
      isTS,
      inSSR,
      source: ast.source,
      code: ``,
      column: 1,
      line: 1,
      offset: 0,
      indentLevel: 0,
      pure: false,
      map: void 0,
      helper(key) {
        return `_${helperNameMap[key]}`;
      },
      push(code, newlineIndex = -2, node) {
        context.code += code;
      },
      indent() {
        newline(++context.indentLevel);
      },
      deindent(withoutNewLine = false) {
        if (withoutNewLine) {
          --context.indentLevel;
        } else {
          newline(--context.indentLevel);
        }
      },
      newline() {
        newline(context.indentLevel);
      }
    };
    function newline(n) {
      context.push(
        "\n" + `  `.repeat(n),
        0
        /* Start */
      );
    }
    return context;
  }
  function generate(ast, options = {}) {
    const context = createCodegenContext(ast, options);
    if (options.onContextCreated) options.onContextCreated(context);
    const {
      mode,
      push,
      prefixIdentifiers,
      indent,
      deindent,
      newline,
      scopeId,
      ssr
    } = context;
    const helpers = Array.from(ast.helpers);
    const hasHelpers = helpers.length > 0;
    const useWithBlock = !prefixIdentifiers && mode !== "module";
    const preambleContext = context;
    {
      genFunctionPreamble(ast, preambleContext);
    }
    const functionName = ssr ? `ssrRender` : `render`;
    const args = ssr ? ["_ctx", "_push", "_parent", "_attrs"] : ["_ctx", "_cache"];
    const signature = args.join(", ");
    {
      push(`function ${functionName}(${signature}) {`);
    }
    indent();
    if (useWithBlock) {
      push(`with (_ctx) {`);
      indent();
      if (hasHelpers) {
        push(
          `const { ${helpers.map(aliasHelper).join(", ")} } = _Vue
`,
          -1
          /* End */
        );
        newline();
      }
    }
    if (ast.components.length) {
      genAssets(ast.components, "component", context);
      if (ast.directives.length || ast.temps > 0) {
        newline();
      }
    }
    if (ast.directives.length) {
      genAssets(ast.directives, "directive", context);
      if (ast.temps > 0) {
        newline();
      }
    }
    if (ast.filters && ast.filters.length) {
      newline();
      genAssets(ast.filters, "filter", context);
      newline();
    }
    if (ast.temps > 0) {
      push(`let `);
      for (let i = 0; i < ast.temps; i++) {
        push(`${i > 0 ? `, ` : ``}_temp${i}`);
      }
    }
    if (ast.components.length || ast.directives.length || ast.temps) {
      push(
        `
`,
        0
        /* Start */
      );
      newline();
    }
    if (!ssr) {
      push(`return `);
    }
    if (ast.codegenNode) {
      genNode(ast.codegenNode, context);
    } else {
      push(`null`);
    }
    if (useWithBlock) {
      deindent();
      push(`}`);
    }
    deindent();
    push(`}`);
    return {
      ast,
      code: context.code,
      preamble: ``,
      map: context.map ? context.map.toJSON() : void 0
    };
  }
  function genFunctionPreamble(ast, context) {
    const {
      ssr,
      prefixIdentifiers,
      push,
      newline,
      runtimeModuleName,
      runtimeGlobalName,
      ssrRuntimeModuleName
    } = context;
    const VueBinding = runtimeGlobalName;
    const helpers = Array.from(ast.helpers);
    if (helpers.length > 0) {
      {
        push(
          `const _Vue = ${VueBinding}
`,
          -1
          /* End */
        );
        if (ast.hoists.length) {
          const staticHelpers = [
            CREATE_VNODE,
            CREATE_ELEMENT_VNODE,
            CREATE_COMMENT,
            CREATE_TEXT,
            CREATE_STATIC
          ].filter((helper) => helpers.includes(helper)).map(aliasHelper).join(", ");
          push(
            `const { ${staticHelpers} } = _Vue
`,
            -1
            /* End */
          );
        }
      }
    }
    genHoists(ast.hoists, context);
    newline();
    push(`return `);
  }
  function genAssets(assets, type, { helper, push, newline, isTS }) {
    const resolver = helper(
      type === "filter" ? RESOLVE_FILTER : type === "component" ? RESOLVE_COMPONENT : RESOLVE_DIRECTIVE
    );
    for (let i = 0; i < assets.length; i++) {
      let id = assets[i];
      const maybeSelfReference = id.endsWith("__self");
      if (maybeSelfReference) {
        id = id.slice(0, -6);
      }
      push(
        `const ${toValidAssetId(id, type)} = ${resolver}(${JSON.stringify(id)}${maybeSelfReference ? `, true` : ``})${isTS ? `!` : ``}`
      );
      if (i < assets.length - 1) {
        newline();
      }
    }
  }
  function genHoists(hoists, context) {
    if (!hoists.length) {
      return;
    }
    context.pure = true;
    const { push, newline } = context;
    newline();
    for (let i = 0; i < hoists.length; i++) {
      const exp = hoists[i];
      if (exp) {
        push(`const _hoisted_${i + 1} = `);
        genNode(exp, context);
        newline();
      }
    }
    context.pure = false;
  }
  function genNodeListAsArray(nodes, context) {
    const multilines = nodes.length > 3 || false;
    context.push(`[`);
    multilines && context.indent();
    genNodeList(nodes, context, multilines);
    multilines && context.deindent();
    context.push(`]`);
  }
  function genNodeList(nodes, context, multilines = false, comma = true) {
    const { push, newline } = context;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (isString(node)) {
        push(
          node,
          -3
          /* Unknown */
        );
      } else if (isArray(node)) {
        genNodeListAsArray(node, context);
      } else {
        genNode(node, context);
      }
      if (i < nodes.length - 1) {
        if (multilines) {
          comma && push(",");
          newline();
        } else {
          comma && push(", ");
        }
      }
    }
  }
  function genNode(node, context) {
    if (isString(node)) {
      context.push(
        node,
        -3
        /* Unknown */
      );
      return;
    }
    if (isSymbol(node)) {
      context.push(context.helper(node));
      return;
    }
    switch (node.type) {
      case 1:
      case 9:
      case 11:
        genNode(node.codegenNode, context);
        break;
      case 2:
        genText(node, context);
        break;
      case 4:
        genExpression(node, context);
        break;
      case 5:
        genInterpolation(node, context);
        break;
      case 12:
        genNode(node.codegenNode, context);
        break;
      case 8:
        genCompoundExpression(node, context);
        break;
      case 3:
        genComment(node, context);
        break;
      case 13:
        genVNodeCall(node, context);
        break;
      case 14:
        genCallExpression(node, context);
        break;
      case 15:
        genObjectExpression(node, context);
        break;
      case 17:
        genArrayExpression(node, context);
        break;
      case 18:
        genFunctionExpression(node, context);
        break;
      case 19:
        genConditionalExpression(node, context);
        break;
      case 20:
        genCacheExpression(node, context);
        break;
      case 21:
        genNodeList(node.body, context, true, false);
        break;
      // SSR only types
      case 22:
        break;
      case 23:
        break;
      case 24:
        break;
      case 25:
        break;
      case 26:
        break;
      /* v8 ignore start */
      case 10:
        break;
      default:
        if (false) {
          assert(false, `unhandled codegen node type: ${node.type}`);
          const exhaustiveCheck = node;
          return exhaustiveCheck;
        }
    }
  }
  function genText(node, context) {
    context.push(JSON.stringify(node.content), -3, node);
  }
  function genExpression(node, context) {
    const { content, isStatic } = node;
    context.push(
      isStatic ? JSON.stringify(content) : content,
      -3,
      node
    );
  }
  function genInterpolation(node, context) {
    const { push, helper, pure } = context;
    if (pure) push(PURE_ANNOTATION);
    push(`${helper(TO_DISPLAY_STRING)}(`);
    genNode(node.content, context);
    push(`)`);
  }
  function genCompoundExpression(node, context) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (isString(child)) {
        context.push(
          child,
          -3
          /* Unknown */
        );
      } else {
        genNode(child, context);
      }
    }
  }
  function genExpressionAsPropertyKey(node, context) {
    const { push } = context;
    if (node.type === 8) {
      push(`[`);
      genCompoundExpression(node, context);
      push(`]`);
    } else if (node.isStatic) {
      const text = isSimpleIdentifier(node.content) ? node.content : JSON.stringify(node.content);
      push(text, -2, node);
    } else {
      push(`[${node.content}]`, -3, node);
    }
  }
  function genComment(node, context) {
    const { push, helper, pure } = context;
    if (pure) {
      push(PURE_ANNOTATION);
    }
    push(
      `${helper(CREATE_COMMENT)}(${JSON.stringify(node.content)})`,
      -3,
      node
    );
  }
  function genVNodeCall(node, context) {
    const { push, helper, pure } = context;
    const {
      tag,
      props,
      children,
      patchFlag,
      dynamicProps,
      directives,
      isBlock,
      disableTracking,
      isComponent: isComponent2
    } = node;
    let patchFlagString;
    if (patchFlag) {
      if (false) {
        if (patchFlag < 0) {
          patchFlagString = patchFlag + ` /* ${PatchFlagNames[patchFlag]} */`;
        } else {
          const flagNames = Object.keys(PatchFlagNames).map(Number).filter((n) => n > 0 && patchFlag & n).map((n) => PatchFlagNames[n]).join(`, `);
          patchFlagString = patchFlag + ` /* ${flagNames} */`;
        }
      } else {
        patchFlagString = String(patchFlag);
      }
    }
    if (directives) {
      push(helper(WITH_DIRECTIVES) + `(`);
    }
    if (isBlock) {
      push(`(${helper(OPEN_BLOCK)}(${disableTracking ? `true` : ``}), `);
    }
    if (pure) {
      push(PURE_ANNOTATION);
    }
    const callHelper = isBlock ? getVNodeBlockHelper(context.inSSR, isComponent2) : getVNodeHelper(context.inSSR, isComponent2);
    push(helper(callHelper) + `(`, -2, node);
    genNodeList(
      genNullableArgs([tag, props, children, patchFlagString, dynamicProps]),
      context
    );
    push(`)`);
    if (isBlock) {
      push(`)`);
    }
    if (directives) {
      push(`, `);
      genNode(directives, context);
      push(`)`);
    }
  }
  function genNullableArgs(args) {
    let i = args.length;
    while (i--) {
      if (args[i] != null) break;
    }
    return args.slice(0, i + 1).map((arg) => arg || `null`);
  }
  function genCallExpression(node, context) {
    const { push, helper, pure } = context;
    const callee = isString(node.callee) ? node.callee : helper(node.callee);
    if (pure) {
      push(PURE_ANNOTATION);
    }
    push(callee + `(`, -2, node);
    genNodeList(node.arguments, context);
    push(`)`);
  }
  function genObjectExpression(node, context) {
    const { push, indent, deindent, newline } = context;
    const { properties } = node;
    if (!properties.length) {
      push(`{}`, -2, node);
      return;
    }
    const multilines = properties.length > 1 || false;
    push(multilines ? `{` : `{ `);
    multilines && indent();
    for (let i = 0; i < properties.length; i++) {
      const { key, value } = properties[i];
      genExpressionAsPropertyKey(key, context);
      push(`: `);
      genNode(value, context);
      if (i < properties.length - 1) {
        push(`,`);
        newline();
      }
    }
    multilines && deindent();
    push(multilines ? `}` : ` }`);
  }
  function genArrayExpression(node, context) {
    genNodeListAsArray(node.elements, context);
  }
  function genFunctionExpression(node, context) {
    const { push, indent, deindent } = context;
    const { params, returns, body, newline, isSlot } = node;
    if (isSlot) {
      push(`_${helperNameMap[WITH_CTX]}(`);
    }
    push(`(`, -2, node);
    if (isArray(params)) {
      genNodeList(params, context);
    } else if (params) {
      genNode(params, context);
    }
    push(`) => `);
    if (newline || body) {
      push(`{`);
      indent();
    }
    if (returns) {
      if (newline) {
        push(`return `);
      }
      if (isArray(returns)) {
        genNodeListAsArray(returns, context);
      } else {
        genNode(returns, context);
      }
    } else if (body) {
      genNode(body, context);
    }
    if (newline || body) {
      deindent();
      push(`}`);
    }
    if (isSlot) {
      if (node.isNonScopedSlot) {
        push(`, undefined, true`);
      }
      push(`)`);
    }
  }
  function genConditionalExpression(node, context) {
    const { test, consequent, alternate, newline: needNewline } = node;
    const { push, indent, deindent, newline } = context;
    if (test.type === 4) {
      const needsParens = !isSimpleIdentifier(test.content);
      needsParens && push(`(`);
      genExpression(test, context);
      needsParens && push(`)`);
    } else {
      push(`(`);
      genNode(test, context);
      push(`)`);
    }
    needNewline && indent();
    context.indentLevel++;
    needNewline || push(` `);
    push(`? `);
    genNode(consequent, context);
    context.indentLevel--;
    needNewline && newline();
    needNewline || push(` `);
    push(`: `);
    const isNested = alternate.type === 19;
    if (!isNested) {
      context.indentLevel++;
    }
    genNode(alternate, context);
    if (!isNested) {
      context.indentLevel--;
    }
    needNewline && deindent(
      true
      /* without newline */
    );
  }
  function genCacheExpression(node, context) {
    const { push, helper, indent, deindent, newline } = context;
    const { needPauseTracking, needArraySpread } = node;
    if (needArraySpread) {
      push(`[...(`);
    }
    push(`_cache[${node.index}] || (`);
    if (needPauseTracking) {
      indent();
      push(`${helper(SET_BLOCK_TRACKING)}(-1`);
      if (node.inVOnce) push(`, true`);
      push(`),`);
      newline();
      push(`(`);
    }
    push(`_cache[${node.index}] = `);
    genNode(node.value, context);
    if (needPauseTracking) {
      push(`).cacheIndex = ${node.index},`);
      newline();
      push(`${helper(SET_BLOCK_TRACKING)}(1),`);
      newline();
      push(`_cache[${node.index}]`);
      deindent();
    }
    push(`)`);
    if (needArraySpread) {
      push(`)]`);
    }
  }
  var prohibitedKeywordRE = new RegExp(
    "\\b" + "arguments,await,break,case,catch,class,const,continue,debugger,default,delete,do,else,export,extends,finally,for,function,if,import,let,new,return,super,switch,throw,try,var,void,while,with,yield".split(",").join("\\b|\\b") + "\\b"
  );
  var transformIf = createStructuralDirectiveTransform(
    /^(?:if|else|else-if)$/,
    (node, dir, context) => {
      return processIf(node, dir, context, (ifNode, branch, isRoot) => {
        const siblings = context.parent.children;
        let i = siblings.indexOf(ifNode);
        let key = 0;
        while (i-- >= 0) {
          const sibling = siblings[i];
          if (sibling && sibling.type === 9) {
            key += sibling.branches.length;
          }
        }
        return () => {
          if (isRoot) {
            ifNode.codegenNode = createCodegenNodeForBranch(
              branch,
              key,
              context
            );
          } else {
            const parentCondition = getParentCondition(ifNode.codegenNode);
            parentCondition.alternate = createCodegenNodeForBranch(
              branch,
              key + ifNode.branches.length - 1,
              context
            );
          }
        };
      });
    }
  );
  function processIf(node, dir, context, processCodegen) {
    if (dir.name !== "else" && (!dir.exp || !dir.exp.content.trim())) {
      const loc = dir.exp ? dir.exp.loc : node.loc;
      context.onError(
        createCompilerError(28, dir.loc)
      );
      dir.exp = createSimpleExpression(`true`, false, loc);
    }
    if (false) {
      validateBrowserExpression(dir.exp, context);
    }
    if (dir.name === "if") {
      const branch = createIfBranch(node, dir);
      const ifNode = {
        type: 9,
        loc: cloneLoc(node.loc),
        branches: [branch]
      };
      context.replaceNode(ifNode);
      if (processCodegen) {
        return processCodegen(ifNode, branch, true);
      }
    } else {
      const siblings = context.parent.children;
      const comments = [];
      let i = siblings.indexOf(node);
      while (i-- >= -1) {
        const sibling = siblings[i];
        if (sibling && isCommentOrWhitespace(sibling)) {
          context.removeNode(sibling);
          if (false) {
            comments.unshift(sibling);
          }
          continue;
        }
        if (sibling && sibling.type === 9) {
          if ((dir.name === "else-if" || dir.name === "else") && sibling.branches[sibling.branches.length - 1].condition === void 0) {
            context.onError(
              createCompilerError(30, node.loc)
            );
          }
          context.removeNode();
          const branch = createIfBranch(node, dir);
          if (false) {
            branch.children = [...comments, ...branch.children];
          }
          if (false) {
            const key = branch.userKey;
            if (key) {
              sibling.branches.forEach(({ userKey }) => {
                if (isSameKey(userKey, key)) {
                  context.onError(
                    createCompilerError(
                      29,
                      branch.userKey.loc
                    )
                  );
                }
              });
            }
          }
          sibling.branches.push(branch);
          const onExit = processCodegen && processCodegen(sibling, branch, false);
          traverseNode(branch, context);
          if (onExit) onExit();
          context.currentNode = null;
        } else {
          context.onError(
            createCompilerError(30, node.loc)
          );
        }
        break;
      }
    }
  }
  function createIfBranch(node, dir) {
    const isTemplateIf = node.tagType === 3;
    return {
      type: 10,
      loc: node.loc,
      condition: dir.name === "else" ? void 0 : dir.exp,
      children: isTemplateIf && !findDir(node, "for") ? node.children : [node],
      userKey: findProp(node, `key`),
      isTemplateIf
    };
  }
  function createCodegenNodeForBranch(branch, keyIndex, context) {
    if (branch.condition) {
      return createConditionalExpression(
        branch.condition,
        createChildrenCodegenNode(branch, keyIndex, context),
        // make sure to pass in asBlock: true so that the comment node call
        // closes the current block.
        createCallExpression(context.helper(CREATE_COMMENT), [
          false ? '"v-if"' : '""',
          "true"
        ])
      );
    } else {
      return createChildrenCodegenNode(branch, keyIndex, context);
    }
  }
  function createChildrenCodegenNode(branch, keyIndex, context) {
    const { helper } = context;
    const keyProperty = createObjectProperty(
      `key`,
      createSimpleExpression(
        `${keyIndex}`,
        false,
        locStub,
        2
      )
    );
    const { children } = branch;
    const firstChild = children[0];
    const needFragmentWrapper = children.length !== 1 || firstChild.type !== 1;
    if (needFragmentWrapper) {
      if (children.length === 1 && firstChild.type === 11) {
        const vnodeCall = firstChild.codegenNode;
        injectProp(vnodeCall, keyProperty, context);
        return vnodeCall;
      } else {
        let patchFlag = 64;
        if (false) {
          patchFlag |= 2048;
        }
        return createVNodeCall(
          context,
          helper(FRAGMENT),
          createObjectExpression([keyProperty]),
          children,
          patchFlag,
          void 0,
          void 0,
          true,
          false,
          false,
          branch.loc
        );
      }
    } else {
      const ret = firstChild.codegenNode;
      const vnodeCall = getMemoedVNodeCall(ret);
      if (vnodeCall.type === 13) {
        convertToBlock(vnodeCall, context);
      }
      injectProp(vnodeCall, keyProperty, context);
      return ret;
    }
  }
  function getParentCondition(node) {
    while (true) {
      if (node.type === 19) {
        if (node.alternate.type === 19) {
          node = node.alternate;
        } else {
          return node;
        }
      } else if (node.type === 20) {
        node = node.value;
      }
    }
  }
  var transformFor = createStructuralDirectiveTransform(
    "for",
    (node, dir, context) => {
      const { helper, removeHelper } = context;
      return processFor(node, dir, context, (forNode) => {
        const renderExp = createCallExpression(helper(RENDER_LIST), [
          forNode.source
        ]);
        const isTemplate = isTemplateNode(node);
        const memo = findDir(node, "memo");
        const keyProp = findProp(node, `key`, false, true);
        keyProp && keyProp.type === 7;
        let keyExp = keyProp && (keyProp.type === 6 ? keyProp.value ? createSimpleExpression(keyProp.value.content, true) : void 0 : keyProp.exp);
        const keyProperty = keyExp ? createObjectProperty(`key`, keyExp) : null;
        const isStableFragment = forNode.source.type === 4 && forNode.source.constType > 0;
        const fragmentFlag = isStableFragment ? 64 : keyProp ? 128 : 256;
        forNode.codegenNode = createVNodeCall(
          context,
          helper(FRAGMENT),
          void 0,
          renderExp,
          fragmentFlag,
          void 0,
          void 0,
          true,
          !isStableFragment,
          false,
          node.loc
        );
        return () => {
          var _a;
          let childBlock;
          const { children } = forNode;
          if (false) {
            node.children.some((c) => {
              if (c.type === 1) {
                const key = findProp(c, "key");
                if (key) {
                  context.onError(
                    createCompilerError(
                      33,
                      key.loc
                    )
                  );
                  return true;
                }
              }
            });
          }
          const needFragmentWrapper = children.length !== 1 || children[0].type !== 1;
          const slotOutlet = isSlotOutlet(node) ? node : isTemplate && node.children.length === 1 && isSlotOutlet(node.children[0]) ? node.children[0] : null;
          if (slotOutlet) {
            childBlock = slotOutlet.codegenNode;
            if (isTemplate && keyProperty) {
              injectProp(childBlock, keyProperty, context);
            }
          } else if (needFragmentWrapper) {
            childBlock = createVNodeCall(
              context,
              helper(FRAGMENT),
              keyProperty ? createObjectExpression([keyProperty]) : void 0,
              node.children,
              64,
              void 0,
              void 0,
              true,
              void 0,
              false
            );
          } else {
            childBlock = children[0].codegenNode;
            if (isTemplate && keyProperty) {
              injectProp(childBlock, keyProperty, context);
            }
            const shouldUseBlock = !isStableFragment || childBlock.isBlockRequired === true;
            if (childBlock.isBlock !== shouldUseBlock) {
              if (childBlock.isBlock) {
                removeHelper(OPEN_BLOCK);
                removeHelper(
                  getVNodeBlockHelper(context.inSSR, childBlock.isComponent)
                );
              } else {
                removeHelper(
                  getVNodeHelper(context.inSSR, childBlock.isComponent)
                );
              }
            }
            childBlock.isBlock = shouldUseBlock;
            if (childBlock.isBlock) {
              helper(OPEN_BLOCK);
              helper(getVNodeBlockHelper(context.inSSR, childBlock.isComponent));
            } else {
              helper(getVNodeHelper(context.inSSR, childBlock.isComponent));
              if (childBlock.needsPatch) {
                childBlock.patchFlag = ((_a = childBlock.patchFlag) != null ? _a : 0) | 512;
              }
            }
          }
          if (memo) {
            const loop = createFunctionExpression(
              createForLoopParams(forNode.parseResult, [
                createSimpleExpression(`_cached`)
              ])
            );
            loop.body = createBlockStatement([
              createCompoundExpression([`const _memo = (`, memo.exp, `)`]),
              createCompoundExpression([
                `if (_cached && _cached.el`,
                ...keyExp ? [` && _cached.key === (`, keyExp, `)`] : [],
                ` && ${context.helperString(
                  IS_MEMO_SAME
                )}(_cached, _memo)) return _cached`
              ]),
              createCompoundExpression([`const _item = `, childBlock]),
              createSimpleExpression(`_item.memo = _memo`),
              createSimpleExpression(`return _item`)
            ]);
            renderExp.arguments.push(
              loop,
              createSimpleExpression(`_cache`),
              createSimpleExpression(String(context.cached.length))
            );
            context.cached.push(null);
          } else {
            renderExp.arguments.push(
              createFunctionExpression(
                createForLoopParams(forNode.parseResult),
                childBlock,
                true
              )
            );
          }
        };
      });
    }
  );
  function processFor(node, dir, context, processCodegen) {
    if (!dir.exp) {
      context.onError(
        createCompilerError(31, dir.loc)
      );
      return;
    }
    const parseResult = dir.forParseResult;
    if (!parseResult) {
      context.onError(
        createCompilerError(32, dir.loc)
      );
      return;
    }
    finalizeForParseResult(parseResult, context);
    const { addIdentifiers, removeIdentifiers, scopes } = context;
    const { source, value, key, index } = parseResult;
    const forNode = {
      type: 11,
      loc: dir.loc,
      source,
      valueAlias: value,
      keyAlias: key,
      objectIndexAlias: index,
      parseResult,
      children: isTemplateNode(node) ? node.children : [node]
    };
    context.replaceNode(forNode);
    scopes.vFor++;
    const onExit = processCodegen && processCodegen(forNode);
    return () => {
      scopes.vFor--;
      if (onExit) onExit();
    };
  }
  function finalizeForParseResult(result, context) {
    if (result.finalized) return;
    if (false) {
      validateBrowserExpression(result.source, context);
      if (result.key) {
        validateBrowserExpression(
          result.key,
          context,
          true
        );
      }
      if (result.index) {
        validateBrowserExpression(
          result.index,
          context,
          true
        );
      }
      if (result.value) {
        validateBrowserExpression(
          result.value,
          context,
          true
        );
      }
    }
    result.finalized = true;
  }
  function createForLoopParams({ value, key, index }, memoArgs = []) {
    return createParamsList([value, key, index, ...memoArgs]);
  }
  function createParamsList(args) {
    let i = args.length;
    while (i--) {
      if (args[i]) break;
    }
    return args.slice(0, i + 1).map((arg, i2) => arg || createSimpleExpression(`_`.repeat(i2 + 1), false));
  }
  var defaultFallback = createSimpleExpression(`undefined`, false);
  var trackSlotScopes = (node, context) => {
    if (node.type === 1 && (node.tagType === 1 || node.tagType === 3)) {
      const vSlot = findDir(node, "slot");
      if (vSlot) {
        vSlot.exp;
        context.scopes.vSlot++;
        return () => {
          context.scopes.vSlot--;
        };
      }
    }
  };
  var buildClientSlotFn = (props, _vForExp, children, loc) => createFunctionExpression(
    props,
    children,
    false,
    true,
    children.length ? children[0].loc : loc
  );
  function buildSlots(node, context, buildSlotFn = buildClientSlotFn) {
    context.helper(WITH_CTX);
    const { children, loc } = node;
    const slotsProperties = [];
    const dynamicSlots = [];
    let hasDynamicSlots = context.scopes.vSlot > 0 || context.scopes.vFor > 0;
    const onComponentSlot = findDir(node, "slot", true);
    if (onComponentSlot) {
      const { arg, exp } = onComponentSlot;
      if (arg && !isStaticExp(arg)) {
        hasDynamicSlots = true;
      }
      slotsProperties.push(
        createObjectProperty(
          arg || createSimpleExpression("default", true),
          buildSlotFn(exp, void 0, children, loc)
        )
      );
    }
    let hasTemplateSlots = false;
    let hasNamedDefaultSlot = false;
    const implicitDefaultChildren = [];
    const seenSlotNames = /* @__PURE__ */ new Set();
    let conditionalBranchIndex = 0;
    for (let i = 0; i < children.length; i++) {
      const slotElement = children[i];
      let slotDir;
      if (!isTemplateNode(slotElement) || !(slotDir = findDir(slotElement, "slot", true))) {
        if (slotElement.type !== 3) {
          implicitDefaultChildren.push(slotElement);
        }
        continue;
      }
      if (onComponentSlot) {
        context.onError(
          createCompilerError(37, slotDir.loc)
        );
        break;
      }
      hasTemplateSlots = true;
      const { children: slotChildren, loc: slotLoc } = slotElement;
      const {
        arg: slotName = createSimpleExpression(`default`, true),
        exp: slotProps,
        loc: dirLoc
      } = slotDir;
      let staticSlotName;
      if (isStaticExp(slotName)) {
        staticSlotName = slotName ? slotName.content : `default`;
      } else {
        hasDynamicSlots = true;
      }
      const vFor = findDir(slotElement, "for");
      const slotFunction = buildSlotFn(slotProps, vFor, slotChildren, slotLoc);
      let vIf;
      let vElse;
      if (vIf = findDir(slotElement, "if")) {
        hasDynamicSlots = true;
        dynamicSlots.push(
          createConditionalExpression(
            vIf.exp,
            buildDynamicSlot(slotName, slotFunction, conditionalBranchIndex++),
            defaultFallback
          )
        );
      } else if (vElse = findDir(
        slotElement,
        /^else(?:-if)?$/,
        true
        /* allowEmpty */
      )) {
        let j = i;
        let prev;
        while (j--) {
          prev = children[j];
          if (!isCommentOrWhitespace(prev)) {
            break;
          }
        }
        if (prev && isTemplateNode(prev) && findDir(prev, /^(?:else-)?if$/)) {
          let conditional = dynamicSlots[dynamicSlots.length - 1];
          while (conditional.alternate.type === 19) {
            conditional = conditional.alternate;
          }
          conditional.alternate = vElse.exp ? createConditionalExpression(
            vElse.exp,
            buildDynamicSlot(
              slotName,
              slotFunction,
              conditionalBranchIndex++
            ),
            defaultFallback
          ) : buildDynamicSlot(slotName, slotFunction, conditionalBranchIndex++);
        } else {
          context.onError(
            createCompilerError(30, vElse.loc)
          );
        }
      } else if (vFor) {
        hasDynamicSlots = true;
        const parseResult = vFor.forParseResult;
        if (parseResult) {
          finalizeForParseResult(parseResult, context);
          dynamicSlots.push(
            createCallExpression(context.helper(RENDER_LIST), [
              parseResult.source,
              createFunctionExpression(
                createForLoopParams(parseResult),
                buildDynamicSlot(slotName, slotFunction),
                true
              )
            ])
          );
        } else {
          context.onError(
            createCompilerError(
              32,
              vFor.loc
            )
          );
        }
      } else {
        if (staticSlotName) {
          if (seenSlotNames.has(staticSlotName)) {
            context.onError(
              createCompilerError(
                38,
                dirLoc
              )
            );
            continue;
          }
          seenSlotNames.add(staticSlotName);
          if (staticSlotName === "default") {
            hasNamedDefaultSlot = true;
          }
        }
        slotsProperties.push(createObjectProperty(slotName, slotFunction));
      }
    }
    if (!onComponentSlot) {
      const buildDefaultSlotProperty = (props, children2) => {
        const fn = buildSlotFn(props, void 0, children2, loc);
        if (context.compatConfig) {
          fn.isNonScopedSlot = true;
        }
        return createObjectProperty(`default`, fn);
      };
      if (!hasTemplateSlots) {
        slotsProperties.push(buildDefaultSlotProperty(void 0, children));
      } else if (implicitDefaultChildren.length && // #3766
      // with whitespace: 'preserve', whitespaces between slots will end up in
      // implicitDefaultChildren. Ignore if all implicit children are whitespaces.
      !implicitDefaultChildren.every(isWhitespaceText)) {
        if (hasNamedDefaultSlot) {
          context.onError(
            createCompilerError(
              39,
              implicitDefaultChildren[0].loc
            )
          );
        } else {
          slotsProperties.push(
            buildDefaultSlotProperty(void 0, implicitDefaultChildren)
          );
        }
      }
    }
    const slotFlag = hasDynamicSlots ? 2 : hasForwardedSlots(node.children) ? 3 : 1;
    let slots = createObjectExpression(
      slotsProperties.concat(
        createObjectProperty(
          `_`,
          // 2 = compiled but dynamic = can skip normalization, but must run diff
          // 1 = compiled and static = can skip normalization AND diff as optimized
          createSimpleExpression(
            slotFlag + (false ? ` /* ${slotFlagsText[slotFlag]} */` : ``),
            false
          )
        )
      ),
      loc
    );
    if (dynamicSlots.length) {
      slots = createCallExpression(context.helper(CREATE_SLOTS), [
        slots,
        createArrayExpression(dynamicSlots)
      ]);
    }
    return {
      slots,
      hasDynamicSlots
    };
  }
  function buildDynamicSlot(name, fn, index) {
    const props = [
      createObjectProperty(`name`, name),
      createObjectProperty(`fn`, fn)
    ];
    if (index != null) {
      props.push(
        createObjectProperty(`key`, createSimpleExpression(String(index), true))
      );
    }
    return createObjectExpression(props);
  }
  function hasForwardedSlots(children) {
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      switch (child.type) {
        case 1:
          if (child.tagType === 2 || hasForwardedSlots(child.children)) {
            return true;
          }
          break;
        case 9:
          if (hasForwardedSlots(child.branches)) return true;
          break;
        case 10:
        case 11:
          if (hasForwardedSlots(child.children)) return true;
          break;
      }
    }
    return false;
  }
  var directiveImportMap = /* @__PURE__ */ new WeakMap();
  var transformElement = (node, context) => {
    return function postTransformElement() {
      node = context.currentNode;
      if (!(node.type === 1 && (node.tagType === 0 || node.tagType === 1))) {
        return;
      }
      const { tag, props } = node;
      const isComponent2 = node.tagType === 1;
      let vnodeTag = isComponent2 ? resolveComponentType(node, context) : `"${tag}"`;
      const isDynamicComponent = isObject(vnodeTag) && vnodeTag.callee === RESOLVE_DYNAMIC_COMPONENT;
      let vnodeProps;
      let vnodeChildren;
      let patchFlag = 0;
      let vnodeDynamicProps;
      let dynamicPropNames;
      let vnodeDirectives;
      let needsPatch = false;
      let isBlockRequired = false;
      let shouldUseBlock = (
        // dynamic component may resolve to plain elements
        isDynamicComponent || vnodeTag === TELEPORT || vnodeTag === SUSPENSE || !isComponent2 && // <svg> and <foreignObject> must be forced into blocks so that block
        // updates inside get proper isSVG flag at runtime. (#639, #643)
        // This is technically web-specific, but splitting the logic out of core
        // leads to too much unnecessary complexity.
        (tag === "svg" || tag === "foreignObject" || tag === "math")
      );
      if (props.length > 0) {
        const propsBuildResult = buildProps(
          node,
          context,
          void 0,
          isComponent2,
          isDynamicComponent
        );
        vnodeProps = propsBuildResult.props;
        patchFlag = propsBuildResult.patchFlag;
        dynamicPropNames = propsBuildResult.dynamicPropNames;
        needsPatch = propsBuildResult.needsPatch;
        isBlockRequired = propsBuildResult.isBlockRequired;
        const directives = propsBuildResult.directives;
        vnodeDirectives = directives && directives.length ? createArrayExpression(
          directives.map((dir) => buildDirectiveArgs(dir, context))
        ) : void 0;
        if (propsBuildResult.shouldUseBlock) {
          shouldUseBlock = true;
        }
      }
      if (node.children.length > 0) {
        if (vnodeTag === KEEP_ALIVE) {
          shouldUseBlock = true;
          patchFlag |= 1024;
          if (false) {
            context.onError(
              createCompilerError(47, {
                start: node.children[0].loc.start,
                end: node.children[node.children.length - 1].loc.end,
                source: ""
              })
            );
          }
        }
        const shouldBuildAsSlots = isComponent2 && // Teleport is not a real component and has dedicated runtime handling
        vnodeTag !== TELEPORT && // explained above.
        vnodeTag !== KEEP_ALIVE;
        if (shouldBuildAsSlots) {
          const { slots, hasDynamicSlots } = buildSlots(node, context);
          vnodeChildren = slots;
          if (hasDynamicSlots) {
            patchFlag |= 1024;
          }
        } else if (node.children.length === 1 && vnodeTag !== TELEPORT) {
          const child = node.children[0];
          const type = child.type;
          const hasDynamicTextChild = type === 5 || type === 8;
          if (hasDynamicTextChild && getConstantType(child, context) === 0) {
            patchFlag |= 1;
          }
          if (hasDynamicTextChild || type === 2) {
            vnodeChildren = child;
          } else {
            vnodeChildren = node.children;
          }
        } else {
          vnodeChildren = node.children;
        }
      }
      if (dynamicPropNames && dynamicPropNames.length) {
        vnodeDynamicProps = stringifyDynamicPropNames(dynamicPropNames);
      }
      const vnodeCall = node.codegenNode = createVNodeCall(
        context,
        vnodeTag,
        vnodeProps,
        vnodeChildren,
        patchFlag === 0 ? void 0 : patchFlag,
        vnodeDynamicProps,
        vnodeDirectives,
        !!shouldUseBlock,
        false,
        isComponent2,
        node.loc
      );
      needsPatch = needsPatch && (patchFlag === 0 || patchFlag === 32);
      if (needsPatch) {
        vnodeCall.needsPatch = true;
      }
      if (isBlockRequired) {
        vnodeCall.isBlockRequired = true;
      }
    };
  };
  function resolveComponentType(node, context, ssr = false) {
    let { tag } = node;
    const isExplicitDynamic = isComponentTag(tag);
    const isProp = findProp(
      node,
      "is",
      false,
      true
      /* allow empty */
    );
    if (isProp) {
      if (isExplicitDynamic || isCompatEnabled(
        "COMPILER_IS_ON_ELEMENT",
        context
      )) {
        let exp;
        if (isProp.type === 6) {
          exp = isProp.value && createSimpleExpression(isProp.value.content, true);
        } else {
          exp = isProp.exp;
          if (!exp) {
            exp = createSimpleExpression(`is`, false, isProp.arg.loc);
          }
        }
        if (exp) {
          return createCallExpression(context.helper(RESOLVE_DYNAMIC_COMPONENT), [
            exp
          ]);
        }
      } else if (isProp.type === 6 && isProp.value.content.startsWith("vue:")) {
        tag = isProp.value.content.slice(4);
      }
    }
    const builtIn = isCoreComponent(tag) || context.isBuiltInComponent(tag);
    if (builtIn) {
      if (!ssr) context.helper(builtIn);
      return builtIn;
    }
    context.helper(RESOLVE_COMPONENT);
    context.components.add(tag);
    return toValidAssetId(tag, `component`);
  }
  function buildProps(node, context, props = node.props, isComponent2, isDynamicComponent, ssr = false) {
    const { tag, loc: elementLoc, children } = node;
    let properties = [];
    const mergeArgs = [];
    const runtimeDirectives = [];
    const hasChildren = children.length > 0;
    let shouldUseBlock = false;
    let isBlockRequired = false;
    let patchFlag = 0;
    let hasRef = false;
    let hasClassBinding = false;
    let hasStyleBinding = false;
    let hasHydrationEventBinding = false;
    let hasDynamicKeys = false;
    let hasVnodeHook = false;
    const dynamicPropNames = [];
    const pushMergeArg = (arg) => {
      if (properties.length) {
        mergeArgs.push(
          createObjectExpression(dedupeProperties(properties), elementLoc)
        );
        properties = [];
      }
      if (arg) mergeArgs.push(arg);
    };
    const pushRefVForMarker = () => {
      if (context.scopes.vFor > 0) {
        properties.push(
          createObjectProperty(
            createSimpleExpression("ref_for", true),
            createSimpleExpression("true")
          )
        );
      }
    };
    const analyzePatchFlag = ({ key, value }) => {
      if (isStaticExp(key)) {
        const name = key.content;
        const isEventHandler = isOn(name);
        if (isEventHandler && (!isComponent2 || isDynamicComponent) && // omit the flag for click handlers because hydration gives click
        // dedicated fast path.
        name.toLowerCase() !== "onclick" && // omit v-model handlers
        name !== "onUpdate:modelValue" && // omit onVnodeXXX hooks
        !isReservedProp(name)) {
          hasHydrationEventBinding = true;
        }
        if (isEventHandler && isReservedProp(name)) {
          hasVnodeHook = true;
        }
        if (name === "ref") {
          hasRef = true;
        }
        if (isEventHandler && value.type === 14) {
          value = value.arguments[0];
        }
        if (value.type === 20 || (value.type === 4 || value.type === 8) && getConstantType(value, context) > 0) {
          return;
        }
        if (name === "class") {
          hasClassBinding = true;
        } else if (name === "style") {
          hasStyleBinding = true;
        } else if (name !== "ref" && name !== "key" && !dynamicPropNames.includes(name)) {
          dynamicPropNames.push(name);
        }
        if (isComponent2 && (name === "class" || name === "style") && !dynamicPropNames.includes(name)) {
          dynamicPropNames.push(name);
        }
      } else {
        hasDynamicKeys = true;
      }
    };
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      if (prop.type === 6) {
        const { loc, name, nameLoc, value } = prop;
        let isStatic = true;
        if (name === "ref") {
          hasRef = true;
          pushRefVForMarker();
        }
        if (name === "is" && (isComponentTag(tag) || value && value.content.startsWith("vue:") || isCompatEnabled(
          "COMPILER_IS_ON_ELEMENT",
          context
        ))) {
          continue;
        }
        properties.push(
          createObjectProperty(
            createSimpleExpression(name, true, nameLoc),
            createSimpleExpression(
              value ? value.content : "",
              isStatic,
              value ? value.loc : loc
            )
          )
        );
      } else {
        const { name, arg, exp, loc, modifiers } = prop;
        const isVBind = name === "bind";
        const isVOn = name === "on";
        if (name === "slot") {
          if (!isComponent2) {
            context.onError(
              createCompilerError(40, loc)
            );
          }
          continue;
        }
        if (name === "once" || name === "memo") {
          continue;
        }
        if (name === "is" || isVBind && isStaticArgOf(arg, "is") && (isComponentTag(tag) || isCompatEnabled(
          "COMPILER_IS_ON_ELEMENT",
          context
        ))) {
          continue;
        }
        if (isVOn && ssr) {
          continue;
        }
        if (isVBind && isStaticArgOf(arg, "key")) {
          shouldUseBlock = true;
        }
        if (isVOn && hasChildren && arg && isStaticExp(arg) && camelize(arg.content) === "vue:beforeUpdate") {
          shouldUseBlock = true;
          isBlockRequired = true;
        }
        if (isVBind && isStaticArgOf(arg, "ref")) {
          pushRefVForMarker();
        }
        if (!arg && (isVBind || isVOn)) {
          hasDynamicKeys = true;
          if (exp) {
            if (isVBind) {
              {
                pushMergeArg();
                if (false) {
                  const hasOverridableKeys = mergeArgs.some((arg2) => {
                    if (arg2.type === 15) {
                      return arg2.properties.some(({ key }) => {
                        if (key.type !== 4 || !key.isStatic) {
                          return true;
                        }
                        return key.content !== "class" && key.content !== "style" && !isOn(key.content);
                      });
                    } else {
                      return true;
                    }
                  });
                  if (hasOverridableKeys) {
                    checkCompatEnabled(
                      "COMPILER_V_BIND_OBJECT_ORDER",
                      context,
                      loc
                    );
                  }
                }
                if (isCompatEnabled(
                  "COMPILER_V_BIND_OBJECT_ORDER",
                  context
                )) {
                  mergeArgs.unshift(exp);
                  continue;
                }
              }
              pushRefVForMarker();
              pushMergeArg();
              mergeArgs.push(exp);
            } else {
              pushMergeArg({
                type: 14,
                loc,
                callee: context.helper(TO_HANDLERS),
                arguments: isComponent2 ? [exp] : [exp, `true`]
              });
            }
          } else {
            context.onError(
              createCompilerError(
                isVBind ? 34 : 35,
                loc
              )
            );
          }
          continue;
        }
        if (isVBind && modifiers.some((mod) => mod.content === "prop")) {
          patchFlag |= 32;
        }
        const directiveTransform = context.directiveTransforms[name];
        if (directiveTransform) {
          const { props: props2, needRuntime } = directiveTransform(prop, node, context);
          !ssr && props2.forEach(analyzePatchFlag);
          if (isVOn && arg && !isStaticExp(arg)) {
            pushMergeArg(createObjectExpression(props2, elementLoc));
          } else {
            properties.push(...props2);
          }
          if (needRuntime) {
            runtimeDirectives.push(prop);
            if (isSymbol(needRuntime)) {
              directiveImportMap.set(prop, needRuntime);
            }
          }
        } else if (!isBuiltInDirective(name)) {
          runtimeDirectives.push(prop);
          if (hasChildren) {
            shouldUseBlock = true;
            isBlockRequired = true;
          }
        }
      }
    }
    let propsExpression = void 0;
    if (mergeArgs.length) {
      pushMergeArg();
      if (mergeArgs.length > 1) {
        propsExpression = createCallExpression(
          context.helper(MERGE_PROPS),
          mergeArgs,
          elementLoc
        );
      } else {
        propsExpression = mergeArgs[0];
      }
    } else if (properties.length) {
      propsExpression = createObjectExpression(
        dedupeProperties(properties),
        elementLoc
      );
    }
    if (hasDynamicKeys) {
      patchFlag |= 16;
    } else {
      if (hasClassBinding && !isComponent2) {
        patchFlag |= 2;
      }
      if (hasStyleBinding && !isComponent2) {
        patchFlag |= 4;
      }
      if (dynamicPropNames.length) {
        patchFlag |= 8;
      }
      if (hasHydrationEventBinding) {
        patchFlag |= 32;
      }
    }
    const needsPatch = (patchFlag === 0 || patchFlag === 32) && (hasRef || hasVnodeHook || runtimeDirectives.length > 0);
    if (!shouldUseBlock && needsPatch) {
      patchFlag |= 512;
    }
    if (!context.inSSR && propsExpression) {
      switch (propsExpression.type) {
        case 15:
          let classKeyIndex = -1;
          let styleKeyIndex = -1;
          let hasDynamicKey = false;
          for (let i = 0; i < propsExpression.properties.length; i++) {
            const key = propsExpression.properties[i].key;
            if (isStaticExp(key)) {
              if (key.content === "class") {
                classKeyIndex = i;
              } else if (key.content === "style") {
                styleKeyIndex = i;
              }
            } else if (!key.isHandlerKey) {
              hasDynamicKey = true;
            }
          }
          const classProp = propsExpression.properties[classKeyIndex];
          const styleProp = propsExpression.properties[styleKeyIndex];
          if (!hasDynamicKey) {
            if (classProp && !isStaticExp(classProp.value)) {
              classProp.value = createCallExpression(
                context.helper(NORMALIZE_CLASS),
                [classProp.value]
              );
            }
            if (styleProp && // the static style is compiled into an object,
            // so use `hasStyleBinding` to ensure that it is a dynamic style binding
            (hasStyleBinding || styleProp.value.type === 4 && styleProp.value.content.trim()[0] === `[` || // v-bind:style and style both exist,
            // v-bind:style with static literal object
            styleProp.value.type === 17)) {
              styleProp.value = createCallExpression(
                context.helper(NORMALIZE_STYLE),
                [styleProp.value]
              );
            }
          } else {
            propsExpression = createCallExpression(
              context.helper(NORMALIZE_PROPS),
              [propsExpression]
            );
          }
          break;
        case 14:
          break;
        default:
          propsExpression = createCallExpression(
            context.helper(NORMALIZE_PROPS),
            [
              createCallExpression(context.helper(GUARD_REACTIVE_PROPS), [
                propsExpression
              ])
            ]
          );
          break;
      }
    }
    return {
      props: propsExpression,
      directives: runtimeDirectives,
      patchFlag,
      dynamicPropNames,
      shouldUseBlock,
      needsPatch,
      isBlockRequired
    };
  }
  function dedupeProperties(properties) {
    const knownProps = /* @__PURE__ */ new Map();
    const deduped = [];
    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];
      if (prop.key.type === 8 || !prop.key.isStatic) {
        deduped.push(prop);
        continue;
      }
      const name = prop.key.content;
      const existing = knownProps.get(name);
      if (existing) {
        if (name === "style" || name === "class" || isOn(name)) {
          mergeAsArray2(existing, prop);
        }
      } else {
        knownProps.set(name, prop);
        deduped.push(prop);
      }
    }
    return deduped;
  }
  function mergeAsArray2(existing, incoming) {
    if (existing.value.type === 17) {
      existing.value.elements.push(incoming.value);
    } else {
      existing.value = createArrayExpression(
        [existing.value, incoming.value],
        existing.loc
      );
    }
  }
  function buildDirectiveArgs(dir, context) {
    const dirArgs = [];
    const runtime = directiveImportMap.get(dir);
    if (runtime) {
      dirArgs.push(context.helperString(runtime));
    } else {
      {
        context.helper(RESOLVE_DIRECTIVE);
        context.directives.add(dir.name);
        dirArgs.push(toValidAssetId(dir.name, `directive`));
      }
    }
    const { loc } = dir;
    if (dir.exp) dirArgs.push(dir.exp);
    if (dir.arg) {
      if (!dir.exp) {
        dirArgs.push(`void 0`);
      }
      dirArgs.push(dir.arg);
    }
    if (Object.keys(dir.modifiers).length) {
      if (!dir.arg) {
        if (!dir.exp) {
          dirArgs.push(`void 0`);
        }
        dirArgs.push(`void 0`);
      }
      const trueExpression = createSimpleExpression(`true`, false, loc);
      dirArgs.push(
        createObjectExpression(
          dir.modifiers.map(
            (modifier) => createObjectProperty(modifier, trueExpression)
          ),
          loc
        )
      );
    }
    return createArrayExpression(dirArgs, dir.loc);
  }
  function stringifyDynamicPropNames(props) {
    let propsNamesString = `[`;
    for (let i = 0, l = props.length; i < l; i++) {
      propsNamesString += JSON.stringify(props[i]);
      if (i < l - 1) propsNamesString += ", ";
    }
    return propsNamesString + `]`;
  }
  function isComponentTag(tag) {
    return tag === "component" || tag === "Component";
  }
  var transformSlotOutlet = (node, context) => {
    if (isSlotOutlet(node)) {
      const { children, loc } = node;
      const { slotName, slotProps } = processSlotOutlet(node, context);
      const slotArgs = [
        context.prefixIdentifiers ? `_ctx.$slots` : `$slots`,
        slotName,
        "{}",
        "undefined",
        "true"
      ];
      let expectedLen = 2;
      if (slotProps) {
        slotArgs[2] = slotProps;
        expectedLen = 3;
      }
      if (children.length) {
        slotArgs[3] = createFunctionExpression([], children, false, false, loc);
        expectedLen = 4;
      }
      if (context.scopeId && !context.slotted) {
        expectedLen = 5;
      }
      slotArgs.splice(expectedLen);
      node.codegenNode = createCallExpression(
        context.helper(RENDER_SLOT),
        slotArgs,
        loc
      );
    }
  };
  function processSlotOutlet(node, context) {
    let slotName = `"default"`;
    let slotProps = void 0;
    const nonNameProps = [];
    for (let i = 0; i < node.props.length; i++) {
      const p2 = node.props[i];
      if (p2.type === 6) {
        if (p2.value) {
          if (p2.name === "name") {
            slotName = JSON.stringify(p2.value.content);
          } else {
            p2.name = camelize(p2.name);
            nonNameProps.push(p2);
          }
        }
      } else {
        if (p2.name === "bind" && isStaticArgOf(p2.arg, "name")) {
          if (p2.exp) {
            slotName = p2.exp;
          } else if (p2.arg && p2.arg.type === 4) {
            const name = camelize(p2.arg.content);
            slotName = p2.exp = createSimpleExpression(name, false, p2.arg.loc);
          }
        } else {
          if (p2.name === "bind" && p2.arg && isStaticExp(p2.arg)) {
            p2.arg.content = camelize(p2.arg.content);
          }
          nonNameProps.push(p2);
        }
      }
    }
    if (nonNameProps.length > 0) {
      const { props, directives } = buildProps(
        node,
        context,
        nonNameProps,
        false,
        false
      );
      slotProps = props;
      if (directives.length) {
        context.onError(
          createCompilerError(
            36,
            directives[0].loc
          )
        );
      }
    }
    return {
      slotName,
      slotProps
    };
  }
  var transformOn = (dir, node, context, augmentor) => {
    const { loc, modifiers, arg } = dir;
    if (!dir.exp && !modifiers.length) {
      context.onError(createCompilerError(35, loc));
    }
    let eventName;
    if (arg.type === 4) {
      if (arg.isStatic) {
        let rawName = arg.content;
        if (false) {
          context.onError(createCompilerError(52, arg.loc));
        }
        if (rawName.startsWith("vue:")) {
          rawName = `vnode-${rawName.slice(4)}`;
        }
        const eventString = node.tagType !== 0 || rawName.startsWith("vnode") || !/[A-Z]/.test(rawName) ? (
          // for non-element and vnode lifecycle event listeners, auto convert
          // it to camelCase. See issue #2249
          toHandlerKey(camelize(rawName))
        ) : (
          // preserve case for plain element listeners that have uppercase
          // letters, as these may be custom elements' custom events
          `on:${rawName}`
        );
        eventName = createSimpleExpression(eventString, true, arg.loc);
      } else {
        eventName = createCompoundExpression([
          `${context.helperString(TO_HANDLER_KEY)}(`,
          arg,
          `)`
        ]);
      }
    } else {
      eventName = arg;
      eventName.children.unshift(`${context.helperString(TO_HANDLER_KEY)}(`);
      eventName.children.push(`)`);
    }
    let exp = dir.exp;
    if (exp && !exp.content.trim()) {
      exp = void 0;
    }
    let shouldCache = context.cacheHandlers && !exp && !context.inVOnce;
    if (exp) {
      const isMemberExp = isMemberExpression(exp);
      const isInlineStatement = !(isMemberExp || isFnExpression(exp));
      const hasMultipleStatements = exp.content.includes(`;`);
      if (false) {
        validateBrowserExpression(
          exp,
          context,
          false,
          hasMultipleStatements
        );
      }
      if (isInlineStatement || shouldCache && isMemberExp) {
        exp = createCompoundExpression([
          `${isInlineStatement ? `$event` : `${``}(...args)`} => ${hasMultipleStatements ? `{` : `(`}`,
          exp,
          hasMultipleStatements ? `}` : `)`
        ]);
      }
    }
    let ret = {
      props: [
        createObjectProperty(
          eventName,
          exp || createSimpleExpression(`() => {}`, false, loc)
        )
      ]
    };
    if (augmentor) {
      ret = augmentor(ret);
    }
    if (shouldCache) {
      ret.props[0].value = context.cache(ret.props[0].value);
    }
    ret.props.forEach((p2) => p2.key.isHandlerKey = true);
    return ret;
  };
  var transformBind = (dir, _node, context) => {
    const { modifiers, loc } = dir;
    const arg = dir.arg;
    let { exp } = dir;
    if (exp && exp.type === 4 && !exp.content.trim()) {
      {
        exp = void 0;
      }
    }
    if (arg.type !== 4) {
      arg.children.unshift(`(`);
      arg.children.push(`) || ""`);
    } else if (!arg.isStatic) {
      arg.content = arg.content ? `${arg.content} || ""` : `""`;
    }
    if (modifiers.some((mod) => mod.content === "camel")) {
      if (arg.type === 4) {
        if (arg.isStatic) {
          arg.content = camelize(arg.content);
        } else {
          arg.content = `${context.helperString(CAMELIZE)}(${arg.content})`;
        }
      } else {
        arg.children.unshift(`${context.helperString(CAMELIZE)}(`);
        arg.children.push(`)`);
      }
    }
    if (!context.inSSR) {
      if (modifiers.some((mod) => mod.content === "prop")) {
        injectPrefix(arg, ".");
      }
      if (modifiers.some((mod) => mod.content === "attr")) {
        injectPrefix(arg, "^");
      }
    }
    return {
      props: [createObjectProperty(arg, exp)]
    };
  };
  var injectPrefix = (arg, prefix) => {
    if (arg.type === 4) {
      if (arg.isStatic) {
        arg.content = prefix + arg.content;
      } else {
        arg.content = `\`${prefix}\${${arg.content}}\``;
      }
    } else {
      arg.children.unshift(`'${prefix}' + (`);
      arg.children.push(`)`);
    }
  };
  var transformText = (node, context) => {
    if (node.type === 0 || node.type === 1 || node.type === 11 || node.type === 10) {
      return () => {
        const children = node.children;
        let currentContainer = void 0;
        let hasText = false;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (isText$1(child)) {
            hasText = true;
            for (let j = i + 1; j < children.length; j++) {
              const next = children[j];
              if (isText$1(next)) {
                if (!currentContainer) {
                  currentContainer = children[i] = createCompoundExpression(
                    [child],
                    child.loc
                  );
                }
                currentContainer.children.push(` + `, next);
                children.splice(j, 1);
                j--;
              } else {
                currentContainer = void 0;
                break;
              }
            }
          }
        }
        if (!hasText || // if this is a plain element with a single text child, leave it
        // as-is since the runtime has dedicated fast path for this by directly
        // setting textContent of the element.
        // for component root it's always normalized anyway.
        children.length === 1 && (node.type === 0 || node.type === 1 && node.tagType === 0 && // #3756
        // custom directives can potentially add DOM elements arbitrarily,
        // we need to avoid setting textContent of the element at runtime
        // to avoid accidentally overwriting the DOM elements added
        // by the user through custom directives.
        !node.props.find(
          (p2) => p2.type === 7 && !context.directiveTransforms[p2.name]
        ) && // in compat mode, <template> tags with no special directives
        // will be rendered as a fragment so its children must be
        // converted into vnodes.
        !(node.tag === "template"))) {
          return;
        }
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (isText$1(child) || child.type === 8) {
            const callArgs = [];
            if (child.type !== 2 || child.content !== " ") {
              callArgs.push(child);
            }
            if (!context.ssr && getConstantType(child, context) === 0) {
              callArgs.push(
                1 + (false ? ` /* ${PatchFlagNames[1]} */` : ``)
              );
            }
            children[i] = {
              type: 12,
              content: child,
              loc: child.loc,
              codegenNode: createCallExpression(
                context.helper(CREATE_TEXT),
                callArgs
              )
            };
          }
        }
      };
    }
  };
  var seen$1 = /* @__PURE__ */ new WeakSet();
  var transformOnce = (node, context) => {
    if (node.type === 1 && findDir(node, "once", true)) {
      if (seen$1.has(node) || context.inVOnce || context.inSSR) {
        return;
      }
      seen$1.add(node);
      context.inVOnce = true;
      context.helper(SET_BLOCK_TRACKING);
      return () => {
        context.inVOnce = false;
        const cur = context.currentNode;
        if (cur.codegenNode) {
          cur.codegenNode = context.cache(
            cur.codegenNode,
            true,
            true
          );
        }
      };
    }
  };
  var transformModel = (dir, node, context) => {
    const { exp, arg } = dir;
    if (!exp) {
      context.onError(
        createCompilerError(41, dir.loc)
      );
      return createTransformProps();
    }
    const rawExp = exp.loc.source.trim();
    const expString = exp.type === 4 ? exp.content : rawExp;
    const bindingType = context.bindingMetadata[rawExp];
    if (bindingType === "props" || bindingType === "props-aliased") {
      context.onError(createCompilerError(44, exp.loc));
      return createTransformProps();
    }
    if (bindingType === "literal-const" || bindingType === "setup-const") {
      context.onError(createCompilerError(45, exp.loc));
      return createTransformProps();
    }
    if (!expString.trim() || !isMemberExpression(exp) && true) {
      context.onError(
        createCompilerError(42, exp.loc)
      );
      return createTransformProps();
    }
    const propName = arg ? arg : createSimpleExpression("modelValue", true);
    const eventName = arg ? isStaticExp(arg) ? `onUpdate:${camelize(arg.content)}` : createCompoundExpression(['"onUpdate:" + ', arg]) : `onUpdate:modelValue`;
    let assignmentExp;
    const eventArg = context.isTS ? `($event: any)` : `$event`;
    {
      assignmentExp = createCompoundExpression([
        `${eventArg} => ((`,
        exp,
        `) = $event)`
      ]);
    }
    const props = [
      // modelValue: foo
      createObjectProperty(propName, dir.exp),
      // "onUpdate:modelValue": $event => (foo = $event)
      createObjectProperty(eventName, assignmentExp)
    ];
    if (dir.modifiers.length && node.tagType === 1) {
      const modifiers = dir.modifiers.map((m) => m.content).map((m) => (isSimpleIdentifier(m) ? m : JSON.stringify(m)) + `: true`).join(`, `);
      const modifiersKey = arg ? isStaticExp(arg) ? `${arg.content}Modifiers` : createCompoundExpression([arg, ' + "Modifiers"']) : `modelModifiers`;
      props.push(
        createObjectProperty(
          modifiersKey,
          createSimpleExpression(
            `{ ${modifiers} }`,
            false,
            dir.loc,
            2
          )
        )
      );
    }
    return createTransformProps(props);
  };
  function createTransformProps(props = []) {
    return { props };
  }
  var validDivisionCharRE = /[\w).+\-_$\]]/;
  var transformFilter = (node, context) => {
    if (!isCompatEnabled("COMPILER_FILTERS", context)) {
      return;
    }
    if (node.type === 5) {
      rewriteFilter(node.content, context);
    } else if (node.type === 1) {
      node.props.forEach((prop) => {
        if (prop.type === 7 && prop.name !== "for" && prop.exp) {
          rewriteFilter(prop.exp, context);
        }
      });
    }
  };
  function rewriteFilter(node, context) {
    if (node.type === 4) {
      parseFilter(node, context);
    } else {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (typeof child !== "object") continue;
        if (child.type === 4) {
          parseFilter(child, context);
        } else if (child.type === 8) {
          rewriteFilter(child, context);
        } else if (child.type === 5) {
          rewriteFilter(child.content, context);
        }
      }
    }
  }
  function parseFilter(node, context) {
    const exp = node.content;
    let inSingle = false;
    let inDouble = false;
    let inTemplateString = false;
    let inRegex = false;
    let curly = 0;
    let square = 0;
    let paren = 0;
    let lastFilterIndex = 0;
    let c, prev, i, expression, filters = [];
    for (i = 0; i < exp.length; i++) {
      prev = c;
      c = exp.charCodeAt(i);
      if (inSingle) {
        if (c === 39 && prev !== 92) inSingle = false;
      } else if (inDouble) {
        if (c === 34 && prev !== 92) inDouble = false;
      } else if (inTemplateString) {
        if (c === 96 && prev !== 92) inTemplateString = false;
      } else if (inRegex) {
        if (c === 47 && prev !== 92) inRegex = false;
      } else if (c === 124 && // pipe
      exp.charCodeAt(i + 1) !== 124 && exp.charCodeAt(i - 1) !== 124 && !curly && !square && !paren) {
        if (expression === void 0) {
          lastFilterIndex = i + 1;
          expression = exp.slice(0, i).trim();
        } else {
          pushFilter();
        }
      } else {
        switch (c) {
          case 34:
            inDouble = true;
            break;
          // "
          case 39:
            inSingle = true;
            break;
          // '
          case 96:
            inTemplateString = true;
            break;
          // `
          case 40:
            paren++;
            break;
          // (
          case 41:
            paren--;
            break;
          // )
          case 91:
            square++;
            break;
          // [
          case 93:
            square--;
            break;
          // ]
          case 123:
            curly++;
            break;
          // {
          case 125:
            curly--;
            break;
        }
        if (c === 47) {
          let j = i - 1;
          let p2;
          for (; j >= 0; j--) {
            p2 = exp.charAt(j);
            if (p2 !== " ") break;
          }
          if (!p2 || !validDivisionCharRE.test(p2)) {
            inRegex = true;
          }
        }
      }
    }
    if (expression === void 0) {
      expression = exp.slice(0, i).trim();
    } else if (lastFilterIndex !== 0) {
      pushFilter();
    }
    function pushFilter() {
      filters.push(exp.slice(lastFilterIndex, i).trim());
      lastFilterIndex = i + 1;
    }
    if (filters.length) {
      for (i = 0; i < filters.length; i++) {
        expression = wrapFilter(expression, filters[i], context);
      }
      node.content = expression;
      node.ast = void 0;
    }
  }
  function wrapFilter(exp, filter, context) {
    context.helper(RESOLVE_FILTER);
    const i = filter.indexOf("(");
    if (i < 0) {
      context.filters.add(filter);
      return `${toValidAssetId(filter, "filter")}(${exp})`;
    } else {
      const name = filter.slice(0, i);
      const args = filter.slice(i + 1);
      context.filters.add(name);
      return `${toValidAssetId(name, "filter")}(${exp}${args !== ")" ? "," + args : args}`;
    }
  }
  var seen = /* @__PURE__ */ new WeakSet();
  var transformMemo = (node, context) => {
    if (node.type === 1) {
      const dir = findDir(node, "memo");
      if (!dir || seen.has(node) || context.inSSR) {
        return;
      }
      seen.add(node);
      return () => {
        const codegenNode = node.codegenNode || context.currentNode.codegenNode;
        if (codegenNode && codegenNode.type === 13) {
          if (node.tagType !== 1) {
            convertToBlock(codegenNode, context);
          }
          node.codegenNode = createCallExpression(context.helper(WITH_MEMO), [
            dir.exp,
            createFunctionExpression(void 0, codegenNode),
            `_cache`,
            String(context.cached.length)
          ]);
          context.cached.push(null);
        }
      };
    }
  };
  var transformVBindShorthand = (node, context) => {
    if (node.type === 1) {
      for (const prop of node.props) {
        if (prop.type === 7 && prop.name === "bind" && (!prop.exp || // #13930 :foo in in-DOM templates will be parsed into :foo="" by browser
        prop.exp.type === 4 && !prop.exp.content.trim()) && prop.arg) {
          const arg = prop.arg;
          if (arg.type !== 4 || !arg.isStatic) {
            context.onError(
              createCompilerError(
                53,
                arg.loc
              )
            );
            prop.exp = createSimpleExpression("", true, arg.loc);
          } else {
            const propName = camelize(arg.content);
            if (validFirstIdentCharRE.test(propName[0]) || // allow hyphen first char for https://github.com/vuejs/language-tools/pull/3424
            propName[0] === "-") {
              prop.exp = createSimpleExpression(propName, false, arg.loc);
            }
          }
        }
      }
    }
  };
  function getBaseTransformPreset(prefixIdentifiers) {
    return [
      [
        transformVBindShorthand,
        transformOnce,
        transformIf,
        transformMemo,
        transformFor,
        ...[transformFilter],
        ...false ? [transformExpression] : [],
        transformSlotOutlet,
        transformElement,
        trackSlotScopes,
        transformText
      ],
      {
        on: transformOn,
        bind: transformBind,
        model: transformModel
      }
    ];
  }
  function baseCompile(source, options = {}) {
    const onError = options.onError || defaultOnError;
    const isModuleMode = options.mode === "module";
    {
      if (options.prefixIdentifiers === true) {
        onError(createCompilerError(48));
      } else if (isModuleMode) {
        onError(createCompilerError(49));
      }
    }
    const prefixIdentifiers = false;
    if (options.cacheHandlers) {
      onError(createCompilerError(50));
    }
    if (options.scopeId && !isModuleMode) {
      onError(createCompilerError(51));
    }
    const resolvedOptions = extend({}, options, {
      prefixIdentifiers
    });
    const ast = isString(source) ? baseParse(source, resolvedOptions) : source;
    const [nodeTransforms, directiveTransforms] = getBaseTransformPreset();
    transform(
      ast,
      extend({}, resolvedOptions, {
        nodeTransforms: [
          ...nodeTransforms,
          ...options.nodeTransforms || []
          // user transforms
        ],
        directiveTransforms: extend(
          {},
          directiveTransforms,
          options.directiveTransforms || {}
          // user transforms
        )
      })
    );
    return generate(ast, resolvedOptions);
  }
  var noopDirectiveTransform = () => ({ props: [] });

  // node_modules/@vue/compiler-dom/dist/compiler-dom.esm-bundler.js
  /**
  * @vue/compiler-dom v3.5.44
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  var V_MODEL_RADIO = /* @__PURE__ */ Symbol(false ? `vModelRadio` : ``);
  var V_MODEL_CHECKBOX = /* @__PURE__ */ Symbol(
    false ? `vModelCheckbox` : ``
  );
  var V_MODEL_TEXT = /* @__PURE__ */ Symbol(false ? `vModelText` : ``);
  var V_MODEL_SELECT = /* @__PURE__ */ Symbol(
    false ? `vModelSelect` : ``
  );
  var V_MODEL_DYNAMIC = /* @__PURE__ */ Symbol(
    false ? `vModelDynamic` : ``
  );
  var V_ON_WITH_MODIFIERS = /* @__PURE__ */ Symbol(
    false ? `vOnModifiersGuard` : ``
  );
  var V_ON_WITH_KEYS = /* @__PURE__ */ Symbol(
    false ? `vOnKeysGuard` : ``
  );
  var V_SHOW = /* @__PURE__ */ Symbol(false ? `vShow` : ``);
  var TRANSITION2 = /* @__PURE__ */ Symbol(false ? `Transition` : ``);
  var TRANSITION_GROUP = /* @__PURE__ */ Symbol(
    false ? `TransitionGroup` : ``
  );
  registerRuntimeHelpers({
    [V_MODEL_RADIO]: `vModelRadio`,
    [V_MODEL_CHECKBOX]: `vModelCheckbox`,
    [V_MODEL_TEXT]: `vModelText`,
    [V_MODEL_SELECT]: `vModelSelect`,
    [V_MODEL_DYNAMIC]: `vModelDynamic`,
    [V_ON_WITH_MODIFIERS]: `withModifiers`,
    [V_ON_WITH_KEYS]: `withKeys`,
    [V_SHOW]: `vShow`,
    [TRANSITION2]: `Transition`,
    [TRANSITION_GROUP]: `TransitionGroup`
  });
  var decoder;
  function decodeHtmlBrowser(raw, asAttr = false) {
    if (!decoder) {
      decoder = document.createElement("div");
    }
    if (asAttr) {
      decoder.innerHTML = `<div foo="${raw.replace(/"/g, "&quot;")}">`;
      return decoder.children[0].getAttribute("foo");
    } else {
      decoder.innerHTML = raw;
      return decoder.textContent;
    }
  }
  var parserOptions = {
    parseMode: "html",
    isVoidTag,
    isNativeTag: (tag) => isHTMLTag(tag) || isSVGTag(tag) || isMathMLTag(tag),
    isPreTag: (tag) => tag === "pre",
    isIgnoreNewlineTag: (tag) => tag === "pre" || tag === "textarea",
    decodeEntities: decodeHtmlBrowser,
    isBuiltInComponent: (tag) => {
      if (tag === "Transition" || tag === "transition") {
        return TRANSITION2;
      } else if (tag === "TransitionGroup" || tag === "transition-group") {
        return TRANSITION_GROUP;
      }
    },
    // https://html.spec.whatwg.org/multipage/parsing.html#tree-construction-dispatcher
    getNamespace(tag, parent, rootNamespace) {
      let ns = parent ? parent.ns : rootNamespace;
      if (parent && ns === 2) {
        if (parent.tag === "annotation-xml") {
          if (tag === "svg") {
            return 1;
          }
          if (parent.props.some(
            (a) => a.type === 6 && a.name === "encoding" && a.value != null && (a.value.content === "text/html" || a.value.content === "application/xhtml+xml")
          )) {
            ns = 0;
          }
        } else if (/^m(?:[ions]|text)$/.test(parent.tag) && tag !== "mglyph" && tag !== "malignmark") {
          ns = 0;
        }
      } else if (parent && ns === 1) {
        if (parent.tag === "foreignObject" || parent.tag === "desc" || parent.tag === "title") {
          ns = 0;
        }
      }
      if (ns === 0) {
        if (tag === "svg") {
          return 1;
        }
        if (tag === "math") {
          return 2;
        }
      }
      return ns;
    }
  };
  var transformStyle = (node) => {
    if (node.type === 1) {
      node.props.forEach((p2, i) => {
        if (p2.type === 6 && p2.name === "style" && p2.value) {
          node.props[i] = {
            type: 7,
            name: `bind`,
            arg: createSimpleExpression(`style`, true, p2.loc),
            exp: parseInlineCSS(p2.value.content, p2.loc),
            modifiers: [],
            loc: p2.loc
          };
        }
      });
    }
  };
  var parseInlineCSS = (cssText, loc) => {
    const normalized = parseStringStyle(cssText);
    return createSimpleExpression(
      JSON.stringify(normalized),
      false,
      loc,
      3
    );
  };
  function createDOMCompilerError(code, loc) {
    return createCompilerError(
      code,
      loc,
      false ? DOMErrorMessages : void 0
    );
  }
  var transformVHtml = (dir, node, context) => {
    const { exp, loc } = dir;
    if (!exp) {
      context.onError(
        createDOMCompilerError(54, loc)
      );
    }
    if (node.children.length) {
      context.onError(
        createDOMCompilerError(55, loc)
      );
      node.children.length = 0;
    }
    return {
      props: [
        createObjectProperty(
          createSimpleExpression(`innerHTML`, true, loc),
          exp || createSimpleExpression("", true)
        )
      ]
    };
  };
  var transformVText = (dir, node, context) => {
    const { exp, loc } = dir;
    if (!exp) {
      context.onError(
        createDOMCompilerError(56, loc)
      );
    }
    if (node.children.length) {
      context.onError(
        createDOMCompilerError(57, loc)
      );
      node.children.length = 0;
    }
    return {
      props: [
        createObjectProperty(
          createSimpleExpression(`textContent`, true),
          exp ? getConstantType(exp, context) > 0 ? exp : createCallExpression(
            context.helperString(TO_DISPLAY_STRING),
            [exp],
            loc
          ) : createSimpleExpression("", true)
        )
      ]
    };
  };
  var transformModel2 = (dir, node, context) => {
    const baseResult = transformModel(dir, node, context);
    if (!baseResult.props.length || node.tagType === 1) {
      return baseResult;
    }
    if (dir.arg) {
      context.onError(
        createDOMCompilerError(
          59,
          dir.arg.loc
        )
      );
    }
    function checkDuplicatedValue() {
      const value = findDir(node, "bind");
      if (value && isStaticArgOf(value.arg, "value")) {
        context.onError(
          createDOMCompilerError(
            61,
            value.loc
          )
        );
      }
    }
    const { tag } = node;
    const isCustomElement = context.isCustomElement(tag);
    if (tag === "input" || tag === "textarea" || tag === "select" || isCustomElement) {
      let directiveToUse = V_MODEL_TEXT;
      let isInvalidType = false;
      if (tag === "input" || isCustomElement) {
        const type = findProp(node, `type`);
        if (type) {
          if (type.type === 7) {
            directiveToUse = V_MODEL_DYNAMIC;
          } else if (type.value) {
            switch (type.value.content) {
              case "radio":
                directiveToUse = V_MODEL_RADIO;
                break;
              case "checkbox":
                directiveToUse = V_MODEL_CHECKBOX;
                break;
              case "file":
                isInvalidType = true;
                context.onError(
                  createDOMCompilerError(
                    60,
                    dir.loc
                  )
                );
                break;
              default:
                break;
            }
          }
        } else if (hasDynamicKeyVBind(node)) {
          directiveToUse = V_MODEL_DYNAMIC;
        } else {
        }
      } else if (tag === "select") {
        directiveToUse = V_MODEL_SELECT;
      } else {
      }
      if (!isInvalidType) {
        baseResult.needRuntime = context.helper(directiveToUse);
      }
    } else {
      context.onError(
        createDOMCompilerError(
          58,
          dir.loc
        )
      );
    }
    baseResult.props = baseResult.props.filter(
      (p2) => !(p2.key.type === 4 && p2.key.content === "modelValue")
    );
    return baseResult;
  };
  var isEventOptionModifier = /* @__PURE__ */ makeMap(`passive,once,capture`);
  var isNonKeyModifier = /* @__PURE__ */ makeMap(
    // event propagation management
    `stop,prevent,self,ctrl,shift,alt,meta,exact,middle`
  );
  var maybeKeyModifier = /* @__PURE__ */ makeMap("left,right");
  var isKeyboardEvent = /* @__PURE__ */ makeMap(`onkeyup,onkeydown,onkeypress`);
  var resolveModifiers = (key, modifiers, context, loc) => {
    const keyModifiers = [];
    const nonKeyModifiers = [];
    const eventOptionModifiers = [];
    for (let i = 0; i < modifiers.length; i++) {
      const modifier = modifiers[i].content;
      if (modifier === "native" && checkCompatEnabled(
        "COMPILER_V_ON_NATIVE",
        context,
        loc
      )) {
        eventOptionModifiers.push(modifier);
      } else if (isEventOptionModifier(modifier)) {
        eventOptionModifiers.push(modifier);
      } else {
        if (maybeKeyModifier(modifier)) {
          if (isStaticExp(key)) {
            if (isKeyboardEvent(key.content.toLowerCase())) {
              keyModifiers.push(modifier);
            } else {
              nonKeyModifiers.push(modifier);
            }
          } else {
            keyModifiers.push(modifier);
            nonKeyModifiers.push(modifier);
          }
        } else {
          if (isNonKeyModifier(modifier)) {
            nonKeyModifiers.push(modifier);
          } else {
            keyModifiers.push(modifier);
          }
        }
      }
    }
    return {
      keyModifiers,
      nonKeyModifiers,
      eventOptionModifiers
    };
  };
  var transformClick = (key, event) => {
    const isStaticClick = isStaticExp(key) && key.content.toLowerCase() === "onclick";
    return isStaticClick ? createSimpleExpression(event, true) : key.type !== 4 ? createCompoundExpression([
      `(`,
      key,
      `) === "onClick" ? "${event}" : (`,
      key,
      `)`
    ]) : key;
  };
  var transformOn2 = (dir, node, context) => {
    return transformOn(dir, node, context, (baseResult) => {
      const { modifiers } = dir;
      if (!modifiers.length) return baseResult;
      let { key, value: handlerExp } = baseResult.props[0];
      const { keyModifiers, nonKeyModifiers, eventOptionModifiers } = resolveModifiers(key, modifiers, context, dir.loc);
      if (nonKeyModifiers.includes("right")) {
        key = transformClick(key, `onContextmenu`);
      }
      if (nonKeyModifiers.includes("middle")) {
        key = transformClick(key, `onMouseup`);
      }
      if (nonKeyModifiers.length) {
        handlerExp = createCallExpression(context.helper(V_ON_WITH_MODIFIERS), [
          handlerExp,
          JSON.stringify(nonKeyModifiers)
        ]);
      }
      if (keyModifiers.length && // if event name is dynamic, always wrap with keys guard
      (!isStaticExp(key) || isKeyboardEvent(key.content.toLowerCase()))) {
        handlerExp = createCallExpression(context.helper(V_ON_WITH_KEYS), [
          handlerExp,
          JSON.stringify(keyModifiers)
        ]);
      }
      if (eventOptionModifiers.length) {
        const modifierPostfix = eventOptionModifiers.map(capitalize).join("");
        key = isStaticExp(key) ? createSimpleExpression(`${key.content}${modifierPostfix}`, true) : createCompoundExpression([`(`, key, `) + "${modifierPostfix}"`]);
      }
      return {
        props: [createObjectProperty(key, handlerExp)]
      };
    });
  };
  var transformShow = (dir, node, context) => {
    const { exp, loc } = dir;
    if (!exp) {
      context.onError(
        createDOMCompilerError(62, loc)
      );
    }
    return {
      props: [],
      needRuntime: context.helper(V_SHOW)
    };
  };
  var transformTransition = (node, context) => {
    if (node.type === 1 && node.tagType === 1) {
      const component = context.isBuiltInComponent(node.tag);
      if (component === TRANSITION2) {
        return () => {
          if (!node.children.length) {
            return;
          }
          const multipleChildren = hasMultipleChildren(node);
          if (false) {
            context.onError(
              createDOMCompilerError(
                63,
                {
                  start: node.children[0].loc.start,
                  end: node.children[node.children.length - 1].loc.end,
                  source: ""
                }
              )
            );
          }
          const child = node.children[0];
          if (child.type === 1) {
            for (const p2 of child.props) {
              if (p2.type === 7 && p2.name === "show") {
                node.props.push({
                  type: 6,
                  name: "persisted",
                  nameLoc: node.loc,
                  value: void 0,
                  loc: node.loc
                });
              }
            }
          }
        };
      }
    }
  };
  function hasMultipleChildren(node) {
    const children = node.children = node.children.filter(
      (c) => !isCommentOrWhitespace(c)
    );
    const child = children[0];
    return children.length !== 1 || child.type === 11 || child.type === 9 && child.branches.some(hasMultipleChildren);
  }
  var ignoreSideEffectTags = (node, context) => {
    if (node.type === 1 && node.tagType === 0 && (node.tag === "script" || node.tag === "style")) {
      context.removeNode();
    }
  };
  var DOMNodeTransforms = [
    transformStyle,
    transformTransition,
    ...false ? [validateHtmlNesting] : []
  ];
  var DOMDirectiveTransforms = {
    cloak: noopDirectiveTransform,
    html: transformVHtml,
    text: transformVText,
    model: transformModel2,
    // override compiler-core
    on: transformOn2,
    // override compiler-core
    show: transformShow
  };
  function compile2(src, options = {}) {
    return baseCompile(
      src,
      extend({}, parserOptions, options, {
        nodeTransforms: [
          // ignore <script> and <tag>
          // this is not put inside DOMNodeTransforms because that list is used
          // by compiler-ssr to generate vnode fallback branches
          ignoreSideEffectTags,
          ...DOMNodeTransforms,
          ...options.nodeTransforms || []
        ],
        directiveTransforms: extend(
          {},
          DOMDirectiveTransforms,
          options.directiveTransforms || {}
        ),
        transformHoist: null
      })
    );
  }

  // node_modules/vue/dist/vue.esm-bundler.js
  /**
  * vue v3.5.44
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  if (false) {
    initDev();
  }
  var compileCache = /* @__PURE__ */ Object.create(null);
  function compileToFunction(template, options) {
    if (!isString(template)) {
      if (template.nodeType) {
        template = template.innerHTML;
      } else {
        return NOOP;
      }
    }
    const key = genCacheKey(template, options);
    const cached = compileCache[key];
    if (cached) {
      return cached;
    }
    if (template[0] === "#") {
      const el = document.querySelector(template);
      if (false) {
        warn2(`Template element not found or is empty: ${template}`);
      }
      template = el ? el.innerHTML : ``;
    }
    const opts = extend(
      {
        hoistStatic: true,
        onError: false ? onError : void 0,
        onWarn: false ? (e) => onError(e, true) : NOOP
      },
      options
    );
    if (!opts.isCustomElement && typeof customElements !== "undefined") {
      opts.isCustomElement = (tag) => !!customElements.get(tag);
    }
    const { code } = compile2(template, opts);
    function onError(err, asWarning = false) {
      const message = asWarning ? err.message : `Template compilation error: ${err.message}`;
      const codeFrame = err.loc && generateCodeFrame(
        template,
        err.loc.start.offset,
        err.loc.end.offset
      );
      warn2(codeFrame ? `${message}
${codeFrame}` : message);
    }
    const render2 = new Function("Vue", code)(runtime_dom_esm_bundler_exports);
    render2._rc = true;
    return compileCache[key] = render2;
  }
  registerRuntimeCompiler(compileToFunction);

  // src/ui/settings-modal.js
  init_state();

  // src/ui/theme.js
  var THEME_OPTIONS = [
    { value: "cream", label: "\u5976\u6CB9\u98CE", scheme: "light", swatch: { base: "#f7f0e6", accent: "#85a76a" } },
    { value: "light", label: "\u6D45\u8272", scheme: "light", swatch: { base: "#fbfaf6", accent: "#11110f" } },
    { value: "landmine", label: "\u5730\u96F7\u8272", scheme: "dark", swatch: { base: "#2b2b2b", accent: "#ffc4d4" } },
    { value: "dark", label: "\u6DF1\u8272", scheme: "dark", swatch: { base: "#24292e", accent: "#7fd6ca" } }
  ];
  var THEME_PALETTES = {
    landmine: {
      scheme: "dark",
      backdrop: "rgba(20, 19, 22, 0.78)",
      tokens: {
        "shell-bg": "#2b2b2b",
        "paper": "rgba(255, 196, 212, 0.08)",
        "panel": "#2b2b2b",
        "surface": "#322f32",
        "card": "#322f32",
        "field": "#3e383b",
        "close-bg": "#574e53",
        "line": "rgba(255, 255, 255, 0.08)",
        "line-strong": "rgba(255, 196, 212, 0.25)",
        "ink": "#ffffff",
        "ink-2": "rgba(255, 255, 255, 0.75)",
        "ink-3": "rgba(255, 255, 255, 0.5)",
        "accent": "#ffc4d4",
        "accent-2": "#ffd9e4",
        "on-accent": "#2b2b2b",
        "danger": "#d96c6c",
        "highlight": "#4a4246",
        "raised": "#574e53"
      }
    },
    cream: {
      scheme: "light",
      backdrop: "rgba(92, 70, 44, 0.45)",
      tokens: {
        "shell-bg": "#f7f0e6",
        "paper": "#efe4d7",
        "panel": "#f7f0e6",
        "surface": "#f3ece1",
        "card": "#f3ece1",
        "field": "#ebe2d5",
        "close-bg": "#ebe2d5",
        "line": "rgba(116, 91, 62, 0.12)",
        "line-strong": "rgba(116, 91, 62, 0.22)",
        "ink": "#514638",
        "ink-2": "#735f4a",
        "ink-3": "#9a8268",
        "accent": "#85a76a",
        "accent-2": "#738f5b",
        "on-accent": "#fcf8f1",
        "danger": "#a76561",
        "highlight": "#e3d8c8",
        "raised": "#fffaf3"
      }
    },
    light: {
      scheme: "light",
      backdrop: "rgba(23, 23, 20, 0.4)",
      tokens: {
        "shell-bg": "#f8f5ee",
        "paper": "#ebe9e3",
        "panel": "#f8f5ee",
        "surface": "#f3f2ee",
        "card": "#f3f2ee",
        "field": "#ebe9e4",
        "close-bg": "#ebe9e4",
        "line": "rgba(23, 23, 20, 0.08)",
        "line-strong": "rgba(23, 23, 20, 0.18)",
        "ink": "#11110f",
        "ink-2": "#46443d",
        "ink-3": "#77736a",
        "accent": "#11110f",
        "accent-2": "#2d2b26",
        "on-accent": "#fbfaf7",
        "danger": "#95514b",
        "highlight": "#e1dfd9",
        "raised": "#ffffff"
      }
    },
    dark: {
      scheme: "dark",
      backdrop: "rgba(10, 14, 20, 0.78)",
      tokens: {
        "shell-bg": "#24292e",
        "paper": "#2d343b",
        "panel": "#1f2428",
        "surface": "#2a3036",
        "card": "#2a3036",
        "field": "#31383f",
        "close-bg": "#31383f",
        "line": "rgba(205, 217, 229, 0.1)",
        "line-strong": "rgba(127, 214, 202, 0.28)",
        "ink": "#f0f3f6",
        "ink-2": "#c9d1d9",
        "ink-3": "#8b949e",
        "accent": "#7fd6ca",
        "accent-2": "#69c7bc",
        "on-accent": "#1f2428",
        "danger": "#d07a74",
        "highlight": "#3a424a",
        "raised": "#454e57"
      }
    }
  };
  function generateThemeCssVariables(themeName, prefix = "--igs-settings-") {
    const palette = THEME_PALETTES[themeName] || THEME_PALETTES.cream;
    const lines = [];
    lines.push(`--igs-settings-backdrop: ${palette.backdrop};`);
    for (const [k, v] of Object.entries(palette.tokens)) {
      lines.push(`${prefix}${k}: ${v};`);
    }
    return lines.join(" ");
  }

  // src/ui/settings-modal.js
  init_secondary_llm();
  init_pipeline();

  // src/tauri/reset.js
  init_adapter();
  init_pipeline();
  var TARGET_IDB_DATABASES = [
    "vn",
    "igs-illustrations",
    "igs-cg-gallery",
    "igs-generated-assets",
    "igs-chat-records",
    "igs-director-runtime",
    "igs-cg-index",
    "igs-photo-album",
    "igs-wait-games"
  ];
  function deleteSingleDb(name) {
    return new Promise((resolve2) => {
      try {
        const req = window.indexedDB.deleteDatabase(name);
        req.onsuccess = () => resolve2({ name, ok: true });
        req.onerror = () => resolve2({ name, ok: false });
        req.onblocked = () => {
          console.warn(`[IGS-Patch] IndexedDB ${name} \u5220\u9664\u88AB\u963B\u585E\uFF0C\u8BF7\u5173\u95ED\u5176\u4ED6\u9875\u9762`);
          resolve2({ name, ok: false, blocked: true });
        };
      } catch (_) {
        resolve2({ name, ok: false });
      }
    });
  }
  async function resetAllGalData(options = {}) {
    const isSilent = options.silent === true;
    if (!isSilent) {
      const confirmed = window.confirm(
        "\u3010\u6700\u9AD8\u8B66\u62A5\u3011\u786E\u5B9A\u8981\u91CD\u7F6E\u4E00\u5207\u5417\uFF1F\n\n\u8FD9\u5C06\u6C38\u4E45\u62B9\u9664\uFF1A\n1. \u6240\u6709\u89D2\u8272\u7684\u7ACB\u7ED8\u3001\u5DEE\u5206\u3001\u8863\u67DC\u3001\u573A\u666F\u80CC\u666F\u3001CG\u56FE\u5E93\u4E0E\u9053\u5177\n2. \u6240\u6709\u804A\u5929\u4F1A\u8BDD\u7684\u5386\u53F2\u6F14\u51FA\u5267\u672C\u4E0E\u751F\u6210\u7D20\u6750\u7F13\u5B58\n3. \u5168\u90E8 9 \u9879 Galgame IndexedDB \u6570\u636E\u5E93\u4E0E\u672C\u5730\u5B58\u50A8\u914D\u7F6E\n4. SillyTavern \u6D88\u606F\u6302\u8F7D\u7684\u6F14\u51FA\u5267\u672C\u6570\u636E\n\n\u91CD\u7F6E\u540E\u9875\u9762\u5C06\u5B8C\u5168\u6062\u590D\u81F3\u521D\u6B21\u672A\u914D\u7F6E\u72B6\u6001\u3002\u6B64\u64CD\u4F5C\u4E0D\u53EF\u9006\uFF01"
      );
      if (!confirmed) return { ok: false, reason: "user-cancelled" };
    }
    const report = {
      databasesDeleted: 0,
      localStorageKeysRemoved: 0,
      tauriStoreKeysDeleted: 0,
      chatMessagesCleaned: 0,
      igsShutDown: false
    };
    try {
      const igs = window.IGS || window.ImmersiveGalgameSystem;
      if (igs && typeof igs.shutdown === "function") {
        await igs.shutdown();
        report.igsShutDown = true;
      }
    } catch (err) {
      console.warn("[IGS-Patch] \u5173\u95ED IGS \u5B9E\u4F8B\u5F02\u5E38:", err);
    }
    try {
      const dbNamesToDelete = new Set(TARGET_IDB_DATABASES);
      if (typeof window.indexedDB?.databases === "function") {
        try {
          const existingDbs = await window.indexedDB.databases();
          for (const d of existingDbs) {
            if (d?.name && /^(igs|vn)/i.test(d.name)) {
              dbNamesToDelete.add(d.name);
            }
          }
        } catch (_) {
        }
      }
      const deletePromises = Array.from(dbNamesToDelete).map((dbName) => deleteSingleDb(dbName));
      const results = await Promise.all(deletePromises);
      report.databasesDeleted = results.filter((r) => r.ok).length;
    } catch (err) {
      console.warn("[IGS-Patch] \u5220\u9664 IndexedDB \u5F02\u5E38:", err);
    }
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (/^(igs|vn:|__IGS|tauri_fallback:igs_gal|st-baibai)/i.test(key) || key.includes("igs_gal"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      report.localStorageKeysRemoved = keysToRemove.length;
    } catch (err) {
      console.warn("[IGS-Patch] \u6E05\u7406 localStorage \u5F02\u5E38:", err);
    }
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
      console.warn("[IGS-Patch] \u6E05\u7406 TauriTavern \u6570\u636E\u5F02\u5E38:", err);
    }
    try {
      const chat = window.SillyTavern?.getContext?.()?.chat;
      if (Array.isArray(chat)) {
        let cleaned = 0;
        for (const msg of chat) {
          if (msg?.extra) {
            if (msg.extra.igs_patch_scripts) {
              delete msg.extra.igs_patch_scripts;
              cleaned++;
            }
            if (msg.extra.igs_script) {
              delete msg.extra.igs_script;
              cleaned++;
            }
            if (msg.extra.igs_gal) {
              delete msg.extra.igs_gal;
              cleaned++;
            }
          }
        }
        report.chatMessagesCleaned = cleaned;
        if (cleaned > 0) {
          try {
            window.SillyTavern?.getContext?.()?.saveChat?.();
          } catch (_) {
          }
        }
      }
    } catch (_) {
    }
    clearScriptMemoryStore();
    try {
      window.dispatchEvent(new CustomEvent("igs:legacy-settings-updated", { detail: {} }));
    } catch (_) {
    }
    console.info("[IGS-Patch] Gal \u7CFB\u7EDF\u91CD\u7F6E\u4E00\u5207\u5B8C\u6BD5:", report);
    if (!isSilent) {
      const message = `\u5DF2\u91CD\u7F6E\u4E00\u5207\uFF01
\u5DF2\u62B9\u9664 ${report.databasesDeleted} \u4E2A\u6570\u636E\u5E93\u3001${report.localStorageKeysRemoved} \u9879\u672C\u5730\u5B58\u50A8\u53CA ${report.tauriStoreKeysDeleted} \u6761\u5267\u672C\u3002`;
      if (window.toastr && typeof window.toastr.success === "function") {
        window.toastr.success(message, "\u91CD\u7F6E\u4E00\u5207");
      } else {
        window.alert(message);
      }
    }
    return { ok: true, report };
  }
  var fullResetGalSystem = resetAllGalData;

  // src/ui/settings-modal.js
  init_toast();

  // src/ui/settings-styles.js
  var SETTINGS_MODAL_CSS = `
/* \u5168\u5C4F\u534A\u900F\u660E\u906E\u7F69\u4E0E\u6A21\u7CCA */
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

/* \u4E3B\u7A97\u53E3\u5BB9\u5668 */
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

/* \u9876\u90E8\u5934\u90E8 */
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

/* \u4E3B\u9898\u9009\u62E9\u8272\u5757 (\u5F3A\u5236\u4FDD\u6301\u6C34\u5E73\u6392\u5217\uFF0C\u4E0D\u53D7\u5916\u90E8\u6837\u5F0F\u5E72\u6270) */
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

/* \u5173\u95ED\u6309\u94AE */
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

/* \u6838\u5FC3\u4E3B\u4F53 */
.igs-patch-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* \u5DE6\u4FA7\u5BFC\u822A */
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

/* \u53F3\u4FA7\u5185\u5BB9\u9762\u677F */
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

/* \u6A21\u5F0F\u5207\u6362\u5361\u7247\u7F51\u683C */
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

/* \u72B6\u6001\u5BB9\u5668\u5361\u7247 */
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

/* \u6309\u94AE\u901A\u7528\u89C4\u8303 */
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

/* \u63D0\u793A\u8BCD\u62E6\u622A\u4FE1\u606F\u533A */
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

/* \u526F\u6A21\u578B\u7F51\u683C */
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

/* \u63D0\u793A\u8BCD\u9884\u8BBE\u6D41\u6C34\u7EBF */
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

/* \u6B63\u5219\u88C1\u526A\u89C4\u5219\u76D2\u5B50 */
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

/* \u5168\u5C4F\u7F16\u8F91\u9762\u677F\uFF1A\u76F4\u63A5\u5E73\u94FA\u8986\u76D6\u63A7\u5236\u53F0\u4E3B\u7A97\u53E3\uFF0C\u5F7B\u5E95\u907F\u514D\u5D4C\u5957\u89C6\u53E3\u4F4D\u79FB\u4E0E\u5916\u90E8\u6EA2\u51FA */
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

/* \u5206\u533A\u753B\u5E08\u9762\u677F\u6837\u5F0F */
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

/* \u5371\u9669\u533A\u9879\u76EE */
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

/* \u4E8C\u6B21\u786E\u8BA4\u5F39\u7A97 */
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
   \u79FB\u52A8\u7AEF\u54CD\u5E94\u5F0F\u6DF1\u5EA6\u9002\u914D (@media <= 768px)
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

  /* \u79FB\u52A8\u7AEF\u5BFC\u822A\u8F6C\u4E3A\u9876\u90E8\u6A2A\u5411\u8F7B\u91CF\u6ED1\u6761 */
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

  /* \u6A21\u5F0F\u5361\u7247\u5355\u5217\u5168\u5BBD\u6392\u5217 */
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
    font-size: 16px !important; /* \u5F7B\u5E95\u9632\u6B62 iOS Safari \u805A\u7126\u62C9\u8FD1\u653E\u5927 */
  }

  /* \u89E6\u6478\u64CD\u4F5C\u5373\u65F6\u53CD\u9988 */
  .igs-btn:active,
  .igs-patch-nav-item:active,
  .igs-icon-btn:active,
  .mode-card:active {
    transform: scale(0.98);
    opacity: 0.85;
  }
}
`;
  function injectSettingsStyles() {
    const docs = [document];
    try {
      if (window.parent?.document && !docs.includes(window.parent.document)) docs.push(window.parent.document);
    } catch (_) {
    }
    try {
      if (window.top?.document && !docs.includes(window.top.document)) docs.push(window.top.document);
    } catch (_) {
    }
    for (const doc2 of docs) {
      if (!doc2.getElementById("igs-patch-settings-css")) {
        const style = doc2.createElement("style");
        style.id = "igs-patch-settings-css";
        style.textContent = SETTINGS_MODAL_CSS;
        (doc2.head || doc2.body || doc2.documentElement).appendChild(style);
      }
    }
  }

  // src/ui/settings-modal.js
  init_preset_manager();

  // src/image-gen/baibai-enhancer.js
  init_toast();
  var BAIBAI_PROMPT_KINDS = Object.freeze([
    { id: "sprite", label: "\u7ACB\u7ED8", icon: "fa-person" },
    { id: "expression", label: "\u8868\u60C5\u5DEE\u5206", icon: "fa-face-smile" },
    { id: "background", label: "\u80CC\u666F", icon: "fa-image" },
    { id: "cg", label: "\u5267\u60C5CG", icon: "fa-film" },
    { id: "nsfwCg", label: "NSFW CG", icon: "fa-heart" },
    { id: "avatar", label: "Q\u7248\u5934\u50CF", icon: "fa-circle-user" },
    { id: "item", label: "\u7269\u54C1\u9053\u5177", icon: "fa-cube" },
    { id: "wardrobe", label: "\u6362\u88C5\u8863\u67DC", icon: "fa-shirt" },
    { id: "creature", label: "\u975E\u4EBA\u89D2\u8272", icon: "fa-paw" }
  ]);
  var BUILTIN_NAI_ARTIST_PRESET = Object.freeze({
    id: "bi_default",
    name: "\u9ED8\u8BA4\u753B\u5E08\u4E32",
    desc: "\u5B98\u65B9\u63A8\u8350\u901A\u7528\u4E8C\u6B21\u5143",
    prompt: "0.8::nnmbpx::,0.8::artist:yalmyu::,0.1::smilesmile1312,::,  artist:sh_(shinh), 0.4::chen bin::,0.4::dayama::,healthyman,bacheally,",
    negative: ""
  });
  function getBaiBaiArtistPresets() {
    const list = [
      { ...BUILTIN_NAI_ARTIST_PRESET }
    ];
    try {
      const getContext2 = window.SillyTavern?.getContext || window.parent?.SillyTavern?.getContext;
      const ctx = getContext2 ? getContext2() : null;
      let extSettings = ctx?.extensionSettings;
      if (!extSettings) {
        const raw = localStorage.getItem("extension_settings");
        if (raw) {
          extSettings = JSON.parse(raw);
        }
      }
      const baibai = extSettings?.baibai_image;
      if (baibai?.nai?.artistPresets && Array.isArray(baibai.nai.artistPresets)) {
        for (const p2 of baibai.nai.artistPresets) {
          if (p2 && p2.id && !list.some((x) => x.id === p2.id)) {
            list.push({
              id: p2.id,
              name: p2.name || p2.id,
              desc: p2.desc || "",
              prompt: p2.prompt || "",
              negative: p2.negative || ""
            });
          }
        }
      }
    } catch (e) {
      console.warn("[IGS-Patch] \u8BFB\u53D6\u67CF\u5B9D\u7ED8\u9884\u8BBE\u5931\u8D25:", e);
    }
    return list;
  }
  var STORAGE_KEY2 = "igs:patch:baibai_artists_v3";
  function buildInitialConfig() {
    const kinds = {};
    for (const item of BAIBAI_PROMPT_KINDS) {
      kinds[item.id] = {
        enabled: true,
        presetId: "follow",
        extraPositive: "",
        extraNegative: ""
      };
    }
    return {
      enabled: true,
      kinds
    };
  }
  var activeConfig = null;
  function getBaibaiArtistConfig() {
    if (activeConfig) return activeConfig;
    try {
      const raw = localStorage.getItem(STORAGE_KEY2);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.kinds === "object") {
          const initial = buildInitialConfig();
          const mergedKinds = {};
          for (const item of BAIBAI_PROMPT_KINDS) {
            const existing = parsed.kinds[item.id] || {};
            mergedKinds[item.id] = {
              enabled: existing.enabled !== false,
              presetId: existing.presetId || "follow",
              extraPositive: existing.extraPositive || existing.positive || "",
              extraNegative: existing.extraNegative || existing.negative || ""
            };
          }
          activeConfig = {
            ...initial,
            ...parsed,
            kinds: mergedKinds
          };
          return activeConfig;
        }
      }
      const legacyRaw = localStorage.getItem("igs:patch:baibai_artists_v2");
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        if (legacyParsed && typeof legacyParsed.kinds === "object") {
          const initial = buildInitialConfig();
          for (const item of BAIBAI_PROMPT_KINDS) {
            if (legacyParsed.kinds[item.id]) {
              initial.kinds[item.id].enabled = legacyParsed.kinds[item.id].enabled !== false;
              initial.kinds[item.id].extraPositive = legacyParsed.kinds[item.id].positive || "";
              initial.kinds[item.id].extraNegative = legacyParsed.kinds[item.id].negative || "";
            }
          }
          activeConfig = initial;
          return activeConfig;
        }
      }
    } catch (_) {
    }
    activeConfig = buildInitialConfig();
    return activeConfig;
  }
  function saveBaibaiArtistConfig(cfg) {
    activeConfig = cfg;
    try {
      localStorage.setItem(STORAGE_KEY2, JSON.stringify(cfg));
    } catch (_) {
    }
  }
  var currentActiveKind = null;
  var currentActivityId = null;
  function setupActivityWatcher() {
    const onActivity = (e) => {
      const detail = e.detail || e;
      if (detail && detail.type === "start") {
        currentActiveKind = detail.kind || "cg";
        currentActivityId = detail.id;
      } else if (detail && detail.type === "end" && detail.id === currentActivityId) {
        currentActiveKind = null;
        currentActivityId = null;
      }
    };
    window.addEventListener("igs:image-activity", onActivity);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.addEventListener("igs:image-activity", onActivity);
      }
    } catch (_) {
    }
  }
  function detectKindFromPayload(payload) {
    if (currentActiveKind) return currentActiveKind;
    const p2 = String(payload?.prompt || "").toLowerCase();
    const size = String(payload?.size || "").toLowerCase();
    const chars = Array.isArray(payload?.characters) ? payload.characters : [];
    if (p2.includes("chibi") || p2.includes("super deformed") || p2.includes("sticker")) {
      return "avatar";
    }
    if (p2.includes("close-up") || p2.includes("expressive face") || p2.includes("blush") || p2.includes("pout")) {
      return "expression";
    }
    if (p2.includes("no humans") || p2.includes("scenery") || size === "landscape" && chars.length === 0) {
      return "background";
    }
    if (p2.includes("white background") || p2.includes("simple background") || p2.includes("standing") || chars.length > 0) {
      return "sprite";
    }
    if (p2.includes("item focus") || p2.includes("still life") || p2.includes("object")) {
      return "item";
    }
    if (p2.includes("creature") || p2.includes("beast") || p2.includes("monster")) {
      return "creature";
    }
    if (p2.includes("wearing") || p2.includes("outfit")) {
      return "wardrobe";
    }
    return "cg";
  }
  function prependTags(head, tail) {
    const h2 = String(head || "").trim().replace(/^,+|,+$/g, "").trim();
    const t = String(tail || "").trim().replace(/^,+|,+$/g, "").trim();
    if (!h2) return t;
    if (!t) return h2;
    return `${h2}, ${t}`;
  }
  var isHookInstalled = false;
  function setupBaibaiEnhancer() {
    if (isHookInstalled) return;
    setupActivityWatcher();
    const tryWrap = (target) => {
      if (!target || !target.STBaiBaiImage || target.STBaiBaiImage.__igsHooked) return false;
      const baibai = target.STBaiBaiImage;
      const originalGenerate = baibai.generate.bind(baibai);
      baibai.generate = async function interceptedGenerate(payload = {}, options = {}) {
        const workingPayload = { ...payload };
        const cfg = getBaibaiArtistConfig();
        if (cfg.enabled) {
          const kind = detectKindFromPayload(workingPayload);
          const kindEntry = cfg.kinds[kind];
          if (kindEntry && kindEntry.enabled !== false) {
            const presetId = kindEntry.presetId || "follow";
            if (presetId === "none") {
              if (kindEntry.extraPositive) {
                workingPayload.prompt = prependTags(kindEntry.extraPositive, workingPayload.prompt);
              }
              if (kindEntry.extraNegative) {
                workingPayload.negative = prependTags(kindEntry.extraNegative, workingPayload.negative);
              }
            } else if (presetId !== "follow") {
              const presets = getBaiBaiArtistPresets();
              const matched = presets.find((p2) => p2.id === presetId);
              if (matched) {
                const finalPositive = prependTags(matched.prompt, kindEntry.extraPositive);
                const finalNegative = prependTags(matched.negative, kindEntry.extraNegative);
                if (finalPositive) {
                  workingPayload.prompt = prependTags(finalPositive, workingPayload.prompt);
                }
                if (finalNegative) {
                  workingPayload.negative = prependTags(finalNegative, workingPayload.negative);
                }
                const kindLabel = (BAIBAI_PROMPT_KINDS.find((k) => k.id === kind) || {}).label || kind;
                console.info(`[IGS-Patch] \u67CF\u5B9D\u7ED8\u751F\u56FE\uFF1A\u5DF2\u5957\u7528\u3010${kindLabel}\u3011\u7ED1\u5B9A\u7684\u9884\u8BBE\u3010${matched.name}\u3011`);
              }
            } else {
              if (kindEntry.extraPositive) {
                workingPayload.prompt = prependTags(kindEntry.extraPositive, workingPayload.prompt);
              }
              if (kindEntry.extraNegative) {
                workingPayload.negative = prependTags(kindEntry.extraNegative, workingPayload.negative);
              }
            }
          }
        }
        return originalGenerate(workingPayload, options);
      };
      baibai.__igsHooked = true;
      console.info("[IGS-Patch] \u67CF\u5B9D\u7ED8 (STBaiBaiImage) \u5206\u533A\u753B\u98CE\u8054\u52A8\u62E6\u622A\u5668\u5DF2\u6302\u8F7D\u5C31\u7EEA\u3002");
      return true;
    };
    const runChecks = () => {
      tryWrap(globalThis);
      tryWrap(window);
      try {
        if (window.parent) tryWrap(window.parent);
      } catch (_) {
      }
      try {
        if (window.top) tryWrap(window.top);
      } catch (_) {
      }
    };
    runChecks();
    window.addEventListener("st-baibai-image:ready", runChecks);
    window.addEventListener("st-baibai-image:changed", runChecks);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.addEventListener("st-baibai-image:ready", runChecks);
        window.parent.addEventListener("st-baibai-image:changed", runChecks);
      }
    } catch (_) {
    }
    const interval = setInterval(() => {
      runChecks();
      if (globalThis.STBaiBaiImage?.__igsHooked) {
        clearInterval(interval);
      }
    }, 1500);
    isHookInstalled = true;
  }

  // src/baibai/book-bridge.js
  init_state();
  init_toast();
  function getBaiBaiBookApi() {
    for (const w of getCandidateWindows6()) {
      try {
        if (w.STBaiBaiBook && typeof w.STBaiBaiBook.getSnapshot === "function") {
          return w.STBaiBaiBook;
        }
      } catch (_) {
      }
    }
    return null;
  }
  function getCandidateWindows6() {
    const wins = [window];
    try {
      if (window.parent && !wins.includes(window.parent)) wins.push(window.parent);
    } catch (_) {
    }
    try {
      if (window.top && !wins.includes(window.top)) wins.push(window.top);
    } catch (_) {
    }
    try {
      const rootDoc = (window.top || window.parent || window).document;
      if (rootDoc) {
        const iframes = rootDoc.querySelectorAll("iframe");
        for (const f of iframes) {
          try {
            const fw = f.contentWindow;
            if (fw && !wins.includes(fw)) wins.push(fw);
          } catch (_) {
          }
        }
      }
    } catch (_) {
    }
    return wins;
  }
  function isNumericMetricValue(val) {
    if (typeof val === "number") {
      return Number.isFinite(val);
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed || trimmed.length > 12) return false;
      if (/[。，！？,!?、\n\r\t:：]/.test(trimmed)) return false;
      return /^[-+]?\d+(?:\.\d+)?(?:\s*[\/%]\s*\d+(?:\.\d+)?)?$/.test(trimmed);
    }
    return false;
  }
  function extractFilteredNumericVars(varsTree) {
    const list = [];
    if (!varsTree || typeof varsTree !== "object") return list;
    function walk2(node, prefix = "") {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return;
      for (const [key, val] of Object.entries(node)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        if (isNumericMetricValue(val)) {
          let label = key;
          if (prefix) {
            const parts = fullPath.split(".");
            label = parts.length > 2 ? `${parts[parts.length - 2]}-${parts[parts.length - 1]}` : fullPath;
          }
          list.push({
            path: fullPath,
            label,
            value: typeof val === "number" ? String(val) : String(val).trim()
          });
        } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
          walk2(val, fullPath);
        }
      }
    }
    walk2(varsTree);
    return list;
  }
  var cachedFloorSnapshot = null;
  var cachedFloorTables = null;
  var cachedRevision = -1;
  function convertSnapshotToIgsTables(snapshot) {
    if (!snapshot) return {};
    const state = snapshot.state || {};
    const proto = snapshot.protagonist || {};
    const npcs = Array.isArray(snapshot.npcs) ? snapshot.npcs : [];
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const scenes = Array.isArray(snapshot.scenes) ? snapshot.scenes : [];
    const vars = snapshot.vars || {};
    const protoName = proto.identity || "\u4E3B\u89D2";
    const charColumns = [
      "\u59D3\u540D",
      "\u6027\u522B",
      "\u5E74\u9F84",
      "\u5916\u8C8C\u7279\u5F81",
      "\u7A7F\u7740\u6253\u626E",
      "\u6240\u5728\u5730\u70B9",
      "\u5F53\u4E0B\u60F3\u6CD5",
      "\u5185\u5FC3\u597D\u611F",
      "\u5916\u5728\u6001\u5EA6",
      "\u89D2\u8272\u7C7B\u578B",
      "\u4E00\u53E5\u8BDD\u4ECB\u7ECD"
    ];
    const charRows = [];
    charRows.push([
      protoName,
      proto.gender || "",
      proto.age || "",
      proto.appearance || "",
      proto.outfit || "",
      state.location || "",
      proto.condition || "",
      "",
      "",
      "\u4E3B\u89D2",
      proto.identity || "\u4E3B\u89D2"
    ]);
    for (const n of npcs) {
      if (!n || !n.name) continue;
      charRows.push([
        n.name,
        n.gender || "",
        n.age || "",
        n.desc || "",
        n.outfit || "",
        n.location || state.location || "",
        n.affinityNote || "",
        n.affinityInner != null ? String(n.affinityInner) : "",
        n.affinityOuter != null ? String(n.affinityOuter) : "",
        n.important ? "\u4E3B\u8981\u89D2\u8272" : "NPC",
        n.title || ""
      ]);
    }
    const sheetChars = {
      uid: "sheet_chars",
      name: "\u91CD\u8981\u89D2\u8272\u8868",
      orderNo: 1,
      content: [charColumns, ...charRows]
    };
    const numericVars = extractFilteredNumericVars(vars);
    let statsColumns = ["\u59D3\u540D"];
    let statsProtoRow = [protoName];
    let statsUserRow = ["user"];
    if (numericVars.length > 0) {
      for (const item of numericVars) {
        statsColumns.push(item.label);
        statsProtoRow.push(item.value);
        statsUserRow.push(item.value);
      }
    } else {
      statsColumns.push("\u72B6\u6001");
      statsProtoRow.push("\u6B63\u5E38");
      statsUserRow.push("\u6B63\u5E38");
    }
    const sheetStats = {
      uid: "sheet_stats",
      name: "\u72B6\u6001\u6570\u503C\u8868",
      orderNo: 2,
      content: [statsColumns, statsProtoRow, statsUserRow]
    };
    const mapColumns = ["row_id", "\u4E0A\u7EA7\u5730\u70B9ID", "\u5730\u70B9\u540D\u79F0", "x", "y", "\u573A\u666F\u63CF\u8FF0"];
    const mapRows = [];
    if (scenes.length > 0) {
      scenes.forEach((sc, idx) => {
        mapRows.push([
          sc.id || String(idx + 1),
          sc.parentId || "",
          sc.name || "",
          "0.5",
          "0.5",
          sc.desc || ""
        ]);
      });
    } else {
      mapRows.push([
        "1",
        "",
        state.location || "\u5F53\u524D\u5730\u70B9",
        "0.5",
        "0.5",
        state.time ? `\u65F6\u6BB5: ${state.time}` : ""
      ]);
    }
    const sheetMap = {
      uid: "sheet_map",
      name: "\u573A\u666F\u5730\u70B9\u8868",
      orderNo: 3,
      content: [mapColumns, ...mapRows]
    };
    const itemColumns = ["\u7269\u54C1\u540D\u79F0", "\u6570\u91CF", "\u7269\u54C1\u72B6\u6001", "\u6301\u6709\u8005", "\u63CF\u8FF0"];
    const itemRows = [];
    for (const it of items) {
      if (!it || !it.name) continue;
      itemRows.push([
        it.name,
        it.qty != null ? String(it.qty) : "1",
        it.carried ? "\u88C5\u5907\u4E2D" : "\u80CC\u5305",
        protoName,
        it.desc || ""
      ]);
    }
    const sheetInventory = {
      uid: "sheet_inventory",
      name: "\u7269\u54C1\u80CC\u5305\u8868",
      orderNo: 4,
      content: [itemColumns, ...itemRows]
    };
    return {
      sheet_chars: sheetChars,
      sheet_stats: sheetStats,
      sheet_map: sheetMap,
      sheet_inventory: sheetInventory
    };
  }
  var VirtualAutoCardUpdaterAPI = class {
    constructor() {
      this.callbacks = /* @__PURE__ */ new Set();
      this._setupEventListener();
    }
    _setupEventListener() {
      for (const w of getCandidateWindows6()) {
        try {
          w.addEventListener("st-baibai-book:changed", () => {
            this._triggerCallbacks();
          });
        } catch (_) {
        }
      }
    }
    _triggerCallbacks() {
      cachedFloorSnapshot = null;
      cachedFloorTables = null;
      for (const cb of this.callbacks) {
        try {
          if (typeof cb === "function") cb();
        } catch (err) {
          console.warn("[IGS-Patch] \u6570\u636E\u5E93\u66F4\u65B0\u56DE\u8C03\u5F02\u5E38:", err);
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
        console.error("[IGS-Patch] \u5BFC\u51FA\u67CF\u5B9D\u4E66\u865A\u62DF\u8868\u5F02\u5E38:", e);
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
      if (typeof cb === "function") {
        this.callbacks.add(cb);
      }
    }
    unregisterTableUpdateCallback(cb) {
      this.callbacks.delete(cb);
    }
  };
  var virtualApiInstance = null;
  function setupBaiBaiBookBridge() {
    const bookApi = getBaiBaiBookApi();
    if (!virtualApiInstance) {
      virtualApiInstance = new VirtualAutoCardUpdaterAPI();
    }
    for (const w of getCandidateWindows6()) {
      try {
        w.AutoCardUpdaterAPI = virtualApiInstance;
        w.__IGS_VIRTUAL_SHUJUKU__ = virtualApiInstance;
      } catch (_) {
      }
    }
    if (bookApi) {
      console.info(`[IGS-Patch] \u67CF\u5B9D\u4E66\u865A\u62DF\u6570\u636E\u5E93\u6865\u63A5\u5C31\u7EEA - \u63D2\u4EF6\u7248\u672C: ${bookApi.pluginVersion || "v1"}`);
    } else {
      console.info("[IGS-Patch] \u67CF\u5B9D\u4E66\u865A\u62DF\u6570\u636E\u5E93\u6865\u63A5\u5DF2\u6302\u8F7D (\u7B49\u5F85\u67CF\u5B9D\u4E66\u5C31\u7EEA)");
      for (const w of getCandidateWindows6()) {
        try {
          w.addEventListener("st-baibai-book:ready", () => {
            console.info("[IGS-Patch] \u4FA6\u6D4B\u5230\u67CF\u5B9D\u4E66\u5DF2\u6302\u8F7D\uFF0C\u865A\u62DF\u6570\u636E\u5E93\u6865\u63A5\u5DF2\u6FC0\u6D3B\u3002");
            virtualApiInstance._triggerCallbacks();
            notifyStateChange();
          }, { once: true });
        } catch (_) {
        }
      }
    }
  }

  // src/ui/settings-modal.js
  var isModalVisible = ref(false);
  var appInstance = null;
  var containerEl = null;
  function openSettingsModal(targetDoc = null) {
    console.info("[IGS-Patch] \u6B63\u5728\u547C\u51FA\u653E\u6620\u8BBE\u7F6E\u5168\u5C4F\u63A7\u5236\u53F0...");
    injectSettingsStyles();
    detectAndSyncIgsTheme();
    ensureMounted(targetDoc);
    triggerIgsPromptResync();
    isModalVisible.value = true;
  }
  function closeSettingsModal() {
    isModalVisible.value = false;
  }
  function getCandidateDocument2() {
    try {
      if (window.parent && window.parent.document) return window.parent.document;
    } catch (_) {
    }
    try {
      if (window.top && window.top.document) return window.top.document;
    } catch (_) {
    }
    return document;
  }
  function ensureMounted(targetDoc = null) {
    const doc2 = targetDoc || getCandidateDocument2();
    if (!doc2) return;
    let container = doc2.getElementById("igs-patch-settings-mount-root");
    if (!container) {
      container = doc2.createElement("div");
      container.id = "igs-patch-settings-mount-root";
      (doc2.body || doc2.documentElement).appendChild(container);
    }
    containerEl = container;
    if (!appInstance) {
      try {
        appInstance = createApp(SettingsRootComponent);
        appInstance.mount(containerEl);
      } catch (err) {
        console.error("[IGS-Patch] \u6302\u8F7D Vue 3 \u8BBE\u7F6E\u9762\u677F\u5931\u8D25:", err);
      }
    } else if (containerEl && !doc2.body.contains(containerEl)) {
      (doc2.body || doc2.documentElement).appendChild(containerEl);
    }
  }
  var SettingsRootComponent = {
    setup() {
      const visible = isModalVisible;
      const activeTab = ref("production");
      const showPromptDetails = ref(false);
      const state = reactive({
        productionMode: patchState.productionMode,
        interceptedPrompt: patchState.interceptedPrompt,
        productionStatus: patchState.productionStatus,
        theme: patchState.theme
      });
      const llmTesting = ref(false);
      const llmTestResult = ref(null);
      const currentFloorInfo = reactive({
        id: null,
        swipeId: 0,
        totalSwipes: 1,
        textLen: 0,
        hasScript: false,
        loading: false,
        characterName: "",
        rawText: ""
      });
      const confirmDialog = reactive({
        visible: false,
        title: "",
        content: "",
        onConfirm: null
      });
      const themeStyleVars = computed2(() => {
        return generateThemeCssVariables(state.theme);
      });
      const secondaryLlmConfig = computed2(() => {
        return getIgsSecondaryLlmConfig() || { source: "tavern", model: "\u9152\u9986\u539F\u751F\u9ED8\u8BA4" };
      });
      const preset = reactive(getPromptPreset());
      const showCompiledPreview = ref(false);
      const showRegexPanel = ref(false);
      const expandedItemIds = reactive({});
      const isItemExpanded = (id) => !!expandedItemIds[id];
      const toggleItemCollapse = (id) => {
        expandedItemIds[id] = !expandedItemIds[id];
      };
      const handleRoleCycle = (item) => {
        item.role = cycleRole(item.role);
        savePromptPreset(preset);
      };
      const handleMoveItemUp = (idx) => {
        if (idx > 0) {
          const temp = preset.items[idx];
          preset.items[idx] = preset.items[idx - 1];
          preset.items[idx - 1] = temp;
          savePromptPreset(preset);
        }
      };
      const handleMoveItemDown = (idx) => {
        if (idx < preset.items.length - 1) {
          const temp = preset.items[idx];
          preset.items[idx] = preset.items[idx + 1];
          preset.items[idx + 1] = temp;
          savePromptPreset(preset);
        }
      };
      const handleAddItem = () => {
        preset.items.push({
          id: "custom_" + Date.now(),
          type: "custom",
          role: "system",
          name: "\u81EA\u5B9A\u4E49\u6761\u76EE",
          content: "",
          enabled: true,
          removable: true
        });
        savePromptPreset(preset);
      };
      const handleDeleteItem = (idx) => {
        preset.items.splice(idx, 1);
        savePromptPreset(preset);
      };
      const handleResetPreset = () => {
        const def2 = resetPromptPreset();
        Object.assign(preset, def2);
        notifyToast("\u5DF2\u6062\u590D\u9ED8\u8BA4\u9884\u8BBE", "info");
      };
      const handleAddRegexRule = () => {
        preset.floorRegexRules.push({
          id: "re_" + Date.now(),
          name: "\u81EA\u5B9A\u4E49\u6B63\u5219",
          pattern: "",
          replacement: "",
          flags: "g",
          enabled: true
        });
        savePromptPreset(preset);
      };
      const handleDeleteRegexRule = (idx) => {
        preset.floorRegexRules.splice(idx, 1);
        savePromptPreset(preset);
      };
      const handleSavePresetChanges = () => {
        savePromptPreset(preset);
      };
      const expandEditor = reactive({
        visible: false,
        item: null,
        title: "",
        content: "",
        onSave: null
      });
      const handleOpenExpandEditor = (item) => {
        expandEditor.item = item;
        expandEditor.title = item.name || "\u7F16\u8F91\u63D0\u793A\u8BCD";
        expandEditor.content = item.content || "";
        expandEditor.onSave = null;
        expandEditor.visible = true;
      };
      const handleSaveExpandEditor = () => {
        if (typeof expandEditor.onSave === "function") {
          expandEditor.onSave(expandEditor.content);
        } else if (expandEditor.item) {
          expandEditor.item.content = expandEditor.content;
          savePromptPreset(preset);
        }
        expandEditor.visible = false;
        notifyToast("\u4FDD\u5B58\u6210\u529F", "info");
      };
      const handleCloseExpandEditor = () => {
        expandEditor.visible = false;
      };
      const baibaiConfig = reactive(getBaibaiArtistConfig());
      const baibaiKinds = BAIBAI_PROMPT_KINDS;
      const availablePresets = ref(getBaiBaiArtistPresets());
      const isBaibaiDetected = ref(Boolean(window.STBaiBaiImage || window.parent?.STBaiBaiImage));
      const expandedArtistKinds = reactive({});
      const isArtistKindExpanded = (id) => !!expandedArtistKinds[id];
      const toggleArtistKindCollapse = (id) => {
        expandedArtistKinds[id] = !expandedArtistKinds[id];
      };
      const handleSaveBaibaiConfig = () => {
        saveBaibaiArtistConfig(baibaiConfig);
      };
      const handleRefreshPresets = () => {
        availablePresets.value = getBaiBaiArtistPresets();
        notifyToast("\u5DF2\u5237\u65B0\u67CF\u5B9D\u7ED8\u9884\u8BBE\u5217\u8868", "info");
      };
      const handleResetAllToFollow = () => {
        for (const item of baibaiKinds) {
          if (baibaiConfig.kinds[item.id]) {
            baibaiConfig.kinds[item.id].presetId = "follow";
            baibaiConfig.kinds[item.id].enabled = true;
          }
        }
        saveBaibaiArtistConfig(baibaiConfig);
        notifyToast("\u5DF2\u5C06\u6240\u6709\u7C7B\u522B\u91CD\u7F6E\u4E3A\u8DDF\u968F\u67CF\u5B9D\u7ED8\u5F53\u524D\u8BBE\u7F6E", "info");
      };
      const getPresetDetails = (presetId) => {
        if (!presetId || presetId === "follow" || presetId === "none") return null;
        return availablePresets.value.find((p2) => p2.id === presetId) || null;
      };
      const isBaiBaiBookDetected = ref(Boolean(getBaiBaiBookApi()));
      const detectedNumericVars = ref([]);
      const refreshBaiBaiBookInfo = () => {
        const bookApi = getBaiBaiBookApi();
        isBaiBaiBookDetected.value = Boolean(bookApi);
        if (bookApi) {
          try {
            const snap = bookApi.getSnapshot();
            detectedNumericVars.value = extractFilteredNumericVars(snap?.vars);
          } catch (_) {
          }
        }
      };
      refreshBaiBaiBookInfo();
      const getPresetDisplayName = (presetId) => {
        if (!presetId || presetId === "follow") return "\u8DDF\u968F\u5168\u5C40";
        if (presetId === "none") return "\u7EAF\u51C0\u753B\u9762";
        const found = availablePresets.value.find((p2) => p2.id === presetId);
        return found ? found.name : presetId;
      };
      const handleOpenArtistEditor = (kindId, field, fieldLabel) => {
        const kind = baibaiKinds.find((k) => k.id === kindId);
        const title = `${kind?.label || kindId} \xB7 ${fieldLabel}`;
        expandEditor.item = null;
        expandEditor.title = title;
        expandEditor.content = baibaiConfig.kinds[kindId]?.[field] || "";
        expandEditor.onSave = (newContent) => {
          if (baibaiConfig.kinds[kindId]) {
            baibaiConfig.kinds[kindId][field] = newContent;
            saveBaibaiArtistConfig(baibaiConfig);
          }
        };
        expandEditor.visible = true;
      };
      const previewCompiledMessages = computed2(() => {
        return compilePromptMessages(
          currentFloorInfo.rawText || "\u591C\u665A\uFF0C\u7A97\u5916\u98D8\u7740\u7EC6\u96E8\u3002\u6797\u5C0F\u96E8\u8F7B\u8F7B\u53F9\u4E86\u53E3\u6C14\uFF0C\u5408\u4E0A\u624B\u4E2D\u7684\u4E66\u672C\u3002",
          { characterName: currentFloorInfo.characterName }
        );
      });
      const updateStateFromGlobal = () => {
        state.productionMode = patchState.productionMode;
        state.interceptedPrompt = patchState.interceptedPrompt;
        state.productionStatus = patchState.productionStatus;
        state.theme = patchState.theme;
      };
      const refreshCurrentFloor = async () => {
        currentFloorInfo.loading = true;
        try {
          const target = getCurrentVisibleFloorInfo();
          if (target) {
            currentFloorInfo.id = target.floor;
            currentFloorInfo.swipeId = target.swipeId;
            currentFloorInfo.totalSwipes = target.totalSwipes;
            currentFloorInfo.textLen = target.text.length;
            currentFloorInfo.characterName = target.characterName;
            currentFloorInfo.rawText = target.text;
            currentFloorInfo.hasScript = await checkFloorScriptExists(target.floor, target.swipeId);
          } else {
            currentFloorInfo.id = null;
            currentFloorInfo.swipeId = 0;
            currentFloorInfo.totalSwipes = 1;
            currentFloorInfo.textLen = 0;
            currentFloorInfo.hasScript = false;
            currentFloorInfo.characterName = "";
            currentFloorInfo.rawText = "";
          }
        } catch (_) {
        } finally {
          currentFloorInfo.loading = false;
        }
      };
      watch2(isModalVisible, (isOpen) => {
        if (isOpen) {
          updateStateFromGlobal();
          refreshCurrentFloor();
          availablePresets.value = getBaiBaiArtistPresets();
          isBaibaiDetected.value = Boolean(window.STBaiBaiImage || window.parent?.STBaiBaiImage);
        }
      });
      const handleSetMode = (mode) => {
        setProductionMode(mode);
        state.productionMode = mode;
      };
      const handleSetTheme = (themeName) => {
        setTheme(themeName);
        state.theme = themeName;
      };
      const handleResyncPrompts = () => {
        triggerIgsPromptResync();
        notifyToast("\u5DF2\u89E6\u53D1 IGS \u89C4\u5219\u540C\u6B65", "info");
        setTimeout(updateStateFromGlobal, 400);
      };
      const handleTestLlm = async () => {
        llmTesting.value = true;
        llmTestResult.value = null;
        try {
          const res = await testSecondaryLlmConnection();
          llmTestResult.value = res;
        } catch (err) {
          llmTestResult.value = { ok: false, error: err.message };
        } finally {
          llmTesting.value = false;
        }
      };
      const handleManualProduce = async () => {
        if (currentFloorInfo.id == null || !currentFloorInfo.rawText) {
          notifyToast("\u672A\u68C0\u6D4B\u5230\u6709\u6548\u7684\u697C\u5C42\u6B63\u6587", "warn");
          return;
        }
        try {
          await convertMessageToGal(
            currentFloorInfo.id,
            currentFloorInfo.rawText,
            {
              swipeId: currentFloorInfo.swipeId,
              characterName: currentFloorInfo.characterName
            },
            true
          );
          await refreshCurrentFloor();
        } catch (_) {
        }
      };
      const handleOpenReader = () => {
        closeSettingsModal();
        try {
          const igs = window.parent?.IGS || window.IGS;
          const mid = currentFloorInfo.id;
          if (igs && typeof igs.openViewerFromMessage === "function" && mid != null) {
            igs.openViewerFromMessage(mid);
          } else if (igs && typeof igs.openLatestAvailable === "function") {
            igs.openLatestAvailable();
          } else {
            notifyToast("\u4E3B\u62D3\u5C55\u9605\u8BFB\u5668\u63A5\u53E3\u5C1A\u672A\u5C31\u7EEA", "warn");
          }
        } catch (err) {
          notifyToast(`\u5524\u8D77\u9605\u8BFB\u5668\u5F02\u5E38: ${err.message}`, "error");
        }
      };
      const handleResetCurrentFloor = async () => {
        if (currentFloorInfo.id == null) return;
        const mid = currentFloorInfo.id;
        const sid = currentFloorInfo.swipeId;
        confirmDialog.title = "\u6E05\u7A7A\u5F53\u524D\u697C\u5C42\u6F14\u51FA\u6570\u636E";
        confirmDialog.content = `\u786E\u8BA4\u6E05\u9664\u7B2C ${mid} \u697C\u5206\u652F ${sid + 1} \u7684\u8F6C\u8BD1\u5267\u672C\u5417\uFF1F\u6E05\u9664\u540E\u53EF\u968F\u65F6\u91CD\u65B0\u5236\u4F5C\u3002`;
        confirmDialog.onConfirm = async () => {
          confirmDialog.visible = false;
          const { setStoredJson: setStoredJson2 } = await Promise.resolve().then(() => (init_adapter(), adapter_exports));
          const { getScriptStoreKey: getScriptStoreKey2, getScriptMemKey: getScriptMemKey2, scriptMemoryStore: scriptMemoryStore2 } = await Promise.resolve().then(() => (init_pipeline(), pipeline_exports));
          await setStoredJson2(getScriptStoreKey2(mid, sid), null);
          await setStoredJson2(`script_${mid}_s${sid}`, null);
          scriptMemoryStore2.delete(getScriptMemKey2(mid, sid));
          scriptMemoryStore2.delete(`${mid}_${sid}`);
          notifyToast(`\u5DF2\u6E05\u7A7A\u7B2C ${mid} \u697C\u5206\u652F ${sid + 1} \u5267\u672C`, "info");
          await refreshCurrentFloor();
        };
        confirmDialog.visible = true;
      };
      const handleFullReset = () => {
        confirmDialog.title = "\u91CD\u7F6E\u4E00\u5207";
        confirmDialog.content = "\u3010\u6700\u9AD8\u8B66\u62A5\u3011\u6B64\u64CD\u4F5C\u5C06\u5F7B\u5E95\u62B9\u9664\u6240\u6709\u89D2\u8272\u7ACB\u7ED8\u3001\u5168\u804A\u5929\u6F14\u51FA\u5267\u672C\u3001\u751F\u56FE\u56FE\u5E93\u3001\u6570\u636E\u5E93\u53CA\u6240\u6709\u672C\u5730\u7F13\u5B58\uFF0C\u6062\u590D\u81F3\u7EAF\u51C0\u521D\u59CB\u72B6\u6001\u3002\u786E\u8BA4\u91CD\u7F6E\u4E00\u5207\u5417\uFF1F";
        confirmDialog.onConfirm = async () => {
          confirmDialog.visible = false;
          await fullResetGalSystem();
          await refreshCurrentFloor();
        };
        confirmDialog.visible = true;
      };
      let unsubscribe = null;
      onMounted(() => {
        unsubscribe = subscribeState(updateStateFromGlobal);
        const onKeyDown = (e) => {
          if (e.key === "Escape" && isModalVisible.value) {
            closeSettingsModal();
          }
        };
        window.addEventListener("keydown", onKeyDown);
      });
      onUnmounted(() => {
        if (unsubscribe) unsubscribe();
      });
      return {
        visible,
        activeTab,
        state,
        showPromptDetails,
        currentFloorInfo,
        llmTesting,
        llmTestResult,
        confirmDialog,
        themeOptions: THEME_OPTIONS,
        themeStyleVars,
        secondaryLlmConfig,
        preset,
        expandEditor,
        handleOpenExpandEditor,
        handleSaveExpandEditor,
        handleCloseExpandEditor,
        baibaiConfig,
        baibaiKinds,
        availablePresets,
        isBaibaiDetected,
        isArtistKindExpanded,
        toggleArtistKindCollapse,
        handleSaveBaibaiConfig,
        handleRefreshPresets,
        handleResetAllToFollow,
        getPresetDetails,
        getPresetDisplayName,
        handleOpenArtistEditor,
        isItemExpanded,
        toggleItemCollapse,
        getRoleDisplayName,
        showCompiledPreview,
        showRegexPanel,
        handleRoleCycle,
        handleMoveItemUp,
        handleMoveItemDown,
        handleAddItem,
        handleDeleteItem,
        handleResetPreset,
        handleAddRegexRule,
        handleDeleteRegexRule,
        handleSavePresetChanges,
        previewCompiledMessages,
        getRoleIconClass,
        handleSetMode,
        handleSetTheme,
        handleResyncPrompts,
        handleTestLlm,
        handleManualProduce,
        handleOpenReader,
        handleResetCurrentFloor,
        handleFullReset,
        isBaiBaiBookDetected,
        detectedNumericVars,
        refreshBaiBaiBookInfo,
        close: closeSettingsModal
      };
    },
    template: `
    <div v-if="visible" class="igs-patch-overlay" :style="themeStyleVars" @click.self="close">
      <div class="igs-patch-window">
        <!-- \u5934\u90E8 -->
        <header class="igs-patch-header">
          <div class="igs-patch-title-box">
            <i class="fa-solid fa-film igs-patch-icon"></i>
            <div>
              <h2 class="igs-patch-title">\u653E\u6620\u8BBE\u7F6E</h2>
              <span class="igs-patch-subtitle">\u53CC\u8F68\u6F14\u51FA\u4E0E\u526F\u6A21\u578B\u5BFC\u6F14</span>
            </div>
          </div>

          <div class="igs-patch-header-actions">
            <!-- \u914D\u8272\u4E3B\u9898\u5207\u6362 -->
            <div class="igs-patch-theme-group">
              <button 
                v-for="th in themeOptions" 
                :key="th.value" 
                class="igs-patch-theme-swatch"
                :class="['theme-' + th.value, { 'is-active': state.theme === th.value }]"
                @click="handleSetTheme(th.value)"
                :title="th.label"
              >
                <span class="swatch-base" :style="{ backgroundColor: th.swatch.base }"></span>
                <span class="swatch-accent" :style="{ backgroundColor: th.swatch.accent }"></span>
              </button>
            </div>

            <!-- \u5173\u95ED\u6309\u94AE -->
            <button class="igs-patch-btn-close" @click="close" title="\u5173\u95ED">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        <!-- \u4E3B\u4F53\u7ED3\u6784 -->
        <div class="igs-patch-body">
          <!-- \u6807\u7B7E\u9875\u5BFC\u822A\uFF08\u684C\u9762\u7AEF\u4E3A\u5DE6\u4FA7\u8FB9\u680F\uFF0C\u79FB\u52A8\u7AEF\u4E3A\u9876\u90E8\u6A2A\u5411\u6EDA\u52A8\u6761\uFF09 -->
          <nav class="igs-patch-nav">
            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'production' }"
              @click="activeTab = 'production'"
            >
              <i class="fa-solid fa-clapperboard"></i>
              <span>\u5236\u4F5C</span>
            </button>

            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'prompt' }"
              @click="activeTab = 'prompt'"
            >
              <i class="fa-solid fa-shield-halved"></i>
              <span>\u63D0\u793A\u8BCD</span>
            </button>

            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'artist' }"
              @click="activeTab = 'artist'"
            >
              <i class="fa-solid fa-palette"></i>
              <span>\u751F\u56FE</span>
            </button>

            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'data' }"
              @click="activeTab = 'data'"
            >
              <i class="fa-solid fa-database"></i>
              <span>\u6570\u636E</span>
            </button>

            <button 
              class="igs-patch-nav-item" 
              :class="{ 'is-active': activeTab === 'about' }"
              @click="activeTab = 'about'"
            >
              <i class="fa-solid fa-circle-info"></i>
              <span>\u5173\u4E8E</span>
            </button>
          </nav>

          <!-- \u5185\u5BB9\u5C55\u793A\u9762\u677F -->
          <main class="igs-patch-content">
            <!-- \u677F\u5757 1: \u5236\u4F5C -->
            <section v-if="activeTab === 'production'" class="igs-patch-section">
              <h3 class="section-title">\u5236\u4F5C\u6A21\u5F0F</h3>
              <p class="section-desc">\u9009\u62E9\u5728\u6B63\u6587\u751F\u6210\u5B8C\u6BD5\u540E\u5982\u4F55\u5C06\u5C0F\u8BF4\u6539\u7F16\u4E3A\u89C6\u89C9\u5C0F\u8BF4\u89C6\u7A97\u6F14\u51FA\u3002</p>

              <div class="mode-cards-grid">
                <!-- \u81EA\u52A8\u5236\u4F5C\u6A21\u5F0F\u5361\u7247 -->
                <div 
                  class="mode-card" 
                  :class="{ 'is-selected': state.productionMode === 'auto' }"
                  @click="handleSetMode('auto')"
                >
                  <div class="mode-card-header">
                    <div class="mode-radio">
                      <span v-if="state.productionMode === 'auto'" class="radio-inner"></span>
                    </div>
                    <span class="mode-title">\u81EA\u52A8\u5236\u4F5C</span>
                    <span class="mode-badge">
                      <i class="fa-solid fa-bolt"></i> \u81EA\u52A8
                    </span>
                  </div>
                  <p class="mode-desc">
                    \u4E3B\u6A21\u578B\u751F\u6210\u5B8C\u5C0F\u8BF4\u6B63\u6587\u540E\uFF0C\u7ACB\u5373\u81EA\u52A8\u5728\u540E\u53F0\u7531\u526F\u6A21\u578B\u6539\u5199\u4E3A\u5E26\u6F14\u51FA\u6807\u7B7E\u7684\u5267\u672C\u5E76\u5B58\u5165\u5B58\u50A8\u3002\u70B9\u51FB\u653E\u6620\u952E\u5373\u53EF\u79D2\u5F00\u9605\u8BFB\u5668\u6C89\u6D78\u64AD\u653E\u3002
                  </p>
                </div>

                <!-- \u624B\u52A8\u5236\u4F5C\u6A21\u5F0F\u5361\u7247 -->
                <div 
                  class="mode-card" 
                  :class="{ 'is-selected': state.productionMode === 'manual' }"
                  @click="handleSetMode('manual')"
                >
                  <div class="mode-card-header">
                    <div class="mode-radio">
                      <span v-if="state.productionMode === 'manual'" class="radio-inner"></span>
                    </div>
                    <span class="mode-title">\u624B\u52A8\u5236\u4F5C</span>
                    <span class="mode-badge">
                      <i class="fa-solid fa-hand"></i> \u624B\u52A8
                    </span>
                  </div>
                  <p class="mode-desc">
                    \u6B63\u6587\u751F\u6210\u540E\u4E0D\u81EA\u52A8\u8C03\u7528\u526F\u6A21\u578B\u3002\u5F53\u60A8\u60F3\u8981\u89C2\u770B\u6F14\u51FA\u65F6\uFF0C\u70B9\u51FB\u653E\u6620\u952E\u5F00\u59CB\u5236\u4F5C\u5F53\u524D\u89C6\u53E3\u6240\u5904\u697C\u5C42\u5267\u672C\uFF0C\u5236\u4F5C\u5C31\u7EEA\u540E\u518D\u6B21\u70B9\u51FB\u6B63\u5F0F\u5F00\u64AD\u3002
                  </p>
                </div>
              </div>

              <!-- \u5F53\u524D\u6240\u5728\u697C\u5C42\u6F14\u51FA\u72B6\u6001 -->
              <h3 class="section-title" style="margin-top: 24px;">\u697C\u5C42\u72B6\u6001</h3>
              <div class="status-card">
                <div v-if="currentFloorInfo.id != null" class="floor-details">
                  <div class="floor-stat-row">
                    <span class="stat-label">\u76EE\u6807\u697C\u5C42\uFF1A</span>
                    <span class="stat-val">\u7B2C {{ currentFloorInfo.id }} \u697C</span>
                    <span class="stat-sep">|</span>
                    <span class="stat-label">\u5206\u652F\uFF1A</span>
                    <span class="stat-val">{{ currentFloorInfo.swipeId + 1 }} / {{ currentFloorInfo.totalSwipes }}</span>
                    <span class="stat-sep">|</span>
                    <span class="stat-label">\u6B63\u6587\u5B57\u6570\uFF1A</span>
                    <span class="stat-val">{{ currentFloorInfo.textLen }} \u5B57</span>
                    <span class="stat-sep">|</span>
                    <span class="stat-label">\u5267\u672C\u72B6\u6001\uFF1A</span>
                    <span class="stat-tag" :class="currentFloorInfo.hasScript ? 'tag-ready' : 'tag-pending'">
                      <i class="fa-solid" :class="currentFloorInfo.hasScript ? 'fa-check' : 'fa-clock'"></i>
                      <span>{{ currentFloorInfo.hasScript ? '\u6F14\u51FA\u5DF2\u5C31\u7EEA' : '\u5C1A\u672A\u5236\u4F5C' }}</span>
                    </span>
                  </div>

                  <div v-if="state.productionStatus.isProducing" class="producing-banner">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>{{ state.productionStatus.progress || '\u6B63\u5728\u5236\u4F5C\u6F14\u51FA\u4E2D' }}</span>
                  </div>

                  <div class="floor-actions">
                    <button 
                      class="igs-btn igs-btn-primary" 
                      :disabled="state.productionStatus.isProducing"
                      @click="handleManualProduce"
                    >
                      <i class="fa-solid fa-wand-magic-sparkles"></i>
                      <span>{{ currentFloorInfo.hasScript ? '\u91CD\u65B0\u5236\u4F5C' : '\u7ACB\u5373\u5236\u4F5C' }}</span>
                    </button>

                    <button 
                      v-if="currentFloorInfo.hasScript" 
                      class="igs-btn igs-btn-accent"
                      @click="handleOpenReader"
                    >
                      <i class="fa-solid fa-play"></i>
                      <span>\u5F00\u59CB\u653E\u6620</span>
                    </button>
                  </div>
                </div>

                <div v-else class="floor-empty">
                  <span>\u5F53\u524D\u754C\u9762\u5C1A\u672A\u68C0\u7D22\u5230\u53EF\u89C1\u697C\u5C42\uFF0C\u8BF7\u5148\u5728\u9152\u9986\u4E2D\u8FDB\u5165\u5BF9\u8BDD\u3002</span>
                </div>
              </div>
            </section>

            <!-- \u677F\u5757 2: \u63D0\u793A\u8BCD\u9884\u8BBE\u4E0E\u526F\u6A21\u578B -->
            <section v-if="activeTab === 'prompt'" class="igs-patch-section">
              <!-- \u62E6\u622A\u5668\u72B6\u6001 -->
              <h3 class="section-title">\u63D0\u793A\u8BCD\u62E6\u622A\u5668</h3>
              <p class="section-desc">
                \u4E3B\u811A\u672C\u8BA1\u5212\u4E0B\u53D1\u7ED9\u4E3B\u6A21\u578B\u7684\u89C6\u89C9\u5C0F\u8BF4\u6807\u7B7E\u8BED\u6CD5\u89C4\u5219\u5DF2\u88AB\u622A\u83B7\u5E76\u5265\u79BB\uFF0C\u786E\u4FDD\u4E3B\u6A21\u578B\u6B63\u6587\u81EA\u7136\u7EAF\u7CB9\u3002
              </p>

              <div class="status-card">
                <div class="interceptor-status-row">
                  <span class="status-badge-ok">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>\u5DF2\u6FC0\u6D3B\u62E6\u622A\u963B\u65AD</span>
                  </span>
                  <span class="intercepted-meta">
                    \u5DF2\u622A\u83B7\u89C4\u5219\u5B57\u6570: <strong>{{ state.interceptedPrompt.charCount }}</strong> \u5B57\u7B26
                  </span>
                </div>

                <div class="interceptor-action-buttons" style="margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap;">
                  <button class="igs-btn igs-btn-secondary" @click="showPromptDetails = !showPromptDetails">
                    <i class="fa-solid" :class="showPromptDetails ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                    <span>{{ showPromptDetails ? '\u6536\u8D77\u89C4\u5219' : '\u67E5\u770B\u89C4\u5219' }}</span>
                  </button>

                  <button class="igs-btn igs-btn-secondary" @click="handleResyncPrompts">
                    <i class="fa-solid fa-arrows-rotate"></i>
                    <span>\u91CD\u65B0\u6355\u83B7</span>
                  </button>
                </div>

                <div v-if="showPromptDetails" class="prompt-preview-box">
                  <pre>{{ state.interceptedPrompt.system || '\u4E3B\u811A\u672C\u5C1A\u672A\u89E6\u53D1\u63D0\u793A\u8BCD\u6CE8\u5165\uFF0C\u5F53\u524D\u4F7F\u7528\u5185\u7F6E\u539F\u751F\u89C4\u5219\u515C\u5E95' }}</pre>
                </div>
              </div>

              <!-- \u5BFC\u6F14\u63D0\u793A\u8BCD\u9884\u8BBE\u6D41\u6C34\u7EBF -->
              <h3 class="section-title" style="margin-top: 24px;">\u5BFC\u6F14\u63D0\u793A\u8BCD</h3>
              <p class="section-desc">
                \u6309\u5E8F\u7F16\u8BD1\u5E76\u53D1\u9001\u7ED9\u526F\u6A21\u578B\u5236\u4F5C\u5267\u672C\u3002\u4E3B\u811A\u672C\u63D0\u793A\u8BCD\u4E0E\u697C\u5C42\u539F\u6587\u4E3A\u56FA\u5B9A\u69FD\u4F4D\uFF0C\u53EF\u81EA\u7531\u8C03\u5E8F\uFF1B\u70B9\u51FB\u8EAB\u4EFD\u56FE\u6807\u53EF\u5FEB\u901F\u5207\u6362\u3002
              </p>

              <div class="preset-toolbar">
                <button class="igs-btn igs-btn-primary" @click="handleAddItem">
                  <i class="fa-solid fa-plus"></i>
                  <span>\u65B0\u589E</span>
                </button>

                <button class="igs-btn igs-btn-secondary" @click="showCompiledPreview = !showCompiledPreview">
                  <i class="fa-solid" :class="showCompiledPreview ? 'fa-eye-slash' : 'fa-eye'"></i>
                  <span>{{ showCompiledPreview ? '\u6536\u8D77\u9884\u89C8' : '\u9884\u89C8' }}</span>
                </button>

                <button class="igs-btn igs-btn-secondary" @click="handleResetPreset">
                  <i class="fa-solid fa-arrow-rotate-left"></i>
                  <span>\u6062\u590D\u9ED8\u8BA4</span>
                </button>
              </div>

              <!-- \u7F16\u8BD1\u9884\u89C8\u76D2\u5B50 -->
              <div v-if="showCompiledPreview" class="prompt-preview-box" style="margin-bottom: 16px;">
                <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 8px; color: var(--igs-settings-accent);">
                  <i class="fa-solid fa-code"></i> \u5B9E\u65F6\u7F16\u8BD1\u53D1\u9001\u7ED3\u679C
                </div>
                <div class="preview-messages-container">
                  <div 
                    v-for="(msg, mIdx) in previewCompiledMessages" 
                    :key="mIdx"
                    class="preview-msg-card"
                    :class="'msg-' + msg.role"
                  >
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <i class="fa-solid" :class="getRoleIconClass(msg.role)"></i>
                      <span style="font-weight: 600; font-size: 0.8rem; text-transform: uppercase;">{{ msg.role }}</span>
                    </div>
                    <pre style="margin: 0; font-size: 0.8rem; white-space: pre-wrap;">{{ msg.content }}</pre>
                  </div>
                </div>
              </div>

              <!-- \u9884\u8BBE\u6761\u76EE\u5361\u7247\u5217\u8868 -->
              <div class="preset-list">
                <div 
                  v-for="(item, idx) in preset.items" 
                  :key="item.id"
                  class="preset-item-card"
                  :class="{ 'is-disabled': !item.enabled }"
                >
                  <div class="preset-item-header" @click="toggleItemCollapse(item.id)">
                    <div class="item-header-left">
                      <!-- \u6298\u53E0/\u5C55\u5F00\u6307\u793A\u56FE\u6807\uFF1A\u6700\u524D\u7F6E\u624B\u67C4 -->
                      <i class="fa-solid collapse-toggle-icon" :class="isItemExpanded(item.id) ? 'fa-chevron-down' : 'fa-chevron-right'"></i>

                      <!-- \u8EAB\u4EFD\u5207\u6362\u6309\u94AE\uFF1A\u7EAF\u56FE\u6807\uFF0C\u65E0\u6587\u5B57 -->
                      <button 
                        class="role-cycle-btn"
                        :class="'role-' + item.role"
                        :title="'\u5F53\u524D\u8EAB\u4EFD: ' + getRoleDisplayName(item.role) + '\uFF0C\u70B9\u51FB\u5207\u6362'"
                        @click.stop="handleRoleCycle(item)"
                      >
                        <i class="fa-solid" :class="getRoleIconClass(item.role)"></i>
                      </button>

                      <input 
                        v-if="item.type === 'custom'"
                        v-model="item.name" 
                        class="item-name-input"
                        placeholder="\u6761\u76EE\u540D\u79F0"
                        @click.stop
                        @change="handleSavePresetChanges"
                      />
                      <span v-else class="item-name-input" style="cursor: pointer;">
                        {{ item.name }}
                      </span>

                      <span v-if="item.type === 'slot_igs_rules'" class="item-slot-badge">
                        <i class="fa-solid fa-link"></i> \u56FA\u5B9A\u69FD\u4F4D
                      </span>
                      <span v-else-if="item.type === 'slot_floor_text'" class="item-slot-badge">
                        <i class="fa-solid fa-feather-pointed"></i> \u56FA\u5B9A\u69FD\u4F4D
                      </span>
                    </div>

                    <!-- \u64CD\u4F5C\u6309\u94AE\u7EC4 -->
                    <div class="item-header-actions">
                      <button 
                        v-if="item.type === 'custom'"
                        class="mini-icon-btn" 
                        title="\u5168\u5C4F\u7F16\u8F91"
                        @click.stop="handleOpenExpandEditor(item)"
                      >
                        <i class="fa-solid fa-expand" style="pointer-events: none;"></i>
                      </button>
                      <button 
                        class="mini-icon-btn" 
                        :disabled="idx === 0"
                        title="\u4E0A\u79FB"
                        @click.stop="handleMoveItemUp(idx)"
                      >
                        <i class="fa-solid fa-arrow-up"></i>
                      </button>
                      <button 
                        class="mini-icon-btn" 
                        :disabled="idx === preset.items.length - 1"
                        title="\u4E0B\u79FB"
                        @click.stop="handleMoveItemDown(idx)"
                      >
                        <i class="fa-solid fa-arrow-down"></i>
                      </button>
                      <button 
                        v-if="item.removable"
                        class="mini-icon-btn btn-danger" 
                        title="\u5220\u9664"
                        @click.stop="handleDeleteItem(idx)"
                      >
                        <i class="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>

                  <!-- \u5361\u7247\u6B63\u6587\u5185\u5BB9\uFF1A\u9ED8\u8BA4\u6298\u53E0\uFF0C\u5C55\u5F00\u65F6\u663E\u793A -->
                  <div v-if="isItemExpanded(item.id)" class="preset-item-content">
                    <!-- \u4E3B\u811A\u672C\u89C4\u5219\u56FA\u5B9A\u69FD\u4F4D -->
                    <div v-if="item.type === 'slot_igs_rules'" class="slot-fixed-desc">
                      \u52A8\u6001\u6302\u8F7D\u4E3B\u811A\u672C\u622A\u83B7\u7684\u5F53\u524D\u89D2\u8272\u6807\u7B7E\u8BED\u6CD5\u4E0E\u573A\u666F\u89C4\u5219\uFF1B\u4E3B\u811A\u672C\u672A\u6CE8\u5165\u65F6\u81EA\u52A8\u91C7\u7528\u5185\u7F6E\u539F\u751F\u89C4\u5219\u515C\u5E95\u3002
                    </div>

                    <!-- \u697C\u5C42\u539F\u6587\u56FA\u5B9A\u69FD\u4F4D -->
                    <div v-else-if="item.type === 'slot_floor_text'">
                      <div class="slot-fixed-desc" style="margin-bottom: 8px;">
                        \u52A8\u6001\u6302\u8F7D\u5F53\u524D\u89C6\u53E3\u7126\u70B9\u697C\u5C42\u5C0F\u8BF4\u6B63\u6587\u3002\u53EF\u914D\u7F6E\u524D\u7F00\u3001\u540E\u7F00\u5E76\u6267\u884C\u6B63\u5219\u6D41\u6C34\u7EBF\u88C1\u526A\u3002
                      </div>
                      <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                        <input 
                          v-model="item.prefix" 
                          class="regex-rule-input" 
                          style="flex: 1;" 
                          placeholder="\u524D\u7F00\u5F15\u5BFC\u8BCD\uFF0C\u5982\uFF1A\u3010\u5C0F\u8BF4\u539F\u6587\u3011"
                          @change="handleSavePresetChanges"
                        />
                      </div>

                      <!-- \u6B63\u5219\u88C1\u526A\u89C4\u5219\u5C55\u5F00/\u6536\u8D77 -->
                      <button 
                        class="igs-btn igs-btn-secondary" 
                        style="padding: 4px 10px; font-size: 0.8rem;"
                        @click="showRegexPanel = !showRegexPanel"
                      >
                        <i class="fa-solid" :class="showRegexPanel ? 'fa-chevron-up' : 'fa-filter'"></i>
                        <span>{{ showRegexPanel ? '\u6536\u8D77\u6B63\u5219' : '\u6B63\u5219\u88C1\u526A' }}</span>
                      </button>

                      <div v-if="showRegexPanel" class="regex-panel-box">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                          <span style="font-weight: 600; font-size: 0.82rem; color: var(--igs-settings-accent);">
                            <i class="fa-solid fa-scissors"></i> \u987A\u5E8F\u6267\u884C\u6B63\u5219\u66FF\u6362
                          </span>
                          <button class="igs-btn igs-btn-secondary" style="padding: 2px 8px; font-size: 0.75rem;" @click="handleAddRegexRule">
                            <i class="fa-solid fa-plus"></i> \u65B0\u589E
                          </button>
                        </div>

                        <div class="regex-rules-list">
                          <div 
                            v-for="(rule, rIdx) in preset.floorRegexRules" 
                            :key="rule.id"
                            class="regex-rule-item"
                          >
                            <input type="checkbox" v-model="rule.enabled" @change="handleSavePresetChanges" />
                            <input 
                              v-model="rule.name" 
                              class="regex-rule-input" 
                              style="width: 100px;" 
                              placeholder="\u89C4\u5219\u540D\u79F0"
                              @change="handleSavePresetChanges"
                            />
                            <input 
                              v-model="rule.pattern" 
                              class="regex-rule-input" 
                              style="flex: 2; min-width: 140px;" 
                              placeholder="\u5339\u914D\u8868\u8FBE\u5F0F"
                              @change="handleSavePresetChanges"
                            />
                            <input 
                              v-model="rule.replacement" 
                              class="regex-rule-input" 
                              style="flex: 1; min-width: 80px;" 
                              placeholder="\u66FF\u6362\u5185\u5BB9"
                              @change="handleSavePresetChanges"
                            />
                            <button 
                              class="mini-icon-btn btn-danger" 
                              title="\u5220\u9664\u6B63\u5219"
                              @click="handleDeleteRegexRule(rIdx)"
                            >
                              <i class="fa-solid fa-xmark"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- \u81EA\u5B9A\u4E49\u63D0\u793A\u8BCD\u6587\u672C (\u4EC5\u4FDD\u7559 textarea\uFF0C\u65E0\u91CD\u590D\u6309\u94AE) -->
                    <div v-else>
                      <textarea 
                        v-model="item.content"
                        class="preset-textarea"
                        placeholder="\u8F93\u5165\u63D0\u793A\u8BCD\u5185\u5BB9..."
                        @change="handleSavePresetChanges"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <!-- \u526F\u6A21\u578B\u72B6\u6001 -->
              <h3 class="section-title" style="margin-top: 24px;">\u526F\u6A21\u578B\u72B6\u6001</h3>
              <p class="section-desc">\u590D\u7528\u4E3B\u6269\u5C55\u914D\u7F6E\u7684\u526F\u6A21\u578B\u63A5\u53E3\uFF0C\u4E13\u804C\u8D1F\u8D23\u5C06\u5C0F\u8BF4\u6539\u5199\u4E3A\u6F14\u51FA\u5267\u672C\u3002</p>

              <div class="status-card">
                <div class="llm-info-grid">
                  <div class="llm-info-item">
                    <span class="info-label">\u63A5\u53E3\u6765\u6E90\uFF1A</span>
                    <span class="info-val">{{ secondaryLlmConfig.source === 'openai' ? '\u72EC\u7ACB OpenAI \u517C\u5BB9\u63A5\u53E3' : '\u9152\u9986\u539F\u751F\u6865\u63A5' }}</span>
                  </div>
                  <div class="llm-info-item">
                    <span class="info-label">\u6A21\u578B\u6807\u8BC6\uFF1A</span>
                    <span class="info-val">{{ secondaryLlmConfig.model || '\u9ED8\u8BA4' }}</span>
                  </div>
                  <div v-if="secondaryLlmConfig.endpoint" class="llm-info-item" style="grid-column: 1 / -1;">
                    <span class="info-label">\u7AEF\u70B9\u5730\u5740\uFF1A</span>
                    <span class="info-val code-text">{{ secondaryLlmConfig.endpoint }}</span>
                  </div>
                </div>

                <div class="llm-action-row">
                  <button 
                    class="igs-btn igs-btn-secondary" 
                    :disabled="llmTesting"
                    @click="handleTestLlm"
                  >
                    <i class="fa-solid" :class="llmTesting ? 'fa-spinner fa-spin' : 'fa-network-wired'"></i>
                    <span>{{ llmTesting ? '\u6B63\u5728\u6D4B\u8BD5' : '\u6D4B\u8BD5\u8FDE\u63A5' }}</span>
                  </button>

                  <span v-if="llmTestResult" class="test-result-tag" :class="llmTestResult.ok ? 'res-ok' : 'res-err'">
                    <i class="fa-solid" :class="llmTestResult.ok ? 'fa-check' : 'fa-xmark'"></i>
                    <span>{{ llmTestResult.ok ? '\u8FDE\u901A\u6B63\u5E38 ' + llmTestResult.latency + ' ms' : '\u8FDE\u63A5\u5931\u8D25: ' + llmTestResult.error }}</span>
                  </span>
                </div>
              </div>
            </section>

            <!-- \u677F\u5757: \u67CF\u5B9D\u7ED8\u753B\u98CE\u9884\u8BBE\u8054\u52A8 -->
            <section v-if="activeTab === 'artist'" class="igs-patch-section">
              <h3 class="section-title">\u751F\u56FE\u753B\u98CE\u8054\u52A8</h3>
              <p class="section-desc">
                \u8054\u52A8\u67CF\u5B9D\u7ED8\u5185\u90E8\u753B\u98CE\u9884\u8BBE\u5E93\uFF0C\u4E3A\u4E0D\u540C\u8D44\u4EA7\u7C7B\u522B\u72EC\u7ACB\u6307\u5B9A\u8C03\u7528\u7684\u9884\u8BBE\uFF1B\u53EF\u5728\u5404\u5206\u7C7B\u4E2D\u5355\u72EC\u6307\u5B9A\u9884\u8BBE\u4E0E\u5FAE\u8C03\u8BCD\u3002
              </p>

              <!-- \u72B6\u6001\u4E0E\u5168\u5C40\u63A7\u5236\u5361\u7247 -->
              <div class="status-card">
                <div class="interceptor-status-row">
                  <span :class="isBaibaiDetected ? 'status-badge-ok' : 'status-badge-warn'">
                    <i class="fa-solid" :class="isBaibaiDetected ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
                    <span>{{ isBaibaiDetected ? '\u67CF\u5B9D\u7ED8\u63A5\u53E3\u5DF2\u8FDE\u63A5' : '\u7B49\u5F85\u67CF\u5B9D\u7ED8\u63A5\u53E3\u6302\u8F7D' }}</span>
                  </span>
                  <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 600;">
                    <input type="checkbox" v-model="baibaiConfig.enabled" @change="handleSaveBaibaiConfig" />
                    <span>\u542F\u7528\u9884\u8BBE\u8054\u52A8</span>
                  </label>
                </div>

                <div style="font-size: 0.82rem; color: var(--igs-settings-muted); line-height: 1.5; margin-top: 8px;">
                  \u63A8\u8350\u5728\u67CF\u5B9D\u7ED8\u5168\u5C40\u8BBE\u7F6E\u4E2D\u5C06\u753B\u5E08\u4E32\u8BBE\u4E3A\u672A\u9009\u62E9\uFF0C\u5373\u53EF\u7531\u672C\u7CFB\u7EDF\u6309\u573A\u666F\u72EC\u7ACB\u5206\u6D41\u8C03\u5EA6\u3002
                </div>

                <div class="artist-toolbar-actions">
                  <button class="igs-btn igs-btn-primary" @click="handleRefreshPresets">
                    <i class="fa-solid fa-arrows-rotate"></i>
                    <span>\u5237\u65B0</span>
                  </button>

                  <button class="igs-btn igs-btn-secondary" @click="handleResetAllToFollow">
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>\u91CD\u7F6E\u8DDF\u968F</span>
                  </button>
                </div>
              </div>

              <!-- \u5206\u533A\u5361\u7247\u5217\u8868 -->
              <div class="artist-kind-list">
                <div 
                  v-for="kind in baibaiKinds" 
                  :key="kind.id"
                  class="preset-item-card"
                  :class="{ 'is-disabled': baibaiConfig.kinds[kind.id] && !baibaiConfig.kinds[kind.id].enabled }"
                >
                  <div class="preset-item-header" @click="toggleArtistKindCollapse(kind.id)">
                    <div class="item-header-left">
                      <!-- \u6298\u53E0\u6307\u793A\u624B\u67C4 -->
                      <i class="fa-solid collapse-toggle-icon" :class="isArtistKindExpanded(kind.id) ? 'fa-chevron-down' : 'fa-chevron-right'"></i>

                      <!-- \u7C7B\u522B\u56FE\u6807 -->
                      <span class="role-cycle-btn" style="cursor: default;">
                        <i class="fa-solid" :class="kind.icon"></i>
                      </span>

                      <!-- \u7C7B\u522B\u540D\u79F0 -->
                      <span class="item-name-input" style="cursor: pointer;">
                        {{ kind.label }}
                      </span>

                      <!-- \u7ED1\u5B9A\u7684\u9884\u8BBE\u540D\u79F0\u5FBD\u6807 -->
                      <span class="item-slot-badge">
                        {{ getPresetDisplayName(baibaiConfig.kinds[kind.id]?.presetId) }}
                      </span>
                    </div>

                    <div class="item-header-actions">
                      <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; cursor: pointer;" @click.stop>
                        <input type="checkbox" v-model="baibaiConfig.kinds[kind.id].enabled" @change="handleSaveBaibaiConfig" />
                        <span>\u542F\u7528</span>
                      </label>
                    </div>
                  </div>

                  <!-- \u5C55\u5F00\u540E\u7684\u9884\u8BBE\u7ED1\u5B9A\u4E0E\u8BE6\u60C5\u533A -->
                  <div v-if="isArtistKindExpanded(kind.id)" class="preset-item-content">
                    <div class="artist-fields-container">
                      <!-- \u9884\u8BBE\u9009\u62E9\u4E0B\u62C9\u6846 -->
                      <div class="artist-field-block">
                        <div class="artist-field-label-row">
                          <span>
                            <i class="fa-solid fa-palette" style="color: var(--igs-settings-accent);"></i>
                            \u7ED1\u5B9A\u67CF\u5B9D\u7ED8\u9884\u8BBE
                          </span>
                        </div>
                        <select 
                          v-model="baibaiConfig.kinds[kind.id].presetId"
                          class="igs-select-input"
                          @change="handleSaveBaibaiConfig"
                        >
                          <option value="follow">\u8DDF\u968F\u67CF\u5B9D\u7ED8\u5F53\u524D\u8BBE\u7F6E</option>
                          <option value="none">\u4E0D\u4F7F\u7528\u753B\u5E08\u4E32 - \u7EAF\u51C0\u753B\u9762</option>
                          <option v-for="preset in availablePresets" :key="preset.id" :value="preset.id">
                            {{ preset.name }}{{ preset.desc ? ' - ' + preset.desc : '' }}
                          </option>
                        </select>
                      </div>

                      <!-- \u9884\u8BBE\u8BE6\u60C5\u4E0E\u6807\u7B7E\u9884\u89C8 -->
                      <div v-if="getPresetDetails(baibaiConfig.kinds[kind.id]?.presetId)" class="preset-preview-box">
                        <div class="preset-preview-row">
                          <span class="preview-tag-title">\u6B63\u5411\u753B\u5E08\u8BCD</span>
                          <span class="preview-tag-content">{{ getPresetDetails(baibaiConfig.kinds[kind.id]?.presetId)?.prompt || '\u65E0' }}</span>
                        </div>
                        <div v-if="getPresetDetails(baibaiConfig.kinds[kind.id]?.presetId)?.negative" class="preset-preview-row">
                          <span class="preview-tag-title">\u8D1F\u5411\u8FC7\u6EE4\u8BCD</span>
                          <span class="preview-tag-content">{{ getPresetDetails(baibaiConfig.kinds[kind.id]?.presetId)?.negative }}</span>
                        </div>
                      </div>

                      <!-- \u9644\u52A0\u4E13\u5C5E\u5FAE\u8C03\u8BCD\u6298\u53E0\u533A -->
                      <details class="artist-extra-details">
                        <summary class="artist-extra-summary">
                          <i class="fa-solid fa-plus-minus"></i>
                          <span>\u9644\u52A0\u5FAE\u8C03\u4E13\u5C5E\u8BCD</span>
                        </summary>
                        <div class="artist-fields-container" style="margin-top: 10px;">
                          <div class="artist-field-block">
                            <div class="artist-field-label-row">
                              <span>
                                <i class="fa-solid fa-plus" style="color: var(--igs-settings-accent);"></i>
                                \u6B63\u5411\u5FAE\u8C03\u8BCD
                              </span>
                              <button 
                                class="mini-icon-btn" 
                                title="\u5168\u5C4F\u7F16\u8F91\u6B63\u5411\u5FAE\u8C03\u8BCD"
                                @click="handleOpenArtistEditor(kind.id, 'extraPositive', '\u6B63\u5411\u5FAE\u8C03\u8BCD')"
                              >
                                <i class="fa-solid fa-expand" style="pointer-events: none;"></i>
                              </button>
                            </div>
                            <textarea 
                              v-model="baibaiConfig.kinds[kind.id].extraPositive"
                              class="artist-textarea"
                              placeholder="\u9009\u5B9A\u9884\u8BBE\u4E4B\u5916\u989D\u5916\u8FFD\u52A0\u7684\u6B63\u5411\u8BCD\uFF0C\u4F8B\u5982\uFF1Achibi, dynamic angle..."
                              @change="handleSaveBaibaiConfig"
                            ></textarea>
                          </div>

                          <div class="artist-field-block">
                            <div class="artist-field-label-row">
                              <span>
                                <i class="fa-solid fa-minus" style="color: var(--igs-settings-danger);"></i>
                                \u8D1F\u5411\u5FAE\u8C03\u8BCD
                              </span>
                              <button 
                                class="mini-icon-btn" 
                                title="\u5168\u5C4F\u7F16\u8F91\u8D1F\u5411\u5FAE\u8C03\u8BCD"
                                @click="handleOpenArtistEditor(kind.id, 'extraNegative', '\u8D1F\u5411\u5FAE\u8C03\u8BCD')"
                              >
                                <i class="fa-solid fa-expand" style="pointer-events: none;"></i>
                              </button>
                            </div>
                            <textarea 
                              v-model="baibaiConfig.kinds[kind.id].extraNegative"
                              class="artist-textarea"
                              placeholder="\u9009\u5B9A\u9884\u8BBE\u4E4B\u5916\u989D\u5916\u8FFD\u52A0\u7684\u8D1F\u5411\u8BCD\uFF0C\u4F8B\u5982\uFF1Abad hands, lowres..."
                              @change="handleSaveBaibaiConfig"
                            ></textarea>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- \u677F\u5757 3: \u6570\u636E\u7BA1\u7406 -->
            <section v-if="activeTab === 'data'" class="igs-patch-section">
              <h3 class="section-title">\u6570\u636E\u7BA1\u7406</h3>
              <p class="section-desc">\u7BA1\u7406\u6570\u636E\u5E93\u6E90\u8054\u52A8\u3001\u72B6\u6001\u680F\u6620\u5C04\u89C4\u5219\u4E0E\u6F14\u51FA\u5267\u672C\u7F13\u5B58\u3002</p>

              <!-- \u67CF\u5B9D\u4E66\u865A\u62DF\u6570\u636E\u5E93\u8054\u52A8\u5361\u7247 -->
              <div class="status-card" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px;">
                  <div>
                    <h4 class="item-title">
                      <i class="fa-solid fa-book" style="color: var(--igs-settings-accent); margin-right: 6px;"></i>
                      \u6570\u636E\u5E93\u6E90 - \u67CF\u5B9D\u4E66\u8054\u52A8
                    </h4>
                    <p class="item-desc">\u5E95\u5C42\u6570\u636E\u5E93\u5DF2\u63A5\u5165\u67CF\u5B9D\u4E66\uFF0C\u63D0\u4F9B\u89D2\u8272\u6863\u6848\u3001\u670D\u88C5\u7EBF\u7D22\u3001\u573A\u666F\u65F6\u7A7A\u4E0E\u7EAF\u6570\u503C\u4EEA\u8868\u76D8\u3002</p>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="status-badge" :class="isBaiBaiBookDetected ? 'status-connected' : 'status-disconnected'">
                      <i class="fa-solid" :class="isBaiBaiBookDetected ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
                      <span>{{ isBaiBaiBookDetected ? '\u67CF\u5B9D\u4E66\u63A5\u53E3\u5DF2\u5C31\u7EEA' : '\u7B49\u5F85\u67CF\u5B9D\u4E66\u6302\u8F7D' }}</span>
                    </span>
                    <button class="mini-icon-btn" title="\u5237\u65B0\u72B6\u6001" @click="refreshBaiBaiBookInfo">
                      <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                  </div>
                </div>

                <div style="font-size: 13px; color: var(--igs-settings-text-muted); line-height: 1.6; margin-bottom: 10px;">
                  <i class="fa-solid fa-filter" style="margin-right: 4px;"></i>
                  \u72B6\u6001\u680F\u6570\u503C\u8FC7\u6EE4\uFF1A\u5DF2\u5F00\u542F\u7EAF\u6570\u503C\u767D\u540D\u5355\uFF0C\u4EC5\u5141\u8BB8\u6570\u5B57\u4E0E\u6BD4\u4F8B\u683C\u5F0F\u6620\u5C04\u5230\u72B6\u6001\u680F\uFF0C\u81EA\u52A8\u6392\u9664\u5267\u60C5\u9648\u8FF0\u53E5\u3002
                </div>

                <!-- \u8FC7\u6EE4\u63D0\u53D6\u51FA\u7684\u53D8\u91CF\u9884\u89C8 -->
                <div v-if="detectedNumericVars.length" style="background: rgba(0,0,0,0.03); border: 1px solid var(--igs-settings-border); border-radius: 6px; padding: 10px;">
                  <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px; color: var(--igs-settings-text);">
                    \u5F53\u524D\u6620\u5C04\u5230\u72B6\u6001\u680F\u7684\u6570\u503C\u53D8\u91CF\uFF1A
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <span v-for="v in detectedNumericVars" :key="v.path" style="background: var(--igs-settings-card-bg); border: 1px solid var(--igs-settings-border); border-radius: 4px; padding: 2px 8px; font-size: 12px;">
                      <strong>{{ v.label }}</strong>: {{ v.value }}
                    </span>
                  </div>
                </div>
                <div v-else style="font-size: 12px; color: var(--igs-settings-text-muted); font-style: italic;">
                  \u5F53\u524D\u5C1A\u672A\u68C0\u6D4B\u5230\u6570\u503C\u53D8\u91CF\u6216\u672A\u8F7D\u5165\u804A\u5929\u3002
                </div>
              </div>

              <div class="status-card">
                <div class="danger-zone-item">
                  <div>
                    <h4 class="item-title">\u6E05\u7A7A\u5F53\u524D\u697C\u5C42\u6F14\u51FA\u5267\u672C</h4>
                    <p class="item-desc">\u4EC5\u5220\u9664\u5F53\u524D\u697C\u5C42\u6D3B\u8DC3\u5206\u652F\u7684\u8F6C\u8BD1\u5267\u672C\uFF0C\u91CD\u7F6E\u4E3A\u672A\u5236\u4F5C\u72B6\u6001\u3002</p>
                  </div>
                  <button class="igs-btn igs-btn-secondary" @click="handleResetCurrentFloor">
                    <i class="fa-solid fa-trash-can"></i>
                    <span>\u6E05\u7A7A\u5F53\u524D\u697C\u5C42</span>
                  </button>
                </div>

                <div class="danger-zone-divider"></div>

                <div class="danger-zone-item">
                  <div>
                    <h4 class="item-title" style="color: var(--igs-settings-danger);">\u91CD\u7F6E\u4E00\u5207</h4>
                    <p class="item-desc">\u5F7B\u5E95\u6E05\u9664\u5168\u90E8\u89D2\u8272\u7ACB\u7ED8\u3001\u5168\u804A\u5929\u6F14\u51FA\u5267\u672C\u3001\u751F\u56FE\u56FE\u5E93\u3001\u6570\u636E\u5E93\u53CA\u6240\u6709\u672C\u5730\u7F13\u5B58\u3002\u91CD\u7F6E\u540E\u6062\u590D\u81F3\u7EAF\u51C0\u521D\u59CB\u72B6\u6001\u3002</p>
                  </div>
                  <button class="igs-btn igs-btn-danger" @click="handleFullReset">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>\u91CD\u7F6E\u4E00\u5207</span>
                  </button>
                </div>
              </div>
            </section>

            <!-- \u677F\u5757 4: \u5173\u4E8E\u8865\u4E01 -->
            <section v-if="activeTab === 'about'" class="igs-patch-section">
              <h3 class="section-title">\u5173\u4E8E</h3>
              <div class="status-card">
                <p><strong>\u7248\u672C\u4FE1\u606F\uFF1A</strong>v2.0</p>
                <p><strong>\u6838\u5FC3\u67B6\u6784\uFF1A</strong></p>
                <ul style="padding-left: 20px; line-height: 1.8;">
                  <li><strong>\u53CC\u8F68\u6E32\u67D3\u89E3\u8026\uFF1A</strong> \u4E3B\u6A21\u578B 0 \u63D0\u793A\u8BCD\u6C61\u67D3\uFF0C\u4E13\u6CE8\u751F\u6210\u5C0F\u8BF4\uFF1B\u526F\u6A21\u578B\u6839\u636E\u622A\u83B7\u7684\u4E3B\u811A\u672C\u6807\u7B7E\u8BED\u6CD5\u7CBE\u51C6\u6539\u7F16\u6F14\u51FA\u3002</li>
                  <li><strong>\u9AD8\u6027\u80FD\u5B58\u50A8\uFF1A</strong> \u6BEB\u79D2\u7EA7\u672C\u5730\u952E\u503C\u7F13\u5B58\uFF0C\u8DE8\u4F1A\u8BDD\u79D2\u7EA7\u8BFB\u5199\u6D77\u91CF\u6F14\u51FA\u5267\u672C\u3002</li>
                  <li><strong>\u5206\u652F\u4E0E\u697C\u5C42\u611F\u77E5\uFF1A</strong> \u7CBE\u786E\u7ED1\u5B9A\u6BCF\u5C42\u697C\u4E0E\u6BCF\u6B21\u5206\u652F\u5267\u672C\uFF0C\u7126\u70B9\u697C\u5C42\u7CBE\u51C6\u5F00\u64AD\u3002</li>
                </ul>
              </div>
            </section>
          </main>
        </div>

        <!-- \u4E8C\u6B21\u786E\u8BA4\u5F39\u7A97 -->
        <div v-if="confirmDialog.visible" class="igs-patch-dialog-backdrop">
          <div class="igs-patch-dialog-box">
            <h4 class="dialog-title">{{ confirmDialog.title }}</h4>
            <p class="dialog-content">{{ confirmDialog.content }}</p>
            <div class="dialog-actions">
              <button class="igs-btn igs-btn-secondary" @click="confirmDialog.visible = false">\u53D6\u6D88</button>
              <button class="igs-btn igs-btn-danger" @click="confirmDialog.onConfirm">\u786E\u8BA4\u6267\u884C</button>
            </div>
          </div>
        </div>

        <!-- \u5168\u5C4F\u7F16\u8F91\u9762\u677F -->
        <div v-if="expandEditor.visible" class="igs-expanded-editor-panel">
          <div class="expanded-editor-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-pen-to-square" style="color: var(--igs-settings-accent);"></i>
              <span style="font-weight: 600; font-size: 1rem; color: var(--igs-settings-ink);">{{ expandEditor.title }}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="expanded-char-count">{{ expandEditor.content ? expandEditor.content.length : 0 }} \u5B57\u7B26</span>
              <button class="igs-patch-btn-close" @click="handleCloseExpandEditor" title="\u5173\u95ED">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
          <div class="expanded-editor-body">
            <textarea 
              v-model="expandEditor.content"
              class="expanded-editor-textarea"
              placeholder="\u5728\u6B64\u8F93\u5165\u5B8C\u6574\u7684\u63D0\u793A\u8BCD\u5185\u5BB9..."
            ></textarea>
            <div class="expanded-editor-actions">
              <button class="igs-btn igs-btn-secondary" @click="handleCloseExpandEditor">\u53D6\u6D88</button>
              <button class="igs-btn igs-btn-primary" @click="handleSaveExpandEditor">
                <i class="fa-solid fa-check"></i>
                <span>\u4FDD\u5B58</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    `
  };

  // src/ui/resources-modal.js
  init_state();
  init_toast();

  // src/ui/resources-styles.js
  var RESOURCES_MODAL_CSS = `
/* \u8D44\u6E90\u63A7\u5236\u53F0\u4E13\u5C5E\u6837\u5F0F */
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
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes igsPatchWindowZoom {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

.igs-resources-overlay *, .igs-resources-overlay *::before, .igs-resources-overlay *::after {
  box-sizing: border-box;
}

/* \u4E3B\u7A97\u53E3\uFF1A\u91C7\u7528\u7ECF\u5178\u5DE6\u4FA7\u4FA7\u8FB9\u680F + \u53F3\u4FA7\u5927\u4E3B\u89C6\u53E3\u67B6\u6784 */
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
  flex-direction: row;
  overflow: hidden;
  position: relative;
  animation: igsPatchWindowZoom 0.2s ease-out;
}

/* =========================================
   \u5DE6\u4FA7\u7CBE\u70BC\u4FA7\u8FB9\u680F (Sidebar)
   ========================================= */
.igs-resources-sidebar {
  width: 140px;
  flex-shrink: 0;
  background-color: var(--igs-settings-surface, #2a3036);
  border-right: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 10px;
  z-index: 2;
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s ease;
  position: relative;
}

.igs-resources-sidebar.is-collapsed {
  width: 52px !important;
  padding: 12px 6px !important;
  align-items: center !important;
}

/* \u4FA7\u8FB9\u680F\u9876\u90E8\u5927\u6807\u9898\u4E0E\u6298\u53E0\u5F00\u5173 */
.igs-sidebar-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 2px 12px 2px;
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  color: var(--igs-settings-ink, #ffffff);
  width: 100%;
}

.igs-resources-sidebar.is-collapsed .igs-sidebar-brand {
  justify-content: center;
  padding: 4px 0 10px 0;
}

.igs-sidebar-brand-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.igs-sidebar-brand-icon {
  font-size: 1.25rem;
  color: var(--igs-settings-accent, #7fd6ca);
  flex-shrink: 0;
}

.igs-sidebar-brand-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.igs-sidebar-collapse-btn {
  background: transparent;
  border: none;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.igs-sidebar-collapse-btn:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.08));
  color: var(--igs-settings-ink, #ffffff);
}

.igs-resources-sidebar.is-collapsed .igs-sidebar-nav-btn {
  padding: 10px 0;
  justify-content: center;
  width: 100%;
}

.igs-resources-sidebar.is-collapsed .igs-sidebar-nav-btn span {
  display: none;
}

.igs-resources-sidebar.is-collapsed .igs-sidebar-nav-btn i {
  font-size: 16px;
  margin: 0;
}

.igs-resources-sidebar.is-collapsed .igs-sidebar-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  padding: 1px 4px;
  font-size: 9px;
}

.igs-resources-sidebar.is-collapsed .igs-resources-theme-group {
  padding: 4px 2px;
  gap: 6px;
}

/* \u4FA7\u8FB9\u680F\u5782\u76F4\u5BFC\u822A\u9879 */
.igs-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  flex: 1;
  width: 100%;
}

.igs-sidebar-nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: left;
}

.igs-sidebar-nav-btn:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.06));
  color: var(--igs-settings-ink, #ffffff);
}

.igs-sidebar-nav-btn.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  font-weight: 700;
}

.igs-sidebar-nav-btn i {
  font-size: 14px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.igs-sidebar-badge {
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(0,0,0,0.22);
  margin-left: auto;
  font-weight: bold;
}

/* \u4FA7\u8FB9\u680F\u5E95\u90E8\u64CD\u4F5C\u533A\uFF1A\u4E3B\u9898\u5207\u6362\u5706\u5708\u4E0E\u5237\u65B0 */
.igs-sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  align-items: center;
}

/* \u4FA7\u8FB9\u680F\u5782\u76F4\u4E3B\u9898\u5207\u6362\u6761 (\u7AD6\u6761\u8BBE\u8BA1\uFF0C\u7EDD\u4E0D\u6C61\u67D3\u8BBE\u7F6E\u754C\u9762\u7684\u6A2A\u6761) */
.igs-resources-theme-group {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  background: var(--igs-settings-field, rgba(0,0,0,0.15)) !important;
  padding: 6px 4px !important;
  border-radius: 999px !important;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1)) !important;
}

.igs-resources-theme-swatch {
  width: 18px !important;
  height: 18px !important;
  border-radius: 50% !important;
  padding: 0 !important;
  margin: 0 !important;
  border: 2px solid transparent !important;
  cursor: pointer !important;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease !important;
  outline: none !important;
  box-sizing: border-box !important;
}

.igs-resources-theme-swatch.theme-cream {
  background-color: #85a76a !important;
  border-color: #f7f0e6 !important;
}

.igs-resources-theme-swatch.theme-light {
  background-color: #11110f !important;
  border-color: #fbfaf6 !important;
}

.igs-resources-theme-swatch.theme-landmine {
  background-color: #ffc4d4 !important;
  border-color: #2b2b2b !important;
}

.igs-resources-theme-swatch.theme-dark {
  background-color: #7fd6ca !important;
  border-color: #24292e !important;
}

.igs-resources-theme-swatch:hover {
  transform: scale(1.2) !important;
}

.igs-resources-theme-swatch.is-active {
  box-shadow: 0 0 0 2px var(--igs-settings-accent, #7fd6ca) !important;
  transform: scale(1.15) !important;
}

/* =========================================
   \u53F3\u4FA7\u5168\u666F\u4E3B\u89C6\u53E3 (Main Body)
   ========================================= */
.igs-resources-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background-color: var(--igs-settings-panel, #24292e);
}

/* \u6781\u7B80\u5355\u884C\u9876\u680F (Search + Scope + Actions) */
.igs-main-topbar {
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  background-color: var(--igs-settings-surface, #2a3036);
  flex-shrink: 0;
  gap: 10px;
  min-height: 44px;
}

.igs-topbar-search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--igs-settings-field, rgba(0,0,0,0.1));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  border-radius: 8px;
  padding: 4px 10px;
  flex: 1;
  max-width: 240px;
}

.igs-topbar-search-input {
  background: transparent !important;
  border: none !important;
  color: var(--igs-settings-ink, #fff) !important;
  font-size: 0.82rem !important;
  width: 100%;
  outline: none;
  padding: 0 !important;
}

/* \u4F5C\u7528\u57DF\u5206\u6BB5\u836F\u4E38 */
.igs-scope-segmented {
  display: inline-flex;
  align-items: center;
  background: var(--igs-settings-field, rgba(0,0,0,0.15));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
  flex-shrink: 0;
}

.igs-scope-seg-opt {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.74rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.55));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.igs-scope-seg-opt.is-active {
  background: var(--igs-settings-panel, #24292e);
  color: var(--igs-settings-ink, #ffffff);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.igs-topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* \u89D2\u8272\u4E0E\u63A7\u5236\u4E00\u4F53\u5316\u680F */
.igs-char-unified-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background: var(--igs-settings-field, rgba(0,0,0,0.05));
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.06));
  gap: 8px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.igs-char-unified-bar::-webkit-scrollbar {
  display: none;
}

.igs-char-pills-list {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.igs-char-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 16px;
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.igs-char-pill-btn.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border-color: transparent;
  font-weight: 700;
}

.igs-char-tab-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(0,0,0,0.2);
}

.igs-char-add-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 16px;
  background: transparent;
  border: 1px dashed var(--igs-settings-line, rgba(255,255,255,0.2));
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.6));
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
}

.igs-char-meta-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
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
}

.igs-char-compact-height {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.74rem;
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
}

.igs-char-compact-height input {
  width: 44px !important;
  height: 22px !important;
  padding: 1px 3px !important;
  text-align: center;
  font-size: 0.74rem !important;
  border-radius: 4px !important;
}

/* \u8863\u88C5\u7D27\u51D1\u680F */
.igs-outfits-unified-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 14px;
  gap: 6px;
  background: var(--igs-settings-surface, #2a3036);
  border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.06));
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.igs-outfits-unified-bar::-webkit-scrollbar {
  display: none;
}

.igs-outfit-tab-btn {
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--igs-settings-field, rgba(0,0,0,0.18));
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.75));
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.igs-outfit-tab-btn.is-active {
  background: var(--igs-settings-panel, #24292e);
  border-color: var(--igs-settings-accent, #7fd6ca);
  color: var(--igs-settings-ink, #ffffff);
}

.igs-outfit-default-tag {
  font-size: 0.68rem;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(104, 159, 56, 0.2);
  color: var(--igs-settings-accent, #7fd6ca);
}

.igs-outfit-action-btn {
  padding: 4px 8px;
  border-radius: 6px;
  background: transparent;
  border: 1px dashed var(--igs-settings-line, rgba(255,255,255,0.15));
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.6));
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

/* \u4E3B\u5185\u5BB9\u53EF\u6EDA\u52A8\u533A\u57DF */
.igs-resources-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  min-height: 0;
}

/* \u5DEE\u5206\u591A\u5217\u7F51\u683C (\u5927\u56FE\u4F18\u5148) */
.igs-char-diffs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.igs-diff-card {
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.15s ease;
}

.igs-diff-card:hover {
  border-color: var(--igs-settings-accent, #7fd6ca);
  transform: translateY(-2px);
}

.igs-diff-card-thumb {
  width: 100%;
  aspect-ratio: 3/4;
  background-color: #1a1e22;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.igs-diff-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.igs-diff-card-info {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--igs-settings-field, rgba(0,0,0,0.08));
}

.igs-diff-card-name {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--igs-settings-ink, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  line-height: 1.2;
}

.igs-diff-card-acts {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.igs-diff-act-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  background: var(--igs-settings-surface, #2a3036);
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.15s ease;
  padding: 0;
}

.igs-diff-act-btn:hover {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border-color: var(--igs-settings-accent, #7fd6ca);
}

/* \u80CC\u666F\u3001\u8863\u67DC\u3001CG\u3001\u9053\u5177\u901A\u7528\u5361\u7247\u7F51\u683C */
.igs-resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.igs-resource-card {
  background: var(--igs-settings-surface, #2a3036);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  border-radius: 10px;
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

.igs-resource-thumb-box {
  width: 100%;
  aspect-ratio: 3/4;
  background-color: #1a1e22;
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
  object-fit: cover;
}

.igs-resource-empty-thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.3));
  font-size: 0.78rem;
}

.igs-resource-card-overlay-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.igs-resource-card:hover .igs-resource-card-overlay-actions {
  opacity: 1;
}

.igs-icon-tag-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
}

.igs-icon-tag-btn:hover {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
}

.igs-icon-tag-btn.is-active {
  color: #ffd166;
}

.igs-resource-info {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.igs-resource-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.igs-resource-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--igs-settings-ink, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.igs-resource-desc {
  font-size: 0.75rem;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* CG \u5F85\u751F\u6210\u5361\u7247 */
.igs-cg-pending-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: radial-gradient(circle at center, rgba(127, 214, 202, 0.08) 0%, rgba(0, 0, 0, 0.4) 100%);
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  padding: 8px;
  text-align: center;
}

.igs-cg-badge-pending {
  position: absolute;
  top: 6px;
  left: 6px;
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(230, 126, 34, 0.85);
  color: #ffffff;
  font-weight: 700;
}

.igs-cg-btn-generate {
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border: none;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* CG \u7B5B\u9009\u836F\u4E38 */
.igs-resources-subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.igs-resources-filter-chips {
  display: flex;
  gap: 6px;
}

.igs-resources-chip {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.76rem;
  font-weight: 500;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  background: var(--igs-settings-field, #1f2428);
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.7));
  cursor: pointer;
}

.igs-resources-chip.is-active {
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  border-color: transparent;
  font-weight: 700;
}

/* \u6309\u94AE\u89C4\u8303 */
.igs-btn-icon-round {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: var(--igs-settings-field, #1f2428);
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.8));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
}

.igs-btn-icon-round:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink, #fff);
}

.igs-btn-primary-compact {
  padding: 5px 12px;
  border-radius: 6px;
  background: var(--igs-settings-accent, #7fd6ca);
  color: #111417;
  font-size: 0.8rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.igs-diff-act-btn {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  border: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
  background: var(--igs-settings-field, rgba(0,0,0,0.15));
  color: var(--igs-settings-ink-2, rgba(255,255,255,0.75));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
}

.igs-diff-act-btn:hover {
  background: var(--igs-settings-hover, rgba(255,255,255,0.1));
  color: var(--igs-settings-ink, #ffffff);
  border-color: var(--igs-settings-accent, #7fd6ca);
}

/* =========================================
   \u5168\u5C40\u8F93\u5165\u6846\u4E0E\u6587\u672C\u57DF\u5E95\u8272\u5F3A\u5236\u5951\u5408\u5F53\u524D\u4E3B\u9898
   ========================================= */
.igs-resources-overlay input,
.igs-resources-overlay textarea,
.igs-dialog-overlay input,
.igs-dialog-overlay textarea,
.igs-form-input,
.igs-form-textarea,
.igs-dialog-box input,
.igs-dialog-box textarea,
textarea.igs-form-textarea {
  background-color: var(--igs-settings-field, #ebe2d5) !important;
  color: var(--igs-settings-ink, #514638) !important;
  border: 1px solid var(--igs-settings-line-strong, rgba(0,0,0,0.15)) !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
  font-size: 0.88rem !important;
  outline: none !important;
  font-family: inherit !important;
  box-sizing: border-box !important;
}

.igs-resources-overlay input::placeholder,
.igs-resources-overlay textarea::placeholder,
.igs-dialog-overlay input::placeholder,
.igs-dialog-overlay textarea::placeholder {
  color: var(--igs-settings-ink-3, rgba(0,0,0,0.4)) !important;
}

.igs-form-textarea {
  min-height: 80px !important;
  resize: vertical !important;
}

.igs-resources-overlay input:focus,
.igs-resources-overlay textarea:focus,
.igs-dialog-overlay input:focus,
.igs-dialog-overlay textarea:focus,
.igs-form-input:focus,
.igs-form-textarea:focus {
  border-color: var(--igs-settings-accent, #7fd6ca) !important;
}

/* =========================================
   \u5F39\u7A97\u5168\u5C40\u5C45\u4E2D\u5C45\u4E2D\u5C45\u4E2D (\u5F7B\u5E95\u89E3\u51B3\u8D34\u9876\u95EE\u9898)
   ========================================= */
.igs-dialog-overlay {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483647 !important;
  background: rgba(0,0,0,0.72) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 24px 16px !important;
  overflow-y: auto !important;
  animation: igsPatchFadeIn 0.15s ease-out;
}

.igs-dialog-box {
  width: 440px !important;
  max-width: 92vw !important;
  max-height: min(85vh, 600px) !important;
  overflow-y: auto !important;
  background: var(--igs-settings-panel, #24292e) !important;
  border: 1px solid var(--igs-settings-line-strong, rgba(255,255,255,0.2)) !important;
  border-radius: 14px !important;
  padding: 20px !important;
  box-shadow: 0 20px 50px rgba(0,0,0,0.6) !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
  margin: auto !important;
  flex-shrink: 0 !important;
}

.igs-dialog-title {
  margin: 0;
  font-size: 1.05rem;
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

.igs-file-dropzone {
  border: 2px dashed var(--igs-settings-line, rgba(255,255,255,0.15));
  border-radius: 8px;
  padding: 14px;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--igs-settings-ink-3, rgba(255,255,255,0.5));
}

.igs-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

/* =========================================
   \u5168\u5C4F Lightbox \u5927\u56FE\u67E5\u770B\u5668
   ========================================= */
.igs-lightbox-overlay {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  height: 100dvh !important;
  z-index: 2147483647 !important;
  background: rgba(10, 12, 16, 0.96) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  display: flex !important;
  flex-direction: column !important;
  animation: igsPatchFadeIn 0.15s ease-out;
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 !important;
}

.igs-lightbox-topbar {
  padding: 10px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #181b20;
  border-bottom: 1px solid rgba(255,255,255,0.12);
  color: #ffffff;
  flex-shrink: 0;
  z-index: 10;
  min-height: 48px;
}

.igs-lightbox-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.igs-lightbox-top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.igs-lightbox-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: hidden;
  position: relative;
  min-height: 0;
  cursor: zoom-out;
}

.igs-lightbox-img {
  max-width: 95vw !important;
  max-height: calc(100dvh - 120px) !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
  border-radius: 8px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.85);
  display: block;
  margin: auto;
  cursor: default;
  transition: transform 0.2s ease;
}

.igs-lightbox-bottombar {
  padding: 10px 18px;
  background: #181b20;
  border-top: 1px solid rgba(255,255,255,0.12);
  font-size: 0.82rem;
  color: rgba(255,255,255,0.85);
  max-height: 100px;
  overflow-y: auto;
  line-height: 1.4;
  flex-shrink: 0;
}

/* =========================================
   \u79FB\u52A8\u7AEF\u6DF1\u5EA6\u81EA\u9002\u5E94 (@media <= 768px)
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
    flex-direction: row; /* \u4FDD\u6301\u4FA7\u8FB9\u680F\u5728\u5DE6\u4FA7\uFF01 */
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* \u79FB\u52A8\u7AEF\u4FA7\u8FB9\u680F\u7CBE\u7B80\u4E3A 52px \u5BBD\u7684\u7D27\u51D1\u56FE\u6807\u8F68\uFF0C\u6298\u53E0\u65F6\u5F7B\u5E95\u4E3A 0 \u91CA\u653E\u5168\u90E8\u7A7A\u95F4 */
  .igs-resources-sidebar {
    width: 52px;
    padding: 10px 4px;
    align-items: center;
    transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s ease;
  }

  .igs-resources-sidebar.is-collapsed {
    width: 0 !important;
    padding: 0 !important;
    border: none !important;
    overflow: hidden !important;
  }

  .igs-sidebar-brand {
    padding: 0 0 10px 0;
    justify-content: center;
    border-bottom: 1px solid var(--igs-settings-line, rgba(255,255,255,0.08));
    width: 100%;
  }

  .igs-sidebar-brand-title {
    display: none; /* \u79FB\u52A8\u7AEF\u9690\u85CF\u5927\u6807\u9898\u6587\u5B57\uFF0C\u4EC5\u4FDD\u7559\u56FE\u6807 */
  }

  .igs-sidebar-nav-btn {
    padding: 10px 0;
    justify-content: center;
    border-radius: 8px;
    position: relative;
  }

  .igs-sidebar-nav-btn span {
    display: none; /* \u79FB\u52A8\u7AEF\u4EC5\u663E\u793A\u56FE\u6807\u4E0E\u5FAE\u89D2\u6807 */
  }

  .igs-sidebar-nav-btn i {
    font-size: 16px;
    margin: 0;
  }

  .igs-sidebar-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    padding: 1px 4px;
    font-size: 9px;
  }

  .igs-resources-sidebar .igs-resources-theme-group {
    padding: 4px 2px;
    gap: 4px;
  }

  /* \u79FB\u52A8\u7AEF\u4E3B\u89C6\u53E3\u9876\u680F */
  .igs-main-topbar {
    padding: 6px 8px;
    gap: 6px;
  }

  .igs-topbar-search-box {
    max-width: 130px;
    padding: 3px 6px;
  }

  .igs-topbar-search-input {
    font-size: 16px !important; /* \u9632\u6B62 iOS \u7F29\u653E */
  }

  .igs-scope-seg-opt {
    padding: 2px 5px;
    font-size: 11px;
  }

  .igs-char-diffs-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .igs-resources-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .igs-resource-card-overlay-actions {
    opacity: 1 !important;
  }
}
`;
  function injectResourcesStyles() {
    const docs = [document];
    try {
      if (window.parent?.document && !docs.includes(window.parent.document)) docs.push(window.parent.document);
    } catch (_) {
    }
    try {
      if (window.top?.document && !docs.includes(window.top.document)) docs.push(window.top.document);
    } catch (_) {
    }
    for (const doc2 of docs) {
      try {
        let styleEl = doc2.getElementById("igs-patch-resources-styles");
        if (!styleEl) {
          styleEl = doc2.createElement("style");
          styleEl.id = "igs-patch-resources-styles";
          (doc2.head || doc2.body || doc2.documentElement).appendChild(styleEl);
        }
        styleEl.textContent = RESOURCES_MODAL_CSS;
      } catch (_) {
      }
    }
  }

  // src/resources/asset-service.js
  var STORAGE_KEY_BRIDGE = "igs_bridge_config";
  var DB_ILLUSTRATIONS = "igs-illustrations";
  var DB_CG_GALLERY = "igs-cg-gallery";
  var DB_GENERATED_ASSETS = "igs-generated-assets";
  function getStorage() {
    return window.localStorage;
  }
  function getCandidateWindows7() {
    const wins = [window];
    try {
      if (window.parent && !wins.includes(window.parent)) wins.push(window.parent);
    } catch (_) {
    }
    try {
      if (window.top && !wins.includes(window.top)) wins.push(window.top);
    } catch (_) {
    }
    return wins;
  }
  function getRawBridgeConfig() {
    for (const w of getCandidateWindows7()) {
      try {
        if (w.IGS) {
          if (typeof w.IGS.getConfig === "function") {
            const cfg = w.IGS.getConfig();
            if (cfg && cfg.sceneAssets) return cfg;
          }
          if (typeof w.IGS.getUnifiedSettings === "function") {
            const unified = w.IGS.getUnifiedSettings();
            if (unified?.bridge?.sceneAssets) return unified.bridge;
          }
        }
      } catch (_) {
      }
    }
    try {
      const raw = getStorage().getItem(STORAGE_KEY_BRIDGE);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }
  function saveRawBridgeConfig(bridge) {
    try {
      getStorage().setItem(STORAGE_KEY_BRIDGE, JSON.stringify(bridge));
      for (const w of getCandidateWindows7()) {
        try {
          if (w.IGS && typeof w.IGS.getState === "function") {
            const igsState = w.IGS.getState();
            if (igsState) {
              if (igsState.config) {
                igsState.config.sceneAssets = bridge.sceneAssets;
              }
              if (igsState.legacyIgs?.bridge) {
                igsState.legacyIgs.bridge.sceneAssets = bridge.sceneAssets;
              }
            }
          }
        } catch (_) {
        }
      }
      broadcastSettingsUpdated(bridge);
      return true;
    } catch (err) {
      console.warn("[IGS-Patch] \u4FDD\u5B58\u914D\u7F6E\u5931\u8D25:", err);
      return false;
    }
  }
  try {
    const rawSetItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = function(key, value) {
      const res = rawSetItem(key, value);
      if (key === STORAGE_KEY_BRIDGE) {
        try {
          window.dispatchEvent(new CustomEvent("igs:legacy-settings-updated"));
        } catch (_) {
        }
      }
      return res;
    };
  } catch (_) {
  }
  function broadcastSettingsUpdated(bridge) {
    for (const w of getCandidateWindows7()) {
      try {
        w.dispatchEvent(new CustomEvent("igs:legacy-settings-updated", { detail: bridge }));
        if (w.eventSource && typeof w.eventSource.emit === "function") {
          w.eventSource.emit("igs:legacy-settings-updated", bridge);
        }
      } catch (_) {
      }
    }
  }
  function getActiveCardScope() {
    for (const w of getCandidateWindows7()) {
      try {
        const ctx = w.SillyTavern?.getContext?.();
        if (ctx) {
          if (ctx.groupId != null && String(ctx.groupId) !== "") {
            return `group:${ctx.groupId}`;
          }
          const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
          const card = ctx.characterId != null ? chars[ctx.characterId] : null;
          const name = card && card.name && String(card.name).trim() || ctx.name2 && String(ctx.name2).trim();
          if (name) return `card:${name}`;
        }
      } catch (_) {
      }
    }
    const bridge = getRawBridgeConfig();
    const cards = Object.keys(bridge.sceneAssets?.cards || {});
    const userCards = cards.filter((c) => c !== "card:SillyTavern System");
    if (userCards.length > 0) return userCards[0];
    return cards[0] || "";
  }
  function getScopedSceneAssets(scopeMode = "all", customScopeKey = null) {
    const bridge = getRawBridgeConfig();
    const root = bridge.sceneAssets || {};
    const scopeKey = customScopeKey || getActiveCardScope();
    const card = scopeKey && root.cards && root.cards[scopeKey] ? root.cards[scopeKey] : null;
    if (scopeMode === "card") {
      if (!card) return emptyAssetCollection(scopeKey);
      return {
        characters: card.characters || {},
        characterOutfits: card.characterOutfits || {},
        characterDefaultOutfits: card.characterDefaultOutfits || {},
        characterSpriteNotes: card.characterSpriteNotes || {},
        characterSpriteScales: card.characterSpriteScales || root.characterSpriteScales || {},
        userCharacter: card.userCharacter || root.userCharacter || "",
        scenes: card.scenes || {},
        wardrobe: card.wardrobe || {},
        items: card.items || {},
        eventCgs: card.eventCgs || {},
        statusAvatars: card.statusAvatars || {},
        characterDna: card.characterDna || {},
        generated: card.generated || {},
        scopeKey
      };
    }
    if (scopeMode === "global") {
      return {
        characters: root.characters || {},
        characterOutfits: root.characterOutfits || {},
        characterDefaultOutfits: root.characterDefaultOutfits || {},
        characterSpriteNotes: root.characterSpriteNotes || {},
        characterSpriteScales: root.characterSpriteScales || {},
        userCharacter: root.userCharacter || "",
        scenes: root.scenes || {},
        wardrobe: root.wardrobe || {},
        items: root.items || {},
        eventCgs: root.eventCgs || {},
        statusAvatars: root.statusAvatars || {},
        characterDna: root.characterDna || {},
        generated: root.generated || {},
        scopeKey: ""
      };
    }
    const cardOutfits = card?.characterOutfits || {};
    const rootOutfits = root.characterOutfits || {};
    const mergedOutfits = { ...rootOutfits };
    for (const [charName, outfits] of Object.entries(cardOutfits)) {
      mergedOutfits[charName] = { ...mergedOutfits[charName] || {}, ...outfits };
    }
    return {
      characters: { ...root.characters || {}, ...card?.characters || {} },
      characterOutfits: mergedOutfits,
      characterDefaultOutfits: { ...root.characterDefaultOutfits || {}, ...card?.characterDefaultOutfits || {} },
      characterSpriteNotes: { ...root.characterSpriteNotes || {}, ...card?.characterSpriteNotes || {} },
      characterSpriteScales: { ...root.characterSpriteScales || {}, ...card?.characterSpriteScales || {} },
      userCharacter: card?.userCharacter || root.userCharacter || "",
      scenes: { ...root.scenes || {}, ...card?.scenes || {} },
      wardrobe: { ...root.wardrobe || {}, ...card?.wardrobe || {} },
      items: { ...root.items || {}, ...card?.items || {} },
      eventCgs: { ...root.eventCgs || {}, ...card?.eventCgs || {} },
      statusAvatars: { ...root.statusAvatars || {}, ...card?.statusAvatars || {} },
      characterDna: { ...root.characterDna || {}, ...card?.characterDna || {} },
      generated: {
        scenes: { ...root.generated?.scenes || {}, ...card?.generated?.scenes || {} },
        characters: { ...root.generated?.characters || {}, ...card?.generated?.characters || {} },
        items: { ...root.generated?.items || {}, ...card?.generated?.items || {} }
      },
      scopeKey
    };
  }
  function emptyAssetCollection(scopeKey = "") {
    return {
      characters: {},
      characterOutfits: {},
      characterDefaultOutfits: {},
      characterSpriteNotes: {},
      characterSpriteScales: {},
      userCharacter: "",
      scenes: {},
      wardrobe: {},
      items: {},
      eventCgs: {},
      statusAvatars: {},
      characterDna: {},
      generated: {},
      scopeKey
    };
  }
  function updateScopedSceneAssets(updater, scopeMode = "all", customScopeKey = null) {
    const bridge = getRawBridgeConfig();
    if (!bridge.sceneAssets || typeof bridge.sceneAssets !== "object") {
      bridge.sceneAssets = {};
    }
    const root = bridge.sceneAssets;
    const scopeKey = customScopeKey || getActiveCardScope();
    if (scopeMode === "card" && scopeKey) {
      if (!root.cards || typeof root.cards !== "object") root.cards = {};
      if (!root.cards[scopeKey] || typeof root.cards[scopeKey] !== "object") {
        root.cards[scopeKey] = emptyAssetCollection(scopeKey);
      }
      updater(root.cards[scopeKey]);
    } else if (scopeMode === "global") {
      updater(root);
    } else {
      if (scopeKey) {
        if (!root.cards || typeof root.cards !== "object") root.cards = {};
        if (!root.cards[scopeKey] || typeof root.cards[scopeKey] !== "object") {
          root.cards[scopeKey] = emptyAssetCollection(scopeKey);
        }
        updater(root.cards[scopeKey]);
      } else {
        updater(root);
      }
    }
    return saveRawBridgeConfig(bridge);
  }
  function openDb(name, version2 = void 0, onUpgrade = null) {
    return new Promise((resolve2, reject) => {
      let req;
      try {
        if (!window.indexedDB) {
          return reject(new Error("IndexedDB not supported"));
        }
        req = typeof version2 === "number" ? window.indexedDB.open(name, version2) : window.indexedDB.open(name);
      } catch (err) {
        return reject(err);
      }
      req.onupgradeneeded = (e) => {
        if (typeof onUpgrade === "function") onUpgrade(req.result, e);
      };
      req.onsuccess = () => resolve2(req.result);
      req.onerror = () => reject(req.error || new Error(`\u65E0\u6CD5\u6253\u5F00\u6570\u636E\u5E93: ${name}`));
    });
  }
  var resolvedImageCache = /* @__PURE__ */ new Map();
  async function resolveImageUrl(url) {
    if (!url || typeof url !== "string") return "";
    let cleanUrl = url.trim();
    if (!cleanUrl) return "";
    if (cleanUrl.startsWith("data:") || cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://") || cleanUrl.startsWith("blob:")) {
      return cleanUrl;
    }
    if (cleanUrl.startsWith("igs-gen:")) {
      const imageId = cleanUrl.replace("igs-gen:", "");
      if (resolvedImageCache.has(imageId)) {
        return resolvedImageCache.get(imageId);
      }
      try {
        const db = await openDb(DB_GENERATED_ASSETS);
        if (db.objectStoreNames.contains("images")) {
          const tx = db.transaction("images", "readonly");
          const store = tx.objectStore("images");
          const record = await new Promise((res) => {
            const r = store.get(imageId);
            r.onsuccess = () => res(r.result);
            r.onerror = () => res(null);
          });
          db.close();
          if (record && (record.dataUrl || record.originalDataUrl)) {
            let finalUrl = record.dataUrl || record.originalDataUrl;
            if (!finalUrl.startsWith("data:") && !finalUrl.startsWith("http://") && !finalUrl.startsWith("https://") && !finalUrl.startsWith("blob:") && !finalUrl.startsWith("/")) {
              finalUrl = "/" + finalUrl;
            }
            resolvedImageCache.set(imageId, finalUrl);
            return finalUrl;
          }
        } else {
          db.close();
        }
      } catch (_) {
      }
      const fallbackUrl = `/user/images/igs-media/${imageId}.png`;
      resolvedImageCache.set(imageId, fallbackUrl);
      return fallbackUrl;
    }
    if (!cleanUrl.startsWith("/") && (cleanUrl.startsWith("user/") || cleanUrl.startsWith("scripts/") || cleanUrl.startsWith("public/"))) {
      return "/" + cleanUrl;
    }
    return cleanUrl;
  }
  async function listCharacters(scopeMode = "all", customScopeKey = null) {
    const assets = getScopedSceneAssets(scopeMode, customScopeKey);
    const charsObj = assets.characters || {};
    const outfitsObj = assets.characterOutfits || {};
    const defaultOutfits = assets.characterDefaultOutfits || {};
    const spriteNotes = assets.characterSpriteNotes || {};
    const spriteScales = assets.characterSpriteScales || {};
    const statusAvatars = assets.statusAvatars || {};
    const userCharName = String(assets.userCharacter || "").trim();
    const allNames = new Set([
      ...Object.keys(charsObj),
      ...Object.keys(outfitsObj),
      ...Object.keys(spriteNotes),
      ...Object.keys(statusAvatars)
    ].filter(Boolean));
    const result = [];
    for (const name of allNames) {
      const isUser = userCharName === name;
      const height = Number(spriteScales[name]) || 100;
      const rawAvatar = statusAvatars[name] || "";
      const resolvedAvatar = await resolveImageUrl(rawAvatar);
      const note = spriteNotes[name] || "";
      const charOutfits = outfitsObj[name] || {};
      const defaultOutfitName = defaultOutfits[name]?.outfitName || Object.keys(charOutfits)[0] || "\u9ED8\u8BA4\u8863\u88C5";
      const outfitsList = [];
      for (const [outfitName, outfitData] of Object.entries(charOutfits)) {
        const isDefault = outfitName === defaultOutfitName;
        const moodMap = outfitData && typeof outfitData === "object" && outfitData.moods ? outfitData.moods : {};
        const moodList = [];
        for (const [moodName, moodUrl] of Object.entries(moodMap)) {
          if (!moodUrl) continue;
          moodList.push({
            name: moodName,
            rawUrl: moodUrl,
            resolvedUrl: await resolveImageUrl(moodUrl)
          });
        }
        outfitsList.push({
          name: outfitName,
          isDefault,
          prompt: outfitData?.prompt || "",
          moods: moodList,
          count: moodList.length
        });
      }
      const directChar = charsObj[name];
      const directMoodsObj = directChar && typeof directChar === "object" && directChar.moods ? directChar.moods : directChar && typeof directChar === "object" ? directChar : {};
      const directMoodsList = [];
      for (const [mName, mUrl] of Object.entries(directMoodsObj)) {
        if (typeof mUrl === "string" && mUrl.trim()) {
          directMoodsList.push({
            name: mName,
            rawUrl: mUrl,
            resolvedUrl: await resolveImageUrl(mUrl)
          });
        }
      }
      if (directMoodsList.length && !outfitsList.length) {
        outfitsList.push({
          name: defaultOutfitName,
          isDefault: true,
          prompt: "",
          moods: directMoodsList,
          count: directMoodsList.length
        });
      }
      let baseResolvedUrl = resolvedAvatar;
      let baseRawUrl = rawAvatar;
      if (!baseResolvedUrl && outfitsList.length) {
        const defOutfit = outfitsList.find((o) => o.isDefault) || outfitsList[0];
        const firstMood = defOutfit.moods.find((m) => m.name === "\u5E73\u548C") || defOutfit.moods[0];
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
        activeOutfitIndex: 0
      });
    }
    return result.sort((a, b) => {
      if (a.isUser && !b.isUser) return -1;
      if (!a.isUser && b.isUser) return 1;
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    });
  }
  function saveCharacter(name, baseRawUrl = "", scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (!assets.characters) assets.characters = {};
      if (!assets.characters[name]) assets.characters[name] = {};
      if (!assets.characterOutfits) assets.characterOutfits = {};
      const defOutfitName = `${name}\xB7\u521D\u59CB\u8863\u88C5`;
      if (!assets.characterOutfits[name]) {
        assets.characterOutfits[name] = {
          [defOutfitName]: {
            words: [],
            moods: baseRawUrl ? { "\u5E73\u548C": baseRawUrl } : {},
            legacyOriginal: 1,
            wardrobe: defOutfitName
          }
        };
      }
      if (!assets.characterDefaultOutfits) assets.characterDefaultOutfits = {};
      assets.characterDefaultOutfits[name] = { version: 1, outfitName: defOutfitName, migrated: true };
    }, scopeMode);
  }
  function setUserCharacter(name, scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      assets.userCharacter = name;
    }, scopeMode);
  }
  function setCharacterHeight(name, height, scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (!assets.characterSpriteScales) assets.characterSpriteScales = {};
      assets.characterSpriteScales[name] = Number(height) || 100;
    }, scopeMode);
  }
  function saveCharacterOutfit(charName, outfitName, prompt = "", isDefault = false, scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (!assets.characterOutfits) assets.characterOutfits = {};
      if (!assets.characterOutfits[charName]) assets.characterOutfits[charName] = {};
      const oldOutfit = assets.characterOutfits[charName][outfitName] || {};
      assets.characterOutfits[charName][outfitName] = {
        ...oldOutfit,
        words: [],
        prompt,
        moods: oldOutfit.moods || {},
        wardrobe: outfitName
      };
      if (isDefault) {
        if (!assets.characterDefaultOutfits) assets.characterDefaultOutfits = {};
        assets.characterDefaultOutfits[charName] = { version: 1, outfitName, migrated: true };
      }
    }, scopeMode);
  }
  function deleteCharacterOutfit(charName, outfitName, scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (assets.characterOutfits?.[charName]) {
        delete assets.characterOutfits[charName][outfitName];
      }
    }, scopeMode);
  }
  function saveCharacterMood(characterName, moodName, moodRawUrl, outfitName = "", scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (!assets.characterOutfits) assets.characterOutfits = {};
      if (!assets.characterOutfits[characterName]) assets.characterOutfits[characterName] = {};
      let targetOutfit = outfitName;
      if (!targetOutfit) {
        const def2 = assets.characterDefaultOutfits?.[characterName]?.outfitName;
        targetOutfit = def2 || Object.keys(assets.characterOutfits[characterName])[0] || `${characterName}\xB7\u521D\u59CB\u8863\u88C5`;
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
  function deleteCharacterMood(characterName, moodName, outfitName = "", scopeMode = "all") {
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
      if (assets.characters?.[characterName]?.[moodName]) {
        delete assets.characters[characterName][moodName];
      }
    }, scopeMode);
  }
  async function listScenes(scopeMode = "all", customScopeKey = null) {
    const assets = getScopedSceneAssets(scopeMode, customScopeKey);
    const scenesObj = assets.scenes || {};
    const result = [];
    for (const [name, data] of Object.entries(scenesObj)) {
      if (!name) continue;
      const sceneData = data && typeof data === "object" ? data : { url: String(data || "") };
      const baseRawUrl = sceneData.url || "";
      const baseResolved = await resolveImageUrl(baseRawUrl);
      const timesObj = sceneData.times && typeof sceneData.times === "object" ? sceneData.times : {};
      const timesList = [];
      for (const [timeName, timeVal] of Object.entries(timesObj)) {
        const tUrl = typeof timeVal === "string" ? timeVal : timeVal?.url || "";
        if (!tUrl) continue;
        timesList.push({
          name: timeName,
          rawUrl: tUrl,
          resolvedUrl: await resolveImageUrl(tUrl),
          desc: typeof timeVal === "object" ? timeVal.desc || "" : ""
        });
      }
      result.push({
        name,
        desc: sceneData.desc || "",
        baseRawUrl,
        baseResolvedUrl: baseResolved,
        timeCount: timesList.length,
        times: timesList
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  }
  function saveScene(name, baseRawUrl, desc = "", scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (!assets.scenes) assets.scenes = {};
      if (!assets.scenes[name]) {
        assets.scenes[name] = { url: baseRawUrl, desc, times: {} };
      } else if (typeof assets.scenes[name] === "object") {
        assets.scenes[name].url = baseRawUrl;
        if (desc) assets.scenes[name].desc = desc;
      } else {
        assets.scenes[name] = { url: baseRawUrl, desc, times: {} };
      }
    }, scopeMode);
  }
  function deleteScene(name, scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (assets.scenes) delete assets.scenes[name];
    }, scopeMode);
  }
  function saveSceneTime(sceneName, timeName, timeRawUrl, scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (!assets.scenes) assets.scenes = {};
      let sceneObj = assets.scenes[sceneName];
      if (!sceneObj || typeof sceneObj !== "object") {
        sceneObj = { url: "", desc: "", times: {} };
        assets.scenes[sceneName] = sceneObj;
      }
      if (!sceneObj.times) sceneObj.times = {};
      sceneObj.times[timeName] = timeRawUrl;
    }, scopeMode);
  }
  function deleteSceneTime(sceneName, timeName, scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      const sceneObj = assets.scenes?.[sceneName];
      if (sceneObj && sceneObj.times) {
        delete sceneObj.times[timeName];
      }
    }, scopeMode);
  }
  async function listWardrobe(scopeMode = "all", customScopeKey = null) {
    const assets = getScopedSceneAssets(scopeMode, customScopeKey);
    const wardrobeObj = assets.wardrobe || {};
    const result = [];
    for (const [name, data] of Object.entries(wardrobeObj)) {
      if (!name) continue;
      const item = data && typeof data === "object" ? data : { prompt: String(data || "") };
      const rawUrl = item.image || item.rawUrl || item.url || "";
      result.push({
        name,
        character: item.character || "",
        prompt: item.prompt || "",
        rawUrl,
        resolvedUrl: await resolveImageUrl(rawUrl),
        scenes: Array.isArray(item.scenes) ? item.scenes : []
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  }
  function saveWardrobeItem(name, itemData, scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (!assets.wardrobe) assets.wardrobe = {};
      assets.wardrobe[name] = {
        name,
        character: itemData.character || "",
        prompt: itemData.prompt || "",
        image: itemData.rawUrl || itemData.image || "",
        scenes: Array.isArray(itemData.scenes) ? itemData.scenes : []
      };
    }, scopeMode);
  }
  function deleteWardrobeItem(name, scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (assets.wardrobe) delete assets.wardrobe[name];
    }, scopeMode);
  }
  async function listAllCgs(filter = "ready") {
    const list = [];
    const marksMap = /* @__PURE__ */ new Map();
    try {
      const dbMarks = await openDb(DB_CG_GALLERY);
      if (dbMarks.objectStoreNames.contains("marks")) {
        const tx = dbMarks.transaction("marks", "readonly");
        const allMarks = await new Promise((res) => {
          const req = tx.objectStore("marks").getAll();
          req.onsuccess = () => res(req.result || []);
          req.onerror = () => res([]);
        });
        for (const m of allMarks) {
          if (m && m.key) marksMap.set(m.key, m);
        }
      }
      dbMarks.close();
    } catch (_) {
    }
    try {
      const dbCg = await openDb(DB_ILLUSTRATIONS);
      if (dbCg.objectStoreNames.contains("slots")) {
        const tx = dbCg.transaction("slots", "readonly");
        const allSlots = await new Promise((res) => {
          const req = tx.objectStore("slots").getAll();
          req.onsuccess = () => res(req.result || []);
          req.onerror = () => res([]);
        });
        for (const s of allSlots) {
          if (!s || !s.key) continue;
          const mark = marksMap.get(s.key) || {};
          const isHidden = mark.hidden === true || s.hidden === true;
          const isFavorite = mark.favorite === true || s.favorite === true;
          const rawDataUrl = s.dataUrl || s.imageUrl || s.originalDataUrl || "";
          const parts = String(s.floorKey || "").split("|");
          const floorNo = parts.length >= 2 ? parts[parts.length - 2] : "";
          const isPending = s.status === "pending" || !rawDataUrl;
          if (filter === "ready" && (isPending || isHidden)) continue;
          if (filter === "pending" && (!isPending || isHidden)) continue;
          if (filter === "favorites" && (!isFavorite || isPending)) continue;
          if (filter === "hidden" && !isHidden) continue;
          if (filter === "all" && (isPending || isHidden)) continue;
          let fullPrompt = s.prompt || s.caption || "";
          if (!fullPrompt && (s.scene || s.chars)) {
            const charTags = Array.isArray(s.chars) ? s.chars.map((c) => c.tags).filter(Boolean).join(", ") : "";
            fullPrompt = [s.scene, charTags].filter(Boolean).join("\n");
          }
          list.push({
            key: s.key,
            floorKey: s.floorKey || "",
            slot: s.slot || 1,
            label: floorNo ? `\u7B2C ${floorNo} \u697C` : s.key,
            prompt: fullPrompt,
            description: s.description || s.analysis || "",
            status: s.status || (rawDataUrl ? "done" : "pending"),
            isPending,
            rawUrl: rawDataUrl,
            resolvedUrl: isPending ? "" : await resolveImageUrl(rawDataUrl),
            isFavorite,
            isHidden,
            isEventCg: false
          });
        }
      }
      dbCg.close();
    } catch (_) {
    }
    const assets = getScopedSceneAssets("all");
    const eventCgs = assets.eventCgs || {};
    for (const [name, item] of Object.entries(eventCgs)) {
      if (!name) continue;
      const rawUrl = typeof item === "string" ? item : item?.url || "";
      if (filter === "hidden") continue;
      if (filter === "pending") continue;
      list.push({
        key: `event_cg_${name}`,
        label: name,
        prompt: typeof item === "object" ? item.prompt || "" : "",
        description: "\u9884\u7F6E\u4E8B\u4EF6CG",
        status: "done",
        isPending: false,
        rawUrl,
        resolvedUrl: await resolveImageUrl(rawUrl),
        isFavorite: true,
        isHidden: false,
        isEventCg: true
      });
    }
    return list;
  }
  async function toggleCgFavorite(cgKey, currentVal) {
    const nextVal = !currentVal;
    try {
      const dbMarks = await openDb(DB_CG_GALLERY, void 0, (db) => {
        if (!db.objectStoreNames.contains("marks")) db.createObjectStore("marks", { keyPath: "key" });
      });
      const tx = dbMarks.transaction("marks", "readwrite");
      const store = tx.objectStore("marks");
      const existing = await new Promise((res) => {
        const req = store.get(cgKey);
        req.onsuccess = () => res(req.result || { key: cgKey });
        req.onerror = () => res({ key: cgKey });
      });
      existing.favorite = nextVal;
      existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      store.put(existing);
      dbMarks.close();
      return { ok: true, isFavorite: nextVal };
    } catch (err) {
      console.warn("[IGS-Patch] \u5207\u6362\u6536\u85CF\u72B6\u6001\u5F02\u5E38:", err);
      return { ok: false };
    }
  }
  async function toggleCgHidden(cgKey, currentVal) {
    const nextVal = !currentVal;
    try {
      const dbMarks = await openDb(DB_CG_GALLERY, void 0, (db) => {
        if (!db.objectStoreNames.contains("marks")) db.createObjectStore("marks", { keyPath: "key" });
      });
      const tx = dbMarks.transaction("marks", "readwrite");
      const store = tx.objectStore("marks");
      const existing = await new Promise((res) => {
        const req = store.get(cgKey);
        req.onsuccess = () => res(req.result || { key: cgKey });
        req.onerror = () => res({ key: cgKey });
      });
      existing.hidden = nextVal;
      existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      store.put(existing);
      dbMarks.close();
      return { ok: true, isHidden: nextVal };
    } catch (err) {
      console.warn("[IGS-Patch] \u5207\u6362\u9690\u85CF\u72B6\u6001\u5F02\u5E38:", err);
      return { ok: false };
    }
  }
  async function saveCgDataUrl(cgKey, dataUrl) {
    try {
      const dbCg = await openDb(DB_ILLUSTRATIONS);
      const tx = dbCg.transaction("slots", "readwrite");
      const store = tx.objectStore("slots");
      const slot = await new Promise((res) => {
        const req = store.get(cgKey);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => res(null);
      });
      if (slot) {
        slot.dataUrl = dataUrl;
        slot.status = "ready";
        slot.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        store.put(slot);
      }
      dbCg.close();
      return true;
    } catch (err) {
      console.warn("[IGS-Patch] \u4FDD\u5B58 CG \u5F02\u5E38:", err);
      return false;
    }
  }
  async function deleteCg(cgKey, isEventCg = false) {
    if (isEventCg) {
      const name = cgKey.replace("event_cg_", "");
      return updateScopedSceneAssets((assets) => {
        if (assets.eventCgs) delete assets.eventCgs[name];
      }, "all");
    }
    try {
      const dbCg = await openDb(DB_ILLUSTRATIONS);
      const tx = dbCg.transaction("slots", "readwrite");
      tx.objectStore("slots").delete(cgKey);
      dbCg.close();
      return true;
    } catch (err) {
      console.warn("[IGS-Patch] \u5220\u9664 CG \u5F02\u5E38:", err);
      return false;
    }
  }
  async function listItems(scopeMode = "all", customScopeKey = null) {
    const assets = getScopedSceneAssets(scopeMode, customScopeKey);
    const combined = { ...assets.items || {}, ...assets.generated?.items || {} };
    const result = [];
    for (const [name, data] of Object.entries(combined)) {
      if (!name) continue;
      const item = data && typeof data === "object" ? data : { url: String(data || "") };
      const rawUrl = item.url || item.image || "";
      result.push({
        name,
        desc: item.desc || "",
        rawUrl,
        resolvedUrl: await resolveImageUrl(rawUrl)
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  }
  function saveItem(name, rawUrl, desc = "", scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (!assets.items) assets.items = {};
      if (!assets.generated) assets.generated = {};
      if (!assets.generated.items) assets.generated.items = {};
      const entry = { url: rawUrl, desc };
      assets.items[name] = entry;
      assets.generated.items[name] = entry;
    }, scopeMode);
  }
  function deleteItem(name, scopeMode = "all") {
    return updateScopedSceneAssets((assets) => {
      if (assets.items) {
        delete assets.items[name];
      }
      if (assets.generated?.items) {
        delete assets.generated.items[name];
      }
    }, scopeMode);
  }
  async function listStagingAssets() {
    const list = [];
    try {
      const db = await openDb(DB_GENERATED_ASSETS);
      if (db.objectStoreNames.contains("assets")) {
        const tx = db.transaction("assets", "readonly");
        const all = await new Promise((res) => {
          const req = tx.objectStore("assets").getAll();
          req.onsuccess = () => res(req.result || []);
          req.onerror = () => res([]);
        });
        for (const item of all) {
          if (item && item.status === "temp") {
            const rawUrl = item.imageId ? `igs-gen:${item.imageId}` : item.dataUrl || "";
            list.push({
              key: item.key || item.id,
              type: item.type || "sprite",
              name: item.name || "\u672A\u547D\u540D",
              rawUrl,
              resolvedUrl: await resolveImageUrl(rawUrl)
            });
          }
        }
      }
      db.close();
    } catch (_) {
    }
    return list;
  }
  async function acceptStagingAsset(item, targetName, targetType) {
    const resolvedUrl = item.rawUrl;
    if (targetType === "sprite") {
      saveCharacter(targetName, resolvedUrl);
    } else if (targetType === "background") {
      saveScene(targetName, resolvedUrl);
    } else if (targetType === "item") {
      saveItem(targetName, resolvedUrl);
    }
    await discardStagingAsset(item.key);
    return true;
  }
  async function discardStagingAsset(key) {
    try {
      const db = await openDb(DB_GENERATED_ASSETS);
      const tx = db.transaction("assets", "readwrite");
      tx.objectStore("assets").delete(key);
      db.close();
      return true;
    } catch (_) {
      return false;
    }
  }
  function readFileAsDataUrl(file) {
    return new Promise((resolve2, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve2(reader.result);
      reader.onerror = () => reject(reader.error || new Error("\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25"));
      reader.readAsDataURL(file);
    });
  }

  // src/ui/resources-modal.js
  var isResourcesModalVisible = ref(false);
  var appInstance2 = null;
  var containerEl2 = null;
  function getCandidateDocument3() {
    try {
      if (window.parent && window.parent.document) return window.parent.document;
    } catch (_) {
    }
    try {
      if (window.top && window.top.document) return window.top.document;
    } catch (_) {
    }
    return document;
  }
  function ensureResourcesMounted(targetDoc = null) {
    const doc2 = targetDoc || getCandidateDocument3();
    if (!doc2) return;
    injectResourcesStyles();
    let container = doc2.getElementById("igs-patch-resources-modal-container");
    if (!container) {
      container = doc2.createElement("div");
      container.id = "igs-patch-resources-modal-container";
      (doc2.body || doc2.documentElement).appendChild(container);
    }
    containerEl2 = container;
    if (!appInstance2 || !containerEl2.hasChildNodes()) {
      try {
        if (appInstance2) {
          try {
            appInstance2.unmount();
          } catch (_) {
          }
          appInstance2 = null;
        }
        containerEl2.innerHTML = "";
        const app = createApp(ResourcesModalRoot);
        app.mount(containerEl2);
        appInstance2 = app;
        console.info("[IGS-Patch] \u653E\u6620\u8D44\u6E90\u63A7\u5236\u53F0 Vue 3 \u6302\u8F7D\u6210\u529F\u3002");
      } catch (err) {
        appInstance2 = null;
        console.error("[IGS-Patch] \u6302\u8F7D Vue 3 \u653E\u6620\u8D44\u6E90\u9762\u677F\u5931\u8D25:", err);
      }
    } else if (containerEl2 && !doc2.body.contains(containerEl2)) {
      (doc2.body || doc2.documentElement).appendChild(containerEl2);
    }
  }
  function openResourcesModal(targetDoc = null) {
    console.info("[IGS-Patch] \u6B63\u5728\u547C\u51FA\u653E\u6620\u8D44\u6E90\u63A7\u5236\u53F0...");
    injectResourcesStyles();
    detectAndSyncIgsTheme();
    ensureResourcesMounted(targetDoc);
    isResourcesModalVisible.value = true;
  }
  function closeResourcesModal() {
    isResourcesModalVisible.value = false;
  }
  var ResourcesModalRoot = {
    setup() {
      const visible = isResourcesModalVisible;
      const activeTab = ref("characters");
      const searchQuery = ref("");
      const cgFilter = ref("ready");
      const isLoading = ref(false);
      const currentTheme = ref(patchState.theme || "cream");
      const themeStyleVars = computed2(() => {
        return generateThemeCssVariables(currentTheme.value);
      });
      const handleSetTheme = (themeName) => {
        currentTheme.value = themeName;
        setTheme(themeName);
      };
      const scopeMode = ref("all");
      const activeCardScope = ref("");
      const scopeCounts = reactive({
        all: 0,
        card: 0,
        global: 0
      });
      const characters = ref([]);
      const scenes = ref([]);
      const wardrobe = ref([]);
      const cgs = ref([]);
      const items = ref([]);
      const staging = ref([]);
      const activeCharName = ref("");
      const selectedOutfits = reactive({});
      const lightbox = reactive({
        visible: false,
        title: "",
        src: "",
        prompt: "",
        key: "",
        isFavorite: false,
        isHidden: false,
        isEventCg: false
      });
      const editDialog = reactive({
        visible: false,
        type: "",
        // 'char' | 'outfit' | 'mood' | 'scene' | 'sceneTime' | 'wardrobe' | 'item'
        title: "",
        parentName: "",
        secondaryName: "",
        form: {
          name: "",
          desc: "",
          character: "",
          prompt: "",
          scenesText: "",
          rawUrl: ""
        }
      });
      const genDialog = reactive({
        visible: false,
        type: "",
        // 'mood' | 'cg' | 'scene' | 'item'
        title: "",
        charName: "",
        outfitName: "",
        moodName: "",
        prompt: "",
        negative: "",
        cgItem: null,
        isGenerating: false
      });
      const confirmDialog = reactive({
        visible: false,
        title: "",
        message: "",
        onConfirm: null
      });
      const activeUploadTarget = reactive({
        type: "",
        charName: "",
        outfitName: "",
        moodName: "",
        sceneName: "",
        timeName: "",
        itemName: ""
      });
      const isSidebarCollapsed = ref(false);
      const toggleSidebar = () => {
        isSidebarCollapsed.value = !isSidebarCollapsed.value;
      };
      const loadData = async () => {
        isLoading.value = true;
        try {
          activeCardScope.value = getActiveCardScope();
          const curMode = scopeMode.value;
          const [curChars, curScenes, curWardrobe, curCgs, curItems, curStaging] = await Promise.all([
            listCharacters(curMode),
            listScenes(curMode),
            listWardrobe(curMode),
            listAllCgs(cgFilter.value),
            listItems(curMode),
            listStagingAssets()
          ]);
          characters.value = curChars;
          scenes.value = curScenes;
          wardrobe.value = curWardrobe;
          cgs.value = curCgs;
          items.value = curItems;
          staging.value = curStaging;
          if (curChars.length > 0) {
            if (!activeCharName.value || !curChars.some((c) => c.name === activeCharName.value)) {
              activeCharName.value = curChars[0].name;
            }
          } else {
            activeCharName.value = "";
          }
          for (const c of curChars) {
            if (!selectedOutfits[c.name]) {
              selectedOutfits[c.name] = c.defaultOutfit || c.outfits && c.outfits[0]?.name || "";
            }
          }
          await updateScopeCounts();
        } catch (err) {
          console.warn("[IGS-Patch] \u52A0\u8F7D\u7D20\u6750\u5F02\u5E38:", err);
        } finally {
          isLoading.value = false;
        }
      };
      const updateScopeCounts = async () => {
        const tab = activeTab.value;
        try {
          if (tab === "characters") {
            const [all, card, glob] = await Promise.all([
              listCharacters("all"),
              listCharacters("card"),
              listCharacters("global")
            ]);
            scopeCounts.all = all.length;
            scopeCounts.card = card.length;
            scopeCounts.global = glob.length;
          } else if (tab === "scenes") {
            const [all, card, glob] = await Promise.all([
              listScenes("all"),
              listScenes("card"),
              listScenes("global")
            ]);
            scopeCounts.all = all.length;
            scopeCounts.card = card.length;
            scopeCounts.global = glob.length;
          } else if (tab === "wardrobe") {
            const [all, card, glob] = await Promise.all([
              listWardrobe("all"),
              listWardrobe("card"),
              listWardrobe("global")
            ]);
            scopeCounts.all = all.length;
            scopeCounts.card = card.length;
            scopeCounts.global = glob.length;
          } else if (tab === "items") {
            const [all, card, glob] = await Promise.all([
              listItems("all"),
              listItems("card"),
              listItems("global")
            ]);
            scopeCounts.all = all.length;
            scopeCounts.card = card.length;
            scopeCounts.global = glob.length;
          }
        } catch (_) {
        }
      };
      watch2(activeTab, () => {
        updateScopeCounts();
      });
      const setScope = (mode) => {
        scopeMode.value = mode;
        loadData();
      };
      const activeCharacter = computed2(() => {
        if (!characters.value.length) return null;
        const target = characters.value.find((c) => c.name === activeCharName.value);
        return target || characters.value[0];
      });
      const getCurrentOutfit = (charObj) => {
        if (!charObj || !charObj.outfits || !charObj.outfits.length) return null;
        const targetName = selectedOutfits[charObj.name] || charObj.defaultOutfit;
        const found = charObj.outfits.find((o) => o.name === targetName);
        return found || charObj.outfits[0];
      };
      const filteredCharacters = computed2(() => {
        const q = searchQuery.value.trim().toLowerCase();
        if (!q) return characters.value;
        return characters.value.filter((c) => c.name.toLowerCase().includes(q));
      });
      const filteredScenes = computed2(() => {
        const q = searchQuery.value.trim().toLowerCase();
        if (!q) return scenes.value;
        return scenes.value.filter((s) => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
      });
      const filteredWardrobe = computed2(() => {
        const q = searchQuery.value.trim().toLowerCase();
        if (!q) return wardrobe.value;
        return wardrobe.value.filter((w) => w.name.toLowerCase().includes(q) || w.character.toLowerCase().includes(q) || w.prompt.toLowerCase().includes(q));
      });
      const filteredCgs = computed2(() => {
        const q = searchQuery.value.trim().toLowerCase();
        if (!q) return cgs.value;
        return cgs.value.filter((c) => c.label.toLowerCase().includes(q) || c.prompt.toLowerCase().includes(q));
      });
      const filteredItems = computed2(() => {
        const q = searchQuery.value.trim().toLowerCase();
        if (!q) return items.value;
        return items.value.filter((i) => i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
      });
      const filteredStaging = computed2(() => {
        const q = searchQuery.value.trim().toLowerCase();
        if (!q) return staging.value;
        return staging.value.filter((s) => s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q));
      });
      const openLightbox = (title, src, prompt = "", meta = {}) => {
        if (!src) return;
        lightbox.title = title;
        lightbox.src = src;
        lightbox.prompt = prompt;
        lightbox.key = meta.key || "";
        lightbox.isFavorite = meta.isFavorite === true;
        lightbox.isHidden = meta.isHidden === true;
        lightbox.isEventCg = meta.isEventCg === true;
        lightbox.visible = true;
      };
      const closeLightbox = () => {
        lightbox.visible = false;
      };
      const handleDownloadImage = (src, title) => {
        if (!src) return;
        const a = document.createElement("a");
        a.href = src;
        a.download = `${title || "image"}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        notifyToast("\u5DF2\u5F00\u59CB\u4E0B\u8F7D", "info");
      };
      const handleCopyPrompt = (prompt) => {
        if (!prompt) return;
        navigator.clipboard.writeText(prompt);
        notifyToast("\u63D0\u793A\u8BCD\u5DF2\u590D\u5236", "info");
      };
      const handleSetHeight = (charObj, val) => {
        const num = parseInt(val, 10);
        if (isNaN(num) || num <= 0) return;
        charObj.height = num;
        setCharacterHeight(charObj.name, num, scopeMode.value);
        notifyToast(`\u57FA\u51C6\u9AD8\u5EA6\u5DF2\u8C03\u6574\u4E3A ${num}%`, "info");
      };
      const handleToggleUser = (charObj) => {
        const nextState = !charObj.isUser;
        charObj.isUser = nextState;
        setUserCharacter(charObj.name, nextState, scopeMode.value);
        notifyToast(nextState ? `\u5DF2\u8BBE\u4E3A\u4E3B\u89D2\u8EAB\u4EFD` : `\u5DF2\u53D6\u6D88\u4E3B\u89D2\u8EAB\u4EFD`, "info");
      };
      const triggerDiffUpload = (charObj, outfitObj, moodObj) => {
        activeUploadTarget.type = "mood";
        activeUploadTarget.charName = charObj.name;
        activeUploadTarget.outfitName = outfitObj.name;
        activeUploadTarget.moodName = moodObj.name;
        const input = document.getElementById("igs-patch-file-hidden-input");
        if (input) input.click();
      };
      const triggerItemUpload = (itemObj) => {
        activeUploadTarget.type = "item";
        activeUploadTarget.itemName = itemObj.name;
        const input = document.getElementById("igs-patch-file-hidden-input");
        if (input) input.click();
      };
      const onHiddenFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await readFileAsDataUrl(file);
          if (activeUploadTarget.type === "mood") {
            saveCharacterMood(
              activeUploadTarget.charName,
              activeUploadTarget.moodName,
              dataUrl,
              activeUploadTarget.outfitName,
              scopeMode.value
            );
            notifyToast("\u5DEE\u5206\u56FE\u7247\u5DF2\u66FF\u6362", "info");
            await loadData();
          } else if (activeUploadTarget.type === "item") {
            saveItem(activeUploadTarget.itemName, dataUrl, "", scopeMode.value);
            notifyToast("\u9053\u5177\u56FE\u6807\u5DF2\u66F4\u65B0", "info");
            await loadData();
          }
        } catch (_) {
          notifyToast("\u8BFB\u53D6\u56FE\u7247\u5931\u8D25", "error");
        } finally {
          e.target.value = "";
        }
      };
      const openGenPromptDialog = (type, charObj, outfitObj, targetObj) => {
        genDialog.type = type;
        genDialog.charName = charObj?.name || "";
        genDialog.outfitName = outfitObj?.name || "";
        genDialog.isGenerating = false;
        if (type === "mood") {
          genDialog.moodName = targetObj?.name || "";
          genDialog.title = `${charObj.name} \xB7 ${targetObj.name}`;
          genDialog.prompt = targetObj.prompt || `${charObj.name}, ${outfitObj?.name || ""}, ${targetObj.name}`;
          genDialog.negative = "";
        } else if (type === "cg") {
          genDialog.cgItem = targetObj;
          genDialog.title = targetObj.label || "\u5267\u60C5 CG";
          genDialog.prompt = targetObj.prompt || "";
          genDialog.negative = "";
        }
        genDialog.visible = true;
      };
      const handleExecuteGenerate = async () => {
        if (!genDialog.prompt.trim()) {
          notifyToast("\u63D0\u793A\u8BCD\u4E0D\u80FD\u4E3A\u7A7A", "warning");
          return;
        }
        genDialog.isGenerating = true;
        try {
          const baiBai = window.STBaiBaiImage || window.parent?.STBaiBaiImage || window.top?.STBaiBaiImage;
          if (baiBai && typeof baiBai.generate === "function") {
            notifyToast("\u5DF2\u5411\u751F\u56FE\u7BA1\u7EBF\u63D0\u4EA4\u4EFB\u52A1", "info");
            const reqOptions = {
              prompt: genDialog.prompt.trim(),
              ...genDialog.negative.trim() ? { negative: genDialog.negative.trim() } : {}
            };
            if (genDialog.type === "mood") {
              reqOptions.character = genDialog.charName;
              reqOptions.size = "portrait";
            } else if (genDialog.type === "cg") {
              reqOptions.size = "landscape";
            }
            const result = await baiBai.generate(reqOptions);
            const dataUrl = result && (result.dataUrl || result.url);
            if (dataUrl) {
              if (genDialog.type === "mood") {
                await saveCharacterMood(
                  genDialog.charName,
                  genDialog.moodName,
                  dataUrl,
                  genDialog.outfitName,
                  scopeMode.value
                );
                const detail = {
                  category: "sprite",
                  character: genDialog.charName,
                  emotion: genDialog.moodName,
                  url: dataUrl,
                  updatedAt: Date.now()
                };
                const ev = new CustomEvent("st-baibai-image:generated", { detail });
                window.dispatchEvent(ev);
                try {
                  window.parent?.dispatchEvent(ev);
                } catch (_) {
                }
                try {
                  window.top?.dispatchEvent(ev);
                } catch (_) {
                }
                notifyToast(`\u7ACB\u7ED8\u5DEE\u5206\u300C${genDialog.moodName}\u300D\u51FA\u56FE\u6210\u529F`, "info");
              } else if (genDialog.type === "cg" && genDialog.cgItem) {
                await saveCgDataUrl(genDialog.cgItem.key, dataUrl);
                const floorMatch = String(genDialog.cgItem.label || "").match(/\d+/);
                const floorNum = floorMatch ? parseInt(floorMatch[0], 10) : void 0;
                const detail = {
                  category: "cg",
                  floor: floorNum,
                  title: genDialog.cgItem.label || "\u5267\u60C5CG",
                  url: dataUrl,
                  updatedAt: Date.now()
                };
                const ev = new CustomEvent("st-baibai-image:generated", { detail });
                window.dispatchEvent(ev);
                try {
                  window.parent?.dispatchEvent(ev);
                } catch (_) {
                }
                try {
                  window.top?.dispatchEvent(ev);
                } catch (_) {
                }
                notifyToast(`CG \u56FE\u751F\u6210\u5E76\u843D\u5E93\u6210\u529F`, "info");
              }
            } else {
              notifyToast("\u751F\u56FE\u4EFB\u52A1\u5DF2\u6267\u884C", "info");
            }
            genDialog.visible = false;
            await loadData();
            return;
          }
          navigator.clipboard.writeText(genDialog.prompt.trim());
          notifyToast("\u751F\u56FE\u63D0\u793A\u8BCD\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F", "info");
          genDialog.visible = false;
        } catch (err) {
          console.error("[IGS-Patch] \u751F\u56FE\u5F02\u5E38:", err);
          notifyToast("\u63D0\u4EA4\u751F\u56FE\u5F02\u5E38", "error");
        } finally {
          genDialog.isGenerating = false;
        }
      };
      const handleTopAdd = () => {
        const typeMap = {
          characters: "char",
          scenes: "scene",
          wardrobe: "wardrobe",
          items: "item"
        };
        openAddDialog(typeMap[activeTab.value] || "char", activeCharacter.value);
      };
      const openAddDialog = (type, parent = null, secondary = null) => {
        editDialog.type = type;
        editDialog.parentName = parent?.name || "";
        editDialog.secondaryName = secondary?.name || "";
        editDialog.form = {
          name: "",
          desc: "",
          character: parent?.name || "",
          prompt: "",
          scenesText: "",
          rawUrl: ""
        };
        const titleMap = {
          char: "\u65B0\u589E\u89D2\u8272\u7ACB\u7ED8",
          outfit: `\u65B0\u589E\u670D\u88C5 - ${parent?.name}`,
          mood: `\u65B0\u589E\u8868\u60C5\u5DEE\u5206 - ${parent?.name}`,
          scene: "\u65B0\u589E\u573A\u666F\u80CC\u666F",
          sceneTime: `\u65B0\u589E\u65F6\u6BB5\u5DEE\u5206 - ${parent?.name}`,
          wardrobe: "\u65B0\u589E\u6362\u88C5\u8863\u67DC",
          item: "\u65B0\u589E\u9053\u5177\u56FE\u9274"
        };
        editDialog.title = titleMap[type] || "\u65B0\u589E\u8D44\u6E90";
        editDialog.visible = true;
      };
      const handleSaveEdit = async () => {
        const f = editDialog.form;
        if (!f.name.trim()) {
          notifyToast("\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A", "warning");
          return;
        }
        try {
          if (editDialog.type === "char") {
            saveCharacterMood(f.name.trim(), "\u9ED8\u8BA4", f.rawUrl.trim(), "\u521D\u59CB\u8863\u88C5", scopeMode.value);
            activeCharName.value = f.name.trim();
          } else if (editDialog.type === "outfit") {
            saveCharacterOutfit(editDialog.parentName, f.name.trim(), scopeMode.value);
            selectedOutfits[editDialog.parentName] = f.name.trim();
          } else if (editDialog.type === "mood") {
            const outfit = editDialog.secondaryName || selectedOutfits[editDialog.parentName] || "\u521D\u59CB\u8863\u88C5";
            saveCharacterMood(editDialog.parentName, f.name.trim(), f.rawUrl.trim(), outfit, scopeMode.value);
          } else if (editDialog.type === "scene") {
            saveScene(f.name.trim(), f.rawUrl.trim(), f.desc.trim(), scopeMode.value);
          } else if (editDialog.type === "sceneTime") {
            saveSceneTime(editDialog.parentName, f.name.trim(), f.rawUrl.trim(), scopeMode.value);
          } else if (editDialog.type === "wardrobe") {
            saveWardrobeItem(f.name.trim(), f.rawUrl.trim(), f.prompt.trim(), f.character.trim(), scopeMode.value);
          } else if (editDialog.type === "item") {
            saveItem(f.name.trim(), f.rawUrl.trim(), f.desc.trim(), scopeMode.value);
          }
          notifyToast("\u4FDD\u5B58\u6210\u529F", "info");
          editDialog.visible = false;
          await loadData();
        } catch (err) {
          notifyToast("\u4FDD\u5B58\u5F02\u5E38", "error");
        }
      };
      const handleFormFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await readFileAsDataUrl(file);
          editDialog.form.rawUrl = dataUrl;
          notifyToast("\u56FE\u7247\u8F7D\u5165\u5C31\u7EEA", "info");
        } catch (_) {
          notifyToast("\u8BFB\u53D6\u56FE\u7247\u5931\u8D25", "error");
        }
      };
      const handleCgFavorite = async (cg) => {
        const res = await toggleCgFavorite(cg.key, cg.isFavorite);
        if (res.ok) {
          cg.isFavorite = res.isFavorite;
          if (lightbox.visible && lightbox.key === cg.key) {
            lightbox.isFavorite = res.isFavorite;
          }
          notifyToast(cg.isFavorite ? "\u5DF2\u6536\u85CF" : "\u5DF2\u53D6\u6D88\u6536\u85CF", "info");
        }
      };
      const handleCgHidden = async (cg) => {
        const res = await toggleCgHidden(cg.key, cg.isHidden);
        if (res.ok) {
          cg.isHidden = res.isHidden;
          if (lightbox.visible && lightbox.key === cg.key) {
            lightbox.isHidden = res.isHidden;
          }
          notifyToast(cg.isHidden ? "\u5DF2\u9690\u85CF" : "\u5DF2\u53D6\u6D88\u9690\u85CF", "info");
          if (cgFilter.value === "all" && cg.isHidden) {
            cgs.value = cgs.value.filter((item) => item.key !== cg.key);
          }
        }
      };
      const triggerDelete = (title, message, action) => {
        confirmDialog.title = title;
        confirmDialog.message = message;
        confirmDialog.onConfirm = async () => {
          confirmDialog.visible = false;
          await action();
          await loadData();
          notifyToast("\u5DF2\u5220\u9664", "info");
        };
        confirmDialog.visible = true;
      };
      const handleDeleteCharacter = (charObj) => {
        triggerDelete("\u5220\u9664\u89D2\u8272", `\u786E\u5B9A\u5220\u9664\u89D2\u8272\u300C${charObj.name}\u300D\u53CA\u5176\u5168\u90E8\u8863\u88C5\u5DEE\u5206\u5417\uFF1F`, () => {
          deleteCharacterOutfit(charObj.name, "", scopeMode.value);
        });
      };
      const handleDeleteOutfit = (charObj, outfitObj) => {
        triggerDelete("\u5220\u9664\u670D\u88C5", `\u786E\u5B9A\u5220\u9664\u300C${charObj.name}\u300D\u7684\u300C${outfitObj.name}\u300D\u5417\uFF1F`, () => {
          deleteCharacterOutfit(charObj.name, outfitObj.name, scopeMode.value);
        });
      };
      const handleDeleteMood = (charName, moodName, outfitName) => {
        triggerDelete("\u5220\u9664\u5DEE\u5206", `\u786E\u5B9A\u5220\u9664\u8868\u60C5\u5DEE\u5206\u300C${moodName}\u300D\u5417\uFF1F`, () => {
          deleteCharacterMood(charName, moodName, outfitName, scopeMode.value);
        });
      };
      const handleDeleteScene = (sceneObj) => {
        triggerDelete("\u5220\u9664\u573A\u666F", `\u786E\u5B9A\u5220\u9664\u573A\u666F\u300C${sceneObj.name}\u300D\u53CA\u5168\u90E8\u65F6\u6BB5\u5DEE\u5206\u5417\uFF1F`, () => {
          deleteScene(sceneObj.name, scopeMode.value);
        });
      };
      const handleDeleteSceneTime = (sceneName, timeName) => {
        triggerDelete("\u5220\u9664\u65F6\u6BB5", `\u786E\u5B9A\u5220\u9664\u65F6\u6BB5\u5DEE\u5206\u300C${timeName}\u300D\u5417\uFF1F`, () => {
          deleteSceneTime(sceneName, timeName, scopeMode.value);
        });
      };
      const handleDeleteWardrobe = (item) => {
        triggerDelete("\u5220\u9664\u670D\u88C5", `\u786E\u5B9A\u5220\u9664\u670D\u88C5\u300C${item.name}\u300D\u5417\uFF1F`, () => {
          deleteWardrobeItem(item.name, scopeMode.value);
        });
      };
      const handleDeleteCg = (cg) => {
        triggerDelete("\u5220\u9664CG", `\u786E\u5B9A\u5220\u9664\u6B64\u5F20 CG \u56FE\u5417\uFF1F\u6B64\u64CD\u4F5C\u65E0\u6CD5\u64A4\u9500\u3002`, async () => {
          await deleteCg(cg.key, cg.isEventCg);
          if (lightbox.visible && lightbox.key === cg.key) {
            closeLightbox();
          }
        });
      };
      const handleDeleteItem = (item) => {
        triggerDelete("\u5220\u9664\u9053\u5177", `\u786E\u5B9A\u5220\u9664\u9053\u5177\u300C${item.name}\u300D\u5417\uFF1F`, () => {
          deleteItem(item.name, scopeMode.value);
        });
      };
      const handleAcceptStaging = async (stItem, targetType) => {
        const promptName = window.prompt("\u8BF7\u8F93\u5165\u5165\u5E93\u540D\u79F0\uFF1A", stItem.name || "");
        if (!promptName) return;
        await acceptStagingAsset(stItem, promptName.trim(), targetType);
        await loadData();
        notifyToast("\u5165\u5E93\u6210\u529F", "info");
      };
      const handleDiscardStaging = async (stItem) => {
        await discardStagingAsset(stItem.key);
        staging.value = staging.value.filter((s) => s.key !== stItem.key);
        notifyToast("\u5DF2\u820D\u5F03", "info");
      };
      const setCgFilter = (mode) => {
        cgFilter.value = mode;
        loadData();
      };
      watch2(visible, (isOpen) => {
        if (isOpen) {
          loadData();
        }
      });
      onMounted(() => {
        loadData();
        const unsub = subscribeState((s) => {
          if (s.theme && s.theme !== currentTheme.value) {
            currentTheme.value = s.theme;
          }
        });
        const onKeyDown = (e) => {
          if (e.key === "Escape") {
            if (lightbox.visible) {
              closeLightbox();
            } else if (genDialog.visible) {
              genDialog.visible = false;
            } else if (editDialog.visible) {
              editDialog.visible = false;
            } else if (confirmDialog.visible) {
              confirmDialog.visible = false;
            } else if (visible.value) {
              closeResourcesModal();
            }
          }
        };
        window.addEventListener("keydown", onKeyDown);
        const onSettingsUpdated = () => {
          loadData();
        };
        window.addEventListener("igs:legacy-settings-updated", onSettingsUpdated);
        const onStorageChange = (e) => {
          if (e.key === "igs_bridge_config") onSettingsUpdated();
        };
        window.addEventListener("storage", onStorageChange);
        onUnmounted(() => {
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("igs:legacy-settings-updated", onSettingsUpdated);
          window.removeEventListener("storage", onStorageChange);
          unsub();
        });
      });
      return {
        visible,
        activeTab,
        searchQuery,
        cgFilter,
        isLoading,
        scopeMode,
        scopeCounts,
        activeCardScope,
        activeCharName,
        activeCharacter,
        selectedOutfits,
        currentTheme,
        themeOptions: THEME_OPTIONS,
        themeStyleVars,
        handleSetTheme,
        characters,
        scenes,
        wardrobe,
        cgs,
        items,
        staging,
        filteredCharacters,
        filteredScenes,
        filteredWardrobe,
        filteredCgs,
        filteredItems,
        filteredStaging,
        lightbox,
        openLightbox,
        closeLightbox,
        handleDownloadImage,
        handleCopyPrompt,
        handleSetHeight,
        handleToggleUser,
        getCurrentOutfit,
        triggerDiffUpload,
        triggerItemUpload,
        onHiddenFileChange,
        handleTopAdd,
        editDialog,
        openAddDialog,
        handleSaveEdit,
        handleFormFileUpload,
        genDialog,
        openGenPromptDialog,
        handleExecuteGenerate,
        confirmDialog,
        handleCgFavorite,
        handleCgHidden,
        handleDeleteCharacter,
        handleDeleteOutfit,
        handleDeleteMood,
        handleDeleteScene,
        handleDeleteSceneTime,
        handleDeleteWardrobe,
        handleDeleteCg,
        handleDeleteItem,
        handleAcceptStaging,
        handleDiscardStaging,
        setScope,
        setCgFilter,
        isSidebarCollapsed,
        toggleSidebar,
        loadData,
        close: closeResourcesModal
      };
    },
    template: `
    <div v-if="visible" class="igs-resources-overlay" :style="themeStyleVars" @click.self="close">
      <div class="igs-resources-window">
        <!-- \u5DE6\u4FA7\u7CBE\u70BC\u4FA7\u8FB9\u680F (\u6781\u7B80\u67B6\u6784\uFF0C\u5F7B\u5E95\u89E3\u653E\u4E3B\u89C6\u53E3\u7A7A\u95F4) -->
        <aside class="igs-resources-sidebar" :class="{ 'is-collapsed': isSidebarCollapsed }">
          <div class="igs-sidebar-brand">
            <div class="igs-sidebar-brand-left">
              <i class="fa-solid fa-photo-film igs-sidebar-brand-icon"></i>
              <h2 v-if="!isSidebarCollapsed" class="igs-sidebar-brand-title">\u653E\u6620\u8D44\u6E90</h2>
            </div>
            <button 
              class="igs-sidebar-collapse-btn" 
              :title="isSidebarCollapsed ? '\u5C55\u5F00\u4FA7\u680F' : '\u6298\u53E0\u4FA7\u680F'" 
              @click="toggleSidebar"
            >
              <i class="fa-solid" :class="isSidebarCollapsed ? 'fa-angles-right' : 'fa-angles-left'"></i>
            </button>
          </div>

          <!-- \u5782\u76F4\u5BFC\u822A\u9009\u9879\u5361 -->
          <div class="igs-sidebar-nav">
            <button 
              class="igs-sidebar-nav-btn" 
              :class="{ 'is-active': activeTab === 'characters' }" 
              @click="activeTab = 'characters'"
            >
              <i class="fa-solid fa-person"></i>
              <span>\u7ACB\u7ED8</span>
              <span class="igs-sidebar-badge">{{ characters.length }}</span>
            </button>

            <button 
              class="igs-sidebar-nav-btn" 
              :class="{ 'is-active': activeTab === 'scenes' }" 
              @click="activeTab = 'scenes'"
            >
              <i class="fa-solid fa-image"></i>
              <span>\u80CC\u666F</span>
              <span class="igs-sidebar-badge">{{ scenes.length }}</span>
            </button>

            <button 
              class="igs-sidebar-nav-btn" 
              :class="{ 'is-active': activeTab === 'wardrobe' }" 
              @click="activeTab = 'wardrobe'"
            >
              <i class="fa-solid fa-shirt"></i>
              <span>\u8863\u67DC</span>
              <span class="igs-sidebar-badge">{{ wardrobe.length }}</span>
            </button>

            <button 
              class="igs-sidebar-nav-btn" 
              :class="{ 'is-active': activeTab === 'cgs' }" 
              @click="activeTab = 'cgs'"
            >
              <i class="fa-solid fa-film"></i>
              <span>CG</span>
              <span class="igs-sidebar-badge">{{ cgs.length }}</span>
            </button>

            <button 
              class="igs-sidebar-nav-btn" 
              :class="{ 'is-active': activeTab === 'items' }" 
              @click="activeTab = 'items'"
            >
              <i class="fa-solid fa-cube"></i>
              <span>\u9053\u5177</span>
              <span class="igs-sidebar-badge">{{ items.length }}</span>
            </button>

            <button 
              class="igs-sidebar-nav-btn" 
              :class="{ 'is-active': activeTab === 'review' }" 
              @click="activeTab = 'review'"
            >
              <i class="fa-solid fa-inbox"></i>
              <span>\u5F85\u786E\u8BA4</span>
              <span v-if="staging.length" class="igs-sidebar-badge" style="background: var(--igs-settings-accent); color: #111;">{{ staging.length }}</span>
            </button>
          </div>

          <!-- \u4FA7\u8FB9\u680F\u5E95\u90E8\u64CD\u4F5C\u533A\uFF1A\u4E3B\u9898\u5207\u6362\u5706\u5708\u4E0E\u5237\u65B0 (\u72EC\u7ACB\u7AD6\u6761\u89C4\u8303) -->
          <div class="igs-sidebar-footer">
            <div class="igs-resources-theme-group">
              <button 
                v-for="item in themeOptions" 
                :key="item.value" 
                class="igs-resources-theme-swatch"
                :class="['theme-' + item.value, { 'is-active': currentTheme === item.value }]"
                :title="item.label"
                :style="{ backgroundColor: item.swatch.accent, borderColor: item.swatch.base }"
                @click="handleSetTheme(item.value)"
              ></button>
            </div>

            <button class="igs-btn-icon-round" title="\u5237\u65B0\u5217\u8868" @click="loadData">
              <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': isLoading }"></i>
            </button>
          </div>
        </aside>

        <!-- \u53F3\u4FA7\u5168\u666F\u4E3B\u89C6\u53E3 (Main Body) -->
        <div class="igs-resources-main">
          <!-- \u6781\u7B80\u5355\u884C\u9876\u680F (Search + Scope + Actions) -->
          <header class="igs-main-topbar">
            <!-- \u7D27\u51D1\u641C\u7D22\u6846 -->
            <div class="igs-topbar-search-box">
              <i class="fa-solid fa-magnifying-glass" style="color: var(--igs-settings-ink-3); font-size: 11px;"></i>
              <input 
                v-model="searchQuery" 
                class="igs-topbar-search-input" 
                placeholder="\u641C\u7D22\u8D44\u6E90..." 
              />
              <i v-if="searchQuery" class="fa-solid fa-xmark" style="font-size: 11px; cursor: pointer;" @click="searchQuery = ''"></i>
            </div>

            <!-- \u4F5C\u7528\u57DF\u5206\u6BB5\u836F\u4E38 (\u5168\u90E8 / \u672C\u5361 / \u5168\u5C40) -->
            <div v-if="activeTab !== 'cgs' && activeTab !== 'review'" class="igs-scope-segmented">
              <button class="igs-scope-seg-opt" :class="{ 'is-active': scopeMode === 'all' }" @click="setScope('all')">
                <span>\u5168\u90E8</span>
                <span style="opacity: 0.75; font-size: 10px;">{{ scopeCounts.all }}</span>
              </button>
              <button class="igs-scope-seg-opt" :class="{ 'is-active': scopeMode === 'card' }" @click="setScope('card')">
                <span>\u672C\u5361</span>
                <span style="opacity: 0.75; font-size: 10px;">{{ scopeCounts.card }}</span>
              </button>
              <button class="igs-scope-seg-opt" :class="{ 'is-active': scopeMode === 'global' }" @click="setScope('global')">
                <span>\u5168\u5C40</span>
                <span style="opacity: 0.75; font-size: 10px;">{{ scopeCounts.global }}</span>
              </button>
            </div>

            <!-- \u9876\u680F\u53F3\u4FA7\u5FEB\u6377\u52A8\u4F5C -->
            <div class="igs-topbar-actions">
              <button 
                class="igs-btn-icon-round" 
                :title="isSidebarCollapsed ? '\u5C55\u5F00\u4FA7\u680F' : '\u6298\u53E0\u4FA7\u680F'" 
                @click="toggleSidebar"
              >
                <i class="fa-solid" :class="isSidebarCollapsed ? 'fa-bars' : 'fa-angles-left'"></i>
              </button>

              <button 
                v-if="activeTab !== 'cgs' && activeTab !== 'review'" 
                class="igs-btn-primary-compact" 
                @click="handleTopAdd"
              >
                <i class="fa-solid fa-plus"></i>
                <span>\u65B0\u589E</span>
              </button>

              <button class="igs-btn-icon-round" title="\u5173\u95ED" @click="close">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </header>

        <!-- \u7ACB\u7ED8\u6A21\u5F0F\uFF1A\u6574\u5408\u89D2\u8272\u6A2A\u5411\u680F\u4E0E\u5C5E\u6027\u5DE5\u5177 -->
        <div v-if="activeTab === 'characters' && filteredCharacters.length" class="igs-char-unified-bar">
          <div class="igs-char-pills-list">
            <button 
              v-for="c in filteredCharacters" 
              :key="c.name" 
              class="igs-char-pill-btn" 
              :class="{ 'is-active': activeCharName === c.name }"
              @click="activeCharName = c.name"
            >
              <img v-if="c.baseResolvedUrl || c.baseRawUrl" :src="c.baseResolvedUrl || c.baseRawUrl" class="igs-char-tab-avatar" />
              <i v-else class="fa-solid fa-user" style="font-size: 10px;"></i>
              <span>{{ c.name }}</span>
            </button>

            <button class="igs-char-add-tab-btn" @click="openAddDialog('char')">
              <i class="fa-solid fa-plus"></i>
              <span>\u89D2\u8272</span>
            </button>
          </div>

          <!-- \u89D2\u8272\u53F3\u4FA7\u5143\u6570\u636E\u5DE5\u5177\uFF1AUser\u8EAB\u4EFD\u5207\u6362\u3001\u9AD8\u5EA6\u8C03\u6574\u3001\u5220\u9664 -->
          <div v-if="activeCharacter" class="igs-char-meta-tools">
            <span 
              class="igs-char-user-badge" 
              :style="{ opacity: activeCharacter.isUser ? 1 : 0.4 }"
              title="\u70B9\u51FB\u5207\u6362\u4E3B\u89D2\u8EAB\u4EFD"
              @click="handleToggleUser(activeCharacter)"
            >User</span>

            <div class="igs-char-compact-height">
              <span>\u9AD8\u5EA6</span>
              <input 
                type="number" 
                :value="activeCharacter.height || 100" 
                @change="e => handleSetHeight(activeCharacter, e.target.value)" 
              />
              <span>%</span>
            </div>

            <button class="igs-diff-act-btn" style="width: 24px; height: 24px; font-size: 11px;" title="\u5220\u9664\u89D2\u8272" @click="handleDeleteCharacter(activeCharacter)">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>

        <!-- \u7ACB\u7ED8\u6A21\u5F0F\uFF1A\u670D\u88C5\u6A2A\u5411\u5207\u6362\u680F -->
        <div v-if="activeTab === 'characters' && activeCharacter" class="igs-outfits-unified-bar">
          <div style="display: flex; align-items: center; gap: 6px; overflow-x: auto; flex: 1; scrollbar-width: none;">
            <button 
              v-for="outfit in activeCharacter.outfits" 
              :key="outfit.name" 
              class="igs-outfit-tab-btn" 
              :class="{ 'is-active': (selectedOutfits[activeCharacter.name] || activeCharacter.defaultOutfit || activeCharacter.outfits[0]?.name) === outfit.name }"
              @click="selectedOutfits[activeCharacter.name] = outfit.name"
            >
              <span>{{ outfit.name }}</span>
              <span v-if="outfit.isDefault" class="igs-outfit-default-tag">\u9ED8\u8BA4</span>
              <span style="opacity: 0.65; font-size: 11px;">{{ outfit.moodCount }}</span>
            </button>
          </div>

          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <button class="igs-outfit-action-btn" title="\u65B0\u589E\u670D\u88C5" @click="openAddDialog('outfit', activeCharacter)">
              <i class="fa-solid fa-plus"></i>
              <span>\u670D\u88C5</span>
            </button>
            <button class="igs-outfit-action-btn" title="\u65B0\u589E\u5DEE\u5206" @click="openAddDialog('mood', activeCharacter, getCurrentOutfit(activeCharacter))">
              <i class="fa-solid fa-plus"></i>
              <span>\u5DEE\u5206</span>
            </button>
          </div>
        </div>

        <!-- \u4E3B\u5185\u5BB9\u5168\u5C4F\u7F51\u683C\u89C6\u53E3 (\u91CA\u653E 75% \u5782\u76F4\u7A7A\u95F4) -->
        <main class="igs-resources-content">
          <!-- 1. \u7ACB\u7ED8\u5DEE\u5206\u591A\u5217\u7F51\u683C (\u5927\u56FE\u4F18\u5148) -->
          <section v-if="activeTab === 'characters'">
            <div v-if="activeCharacter && getCurrentOutfit(activeCharacter) && getCurrentOutfit(activeCharacter).moods && getCurrentOutfit(activeCharacter).moods.length" class="igs-char-diffs-grid">
              <div v-for="m in getCurrentOutfit(activeCharacter).moods" :key="m.name" class="igs-diff-card">
                <div class="igs-diff-card-thumb" @click="openLightbox(activeCharacter.name + ' \xB7 ' + m.name, m.resolvedUrl || m.rawUrl)">
                  <img v-if="m.resolvedUrl || m.rawUrl" :src="m.resolvedUrl || m.rawUrl" class="igs-diff-card-img" />
                  <div v-else class="igs-resource-empty-thumb">
                    <i class="fa-solid fa-image fa-2x"></i>
                  </div>
                </div>

                <div class="igs-diff-card-info">
                  <div class="igs-diff-card-name" :title="m.name">{{ m.name }}</div>
                  <div class="igs-diff-card-acts">
                    <button class="igs-diff-act-btn" title="\u751F\u56FE" @click="openGenPromptDialog('mood', activeCharacter, getCurrentOutfit(activeCharacter), m)">
                      <i class="fa-solid fa-rotate"></i>
                    </button>
                    <button class="igs-diff-act-btn" title="\u4E0B\u8F7D" @click="handleDownloadImage(m.resolvedUrl || m.rawUrl, activeCharacter.name + '_' + m.name)">
                      <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="igs-diff-act-btn" title="\u4E0A\u4F20\u66FF\u6362" @click="triggerDiffUpload(activeCharacter, getCurrentOutfit(activeCharacter), m)">
                      <i class="fa-solid fa-upload"></i>
                    </button>
                    <button class="igs-diff-act-btn" title="\u5220\u9664" @click="handleDeleteMood(activeCharacter.name, m.name, getCurrentOutfit(activeCharacter).name)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-folder-open fa-3x" style="margin-bottom: 12px;"></i>
              <p>\u5F53\u524D\u670D\u88C5\u6682\u65E0\u8868\u60C5\u5DEE\u5206\uFF0C\u70B9\u51FB\u4E0A\u65B9\u300C+\u5DEE\u5206\u300D\u5373\u53EF\u6DFB\u52A0</p>
            </div>
          </section>

          <!-- 2. \u80CC\u666F\u573A\u666F\u677F\u5757 -->
          <section v-if="activeTab === 'scenes'">
            <div v-if="filteredScenes.length" class="igs-resources-grid">
              <div v-for="s in filteredScenes" :key="s.name" class="igs-resource-card">
                <div class="igs-resource-thumb-box is-landscape" @click="openLightbox(s.name, s.baseResolvedUrl || s.baseRawUrl, s.desc)">
                  <img v-if="s.baseResolvedUrl || s.baseRawUrl" :src="s.baseResolvedUrl || s.baseRawUrl" class="igs-resource-img" />
                  <div v-else class="igs-resource-empty-thumb">
                    <i class="fa-solid fa-image fa-2x"></i>
                    <span>\u6682\u65E0\u80CC\u666F</span>
                  </div>

                  <div class="igs-resource-card-overlay-actions" @click.stop>
                    <button class="igs-icon-tag-btn" title="\u65B0\u589E\u65F6\u6BB5\u5DEE\u5206" @click="openAddDialog('sceneTime', s)">
                      <i class="fa-solid fa-plus"></i>
                    </button>
                    <button class="igs-icon-tag-btn" title="\u5220\u9664\u573A\u666F" @click="handleDeleteScene(s)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="igs-resource-info">
                  <div class="igs-resource-name-row">
                    <span class="igs-resource-name">{{ s.name }}</span>
                    <span class="igs-resource-desc">{{ s.timeCount }} \u65F6\u6BB5</span>
                  </div>
                  <div v-if="s.desc" class="igs-resource-desc">{{ s.desc }}</div>

                  <div v-if="s.times && s.times.length" class="igs-resource-diff-row">
                    <span 
                      v-for="t in s.times" 
                      :key="t.name" 
                      class="igs-resource-diff-tag"
                      :title="t.name"
                      @click="openLightbox(s.name + ' \xB7 ' + t.name, t.resolvedUrl || t.rawUrl)"
                    >
                      <span>{{ t.name }}</span>
                      <i class="fa-solid fa-xmark" style="font-size: 10px;" title="\u5220\u9664\u6B64\u65F6\u6BB5" @click.stop="handleDeleteSceneTime(s.name, t.name)"></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-folder-open fa-3x" style="margin-bottom: 12px;"></i>
              <p>\u6682\u65E0\u573A\u666F\u80CC\u666F\uFF0C\u70B9\u51FB\u53F3\u4E0A\u89D2\u300C\u65B0\u589E\u300D\u5373\u53EF\u6DFB\u52A0</p>
            </div>
          </section>

          <!-- 3. \u6362\u88C5\u8863\u67DC\u677F\u5757 -->
          <section v-if="activeTab === 'wardrobe'">
            <div v-if="filteredWardrobe.length" class="igs-resources-grid">
              <div v-for="w in filteredWardrobe" :key="w.name" class="igs-resource-card">
                <div class="igs-resource-thumb-box" @click="openLightbox(w.name, w.resolvedUrl || w.rawUrl, w.prompt)">
                  <img v-if="w.resolvedUrl || w.rawUrl" :src="w.resolvedUrl || w.rawUrl" class="igs-resource-img" />
                  <div v-else class="igs-resource-empty-thumb">
                    <i class="fa-solid fa-shirt fa-2x"></i>
                    <span>\u53C2\u8003\u56FE\u4E3A\u7A7A</span>
                  </div>

                  <div class="igs-resource-card-overlay-actions" @click.stop>
                    <button class="igs-icon-tag-btn" title="\u5220\u9664\u670D\u88C5" @click="handleDeleteWardrobe(w)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="igs-resource-info">
                  <div class="igs-resource-name-row">
                    <span class="igs-resource-name">{{ w.name }}</span>
                    <span v-if="w.character" class="igs-resources-chip" style="padding: 2px 8px; font-size: 11px;">{{ w.character }}</span>
                  </div>
                  <div v-if="w.prompt" class="igs-resource-desc" :title="w.prompt">{{ w.prompt }}</div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-folder-open fa-3x" style="margin-bottom: 12px;"></i>
              <p>\u6682\u65E0\u8863\u67DC\u670D\u88C5\uFF0C\u70B9\u51FB\u53F3\u4E0A\u89D2\u300C\u65B0\u589E\u300D\u5373\u53EF\u6DFB\u52A0</p>
            </div>
          </section>

          <!-- 4. CG \u753B\u5ECA\u677F\u5757 -->
          <section v-if="activeTab === 'cgs'">
            <div class="igs-resources-subbar">
              <div class="igs-resources-filter-chips">
                <button class="igs-resources-chip" :class="{ 'is-active': cgFilter === 'ready' }" @click="setCgFilter('ready')">\u5DF2\u751F\u6210</button>
                <button class="igs-resources-chip" :class="{ 'is-active': cgFilter === 'pending' }" @click="setCgFilter('pending')">\u5F85\u751F\u6210</button>
                <button class="igs-resources-chip" :class="{ 'is-active': cgFilter === 'favorites' }" @click="setCgFilter('favorites')">\u6536\u85CF</button>
                <button class="igs-resources-chip" :class="{ 'is-active': cgFilter === 'hidden' }" @click="setCgFilter('hidden')">\u5DF2\u9690\u85CF</button>
              </div>
              <div style="font-size: 0.8rem; color: var(--igs-settings-ink-3);">
                \u5171 {{ filteredCgs.length }} \u5F20 CG
              </div>
            </div>

            <div v-if="filteredCgs.length" class="igs-resources-grid">
              <div v-for="cg in filteredCgs" :key="cg.key" class="igs-resource-card">
                <div class="igs-resource-thumb-box is-landscape" @click="!cg.isPending && openLightbox(cg.label, cg.resolvedUrl || cg.rawUrl, cg.prompt, cg)">
                  <img v-if="!cg.isPending && (cg.resolvedUrl || cg.rawUrl)" :src="cg.resolvedUrl || cg.rawUrl" class="igs-resource-img" />
                  
                  <div v-else class="igs-cg-pending-container">
                    <span class="igs-cg-badge-pending">\u5F85\u751F\u6210</span>
                    <i class="fa-solid fa-wand-magic-sparkles fa-2x" style="color: var(--igs-settings-accent); margin-bottom: 4px;"></i>
                    <button class="igs-cg-btn-generate" @click.stop="openGenPromptDialog('cg', null, null, cg)">
                      <i class="fa-solid fa-wand-magic-sparkles"></i>
                      <span>\u751F\u56FE</span>
                    </button>
                  </div>

                  <div v-if="!cg.isPending" class="igs-resource-card-overlay-actions" @click.stop>
                    <button 
                      class="igs-icon-tag-btn" 
                      :class="{ 'is-active': cg.isFavorite }" 
                      :title="cg.isFavorite ? '\u53D6\u6D88\u6536\u85CF' : '\u6536\u85CF'"
                      @click="handleCgFavorite(cg)"
                    >
                      <i class="fa-solid fa-star"></i>
                    </button>
                    <button 
                      class="igs-icon-tag-btn" 
                      :class="{ 'is-active': cg.isHidden }" 
                      :title="cg.isHidden ? '\u53D6\u6D88\u9690\u85CF' : '\u9690\u85CF'"
                      @click="handleCgHidden(cg)"
                    >
                      <i class="fa-solid" :class="cg.isHidden ? 'fa-eye-slash' : 'fa-eye'"></i>
                    </button>
                    <button class="igs-icon-tag-btn" title="\u4E0B\u8F7D" @click="handleDownloadImage(cg.resolvedUrl || cg.rawUrl, cg.label)">
                      <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="igs-icon-tag-btn" title="\u5220\u9664" @click="handleDeleteCg(cg)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="igs-resource-info">
                  <div class="igs-resource-name-row">
                    <span class="igs-resource-name">{{ cg.label }}</span>
                    <i v-if="cg.isFavorite" class="fa-solid fa-star" style="color: #ffd166; font-size: 12px;"></i>
                  </div>
                  <div v-if="cg.prompt" class="igs-resource-desc" :title="cg.prompt">{{ cg.prompt }}</div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-photo-film fa-3x" style="margin-bottom: 12px;"></i>
              <p>{{ cgFilter === 'ready' ? '\u8FD8\u6CA1\u6709\u751F\u6210\u8FC7CG' : '\u6682\u65E0\u7B26\u5408\u7B5B\u9009\u7684\u5267\u60C5 CG' }}</p>
            </div>
          </section>

          <!-- 5. \u9053\u5177\u56FE\u9274\u677F\u5757 (\u5168\u9762\u652F\u6301\u4E0E\u5448\u73B0) -->
          <section v-if="activeTab === 'items'">
            <div v-if="filteredItems.length" class="igs-resources-grid">
              <div v-for="it in filteredItems" :key="it.name" class="igs-resource-card">
                <div class="igs-resource-thumb-box is-square" @click="openLightbox(it.name, it.resolvedUrl || it.rawUrl, it.desc)">
                  <img v-if="it.resolvedUrl || it.rawUrl" :src="it.resolvedUrl || it.rawUrl" class="igs-resource-img" />
                  <div v-else class="igs-resource-empty-thumb">
                    <i class="fa-solid fa-cube fa-2x"></i>
                    <span>\u6682\u65E0\u56FE\u6807</span>
                  </div>

                  <div class="igs-resource-card-overlay-actions" @click.stop>
                    <button class="igs-icon-tag-btn" title="\u4E0A\u4F20\u56FE\u6807" @click="triggerItemUpload(it)">
                      <i class="fa-solid fa-upload"></i>
                    </button>
                    <button class="igs-icon-tag-btn" title="\u5220\u9664\u9053\u5177" @click="handleDeleteItem(it)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="igs-resource-info">
                  <div class="igs-resource-name-row">
                    <span class="igs-resource-name">{{ it.name }}</span>
                  </div>
                  <div v-if="it.desc" class="igs-resource-desc">{{ it.desc }}</div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-cubes fa-3x" style="margin-bottom: 12px;"></i>
              <p>\u6682\u65E0\u7269\u54C1\u9053\u5177\u56FE\u9274\uFF0C\u70B9\u51FB\u4E0B\u65B9\u6216\u53F3\u4E0A\u89D2\u300C\u65B0\u589E\u300D\u5373\u53EF\u6DFB\u52A0</p>
              <button class="igs-btn-primary-compact" style="margin: 12px auto 0;" @click="openAddDialog('item')">
                <i class="fa-solid fa-plus"></i>
                <span>\u65B0\u589E\u9053\u5177</span>
              </button>
            </div>
          </section>

          <!-- 6. \u5F85\u786E\u8BA4\u6682\u5B58\u6C60 -->
          <section v-if="activeTab === 'review'">
            <div v-if="filteredStaging.length" class="igs-resources-grid">
              <div v-for="st in filteredStaging" :key="st.key" class="igs-resource-card">
                <div class="igs-resource-thumb-box" @click="openLightbox(st.name, st.resolvedUrl || st.rawUrl)">
                  <img v-if="st.resolvedUrl || st.rawUrl" :src="st.resolvedUrl || st.rawUrl" class="igs-resource-img" />
                  <div v-else class="igs-resource-empty-thumb">
                    <i class="fa-solid fa-clock-rotate-left fa-2x"></i>
                    <span>\u5F85\u786E\u8BA4\u7D20\u6750</span>
                  </div>

                  <div class="igs-resource-card-overlay-actions" @click.stop>
                    <button class="igs-icon-tag-btn" title="\u820D\u5F03" @click="handleDiscardStaging(st)">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>

                <div class="igs-resource-info">
                  <div class="igs-resource-name-row">
                    <span class="igs-resource-name">{{ st.name }}</span>
                    <span class="igs-resources-chip" style="padding: 2px 8px; font-size: 11px;">{{ st.type }}</span>
                  </div>

                  <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <button class="igs-btn-primary-compact" style="flex: 1; justify-content: center;" @click="handleAcceptStaging(st, 'characters')">
                      \u5165\u5E93\u7ACB\u7ED8
                    </button>
                    <button class="igs-btn-primary-compact" style="flex: 1; justify-content: center;" @click="handleAcceptStaging(st, 'scenes')">
                      \u5165\u5E93\u80CC\u666F
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-else style="text-align: center; padding: 60px; color: var(--igs-settings-ink-3);">
              <i class="fa-solid fa-inbox fa-3x" style="margin-bottom: 12px;"></i>
              <p>\u6682\u65E0\u5F85\u786E\u8BA4\u7D20\u6750</p>
            </div>
          </section>
        </main>
      </div>
    </div>

      <!-- \u9690\u85CF\u7684\u901A\u7528\u56FE\u7247\u9009\u62E9\u5668 -->
      <input 
        id="igs-patch-file-hidden-input" 
        type="file" 
        accept="image/*" 
        style="display: none;" 
        @change="onHiddenFileChange" 
      />

      <!-- \u5168\u5C4F Lightbox \u5927\u56FE\u9884\u89C8 -->
      <div v-if="lightbox.visible" class="igs-lightbox-overlay" :style="themeStyleVars" @click.self="closeLightbox">
        <header class="igs-lightbox-topbar">
          <span class="igs-lightbox-title">{{ lightbox.title }}</span>
          <div class="igs-lightbox-top-actions">
            <button 
              v-if="lightbox.key && !lightbox.isEventCg" 
              class="igs-btn-icon-round" 
              :title="lightbox.isFavorite ? '\u53D6\u6D88\u6536\u85CF' : '\u6536\u85CF'"
              @click="handleCgFavorite(lightbox)"
            >
              <i class="fa-solid fa-star" :style="{ color: lightbox.isFavorite ? '#ffd166' : '#fff' }"></i>
            </button>
            <button 
              v-if="lightbox.prompt" 
              class="igs-btn-icon-round" 
              title="\u590D\u5236\u63D0\u793A\u8BCD" 
              @click="handleCopyPrompt(lightbox.prompt)"
            >
              <i class="fa-solid fa-copy"></i>
            </button>
            <button 
              class="igs-btn-icon-round" 
              title="\u4E0B\u8F7D\u539F\u56FE" 
              @click="handleDownloadImage(lightbox.src, lightbox.title)"
            >
              <i class="fa-solid fa-download"></i>
            </button>
            <button class="igs-btn-icon-round" title="\u5173\u95ED" @click="closeLightbox">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        <main class="igs-lightbox-main" @click.self="closeLightbox">
          <img :src="lightbox.src" class="igs-lightbox-img" @click.stop />
        </main>

        <footer v-if="lightbox.prompt" class="igs-lightbox-bottombar">
          <span>{{ lightbox.prompt }}</span>
        </footer>
      </div>

      <!-- \u751F\u56FE\u4E0E\u63D0\u793A\u8BCD\u786E\u8BA4\u5BF9\u8BDD\u6846 -->
      <div v-if="genDialog.visible" class="igs-dialog-overlay" :style="themeStyleVars" @click.self="genDialog.visible = false">
        <div class="igs-dialog-box">
          <h3 class="igs-dialog-title">\u751F\u56FE\u4E0E\u63D0\u793A\u8BCD \xB7 {{ genDialog.title }}</h3>
          
          <div class="igs-form-row">
            <label class="igs-form-label">\u751F\u56FE\u63D0\u793A\u8BCD</label>
            <textarea 
              v-model="genDialog.prompt" 
              class="igs-form-textarea" 
              :style="{ backgroundColor: 'var(--igs-settings-field, #ebe2d5)', color: 'var(--igs-settings-ink, #514638)' }"
              placeholder="\u8F93\u5165\u6216\u8C03\u6574\u8BE5\u7D20\u6750\u7684\u751F\u6210\u63D0\u793A\u8BCD..."
            ></textarea>
          </div>

          <div class="igs-form-row">
            <label class="igs-form-label">\u8D1F\u9762\u63D0\u793A\u8BCD</label>
            <input 
              v-model="genDialog.negative" 
              class="igs-form-input" 
              placeholder="\u53EF\u9009 \u8D1F\u9762\u63D0\u793A\u8BCD" 
            />
          </div>

          <div class="igs-dialog-actions">
            <button class="igs-resources-chip" @click="genDialog.visible = false">\u53D6\u6D88</button>
            <button 
              class="igs-btn-primary-compact" 
              :disabled="genDialog.isGenerating"
              @click="handleExecuteGenerate"
            >
              <i class="fa-solid fa-wand-magic-sparkles" :class="{ 'fa-spin': genDialog.isGenerating }"></i>
              <span>\u786E\u8BA4\u751F\u56FE</span>
            </button>
          </div>
        </div>
      </div>

      <!-- \u7EDF\u4E00\u65B0\u589E/\u7F16\u8F91\u5BF9\u8BDD\u6846 -->
      <div v-if="editDialog.visible" class="igs-dialog-overlay" :style="themeStyleVars" @click.self="editDialog.visible = false">
        <div class="igs-dialog-box">
          <h3 class="igs-dialog-title">{{ editDialog.title }}</h3>

          <div class="igs-form-row">
            <label class="igs-form-label">\u540D\u79F0</label>
            <input v-model="editDialog.form.name" class="igs-form-input" placeholder="\u8F93\u5165\u540D\u79F0..." />
          </div>

          <div v-if="editDialog.type === 'scene' || editDialog.type === 'item'" class="igs-form-row">
            <label class="igs-form-label">\u63CF\u8FF0</label>
            <input v-model="editDialog.form.desc" class="igs-form-input" placeholder="\u7B80\u77ED\u63CF\u8FF0..." />
          </div>

          <div v-if="editDialog.type === 'wardrobe'" class="igs-form-row">
            <label class="igs-form-label">\u5F52\u5C5E\u89D2\u8272</label>
            <input v-model="editDialog.form.character" class="igs-form-input" placeholder="\u89D2\u8272\u540D\u79F0..." />
          </div>

          <div v-if="editDialog.type === 'wardrobe'" class="igs-form-row">
            <label class="igs-form-label">\u670D\u88C5\u63D0\u793A\u8BCD</label>
            <textarea 
              v-model="editDialog.form.prompt" 
              class="igs-form-textarea" 
              :style="{ backgroundColor: 'var(--igs-settings-field, #ebe2d5)', color: 'var(--igs-settings-ink, #514638)' }"
              placeholder="\u8F93\u5165\u751F\u6210\u8BE5\u670D\u88C5\u7684\u4E13\u7528 TAG \u63D0\u793A\u8BCD..."
            ></textarea>
          </div>

          <div v-if="editDialog.type !== 'outfit'" class="igs-form-row">
            <label class="igs-form-label">\u56FE\u7247\u7D20\u6750</label>
            <div class="igs-file-dropzone" @click="$refs.editFileInput.click()">
              <i class="fa-solid fa-cloud-arrow-up fa-2x"></i>
              <span>\u70B9\u51FB\u4E0A\u4F20\u672C\u5730\u56FE\u7247\u6587\u4EF6</span>
              <input ref="editFileInput" type="file" accept="image/*" style="display:none;" @change="handleFormFileUpload" />
            </div>
            <input v-model="editDialog.form.rawUrl" class="igs-form-input" style="margin-top: 6px;" placeholder="\u6216\u76F4\u63A5\u8F93\u5165\u56FE\u7247 URL / igs-gen \u6807\u8BC6\u7B26..." />
          </div>

          <div class="igs-dialog-actions">
            <button class="igs-resources-chip" @click="editDialog.visible = false">\u53D6\u6D88</button>
            <button class="igs-btn-primary-compact" @click="handleSaveEdit">\u4FDD\u5B58</button>
          </div>
        </div>
      </div>

      <!-- \u7EDF\u4E00\u786E\u8BA4\u64CD\u4F5C\u5F39\u7A97 -->
      <div v-if="confirmDialog.visible" class="igs-dialog-overlay" :style="themeStyleVars" @click.self="confirmDialog.visible = false">
        <div class="igs-dialog-box" style="width: 360px;">
          <h3 class="igs-dialog-title">{{ confirmDialog.title }}</h3>
          <p style="font-size: 0.88rem; color: var(--igs-settings-ink-2); margin: 6px 0;">{{ confirmDialog.message }}</p>
          <div class="igs-dialog-actions">
            <button class="igs-resources-chip" @click="confirmDialog.visible = false">\u53D6\u6D88</button>
            <button class="igs-btn-primary-compact" style="background: #e74c3c; color: #fff;" @click="confirmDialog.onConfirm">\u786E\u8BA4\u5220\u9664</button>
          </div>
        </div>
      </div>
    </div>
    `
  };

  // src/ui/magic-menu.js
  var MENU_SELECTORS = [
    "#extensionsMenu",
    "#extensions_menu",
    ".extensions_block .list-group"
  ];
  var SETTINGS_ENTRY_ID = "igs-patch-settings-magic-entry";
  var RESOURCES_ENTRY_ID = "igs-patch-resources-magic-entry";
  function getCandidateDocuments2() {
    const docs = [document];
    try {
      if (window.parent && window.parent.document && !docs.includes(window.parent.document)) {
        docs.push(window.parent.document);
      }
    } catch (_) {
    }
    try {
      if (window.top && window.top.document && !docs.includes(window.top.document)) {
        docs.push(window.top.document);
      }
    } catch (_) {
    }
    return docs;
  }
  function setupMagicMenu() {
    injectSettingsStyles();
    injectResourcesStyles();
    ensureMagicMenuEntry();
    const docs = getCandidateDocuments2();
    for (const doc2 of docs) {
      try {
        const observer = new MutationObserver(() => {
          ensureMagicMenuEntryDoc(doc2);
        });
        observer.observe(doc2.body, { childList: true, subtree: true });
      } catch (_) {
      }
    }
    setInterval(ensureMagicMenuEntry, 2e3);
    console.info("[IGS-Patch] \u9B54\u6CD5\u68D2\u83DC\u5355\u3010\u653E\u6620\u8BBE\u7F6E\u3011\u4E0E\u3010\u653E\u6620\u8D44\u6E90\u3011\u5165\u53E3\u6CE8\u5165\u5668\u5DF2\u5C31\u7EEA\u3002");
  }
  function ensureMagicMenuEntry() {
    for (const doc2 of getCandidateDocuments2()) {
      ensureMagicMenuEntryDoc(doc2);
    }
  }
  function ensureMagicMenuEntryDoc(doc2) {
    if (!doc2 || !doc2.body || typeof doc2.querySelector !== "function") return;
    for (const selector of MENU_SELECTORS) {
      const menu = doc2.querySelector(selector);
      if (menu) {
        let settingsItem = menu.querySelector(`#${SETTINGS_ENTRY_ID}`);
        if (!settingsItem) {
          settingsItem = createMagicSettingsItem(doc2);
          menu.appendChild(settingsItem);
          console.info("[IGS-Patch] \u6210\u529F\u5411\u9B54\u6CD5\u68D2\u83DC\u5355\u6CE8\u5165\u3010\u653E\u6620\u8BBE\u7F6E\u3011");
        }
        let resourcesItem = menu.querySelector(`#${RESOURCES_ENTRY_ID}`);
        if (!resourcesItem) {
          resourcesItem = createMagicResourcesItem(doc2);
          menu.appendChild(resourcesItem);
          console.info("[IGS-Patch] \u6210\u529F\u5411\u9B54\u6CD5\u68D2\u83DC\u5355\u6CE8\u5165\u3010\u653E\u6620\u8D44\u6E90\u3011");
        }
      }
    }
  }
  function createMagicSettingsItem(doc2) {
    const item = doc2.createElement("div");
    item.id = SETTINGS_ENTRY_ID;
    item.className = "list-group-item flex-container flexGap5";
    item.title = "\u653E\u6620\u8BBE\u7F6E";
    item.setAttribute("role", "button");
    item.style.cursor = "pointer";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.minHeight = "38px";
    item.style.userSelect = "none";
    item.style.touchAction = "manipulation";
    item.style.webkitTapHighlightColor = "transparent";
    item.innerHTML = `
        <i class="fa-solid fa-film" aria-hidden="true" style="margin-right: 8px; width: 16px; text-align: center;"></i>
        <span>\u653E\u6620\u8BBE\u7F6E</span>
    `;
    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.info("[IGS-Patch] \u70B9\u51FB\u4E86\u653E\u6620\u8BBE\u7F6E\u83DC\u5355\u9879");
      try {
        const parentMenu = item.closest("#extensionsMenu, #extensions_menu");
        if (parentMenu) {
          parentMenu.style.display = "none";
        }
      } catch (_) {
      }
      try {
        openSettingsModal(doc2);
      } catch (err) {
        console.error("[IGS-Patch] \u547C\u51FA\u653E\u6620\u8BBE\u7F6E\u5F02\u5E38:", err);
      }
    });
    return item;
  }
  function createMagicResourcesItem(doc2) {
    const item = doc2.createElement("div");
    item.id = RESOURCES_ENTRY_ID;
    item.className = "list-group-item flex-container flexGap5";
    item.title = "\u653E\u6620\u8D44\u6E90";
    item.setAttribute("role", "button");
    item.style.cursor = "pointer";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.minHeight = "38px";
    item.style.userSelect = "none";
    item.style.touchAction = "manipulation";
    item.style.webkitTapHighlightColor = "transparent";
    item.innerHTML = `
        <i class="fa-solid fa-photo-film" aria-hidden="true" style="margin-right: 8px; width: 16px; text-align: center;"></i>
        <span>\u653E\u6620\u8D44\u6E90</span>
    `;
    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.info("[IGS-Patch] \u70B9\u51FB\u4E86\u653E\u6620\u8D44\u6E90\u83DC\u5355\u9879");
      try {
        const parentMenu = item.closest("#extensionsMenu, #extensions_menu");
        if (parentMenu) {
          parentMenu.style.display = "none";
        }
      } catch (_) {
      }
      try {
        openResourcesModal(doc2);
      } catch (err) {
        console.error("[IGS-Patch] \u547C\u51FA\u653E\u6620\u8D44\u6E90\u5F02\u5E38:", err);
      }
    });
    return item;
  }

  // src/index.js
  init_toast();
  (async function initIgsTauriPatch() {
    console.info("[IGS-Patch] \u6B63\u5728\u521D\u59CB\u5316 TauriTavern \u589E\u5F3A\u8865\u4E01 v2.0 (Vue 3 \u67B6\u6784)...");
    await initConfig();
    const handle = await getTauriHandle();
    if (handle) {
      console.info("[IGS-Patch] \u5DF2\u6210\u529F\u8FDE\u63A5 TauriTavern Rust \u540E\u7AEF API\u3002");
    } else {
      console.warn("[IGS-Patch] \u672A\u68C0\u6D4B\u5230 TauriTavern \u73AF\u5883\uFF0C\u5C06\u4EE5\u6807\u51C6\u9152\u9986\u6A21\u5F0F\u964D\u7EA7\u8FD0\u884C\u3002");
    }
    setupBaiBaiBookBridge();
    setupPromptBlocker();
    setupRenderHook();
    setupQrHijack();
    setupBaibaiEnhancer();
    setupMagicMenu();
    ensureMounted();
    ensureResourcesMounted();
    bindGenerationEvents();
    const patchApi = {
      version: "2.0.0",
      patchState,
      openSettings: openSettingsModal,
      closeSettings: closeSettingsModal,
      openResources: openResourcesModal,
      closeResources: closeResourcesModal,
      fullReset: fullResetGalSystem,
      convertMessageToGal,
      processLatestAssistantMessage
    };
    for (const w of getCandidateWindows8()) {
      try {
        w.__IGS_TAURI_PATCH__ = patchApi;
      } catch (_) {
      }
    }
    console.info("[IGS-Patch] IGS \u8865\u4E01\u521D\u59CB\u5316\u5B8C\u6BD5\uFF1A\u653E\u6620\u952E\u5DF2\u91CD\u6784\uFF0C\u9B54\u6CD5\u68D2\u653E\u6620\u8BBE\u7F6E\u5DF2\u88C5\u8F7D\u3002");
  })();
  function getCandidateWindows8() {
    const list = [window];
    try {
      if (window.parent && window.parent !== window && !list.includes(window.parent)) list.push(window.parent);
    } catch (_) {
    }
    try {
      if (window.top && window.top !== window && !list.includes(window.top)) list.push(window.top);
    } catch (_) {
    }
    return list;
  }
  function bindGenerationEvents() {
    for (const w of getCandidateWindows8()) {
      try {
        const ctx = w.SillyTavern?.getContext?.();
        const eventSource = ctx?.eventSource || w.eventSource;
        if (!eventSource || typeof eventSource.on !== "function") continue;
        if (eventSource.__igsPatchGenBound) continue;
        eventSource.__igsPatchGenBound = true;
        const onGenerationEnded = async () => {
          if (patchState.productionMode === "auto") {
            console.info("[IGS-Patch] \u81EA\u52A8\u6A21\u5F0F\uFF1A\u68C0\u6D4B\u5230\u6B63\u6587\u751F\u6210\u5B8C\u6BD5\uFF0C\u5F00\u59CB\u5728\u540E\u53F0\u5236\u4F5C\u6F14\u51FA...");
            try {
              await processLatestAssistantMessage();
            } catch (e) {
              console.warn("[IGS-Patch] \u81EA\u52A8\u8F6C\u8BD1\u5267\u672C\u5931\u8D25:", e);
            }
          } else {
            console.info("[IGS-Patch] \u624B\u52A8\u6A21\u5F0F\uFF1A\u6B63\u6587\u751F\u6210\u5B8C\u6BD5\uFF0C\u5F85\u7528\u6237\u70B9\u51FB\u653E\u6620\u952E\u65F6\u5236\u4F5C\u6F14\u51FA\u3002");
          }
        };
        const eventTypes = ctx?.event_types || ctx?.eventTypes || {};
        const endEvent = eventTypes.GENERATION_ENDED || "generation_ended";
        const swipedEvent = eventTypes.MESSAGE_SWIPED || "message_swiped";
        const deletedEvent = eventTypes.MESSAGE_DELETED || "message_deleted";
        const chatChangedEvent = eventTypes.CHAT_CHANGED || "chat_changed";
        eventSource.on(endEvent, onGenerationEnded);
        eventSource.on(swipedEvent, (messageId) => {
          console.info("[IGS-Patch] \u6536\u5230\u5206\u652F\u5207\u6362\u4E8B\u4EF6 (MESSAGE_SWIPED):", messageId);
          handleMessageSwiped(messageId);
        });
        eventSource.on(deletedEvent, (messageId) => {
          console.info("[IGS-Patch] \u6536\u5230\u697C\u5C42\u5220\u9664\u4E8B\u4EF6 (MESSAGE_DELETED):", messageId);
          handleMessageDeleted(messageId);
        });
        eventSource.on(chatChangedEvent, () => {
          console.info("[IGS-Patch] \u6536\u5230\u5BF9\u8BDD\u5207\u6362\u4E8B\u4EF6 (CHAT_CHANGED)\uFF0C\u5168\u91CF\u91CD\u8F7D\u5267\u672C\u6620\u5C04");
          syncAllStoredScriptsToChat();
        });
        console.info("[IGS-Patch] \u6210\u529F\u7ED1\u5B9A\u5168\u5957\u751F\u6210\u3001\u5206\u652F\u4E0E\u697C\u5C42\u751F\u547D\u5468\u671F\u4E8B\u4EF6");
      } catch (_) {
      }
    }
  }
})();
