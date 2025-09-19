import streamlit as st
import tempfile
import os
import numpy as np
import soundfile as sf
import requests
import fal_client
import time
import threading
from io import BytesIO

# Optional recorders
try:
    from st_audiorec import st_audiorec
except Exception:
    st_audiorec = None

try:
    from streamlit_mic_recorder import mic_recorder
except Exception:
    mic_recorder = None

try:
    from audio_recorder_streamlit import audio_recorder
except Exception:
    audio_recorder = None

# ----------------------
# Helper Functions
# ----------------------
def get_audio_duration(path_or_bytes):
    """Return duration in seconds. Accepts a file path or bytes/BytesIO."""
    try:
        if isinstance(path_or_bytes, (bytes, bytearray, BytesIO)):
            bio = BytesIO(path_or_bytes) if not isinstance(path_or_bytes, BytesIO) else path_or_bytes
            data, sr = sf.read(bio, always_2d=False)
            return float(len(data) / sr)
        else:
            info = sf.info(path_or_bytes)
            if info and info.duration:
                return float(info.duration)
    except Exception:
        return 0.0
    return 0.0

def save_mic_output(mic_data):
    """Save microphone data to a temporary WAV file with proper format handling."""
    if mic_data is None:
        return None

    # Handle different microphone recorder formats
    if isinstance(mic_data, (bytes, bytearray)):
        # Direct WAV bytes
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp.write(mic_data)
                return tmp.name
        except Exception:
            return None

    elif isinstance(mic_data, dict):
        # streamlit_mic_recorder format
        if "bytes" in mic_data and isinstance(mic_data["bytes"], (bytes, bytearray)):
            try:
                # Get audio parameters
                sample_rate = int(mic_data.get("sample_rate", 44100))
                sample_width = int(mic_data.get("sample_width", 2))
                
                # Convert bytes to numpy array based on sample width
                if sample_width == 1:
                    audio_array = np.frombuffer(mic_data["bytes"], dtype=np.uint8)
                    audio_array = (audio_array.astype(np.float32) - 128) / 128.0
                elif sample_width == 2:
                    audio_array = np.frombuffer(mic_data["bytes"], dtype=np.int16)
                    audio_array = audio_array.astype(np.float32) / 32768.0
                elif sample_width == 4:
                    audio_array = np.frombuffer(mic_data["bytes"], dtype=np.int32)
                    audio_array = audio_array.astype(np.float32) / 2147483648.0
                else:
                    audio_array = np.frombuffer(mic_data["bytes"], dtype=np.int16)
                    audio_array = audio_array.astype(np.float32) / 32768.0
                
                # Ensure it's 2D for stereo
                if len(audio_array.shape) == 1:
                    audio_array = audio_array.reshape(-1, 1)
                
                # Save as WAV
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                    sf.write(tmp.name, audio_array, sample_rate, format="WAV")
                    return tmp.name
                    
            except Exception as e:
                print(f"Error converting audio: {e}")
                return None

    return None

def upload_to_fal(client, wav_path):
    """Upload audio file to FAL and return URL."""
    with open(wav_path, "rb") as f:
        b = f.read()
    url = client.upload(b, content_type="audio/wav", file_name=os.path.basename(wav_path))
    return url

def call_stable_audio(client, audio_url, prompt, strength, steps, guidance, total_seconds):
    """Call Stable Audio API for audio-to-audio generation."""
    steps = min(int(steps), 8)
    res = client.run(
        "fal-ai/stable-audio-25/audio-to-audio",
        arguments={
            "prompt": prompt,
            "audio_url": audio_url,
            "strength": float(strength),
            "num_inference_steps": steps,
            "guidance_scale": float(guidance),
            "total_seconds": int(total_seconds),
        },
    )
    return res["audio"]["url"]

def download_url_to_tempfile(url):
    """Download audio from URL to temporary file."""
    r = requests.get(url)
    r.raise_for_status()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(r.content)
        return tmp.name

