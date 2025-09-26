"use client";
import React, { useEffect, useRef, useState } from "react";

type PixelWaveformProps = {
  isPlaying?: boolean;
  intensity?: number;
  className?: string;
};

export default function PixelWaveform({ 
  isPlaying = false, 
  intensity = 0.5, 
  className = "" 
}: PixelWaveformProps) {
  const [bars, setBars] = useState<number[]>([]);
  const animationRef = useRef<number>();

  const generateBars = () => {
    const newBars = Array.from({ length: 40 }, () => {
      const baseHeight = Math.random() * intensity * 80 + 10;
      return Math.floor(baseHeight / 4) * 4; // Snap to 4px increments for pixel effect
    });
    setBars(newBars);
  };

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        generateBars();
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setBars(Array.from({ length: 40 }, () => 4));
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, intensity]);

  const renderPixelBar = (height: number, index: number) => {
    const pixels = Math.floor(height / 4);
    const topPixels = Math.floor(pixels / 2);
    const bottomPixels = pixels - topPixels;

    return (
      <div key={index} className="flex flex-col items-center gap-0">
        {/* Top half pixels */}
        <div className="flex flex-col">
          {Array.from({ length: topPixels }, (_, i) => (
            <div
              key={`top-${i}`}
              className="w-3 h-1 transition-all duration-100 ease-out"
              style={{
                background: `linear-gradient(90deg, 
                  hsl(${280 + (i * 20)}, 70%, ${50 + (i * 10)}%) 0%,
                  hsl(${320 + (i * 15)}, 80%, ${60 + (i * 8)}%) 100%)`
              }}
            />
          ))}
        </div>

        {/* Center line */}
        <div className="w-3 h-0.5 bg-purple-600" />

        {/* Bottom half pixels */}
        <div className="flex flex-col">
          {Array.from({ length: bottomPixels }, (_, i) => (
            <div
              key={`bottom-${i}`}
              className="w-3 h-1 transition-all duration-100 ease-out"
              style={{
                background: `linear-gradient(90deg, 
                  hsl(${280 + (i * 20)}, 70%, ${50 + (i * 10)}%) 0%,
                  hsl(${320 + (i * 15)}, 80%, ${60 + (i * 8)}%) 100%)`
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex items-center justify-center h-20 ${className}`}>
      <div className="flex items-center gap-0.5 h-full">
        {bars.map((height, index) => renderPixelBar(height, index))}
      </div>
    </div>
  );
}
