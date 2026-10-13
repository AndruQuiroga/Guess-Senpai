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
      return "border-[#3f8a5f] bg-[#1f3a2c] text-emerald-50";
    case "error":
      return "border-[#c0566a] bg-[#40242a] text-rose-50";
    default:
      return "border-[#686b6d] bg-[#2c2f31] text-white";
  }
}

export function showToast(
  message: string,
  variant: ToastVariant = "default",
): void {
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
  toast.className = `pointer-events-auto inline-flex max-w-full items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition duration-200 ease-out opacity-0 translate-y-2 ${getVariantClasses(variant)}`;

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
