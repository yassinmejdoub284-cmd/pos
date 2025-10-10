// Import Angular's service worker if available (production only)
if (typeof importScripts === 'function') {
  try {
    importScripts('./ngsw-worker.js');
  } catch (e) {
    console.log('Angular service worker not available in development mode');
  }
}

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Notification';
  const body = data.body || '';
  const payload = data.data || {};
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload,
    actions: [
      { action: 'approve', title: 'Approuver' },
      { action: 'reject', title: 'Rejeter' }
    ]
  }));
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const data = event.notification?.data || {};
  event.notification.close();
  event.waitUntil((async () => {
    const clientsArr = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = clientsArr[0];
    const msg = { type: 'APPROVAL_ACTION', action, data };
    if (client) {
      await client.focus();
      client.postMessage(msg);
    } else {
      const url = `/?action=${action}&type=${data?.type || ''}&id=${data?.id || ''}`;
      const win = await clients.openWindow(url);
      if (win) win.postMessage(msg);
    }
  })());
});


