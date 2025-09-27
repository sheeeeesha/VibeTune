"use client";
import React from "react";
import { motion } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useMixer, LayerKey } from "@/store/useMixer";
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
        <div className="flex flex-col gap-2 sm:gap-3 w-full max-w-4xl">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm disabled:opacity-50 w-full sm:w-auto"
                    onClick={isPlaying ? stop : play}
                    disabled={!isReady}
                >
                    {isPlaying ? "Stop All" : "Run All"}
                </motion.button>
                <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
                    {Object.entries(layers).map(([key, state]) => (
                        <button
                            key={key}
                            className={`px-2 py-1 rounded text-xs border ${state.enabled ? "bg-neutral-800 border-neutral-700" : "bg-neutral-900 border-neutral-800 text-neutral-400"}`}
                            onClick={() => toggleLayer(key as LayerKey)}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 items-center">
                {(['beats','bass','melody','vocals'] as LayerKey[]).map((k) => (
                    <div key={k} className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
                        <span className="w-12 sm:w-14 text-xs capitalize text-neutral-300 text-center sm:text-left">{k}</span>
                        <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <input type="range" min={0} max={1} step={0.01}
                                   value={volumes[k]}
                                   onChange={(e) => setLayerVolume(k, Number(e.target.value))}
                                   className="flex-1 sm:w-16"
                                />
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content sideOffset={6} className="text-xs px-2 py-1 rounded bg-neutral-800 border border-neutral-700">
                                  Adjust {k} level
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                            <button className="text-xs px-1 sm:px-2 py-1 rounded border border-neutral-700 flex-shrink-0" onClick={() => toggleSolo(k)}>Solo</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                <span className="text-xs text-neutral-300 w-16 sm:w-auto">Crossfader</span>
                <div className="flex items-center gap-2 w-full">
                    <input type="range" min={0} max={1} step={0.01} value={crossfade} onChange={(e) => setCrossfade(Number(e.target.value))} className="flex-1 sm:w-64" />
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 text-xs text-neutral-400 min-w-0">
                        <span className="whitespace-nowrap">A (Beats+Bass)</span>
                        <span className="whitespace-nowrap">B (Melody+Vocals)</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                <span className="text-xs text-neutral-300 w-16 sm:w-auto">Master</span>
                <input type="range" min={0} max={1} step={0.01} defaultValue={1} onChange={(e) => setMasterVolume(Number(e.target.value))} className="flex-1 sm:w-64" />
            </div>
        </div>
    );
}


