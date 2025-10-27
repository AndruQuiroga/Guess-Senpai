export type ToastVariant = "default" | "success" | "error";

function ensureToastRoot(): HTMLElement | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const existing = document.getElementById("toast-root");
  if (existing) {
    return existing;
  }

  const root = document.createElement("div");
  root.id = "toast-root";
  root.className =
    "pointer-events-none fixed inset-x-0 top-6 z-[1000] flex flex-col items-center gap-2 px-4";
  document.body.appendChild(root);
  return root;
}

function getVariantClasses(variant: ToastVariant): string {
  switch (variant) {
    case "success":
      return "border-emerald-400/40 bg-emerald-500/20 text-emerald-50";
    case "error":
      return "border-rose-400/40 bg-rose-500/20 text-rose-50";
    default:
      return "border-white/15 bg-white/10 text-white";
  }
}

export function showToast(message: string, variant: ToastVariant = "default"): void {
  if (!message) {
    return;
  }

  const root = ensureToastRoot();
  if (!root) {
    return;
  }

  const toast = document.createElement("div");
  toast.role = "status";
  toast.ariaLive = "polite";
  toast.textContent = message;
  toast.className = `pointer-events-auto inline-flex max-w-full items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium shadow-ambient backdrop-blur transition duration-200 ease-out opacity-0 translate-y-2 ${getVariantClasses(variant)}`;

  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-2");
    toast.classList.add("opacity-100", "translate-y-0");
  });

  window.setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-2");

    const removeTimeout = window.setTimeout(() => {
      toast.remove();
      window.clearTimeout(removeTimeout);
    }, 200);
  }, 3000);
}
