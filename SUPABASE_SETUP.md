# Supabase Integration Setup Guide

This guide will help you set up Supabase for your VibeTune application.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. Node.js 18+ installed
3. Your VibeTune project cloned locally

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `vibetune-db`
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be created (2-3 minutes)

## Step 2: Get Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-id.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 3: Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Copy the contents of `supabase-schema.sql` from your project
3. Paste it into the SQL Editor
4. Click **Run** to execute the schema

## Step 4: Configure Storage

1. In your Supabase dashboard, go to **Storage**
2. Click **Create a new bucket**
3. Name it `audio-files`
4. Make it **Public** (for easy access to audio files)
5. Click **Create bucket**

## Step 5: Set Up Environment Variables

### Frontend (.env.local)
Create a `.env.local` file in your `vibetune-app` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Backend (.env)
Add these to your existing `backend/.env` file:

```env
# Existing variables...
FAL_KEY=your_fal_api_key_here
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Note**: Get the service role key from **Settings** → **API** → **service_role** (keep this secret!)

## Step 6: Install Dependencies

### Frontend
```bash
cd vibetune-app
npm install
```

### Backend
```bash
cd vibetune-app/backend
npm install
```

## Step 7: Test the Integration

1. Start your backend server:
   ```bash
   cd vibetune-app/backend
   npm run dev
   ```

2. Start your frontend:
   ```bash
   cd vibetune-app
   npm run dev
   ```

3. Open your browser to `http://localhost:3000`
4. Try creating a new audio clip - it should now be saved to Supabase!

## Step 8: Migrate Existing Data (Optional)

If you have existing clips in localStorage, you can migrate them:

1. Open your browser's developer console
2. Run the migration helper:
   ```javascript
   import { MigrationHelper } from './src/utils/migration'
   
   // Replace 'your-user-id' with an actual user ID
   MigrationHelper.migrateFromLocalStorage('your-user-id', 'My Migrated Project')
   ```

## Database Schema Overview

### Tables Created:
- **users**: User accounts and profiles
- **projects**: Music projects/songs
- **audio_clips**: Individual audio clips with metadata
- **audio_chops**: Chop points and segments
- **audio_effects**: Applied audio effects

### Storage Structure:
```
audio-files/
├── projects/
│   └── {project_id}/
│       └── clips/
│           └── {clip_id}.mp3
```

## Security Features

- **Row Level Security (RLS)** enabled on all tables
- Users can only access their own data
- Secure file uploads with proper validation
- Automatic cleanup when projects are deleted

## Troubleshooting

### Common Issues:

1. **"Invalid API key" error**
   - Check that your environment variables are correct
   - Make sure you're using the right keys (anon vs service role)

2. **"Permission denied" error**
   - Verify RLS policies are set up correctly
   - Check that you're authenticated as a user

3. **File upload fails**
   - Ensure the `audio-files` bucket exists and is public
   - Check file size limits (50MB max)

4. **Database connection issues**
   - Verify your Supabase URL is correct
   - Check that your project is not paused

### Getting Help:

- Check the [Supabase Documentation](https://supabase.com/docs)
- Join the [Supabase Discord](https://discord.supabase.com)
- Check the [VibeTune GitHub Issues](https://github.com/your-repo/issues)

## Next Steps

Once Supabase is set up, you can:

1. Add user authentication
2. Implement real-time features
3. Add more advanced audio processing
4. Scale to multiple users
5. Add collaborative features

Happy coding! 🎵
