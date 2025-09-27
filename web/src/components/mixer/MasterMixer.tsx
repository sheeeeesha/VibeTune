"use client";
import React from "react";
import { motion } from "framer-motion";
import MixerToolbar from "@/components/mixer/MixerToolbar";
import PixelWaveform from "@/components/PixelWaveform";
import { useMixerEngine } from "@/audio/useMixerEngine";

export default function MasterMixer() {
    const { isPlaying } = useMixerEngine();

    return (
        <motion.section 
            className="rounded-xl sm:rounded-2xl border border-neutral-800 p-3 sm:p-6 bg-neutral-900/40 shadow-[0_0_40px_-20px_rgba(234,179,8,.4)] flex flex-col gap-3 sm:gap-4"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
            <div className="text-center">
                <h3 className="text-lg sm:text-xl font-semibold text-indigo-200">Master Mixer</h3>
                <p className="text-xs sm:text-sm text-neutral-400">Control all layers • Play together in perfect sync</p>
            </div>
            
            <div className="flex justify-center">
                <PixelWaveform isPlaying={isPlaying} intensity={isPlaying ? 0.8 : 0.2} />
            </div>
            
            <div className="flex justify-center pt-1 sm:pt-2">
                <MixerToolbar />
            </div>
            
            <p className="text-center text-xs text-neutral-500">Generate some layers first to start mixing your track</p>
        </motion.section>
    );
}


