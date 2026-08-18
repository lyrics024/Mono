/* ===== Item Detail Page ===== */

async function renderItemDetail(itemId, targetId = 'detail-content') {
  await storeReady;

  const item = await getById('items', itemId);
  if (!item) {
    showToast('该物品已被删除');
    if (targetId === 'desktop-detail-content') {
      closeDesktopDetailPanel();
      refreshActiveListView();
    } else {
      goBackFromDetail();
    }
    return;
  }

  const category = await getById('categories', item.categoryId);
  const usageDays = calcUsageDays(item);
  const dailyPrice = calcDailyPrice(item);
  const remainingWarranty = calcRemainingWarranty(item);

  const container = document.getElementById(targetId);
  if (!container) return;

  let galleryHtml = '';
  const images = [item.mainImage, ...(item.extraImages || [])].filter(Boolean);

  if (images.length > 0) {
    galleryHtml = '<div class="detail-gallery">';
    for (const img of images) {
      galleryHtml += `
        <div class="detail-gallery-image">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(item.name)}">
        </div>
      `;
    }
    galleryHtml += '</div>';
  } else {
    galleryHtml = `
      <div class="detail-gallery" style="justify-content: center;">
        <div class="detail-gallery-image">
          <div class="placeholder-large">${placeholderSVG(80)}</div>
        </div>
      </div>
    `;
  }

  const statusClass = item.status === 'active' ? 'active' : 'downlisted';
  const statusLabel = item.status === 'active' ? '上架' : '下架';

  container.innerHTML = `
    ${galleryHtml}

    <div class="detail-fields">
      <div class="detail-field">
        <span class="detail-field-label">名称</span>
        <span class="detail-field-value">${escapeHtml(item.name)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">分类</span>
        <span class="detail-field-value">${category ? escapeHtml(category.name) : '未归类'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">价格</span>
        <span class="detail-field-value price">${formatPrice(item.price)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">购入时间</span>
        <span class="detail-field-value">${formatDate(item.purchaseDate)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">购入渠道</span>
        <span class="detail-field-value">${escapeHtml(item.purchaseChannel) || '—'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">备注</span>
        <span class="detail-field-value detail-note-value">${escapeHtml(item.note) || '—'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">使用天数</span>
        <span class="detail-field-value auto-calc">${formatDays(usageDays)} <span style="font-size:0.6875rem;">自动计算</span></span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">日均价格</span>
        <span class="detail-field-value auto-calc">${formatDailyPrice(dailyPrice)} <span style="font-size:0.6875rem;">自动计算</span></span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">保修截止</span>
        <span class="detail-field-value auto-calc">${formatDate(item.warrantyEndDate)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">剩余保修</span>
        <span class="detail-field-value auto-calc">${formatRemainingWarranty(remainingWarranty)} <span style="font-size:0.6875rem;">自动计算</span></span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">状态</span>
        <span class="detail-field-value">
          <span class="status-badge ${statusClass}" onclick="toggleItemStatus('${escapeHtml(item.id)}')">
            <span class="status-dot"></span>${statusLabel}
          </span>
        </span>
      </div>
    </div>

    <div class="detail-actions">
      <button class="delete-btn" onclick="deleteItemFromDetail('${escapeHtml(item.id)}')">删除此物品</button>
    </div>
  `;
}

async function toggleItemStatus(itemId) {
  const item = await getById('items', itemId);
  if (!item) return;

  if (item.status === 'active') {
    // 下架：状态改下架 + 分类归入「未归类」
    item.status = 'downlisted';
    item.categoryId = '_uncategorized_';
  } else {
    // 上架：恢复状态
    item.status = 'active';
  }
  item.updatedAt = Date.now();
  await put('items', item);
  refreshActiveListView();
  renderItemDetail(itemId, isDesktopDetailOpen() ? 'desktop-detail-content' : 'detail-content');
}

async function deleteItemFromDetail(itemId) {
  const confirmed = await showModal({
    title: '删除物品',
    message: '确定删除该物品？此操作不可恢复。',
    confirmText: '删除',
    cancelText: '取消',
    danger: true
  });
  if (!confirmed) return;

  await remove('items', itemId);
  showToast('物品已删除');
  if (isDesktopDetailOpen()) {
    closeDesktopDetailPanel();
    refreshActiveListView();
    detailSource = null;
    return;
  }
  goBackFromDetail();
}
