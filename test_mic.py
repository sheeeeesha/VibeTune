import streamlit as st
import tempfile
import io
import os
import numpy as np
import soundfile as sf
import requests
import fal_client
import time
import threading
from mutagen import File

# Optional recorders
try:
    from st_audiorec import st_audiorec  # preferred (returns WAV bytes)
except Exception:
    st_audiorec = None

try:
    from streamlit_mic_recorder import mic_recorder  # fallback (dict with bytes/audio)
except Exception:
    mic_recorder = None

# ----------------------
# Helper functions
# ----------------------
def get_audio_duration(path_or_bytes):
    """Return duration in seconds. Accepts a file path or bytes/BytesIO."""
    try:
        if isinstance(path_or_bytes, (bytes, bytearray, io.BytesIO)):
            bio = io.BytesIO(path_or_bytes) if not isinstance(path_or_bytes, io.BytesIO) else path_or_bytes
            data, sr = sf.read(bio, always_2d=False)
            return float(len(data) / sr)
        else:
            info = sf.info(path_or_bytes)
            if info and info.duration:
                return float(info.duration)
    except Exception:
        try:
            audio = File(path_or_bytes)
            if audio and audio.info and getattr(audio.info, "length", None):
                return float(audio.info.length)
        except Exception:
            return 0.0
    return 0.0

def save_bytes_to_wav(raw_bytes, sr=44100):
    """Save raw wav bytes (or PCM float array bytes) to temp wav file and return path."""
    if raw_bytes is None:
        return None
    # If bytes already represent WAV file, try writing directly
    try:
        # Quick check for RIFF header
        if isinstance(raw_bytes, (bytes, bytearray)) and len(raw_bytes) >= 12:
            if raw_bytes[0:4] == b"RIFF" and raw_bytes[8:12] == b"WAVE":
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                    tmp.write(raw_bytes)
                    return tmp.name
    except Exception:
        pass

    # Otherwise treat bytes as raw PCM float array and try to load into numpy
    try:
        arr = np.frombuffer(raw_bytes, dtype=np.float32)
        if arr.size > 0:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                sf.write(tmp.name, arr, sr, format="WAV")
                return tmp.name
    except Exception:
        pass

    return None

def save_mic_output(mic_data):
    """
    Accept mic_data from st_audiorec (bytes) or streamlit_mic_recorder (dict or bytes or list)
    and return a path to a saved .wav file
    """
    if mic_data is None:
        return None

    # st_audiorec returns raw WAV bytes
    if isinstance(mic_data, (bytes, bytearray)):
        return save_bytes_to_wav(mic_data)

    # mic_recorder returns a dict commonly: {'bytes': b'...', 'sample_rate':44100, ...}
    if isinstance(mic_data, dict):
        # Handle streamlit_mic_recorder format
        if "bytes" in mic_data and isinstance(mic_data["bytes"], (bytes, bytearray)):
            # Try to save the raw bytes first
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                    tmp.write(mic_data["bytes"])
                    # Test if it's valid WAV
                    try:
                        data, sr = sf.read(tmp.name)
                        return tmp.name
                    except:
                        # If not valid WAV, try to convert
                        pass
            except:
                pass
            
            # If raw bytes don't work, try to convert using the audio data
            try:
                # Get audio parameters
                sample_rate = int(mic_data.get("sample_rate", 44100))
                sample_width = int(mic_data.get("sample_width", 2))
                
                # Convert bytes to numpy array based on sample width
                if sample_width == 1:
                    # 8-bit unsigned
                    audio_array = np.frombuffer(mic_data["bytes"], dtype=np.uint8)
                    audio_array = (audio_array.astype(np.float32) - 128) / 128.0
                elif sample_width == 2:
                    # 16-bit signed
                    audio_array = np.frombuffer(mic_data["bytes"], dtype=np.int16)
                    audio_array = audio_array.astype(np.float32) / 32768.0
                elif sample_width == 4:
                    # 32-bit signed
                    audio_array = np.frombuffer(mic_data["bytes"], dtype=np.int32)
                    audio_array = audio_array.astype(np.float32) / 2147483648.0
                else:
                    # Default to 16-bit
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
        
        # or float array under 'audio' or 'array'
        for key in ("audio", "array"):
            if key in mic_data:
                arr = np.array(mic_data[key]).astype(np.float32)
                if arr.size > 0:
                    sr = int(mic_data.get("sample_rate", 44100))
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                        sf.write(tmp.name, arr, sr, format="WAV")
                        return tmp.name
        # fallback: if 'raw' or 'data' keys exist with bytes
        for key in ("raw", "data"):
            if key in mic_data and isinstance(mic_data[key], (bytes, bytearray)):
                return save_bytes_to_wav(mic_data[key])

    # list or ndarray of samples
    if isinstance(mic_data, (list, np.ndarray)):
        arr = np.array(mic_data).astype(np.float32)
        if arr.size > 0:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                sf.write(tmp.name, arr, 44100, format="WAV")
                return tmp.name

    return None

