'use client';

import { useEffect, useState } from 'react';

/** True when viewport is mobile-sized (phones). Used to require download before playback. */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const set = () => setIsMobile(mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, [breakpoint]);

  return isMobile;
}
