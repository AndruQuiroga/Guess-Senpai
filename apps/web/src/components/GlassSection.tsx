import { PropsWithChildren } from "react";

type Accent = "brand" | "emerald" | "rose";

const ACCENT_GRADIENTS: Record<Accent, string> = {
  brand: "from-transparent via-brand-400/70 to-transparent",
  emerald: "from-transparent via-emerald-400/60 to-transparent",
  rose: "from-transparent via-rose-400/60 to-transparent",
};

interface GlassSectionProps {
  className?: string;
  /**
   * Optional className applied to the inner content wrapper. Useful when you
   * need utilities like spacing that shouldn\'t be affected by the decorative
   * elements rendered by the panel itself.
   */
  innerClassName?: string;
  accent?: Accent;
}

export function GlassSection({
  children,
  className,
  innerClassName,
  accent = "brand",
}: PropsWithChildren<GlassSectionProps>) {
  const baseClassName =
    "relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 shadow-ambient backdrop-blur-2xl transition hover:border-brand-400/30 hover:shadow-glow sm:p-8";
  const accentClassName = ACCENT_GRADIENTS[accent] ?? ACCENT_GRADIENTS.brand;

  return (
    <section className={className ? `${baseClassName} ${className}` : baseClassName}>
      <div
        className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r ${accentClassName} opacity-80 sm:inset-x-10`}
      />
      <div className={innerClassName ? `relative z-10 ${innerClassName}` : "relative z-10"}>{children}</div>
    </section>
  );
}
