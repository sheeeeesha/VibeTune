"use client";
import React, { useEffect, useRef, useState } from "react";
import Waveform from "@/components/Waveform";
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
		const form = new FormData();
		form.append("audio", file);
        try {
            const url = `${apiBase}/generate/${layer}`;
            if (durationSec) form.append("durationSeconds", String(durationSec));
            // server defaults: strength=0.5, guidance=5, steps=8 but can be overridden:
            form.append("strength", "0.6");
            form.append("guidanceScale", "5");
            form.append("numInferenceSteps", "8");
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
                return;
            }
            const data = await resp.json();
            if (data?.audioUrl) {
                setLayerUrl(layer, data.audioUrl);
            } else {
                setError("Server did not return audioUrl.");
            }
        } catch (e) {
            console.error(e);
            setError("Network error. Check API server and CORS.");
        } finally {
            setLoading(false);
        }
	}

    return (
        <div className="rounded-2xl border border-neutral-800 p-5 bg-neutral-900/40 flex flex-col gap-4 shadow-[0_0_40px_-20px_rgba(168,85,247,.4)]">
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg grid place-items-center text-xl bg-neutral-800/70">
                        <span aria-hidden>{icon}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold leading-6">{title}</h3>
                        {subtitle ? (
                            <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
                        ) : null}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm px-3 py-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-800 cursor-pointer border border-neutral-700 inline-flex items-center gap-1">
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
                        <span>Upload Audio</span>
                    </label>
                    {!recording ? (
                        <button onClick={startRecording} disabled={loading} className="text-sm px-3 py-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700 inline-flex items-center gap-1 disabled:opacity-50">Record Audio</button>
                    ) : (
                        <button onClick={stopRecording} className="text-sm px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500">Stop</button>
                    )}
                    <button onClick={handleGenerate} disabled={loading} className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50">{loading ? "Generating..." : "Generate"}</button>
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
				<div className="space-y-2">
					<audio controls src={layers[layer]?.audioUrl} className="w-full" />
					{layers[layer]?.audioUrl ? <Waveform audioUrl={layers[layer].audioUrl as string} /> : null}
				</div>
			) : (
                <div className="text-sm text-neutral-400">Upload audio or record to generate AI {title.toLowerCase()}</div>
			)}
		</div>
	);
}


