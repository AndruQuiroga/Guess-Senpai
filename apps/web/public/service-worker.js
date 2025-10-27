/// <reference lib="webworker" />
const CACHE_PREFIX = "guesssenpai";
const CACHE_VERSION = "v1";
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const DATA_CACHE = `${CACHE_PREFIX}-data-${CACHE_VERSION}`;
const STATIC_ASSETS = [
    "/",
    "/games/daily",
    "/manifest.webmanifest",
    "/icons/icon-192.svg",
    "/icons/icon-512.svg",
    "/icons/maskable-icon.svg",
];
const PUZZLE_PATH_MATCHER = /\/puzzles\/today/;
async function cacheFirst(cacheName, request) {
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
async function networkFirst(cacheName, request) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        cache.put(request, response.clone()).catch(() => {
            /* noop */
        });
        return response;
    }
    catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}
async function networkThenCache(cacheName, request) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        cache.put(request, response.clone()).catch(() => {
            /* noop */
        });
        return response;
    }
    catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}
self.addEventListener("install", (event) => {
    event.waitUntil(caches
        .open(STATIC_CACHE)
        .then((cache) => cache.addAll(STATIC_ASSETS))
        .catch(() => {
        /* noop */
    })
        .finally(() => {
        void self.skipWaiting();
    }));
});
self.addEventListener("activate", (event) => {
    event.waitUntil(caches
        .keys()
        .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE && key !== DATA_CACHE)
        .map((key) => caches.delete(key))))
        .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
    var _a;
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
        const acceptHeader = (_a = request.headers.get("accept")) !== null && _a !== void 0 ? _a : "";
        if (acceptHeader.includes("text/html")) {
            event.respondWith(networkFirst(STATIC_CACHE, request));
            return;
        }
    }
    if (PUZZLE_PATH_MATCHER.test(url.pathname)) {
        event.respondWith(networkThenCache(DATA_CACHE, request));
    }
});
self.addEventListener("push", (event) => {
    var _a, _b, _c, _d, _e, _f;
    if (!event.data) {
        event.waitUntil(self.registration.showNotification("GuessSenpai", {
            body: "New puzzles are ready to play!",
            icon: "/icons/icon-192.svg",
            badge: "/icons/icon-192.svg",
            tag: "guesssenpai-daily",
        }));
        return;
    }
    let payload = null;
    try {
        payload = event.data.json();
    }
    catch {
        const text = event.data.text();
        payload = { title: "GuessSenpai", body: text };
    }
    const title = (_a = payload === null || payload === void 0 ? void 0 : payload.title) !== null && _a !== void 0 ? _a : "GuessSenpai";
    const explicitUrl = typeof (payload === null || payload === void 0 ? void 0 : payload.url) === "string" ? payload.url : undefined;
    const dataUrl = (() => {
        if (!(payload === null || payload === void 0 ? void 0 : payload.data)) {
            return undefined;
        }
        const candidate = payload.data.url;
        return typeof candidate === "string" ? candidate : undefined;
    })();
    const notificationUrl = explicitUrl !== null && explicitUrl !== void 0 ? explicitUrl : dataUrl;
    event.waitUntil(self.registration.showNotification(title, {
        body: payload === null || payload === void 0 ? void 0 : payload.body,
        icon: (_b = payload === null || payload === void 0 ? void 0 : payload.icon) !== null && _b !== void 0 ? _b : "/icons/icon-192.svg",
        badge: (_c = payload === null || payload === void 0 ? void 0 : payload.badge) !== null && _c !== void 0 ? _c : "/icons/icon-192.svg",
        tag: (_d = payload === null || payload === void 0 ? void 0 : payload.tag) !== null && _d !== void 0 ? _d : "guesssenpai-daily",
        renotify: (_e = payload === null || payload === void 0 ? void 0 : payload.renotify) !== null && _e !== void 0 ? _e : false,
        requireInteraction: (_f = payload === null || payload === void 0 ? void 0 : payload.requireInteraction) !== null && _f !== void 0 ? _f : false,
        data: { ...payload === null || payload === void 0 ? void 0 : payload.data, url: notificationUrl },
        actions: payload === null || payload === void 0 ? void 0 : payload.actions,
    }));
});
self.addEventListener("notificationclick", (event) => {
    var _a;
    const targetUrl = (_a = (event.notification.data && typeof event.notification.data.url === "string"
        ? event.notification.data.url
        : undefined)) !== null && _a !== void 0 ? _a : self.location.origin;
    event.notification.close();
    event.waitUntil(self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
        for (const client of clientList) {
            if ("focus" in client) {
                const clientUrl = new URL(client.url);
                if (clientUrl.href === targetUrl || clientUrl.pathname === targetUrl) {
                    return client.focus();
                }
            }
        }
        if (self.clients.openWindow) {
            return self.clients.openWindow(targetUrl);
        }
        return undefined;
    })
        .catch(() => undefined));
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
