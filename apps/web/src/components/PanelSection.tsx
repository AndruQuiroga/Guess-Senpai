import type { PropsWithChildren } from "react";

interface PanelSectionProps {
  className?: string;
  /**
   * Optional className applied to the inner content wrapper, for spacing
   * utilities that should not affect the panel chrome itself.
   */
  innerClassName?: string;
  /** Use a dashed border for empty or placeholder states. */
  dashed?: boolean;
  /** Optional anchor id (e.g. for #fragment links). */
  id?: string;
}

/**
 * Opaque, matte content panel: charcoal surface, visible 1px border, small
 * radius. Replaces the former translucent "glass" section.
 */
export function PanelSection({
  children,
  className,
  innerClassName,
  dashed = false,
  id,
}: PropsWithChildren<PanelSectionProps>) {
  const base = [
    "panel p-5 sm:p-6",
    dashed ? "border-dashed" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section id={id} className={base}>
      <div className={innerClassName}>{children}</div>
    </section>
  );
}
