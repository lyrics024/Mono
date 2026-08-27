/* ===== Item Add / Edit Form ===== */

let formImages = []; // [{dataUrl, isMain}]

async function renderItemForm(itemId = null) {
  await storeReady;

  const form = document.getElementById('item-form');
  formImages = [];

  let item = null;
  if (itemId) {
    item = await getById('items', itemId);
    if (!item) {
      showToast('该物品已被删除');
      goBackFromForm();
      return;
    }
  }

  const defaultCatId = sessionStorage.getItem('mono_new_item_cat') || '_uncategorized_';
  sessionStorage.removeItem('mono_new_item_cat');

  // Setup images
  if (item) {
    if (item.mainImage) formImages.push({ dataUrl: item.mainImage, isMain: true, id: 'main' });
    for (const img of (item.extraImages || [])) {
      formImages.push({ dataUrl: img, isMain: false, id: generateId() });
    }
  }

  const catId = item ? item.categoryId : defaultCatId;
  const categories = await getAll('categories');
  const catOptions = buildCategorySelectOptions(categories, {
    selectedId: catId
  });

  form.innerHTML = `
    <!-- Images -->
    <div class="form-images-section" id="form-images-container">
      ${renderFormImageSlots()}
    </div>
    <input type="file" id="image-file-input" accept="image/jpeg,image/png,image/heic" style="display:none">

    <!-- Name -->
    <div class="form-group">
      <label class="form-label"><span class="required">*</span> 名称</label>
      <input type="text" class="form-input" id="form-name" placeholder="物品名称" value="${escapeHtml(item ? item.name : '')}" required>
      <span class="form-error" id="err-name"></span>
    </div>

    <!-- Price -->
    <div class="form-group">
      <label class="form-label"><span class="required">*</span> 价格 (元)</label>
      <input type="number" class="form-input" id="form-price" placeholder="0.00" value="${item ? item.price : ''}" step="0.01" min="0.01" required>
      <span class="form-error" id="err-price"></span>
    </div>

    <!-- Category -->
    <div class="form-group">
      <label class="form-label">分类</label>
      <select class="form-input" id="form-category">
        ${catOptions}
      </select>
    </div>

    <!-- Purchase Date -->
    <div class="form-group">
      <label class="form-label">购入时间</label>
      <input type="date" class="form-input" id="form-purchase-date" value="${item && item.purchaseDate ? item.purchaseDate : ''}" max="${todayStr()}">
      <span class="form-error" id="err-purchase-date"></span>
    </div>

    <!-- Purchase Channel -->
    <div class="form-group">
      <label class="form-label">购入渠道</label>
      <input type="text" class="form-input" id="form-channel" placeholder="例如：京东、淘宝、线下实体店" value="${escapeHtml(item ? (item.purchaseChannel || '') : '')}">
    </div>

    <!-- Note -->
    <div class="form-group">
      <label class="form-label">备注</label>
      <textarea class="form-input form-textarea" id="form-note" placeholder="记录使用感受、来源、摆放说明等">${escapeHtml(item ? (item.note || '') : '')}</textarea>
    </div>

    <!-- Warranty End Date -->
    <div class="form-group">
      <label class="form-label">保修截止日期</label>
      <input type="date" class="form-input" id="form-warranty" value="${item && item.warrantyEndDate ? item.warrantyEndDate : ''}">
      <span class="form-error" id="err-warranty"></span>
    </div>

    <!-- Status -->
    <div class="form-group">
      <label class="form-label">状态</label>
      <div class="segmented-control" id="form-status">
        <div class="segmented-option ${!item || item.status === 'active' ? 'active' : ''}" data-value="active">上架</div>
        <div class="segmented-option ${item && item.status === 'downlisted' ? 'active' : ''}" data-value="downlisted">下架</div>
      </div>
    </div>

    <input type="hidden" id="form-item-id" value="${itemId || ''}">
    <input type="hidden" id="form-cat-default" value="${escapeHtml(catId)}">
  `;

  // Setup image picker
  document.getElementById('image-file-input').addEventListener('change', handleImagePick);

  // Setup segmented control
  document.getElementById('form-status').querySelectorAll('.segmented-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.getElementById('form-status').querySelectorAll('.segmented-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  // Set category
  const catSelect = document.getElementById('form-category');
  if (!item) {
    // Set to the pre-selected category
    const preCat = document.getElementById('form-cat-default').value;
    if (preCat) {
      catSelect.value = preCat;
    }
  }
}

function renderFormImageSlots() {
  const total = formImages.length;
  let html = '';

  for (let i = 0; i < 3; i++) {
    const img = formImages[i];
    if (img) {
      html += `
        <div class="form-image-slot ${img.isMain ? 'image-main' : ''}" onclick="removeFormImage('${escapeHtml(img.id)}')">
          <img src="${escapeHtml(img.dataUrl)}" alt="">
          <div class="remove-image">×</div>
        </div>
      `;
    } else {
      html += `
        <div class="form-image-slot" onclick="pickImage()">
          <div class="add-icon">+</div>
        </div>
      `;
    }
  }

  return html;
}

function pickImage() {
  if (formImages.length >= 3) {
    showToast('每个物品最多 3 张图片');
    return;
  }
  document.getElementById('image-file-input').click();
}

async function handleImagePick(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const err = validateImage(file);
  if (err) {
    showToast(err);
    return;
  }

  const dataUrl = await readFileAsDataURL(file);

  // Open aspect-preserving crop modal
  const croppedUrl = await openCropModal(dataUrl);
  if (!croppedUrl) return; // User cancelled

  const isMain = formImages.length === 0;

  formImages.push({
    id: generateId(),
    dataUrl: croppedUrl,
    isMain
  });

  document.getElementById('form-images-container').innerHTML = renderFormImageSlots();
}

async function removeFormImage(id) {
  const confirmed = await showModal({
    title: '移除图片',
    message: '确定移除此图片？',
    confirmText: '移除',
    cancelText: '取消'
  });
  if (!confirmed) return;

  formImages = formImages.filter(img => img.id !== id);

  // Re-assign main if main was removed
  if (formImages.length > 0 && !formImages.some(img => img.isMain)) {
    formImages[0].isMain = true;
  }

  document.getElementById('form-images-container').innerHTML = renderFormImageSlots();
}

async function saveItemForm() {
  await storeReady;

  // Gather data
  const name = document.getElementById('form-name').value.trim();
  const priceStr = document.getElementById('form-price').value.trim();
  const categoryId = document.getElementById('form-category').value;
  const purchaseDate = document.getElementById('form-purchase-date').value;
  const channel = document.getElementById('form-channel').value.trim();
  const note = document.getElementById('form-note').value.trim();
  const warrantyEndDate = document.getElementById('form-warranty').value;
  const status = document.getElementById('form-status').querySelector('.segmented-option.active').dataset.value;

  // Validate
  let valid = true;

  if (!name) {
    document.getElementById('err-name').textContent = '名称不能为空';
    valid = false;
  } else {
    document.getElementById('err-name').textContent = '';
  }

  let price = parseFloat(priceStr);
  if (!priceStr || isNaN(price) || price <= 0) {
    document.getElementById('err-price').textContent = '价格必须大于 0';
    valid = false;
  } else {
    document.getElementById('err-price').textContent = '';
  }

  // Purchase date cannot be future
  if (purchaseDate && isFutureDate(purchaseDate)) {
    document.getElementById('err-purchase-date').textContent = '购入时间不能是未来日期';
    valid = false;
  } else {
    document.getElementById('err-purchase-date').textContent = '';
  }

  // Warranty date must be after purchase date
  if (purchaseDate && warrantyEndDate && !isValidDateRange(purchaseDate, warrantyEndDate)) {
    document.getElementById('err-warranty').textContent = '保修截止日期不能早于购入时间';
    valid = false;
  } else {
    document.getElementById('err-warranty').textContent = '';
  }

  if (!valid) return;

  // Build item
  const mainImage = formImages.find(img => img.isMain);
  const extraImages = formImages.filter(img => !img.isMain);
  const editingId = document.getElementById('form-item-id').value;
  const existing = editingId ? await getById('items', editingId) : null;
  let sortOrder = await getNextItemSortOrder(categoryId || '_uncategorized_');

  const itemData = {
    id: editingId || generateId(),
    name,
    price,
    categoryId: categoryId || '_uncategorized_',
    purchaseDate: purchaseDate || null,
    purchaseChannel: channel || '',
    note: note || '',
    warrantyEndDate: warrantyEndDate || null,
    status,
    mainImage: mainImage ? mainImage.dataUrl : null,
    extraImages: extraImages.map(img => img.dataUrl),
    sortOrder,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // If editing, preserve createdAt
  if (editingId) {
    if (!existing) {
      showToast('该物品已被删除');
      goBackFromForm();
      return;
    }
    itemData.createdAt = existing.createdAt;
    if (existing.categoryId === itemData.categoryId && existing.status === itemData.status) {
      itemData.sortOrder = getItemSortOrder(existing);
    }
  }

  await put('items', itemData);
  currentItemId = itemData.id;

  showToast(editingId ? '物品已更新' : '物品已添加');

  showSavedItemDetail(itemData.id);

  // Check warranty for notification
  checkWarrantyForItem(itemData);
}
