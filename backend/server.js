/* eslint-disable */
/* eslint-env node */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { fal } = require('@fal-ai/client');
const { File } = require('formdata-node');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { buildPrompt } = require('./prompts');
const { SupabaseService } = require('./supabase-integration');

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.FAL_KEY) {
  console.warn('[WARN] FAL_KEY is not set. Requests to Stable Audio will fail.');
}

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
// Handle preflight quickly
app.options('*', cors());

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'), false);
    }
  }
});

// Configure FAL AI client
fal.config({
  credentials: process.env.FAL_KEY
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'VibeTune Backend is running' });
});

// Generate audio endpoint
app.post('/api/generate', upload.single('audio'), async (req, res) => {
  try {
    console.log('Begin /api/generate');
    const { songPart, element, genre, prompt } = req.body;
    
    if (!req.file && !prompt) {
      return res.status(400).json({ error: 'Audio file or prompt is required' });
    }

    let audioUrl = null;
    
    // If audio file is provided, upload it to FAL storage
    if (req.file) {
      console.log(`Uploaded file: ${req.file.originalname} (${req.file.mimetype}) ${req.file.size} bytes`);
      const fileBuffer = fs.readFileSync(req.file.path);
      const file = new File([fileBuffer], req.file.originalname || 'input.webm', { type: req.file.mimetype || 'audio/webm' });
      audioUrl = await fal.storage.upload(file);
      console.log('FAL storage URL:', audioUrl);
    }

    // Build descriptive prompt
    const generationPrompt = buildPrompt({ element, genre, songPart, extraPrompt: prompt });

    // Accept dynamic duration and seed from client
    const clientSeconds = req.body.durationSeconds || req.body.totalSeconds;
    const durationSeconds = Number.isFinite(parseFloat(clientSeconds)) ? parseFloat(clientSeconds) : 30;
    const seed = Number.isFinite(parseInt(req.body.seed)) ? parseInt(req.body.seed) : 42;

    // Fixed guidance/strength/steps per spec
    const guidanceScale = 5;
    const strength = 0.6;
    const numInferenceSteps = 8;

    // Call Stable Audio 2.5 API
    const result = await fal.subscribe("fal-ai/stable-audio-25/audio-to-audio", {
      input: {
        prompt: generationPrompt,
        audio_url: audioUrl || "https://v3.fal.media/files/panda/1-0iezBUIePBa3Sz5YY5B_tmpy1jyshw9.wav",
        strength: strength,
        num_inference_steps: numInferenceSteps,
        total_seconds: durationSeconds,
        guidance_scale: guidanceScale,
        seed: seed,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach((m) => console.log('[FAL]', m));
        }
      },
      // increase request timeout
      options: { timeout: 120000 }
    });

    if (!result || !result.data || !result.data.audio || !result.data.audio.url) {
      console.error('[FAL] Unexpected response:', result);
      return res.status(502).json({ error: 'Stable Audio returned an unexpected response' });
    }

    // Generate waveform data (mock for now - in production, use Web Audio API)
    const waveformData = generateMockWaveform(100);

    // Return the generated audio and metadata
    res.json({
      success: true,
      audioUrl: result.data.audio.url,
      waveform: waveformData,
      duration: durationSeconds,
      seed: result.data.seed ?? seed,
      metadata: {
        songPart,
        element,
        genre,
        generatedAt: new Date().toISOString(),
        requestId: result.requestId
      }
    });

    // Clean up uploaded file
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.log('End /api/generate');

  } catch (error) {
    console.error('Generation error:', error?.response?.data || error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to generate audio',
      message: error?.message || 'Unknown error',
    });
  }
});

// Generate waveform from audio file
app.post('/api/waveform', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // In a real implementation, you would use Web Audio API or similar
    // to extract actual waveform data from the audio file
    const waveformData = generateMockWaveform(200);
    
    res.json({
      success: true,
      waveform: waveformData,
      duration: 30 // Mock duration
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

  } catch (error) {
    console.error('Waveform generation error:', error);
    
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Failed to generate waveform',
      message: error.message
    });
  }
});

// Mock waveform generator (replace with actual audio analysis)
function generateMockWaveform(length) {
  return Array.from({ length }, () => Math.random());
}

// Error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`VibeTune Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
