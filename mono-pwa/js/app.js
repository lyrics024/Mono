/* ===== Mono App — Main Entry Point ===== */

document.addEventListener('DOMContentLoaded', () => {
  // Tab bar navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // Page header buttons
  document.getElementById('btn-add-item')?.addEventListener('click', () => showItemForm());
  document.getElementById('btn-manage-cats')?.addEventListener('click', () => showCategoryManager());
  document.getElementById('btn-batch-mode')?.addEventListener('click', () => enterBatchMode('home'));

  // Sub-cabinet back
  document.getElementById('btn-sub-back')?.addEventListener('click', () => {
    if (batchMode) { exitBatchMode(); return; }
    popSubCabinet();
  });
  document.getElementById('btn-sub-add')?.addEventListener('click', () => {
    const top = navStack[navStack.length - 1];
    if (top) sessionStorage.setItem('mono_new_item_cat', top.id);
    showItemForm();
  });
  document.getElementById('btn-sub-batch')?.addEventListener('click', () => {
    const top = navStack[navStack.length - 1];
    if (top) enterBatchMode('subcabinet', top.id);
  });

  // Detail page
  document.getElementById('btn-detail-back')?.addEventListener('click', () => goBackFromDetail());
  document.getElementById('btn-detail-edit')?.addEventListener('click', () => {
    if (currentItemId) showItemForm(currentItemId);
  });
  document.getElementById('btn-detail-delete')?.addEventListener('click', () => {
    if (currentItemId) deleteItemFromDetail(currentItemId);
  });

  // Form page
  document.getElementById('btn-form-back')?.addEventListener('click', () => goBackFromForm());
  document.getElementById('btn-form-save')?.addEventListener('click', () => saveItemForm());

  // Category page
  document.getElementById('btn-cat-back')?.addEventListener('click', () => goBackFromCategories());
  document.getElementById('btn-add-cat')?.addEventListener('click', () => {
    // Scroll to add row
    document.getElementById('cat-add-input')?.focus();
  });

  // Init search (once)
  initSearch();

  // Init keyboard shortcut for search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      switchTab('search');
    }
  });

  // Start — play animation or skip
  if (isColdStart()) {
    // Show animation first, DB init in parallel
    storeReady.then(() => {
      playOpeningAnimation();
      markAnimationPlayed();
    });
  } else {
    // Skip animation, directly show app
    document.getElementById('cabinet-anim-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    switchTab('home');
  }

  // Only request notification permission on user interaction
  setTimeout(() => {
    requestNotificationPermission();
  }, 3000);
});

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js?build=20260813-5', { updateViaCache: 'none' });
}