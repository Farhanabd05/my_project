// react/src/utils/pushNotification.js

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  if (!base64String) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is missing in .env file');
  }
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

export async function subscribeUserToPush(userId) {
  if (!('serviceWorker' in navigator)) return;
  
  if (!userId) {
      console.error("Cannot subscribe: Missing User ID");
      return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
      console.warn("Izin notifikasi ditolak oleh user.");
      return; // Berhenti di sini, jangan lanjut error
  }

  try {
    const register = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // 2. Cek apakah subscription SUDAH ADA?
    let subscription = await register.pushManager.getSubscription();

    // Jika belum ada, baru kita buat (subscribe)
    if (!subscription) {
      subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });
      console.log("🆕 Membuat subscription baru...");
    } else {
      console.log("♻️ Menggunakan subscription yang sudah ada.");
    }

    // 3. Kirim ke Server (Hanya kirim endpointnya saja, biarkan server handle duplikat via 'ON CONFLICT')
    // pengecekan localStorage agar tidak spam request ke server setiap refresh
    const lastSubUser = localStorage.getItem('last_sub_user');
    
    // Jika user yg login sekarang BEDA dengan yg terakhir subscribe, ATAU ini subscription baru -> Kirim ke DB
    if (lastSubUser !== String(userId)) {
        await fetch('/api/node/notifications/subscribe', {
          method: 'POST',
          body: JSON.stringify({
            subscription: subscription,
            userId: userId
          }),
          headers: {
            'content-type': 'application/json'
          }
        });
        
        // Simpan flag di localStorage
        localStorage.setItem('last_sub_user', userId);
        console.log(`✅ User ${userId} subscribed to push notifications!`);
    } else {
        console.log("⚡ User sudah tersubscribe di sesi ini (Skip Request ke Server).");
    }

  } catch (error) {
    console.error('Failed to subscribe/check push:', error);
  }
}