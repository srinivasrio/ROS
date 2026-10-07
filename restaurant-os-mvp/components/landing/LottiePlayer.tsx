"use client";

import React, { useEffect, useRef } from "react";
import lottie, { AnimationItem } from "lottie-web";

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
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (animRef.current) {
      animRef.current.destroy();
    }

    try {
      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop,
        autoplay,
        path: animationPath,
        animationData: animationData,
      });
    } catch (err) {
      console.error("Lottie load error:", err);
    }

    return () => {
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [animationPath, animationData, loop, autoplay]);

  return <div ref={containerRef} className={className} />;
};

export default LottiePlayer;
