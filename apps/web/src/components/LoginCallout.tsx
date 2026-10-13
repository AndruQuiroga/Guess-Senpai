import Link from "next/link";

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

interface LoginCalloutProps {
  className?: string;
}

export function LoginCallout({ className }: LoginCalloutProps): JSX.Element {
  return (
    <div
      className={classNames(
        "w-full max-w-sm rounded-lg border border-[#686b6d] bg-[#242628] p-5 text-[#f4f0e7]",
        "flex flex-col gap-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2c2f31] text-lg text-white">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
          >
            <path
              d="M12 2.75a4.25 4.25 0 0 1 4.25 4.25c0 2.347-1.903 4.25-4.25 4.25S7.75 9.347 7.75 7a4.25 4.25 0 0 1 4.25-4.25Z"
              className="fill-white/95"
            />
            <path
              d="M5.5 19.25c0-2.9 2.462-5.25 5.5-5.25h2c3.038 0 5.5 2.35 5.5 5.25 0 .966-.784 1.75-1.75 1.75h-9.5c-.966 0-1.75-.784-1.75-1.75Z"
              className="fill-white/70"
            />
          </svg>
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#f4f0e7]">
            Sync your streaks
          </p>
          <p className="text-xs leading-relaxed text-[#f4f0e7]">
            Sign in with AniList to save completions and pick up right where you
            left off on any device.
          </p>
        </div>
      </div>
      <Link
        href="/login"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ff7658] bg-[#ff7658] hover:bg-[#ff8a70] px-4 py-2 text-sm font-semibold text-[#27110b] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
      >
        <span>Log in with AniList</span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
        >
          <path
            d="M13.25 6.75 18.5 12l-5.25 5.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.5 12h12.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </Link>
    </div>
  );
}
