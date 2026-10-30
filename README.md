# IGS TauriTavern 增强独立补丁

本项目是面向 **Immersive Galgame System (IGS)** 的独立酒馆助手补丁脚本，采用模块化工程架构设计。

---

## 核心特性

1. **一键彻底清空与重置**
   - 清理 IndexedDB 中所有生成的立绘、背景、CG与贴图缓存 (`vn` 库)。
   - 清理本地存储 (`localStorage`) 的所有 IGS 相关设置与状态。
   - 清理 TauriTavern Rust KV Store 中的所有剧本缓存与扩展元数据。
2. **全量接入 TauriTavern 专有 Rust 存储与检索**
   - 精准定位：`handle.locate.findLastMessage({ role: 'assistant' })` 由 Rust 后端毫秒级定位。
   - 剧本存储：`handle.store.setJson / getJson`，每个聊天独立 KV 隔离，不膨胀聊天记录。
   - 配置与元数据：`handle.metadata.setExtension`，跨端无缝迁移。
3. **主副模型解耦（演出导演管线）**
   - **主模型**：拦截并移除所有 `[igs-fx:...]` 等标签注入，输出纯正文小说，保持最高文本智商与文笔。
   - **副模型**：复用 IGS 主脚本图形面板中已配置的副 LLM，后台自动将正文精准切分并转译为 IGS 演出语法。
   - **双轨渲染**：原生聊天窗口保留干净的小说正文，Gal 舞台呈现完整的立绘表情、背景与音画演出。

---

## 项目结构

```
c:\Users\dday9\Desktop\gal\
├── package.json              # 项目依赖与构建指令
├── scripts\
│   └── build.js              # 打包脚本：esbuild 单文件化并生成酒馆助手导入 JSON
├── src\
│   ├── index.js              # 补丁入口与生命周期调度
│   ├── tauri\
│   │   ├── adapter.js        # TauriTavern 专有 API (locate, searchMessages, store, metadata)
│   │   └── reset.js          # 一键全清重置服务 (IndexedDB, localStorage, TauriTavern)
│   ├── director\
│   │   ├── grammar-prompt.js # IGS 演出导演 Prompt 与语法定义
│   │   ├── secondary-llm.js  # 复用 IGS 主脚本已配置的副 API 客户端 (OpenAI/Tavern)
│   │   └── pipeline.js       # 正文捕获与转译调度管线
│   ├── interceptor\
│   │   ├── prompt-blocker.js # 阻断主模型提示词中的 Gal 标签规则
│   │   └── render-hook.js    # 拦截 IGS 文本解析器，交付转译剧本
│   └── ui\
│       ├── menu.js           # 扩展侧边栏菜单与酒馆助手 QR 快捷按钮
│       └── toast.js          # 消息通知封装
└── dist\
    ├── igs-tauri-patch.js    # 打包产物：单文件 JS
    └── igs-tauri-patch.json  # 打包产物：可直接导入酒馆助手的脚本 JSON
```

---

## 构建与使用

### 1. 构建
在项目根目录下执行：
```bash
npm.cmd run build
```

### 2. 导入酒馆助手
1. 打开 SillyTavern 的酒馆助手。
2. 将 `dist/igs-tauri-patch.json` 导入为新脚本并启用。
3. 确保同时启用了 IGS 主脚本，并在 IGS 设置面板中配置好了【副 LLM / 图像写词接口】。
