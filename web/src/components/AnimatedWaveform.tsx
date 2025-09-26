"use client";
import React, { useEffect, useRef, useState } from "react";

type AnimatedWaveformProps = {
  isPlaying?: boolean;
  intensity?: number; // 0-1 for animation intensity
  className?: string;
};

export default function AnimatedWaveform({ 
  isPlaying = false, 
  intensity = 0.5, 
  className = "" 
}: AnimatedWaveformProps) {
  const [bars, setBars] = useState<number[]>([]);
  const animationRef = useRef<number | undefined>(undefined);

  // Generate random bar heights for animation
  const generateBars = React.useCallback(() => {
    const newBars = Array.from({ length: 48 }, () => 
      Math.random() * intensity * 100 + 10
    );
    setBars(newBars);
  }, [intensity]);

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
      // Set to minimal bars when not playing
      setBars(Array.from({ length: 48 }, () => 5));
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, generateBars]);

  return (
    <div className={`flex items-center justify-center h-16 ${className}`}>
      <div className="flex items-end gap-1 h-full">
        {bars.map((height, index) => (
          <div key={index} className="flex flex-col items-center">
            {/* Top half */}
            <div 
              className="w-2 transition-all duration-75 ease-out"
              style={{ height: `${height}%` }}
            >
              <div className="h-full bg-gradient-to-b from-purple-600 via-purple-500 to-pink-500 rounded-sm opacity-90" />
            </div>
            
            {/* Bottom half (mirrored) */}
            <div 
              className="w-2 transition-all duration-75 ease-out"
              style={{ height: `${height}%` }}
            >
              <div className="h-full bg-gradient-to-t from-purple-600 via-purple-500 to-pink-500 rounded-sm opacity-90" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
