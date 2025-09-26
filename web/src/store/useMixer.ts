"use client";
import { create } from "zustand";

export type LayerKey = "beats" | "bass" | "melody" | "vocals";

type LayerState = {
	audioUrl?: string;
	enabled: boolean;
};

type MixerState = {
	layers: Record<LayerKey, LayerState>;
	setLayerUrl: (key: LayerKey, url?: string) => void;
	toggleLayer: (key: LayerKey) => void;
	setEnabled: (key: LayerKey, enabled: boolean) => void;
};

export const useMixer = create<MixerState>((set) => ({
	layers: {
		beats: { enabled: true },
		bass: { enabled: true },
		melody: { enabled: true },
		vocals: { enabled: true },
	},
	setLayerUrl: (key, url) =>
		set((s) => ({ layers: { ...s.layers, [key]: { ...s.layers[key], audioUrl: url } } })),
	toggleLayer: (key) =>
		set((s) => ({ layers: { ...s.layers, [key]: { ...s.layers[key], enabled: !s.layers[key].enabled } } })),
	setEnabled: (key, enabled) =>
		set((s) => ({ layers: { ...s.layers, [key]: { ...s.layers[key], enabled } } })),
}));