def mix_audio_files(file1_path, file2_path):
    """Mix two audio files and return path to mixed file."""
    try:
        data1, sr1 = sf.read(file1_path, always_2d=True, dtype="float32")
        data2, sr2 = sf.read(file2_path, always_2d=True, dtype="float32")
        
        # Use the higher sample rate
        target_sr = max(sr1, sr2)
        
        # Resample if needed (simple approach)
        if sr1 != target_sr:
            data1 = np.interp(np.linspace(0, len(data1), int(len(data1) * target_sr / sr1)), 
                            np.arange(len(data1)), data1.flatten()).reshape(-1, data1.shape[1])
        if sr2 != target_sr:
            data2 = np.interp(np.linspace(0, len(data2), int(len(data2) * target_sr / sr2)), 
                            np.arange(len(data2)), data2.flatten()).reshape(-1, data2.shape[1])
        
        # Pad to same length
        max_len = max(data1.shape[0], data2.shape[0])
        if data1.shape[0] < max_len:
            pad = np.zeros((max_len - data1.shape[0], data1.shape[1]), dtype=np.float32)
            data1 = np.vstack([data1, pad])
        if data2.shape[0] < max_len:
            pad = np.zeros((max_len - data2.shape[0], data2.shape[1]), dtype=np.float32)
            data2 = np.vstack([data2, pad])
        
        # Mix the audio
        mixed = data1 + data2
        
        # Normalize to prevent clipping
        peak = np.max(np.abs(mixed))
        if peak > 1.0:
            mixed = mixed / peak
        
        # Save mixed audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            sf.write(tmp.name, mixed, target_sr, format="WAV")
            return tmp.name
    except Exception as e:
        print(f"Error mixing audio: {e}")
        return file1_path  # Return first file if mixing fails

# ----------------------
# Session State Initialization
# ----------------------
if "tiles" not in st.session_state:
    st.session_state.tiles = {
        "beats": {"status": "idle", "recordings": [], "generated_files": [], "playing": False},
        "bass": {"status": "idle", "recordings": [], "generated_files": [], "playing": False},
        "melody": {"status": "idle", "recordings": [], "generated_files": [], "playing": False},
        "vocals": {"status": "idle", "recordings": [], "generated_files": [], "playing": False},
    }

if "api_key" not in st.session_state:
    st.session_state.api_key = ""

if "generation_params" not in st.session_state:
    st.session_state.generation_params = {
        "strength": 0.96,
        "steps": 8,
        "guidance": 9.0
    }

# ----------------------
# UI Layout
# ----------------------
st.set_page_config(page_title="VibeTune — Music Generation Tool", layout="wide")

# Custom CSS for enhanced UI
st.markdown("""
<style>
.tile-container {
    background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
    border: 2px solid #333;
    border-radius: 15px;
    padding: 20px;
    margin: 10px 0;
    text-align: center;
    transition: all 0.3s ease;
    min-height: 250px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.tile-container:hover {
    border-color: #ff4444;
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(255, 68, 68, 0.3);
}

.tile-container.recording {
    border-color: #ff0000;
    background: linear-gradient(135deg, #2d1a1a 0%, #3d2a2a 100%);
    animation: pulse 1s infinite;
}

.tile-container.playing {
    border-color: #00ff00;
    background: linear-gradient(135deg, #1a2d1a 0%, #2a3d2a 100%);
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
}

.tile-title {
    color: white;
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 15px;
}

.tile-button {
    background: linear-gradient(45deg, #ff4444, #ff6666);
    color: white;
    border: none;
    border-radius: 25px;
    padding: 12px 30px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    margin: 5px;
    min-width: 120px;
}

.tile-button:hover {
    background: linear-gradient(45deg, #ff6666, #ff8888);
    transform: scale(1.05);
}

.tile-button:disabled {
    background: #666;
    cursor: not-allowed;
    transform: none;
}

.recording-indicator {
    color: #ff4444;
    font-size: 18px;
    font-weight: bold;
    animation: blink 1s infinite;
}

@keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.3; }
}

.controls-container {
    background: #1a1a1a;
    border-radius: 10px;
    padding: 20px;
    margin-bottom: 20px;
}

.param-slider {
    margin: 15px 0;
}

.param-value {
    color: #ff4444;
    font-weight: bold;
    font-size: 18px;
}

.status-indicator {
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: bold;
    margin: 10px 0;
}

.status-idle {
    background: #444;
    color: #ccc;
}

.status-recording {
    background: #ff4444;
    color: white;
    animation: pulse 1s infinite;
}

.status-processing {
    background: #ffaa00;
    color: white;
}

.status-playing {
    background: #00ff44;
    color: white;
}
</style>
""", unsafe_allow_html=True)

