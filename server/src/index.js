/* eslint-env node */
/* eslint-disable no-undef */
"use strict";
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { fal } = require('@fal-ai/client');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Multer for in-memory uploads (supports file upload and mic-recorded blobs)
// Increase file size limit to support long inputs (e.g., 180s)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// Layer-specific system prompts
const LAYER_PROMPTS = {
    beats:
        'You are a professional music producer specializing in rhythm and percussive design. Your task is to generate BEATS that align seamlessly with the musical properties of the given input audio. The generated beats must: - Match the tempo, time signature, and rhythmic groove of the input audio. - Preserve the energy level, mood (e.g., energetic, chill, dark, uplifting), and dynamic accents. - Adapt to the genre cues present in the input (e.g., EDM, hip-hop, rock, jazz, pop). - Maintain tight synchronization with the pulse and downbeats of the track. - Be clean, consistent, and production-ready, avoiding off-tempo or dissonant patterns. The final output should feel like the natural rhythmic backbone of the given audio, enhancing its drive without overpowering other musical elements.',
    bass:
        'You are an expert bassist and sound designer. Your task is to generate a BASSLINE that perfectly complements the given input audio. The generated bass must: - Match the key, scale, and harmonic progression of the input track. - Lock tightly with the tempo, groove, and rhythmic pocket of the beats. - Reinforce the tonal foundation while adapting to the input’s genre (funk, rock, EDM, trap, jazz, pop, etc.). - Reflect the dynamics and mood of the track (e.g., smooth and warm, deep and heavy, punchy and energetic). - Provide melodic and rhythmic coherence without clashing with the melody or vocals. The bass should act as the harmonic and rhythmic anchor of the song, enhancing low-end richness while staying musically aligned with the input audio.',
    melody:
        'You are a skilled composer and instrumentalist. Your task is to generate a MELODY line that matches the musical properties of the given input audio. The generated melody must: - Be in the same key, scale, and mode as the input track. - Follow the harmonic context and chord progression of the input. - Adapt to the tempo, groove, and rhythmic structure while leaving space for beats, bass, and vocals. - Capture the emotional tone and mood of the input (e.g., joyful, melancholic, cinematic, energetic). - Stay stylistically coherent with the genre suggested by the input audio. - Be expressive, memorable, and production-ready, avoiding dissonance or tonal mismatches. The melody should feel like a natural continuation of the input audio, enhancing its storytelling and musical expression.',
    vocals:
        'You are a professional vocalist and vocal arranger. Your task is to generate VOCALS that blend seamlessly with the musical properties of the given input audio. The generated vocals must: - Match the key, scale, tempo, and rhythmic phrasing of the input track. - Follow the mood, emotion, and atmosphere (e.g., soulful, aggressive, dreamy, intimate). - Be stylistically aligned with the genre suggested by the input (pop, rock, rap, EDM, R&B, etc.). - Complement the melody and harmonics without clashing with beats or bass. - Deliver expressive performance qualities (dynamics, tone, phrasing) that bring life to the track. - Vocals can be lyrical or non-lyrical (e.g., humming, ad-libs, vocal textures), depending on what best fits the input. The result should feel like a natural vocal performance created specifically for the input audio, enhancing the musical identity of the track.',
};

// Helper: call Stable Audio 2.5 via fal.ai
async function generateLayerWithFal({ layer, audioBuffer, mimeType = 'audio/wav', durationSeconds = 30, seed = 42, guidanceScale = 5, strength = 0.6, numInferenceSteps = 8 }) {
	if (!LAYER_PROMPTS[layer]) {
		throw new Error('Unknown layer');
	}

    // Upload the audio to fal storage to avoid gigantic data URIs and 413
    const safeMime = typeof mimeType === 'string' && mimeType.includes('/') ? mimeType : 'audio/wav';
    const blob = new Blob([audioBuffer], { type: safeMime });
    const audioUrl = await fal.storage.upload(blob);

	// Configure fal credentials (reads from env FAL_KEY)
	fal.config({ credentials: process.env.FAL_KEY });

	// Model identifier for Stable Audio 2.5 (audio-to-audio)
	const modelId = 'fal-ai/stable-audio-25/audio-to-audio';

	// Subscribe to job and wait for result
	const result = await fal.subscribe(modelId, {
        input: {
			prompt: LAYER_PROMPTS[layer],
			// API expects total_seconds and audio_url
			total_seconds: durationSeconds,
			seed,
			guidance_scale: guidanceScale,
			strength,
            num_inference_steps: numInferenceSteps,
            audio_url: audioUrl,
		},
		logs: true,
		reconnect: true,
	});

	// Attempt to standardize output shape
	// Expecting result.data.audio or array of audios
	let outputUrl = null;
	if (result && result.data) {
		if (result.data.audio && typeof result.data.audio === 'object' && result.data.audio.url) {
			outputUrl = result.data.audio.url;
		} else if (typeof result.data.audio === 'string') {
			outputUrl = result.data.audio;
		}
	}

	if (!outputUrl) {
		throw new Error('Failed to parse audio URL from fal result');
	}

    return { audioUrl: outputUrl };
}

// Route factory
function makeRoute(layer) {
	return async (req, res) => {
		try {
			if (!process.env.FAL_KEY) {
				return res.status(400).json({ error: 'Missing FAL_KEY in server environment' });
			}

			if (!req.file || !req.file.buffer) {
				return res.status(400).json({ error: 'No audio file provided' });
			}

            const durationSeconds = Number(req.body?.durationSeconds || 30);
            const guidanceScale = Number(req.body?.guidanceScale || 5);
            const strength = Number(req.body?.strength || 0.5);
            const numInferenceSteps = Number(req.body?.numInferenceSteps || 8);
            const seed = Number(req.body?.seed || 42);

			const { audioUrl } = await generateLayerWithFal({
				layer,
				audioBuffer: req.file.buffer,
				mimeType: req.file.mimetype,
				durationSeconds,
				seed,
                guidanceScale,
                strength,
                numInferenceSteps,
			});

			return res.json({ audioUrl });
    } catch (err) {
        const details = err?.response?.data || err?.message || String(err);
        console.error(`[${layer}] generation error:`, details);
        return res.status(500).json({ error: 'Generation failed', details });
		}
	};
}

// Routes: Beats, Bass, Melody, Vocals
app.post('/generate/beats', upload.single('audio'), (req, res, next) => { console.log('[beats] upload received', { hasFile: !!req.file, mime: req.file?.mimetype, size: req.file?.size }); next(); }, makeRoute('beats'));
app.post('/generate/bass', upload.single('audio'), (req, res, next) => { console.log('[bass] upload received', { hasFile: !!req.file, mime: req.file?.mimetype, size: req.file?.size }); next(); }, makeRoute('bass'));
app.post('/generate/melody', upload.single('audio'), (req, res, next) => { console.log('[melody] upload received', { hasFile: !!req.file, mime: req.file?.mimetype, size: req.file?.size }); next(); }, makeRoute('melody'));
app.post('/generate/vocals', upload.single('audio'), (req, res, next) => { console.log('[vocals] upload received', { hasFile: !!req.file, mime: req.file?.mimetype, size: req.file?.size }); next(); }, makeRoute('vocals'));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});


