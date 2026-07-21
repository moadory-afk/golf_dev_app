self.addEventListener('push', function (event) {
  var payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: 'GogoPar', body: event.data ? event.data.text() : '' };
  }

  var title = payload.title || 'GogoPar';
  var options = {
    body: payload.body || '',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var data = event.notification.data || {};
  var targetUrl = data.url || '/';
  if (data.type === 'notice' && data.clubId) {
    targetUrl = '/';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      for (var i = 0; i < clients.length; i += 1) {
        var client = clients[i];
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
