"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import AccountBadge from "./AccountBadge";
import NavLink from "./NavLink";

export interface PrimaryNavControls {
  open(): void;
  close(): void;
  toggle(): void;
}

interface PrimaryNavProps {
  archiveDate: string;
  mobileMenuId?: string;
  onMobileStateChange?(isOpen: boolean): void;
  registerMobileControls?(controls: PrimaryNavControls | null): void;
}

export default function PrimaryNav({
  archiveDate,
  mobileMenuId,
  onMobileStateChange,
  registerMobileControls,
}: PrimaryNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const generatedMenuId = useId();
  const menuId = mobileMenuId ?? generatedMenuId;

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((previous) => !previous), []);

  useEffect(() => {
    registerMobileControls?.({ open, close, toggle });
    return () => {
      registerMobileControls?.(null);
    };
  }, [registerMobileControls, open, close, toggle]);

  useEffect(() => {
    onMobileStateChange?.(isOpen);
  }, [isOpen, onMobileStateChange]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    close();
  }, [pathname, isOpen, close]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const drawer = drawerRef.current;
    if (!drawer) {
      return;
    }

    lastFocusedElementRef.current =
      document.activeElement as HTMLElement | null;

    const focusFirstElement = () => {
      const focusable = getFocusableElements(drawer);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        drawer.focus();
      }
    };

    const raf = window.requestAnimationFrame(focusFirstElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(drawer);
      if (focusable.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || active === drawer) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("overflow-hidden");

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("overflow-hidden");
      if (lastFocusedElementRef.current instanceof HTMLElement) {
        lastFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, close]);

  return (
    <>
      <nav className="hidden items-center gap-2 text-sm md:flex">
        <NavLink href="/" exact>
          Home
        </NavLink>
        <NavLink href="/games/daily">Daily Challenge</NavLink>
        <NavLink
          href="/games"
          isActive={(currentPathname) =>
            currentPathname === "/games" ||
            (currentPathname.startsWith("/games/") &&
              !currentPathname.startsWith("/games/daily"))
          }
        >
          Games
        </NavLink>
        <NavLink href="/how-to-play">How to Play</NavLink>
        <NavLink
          href={`/archive?selected=${encodeURIComponent(archiveDate)}`}
          isActive={(currentPathname) =>
            currentPathname === "/archive" ||
            currentPathname.startsWith("/archive/")
          }
        >
          Archive
        </NavLink>
        <AccountBadge />
      </nav>

      <div className="md:hidden" aria-hidden={isOpen ? undefined : true}>
        <div
          className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
            isOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          onClick={close}
          aria-hidden="true"
        />
        <div
          ref={drawerRef}
          id={menuId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${menuId}-heading`}
          tabIndex={-1}
          className={`fixed inset-x-4 top-28 z-50 origin-top rounded-3xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl transition-all duration-200 ${
            isOpen
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-4 opacity-0"
          }`}
        >
          <div className="mb-6 flex items-center justify-between">
            <h2
              id={`${menuId}-heading`}
              className="text-sm font-semibold uppercase tracking-widest text-neutral-300"
            >
              Menu
            </h2>
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-neutral-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            >
              Close
            </button>
          </div>
          <div className="flex flex-col gap-3 text-base">
            <NavLink href="/" exact className="justify-between">
              Home
            </NavLink>
            <NavLink href="/games/daily" className="justify-between">
              Daily Challenge
            </NavLink>
            <NavLink
              href="/games"
              className="justify-between"
              isActive={(currentPathname) =>
                currentPathname === "/games" ||
                (currentPathname.startsWith("/games/") &&
                  !currentPathname.startsWith("/games/daily"))
              }
            >
              Games
            </NavLink>
            <NavLink href="/how-to-play" className="justify-between">
              How to Play
            </NavLink>
            <NavLink
              href={`/archive?selected=${encodeURIComponent(archiveDate)}`}
              className="justify-between"
              isActive={(currentPathname) =>
                currentPathname === "/archive" ||
                currentPathname.startsWith("/archive/")
              }
            >
              Archive
            </NavLink>
            <div className="pt-2">
              <AccountBadge />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors =
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelectors),
  );
  return elements.filter(
    (element) => !element.hasAttribute("data-focus-guard"),
  );
}
