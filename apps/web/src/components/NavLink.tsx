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
        (normalizedHref !== "/" && currentPath.startsWith(`${normalizedHref}/`));
    }
  }

  const baseClasses =
    "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300";
  const activeClasses = "bg-white/20 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.18)]";
  const inactiveClasses = "text-neutral-300 hover:bg-white/10 hover:text-white";

  const combinedClasses = [baseClasses, isActive ? activeClasses : inactiveClasses, className]
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
