"use client";
import React from "react";
import MixerToolbar from "@/components/mixer/MixerToolbar";

export default function MasterMixer() {
    return (
        <section className="rounded-2xl border border-neutral-800 p-6 bg-neutral-900/40 shadow-[0_0_40px_-20px_rgba(234,179,8,.4)] flex flex-col gap-3">
            <h3 className="text-xl font-semibold text-center text-indigo-200">Master Mixer</h3>
            <p className="text-center text-sm text-neutral-400">Control all layers • Play together in perfect sync</p>
            <div className="flex justify-center pt-2">
                <MixerToolbar />
            </div>
            <p className="text-center text-xs text-neutral-500">Generate some layers first to start mixing your track</p>
        </section>
    );
}


