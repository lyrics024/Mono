/* ===== Batch Mode — Multi-select & delete ===== */

let batchMode = false;
let batchSelectedIds = new Set();
let batchContext = 'home';
let batchCategoryId = null;

function enterBatchMode(context, categoryId = null) {
  batchMode = true;
  batchSelectedIds = new Set();
  batchContext = context;
  batchCategoryId = categoryId;

  const page = context === 'subcabinet'
    ? document.getElementById('page-subcabinet')
    : document.getElementById('page-home');

  // Remove existing batch bar
  const existingBar = page.querySelector('.batch-bar');
  if (existingBar) existingBar.remove();

  // Insert batch bar right after the header
  const header = page.querySelector('.page-header');
  const bar = document.createElement('div');
  bar.className = 'batch-bar visible';
  bar.id = 'batch-bar';
  bar.innerHTML = `
    <span>已选择 <span id="batch-count">0</span> 件</span>
    <div class="batch-actions">
      <button class="batch-btn batch-delete" onclick="batchDelete()">删除</button>
      <button class="batch-btn batch-cancel" onclick="exitBatchMode()">取消</button>
    </div>
  `;
  header.after(bar);

  // Re-render items with checkboxes
  if (context === 'home') {
    renderCabinet();
  } else {
    const title = document.getElementById('subcabinet-title').textContent;
    renderSubCabinet(categoryId, title);
  }
}

function exitBatchMode() {
  const wasContext = batchContext;
  const wasCatId = batchCategoryId;

  batchMode = false;
  batchSelectedIds = new Set();

  const page = wasContext === 'subcabinet'
    ? document.getElementById('page-subcabinet')
    : document.getElementById('page-home');

  const bar = page.querySelector('.batch-bar');
  if (bar) bar.remove();

  // Explicitly remove batch-mode class from cabinet view
  const cabinetView = page.querySelector('.cabinet-view');
  if (cabinetView) cabinetView.classList.remove('batch-mode');

  // Re-render without batch mode
  if (wasContext === 'home') {
    renderCabinet();
  } else if (wasCatId) {
    const title = document.getElementById('subcabinet-title').textContent;
    renderSubCabinet(wasCatId, title);
  }
}

function toggleBatchItem(itemId) {
  if (batchSelectedIds.has(itemId)) {
    batchSelectedIds.delete(itemId);
  } else {
    batchSelectedIds.add(itemId);
  }

  // Update visual on the card
  const card = document.querySelector(`[data-item-id="${itemId}"]`);
  if (card) {
    card.classList.toggle('checked', batchSelectedIds.has(itemId));
  }

  // Update count
  const countEl = document.getElementById('batch-count');
  if (countEl) countEl.textContent = batchSelectedIds.size;
}

async function batchDelete() {
  if (batchSelectedIds.size === 0) {
    showToast('请先选择物品');
    return;
  }

  const confirmed = await showModal({
    title: '批量删除',
    message: `确定删除选中的 ${batchSelectedIds.size} 件物品？此操作不可恢复`,
    confirmText: '删除',
    cancelText: '取消',
    danger: true
  });
  if (!confirmed) return;

  for (const id of batchSelectedIds) {
    await remove('items', id);
  }

  showToast(`已删除 ${batchSelectedIds.size} 件物品`);
  exitBatchMode();
}