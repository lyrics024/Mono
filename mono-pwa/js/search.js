/* ===== Search ===== */

let searchDebounce = null;

async function initSearch() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');

  input.addEventListener('input', () => {
    const val = input.value.trim();
    clearBtn.classList.toggle('hidden', !val);

    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => performSearch(val), 200);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    document.getElementById('search-results').innerHTML = '';
    input.focus();
  });
}

async function performSearch(query) {
  await storeReady;
  const container = document.getElementById('search-results');

  if (!query) {
    container.innerHTML = '';
    return;
  }

  const results = await searchItems(query);
  const categories = await getAll('categories');
  const catMap = {};
  for (const c of categories) catMap[c.id] = c;

  if (results.length === 0) {
    container.innerHTML = `
      <div class="search-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <p>未找到匹配的物品</p>
      </div>
    `;
    return;
  }

  // Build category path for each item
  function getCatPath(catId) {
    const parts = [];
    let current = catMap[catId];
    while (current) {
      parts.unshift(current.name);
      current = current.parentId ? catMap[current.parentId] : null;
    }
    return parts.join(' › ');
  }

  let html = '';
  for (const item of results) {
    const catPath = getCatPath(item.categoryId);
    const isDownlisted = item.status === 'downlisted';
    const cardClass = isDownlisted ? 'search-item downlisted' : 'search-item';

    let thumbContent = '';
    if (item.mainImage) {
      thumbContent = `<img src="${escapeHtml(item.mainImage)}" alt="${escapeHtml(item.name)}">`;
    } else {
      thumbContent = `<div class="thumb-placeholder">${placeholderSVG(36)}</div>`;
    }
    const note = (item.note || '').trim();
    const noteHtml = note ? `<div class="search-item-note">${escapeHtml(note)}</div>` : '';

    html += `
      <div class="${cardClass}" onclick="showItemDetail('${escapeHtml(item.id)}')">
        <div class="search-item-thumb">
          ${thumbContent}
        </div>
        <div class="search-item-info">
          <div class="search-item-name">${escapeHtml(item.name)}</div>
          <div class="search-item-cat">${escapeHtml(catPath)}</div>
          <div class="search-item-price">${formatPrice(item.price)}</div>
          ${noteHtml}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}
