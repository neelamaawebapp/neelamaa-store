// Service Worker for Craft Style PWA Push Notifications

self.addEventListener('push', function(event) {
  let data = { title: 'New Alert', message: 'Something new on Craft Style!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'New Alert', message: event.data.text() };
    }
  }

  const options = {
    body: data.message,
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [100, 50, 100],
    image: data.image || undefined,
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Focus or open a window when clicking the notification
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
