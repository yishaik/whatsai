import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';

// VAPID public keys are base64url; the Push API wants a Uint8Array.
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
};

const pushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

// Web Push subscription management for reminders. Returns the feature state and
// `enable()` to request permission + subscribe. Self-contained (talks to Convex
// directly). `available` is false until the server reports a VAPID key.
export function usePush() {
  const vapidKey = useQuery(api.pushSubscriptions.getVapidPublicKey);
  const saveSubscription = useMutation(api.pushSubscriptions.savePushSubscription);
  const deleteSubscription = useMutation(api.pushSubscriptions.deletePushSubscription);

  const supported = pushSupported();
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reflect any existing subscription on mount.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (!cancelled) setSubscribed(!!sub); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [supported]);

  const enable = useCallback(async () => {
    setError(null);
    if (!supported) { setError('Notifications are not supported on this device.'); return; }
    if (!vapidKey) { setError('Notifications are not configured on the server yet.'); return; }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission was denied.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!json.endpoint || !p256dh || !auth) {
        setError('Could not read the push subscription.');
        return;
      }
      await saveSubscription({ endpoint: json.endpoint, p256dh, auth });
      setSubscribed(true);
    } catch (err) {
      console.error('Enabling push failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable notifications.');
    } finally {
      setBusy(false);
    }
  }, [supported, vapidKey, saveSubscription]);

  const disable = useCallback(async () => {
    setError(null);
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deleteSubscription({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error('Disabling push failed:', err);
    } finally {
      setBusy(false);
    }
  }, [supported, deleteSubscription]);

  return {
    // Whether the device supports push AND the server has a VAPID key.
    available: supported && !!vapidKey,
    supported,
    subscribed,
    busy,
    error,
    enable,
    disable,
  };
}
