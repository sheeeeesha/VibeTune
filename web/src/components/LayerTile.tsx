"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import toast from "react-hot-toast";
import Waveform from "@/components/Waveform";
import PixelWaveform from "@/components/PixelWaveform";
import { useMixer, LayerKey } from "@/store/useMixer";

type Props = {
    title: string;
    subtitle?: string;
    icon?: string; // simple emoji or icon char
    layer: LayerKey;
};

export default function LayerTile({ title, subtitle, icon = "🎵", layer }: Props) {
	const [file, setFile] = useState<File | null>(null);
	const [recording, setRecording] = useState(false);
	const [blobUrl, setBlobUrl] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const { layers, setLayerUrl } = useMixer();
    const [durationSec, setDurationSec] = useState<number | undefined>();

	useEffect(() => {
		return () => {
			if (blobUrl) URL.revokeObjectURL(blobUrl);
		};
	}, [blobUrl]);

    async function startRecording() {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const mr = new MediaRecorder(stream);
		chunksRef.current = [];
		mr.ondataavailable = (e) => {
			if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
		};
		mr.onstop = () => {
			const blob = new Blob(chunksRef.current, { type: "audio/webm" });
			const url = URL.createObjectURL(blob);
			setBlobUrl(url);
			setFile(new File([blob], "mic.webm", { type: "audio/webm" }));
            // compute duration
            const a = new Audio(url);
            a.onloadedmetadata = () => setDurationSec(Math.max(1, Math.floor(a.duration)) || 30);
		};
		mediaRecorderRef.current = mr;
		mr.start();
		setRecording(true);
	}

	function stopRecording() {
		mediaRecorderRef.current?.stop();
		setRecording(false);
	}

    async function handleGenerate() {
        setError(null);
        if (!file) {
            setError("Please upload or record audio first.");
            return;
        }
        const apiBase = process.env.NEXT_PUBLIC_API_BASE;
        if (!apiBase) {
            setError("Missing NEXT_PUBLIC_API_BASE. Set it in web/.env.local and restart.");
            return;
        }
        setLoading(true);
        const t = toast.loading(`Generating ${title}...`);
		const form = new FormData();
		form.append("audio", file);
        try {
            const url = `${apiBase}/generate/${layer}`;
            if (durationSec) form.append("durationSeconds", String(durationSec));
            // server defaults: strength=0.5, guidance=5, steps=8, seed=42 but can be overridden:
            form.append("strength", "0.6");
            form.append("guidanceScale", "5");
            form.append("numInferenceSteps", "8");
            form.append("seed", String(Math.floor(Math.random() * 1000000))); // Random seed for variation
            const resp = await fetch(url, { method: "POST", body: form });
            if (!resp.ok) {
                const text = await resp.text();
                let extra = "";
                try {
                    const j = JSON.parse(text);
                    extra = j?.details || j?.error || text;
                } catch {
                    extra = text;
                }
                console.error("Generation failed:", resp.status, extra);
                setError(`Generation failed (${resp.status}) - ${extra}`);
                toast.error(`Failed to generate ${title}`);
                return;
            }
            const data = await resp.json();
            if (data?.audioUrl) {
                setLayerUrl(layer, data.audioUrl);
                toast.success(`${title} ready!`);
            } else {
                setError("Server did not return audioUrl.");
                toast.error("No audioUrl from server");
            }
        } catch (e) {
            console.error(e);
            setError("Network error. Check API server and CORS.");
            toast.error("Network error");
        } finally {
            setLoading(false);
            toast.dismiss(t);
        }
	}

    return (
        <motion.div
            className="rounded-xl sm:rounded-2xl border border-neutral-800 p-3 sm:p-5 bg-neutral-900/40 flex flex-col gap-3 sm:gap-4 shadow-[0_0_40px_-20px_rgba(168,85,247,.4)]"
            whileHover={{ y: -2, boxShadow: "0 0 60px -18px rgba(99,102,241,.45)" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg grid place-items-center text-lg sm:text-xl bg-neutral-800/70 flex-shrink-0">
                        <span aria-hidden>{icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-semibold leading-5 sm:leading-6">{title}</h3>
                        {subtitle ? (
                            <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">{subtitle}</p>
                        ) : null}
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 ml-2">
                    <div className="flex items-center gap-1 sm:gap-2">
                        <label className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-800 cursor-pointer border border-neutral-700 inline-flex items-center gap-1">
                            <input
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                onChange={(e) => {
                                    setError(null);
                                    const f = e.target.files?.[0] ?? null;
                                    setFile(f);
                                    if (f) {
                                        const url = URL.createObjectURL(f);
                                        const a = new Audio(url);
                                        a.onloadedmetadata = () => setDurationSec(Math.max(1, Math.floor(a.duration)) || 30);
                                    } else {
                                        setDurationSec(undefined);
                                    }
                                }}
                                disabled={loading}
                            />
                            <span className="hidden sm:inline">Upload Audio</span>
                            <span className="sm:hidden">Upload</span>
                        </label>
                        {!recording ? (
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <button onClick={startRecording} disabled={loading} className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700 inline-flex items-center gap-1 disabled:opacity-50">
                                        <span className="hidden sm:inline">Record Audio</span>
                                        <span className="sm:hidden">Record</span>
                                    </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                    <Tooltip.Content sideOffset={6} className="text-xs px-2 py-1 rounded bg-neutral-800 border border-neutral-700">
                                        Record a short idea and turn it into {title.toLowerCase()}
                                    </Tooltip.Content>
                                </Tooltip.Portal>
                            </Tooltip.Root>
                        ) : (
                            <button onClick={stopRecording} className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500">Stop</button>
                        )}
                    </div>
                    <motion.button 
                        whileTap={{ scale: 0.98 }} 
                        onClick={handleGenerate} 
                        disabled={loading} 
                        className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 w-full sm:w-auto"
                    >
                        {loading ? "Generating..." : "Generate"}
                    </motion.button>
                </div>
            </div>

            {file ? (
                <div className="text-xs text-neutral-400 -mt-2">Selected: {file.name}</div>
            ) : null}
            {error ? (
                <div className="text-xs text-rose-400">{error}</div>
            ) : null}

            {durationSec ? (
                <div className="text-xs text-neutral-400 -mt-1">Duration detected: {durationSec}s</div>
            ) : null}

            {layers[layer]?.audioUrl ? (
                <div className="space-y-2 sm:space-y-3">
                    <audio 
                        controls 
                        src={layers[layer]?.audioUrl} 
                        className="w-full h-8 sm:h-10"
                        onPlay={() => setPlaying(true)}
                        onPause={() => setPlaying(false)}
                        onEnded={() => setPlaying(false)}
                    />
                    <div className="space-y-1 sm:space-y-2">
                        <PixelWaveform isPlaying={playing} intensity={0.7} />
                        <Waveform audioUrl={layers[layer].audioUrl as string} />
                    </div>
                </div>
            ) : (
                <div className="space-y-2 sm:space-y-3">
                    <div className="text-xs sm:text-sm text-neutral-400">Upload audio or record to generate AI {title.toLowerCase()}</div>
                    <PixelWaveform isPlaying={false} intensity={0.1} />
                </div>
            )}
        </motion.div>
	);
}


