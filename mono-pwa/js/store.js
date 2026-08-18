/* ===== Mono Data Store — IndexedDB-backed ===== */

const DB_NAME = 'mono_db';
const DB_VERSION = 2;
const EXPORT_VERSION = 3;

let db = null;

// ── Schema ────────────────────────────────────────────────

const DB_SCHEMA = {
  categories: {
    keyPath: 'id',
    indexes: [
      { name: 'parentId', keyPath: 'parentId' },
      { name: 'sortOrder', keyPath: 'sortOrder' }
    ]
  },
  items: {
    keyPath: 'id',
    indexes: [
      { name: 'categoryId', keyPath: 'categoryId' },
      { name: 'name', keyPath: 'name' },
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'sortOrder', keyPath: 'sortOrder' }
    ]
  }
};

// ── Init ──────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      for (const [storeName, config] of Object.entries(DB_SCHEMA)) {
        let store;
        if (d.objectStoreNames.contains(storeName)) {
          store = req.transaction.objectStore(storeName);
        } else {
          store = d.createObjectStore(storeName, { keyPath: config.keyPath });
        }
        for (const idx of config.indexes) {
          if (!store.indexNames.contains(idx.name)) {
            store.createIndex(idx.name, idx.keyPath);
          }
        }
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Generic CRUD ──────────────────────────────────────────

function tx(storeName, mode = 'readonly') {
  if (!db) throw new Error('DB not opened');
  return db.transaction(storeName, mode).objectStore(storeName);
}

async function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getById(storeName, id) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName).index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function put(storeName, obj) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName, 'readwrite').put(obj);
    req.onsuccess = () => {
      scheduleNativeBackup();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

async function remove(storeName, id) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName, 'readwrite').delete(id);
    req.onsuccess = () => {
      scheduleNativeBackup();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName, 'readwrite').clear();
    req.onsuccess = () => {
      scheduleNativeBackup();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Native macOS safety backup ────────────────────────────

let nativeBackupTimer = null;
const NATIVE_BACKUP_DEBOUNCE_MS = 1500;
const NATIVE_BACKUP_SOFT_LIMIT_BYTES = 80 * 1024 * 1024;

function hasNativeBackupBridge() {
  return !!(
    window.__MONO_MAC_APP__ &&
    window.webkit &&
    window.webkit.messageHandlers &&
    window.webkit.messageHandlers.monoBackup
  );
}

function scheduleNativeBackup() {
  if (!hasNativeBackupBridge() || !db) return;

  clearTimeout(nativeBackupTimer);
  nativeBackupTimer = setTimeout(async () => {
    try {
      const categories = await getAll('categories');
      const items = await getAll('items');
      const snapshot = JSON.stringify({
        version: 1,
        categories,
        items,
        exportedAt: new Date().toISOString(),
        source: 'mono-macos-auto-backup'
      });
      if (snapshot.length > NATIVE_BACKUP_SOFT_LIMIT_BYTES) {
        console.warn('Native backup skipped: snapshot is too large for the WebView bridge');
        return;
      }
      window.webkit.messageHandlers.monoBackup.postMessage(snapshot);
    } catch (e) {
      console.warn('Native backup failed', e);
    }
  }, NATIVE_BACKUP_DEBOUNCE_MS);
}

// ── Seeds — ensure default "未归类" exists ────────────────

async function ensureDefaultCategory() {
  const cats = await getAll('categories');
  const uncat = cats.find(c => c.isDefault);
  if (!uncat) {
    const now = Date.now();
    await put('categories', {
      id: '_uncategorized_',
      name: '未归类',
      parentId: null,
      depth: 0,
      sortOrder: 0,
      isDefault: true,
      createdAt: now,
      updatedAt: now
    });
  }
}

// ── Category helpers ──────────────────────────────────────

async function getCategoryTree() {
  const all = await getAll('categories');
  return buildTree(all);
}

function buildTree(cats) {
  const map = {};
  for (const c of cats) {
    map[c.id] = { ...c, children: [] };
  }
  const roots = [];
  for (const c of Object.values(map)) {
    if (c.parentId && map[c.parentId]) {
      map[c.parentId].children.push(c);
    } else {
      roots.push(c);
    }
  }
  // Sort children by sortOrder
  const sortTree = (nodes) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const n of nodes) sortTree(n.children);
  };
  sortTree(roots);
  return roots;
}

