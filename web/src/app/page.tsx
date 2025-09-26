import LayerTile from "@/components/LayerTile";
import MasterMixer from "@/components/mixer/MasterMixer";

export default function Home() {
  return (
    <main className="min-h-screen p-6 md:p-10 bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-bold">AI Music Playground</h1>
          <p className="text-sm text-neutral-400">Generate beats, bass, melody, and vocals with AI • Build your track layer by layer</p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <LayerTile title="Beats" subtitle="Rhythm & Percussion" icon="🥁" layer="beats" />
          <LayerTile title="Bass" subtitle="Low-end Foundation" icon="🎸" layer="bass" />
          <LayerTile title="Melody" subtitle="Harmonic Elements" icon="🎹" layer="melody" />
          <LayerTile title="Vocals" subtitle="Human Voice Layer" icon="🎤" layer="vocals" />
        </div>
        <MasterMixer />
      </div>
    </main>
  );
}
