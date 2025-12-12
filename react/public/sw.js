// react/public/sw.js

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.message,
      icon: '/uploads/ui/placeholder.png', // Ganti dengan icon logo kamu
      badge: '/uploads/ui/placeholder.png',
      data: {
        url: data.url || '/' // Link tujuan saat diklik
      },
      vibrate: [100, 50, 100],
      actions: [
        {
          action: 'open-notif',
          title: 'Lihat Lelang'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Nimonspedia', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(windowClients => {
      // Cek apakah tab sudah terbuka
      for (let client of windowClients) {
        if (client.url.includes(event.notification.data.url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Jika belum, buka tab baru
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data.url);
      }
    })
  );
});