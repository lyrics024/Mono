/* ===== Cabinet View — Main Page + Sub-cabinet ===== */

// Collect all category IDs in a tree (including the node itself)
function collectDescendantCatIds(cat) {
  const ids = [cat.id];
  if (cat.children) {
    for (const child of cat.children) {
      ids.push(...collectDescendantCatIds(child));
    }
  }
  return ids;
}

async function renderCabinet() {
  await storeReady;
  const container = document.getElementById('cabinet-view');
  const categories = await getCategoryTree();
  const items = await getAll('items');

  if (categories.length === 0 && items.length === 0) {
    container.innerHTML = `
      <div class="cabinet-empty">
        ${cabinetEmptySVG(64)}
        <h3>橱柜还空着</h3>
        <p>添加第一件物品，开始管理你的私人物品</p>
        <button class="add-btn" onclick="showItemForm()">添加物品</button>
      </div>
    `;
    return;
  }

  let html = '';
  for (const cat of categories) {
    html += renderShelfRow(cat, items);
  }

  // Also show uncategorized downlisted items
  const uncatDownlisted = items.filter(i => i.categoryId === '_uncategorized_' && i.status === 'downlisted');
  if (uncatDownlisted.length > 0) {
    html += renderDownlistedShelf(uncatDownlisted);
  }

  container.innerHTML = html;

  // Restore batch-mode class if active
  if (batchMode && batchContext === 'home') {
    container.classList.add('batch-mode');
  }
}

function renderShelfRow(category, items) {
  // Collect all descendant category IDs (including this category)
  const allCatIds = collectDescendantCatIds(category);

  // Active items from this category AND all its descendants
  const activeItems = items
    .filter(i => allCatIds.includes(i.categoryId) && i.status === 'active')
    .sort((a, b) => a.createdAt - b.createdAt); // by creation order
  // Downlisted items
  const downlistedItems = items
    .filter(i => allCatIds.includes(i.categoryId) && i.status === 'downlisted')
    .sort((a, b) => a.createdAt - b.createdAt);

  // For default "未归类": only show if it has any items (active or downlisted)
  if (category.isDefault && activeItems.length === 0 && downlistedItems.length === 0) {
    return '';
  }

  const totalCount = activeItems.length + downlistedItems.length;

  let html = `<div class="shelf-section">`;

  html += `
    <div class="shelf-header">
      <div class="shelf-label" onclick="showSubCabinet('${escapeHtml(category.id)}', '${escapeHtml(category.name)}')">
        ${escapeHtml(category.name)}
        <span class="chevron">›</span>
      </div>
      <span class="shelf-count">${totalCount} 件${downlistedItems.length > 0 ? ` <span style="color:var(--text-muted);font-size:0.6875rem;">(${downlistedItems.length} 下架)</span>` : ''}</span>
    </div>
  `;

  html += `<div class="shelf-board-visual"></div>`;

  html += `<div class="shelf-items-row">`;
  for (const item of activeItems) {
    html += renderItemCard(item);
  }
  for (const item of downlistedItems) {
    html += renderItemCard(item, true);
  }
  if (totalCount === 0) {
    html += `<div style="min-height: 120px; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.8125rem; font-style:italic; white-space:nowrap; width:100%; text-align:center; padding:var(--space-md);">暂无物品</div>`;
  }
  html += `</div>`;

  html += `</div>`;
  return html;
}

function renderDownlistedShelf(items) {
  let html = `<div class="shelf-section">`;
  html += `
    <div class="shelf-header">
      <div class="shelf-label" style="cursor:default; opacity:0.7;">
        已下架
      </div>
      <span class="shelf-count">${items.length} 件</span>
    </div>
  `;
  html += `<div class="shelf-board-visual" style="opacity:0.5;"></div>`;
  html += `<div class="shelf-items-row">`;
  for (const item of items) {
    html += renderItemCard(item, true);
  }
  html += `</div>`;
  html += `</div>`;
  return html;
}

// ── Sub-cabinet ───────────────────────────────────────────

