/* ===== Router — Page Navigation ===== */

// Navigation stack for sub-cabinet
let navStack = [];
let currentItemId = null; // for detail/edit page
let detailSource = null; // 'home' | 'subcabinet' | 'search' — where detail was opened from
let formReturnContext = null;

const DESKTOP_DETAIL_QUERY = '(min-width: 820px)';

function isDesktopDetailMode() {
  return window.matchMedia(DESKTOP_DETAIL_QUERY).matches;
}

function isDesktopDetailOpen() {
  return document.getElementById('app')?.classList.contains('desktop-detail-open') || false;
}

function getActivePageId() {
  return document.querySelector('.page.active')?.id || 'page-home';
}

function getDetailSource() {
  if (document.getElementById('page-search')?.classList.contains('active')) return 'search';
  if (navStack.length > 0) return 'subcabinet';
  return 'home';
}

function setActiveTabButton(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
}

function getCurrentViewContext() {
  return {
    pageId: getActivePageId(),
    tabName: document.querySelector('.tab-btn.active')?.dataset.tab || 'home',
    navStack: navStack.map(entry => ({ ...entry })),
    detailSource,
    desktopPanelOpen: isDesktopDetailOpen()
  };
}

function restoreViewContext(context = null) {
  const target = context || { pageId: 'page-home', tabName: 'home', navStack: [], detailSource: null };
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  navStack = (target.navStack || []).map(entry => ({ ...entry }));
  detailSource = target.detailSource || null;
  setActiveTabButton(target.tabName || 'home');

  const pageId = target.pageId || 'page-home';
  const page = document.getElementById(pageId) || document.getElementById('page-home');
  page.classList.add('active');

  if (page.id === 'page-home') {
    renderCabinet();
  } else if (page.id === 'page-subcabinet') {
    const top = navStack[navStack.length - 1];
    if (top) {
      document.getElementById('subcabinet-title').textContent = top.name;
      renderSubCabinet(top.id, top.name);
    }
  } else if (page.id === 'page-settings') {
    renderSettings();
  } else if (page.id === 'page-category') {
    renderCategoryTree();
  } else if (page.id === 'page-search') {
    const query = document.getElementById('search-input')?.value.trim();
    if (query) performSearch(query);
  }
}

function refreshActiveListView() {
  const pageId = getActivePageId();
  if (pageId === 'page-home') {
    renderCabinet();
  } else if (pageId === 'page-subcabinet') {
    const top = navStack[navStack.length - 1];
    if (top) renderSubCabinet(top.id, top.name);
  } else if (pageId === 'page-search') {
    const query = document.getElementById('search-input')?.value.trim();
    if (query) performSearch(query);
  }
}

function syncSelectedItemCards() {
  document.querySelectorAll('.item-card.selected').forEach(card => card.classList.remove('selected'));
  if (!isDesktopDetailOpen() || !currentItemId) return;
  document.querySelectorAll(`.item-card[data-item-id="${currentItemId}"]`).forEach(card => {
    card.classList.add('selected');
  });
}

function openDesktopDetailPanel(itemId) {
  currentItemId = itemId;
  const app = document.getElementById('app');
  const panel = document.getElementById('desktop-detail-panel');
  if (!app || !panel) return;

  app.classList.add('desktop-detail-open');
  panel.classList.add('active');
  renderItemDetail(itemId, 'desktop-detail-content');
  syncSelectedItemCards();
}

function closeDesktopDetailPanel(options = {}) {
  const { clearCurrent = true, skipSync = false } = options;
  const app = document.getElementById('app');
  const panel = document.getElementById('desktop-detail-panel');

  app?.classList.remove('desktop-detail-open');
  panel?.classList.remove('active');
  const content = document.getElementById('desktop-detail-content');
  if (content) content.innerHTML = '';

  if (clearCurrent) currentItemId = null;
  if (!skipSync) syncSelectedItemCards();
}

function switchTab(tabName) {
  closeDesktopDetailPanel({ skipSync: true });
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  setActiveTabButton(tabName);

  navStack = [];
  detailSource = null;

  switch (tabName) {
    case 'home':
      document.getElementById('page-home').classList.add('active');
      renderCabinet();
      break;
    case 'search':
      document.getElementById('page-search').classList.add('active');
      document.getElementById('search-input')?.focus();
      break;
    case 'settings':
      document.getElementById('page-settings').classList.add('active');
      renderSettings();
      break;
  }
}

function showSubCabinet(categoryId, categoryName) {
  closeDesktopDetailPanel();
  document.getElementById('page-home').classList.remove('active');
  document.getElementById('page-detail').classList.remove('active');
  document.getElementById('page-subcabinet').classList.add('active');

  document.getElementById('subcabinet-title').textContent = categoryName;
  navStack = [{ id: categoryId, name: categoryName }];

  renderSubCabinet(categoryId, categoryName);
}

function pushSubCabinet(categoryId, categoryName) {
  closeDesktopDetailPanel();
  navStack.push({ id: categoryId, name: categoryName });
  document.getElementById('subcabinet-title').textContent = categoryName;
  renderSubCabinet(categoryId, categoryName);
}

function popSubCabinet() {
  closeDesktopDetailPanel();
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
  detailSource = getDetailSource();

  if (isDesktopDetailMode()) {
    openDesktopDetailPanel(itemId);
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-detail').classList.add('active');
  renderItemDetail(itemId);
}

function showItemForm(itemId = null) {
  formReturnContext = getCurrentViewContext();
  closeDesktopDetailPanel({ clearCurrent: false });
  currentItemId = itemId;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-form').classList.add('active');
  document.getElementById('form-title').textContent = itemId ? '编辑物品' : '添加物品';
  renderItemForm(itemId);
}

function goBackFromDetail() {
  if (isDesktopDetailOpen()) {
    closeDesktopDetailPanel();
    refreshActiveListView();
    detailSource = null;
    return;
  }

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

  if (isDesktopDetailMode() && formReturnContext) {
    const returnItemId = formReturnContext.desktopPanelOpen ? currentItemId : null;
    const context = formReturnContext;
    formReturnContext = null;
    restoreViewContext(context);
    if (returnItemId) openDesktopDetailPanel(returnItemId);
    return;
  }

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

function showSavedItemDetail(itemId) {
  currentItemId = itemId;

  if (isDesktopDetailMode()) {
    const context = formReturnContext || { pageId: 'page-home', tabName: 'home', navStack: [], detailSource: 'home' };
    formReturnContext = null;
    restoreViewContext(context);
    openDesktopDetailPanel(itemId);
    return;
  }

  document.getElementById('page-form').classList.remove('active');
  document.getElementById('page-detail').classList.add('active');
  renderItemDetail(itemId);
}

function showCategoryManager() {
  closeDesktopDetailPanel();
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
