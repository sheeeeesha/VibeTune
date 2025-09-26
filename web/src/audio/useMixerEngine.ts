"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMixer, LayerKey } from "@/store/useMixer";

type SourceMap = Partial<Record<LayerKey, AudioBufferSourceNode>>;
type GainMap = Partial<Record<LayerKey, GainNode>>;

export function useMixerEngine() {
    const { layers } = useMixer();
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [volumes, setVolumes] = useState<Record<LayerKey, number>>({
        beats: 0.9,
        bass: 0.9,
        melody: 0.9,
        vocals: 0.9,
    });
    const [crossfade, setCrossfade] = useState(0.5); // 0=>A(beats+bass), 1=>B(melody+vocals)

    const audioCtxRef = useRef<AudioContext | null>(null);
    const masterGainRef = useRef<GainNode | null>(null);
    const gainsRef = useRef<GainMap>({});
    const buffersRef = useRef<Partial<Record<LayerKey, AudioBuffer>>>({});
    const sourcesRef = useRef<SourceMap>({});

    // Init context once
    useEffect(() => {
        if (!audioCtxRef.current) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioCtxRef.current = ctx;
            const master = ctx.createGain();
            master.gain.value = 1;
            master.connect(ctx.destination);
            masterGainRef.current = master;

            (['beats','bass','melody','vocals'] as LayerKey[]).forEach((k) => {
                const g = ctx.createGain();
                g.gain.value = volumes[k];
                g.connect(master);
                gainsRef.current[k] = g;
            });
        }
    }, []);

    // Load/refresh buffers on URL change
    useEffect(() => {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        let cancelled = false;

        async function load(key: LayerKey, url: string) {
            try {
                const res = await fetch(url, { cache: 'no-store' });
                const arr = await res.arrayBuffer();
                const buf = await ctx.decodeAudioData(arr);
                if (!cancelled) buffersRef.current[key] = buf;
            } catch (e) {
                console.error('decode error', key, e);
            }
        }

        const jobs: Promise<any>[] = [];
        (Object.keys(layers) as LayerKey[]).forEach((k) => {
            const url = layers[k].audioUrl;
            if (url) jobs.push(load(k, url));
        });

        Promise.all(jobs).then(() => {
            if (!cancelled) setIsReady(true);
        });

        return () => { cancelled = true; };
    }, [layers]);

    // Apply volume changes
    useEffect(() => {
        (Object.keys(volumes) as LayerKey[]).forEach((k) => {
            const g = gainsRef.current[k];
            if (g) g.gain.setTargetAtTime(volumes[k], audioCtxRef.current!.currentTime, 0.01);
        });
    }, [volumes]);

    // Crossfader: group A (beats+bass) vs B (melody+vocals)
    useEffect(() => {
        const a = 1 - crossfade; // A level
        const b = crossfade;    // B level
        const apply = (k: LayerKey, level: number) => {
            const base = volumes[k];
            const g = gainsRef.current[k];
            if (g) g.gain.setTargetAtTime(base * level, audioCtxRef.current!.currentTime, 0.01);
        };
        apply('beats', a);
        apply('bass', a);
        apply('melody', b);
        apply('vocals', b);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [crossfade]);

    function stop() {
        Object.values(sourcesRef.current).forEach((s) => {
            try { s?.stop(); } catch {}
        });
        sourcesRef.current = {};
        setIsPlaying(false);
    }

    async function play() {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        stop(); // reset previous sources
        const startAt = ctx.currentTime + 0.15;
        (['beats','bass','melody','vocals'] as LayerKey[]).forEach((k) => {
            const buf = buffersRef.current[k];
            if (!buf) return;
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(gainsRef.current[k]!);
            src.start(startAt);
            sourcesRef.current[k] = src;
        });
        setIsPlaying(true);
    }

    function setLayerVolume(key: LayerKey, value: number) {
        setVolumes((v) => ({ ...v, [key]: Math.max(0, Math.min(1, value)) }));
    }

    function setMasterVolume(value: number) {
        const master = masterGainRef.current;
        if (master) master.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), audioCtxRef.current!.currentTime, 0.01);
    }

    function toggleSolo(key: LayerKey) {
        (['beats','bass','melody','vocals'] as LayerKey[]).forEach((k) => {
            const g = gainsRef.current[k];
            const level = k === key ? volumes[k] : 0;
            if (g) g.gain.setTargetAtTime(level, audioCtxRef.current!.currentTime, 0.01);
        });
    }

    return {
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
    };
}


