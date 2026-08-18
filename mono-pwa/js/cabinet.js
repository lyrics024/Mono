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
  bindCabinetDrag(container);

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
    .sort(compareItemsBySortOrder);
  // Downlisted items
  const downlistedItems = items
    .filter(i => allCatIds.includes(i.categoryId) && i.status === 'downlisted')
    .sort(compareItemsBySortOrder);

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

  html += `<div class="shelf-items-row" data-sort-row="true" data-shelf-category-id="${escapeHtml(category.id)}">`;
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
  const sortedItems = [...items].sort(compareItemsBySortOrder);
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
  html += `<div class="shelf-items-row" data-sort-row="true" data-shelf-category-id="_uncategorized_">`;
  for (const item of sortedItems) {
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
  const directActive = allItems.filter(i => i.categoryId === categoryId && i.status === 'active').sort(compareItemsBySortOrder);
  const directDownlisted = allItems.filter(i => i.categoryId === categoryId && i.status === 'downlisted').sort(compareItemsBySortOrder);

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
    const subActive = allItems.filter(i => i.categoryId === childCat.id && i.status === 'active').sort(compareItemsBySortOrder);
    const subDownlisted = allItems.filter(i => i.categoryId === childCat.id && i.status === 'downlisted').sort(compareItemsBySortOrder);
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
        <div class="shelf-items-row" data-sort-row="true" data-shelf-category-id="${escapeHtml(childCat.id)}">
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
        <div class="shelf-items-row" data-sort-row="true" data-shelf-category-id="${escapeHtml(categoryId)}">
          ${directActive.map(item => renderItemCard(item)).join('')}
          ${directDownlisted.map(item => renderItemCard(item, true)).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  bindCabinetDrag(container);

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
  const isSelected = typeof isDesktopDetailOpen === 'function' && isDesktopDetailOpen() && currentItemId === item.id;
  const selectedClass = isSelected ? ' selected' : '';

  let thumbContent = '';
  if (item.mainImage) {
    thumbContent = `<img src="${escapeHtml(item.mainImage)}" alt="${escapeHtml(item.name)}" draggable="false">`;
  } else {
    thumbContent = `<div class="thumb-placeholder">${placeholderSVG(48)}</div>`;
  }

  const clickHandler = batchMode
    ? `onclick="toggleBatchItem('${escapeHtml(item.id)}')"`
    : `onclick="showItemDetail('${escapeHtml(item.id)}')"`;

  const checkHtml = batchMode ? '<div class="batch-check"></div>' : '';
  const note = (item.note || '').trim();
  const noteHtml = note ? `<div class="item-note-label">${escapeHtml(note)}</div>` : '';

  return `
    <div class="${cardClass}${checkedClass}${selectedClass}" ${clickHandler} draggable="${batchMode ? 'false' : 'true'}" data-item-id="${escapeHtml(item.id)}" data-category-id="${escapeHtml(item.categoryId)}" data-item-status="${escapeHtml(item.status || 'active')}">
      ${checkHtml}
      <div class="item-thumb">
        ${thumbContent}
      </div>
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-price-label">${formatPrice(item.price)}</div>
      ${noteHtml}
    </div>
  `;
}

// ── Drag sorting: category-local only ─────────────────────

let cabinetDragState = null;
let cabinetSuppressClickUntil = 0;

function bindCabinetDrag(container) {
  if (!container || container.dataset.dragBound === 'true') return;
  container.dataset.dragBound = 'true';

  container.addEventListener('dragstart', handleCabinetDragStart);
  container.addEventListener('dragover', handleCabinetDragOver);
  container.addEventListener('drop', handleCabinetDrop);
  container.addEventListener('dragend', handleCabinetDragEnd);
  container.addEventListener('click', handleCabinetClickCapture, true);
}

function handleCabinetClickCapture(e) {
  if (Date.now() < cabinetSuppressClickUntil) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function handleCabinetDragStart(e) {
  if (batchMode) {
    e.preventDefault();
    return;
  }

  const card = e.target.closest('.item-card[data-item-id]');
  if (!card) return;
  if (!e.dataTransfer) return;

  cabinetDragState = {
    itemId: card.dataset.itemId,
    categoryId: card.dataset.categoryId,
    status: card.dataset.itemStatus,
    row: card.closest('.shelf-items-row')
  };

  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', cabinetDragState.itemId);
}

function handleCabinetDragOver(e) {
  if (!cabinetDragState) return;
  if (!e.dataTransfer) return;

  const row = e.target.closest('.shelf-items-row[data-sort-row="true"]');
  if (!row) return;

  const targetCard = e.target.closest('.item-card[data-item-id]');
  const draggedCard = findDraggedCardInRow(row);
  if (!draggedCard) return;
  if (targetCard && !canDropOnCard(targetCard)) return;

  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.shelf-items-row.drag-over').forEach(node => node.classList.remove('drag-over'));
  row.classList.add('drag-over');

  if (targetCard && targetCard !== draggedCard) {
    const rect = targetCard.getBoundingClientRect();
    const placeBefore = e.clientX < rect.left + rect.width / 2;
    row.insertBefore(draggedCard, placeBefore ? targetCard : targetCard.nextSibling);
    return;
  }

  if (!targetCard) {
    const sameScopeCards = [...row.querySelectorAll('.item-card')]
      .filter(card => canDropOnCard(card) && card !== draggedCard);
    const lastSameScope = sameScopeCards[sameScopeCards.length - 1];
    row.insertBefore(draggedCard, lastSameScope ? lastSameScope.nextSibling : row.firstChild);
  }
}

async function handleCabinetDrop(e) {
  if (!cabinetDragState) return;
  if (!e.dataTransfer) return;

  const row = e.target.closest('.shelf-items-row[data-sort-row="true"]') || cabinetDragState.row;
  if (!row) return;
  if (!findDraggedCardInRow(row)) return;

  e.preventDefault();
  row.classList.remove('drag-over');

  try {
    const orderedIds = [...row.querySelectorAll('.item-card[data-item-id]')]
      .filter(card => (
        card.dataset.categoryId === cabinetDragState.categoryId &&
        card.dataset.itemStatus === cabinetDragState.status
      ))
      .map(card => card.dataset.itemId);

    await updateItemOrder(cabinetDragState.categoryId, orderedIds, cabinetDragState.status);
    cabinetSuppressClickUntil = Date.now() + 350;
    showToast('顺序已保存');
  } catch (err) {
    showToast('排序保存失败');
    console.error(err);
  }
}

function handleCabinetDragEnd() {
  document.querySelectorAll('.item-card.dragging').forEach(card => card.classList.remove('dragging'));
  document.querySelectorAll('.shelf-items-row.drag-over').forEach(row => row.classList.remove('drag-over'));
  cabinetDragState = null;
}

function canDropOnCard(card) {
  return !!(
    cabinetDragState &&
    card &&
    card.dataset.categoryId === cabinetDragState.categoryId &&
    card.dataset.itemStatus === cabinetDragState.status
  );
}

function findDraggedCardInRow(row) {
  if (!cabinetDragState || !row) return null;
  return [...row.querySelectorAll('.item-card.dragging[data-item-id]')]
    .find(card => card.dataset.itemId === cabinetDragState.itemId) || null;
}

// ── Add item in specific category ─────────────────────────

function showItemFormInCategory(categoryId) {
  sessionStorage.setItem('mono_new_item_cat', categoryId);
  showItemForm();
}