async function getCategoryAncestors(catId) {
  const cat = await getById('categories', catId);
  if (!cat) return [];
  const ancestors = [];
  let current = cat;
  while (current.parentId) {
    const parent = await getById('categories', current.parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

async function getCategoryPath(catId) {
  const cat = await getById('categories', catId);
  if (!cat) return [];
  const ancestors = await getCategoryAncestors(catId);
  return [...ancestors, cat];
}

async function getAllDescendantIds(catId) {
  const all = await getAll('categories');
  const ids = [catId];
  let found = true;
  while (found) {
    found = false;
    for (const c of all) {
      if (c.parentId && ids.includes(c.parentId) && !ids.includes(c.id)) {
        ids.push(c.id);
        found = true;
      }
    }
  }
  return ids;
}

async function getItemCountForCategory(catId) {
  const ids = await getAllDescendantIds(catId);
  const items = await getAll('items');
  return items.filter(i => ids.includes(i.categoryId)).length;
}

async function deleteCategory(catId) {
  const cat = await getById('categories', catId);
  if (!cat || cat.isDefault) return;

  // Get all descendant category IDs
  const descendantIds = await getAllDescendantIds(catId);

  // Move all items in these categories to uncategorized
  const items = await getAll('items');
  for (const item of items) {
    if (descendantIds.includes(item.categoryId)) {
      item.categoryId = '_uncategorized_';
      item.updatedAt = Date.now();
      await put('items', item);
    }
  }

  // Delete the category and its descendants
  for (const id of descendantIds) {
    await remove('categories', id);
  }
}

// ── Item helpers ──────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createItem(data) {
  const now = Date.now();
  return {
    id: generateId(),
    name: data.name || '',
    mainImage: data.mainImage || null,
    extraImages: data.extraImages || [],
    price: parseFloat(data.price) || 0,
    purchaseDate: data.purchaseDate || null,
    purchaseChannel: data.purchaseChannel || '',
    note: data.note || '',
    warrantyEndDate: data.warrantyEndDate || null,
    status: data.status || 'active',
    categoryId: data.categoryId || '_uncategorized_',
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : now,
    createdAt: now,
    updatedAt: now
  };
}

function getItemSortOrder(item) {
  const sortOrder = Number(item.sortOrder);
  if (Number.isFinite(sortOrder)) return sortOrder;
  const createdAt = Number(item.createdAt);
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function compareItemsBySortOrder(a, b) {
  const bySort = getItemSortOrder(a) - getItemSortOrder(b);
  if (bySort !== 0) return bySort;
  return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
}

async function getNextItemSortOrder(categoryId) {
  const items = await getByIndex('items', 'categoryId', categoryId || '_uncategorized_');
  if (items.length === 0) return Date.now();
  return Math.max(...items.map(getItemSortOrder)) + 1000;
}

async function updateItemOrder(categoryId, orderedIds, status = null) {
  const items = await getByIndex('items', 'categoryId', categoryId);
  const scopedItems = status ? items.filter(item => item.status === status) : items;
  const byId = new Map(scopedItems.map(item => [item.id, item]));
  const seen = new Set();

  const orderedItems = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item && !seen.has(id)) {
      orderedItems.push(item);
      seen.add(id);
    }
  }

  const remainingItems = scopedItems
    .filter(item => !seen.has(item.id))
    .sort(compareItemsBySortOrder);

  const finalOrder = [...orderedItems, ...remainingItems];
  const now = Date.now();

  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('DB not opened'));
      return;
    }

    const transaction = db.transaction('items', 'readwrite');
    const itemStore = transaction.objectStore('items');

    transaction.oncomplete = () => {
      scheduleNativeBackup();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error || new Error('排序保存失败'));
    transaction.onabort = () => reject(transaction.error || new Error('排序保存失败'));

    finalOrder.forEach((item, index) => {
      item.sortOrder = (index + 1) * 1000;
      item.updatedAt = now;
      itemStore.put(item);
    });
  });
}

