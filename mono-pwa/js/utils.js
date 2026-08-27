/* ===== Utilities — Toast, Modal, Formatters ===== */

// ── Toast ─────────────────────────────────────────────────

let toastTimer = null;

function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  requestAnimationFrame(() => {
    el.classList.add('show');
  });
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 250);
  }, duration);
}

// ── Modal ─────────────────────────────────────────────────

function showModal(options) {
  const { title, message, confirmText = '确定', cancelText = '取消', onConfirm, onCancel, danger = false } = options;

  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="modal-cancel" id="modal-cancel-btn">${escapeHtml(cancelText)}</button>
        <button class="modal-confirm ${danger ? 'danger' : ''}" id="modal-confirm-btn">${escapeHtml(confirmText)}</button>
      </div>
    `;

    overlay.classList.remove('hidden');

    const cleanup = () => {
      overlay.classList.add('hidden');
      document.getElementById('modal-cancel-btn')?.removeEventListener('click', onNo);
      document.getElementById('modal-confirm-btn')?.removeEventListener('click', onYes);
    };

    const onYes = () => { cleanup(); resolve(true); if (onConfirm) onConfirm(); };
    const onNo = () => { cleanup(); resolve(false); if (onCancel) onCancel(); };

    document.getElementById('modal-cancel-btn').addEventListener('click', onNo);
    document.getElementById('modal-confirm-btn').addEventListener('click', onYes);

    // Close on overlay click (outside content)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) onNo();
    }, { once: true });
  });
}

function showPrompt(options) {
  const { title, placeholder = '', value = '', confirmText = '确定', cancelText = '取消', validate } = options;

  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
      <h3>${escapeHtml(title)}</h3>
      <input type="text" id="prompt-input" class="form-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}" style="margin-bottom: var(--space-lg); width: 100%;">
      <div id="prompt-error" class="form-error"></div>
      <div class="modal-actions">
        <button class="modal-cancel" id="modal-cancel-btn">${escapeHtml(cancelText)}</button>
        <button class="modal-confirm" id="modal-confirm-btn" style="background: var(--ink-blue);">${escapeHtml(confirmText)}</button>
      </div>
    `;

    overlay.classList.remove('hidden');

    const cleanup = () => {
      overlay.classList.add('hidden');
      document.getElementById('modal-cancel-btn')?.removeEventListener('click', onNo);
      document.getElementById('modal-confirm-btn')?.removeEventListener('click', onYes);
    };

    const input = document.getElementById('prompt-input');
    const errorEl = document.getElementById('prompt-error');
    input.focus();

    const onYes = () => {
      const val = input.value.trim();
      if (validate) {
        const err = validate(val);
        if (err) {
          errorEl.textContent = err;
          return;
        }
      }
      cleanup();
      resolve(val);
    };

    const onNo = () => { cleanup(); resolve(null); };

    document.getElementById('modal-cancel-btn').addEventListener('click', onNo);
    document.getElementById('modal-confirm-btn').addEventListener('click', onYes);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') onYes(); });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) onNo();
    }, { once: true });
  });
}

// ── Formatters ────────────────────────────────────────────

function formatPrice(price) {
  if (price == null || isNaN(price)) return '—';
  return `¥${parseFloat(price).toFixed(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) {
  return n.toString().padStart(2, '0');
}

function formatDailyPrice(dailyPrice) {
  if (dailyPrice == null || isNaN(dailyPrice)) return '—';
  return `¥${dailyPrice.toFixed(2)} / 天`;
}

function formatDays(days) {
  if (days == null) return '—';
  return `${days} 天`;
}

function formatRemainingWarranty(days) {
  if (days == null) return '—';
  if (days <= 0) return '已过期';
  return `${days} 天`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function buildCategorySelectOptions(categories, options = {}) {
  const {
    selectedId = '',
    allowCategory = () => true
  } = options;

  const tree = buildTree(Array.isArray(categories) ? categories : []);
  const selectedKey = selectedId == null ? '' : String(selectedId);
  const html = [];

  const walk = (nodes, depth = 0) => {
    for (const cat of nodes) {
      if (allowCategory(cat, depth)) {
        const prefix = depth > 0 ? `${'·'.repeat(depth)} ` : '';
        const selected = selectedKey === String(cat.id) ? 'selected' : '';
        html.push(
          `<option value="${escapeHtml(cat.id)}" ${selected}>${prefix}${escapeHtml(cat.name)}</option>`
        );
      }

      if (cat.children && cat.children.length > 0) {
        walk(cat.children, depth + 1);
      }
    }
  };

  walk(tree, 0);
  return html.join('');
}

// ── Image helpers ─────────────────────────────────────────

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function validateImage(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
  if (!allowed.includes(file.type)) {
    return '不支持该图片格式，请选择 JPG、PNG 或 HEIC 格式';
  }
  if (file.size > 10 * 1024 * 1024) {
    return '图片大小不能超过 10MB';
  }
  return null;
}

// ── Date helpers ──────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function isValidDateRange(start, end) {
  if (!start || !end) return true;
  return new Date(end) >= new Date(start);
}

function isFutureDate(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) > new Date(todayStr());
}

// ── SVG Icons ─────────────────────────────────────────────

function placeholderSVG(size = 48) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="M21 15l-5-5L5 21"/>
    </svg>
  `;
}

function cabinetEmptySVG(size = 64) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="2" y="2" width="20" height="20" rx="2"/>
      <path d="M2 8h20"/>
      <path d="M2 16h20"/>
      <line x1="8" y1="8" x2="8" y2="16"/>
    </svg>
  `;
}

function packageSVG(size = 48) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  `;
}
