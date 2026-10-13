"use client";

import { useCallback, useId, useRef, useState } from "react";

import PrimaryNav, { PrimaryNavControls } from "./PrimaryNav";

interface HeaderNavigationProps {
  archiveDate: string;
}

export default function HeaderNavigation({
  archiveDate,
}: HeaderNavigationProps) {
  const menuId = useId();
  const controlsRef = useRef<PrimaryNavControls | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleRegisterControls = useCallback(
    (controls: PrimaryNavControls | null) => {
      controlsRef.current = controls;
    },
    [],
  );

  const handleToggle = useCallback(() => {
    controlsRef.current?.toggle();
  }, []);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleToggle}
        aria-controls={menuId}
        aria-expanded={isOpen}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#484b4d] bg-[#242628] text-[#f4f0e7] transition md:hidden ${
          isOpen ? "bg-[#2c2f31] text-brand-200" : "hover:bg-[#2c2f31]"
        }`}
      >
        <span className="sr-only">Toggle navigation menu</span>
        <span
          aria-hidden="true"
          className="flex flex-col items-center justify-center gap-1"
        >
          <span
            className={`h-0.5 w-5 rounded-full bg-current transition-transform ${
              isOpen ? "translate-y-1.5 rotate-45" : ""
            }`}
          />
          <span
            className={`h-0.5 w-5 rounded-full bg-current transition-opacity ${
              isOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`h-0.5 w-5 rounded-full bg-current transition-transform ${
              isOpen ? "-translate-y-1.5 -rotate-45" : ""
            }`}
          />
        </span>
      </button>
      <PrimaryNav
        archiveDate={archiveDate}
        mobileMenuId={menuId}
        onMobileStateChange={setIsOpen}
        registerMobileControls={handleRegisterControls}
      />
    </div>
  );
}
