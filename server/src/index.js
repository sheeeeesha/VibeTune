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

app.use(cors({
    origin: true, // Allow all origins for now
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multer for in-memory uploads (supports file upload and mic-recorded blobs)
// Increase file size limit to support long inputs (e.g., 180s)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: 50 * 1024 * 1024, // 50MB (Vercel limit)
        fieldSize: 50 * 1024 * 1024
    },
});

// Layer-specific system prompts
const LAYER_PROMPTS = {
	beats: `
  You are a world-class music producer and rhythm designer working in a professional studio. 
  Your task is to generate BEATS that align seamlessly with the musical properties of the given input audio. 
  
  The generated beats must:
  - Match the exact tempo, time signature, and rhythmic groove of the input.
  - Stay tightly synchronized with the pulse, downbeats, and phrasing.
  - Adapt stylistically to the genre cues (hip-hop, EDM, rock, jazz, pop, trap, funk, cinematic, etc.).
  - Reflect the energy level, mood, and dynamics of the track (e.g., hard-hitting, minimal, driving, laid-back).
  - Sound crisp, punchy, and professionally mixed, avoiding muddiness, distortion, or off-tempo hits.
  - Be clean, production-ready, and balanced for immediate integration into a mastered track.
  
  The final output should feel like a polished, industry-grade drum production that enhances the drive of the input without overpowering other elements.
  `,
  
	bass: `
  You are an expert bassist, sound designer, and mix engineer. 
  Your task is to generate a BASSLINE that perfectly complements the given input audio. 
  
  The generated bass must:
  - Match the key, scale, and harmonic progression of the input track with absolute accuracy.
  - Lock tightly into the groove, tempo, and rhythmic pocket of the beats.
  - Provide tonal foundation while adapting to the input’s genre (funk, EDM, trap, rock, jazz, pop, cinematic).
  - Reflect the emotional and dynamic feel (e.g., warm and smooth, deep and heavy, punchy and energetic).
  - Be mixed with clarity and power, ensuring the low end is full but not muddy, and the tone is balanced across frequencies.
  - Avoid clashes with melody or vocals by sitting in the correct frequency range and rhythmic pocket.
  
  The bass should feel like a professionally recorded and mixed performance, acting as the harmonic and rhythmic anchor of the track with industry-standard sound design quality.
  `,
  
	melody: `
  You are a highly skilled composer, instrumentalist, and arranger working at a professional production level. 
  Your task is to generate a MELODY that matches the musical properties of the given input audio. 
  
  The generated melody must:
  - Stay in the same key, scale, and mode as the input track, respecting harmonic and chordal context.
  - Flow naturally with the tempo, groove, and phrasing of the input while leaving space for beats, bass, and vocals.
  - Capture the emotional tone and mood of the input (joyful, melancholic, cinematic, intense, dreamy, uplifting, etc.).
  - Adapt stylistically to the genre of the input, whether EDM, hip-hop, orchestral, pop, jazz, or cinematic.
  - Be expressive, memorable, and professionally phrased, avoiding randomness or tonal dissonance.
  - Sound like a studio-recorded instrument or synth line, polished and ready for industry-level production.
  
  The melody should feel like a natural, expressive continuation of the input audio, adding storytelling depth while staying musically coherent and production-ready.
  `,
  
	vocals: `
  You are a world-class vocalist and vocal arranger recording in a professional studio environment. 
  Your task is to generate VOCALS that blend seamlessly with the musical properties of the given input audio. 
  
  The generated vocals must:
  - Match the exact key, scale, tempo, and rhythmic phrasing of the input track.
  - Reflect the mood, energy, and emotional tone (e.g., soulful, aggressive, dreamy, intimate, epic).
  - Adapt stylistically to the genre (pop, R&B, rock, EDM, trap, rap, cinematic, gospel, etc.).
  - Be expressive and human-like, with natural performance qualities such as dynamics, articulation, vibrato, tone variation, and phrasing.
  - Be professionally mixed with clarity, avoiding muddiness, distortion, or robotic artifacts.
  - Include lyrical or non-lyrical performance (humming, ad-libs, textures) if it enhances the track’s vibe.
  
  The final result should feel like a professionally recorded, mixed, and mastered vocal track that elevates the input audio into a polished, industry-grade production.
  `,
  };

// Helper: call Stable Audio 2.5 via fal.ai
async function generateLayerWithFal({ layer, audioBuffer, mimeType = 'audio/wav', durationSeconds = 30, guidanceScale = 5, strength = 0.6, numInferenceSteps = 8, seed = 42 }) {
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

// Error handler for file size limits
const handleFileSizeError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
        }
    }
    next(err);
};

// Routes: Beats, Bass, Melody, Vocals
app.post('/generate/beats', upload.single('audio'), handleFileSizeError, (req, res, next) => { console.log('[beats] upload received', { hasFile: !!req.file, mime: req.file?.mimetype, size: req.file?.size }); next(); }, makeRoute('beats'));
app.post('/generate/bass', upload.single('audio'), handleFileSizeError, (req, res, next) => { console.log('[bass] upload received', { hasFile: !!req.file, mime: req.file?.mimetype, size: req.file?.size }); next(); }, makeRoute('bass'));
app.post('/generate/melody', upload.single('audio'), handleFileSizeError, (req, res, next) => { console.log('[melody] upload received', { hasFile: !!req.file, mime: req.file?.mimetype, size: req.file?.size }); next(); }, makeRoute('melody'));
app.post('/generate/vocals', upload.single('audio'), handleFileSizeError, (req, res, next) => { console.log('[vocals] upload received', { hasFile: !!req.file, mime: req.file?.mimetype, size: req.file?.size }); next(); }, makeRoute('vocals'));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});


