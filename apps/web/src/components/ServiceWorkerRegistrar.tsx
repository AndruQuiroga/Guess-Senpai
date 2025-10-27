"use client";

import { useEffect } from "react";

const SERVICE_WORKER_PATH = "/service-worker.js";

export default function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          SERVICE_WORKER_PATH,
        );

        if (cancelled) {
          await registration.unregister();
          return;
        }

        const ready = await navigator.serviceWorker.ready;
        if (!cancelled) {
          ready.update().catch(() => {
            /* noop */
          });
        }
      } catch (error) {
        console.warn("Service worker registration failed", error);
      }
    };

    void register();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        controller.postMessage({ type: "CLIENT_READY" });
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    handleControllerChange();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