st.title("🎛️ VibeTune — Music Generation Tool")

# Debug information about available libraries
with st.expander("🔧 Debug Information", expanded=False):
    st.write("**Available Microphone Libraries:**")
    st.write(f"- st_audiorec: {'✅ Available' if st_audiorec else '❌ Not available'}")
    st.write(f"- streamlit_mic_recorder: {'✅ Available' if mic_recorder else '❌ Not available'}")
    st.write(f"- audio_recorder_streamlit: {'✅ Available' if audio_recorder else '❌ Not available'}")
    
    if not any([st_audiorec, mic_recorder, audio_recorder]):
        st.error("❌ No microphone libraries available! Please install one of the following:")
        st.code("pip install st-audiorec")
        st.code("pip install streamlit-mic-recorder")
        st.code("pip install audio-recorder-streamlit")

# Global status indicator
def get_global_status():
    """Get overall status of all tiles"""
    statuses = [tile["status"] for tile in st.session_state.tiles.values()]
    
    if "recording" in statuses:
        return "🔴 Recording in progress...", "warning"
    elif "processing" in statuses:
        return "⏳ AI processing audio...", "info"
    elif "playing" in statuses:
        playing_count = sum(1 for tile in st.session_state.tiles.values() if tile["status"] == "playing")
        return f"🎵 {playing_count} track(s) playing", "success"
    else:
        return "⚪ Ready to create music", "info"

status_msg, status_type = get_global_status()
if status_type == "success":
    st.success(status_msg)
elif status_type == "warning":
    st.warning(status_msg)
else:
    st.info(status_msg)

# Sidebar with controls
with st.sidebar:
    st.markdown('<div class="controls-container">', unsafe_allow_html=True)
    st.markdown("## Global Controls")
    
    api_key = st.text_input("FAL API Key", type="password", value=st.session_state.api_key)
    st.session_state.api_key = api_key
    
    st.markdown("### Generation Parameters")
    
    strength = st.slider("Strength", 0.0, 1.0, st.session_state.generation_params["strength"], 0.01, key="strength_slider")
    st.session_state.generation_params["strength"] = strength
    
    steps = st.slider("Num Inference Steps (max 8)", 1, 8, st.session_state.generation_params["steps"], 1, key="steps_slider")
    st.session_state.generation_params["steps"] = steps
    
    guidance = st.slider("Guidance Scale", 1.0, 20.0, st.session_state.generation_params["guidance"], 0.5, key="guidance_slider")
    st.session_state.generation_params["guidance"] = guidance
    
    st.markdown("### Prompt Templates")
    st.write("Default templates loaded for each tile.")
    st.markdown('</div>', unsafe_allow_html=True)

# Default prompts for each tool
default_prompts = {
    "beats": "Transform this input into a polished drum loop: tight kick, crisp snare, varied hi-hats, consistent tempo. Remove mouth noise; output a clean percussive loop.",
    "bass": "Convert this input into a deep bassline that complements a drum loop. Provide a steady groove with low-end presence suitable for mixing.",
    "melody": "Turn this input into a melodic motif: synth or piano layer, clear tonality, suitable for looping as a hook.",
    "vocals": "Transform this input into a processed vocal line (melody/harmony) with minimal background noise; keep it musical and loop-ready.",
}

