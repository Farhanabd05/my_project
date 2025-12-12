// php/src/public/push-notif-php.js

const PUBLIC_KEY = 'BEtn-uF1MiuVpXjKoRcZi2tvvsBTewVrgqTg8d6wVnhWk0RBwUxkcNCTy7W8lZq8cPCQP8g1yxVnSCy72zXRSX8'; 

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeUserToPushPHP(userId) {
  if (!('serviceWorker' in navigator)) return;
  
  if (!userId) {
      console.log("Belum login, skip subscribe.");
      return;
  }

  // Cek izin dulu
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
      console.warn("Izin notifikasi ditolak di PHP.");
      return;
  }

  try {
    // Register SW di root PHP (localhost:8082/sw.js)
    const register = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const subscription = await register.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
    });

    // Kirim langsung ke Node.js port 3001
    await fetch('http://localhost:3001/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        subscription: subscription,
        userId: userId
      }),
      headers: {
        'content-type': 'application/json'
      }
    });
    
    console.log(`✅ [PHP] User ${userId} subscribed to push!`);

  } catch (error) {
    console.error('[PHP] Gagal subscribe:', error);
  }
}