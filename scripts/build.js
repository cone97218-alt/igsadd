/**
 * 打包脚本
 * 使用 esbuild 将 src/ 模块化代码（含 Vue 3 运行时）打包为单文件 JS，并封装为可直接导入酒馆助手的 .json 脚本。
 * 同时自动生成【在线热更新引导器】(Loader)，导入一次后永远自动实时同步 GitHub 上的最新构建。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const GITHUB_REPO = 'cone97218-alt/igsadd';
const GITHUB_BRANCH = 'main';
const SCRIPT_NAME = 'dist/igs-tauri-patch.js';

async function build() {
    console.log('🚀 正在构建 IGS TauriTavern 补丁 v2.0 (Vue 3 全功能架构)...');

    const jsDistPath = path.resolve(distDir, 'igs-tauri-patch.js');
    const jsonDistPath = path.resolve(distDir, 'igs-tauri-patch.json');
    const loaderJsPath = path.resolve(distDir, 'igs-patch-loader.js');
    const loaderJsonPath = path.resolve(distDir, 'igs-patch-loader.json');

    // 1. 使用 esbuild 将 Vue 3 及所有业务模块打包为单文件 IIFE
    await esbuild.build({
        entryPoints: [path.resolve(rootDir, 'src/index.js')],
        outfile: jsDistPath,
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: ['es2020'],
        minify: false,
        legalComments: 'inline',
        define: {
            'process.env.NODE_ENV': '"production"',
            '__VUE_OPTIONS_API__': 'true',
            '__VUE_PROD_DEVTOOLS__': 'false',
            '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
        },
        alias: {
            vue: 'vue/dist/vue.esm-bundler.js',
        },
    });

    const bundledJs = fs.readFileSync(jsDistPath, 'utf8');

    // 2. 封装为离线全量导入件 JSON
    const offlineTavernJson = {
        type: 'script',
        enabled: true,
        name: 'IGS-TauriTavern增强补丁 - 离线完整版',
        id: 'igs-tauri-patch-v2',
        content: bundledJs,
        info: [
            'IGS TauriTavern 增强补丁 v2.0 - 离线全量版',
            '1. 放映键极简图标：QR 栏重构为纯放映机图标，支持自动制作与手动制作双模。',
            '2. 魔法棒放映设置：移除非必要的 QR 按钮，在魔法棒菜单注入【放映设置】。',
            '3. 提示词动态阻断：100% 拦截主脚本注入酒馆的标签语法，转交副模型作为导演指引。',
            '4. 原生 Rust 存储：全面对接 TauriTavern KV Store，毫秒级读写海量演出剧本。',
        ].join('\n'),
        button: {
            enabled: false,
            buttons: [],
        },
        data: {},
        export_with: {
            data: true,
            button: false,
        },
    };
    fs.writeFileSync(jsonDistPath, JSON.stringify(offlineTavernJson, null, 2), 'utf8');

    // 3. 生成极简在线热更新加载器 Loader (JS + JSON)
    // 采用【Commit SHA 穿透 + 多 CDN 镜像回退】策略，彻底消除 CDN 静态缓存延迟，实现 Push 即生效
    const loaderCode = `/**
 * IGS TauriTavern 补丁 - 在线热更新引导器
 * 仓库: ${GITHUB_REPO}
 * 特点: 导入一次即可，每次酒馆刷新自动无感拉取 GitHub 上的最新构建！
 */
(async function loadIgsPatchHot() {
    const REPO = '${GITHUB_REPO}';
    const BRANCH = '${GITHUB_BRANCH}';
    const SCRIPT = '${SCRIPT_NAME}';
    const ts = Date.now();

    // 1. 尝试获取 GitHub 最新的 Commit SHA 实现零缓存秒更
    let targetRef = BRANCH;
    try {
        const ghRes = await fetch(\`https://api.github.com/repos/\${REPO}/commits/\${BRANCH}?t=\${ts}\`, {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
            cache: 'no-store'
        });
        if (ghRes.ok) {
            const data = await ghRes.json();
            if (data && data.sha) {
                targetRef = data.sha;
            }
        }
    } catch (_) { }

    const MIRRORS = [
        \`https://testingcf.jsdelivr.net/gh/\${REPO}@\${targetRef}/\${SCRIPT}?t=\${ts}\`,
        \`https://fastly.jsdelivr.net/gh/\${REPO}@\${targetRef}/\${SCRIPT}?t=\${ts}\`,
        \`https://cdn.jsdelivr.net/gh/\${REPO}@\${targetRef}/\${SCRIPT}?t=\${ts}\`,
        \`https://raw.githubusercontent.com/\${REPO}/\${targetRef}/\${SCRIPT}?t=\${ts}\`,
    ];

    let success = false;
    for (const url of MIRRORS) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) continue;
            const code = await res.text();
            if (!code || code.length < 1000) continue;

            const runner = new Function(code);
            runner();
            success = true;
            console.info(\`[IGS-Patch] 远程热更就绪 - 版本: \${targetRef.slice(0, 7)} - 节点: \${new URL(url).hostname}\`);
            break;
        } catch (_) { }
    }

    if (!success) {
        console.error('[IGS-Patch] 远程补丁拉取失败，请检查网络连接或 GitHub 仓库。');
    }
})();`;

    fs.writeFileSync(loaderJsPath, loaderCode, 'utf8');

    const loaderJson = {
        type: 'script',
        enabled: true,
        name: 'IGS-TauriTavern增强补丁 - 在线热更新版',
        id: 'igs-tauri-patch-hot-loader',
        content: loaderCode,
        info: [
            'IGS TauriTavern 增强补丁 - 在线实时热更新版',
            '只需在酒馆助手导入一次！每次页面刷新自动从 GitHub/CDN 同步执行最新代码。',
            '无需重复手动导入或更新文件。',
        ].join('\n'),
        button: {
            enabled: false,
            buttons: [],
        },
        data: {},
        export_with: {
            data: true,
            button: false,
        },
    };
    fs.writeFileSync(loaderJsonPath, JSON.stringify(loaderJson, null, 2), 'utf8');

    // 4. 自动预清理 jsDelivr 全球边缘缓存（Purge）
    if (!GITHUB_REPO.includes('YOUR_USERNAME')) {
        try {
            await fetch(`https://purge.jsdelivr.net/gh/${GITHUB_REPO}@${GITHUB_BRANCH}/${SCRIPT_NAME}`, {
                signal: AbortSignal.timeout(3000),
            });
            console.log('⚡ jsDelivr 全球 CDN 边缘缓存预清理指令已成功下发');
        } catch (_) { }
    }

    const jsStat = fs.statSync(jsDistPath);
    const jsonStat = fs.statSync(jsonDistPath);
    const loaderStat = fs.statSync(loaderJsPath);
    const loaderJsonStat = fs.statSync(loaderJsonPath);

    console.log('✅ 构建成功！产物清单：');
    console.log(`  1. 离线全量单文件: ${jsDistPath} (${(jsStat.size / 1024).toFixed(2)} KB)`);
    console.log(`  2. 离线全量导入件: ${jsonDistPath} (${(jsonStat.size / 1024).toFixed(2)} KB)`);
    console.log(`  3. 热更引导代码:   ${loaderJsPath} (${(loaderStat.size / 1024).toFixed(2)} KB)`);
    console.log(`  4. 热更一键导入包: ${loaderJsonPath} (${(loaderJsonStat.size / 1024).toFixed(2)} KB)`);
}

build().catch((err) => {
    console.error('❌ 构建失败:', err);
    process.exit(1);
});
