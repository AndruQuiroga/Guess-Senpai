"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ComponentProps } from "react";

interface NavLinkProps extends ComponentProps<typeof Link> {
  exact?: boolean;
  isActive?(pathname: string): boolean;
}

export default function NavLink({
  href,
  exact = false,
  isActive: isActiveOverride,
  className,
  children,
  ...rest
}: NavLinkProps) {
  const pathname = usePathname();
  const normalizedHref = typeof href === "string" ? href : href.toString();

  let isActive = false;
  if (isActiveOverride) {
    isActive = isActiveOverride(pathname ?? "");
  } else {
    const currentPath = pathname ?? "";
    if (exact) {
      isActive = currentPath === normalizedHref;
    } else {
      isActive =
        currentPath === normalizedHref ||
        (normalizedHref !== "/" &&
          currentPath.startsWith(`${normalizedHref}/`));
    }
  }

  const baseClasses =
    "inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold transition";
  const activeClasses = "bg-[#383a3c] text-[#f4f0e7]";
  const inactiveClasses = "text-[#c1c2bd] hover:bg-[#2c2f31] hover:text-white";

  const combinedClasses = [
    baseClasses,
    isActive ? activeClasses : inactiveClasses,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      {...rest}
      href={href}
      className={combinedClasses}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
