# VibeTune 2.5 Backend

AI Music Playground Backend API using Stability AI's Stable Audio 2.5 via fal.ai.

## Environment Variables

Set these in Vercel dashboard:

- `FAL_KEY`: Your fal.ai API key

## Local Development

```bash
npm install
npm run dev
```

## Deployment

Deploy to Vercel:

```bash
vercel --prod
```

## API Endpoints

- `POST /generate/beats` - Generate beats layer
- `POST /generate/bass` - Generate bass layer  
- `POST /generate/melody` - Generate melody layer
- `POST /generate/vocals` - Generate vocals layer
- `GET /health` - Health check
