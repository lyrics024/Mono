/* ===== Warranty Notifications (Web Notifications API) ===== */

async function checkWarrantyForItem(item) {
  if (!item.warrantyEndDate) return;

  const remaining = calcRemainingWarranty(item);
  if (remaining !== null && remaining >= 1 && remaining <= 30) {
    const notification = {
      id: `warranty_${item.id}_${new Date().toDateString()}`,
      itemId: item.id,
      itemName: item.name,
      remainingDays: remaining,
      sentAt: Date.now()
    };

    // Don't send same reminder twice in one day
    const sent = JSON.parse(localStorage.getItem('mono_warranty_sent') || '[]');
    const alreadySent = sent.find(s => s.id === notification.id);
    if (!alreadySent && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('保修即将到期', {
        body: `「${item.name}」剩余保修期 ${remaining} 天`,
        icon: '/assets/icons/icon-192.png',
        tag: `warranty-${item.id}`,
        requireInteraction: true
      });
      sent.push(notification);
      localStorage.setItem('mono_warranty_sent', JSON.stringify(sent.slice(-50))); // Keep last 50
    }
  }
}

async function checkAllWarranties() {
  await storeReady;
  const items = await getAll('items');
  for (const item of items) {
    await checkWarrantyForItem(item);
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        // Do initial check
        setTimeout(checkAllWarranties, 1000);
      }
    });
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    // Schedule periodic check (every ~12 hours in real world, but browsers limit this)
    setInterval(checkAllWarranties, 12 * 60 * 60 * 1000);
    // Also check now
    setTimeout(checkAllWarranties, 2000);
  }
}