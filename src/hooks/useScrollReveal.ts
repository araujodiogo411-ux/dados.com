import { useEffect, useRef, useState } from 'react';

export function useScrollReveal(threshold = 0.01) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasEntered(true);
          }
        }
      },
      { threshold, rootMargin: '100px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const revealNow = () => {
    setHasEntered(true);
  };

  const replay = () => {
    setHasEntered(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimKey((k) => k + 1);
        setHasEntered(true);
      });
    });
  };

  return { containerRef, isVisible: hasEntered, animKey, replay, revealNow };
}
