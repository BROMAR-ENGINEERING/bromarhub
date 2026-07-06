/* ============================================================
   BROMAR HUB — Push Notification Subscription
   Add this to your Hub's main JS after the employee logs in.
   V1.01
   ============================================================ */

const BromarPush = (() => {
  // Replace with your VAPID public key (generate with: npx web-push generate-vapid-keys)
  const VAPID_PUBLIC_KEY = 'BEsJ3UDZhyxal0aMxhdsFfmslTpd2ETBS5OhvzaTNS6ukvdrP7C6ikMCKmEaqH6r3GxTMEUvOH02T9DpMnEmuiA';

  const SUPABASE_URL = 'https://iwtvlpfprxqwveqadlwl.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3dHZscGZwcnhxd3ZlcWFkbHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzczMDQsImV4cCI6MjA5MzExMzMwNH0.X6tOhxgFnJDDipltIuILOaZRv4bM4RE9kVV1R_UsE5k';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  async function subscribe(employeeName) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          employee_name: employeeName,
          subscription: sub.toJSON()
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log('Push subscription saved for', employeeName);
      return true;
    } catch (err) {
      console.error('Push subscribe failed:', err);
      return false;
    }
  }

  async function requestPermission(employeeName) {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') return subscribe(employeeName);
    console.warn('Notification permission denied');
    return false;
  }

  return { subscribe, requestPermission };
})();
window.BromarPush = BromarPush;
