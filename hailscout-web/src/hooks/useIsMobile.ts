"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 640; // matches Tailwind 'sm'

/**
 * Reactive media-query hook for mobile detection.
 * SSR-safe: returns `false` on the server, then re-renders on the client.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
