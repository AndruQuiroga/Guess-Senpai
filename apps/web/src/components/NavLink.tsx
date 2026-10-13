"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ComponentProps } from "react";

interface NavLinkProps extends ComponentProps<typeof Link> {
  exact?: boolean;
  isActive?(pathname: string): boolean;
  /** Classes applied while active / inactive; defaults suit the sidebar. */
  activeClassName?: string;
  inactiveClassName?: string;
}

export function matchesPath(
  pathname: string,
  href: string,
  exact: boolean,
): boolean {
  const target = href.split(/[?#]/)[0] || "/";
  if (exact || target === "/") return pathname === target;
  return pathname === target || pathname.startsWith(`${target}/`);
}

export default function NavLink({
  href,
  exact = false,
  isActive: isActiveOverride,
  activeClassName = "bg-panel-raised text-paper shadow-[inset_3px_0_0_var(--signal)]",
  inactiveClassName = "text-muted hover:bg-hover hover:text-paper",
  className,
  children,
  ...rest
}: NavLinkProps) {
  const pathname = usePathname() ?? "";
  const hrefString = typeof href === "string" ? href : (href.pathname ?? "/");
  const isActive = isActiveOverride
    ? isActiveOverride(pathname)
    : matchesPath(pathname, hrefString, exact);

  const combinedClasses = [
    "inline-flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition",
    isActive ? activeClassName : inactiveClassName,
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