# Helper function to render each tile
def render_tile(tile_key, tile_name, container):
    tile = st.session_state.tiles[tile_key]
    
    # Determine container class based on status
    container_class = f"tile-container {tile['status']}"
    
    # Create tile container
    container.markdown(f'''
    <div class="{container_class}">
        <div class="tile-title">{tile_name}</div>
    </div>
    ''', unsafe_allow_html=True)
    
    # Status indicator
    if tile["status"] == "idle":
        container.markdown('<div class="status-indicator status-idle">⚪ Ready to Record</div>', unsafe_allow_html=True)
    elif tile["status"] == "recording":
        container.markdown('<div class="status-indicator status-recording">🔴 Recording...</div>', unsafe_allow_html=True)
    elif tile["status"] == "processing":
        container.markdown('<div class="status-indicator status-processing">⏳ Processing...</div>', unsafe_allow_html=True)
    elif tile["status"] == "playing":
        container.markdown('<div class="status-indicator status-playing">🟢 Playing</div>', unsafe_allow_html=True)
    
    # Main controls
    col1, col2, col3 = container.columns([1, 1, 1])
    
    if tile["status"] == "idle":
        # Ready to record
        if tile["generated_files"]:
            container.info("💡 Ready to add more layers! Click 'Record' to layer new audio on top of existing tracks.")
        else:
            container.info("💡 Click 'Record' to start creating your music! Speak, sing, or beatbox into your microphone.")
        
        if col2.button("🎤 Record", key=f"record_{tile_key}", use_container_width=True):
            tile["status"] = "recording"
            st.rerun()
    
    elif tile["status"] == "recording":
        # Currently recording - show stop button
        container.markdown("**🎙️ Recording in progress... Speak clearly into your microphone!**")
        container.markdown("💡 **Tips:** Speak loudly, avoid background noise, and record for at least 2-3 seconds")
        
        # Show microphone recorder with better integration
        audio_data = None
        
        # Try different microphone recorders
        if st_audiorec:
            container.info("🎤 Using st_audiorec - Click the microphone button below to start recording")
            audio_data = st_audiorec(key=f"recorder_{tile_key}")
            if audio_data is not None:
                st.session_state[f"mic_{tile_key}"] = audio_data
                container.success("🎤 Audio captured with st_audiorec!")
                
        elif mic_recorder:
            container.info("🎤 Using streamlit_mic_recorder - Click the microphone button below to start recording")
            audio_data = mic_recorder(start_prompt="🎤 Start Recording", stop_prompt="⏹️ Stop Recording", key=f"micrec_{tile_key}")
            if audio_data is not None:
                st.session_state[f"mic_{tile_key}"] = audio_data
                container.success("🎤 Audio captured with streamlit_mic_recorder!")
                
        elif audio_recorder:
            container.info("🎤 Using audio_recorder_streamlit - Click the microphone button below to start recording")
            audio_data = audio_recorder(
                text="⏹️ Stop Recording",
                recording_color="#ff4444",
                neutral_color="#ffffff",
                icon_size="2x",
                key=f"audiorec_{tile_key}"
            )
            if audio_data is not None:
                st.session_state[f"mic_{tile_key}"] = audio_data
                container.success("🎤 Audio captured with audio_recorder_streamlit!")
        else:
            container.error("❌ No microphone recorder available. Please install a microphone library.")
            container.info("💡 Install with: pip install st-audiorec")
            
            # Fallback: Simple file upload for testing
            container.info("🔄 Fallback: You can upload an audio file for testing")
            uploaded_file = container.file_uploader("Upload audio file", type=['wav', 'mp3', 'ogg'], key=f"upload_{tile_key}")
            if uploaded_file is not None:
                # Save uploaded file
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                    tmp.write(uploaded_file.read())
                    st.session_state[f"mic_{tile_key}"] = tmp.name
                    container.success("🎤 Audio file uploaded successfully!")
        
        # Show current audio status
        if st.session_state.get(f"mic_{tile_key}") is not None:
            container.success("✅ Audio is ready for processing!")
        else:
            container.warning("⚠️ No audio captured yet. Please use the microphone button above.")
        
        # Stop & Process button
        if col2.button("⏹️ Stop & Process", key=f"stop_{tile_key}", use_container_width=True):
            # Debug information
            container.info(f"🔍 Debug: Button clicked for {tile_key}")
            container.info(f"🔍 Debug: Audio data available: {st.session_state.get(f'mic_{tile_key}') is not None}")
            
            # Check if we have audio data
            if st.session_state.get(f"mic_{tile_key}") is not None:
                container.info("🔄 Processing your recording... Please wait...")
                tile["status"] = "processing"
                process_recording(tile_key, container)
                st.rerun()
            else:
                container.warning("⚠️ No audio recorded yet. Please record some audio first.")
                container.info("💡 Try using the microphone button above and wait for the 'Audio captured!' message.")
        
        # Test button for debugging
        if col3.button("🧪 Test", key=f"test_{tile_key}", use_container_width=True):
            container.info(f"🧪 Test button clicked for {tile_key}")
            container.info(f"🧪 Current status: {tile['status']}")
            container.info(f"🧪 Audio data: {st.session_state.get(f'mic_{tile_key}') is not None}")
            container.info(f"🧪 Available libraries: st_audiorec={st_audiorec is not None}, mic_recorder={mic_recorder is not None}, audio_recorder={audio_recorder is not None}")
            
            # Test microphone functionality
            if st_audiorec:
                container.info("🧪 Testing st_audiorec...")
                test_audio = st_audiorec(key=f"test_recorder_{tile_key}")
                if test_audio is not None:
                    container.success("✅ st_audiorec is working!")
                else:
                    container.warning("⚠️ st_audiorec not capturing audio")
    
    elif tile["status"] == "processing":
        # Processing - show detailed status
        container.info("🔄 Processing your audio... Please wait...")
        with st.spinner("🤖 AI is working on your audio..."):
            time.sleep(0.1)  # Small delay for UI responsiveness
    
    elif tile["status"] == "playing":
        # Currently playing - show pause button
        container.success(f"🎵 {tile_key.title()} is now playing! You can record again to add more layers.")
        if col2.button("⏸️ Pause", key=f"pause_{tile_key}", use_container_width=True):
            tile["status"] = "idle"
            tile["playing"] = False
            container.info("⏸️ Audio paused. Click 'Record' to add more layers or start over.")
            st.rerun()
    
    # Show generated audio players
    if tile["generated_files"]:
        container.markdown("### Generated Audio")
        for i, audio_file in enumerate(tile["generated_files"]):
            if os.path.exists(audio_file):
                # Show audio player
                container.audio(audio_file, format="audio/wav")
                
                # Download button
                with open(audio_file, "rb") as f:
                    container.download_button(
                        f"📥 Download Take {i+1}",
                        f.read(),
                        file_name=f"{tile_key}_take_{i+1}.wav",
                        mime="audio/wav",
                        key=f"dl_{tile_key}_{i}"
                    )

