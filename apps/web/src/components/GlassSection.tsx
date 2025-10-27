import { PropsWithChildren } from "react";

type Accent = "brand" | "emerald" | "rose";

type BorderIntensity = "none" | "subtle" | "default" | "strong";

const ACCENT_GRADIENTS: Record<Accent, string> = {
  brand: "from-transparent via-brand-400/70 to-transparent",
  emerald: "from-transparent via-emerald-400/60 to-transparent",
  rose: "from-transparent via-rose-400/60 to-transparent",
};

const BORDER_INTENSITY_CLASSES: Record<Exclude<BorderIntensity, "none">, string> = {
  subtle: "border-white/5",
  default: "border-white/10",
  strong: "border-white/20",
};

interface GlassSectionProps {
  className?: string;
  /**
   * Optional className applied to the inner content wrapper. Useful when you
   * need utilities like spacing that shouldn't be affected by the decorative
   * elements rendered by the panel itself.
   */
  innerClassName?: string;
  accent?: Accent;
  /**
   * Controls whether the hover border + glow treatment should be shown.
   */
  hoverGlow?: boolean;
  /**
   * Adjusts the contrast of the border surrounding the panel.
   */
  borderIntensity?: BorderIntensity;
  /**
   * Toggles the decorative accent strip rendered along the top edge.
   */
  showAccent?: boolean;
}

export function GlassSection({
  children,
  className,
  innerClassName,
  accent = "brand",
  hoverGlow = true,
  borderIntensity = "default",
  showAccent = true,
}: PropsWithChildren<GlassSectionProps>) {
  const borderClassName =
    borderIntensity === "none"
      ? "border border-transparent"
      : `border ${BORDER_INTENSITY_CLASSES[borderIntensity]}`;
  const hoverClassName = hoverGlow
    ? "hover:border-brand-400/30 hover:shadow-glow"
    : "";
  const baseClassName = [
    "relative overflow-hidden rounded-3xl bg-surface-raised p-6 shadow-ambient backdrop-blur-2xl transition",
    borderClassName,
    hoverClassName,
    "sm:p-8",
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const accentClassName = ACCENT_GRADIENTS[accent] ?? ACCENT_GRADIENTS.brand;

  return (
    <section className={className ? `${baseClassName} ${className}` : baseClassName}>
      {showAccent ? (
        <div
          className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r ${accentClassName} opacity-80 sm:inset-x-10`}
        />
      ) : null}
      <div className={innerClassName ? `relative z-10 ${innerClassName}` : "relative z-10"}>{children}</div>
    </section>
  );
}
