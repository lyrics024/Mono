/* ===== Settings Page ===== */

async function renderSettings() {
  await storeReady;

  const container = document.getElementById('settings-list');
  const items = await getAll('items');
  const categories = await getAll('categories');

  const currentTheme = localStorage.getItem('mono_theme') || 'classic';

  container.innerHTML = `
    <div class="settings-section-label">外观</div>

    <div class="settings-row">
      <div>
        <div class="settings-label">主题风格</div>
        <div class="settings-desc">当前：${currentTheme === 'classic' ? '经典（Kami）' : currentTheme}</div>
      </div>
      <button class="settings-action" onclick="switchTheme()">切换</button>
    </div>

    <div class="settings-section-label">数据管理</div>

    <div class="settings-row">
      <div>
        <div class="settings-label">导出数据</div>
        <div class="settings-desc">将全部数据导出为 JSON 文件</div>
      </div>
      <button class="settings-action" onclick="handleExport()">导出</button>
    </div>

    <div class="settings-row">
      <div>
        <div class="settings-label">导入数据</div>
        <div class="settings-desc">从导出的 JSON 文件恢复数据（会覆盖当前数据）</div>
      </div>
      <button class="settings-action" onclick="handleImport()">导入</button>
    </div>

    <div class="settings-section-label">统计</div>

    <div class="settings-row">
      <div class="settings-label">物品总数</div>
      <span style="font-size:0.9375rem; color:var(--ink-blue); font-weight:600;">${items.length} 件</span>
    </div>

    <div class="settings-row">
      <div class="settings-label">分类总数</div>
      <span style="font-size:0.9375rem; color:var(--ink-blue); font-weight:600;">${categories.length} 个</span>
    </div>

    <div class="settings-section-label">关于</div>

    <div class="settings-row">
      <div>
        <div class="settings-label">Mono</div>
        <div class="settings-desc">个人物品管理系统 — PWA v0.3 · build 20260813-5</div>
      </div>
    </div>

    <div class="settings-version">
      数据存储在浏览器本地（IndexedDB）
    </div>
  `;
}

async function switchTheme() {
  const themes = [
    { id: 'classic', name: '经典（Kami）' },
    { id: 'dark', name: '深色' },
    { id: 'minimal', name: '极简' }
  ];

  const currentTheme = localStorage.getItem('mono_theme') || 'classic';
  const currentIdx = themes.findIndex(t => t.id === currentTheme);
  const nextIdx = (currentIdx + 1) % themes.length;
  const next = themes[nextIdx];

  localStorage.setItem('mono_theme', next.id);
  applyTheme(next.id);
  showToast(`已切换为「${next.name}」主题`);
  renderSettings();
}

function applyTheme(themeId) {
  const root = document.documentElement;

  // Remove all theme classes
  root.classList.remove('theme-classic', 'theme-dark', 'theme-minimal');

  switch (themeId) {
    case 'classic':
      // Default — Kami warm parchment + ink blue (already in variables.css)
      root.classList.add('theme-classic');
      break;
    case 'dark':
      root.classList.add('theme-dark');
      break;
    case 'minimal':
      root.classList.add('theme-minimal');
      break;
  }
}

// Apply saved theme on load
(function() {
  const saved = localStorage.getItem('mono_theme') || 'classic';
  applyTheme(saved);
})();

async function handleExport() {
  await storeReady;
  try {
    const json = await exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mono_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('数据已导出');
  } catch (e) {
    showToast('导出失败');
    console.error(e);
  }
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const confirmed = await showModal({
        title: '导入数据',
        message: '导入将覆盖当前所有数据，确定继续？',
        confirmText: '导入',
        cancelText: '取消',
        danger: true
      });
      if (!confirmed) return;

      await storeReady;
      await importData(text);
      showToast('数据已导入');
      renderSettings();
    } catch (e) {
      showToast('导入失败：' + e.message);
    }
  };

  input.click();
}