def process_recording(tile_key, container):
    """Process the recorded audio for a specific tile."""
    tile = st.session_state.tiles[tile_key]
    
    # Get the latest recording from session state
    mic_data = st.session_state.get(f"mic_{tile_key}", None)
    
    if mic_data is None:
        container.error("❌ No recording found. Please try recording again.")
        tile["status"] = "idle"
        return
    
    # Step 1: Save the recording
    container.info("🔄 Step 1/6: Saving your recording...")
    
    # Handle different types of audio data
    if isinstance(mic_data, str) and os.path.exists(mic_data):
        # It's already a file path (from upload)
        wav_path = mic_data
        container.info("✅ Using uploaded audio file")
    else:
        # It's microphone data that needs to be saved
        wav_path = save_mic_output(mic_data)
        if wav_path is None:
            container.error("❌ Failed to save recording. Please try again.")
            tile["status"] = "idle"
            return
    
    # Step 2: Validate recording
    container.info("🔄 Step 2/6: Validating audio quality...")
    duration = get_audio_duration(wav_path)
    if duration < 0.5:  # Less than 0.5 seconds
        container.error("❌ Recording too short. Please record for at least 0.5 seconds.")
        os.unlink(wav_path)  # Clean up empty file
        tile["status"] = "idle"
        return
    
    # Add to recordings
    tile["recordings"].append(wav_path)
    container.success(f"✅ Recording saved successfully! ({duration:.1f}s)")
    
    if not st.session_state.api_key:
        container.warning("⚠️ Please enter your FAL API Key in the sidebar to process audio.")
        tile["status"] = "idle"
        return
    
    # Process with FAL API
    try:
        # Step 3: Initialize API client
        container.info("🔄 Step 3/6: Connecting to AI processing service...")
        client = fal_client.SyncClient(key=st.session_state.api_key)
        
        # Step 4: Upload audio
        container.info("🔄 Step 4/6: Uploading your audio to AI servers...")
        audio_url = upload_to_fal(client, wav_path)
        container.success("✅ Audio uploaded successfully!")
        
        # Get prompt
        prompt = default_prompts[tile_key]
        
        # Use the actual duration for processing
        if duration < 1:
            duration = 5  # Minimum duration for API
        
        # Step 5: Generate AI audio
        container.info(f"🔄 Step 5/6: AI is transforming your {tile_key}... This may take 30-60 seconds...")
        
        # Create progress bar
        progress_bar = container.progress(0)
        progress_text = container.empty()
        
        with st.spinner("🤖 AI is working its magic..."):
            # Simulate progress updates
            for i in range(6):
                progress_bar.progress((i + 1) / 6)
                progress_text.text(f"🤖 AI processing... {i+1}/6")
                time.sleep(0.5)
            
            generated_url = call_stable_audio(
                client, 
                audio_url, 
                prompt, 
                st.session_state.generation_params["strength"],
                st.session_state.generation_params["steps"],
                st.session_state.generation_params["guidance"],
                duration
            )
        
        progress_bar.progress(1.0)
        progress_text.text("✅ AI generation completed!")
        container.success("✅ AI generation completed!")
        
        # Step 6: Download and prepare final audio
        container.info("🔄 Step 6/6: Preparing your final audio...")
        generated_path = download_url_to_tempfile(generated_url)
        
        # Mix with previous generated audio if it exists
        if tile["generated_files"] and len(tile["generated_files"]) > 0:
            container.info("🔄 Mixing with previous recordings...")
            # Get the last generated file for mixing
            last_generated = tile["generated_files"][-1]
            if os.path.exists(last_generated):
                mixed_path = mix_audio_files(last_generated, generated_path)
                tile["generated_files"].append(mixed_path)
                os.unlink(generated_path)  # Clean up individual file
                container.success("✅ Audio layered successfully!")
            else:
                tile["generated_files"].append(generated_path)
        else:
            tile["generated_files"].append(generated_path)
        
        tile["status"] = "playing"
        tile["playing"] = True
        container.success(f"🎉 {tile_key.title()} is ready! Your audio will start playing automatically...")
        
    except Exception as e:
        container.error(f"❌ Processing failed: {str(e)}")
        container.error("💡 Try checking your internet connection and API key.")
        tile["status"] = "idle"
        # Clean up the uploaded file if processing fails
        if os.path.exists(wav_path):
            os.unlink(wav_path)

