/* eslint-disable */
/* eslint-env node */
// Element base prompts
const ELEMENT_PROMPTS = {
  beats: `You are a world-class music producer and rhythm designer working in a professional studio.
Your task is to generate BEATS that align seamlessly with the musical properties of the given input audio.

The generated beats must:
- Match the exact tempo, time signature, and rhythmic groove of the input.
- Stay tightly synchronized with the pulse, downbeats, and phrasing.
- Adapt stylistically to the genre cues (hip-hop, EDM, rock, jazz, pop, trap, funk, cinematic, etc.).
- Reflect the energy level, mood, and dynamics of the track (e.g., hard-hitting, minimal, driving, laid-back).
- Sound crisp, punchy, and professionally mixed, avoiding muddiness, distortion, or off-tempo hits.
- Be clean, production-ready, and balanced for immediate integration into a mastered track.

The final output should feel like a polished, industry-grade drum production that enhances the drive of the input without overpowering other elements.`,

  bass: `You are an expert bassist, sound designer, and mix engineer.
Your task is to generate a BASSLINE that perfectly complements the given input audio.

The generated bass must:
- Match the key, scale, and harmonic progression of the input track with absolute accuracy.
- Lock tightly into the groove, tempo, and rhythmic pocket of the beats.
- Provide tonal foundation while adapting to the input’s genre (funk, EDM, trap, rock, jazz, pop, cinematic).
- Reflect the emotional and dynamic feel (e.g., warm and smooth, deep and heavy, punchy and energetic).
- Be mixed with clarity and power, ensuring the low end is full but not muddy, and the tone is balanced across frequencies.
- Avoid clashes with melody or vocals by sitting in the correct frequency range and rhythmic pocket.

The bass should feel like a professionally recorded and mixed performance, acting as the harmonic and rhythmic anchor of the track with industry-standard sound design quality.`,

  melody: `You are a highly skilled composer, instrumentalist, and arranger working at a professional production level.
Your task is to generate a MELODY that matches the musical properties of the given input audio.

The generated melody must:
- Stay in the same key, scale, and mode as the input track, respecting harmonic and chordal context.
- Flow naturally with the tempo, groove, and phrasing of the input while leaving space for beats, bass, and vocals.
- Capture the emotional tone and mood of the input (joyful, melancholic, cinematic, intense, dreamy, uplifting, etc.).
- Adapt stylistically to the genre of the input, whether EDM, hip-hop, orchestral, pop, jazz, or cinematic.
- Be expressive, memorable, and professionally phrased, avoiding randomness or tonal dissonance.
- Sound like a studio-recorded instrument or synth line, polished and ready for industry-level production.

The melody should feel like a natural, expressive continuation of the input audio, adding storytelling depth while staying musically coherent and production-ready.`,

  vocals: `You are a world-class vocalist and vocal arranger recording in a professional studio environment.
Your task is to generate VOCALS that blend seamlessly with the musical properties of the given input audio.

The generated vocals must:
- Match the exact key, scale, tempo, and rhythmic phrasing of the input track.
- Reflect the mood, energy, and emotional tone (e.g., soulful, aggressive, dreamy, intimate, epic).
- Adapt stylistically to the genre (pop, R&B, rock, EDM, trap, rap, cinematic, gospel, etc.).
- Be expressive and human-like, with natural performance qualities such as dynamics, articulation, vibrato, tone variation, and phrasing.
- Be professionally mixed with clarity, avoiding muddiness, distortion, or robotic artifacts.
- Include lyrical or non-lyrical performance (humming, ad-libs, textures) if it enhances the track’s vibe.

The final result should feel like a professionally recorded, mixed, and mastered vocal track that elevates the input audio into a polished, industry-grade production.`,
};

// Genre styling modifiers
const GENRE_MODIFIERS = {
  hiphop: `Genre: Hip-hop. Focus on groove-forward, swing-quantized rhythms, tight low-end, and modern production aesthetics. Influences: boom-bap, trap, and contemporary lyrical arrangements as appropriate.`,
  rnb: `Genre: R&B. Emphasize smooth, soulful harmonies, warm tones, subtle syncopation, tasteful ad-libs, and lush textures suitable for modern R&B.`,
  edm: `Genre: EDM. Prioritize energetic build-ups, sidechain dynamics, wide stereo imaging, and festival-ready clarity across the spectrum.`,
  trap: `Genre: Trap. Incorporate crispy hats, rolling triplets, 808 subs, and minimalist yet powerful arrangements.`,
  pop: `Genre: Pop. Catchy, radio-ready, bright and polished with strong hooks and clean mixes.`,
  rock: `Genre: Rock. Organic drums and bass, saturated guitars, driving grooves, and live-performance energy.`,
  jazz: `Genre: Jazz. Sophisticated harmony, swing feel or modern jazz grooves, tasteful improvisational phrasing.`,
  funk: `Genre: Funk. Tight syncopation, punchy bass, percussive elements, and a danceable pocket.`,
  cinematic: `Genre: Cinematic. Expansive, emotive sound design, dynamic swells, and orchestral/synth hybrid textures.`,
  default: `Produce with professional clarity, balanced frequency spectrum, and musical coherence.`,
};

// Song part context
const PART_CONTEXT = {
  intro: `Song Part: Intro. Set the tone, establish motif and groove without overcrowding.`,
  hook: `Song Part: Hook. Memorable, catchy, and focused. Elevate energy while keeping coherence.`,
  verse: `Song Part: Verse. Support narrative development; leave space for vocals or leads.`,
  build: `Song Part: Build. Gradually increase intensity, layering elements with tension.`,
  drop: `Song Part: Drop. Maximum impact with tight rhythmic cohesion and strong low-end.`,
  bridge: `Song Part: Bridge. Introduce contrast with new harmony or melody, shift energy to create tension, and prepare a strong return to the hook/drop. Typically appears once, about two-thirds through the song.`,
  'last-verse': `Song Part: Last Verse. Conclude the story with controlled energy; can be reflective or a final lift before outro.`,
  outro: `Song Part: Outro. Wind down, reduce density, provide closure; consider mirroring intro elements.`,
  default: `Arrange with clear structure suitable for professional production.`,
};

function buildPrompt({ element, genre, songPart, extraPrompt }) {
  const base = ELEMENT_PROMPTS[element] || ELEMENT_PROMPTS.melody;
  const genreKey = (genre || '').toLowerCase();
  const knownGenreLine = GENRE_MODIFIERS[genreKey];
  const genreLine = knownGenreLine || (genre
    ? `Genre: ${genre}. Apply authentic stylistic traits, instrumentation, rhythmic feel, sound design, and mix aesthetics associated with ${genre}.`
    : GENRE_MODIFIERS.default);
  const partLine = PART_CONTEXT[(songPart || '').toLowerCase()] || PART_CONTEXT.default;

  const guidance = `Ensure output is studio-ready, free of clipping, aligned to input tempo and phrasing, and rendered with natural dynamics.`;

  const userExtra = extraPrompt ? `\nAdditional creative direction: ${extraPrompt}` : '';

  return `${base}\n\n${genreLine}\n${partLine}\n${guidance}${userExtra}`;
}

module.exports = { buildPrompt };