def upload_to_fal(client, wav_path):
    with open(wav_path, "rb") as f:
        b = f.read()
    url = client.upload(b, content_type="audio/wav", file_name=os.path.basename(wav_path))
    return url

def call_stable_audio(client, audio_url, prompt, strength, steps, guidance, total_seconds):
    # Ensure steps <= 8 because Stable Audio endpoint may limit it
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
    r = requests.get(url)
    r.raise_for_status()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(r.content)
        return tmp.name

def mix_audio_files(file1_path, file2_path):
    """Mix two audio files and return path to mixed file"""
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
        st.error(f"Error mixing audio: {e}")
        return file1_path  # Return first file if mixing fails

# ----------------------
# Session state init
# ----------------------
if "tiles" not in st.session_state:
    st.session_state.tiles = {
        "beats": {"records": [], "generated": None, "playing": False, "recording": False},
        "bass": {"records": [], "generated": None, "playing": False, "recording": False},
        "melody": {"records": [], "generated": None, "playing": False, "recording": False},
        "vocals": {"records": [], "generated": None, "playing": False, "recording": False},
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

# Custom CSS for the tile-based UI
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
    min-height: 200px;
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

.recording {
    background: linear-gradient(45deg, #ff0000, #ff4444) !important;
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

.playing {
    background: linear-gradient(45deg, #00ff00, #44ff44) !important;
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
</style>
""", unsafe_allow_html=True)

st.title("🎛️ VibeTune — Music Generation Tool")

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
    
    # Create tile container
    container.markdown(f'''
    <div class="tile-container">
        <div class="tile-title">{tile_name}</div>
    </div>
    ''', unsafe_allow_html=True)
    
    # Recording status
    if tile["recording"]:
        container.markdown("🔴 **Recording...** Click the tile again to stop and process")
    elif tile["playing"]:
        container.markdown("🟢 **Playing** - Click pause to stop")
    else:
        container.markdown("⚪ **Ready** - Click to start recording")
    
    # Main tile button
    col1, col2, col3 = container.columns([1, 1, 1])
    
    if not tile["recording"] and not tile["playing"]:
        # Ready to record
        if col2.button("🎤 Record", key=f"record_{tile_key}", use_container_width=True):
            tile["recording"] = True
            st.rerun()
    
    elif tile["recording"]:
        # Currently recording - show stop button
        if col2.button("⏹️ Stop & Process", key=f"stop_{tile_key}", use_container_width=True):
            tile["recording"] = False
            # Process the recording
            process_recording(tile_key, container)
            st.rerun()
    
    elif tile["playing"]:
        # Currently playing - show pause button
        if col2.button("⏸️ Pause", key=f"pause_{tile_key}", use_container_width=True):
            tile["playing"] = False
            st.rerun()
    
    # Show microphone recorder when recording
    if tile["recording"]:
        container.markdown("**Speak into your microphone now...**")
        
        # Debug info
        container.info(f"Debug: st_audiorec available: {st_audiorec is not None}, mic_recorder available: {mic_recorder is not None}")
        
        if st_audiorec:
            # Use st_audiorec for recording
            audio_data = st_audiorec(key=f"recorder_{tile_key}")
            if audio_data is not None:
                st.session_state[f"mic_{tile_key}"] = audio_data
                container.success("🎤 Audio captured!")
            else:
                container.warning("No audio data received yet...")
        elif mic_recorder:
            # Use streamlit_mic_recorder as fallback
            audio_data = mic_recorder(start_prompt="", stop_prompt="", key=f"micrec_{tile_key}")
            if audio_data is not None:
                st.session_state[f"mic_{tile_key}"] = audio_data
                container.success("🎤 Audio captured!")
            else:
                container.warning("No audio data received yet...")
        else:
            container.error("No microphone recorder available. Please install st-audiorec or streamlit-mic-recorder.")
    
    # Show generated audio if available
    if tile["generated"] and os.path.exists(tile["generated"]):
        container.audio(tile["generated"], format="audio/wav")
        
        # Download button
        if col3.button("📥 Download", key=f"download_{tile_key}", use_container_width=True):
            with open(tile["generated"], "rb") as f:
                container.download_button(
                    "Download Audio",
                    f.read(),
                    file_name=f"{tile_key}_generated.wav",
                    mime="audio/wav",
                    key=f"dl_{tile_key}"
                )

def process_recording(tile_key, container):
    """Process the recorded audio for a specific tile"""
    tile = st.session_state.tiles[tile_key]
    
    # Get the latest recording from session state
    mic_data = st.session_state.get(f"mic_{tile_key}", None)
    
    if mic_data is None:
        container.error("No recording found. Please try recording again.")
        return
    
    # Save the recording
    wav_path = save_mic_output(mic_data)
    
    if wav_path is None:
        container.error("Failed to save recording. Please try again.")
        return
    
    # Check if recording has actual audio content
    duration = get_audio_duration(wav_path)
    if duration < 0.5:  # Less than 0.5 seconds
        container.error("Recording too short. Please record for at least 0.5 seconds.")
        os.unlink(wav_path)  # Clean up empty file
        return
    
    # Add to records
    tile["records"].append(wav_path)
    container.success(f"✅ Recording saved ({duration:.1f}s)")
    
    if not st.session_state.api_key:
        container.warning("Please enter your FAL API Key in the sidebar to process audio.")
        return
    
    # Process with FAL API
    try:
        with st.spinner(f"Processing {tile_key}..."):
            client = fal_client.SyncClient(key=st.session_state.api_key)
            
            # Upload audio
            audio_url = upload_to_fal(client, wav_path)
            
            # Get prompt
            prompt = default_prompts[tile_key]
            
            # Use the actual duration for processing
            if duration < 1:
                duration = 5  # Minimum duration for API
            
            # Call Stable Audio API
            generated_url = call_stable_audio(
                client, 
                audio_url, 
                prompt, 
                st.session_state.generation_params["strength"],
                st.session_state.generation_params["steps"],
                st.session_state.generation_params["guidance"],
                duration
            )
            
            # Download generated audio
            generated_path = download_url_to_tempfile(generated_url)
            
            # Mix with previous generated audio if it exists
            if tile["generated"] and os.path.exists(tile["generated"]):
                mixed_path = mix_audio_files(tile["generated"], generated_path)
                tile["generated"] = mixed_path
                os.unlink(generated_path)  # Clean up individual file
            else:
                tile["generated"] = generated_path
            
            tile["playing"] = True
            container.success(f"✅ {tile_key.title()} processed successfully!")
            
    except Exception as e:
        container.error(f"❌ Processing failed: {str(e)}")
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
### How to use:
1. **Click any tile** to start recording with your microphone
2. **Click the tile again** to stop recording and process the audio
3. **The generated audio will start playing automatically** in a loop
4. **Click pause** to stop the audio playback
5. **Record multiple times** on the same tile to layer and mix audio
6. **All tiles play together** for a complete musical composition
""")

# Auto-refresh to keep the UI responsive
if any(tile["recording"] for tile in st.session_state.tiles.values()):
    time.sleep(0.1)
    st.rerun()


