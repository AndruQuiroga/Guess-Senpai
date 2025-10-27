import { useEffect, useRef, useState } from "react";

export type CelebrationStatus = "not-started" | "in-progress" | "completed";

export interface CelebrationOptions {
  /**
   * Duration in milliseconds to keep the celebratory effect active before
   * automatically clearing it. Defaults to 1.2s which lines up with the
   * framer-motion pulse animation in the timeline cards.
   */
  duration?: number;
}

export function useCelebration(
  status: CelebrationStatus,
  options?: CelebrationOptions,
): boolean {
  const { duration = 1200 } = options ?? {};
  const [isCelebrating, setIsCelebrating] = useState(false);
  const hasCelebratedRef = useRef(false);

  useEffect(() => {
    if (status === "completed" && !hasCelebratedRef.current) {
      setIsCelebrating(true);
      hasCelebratedRef.current = true;

      const timeout = window.setTimeout(() => {
        setIsCelebrating(false);
      }, duration);

      return () => window.clearTimeout(timeout);
    }

    if (status !== "completed") {
      hasCelebratedRef.current = false;
      setIsCelebrating(false);
    }

    return undefined;
  }, [duration, status]);

  return isCelebrating;
}

