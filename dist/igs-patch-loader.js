/**
 * IGS TauriTavern 补丁 - 在线热更新引导器
 * 仓库: cone97218-alt/igsadd
 * 特点: 导入一次即可，每次酒馆刷新自动无感拉取 GitHub 上的最新构建！
 */
(async function loadIgsPatchHot() {
    const REPO = 'cone97218-alt/igsadd';
    const BRANCH = 'main';
    const SCRIPT = 'dist/igs-tauri-patch.js';
    const ts = Date.now();

    // 1. 尝试获取 GitHub 最新的 Commit SHA 实现零缓存秒更
    let targetRef = BRANCH;
    try {
        const ghRes = await fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}?t=${ts}`, {
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
        `https://testingcf.jsdelivr.net/gh/${REPO}@${targetRef}/${SCRIPT}?t=${ts}`,
        `https://fastly.jsdelivr.net/gh/${REPO}@${targetRef}/${SCRIPT}?t=${ts}`,
        `https://cdn.jsdelivr.net/gh/${REPO}@${targetRef}/${SCRIPT}?t=${ts}`,
        `https://raw.githubusercontent.com/${REPO}/${targetRef}/${SCRIPT}?t=${ts}`,
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
            console.info(`[IGS-Patch] 远程热更就绪 - 版本: ${targetRef.slice(0, 7)} - 节点: ${new URL(url).hostname}`);
            break;
        } catch (_) { }
    }

    if (!success) {
        console.error('[IGS-Patch] 远程补丁拉取失败，请检查网络连接或 GitHub 仓库。');
    }
})();