async function renderSubCabinet(categoryId, categoryName) {
  await storeReady;

  const container = document.getElementById('subcabinet-view');
  const cat = await getById('categories', categoryId);
  if (!cat) return;

  const allItems = await getAll('items');
  const allCats = await getAll('categories');

  const childCats = allCats.filter(c => c.parentId === categoryId).sort((a, b) => a.sortOrder - b.sortOrder);
  const directActive = allItems.filter(i => i.categoryId === categoryId && i.status === 'active');
  const directDownlisted = allItems.filter(i => i.categoryId === categoryId && i.status === 'downlisted');

  let html = '';

  if (childCats.length === 0 && directActive.length === 0 && directDownlisted.length === 0) {
    html += `
      <div class="cabinet-empty">
        ${cabinetEmptySVG(64)}
        <h3>该分类下暂无物品</h3>
        <p>在这个分类中添加你的第一件物品</p>
        <button class="add-btn" onclick="showItemFormInCategory('${escapeHtml(categoryId)}')">添加物品</button>
      </div>
    `;
    container.innerHTML = html;

    if (batchMode && batchContext === 'subcabinet') {
      container.classList.add('batch-mode');
    }
    return;
  }

  // Render sub-categories as shelves
  for (const childCat of childCats) {
    const subActive = allItems.filter(i => i.categoryId === childCat.id && i.status === 'active');
    const subDownlisted = allItems.filter(i => i.categoryId === childCat.id && i.status === 'downlisted');
    html += `
      <div class="shelf-section">
        <div class="shelf-header">
          <div class="shelf-label" onclick="pushSubCabinet('${escapeHtml(childCat.id)}', '${escapeHtml(childCat.name)}')">
            ${escapeHtml(childCat.name)}
            <span class="chevron">›</span>
          </div>
          <span class="shelf-count">${subActive.length + subDownlisted.length} 件</span>
        </div>
        <div class="shelf-board-visual"></div>
        <div class="shelf-items-row">
          ${subActive.map(item => renderItemCard(item)).join('')}
          ${subDownlisted.map(item => renderItemCard(item, true)).join('')}
          ${(subActive.length + subDownlisted.length) === 0 ? '<div style="min-height:120px; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.8125rem; font-style:italic; white-space:nowrap; width:100%; text-align:center; padding:var(--space-md);">暂无物品</div>' : ''}
        </div>
      </div>
    `;
  }

  // Direct items
  if (directActive.length > 0 || directDownlisted.length > 0) {
    html += `
      <div class="shelf-section">
        <div class="shelf-header">
          <div class="shelf-label" style="cursor: default;">
            ${escapeHtml(categoryName)}
          </div>
          <span class="shelf-count">${directActive.length + directDownlisted.length} 件</span>
        </div>
        <div class="shelf-board-visual"></div>
        <div class="shelf-items-row">
          ${directActive.map(item => renderItemCard(item)).join('')}
          ${directDownlisted.map(item => renderItemCard(item, true)).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  if (batchMode && batchContext === 'subcabinet') {
    container.classList.add('batch-mode');
  }
}

// ── Item Card ─────────────────────────────────────────────

function renderItemCard(item, showDownlisted = false) {
  const isDownlisted = item.status === 'downlisted';
  const cardClass = isDownlisted ? 'item-card downlisted' : 'item-card';
  const isChecked = batchMode && batchSelectedIds.has(item.id);
  const checkedClass = isChecked ? ' checked' : '';

  let thumbContent = '';
  if (item.mainImage) {
    thumbContent = `<img src="${escapeHtml(item.mainImage)}" alt="${escapeHtml(item.name)}">`;
  } else {
    thumbContent = `<div class="thumb-placeholder">${placeholderSVG(48)}</div>`;
  }

  const clickHandler = batchMode
    ? `onclick="toggleBatchItem('${escapeHtml(item.id)}')"`
    : `onclick="showItemDetail('${escapeHtml(item.id)}')"`;

  const checkHtml = batchMode ? '<div class="batch-check"></div>' : '';

  return `
    <div class="${cardClass}${checkedClass}" ${clickHandler} data-item-id="${escapeHtml(item.id)}">
      ${checkHtml}
      <div class="item-thumb">
        ${thumbContent}
      </div>
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-price-label">${formatPrice(item.price)}</div>
    </div>
  `;
}

// ── Add item in specific category ─────────────────────────

function showItemFormInCategory(categoryId) {
  sessionStorage.setItem('mono_new_item_cat', categoryId);
  showItemForm();
}