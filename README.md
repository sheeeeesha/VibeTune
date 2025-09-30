# VibeTune - AI Music Generator

A web-based AI music generation tool that allows users to create music using Stable Audio 2.5. Features intuitive controls for song parts, musical elements, and genres with professional editing capabilities.

## Features

- 🎵 **Song Part Selection**: Intro, Hook, Verse, Build, Drop, etc.
- 🎹 **Musical Element Selection**: Beats, Melody, Vocals, Bass
- 🎭 **Genre Selection**: HipHop, RnB, No AI, and more
- 🎤 **Audio Recording**: Mic recording or file upload
- 🤖 **AI Generation**: Powered by Stable Audio 2.5
- 📊 **Waveform Display**: Real-time audio visualization
- 🎛️ **Track Management**: Stackable, scrollable tracks with individual controls
- ✂️ **Advanced Editing**: Chops, Notes, and FX editing tools
- 📱 **Mobile-First Design**: Responsive and touch-friendly

## Tech Stack

### Frontend
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **TailwindCSS** for styling
- **Framer Motion** for animations
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **Multer** for file uploads
- **Axios** for API calls
- **CORS** for cross-origin requests

### AI Integration
- **Stable Audio 2.5** API for music generation

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Stable Audio API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vibetune-app
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Set up environment variables**
   
   Create `backend/.env` file:
   ```env
   STABLE_AUDIO_API_URL=https://api.stability.ai/v1/audio/generate
   STABLE_AUDIO_API_KEY=your_stable_audio_api_key_here
   PORT=3001
   NODE_ENV=development
   ```

5. **Start the development servers**

   Terminal 1 (Backend):
   ```bash
   cd backend
   npm run dev
   ```

   Terminal 2 (Frontend):
   ```bash
   npm run dev
   ```

6. **Open your browser**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

## Usage

### Basic Workflow

1. **Select Song Part**: Choose from Intro, Hook, Verse, Build, Drop
2. **Choose Element**: Select Beats, Melody, Vocals, or Bass
3. **Pick Genre**: Choose HipHop, RnB, No AI, or add more
4. **Record Audio**: Hold the microphone button to record or upload a file
5. **Generate**: AI processes your input and creates a new audio clip
6. **Manage Tracks**: Play, loop, edit, or delete individual tracks
7. **Continue Building**: Use "Next Song Part" to build your song sequentially

### Editing Features

- **Chops**: Slice audio into segments and assign to pads
- **Notes**: Adjust musical notes and chord progressions
- **FX**: Apply audio effects with adjustable parameters

## API Endpoints

### Backend API

- `GET /health` - Health check
- `POST /api/generate` - Generate audio from input
- `POST /api/waveform` - Extract waveform data from audio

### Request Format

```json
POST /api/generate
{
  "songPart": "intro",
  "element": "beats", 
  "genre": "hiphop",
  "prompt": "Optional custom prompt"
}
```

## Project Structure

```
vibetune-app/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Main page
│   │   └── globals.css      # Global styles
│   ├── components/          # React components
│   │   ├── SongPartSelector.tsx
│   │   ├── ElementSelector.tsx
│   │   ├── GenreSelector.tsx
│   │   ├── RecordingButton.tsx
│   │   ├── WaveformDisplay.tsx
│   │   ├── TrackStack.tsx
│   │   └── EditModal.tsx
│   └── types/               # TypeScript type definitions
│       └── index.ts
├── backend/                 # Express server
│   ├── server.js           # Main server file
│   ├── package.json        # Backend dependencies
│   └── env.example         # Environment variables template
├── public/                 # Static assets
└── README.md
```

## Customization

### Adding New Song Parts
Edit `src/app/page.tsx` and update the `songParts` state:

```typescript
const [songParts, setSongParts] = useState<SongPart[]>([
  { id: 'intro', name: 'intro', label: 'intro', isActive: true },
  { id: 'hook', name: 'hook', label: 'hook', isActive: false },
  // Add new parts here
]);
```

### Adding New Genres
Update the `genres` state in `src/app/page.tsx`:

```typescript
const [genres, setGenres] = useState<Genre[]>([
  { id: 'hiphop', name: 'hiphop', label: 'hiphop', isActive: true },
  { id: 'rnb', name: 'rnb', label: 'RnB', isActive: false },
  // Add new genres here
]);
```

## Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Set build command: `npm run build`
3. Set output directory: `.next`
4. Deploy

### Backend (Railway/Heroku)
1. Create a new project
2. Connect your repository
3. Set environment variables
4. Deploy

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support, please open an issue on GitHub or contact the development team.

---

Built with ❤️ using Next.js, TypeScript, and Stable Audio 2.5