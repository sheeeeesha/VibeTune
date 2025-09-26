"use client";
import React from "react";
import { useMixer } from "@/store/useMixer";
import { useMixerEngine } from "@/audio/useMixerEngine";

export default function MixerToolbar() {
    const { layers, toggleLayer } = useMixer();
    const {
        isPlaying,
        isReady,
        play,
        stop,
        setLayerVolume,
        setMasterVolume,
        crossfade,
        setCrossfade,
        volumes,
        toggleSolo,
    } = useMixerEngine();

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <button
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm disabled:opacity-50"
                    onClick={isPlaying ? stop : play}
                    disabled={!isReady}
                >
                    {isPlaying ? "Stop All" : "Run All"}
                </button>
                {Object.entries(layers).map(([key, state]) => (
                    <button
                        key={key}
                        className={`px-2 py-1 rounded text-xs border ${state.enabled ? "bg-neutral-800 border-neutral-700" : "bg-neutral-900 border-neutral-800 text-neutral-400"}`}
                        onClick={() => toggleLayer(key as any)}
                    >
                        {key}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
                {(['beats','bass','melody','vocals'] as any[]).map((k) => (
                    <div key={k} className="flex items-center gap-2">
                        <span className="w-14 text-xs capitalize text-neutral-300">{k}</span>
                        <input type="range" min={0} max={1} step={0.01}
                               value={(volumes as any)[k]}
                               onChange={(e) => setLayerVolume(k, Number(e.target.value))}
                        />
                        <button className="text-xs px-2 py-1 rounded border border-neutral-700" onClick={() => toggleSolo(k)}>Solo</button>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-300">Crossfader</span>
                <input type="range" min={0} max={1} step={0.01} value={crossfade} onChange={(e) => setCrossfade(Number(e.target.value))} className="w-64" />
                <span className="text-xs">A (Beats+Bass)</span>
                <span className="text-xs ml-auto">B (Melody+Vocals)</span>
            </div>

            <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-300">Master</span>
                <input type="range" min={0} max={1} step={0.01} defaultValue={1} onChange={(e) => setMasterVolume(Number(e.target.value))} className="w-64" />
            </div>
        </div>
    );
}


