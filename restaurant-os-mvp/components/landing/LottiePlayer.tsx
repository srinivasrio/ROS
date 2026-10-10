"use client";

import React, { useEffect, useRef } from "react";

interface LottiePlayerProps {
  animationPath?: string;
  animationData?: any;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
}

export const LottiePlayer: React.FC<LottiePlayerProps> = ({
  animationPath,
  animationData,
  loop = true,
  autoplay = true,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    if (!containerRef.current) return;

    const loadAnimation = async () => {
      try {
        let data = animationData;
        if (!data && animationPath) {
          const res = await fetch(animationPath);
          if (res.ok) {
            data = await res.json();
          }
        }
        if (!isMounted || !containerRef.current || !data) return;

        const lottieModule = await import("lottie-web/build/player/lottie_light");
        const lottie = lottieModule.default || lottieModule;

        if (!isMounted || !containerRef.current) return;

        if (animRef.current) {
          try {
            animRef.current.destroy();
          } catch (_) {}
          animRef.current = null;
        }

        animRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop,
          autoplay,
          animationData: data,
        });
      } catch (_) {
        // Silently handle animation load or cancellation
      }
    };

    loadAnimation();

    return () => {
      isMounted = false;
      if (animRef.current) {
        try {
          animRef.current.destroy();
        } catch (_) {}
        animRef.current = null;
      }
    };
  }, [animationPath, animationData, loop, autoplay]);

  return <div ref={containerRef} className={className} />;
};

export default LottiePlayer;