# Main layout with 4 tiles in a 2x2 grid
st.markdown("### Prompt templates (pick a tile then choose)")

# Create the 2x2 grid
col1, col2 = st.columns(2)

with col1:
    # Beats tile
    beats_container = st.container()
    render_tile("beats", "Beats", beats_container)
    
    # Melody tile
    melody_container = st.container()
    render_tile("melody", "Melody", melody_container)

with col2:
    # Bass tile
    bass_container = st.container()
    render_tile("bass", "Bass", bass_container)
    
    # Vocals tile
    vocals_container = st.container()
    render_tile("vocals", "Vocals", vocals_container)

# Instructions
st.markdown("---")
st.markdown("""
### 🎵 How to Create Your Music:

#### **Step 1: Record Your Audio**
- **Click any tile** (Beats, Bass, Melody, or Vocals) to start recording
- **Speak, sing, beatbox, or make sounds** into your microphone
- **Click "Stop & Process"** when you're done recording

#### **Step 2: AI Processing**
- Your audio will be **automatically processed** by AI (takes 30-60 seconds)
- The AI will transform your input into professional-quality music
- You'll see **step-by-step progress** messages

#### **Step 3: Play & Layer**
- **Generated audio plays automatically** in a loop
- **Record again** on the same tile to add more layers
- **All tiles can play together** for a complete composition

#### **Step 4: Control Your Music**
- **Click pause** on any tile to stop its playback
- **Download individual tracks** or continue building
- **Mix and match** different elements to create your unique sound

### 💡 **Pro Tips:**
- **Speak clearly** and avoid background noise
- **Record for 2-3 seconds** minimum for best results
- **Layer multiple recordings** on the same tile for richer sound
- **Experiment with different sounds** - humming, beatboxing, clapping, etc.
""")

# Auto-refresh to keep the UI responsive
if any(tile["status"] == "recording" for tile in st.session_state.tiles.values()):
    time.sleep(0.1)
    st.rerun()
