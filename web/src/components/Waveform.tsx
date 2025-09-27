"use client";
import React, { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

type WaveformProps = {
	audioUrl: string;
	height?: number;
	progressColor?: string;
	waveColor?: string;
};

export default function Waveform({
	audioUrl,
	height = 64,
	progressColor = "#22c55e",
	waveColor = "#9ca3af",
}: WaveformProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const wavesurferRef = useRef<WaveSurfer | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;
		
		// Responsive height based on screen size
		const responsiveHeight = window.innerWidth < 640 ? height * 0.75 : height;
		
		const ws = WaveSurfer.create({
			container: containerRef.current,
			height: responsiveHeight,
			progressColor,
			waveColor,
			cursorWidth: 1,
			barWidth: window.innerWidth < 640 ? 1 : 2,
		});
		wavesurferRef.current = ws;
		ws.load(audioUrl);
		return () => {
			ws.destroy();
			wavesurferRef.current = null;
		};
	}, [audioUrl, height, progressColor, waveColor]);

	return <div ref={containerRef} className="w-full" />;
}


