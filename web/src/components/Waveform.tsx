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
		const ws = WaveSurfer.create({
			container: containerRef.current,
			height,
			progressColor,
			waveColor,
			cursorWidth: 1,
			barWidth: 2,
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