// Derived fields (computed, not stored)
function calcUsageDays(item) {
  if (!item.purchaseDate) return null;
  const diff = Date.now() - new Date(item.purchaseDate).getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function calcDailyPrice(item) {
  const days = calcUsageDays(item);
  if (!days || days <= 0) return null;
  return item.price / days;
}

function calcRemainingWarranty(item) {
  if (!item.warrantyEndDate) return null;
  const diff = new Date(item.warrantyEndDate).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ── Search ────────────────────────────────────────────────

async function searchItems(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const items = await getAll('items');
  const cats = await getAll('categories');
  const catMap = {};
  for (const c of cats) catMap[c.id] = c;

  return items.filter(item => {
    const cat = catMap[item.categoryId];
    return (
      item.name.toLowerCase().includes(q) ||
      (cat && cat.name.toLowerCase().includes(q)) ||
      (item.purchaseChannel && item.purchaseChannel.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    // Simple relevance: name match first
    const aNameMatch = a.name.toLowerCase().includes(q);
    const bNameMatch = b.name.toLowerCase().includes(q);
    if (aNameMatch && !bNameMatch) return -1;
    if (!aNameMatch && bNameMatch) return 1;
    return b.createdAt - a.createdAt;
  });
}

// ── Export / Import ───────────────────────────────────────

async function exportData() {
  const categories = await getAll('categories');
  const items = await getAll('items');
  return JSON.stringify({
    app: 'Mono',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    stats: {
      categories: categories.length,
      items: items.length,
      images: countImages(items)
    },
    categories,
    items
  }, null, 2);
}

async function importData(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
    if (!data.version || !Array.isArray(data.categories) || !Array.isArray(data.items)) {
      throw new Error('Invalid format');
    }
  } catch (e) {
    throw new Error('导入失败：文件格式不正确');
  }

  const normalized = normalizeImportData(data);
  await replaceAllDataAtomically(normalized.categories, normalized.items);
}

function countImages(items) {
  return items.reduce((count, item) => {
    return count + (item.mainImage ? 1 : 0) + ((item.extraImages || []).length);
  }, 0);
}

function normalizeImportData(data) {
  const categories = data.categories.map((category, index) => normalizeCategoryRecord(category, index));
  const categoriesWithDefault = ensureDefaultCategoryRecord(categories);
  const categoryIds = new Set(categoriesWithDefault.map(category => category.id));
  const items = data.items.map((item, index) => normalizeItemRecord(item, index, categoryIds));

  return {
    categories: categoriesWithDefault,
    items
  };
}

function normalizeCategoryRecord(category, index) {
  if (!category || typeof category !== 'object') {
    throw new Error(`导入失败：第 ${index + 1} 个分类格式不正确`);
  }

  const id = normalizeString(category.id) || generateId();
  const parentId = normalizeNullableString(category.parentId);
  const depth = clampInteger(category.depth, 0, 2, 0);

  return {
    id,
    name: normalizeString(category.name) || '未命名分类',
    parentId,
    depth,
    sortOrder: Number.isFinite(Number(category.sortOrder)) ? Number(category.sortOrder) : index,
    isDefault: !!category.isDefault,
    createdAt: normalizeTimestamp(category.createdAt),
    updatedAt: normalizeTimestamp(category.updatedAt)
  };
}

function normalizeItemRecord(item, index, categoryIds) {
  if (!item || typeof item !== 'object') {
    throw new Error(`导入失败：第 ${index + 1} 个物品格式不正确`);
  }

  const categoryId = categoryIds.has(item.categoryId) ? item.categoryId : '_uncategorized_';
  const extraImages = Array.isArray(item.extraImages)
    ? item.extraImages.filter(img => typeof img === 'string').slice(0, 2)
    : [];

  return {
    id: normalizeString(item.id) || generateId(),
    name: normalizeString(item.name) || '未命名物品',
    mainImage: typeof item.mainImage === 'string' ? item.mainImage : null,
    extraImages,
    price: Math.max(0, Number(item.price) || 0),
    purchaseDate: normalizeNullableString(item.purchaseDate),
    purchaseChannel: normalizeString(item.purchaseChannel),
    note: normalizeString(item.note),
    warrantyEndDate: normalizeNullableString(item.warrantyEndDate),
    status: item.status === 'downlisted' ? 'downlisted' : 'active',
    categoryId,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : normalizeTimestamp(item.createdAt),
    createdAt: normalizeTimestamp(item.createdAt),
    updatedAt: normalizeTimestamp(item.updatedAt)
  };
}

function ensureDefaultCategoryRecord(categories) {
  if (categories.some(category => category.isDefault || category.id === '_uncategorized_')) {
    return categories.map(category => {
      if (category.isDefault || category.id === '_uncategorized_') {
        return { ...category, id: '_uncategorized_', name: category.name || '未归类', parentId: null, depth: 0, isDefault: true };
      }
      return category;
    });
  }

  const now = Date.now();
  return [
    {
      id: '_uncategorized_',
      name: '未归类',
      parentId: null,
      depth: 0,
      sortOrder: 0,
      isDefault: true,
      createdAt: now,
      updatedAt: now
    },
    ...categories
  ];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value) {
  const str = normalizeString(value);
  return str || null;
}

function normalizeTimestamp(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : Date.now();
}

function clampInteger(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function replaceAllDataAtomically(categories, items) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('DB not opened'));
      return;
    }

    const transaction = db.transaction(['categories', 'items'], 'readwrite');
    const categoryStore = transaction.objectStore('categories');
    const itemStore = transaction.objectStore('items');

    transaction.oncomplete = () => {
      scheduleNativeBackup();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error || new Error('导入失败'));
    transaction.onabort = () => reject(transaction.error || new Error('导入失败'));

    categoryStore.clear();
    itemStore.clear();

    for (const category of categories) {
      categoryStore.put(category);
    }
    for (const item of items) {
      itemStore.put(item);
    }
  });
}

async function restoreFromNativeBackupIfEmpty() {
  const backup = window.__MONO_NATIVE_BACKUP_JSON__;
  if (!backup) return;

  try {
    const categories = await getAll('categories');
    const items = await getAll('items');
    const hasUserData = items.length > 0 || categories.some(c => !c.isDefault);
    if (hasUserData) return;

    await importData(backup);
    console.info('Restored Mono data from native backup');
  } catch (e) {
    console.warn('Native backup restore skipped', e);
  }
}

// ── Init on load ──────────────────────────────────────────

async function initStore() {
  await openDB();
  await ensureDefaultCategory();
  await restoreFromNativeBackupIfEmpty();
}

// Wait for init before rendering
let storeReady = initStore();
