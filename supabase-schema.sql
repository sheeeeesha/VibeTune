-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    bpm INTEGER DEFAULT 120,
    key VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audio_clips table
CREATE TABLE IF NOT EXISTS audio_clips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    song_part VARCHAR(50) NOT NULL,
    element VARCHAR(50) NOT NULL,
    genre VARCHAR(50) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    storage_url VARCHAR(1000) NOT NULL,
    waveform_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration DECIMAL(10,3) NOT NULL,
    bpm INTEGER,
    detected_key VARCHAR(10),
    volume DECIMAL(3,2) DEFAULT 1.0,
    is_looping BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audio_chops table
CREATE TABLE IF NOT EXISTS audio_chops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clip_id UUID REFERENCES audio_clips(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time DECIMAL(10,3) NOT NULL,
    end_time DECIMAL(10,3) NOT NULL,
    storage_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audio_effects table
CREATE TABLE IF NOT EXISTS audio_effects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clip_id UUID REFERENCES audio_clips(id) ON DELETE CASCADE,
    reverb_enabled BOOLEAN DEFAULT false,
    reverb_amount DECIMAL(3,2) DEFAULT 0.5,
    delay_enabled BOOLEAN DEFAULT false,
    delay_time INTEGER DEFAULT 250,
    delay_feedback DECIMAL(3,2) DEFAULT 0.3,
    filter_enabled BOOLEAN DEFAULT false,
    filter_frequency INTEGER DEFAULT 1000,
    filter_type VARCHAR(20) DEFAULT 'lowpass',
    distortion_enabled BOOLEAN DEFAULT false,
    distortion_amount DECIMAL(3,2) DEFAULT 0.5,
    compression_enabled BOOLEAN DEFAULT false,
    compression_threshold DECIMAL(5,2) DEFAULT -24,
    compression_ratio DECIMAL(5,2) DEFAULT 4.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audio_clips_project_id ON audio_clips(project_id);
CREATE INDEX IF NOT EXISTS idx_audio_clips_song_part ON audio_clips(song_part);
CREATE INDEX IF NOT EXISTS idx_audio_clips_element ON audio_clips(element);
CREATE INDEX IF NOT EXISTS idx_audio_clips_genre ON audio_clips(genre);
CREATE INDEX IF NOT EXISTS idx_audio_chops_clip_id ON audio_chops(clip_id);
CREATE INDEX IF NOT EXISTS idx_audio_effects_clip_id ON audio_effects(clip_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audio_effects_updated_at BEFORE UPDATE ON audio_effects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_chops ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_effects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);

-- Audio clips policies
CREATE POLICY "Users can view clips from own projects" ON audio_clips
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = audio_clips.project_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create clips in own projects" ON audio_clips
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = audio_clips.project_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update clips in own projects" ON audio_clips
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = audio_clips.project_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete clips in own projects" ON audio_clips
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = audio_clips.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Audio chops policies
CREATE POLICY "Users can view chops from own clips" ON audio_chops
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM audio_clips 
            JOIN projects ON projects.id = audio_clips.project_id
            WHERE audio_clips.id = audio_chops.clip_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create chops in own clips" ON audio_chops
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM audio_clips 
            JOIN projects ON projects.id = audio_clips.project_id
            WHERE audio_clips.id = audio_chops.clip_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update chops in own clips" ON audio_chops
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM audio_clips 
            JOIN projects ON projects.id = audio_clips.project_id
            WHERE audio_clips.id = audio_chops.clip_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete chops in own clips" ON audio_chops
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM audio_clips 
            JOIN projects ON projects.id = audio_clips.project_id
            WHERE audio_clips.id = audio_chops.clip_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Audio effects policies
CREATE POLICY "Users can view effects from own clips" ON audio_effects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM audio_clips 
            JOIN projects ON projects.id = audio_clips.project_id
            WHERE audio_clips.id = audio_effects.clip_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create effects for own clips" ON audio_effects
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM audio_clips 
            JOIN projects ON projects.id = audio_clips.project_id
            WHERE audio_clips.id = audio_effects.clip_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update effects for own clips" ON audio_effects
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM audio_clips 
            JOIN projects ON projects.id = audio_clips.project_id
            WHERE audio_clips.id = audio_effects.clip_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete effects for own clips" ON audio_effects
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM audio_clips 
            JOIN projects ON projects.id = audio_clips.project_id
            WHERE audio_clips.id = audio_effects.clip_id 
            AND projects.user_id = auth.uid()
        )
    );
