"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY || "";

interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: PushSubscriptionKeys;
}

interface SubscriptionRequestPayload {
  subscription: PushSubscriptionJSON;
  userAgent?: string;
}

interface UseNotificationOptInResult {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  requestOptIn: () => Promise<boolean>;
  cancelOptIn: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function postSubscription(payload: SubscriptionRequestPayload): Promise<Response> {
  return fetch(`${API_BASE}/notifications/subscribe`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function postUnsubscribe(endpoint: string): Promise<Response> {
  return fetch(`${API_BASE}/notifications/unsubscribe`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

export function useNotificationOptIn(): UseNotificationOptInResult {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vapidKey = useMemo(() => PUBLIC_VAPID_KEY.trim(), []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);
    if (!supported) {
      return;
    }
    setPermission(Notification.permission);

    let cancelled = false;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) {
          setIsSubscribed(Boolean(subscription));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsSubscribed(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    if (typeof window === "undefined" || !isSupported) {
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(Boolean(subscription));
      setPermission(Notification.permission);
    } catch (refreshError) {
      console.warn("Unable to refresh push subscription", refreshError);
    }
  }, [isSupported]);

  const requestOptIn = useCallback(async () => {
    if (!isSupported) {
      setError("Push notifications are not supported on this device.");
      return false;
    }
    if (!vapidKey) {
      setError("Push notifications are temporarily unavailable.");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        setError("Notifications are disabled. Update your browser permissions to enable alerts.");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));

      const payload: SubscriptionRequestPayload = {
        subscription: subscription.toJSON() as PushSubscriptionJSON,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      };

      const response = await postSubscription(payload);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Subscription failed with status ${response.status}`);
      }

      setIsSubscribed(true);
      return true;
    } catch (subscribeError) {
      console.warn("Failed to enable push notifications", subscribeError);
      setError(
        subscribeError instanceof Error
          ? subscribeError.message
          : "Failed to enable push notifications.",
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidKey]);

  const cancelOptIn = useCallback(async () => {
    if (!isSupported) {
      return false;
    }
    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return true;
      }
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe().catch(() => {
        /* noop */
      });
      const response = await postUnsubscribe(endpoint);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Unsubscribe failed with status ${response.status}`);
      }
      setIsSubscribed(false);
      return true;
    } catch (unsubscribeError) {
      console.warn("Failed to disable push notifications", unsubscribeError);
      setError(
        unsubscribeError instanceof Error
          ? unsubscribeError.message
          : "Failed to disable push notifications.",
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    requestOptIn,
    cancelOptIn,
    refreshStatus,
  };
}
