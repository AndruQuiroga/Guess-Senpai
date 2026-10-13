import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  Ref,
} from "react";

export function Panel({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`panel ${className}`.trim()} {...props} />;
}

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`.trim()} {...props} />;
}

export function Field({
  label,
  id,
  description,
  children,
  className = "",
}: {
  label: string;
  id: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={id} className="block text-sm font-semibold text-paper">
        {label}
      </label>
      {children}
      {description ? <p className="text-sm text-muted">{description}</p> : null}
    </div>
  );
}

export function Status({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`status-pill ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

export function Dialog({
  labelledBy,
  describedBy,
  dialogRef,
  className = "",
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  dialogRef?: Ref<HTMLDivElement>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      tabIndex={-1}
      className={`max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain ${className}`.trim()}
    >
      {children}
    </div>
  );
}
