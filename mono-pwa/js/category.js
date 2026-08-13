/* ===== Category Management — Visual Hierarchy ===== */

async function renderCategoryTree() {
  await storeReady;

  const container = document.getElementById('category-tree');
  const allCats = await getAll('categories');
  const allItems = await getAll('items');
  const tree = buildTree(allCats);

  let html = renderCatNodes(tree, allItems, 0);

  // Add category inline
  html += `
    <div class="cat-add-row" id="cat-add-row">
      <input type="text" id="cat-add-input" placeholder="新分类名称" maxlength="30">
      <select class="parent-select" id="cat-add-parent">
        <option value="">顶级分类</option>
        ${allCats.filter(c => c.depth < 2 && !c.isDefault).map(c =>
          `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`
        ).join('')}
      </select>
      <button class="text-btn" onclick="addCategory()" style="flex-shrink: 0;">添加</button>
    </div>
  `;

  container.innerHTML = html;
}

function renderCatNodes(nodes, items, depth) {
  let html = '';
  for (const cat of nodes) {
    const itemCount = countItemsInTree(cat, items);
    const hasChildren = cat.children && cat.children.length > 0;

    // Depth indicator: small dot path for visual hierarchy
    const indent = depth * 24; // px per level
    const depthDots = depth > 0 ? `<span class="cat-depth-line" style="width:${indent}px;"></span>` : '';
    const depthLabel = depth > 0 ? `<span class="cat-depth-label">${'1.1.1'.slice(0, depth * 2 - 1)}</span>` : '';

    html += `
      <div class="cat-node ${cat.isDefault ? 'default-cat' : ''}" data-depth="${depth}" data-id="${escapeHtml(cat.id)}" style="padding-left: calc(var(--space-md) + ${indent}px);">
        ${depthDots}
        <span class="cat-name">${escapeHtml(cat.name)}</span>
        <span class="cat-item-count">${itemCount} 件</span>
        ${!cat.isDefault ? `
        <div class="cat-actions">
          ${depth < 3 && !cat.isDefault ? `<button class="cat-action-btn" onclick="addSubCategory('${escapeHtml(cat.id)}')" title="添加子分类">+</button>` : ''}
          <button class="cat-action-btn" onclick="renameCategory('${escapeHtml(cat.id)}', '${escapeHtml(cat.name)}')" title="重命名">✎</button>
          <button class="cat-action-btn delete" onclick="removeCategory('${escapeHtml(cat.id)}')" title="删除">×</button>
        </div>
        ` : '<span class="cat-system-label">系统默认</span>'}
      </div>
    `;

    if (hasChildren) {
      html += renderCatNodes(cat.children, items, depth + 1);
    }
  }
  return html;
}

function countItemsInTree(cat, items) {
  let count = items.filter(i => i.categoryId === cat.id).length;
  if (cat.children) {
    for (const child of cat.children) {
      count += countItemsInTree(child, items);
    }
  }
  return count;
}

async function addCategory() {
  await storeReady;
  const input = document.getElementById('cat-add-input');
  const name = input.value.trim();
  const parentId = document.getElementById('cat-add-parent').value || null;

  if (!name) {
    showToast('分类名称不能为空');
    return;
  }

  // Check duplicate at same level
  const allCats = await getAll('categories');
  const dup = allCats.find(c => c.parentId === parentId && c.name === name);
  if (dup) {
    showToast('该分类名称已存在');
    return;
  }

  // Check depth
  if (parentId) {
    const parent = await getById('categories', parentId);
    if (parent && parent.depth >= 2) {
      showToast('最多支持 3 层分类');
      return;
    }
  }

  const depth = parentId ? ((await getById('categories', parentId))?.depth ?? 0) + 1 : 0;
  const maxOrder = Math.max(0, ...allCats.filter(c => c.parentId === parentId).map(c => c.sortOrder));

  const now = Date.now();
  await put('categories', {
    id: generateId(),
    name,
    parentId,
    depth,
    sortOrder: maxOrder + 1,
    isDefault: false,
    createdAt: now,
    updatedAt: now
  });

  input.value = '';
  showToast('分类已添加');
  renderCategoryTree();
}

async function addSubCategory(parentId) {
  const parent = await getById('categories', parentId);
  const parentName = parent ? parent.name : '';

  const name = await showPrompt({
    title: `在「${parentName}」下添加子分类`,
    placeholder: '子分类名称',
    validate: (val) => {
      if (!val) return '分类名称不能为空';
      return null;
    }
  });
  if (!name) return;

  if (parent && parent.depth >= 2) {
    showToast('最多支持 3 层分类');
    return;
  }

  const allCats = await getAll('categories');
  const dup = allCats.find(c => c.parentId === parentId && c.name === name);
  if (dup) {
    showToast('该分类名称已存在');
    return;
  }

  const depth = (parent?.depth ?? 0) + 1;
  const maxOrder = Math.max(0, ...allCats.filter(c => c.parentId === parentId).map(c => c.sortOrder));

  await put('categories', {
    id: generateId(),
    name,
    parentId,
    depth,
    sortOrder: maxOrder + 1,
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  showToast('子分类已添加');
  renderCategoryTree();
}

async function renameCategory(catId, oldName) {
  const name = await showPrompt({
    title: '重命名分类',
    placeholder: '新名称',
    value: oldName,
    validate: (val) => {
      if (!val) return '分类名称不能为空';
      return null;
    }
  });
  if (!name) return;

  const cat = await getById('categories', catId);
  if (!cat) return;

  const allCats = await getAll('categories');
  const dup = allCats.find(c => c.id !== catId && c.parentId === cat.parentId && c.name === name);
  if (dup) {
    showToast('该分类名称已存在');
    return;
  }

  cat.name = name;
  cat.updatedAt = Date.now();
  await put('categories', cat);

  showToast('分类已重命名');
  renderCategoryTree();
}

async function removeCategory(catId) {
  const cat = await getById('categories', catId);
  if (!cat || cat.isDefault) return;

  const descendantIds = await getAllDescendantIds(catId);
  const items = await getAll('items');
  const affectedCount = items.filter(i => descendantIds.includes(i.categoryId)).length;
  const subCatCount = descendantIds.length - 1;

  let msg = `确定删除分类「${cat.name}」？`;
  if (subCatCount > 0) msg += `\n该分类下有 ${subCatCount} 个子分类，`;
  msg += `共 ${affectedCount} 件物品将移入「未归类」`;

  const confirmed = await showModal({
    title: '删除分类',
    message: msg,
    confirmText: '删除',
    cancelText: '取消',
    danger: true
  });
  if (!confirmed) return;

  await deleteCategory(catId);
  showToast('分类已删除');
  renderCategoryTree();
}