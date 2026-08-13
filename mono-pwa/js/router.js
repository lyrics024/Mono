/* ===== Router — Page Navigation ===== */

// Navigation stack for sub-cabinet
let navStack = [];
let currentItemId = null; // for detail/edit page
let detailSource = null; // 'home' | 'subcabinet' | 'search' — where detail was opened from

function switchTab(tabName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  navStack = [];
  detailSource = null;

  switch (tabName) {
    case 'home':
      document.getElementById('page-home').classList.add('active');
      document.querySelector('[data-tab="home"]').classList.add('active');
      renderCabinet();
      break;
    case 'search':
      document.getElementById('page-search').classList.add('active');
      document.querySelector('[data-tab="search"]').classList.add('active');
      document.getElementById('search-input')?.focus();
      break;
    case 'settings':
      document.getElementById('page-settings').classList.add('active');
      document.querySelector('[data-tab="settings"]').classList.add('active');
      renderSettings();
      break;
  }
}

function showSubCabinet(categoryId, categoryName) {
  document.getElementById('page-home').classList.remove('active');
  document.getElementById('page-detail').classList.remove('active');
  document.getElementById('page-subcabinet').classList.add('active');

  document.getElementById('subcabinet-title').textContent = categoryName;
  navStack = [{ id: categoryId, name: categoryName }];

  renderSubCabinet(categoryId, categoryName);
}

function pushSubCabinet(categoryId, categoryName) {
  navStack.push({ id: categoryId, name: categoryName });
  document.getElementById('subcabinet-title').textContent = categoryName;
  renderSubCabinet(categoryId, categoryName);
}

function popSubCabinet() {
  if (navStack.length <= 1) {
    document.getElementById('page-subcabinet').classList.remove('active');
    document.getElementById('page-home').classList.add('active');
    navStack = [];
    renderCabinet();
  } else {
    navStack.pop();
    const top = navStack[navStack.length - 1];
    document.getElementById('subcabinet-title').textContent = top.name;
    renderSubCabinet(top.id, top.name);
  }
}

function showItemDetail(itemId) {
  currentItemId = itemId;

  // Track where we came from
  if (document.getElementById('page-search').classList.contains('active')) {
    detailSource = 'search';
  } else if (navStack.length > 0) {
    detailSource = 'subcabinet';
  } else {
    detailSource = 'home';
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-detail').classList.add('active');
  renderItemDetail(itemId);
}

function showItemForm(itemId = null) {
  currentItemId = itemId;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-form').classList.add('active');
  document.getElementById('form-title').textContent = itemId ? '编辑物品' : '添加物品';
  renderItemForm(itemId);
}

function goBackFromDetail() {
  document.getElementById('page-detail').classList.remove('active');

  if (detailSource === 'search') {
    // Return to search page with previous results intact
    document.getElementById('page-search').classList.add('active');
    document.querySelector('[data-tab="search"]')?.classList.add('active');
    detailSource = null;
  } else if (navStack.length > 0) {
    document.getElementById('page-subcabinet').classList.add('active');
    const top = navStack[navStack.length - 1];
    renderSubCabinet(top.id, top.name);
    detailSource = null;
  } else {
    document.getElementById('page-home').classList.add('active');
    document.querySelector('[data-tab="home"]')?.classList.add('active');
    renderCabinet();
    detailSource = null;
  }
}

function goBackFromForm() {
  document.getElementById('page-form').classList.remove('active');

  if (currentItemId) {
    document.getElementById('page-detail').classList.add('active');
    renderItemDetail(currentItemId);
  } else if (navStack.length > 0) {
    document.getElementById('page-subcabinet').classList.add('active');
    const top = navStack[navStack.length - 1];
    renderSubCabinet(top.id, top.name);
  } else {
    document.getElementById('page-home').classList.add('active');
    renderCabinet();
  }
}

function showCategoryManager() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-category').classList.add('active');
  renderCategoryTree();
}

function goBackFromCategories() {
  document.getElementById('page-category').classList.remove('active');
  document.getElementById('page-home').classList.add('active');
  document.querySelector('[data-tab="home"]')?.classList.add('active');
  renderCabinet();
}