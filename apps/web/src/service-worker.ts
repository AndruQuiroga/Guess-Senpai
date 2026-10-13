/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

declare global {
  interface NotificationAction {
    action: string;
    title: string;
    icon?: string;
  }
  interface NotificationOptions {
    renotify?: boolean;
    actions?: NotificationAction[];
  }
}

const CACHE_PREFIX = "guesssenpai";
const CACHE_VERSION = "v2";
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const STATIC_ASSETS: string[] = [
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/maskable-icon.svg",
];

interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
  actions?: PushAction[];
}

async function cacheFirst(
  cacheName: string,
  request: Request,
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  cache.put(request, response.clone()).catch(() => {
    /* noop */
  });
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {
        /* noop */
      })
      .finally(() => {
        void self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_next/static/")) {
      event.respondWith(cacheFirst(STATIC_CACHE, request));
      return;
    }
    if (STATIC_ASSETS.includes(url.pathname)) {
      event.respondWith(cacheFirst(STATIC_CACHE, request));
      return;
    }
    // HTML is dynamic and may contain a daily snapshot or account state.
    // Leave it to the browser network path; only static assets are cached.
  }

  // Daily data and account progress are always fetched from the network. A
  // shared cache can otherwise leak stale or cross-account puzzle state.
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    event.waitUntil(
      self.registration.showNotification("GuessSenpai", {
        body: "New puzzles are ready to play!",
        icon: "/icons/icon-192.svg",
        badge: "/icons/icon-192.svg",
        tag: "guesssenpai-daily",
      }),
    );
    return;
  }

  let payload: PushPayload | null = null;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    const text = event.data.text();
    payload = { title: "GuessSenpai", body: text };
  }

  const title = payload?.title ?? "GuessSenpai";
  const explicitUrl =
    typeof payload?.url === "string" ? payload.url : undefined;
  const dataUrl = (() => {
    if (!payload?.data) {
      return undefined;
    }
    const candidate = (payload.data as Record<string, unknown>).url;
    return typeof candidate === "string" ? candidate : undefined;
  })();
  const notificationUrl = explicitUrl ?? dataUrl;

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload?.body,
      icon: payload?.icon ?? "/icons/icon-192.svg",
      badge: payload?.badge ?? "/icons/icon-192.svg",
      tag: payload?.tag ?? "guesssenpai-daily",
      renotify: payload?.renotify ?? false,
      requireInteraction: payload?.requireInteraction ?? false,
      data: { ...payload?.data, url: notificationUrl },
      actions: payload?.actions,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const targetUrl =
    (event.notification.data && typeof event.notification.data.url === "string"
      ? (event.notification.data.url as string)
      : undefined) ?? self.location.origin;

  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            const clientUrl = new URL(client.url);
            if (
              clientUrl.href === targetUrl ||
              clientUrl.pathname === targetUrl
            ) {
              return client.focus();
            }
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
      .catch(() => undefined),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) {
    return;
  }
  if (event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

export {};
