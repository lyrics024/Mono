/* ===== Mono Data Store — IndexedDB-backed ===== */

const DB_NAME = 'mono_db';
const DB_VERSION = 1;

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
      { name: 'createdAt', keyPath: 'createdAt' }
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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function remove(storeName, id) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName, 'readwrite').clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
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
    warrantyEndDate: data.warrantyEndDate || null,
    status: data.status || 'active',
    categoryId: data.categoryId || '_uncategorized_',
    createdAt: now,
    updatedAt: now
  };
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
      (item.purchaseChannel && item.purchaseChannel.toLowerCase().includes(q))
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
  return JSON.stringify({ version: 1, categories, items, exportedAt: new Date().toISOString() }, null, 2);
}

async function importData(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
    if (!data.version || !data.categories || !data.items) throw new Error('Invalid format');
  } catch (e) {
    throw new Error('导入失败：文件格式不正确');
  }

  await clearStore('items');
  await clearStore('categories');

  for (const c of data.categories) {
    await put('categories', c);
  }
  for (const i of data.items) {
    await put('items', i);
  }

  await ensureDefaultCategory();
}

// ── Init on load ──────────────────────────────────────────

async function initStore() {
  await openDB();
  await ensureDefaultCategory();
}

// Wait for init before rendering
let storeReady = initStore();