import streamlit as st
import streamlit.components.v1 as components
import tempfile
import os
import numpy as np
import soundfile as sf
import requests
import fal_client
import time
import math
import threading
import base64
from io import BytesIO
import json

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
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp.write(mic_data)
                return tmp.name
        except Exception:
            return None

    elif isinstance(mic_data, dict):
        if "bytes" in mic_data and isinstance(mic_data["bytes"], (bytes, bytearray)):
            try:
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
        
        target_sr = max(sr1, sr2)
        
        # Resample if needed
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
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            sf.write(tmp.name, mixed, target_sr, format="WAV")
            return tmp.name
    except Exception as e:
        print(f"Error mixing audio: {e}")
        return file1_path

def create_audio_player_html(audio_path, tile_key, take_number, auto_play=False):
    """Create a professional audio player with infinite loop capability.
    If auto_play is True, attempt to start playback automatically.
    """
    if not os.path.exists(audio_path):
        return ""
    
    # Read audio file to get duration
    try:
        data, sr = sf.read(audio_path)
        duration = len(data) / sr
    except:
        duration = 0
    
    # Convert audio to base64 for embedding
    try:
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        audio_b64 = base64.b64encode(audio_bytes).decode()
    except:
        audio_b64 = ""
    
    player_id = f"player_{tile_key}_{take_number}"
    
    html = f"""
    <div class="audio-player-container" style="margin: 15px 0; padding: 15px; background: linear-gradient(135deg, #2a2a2a, #3a3a3a); border-radius: 12px; border: 1px solid #444;">
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
            <button onclick="togglePlayPause('{player_id}')" id="playBtn_{player_id}" 
                    style="background: linear-gradient(45deg, #ff4444, #ff6666); color: white; border: none; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; font-size: 18px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(255, 68, 68, 0.3);">
                ▶️
            </button>
            <div style="flex: 1;">
                <div style="color: white; font-weight: bold; font-size: 16px;">Take {take_number + 1}</div>
                <div style="color: #ccc; font-size: 12px;">Duration: {duration:.1f}s</div>
            </div>
            <button onclick="stopAudio('{player_id}')" 
                    style="background: #666; color: white; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
                ⏹️ Stop
            </button>
        </div>
        
        <div style="background: #444; height: 6px; border-radius: 3px; margin: 10px 0; overflow: hidden;">
            <div id="progress_{player_id}" style="height: 100%; background: linear-gradient(90deg, #ff4444, #ff6666); width: 0%; transition: width 0.1s ease; border-radius: 3px;"></div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
            <span id="time_{player_id}" style="color: #ccc; font-size: 12px;">0:00 / {int(duration//60)}:{int(duration%60):02d}</span>
            <div style="display: flex; gap: 10px;">
                <button onclick="toggleLoop('{player_id}')" id="loopBtn_{player_id}"
                        style="background: #444; color: #ccc; border: 1px solid #666; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 12px; transition: all 0.3s ease;">
                    🔄 Loop: ON
                </button>
                <button onclick="downloadAudio('{player_id}')"
                        style="background: #444; color: #ccc; border: 1px solid #666; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 12px; transition: all 0.3s ease;">
                    📥 Download
                </button>
            </div>
        </div>
        
        <audio id="audio_{player_id}" preload="auto" style="display: none;" loop>
            <source src="data:audio/wav;base64,{audio_b64}" type="audio/wav">
        </audio>
    </div>
    
    <script>
    let audio_{player_id} = null;
    let isPlaying_{player_id} = false;
    let isLooping_{player_id} = true;
    let progressInterval_{player_id} = null;
    
    function initAudio_{player_id}() {{
        if (!audio_{player_id}) {{
            audio_{player_id} = document.getElementById('audio_{player_id}');
            
            audio_{player_id}.addEventListener('timeupdate', function() {{
                if (audio_{player_id}.duration) {{
                    const progress = (audio_{player_id}.currentTime / audio_{player_id}.duration) * 100;
                    document.getElementById('progress_{player_id}').style.width = progress + '%';
                    
                    const current = Math.floor(audio_{player_id}.currentTime);
                    const total = Math.floor(audio_{player_id}.duration);
                    document.getElementById('time_{player_id}').textContent = 
                        Math.floor(current/60) + ':' + (current%60).toString().padStart(2, '0') + ' / ' +
                        Math.floor(total/60) + ':' + (total%60).toString().padStart(2, '0');
                }}
            }});
            
            audio_{player_id}.addEventListener('ended', function() {{
                if (isLooping_{player_id}) {{
                    audio_{player_id}.currentTime = 0;
                    audio_{player_id}.play();
                }} else {{
                    stopAudio_{player_id}();
                }}
            }});
        }}
    }}
    
    function togglePlayPause_{player_id}() {{
        initAudio_{player_id}();
        
        if (isPlaying_{player_id}) {{
            audio_{player_id}.pause();
            document.getElementById('playBtn_{player_id}').innerHTML = '▶️';
            document.getElementById('playBtn_{player_id}').style.background = 'linear-gradient(45deg, #ff4444, #ff6666)';
            isPlaying_{player_id} = false;
        }} else {{
            audio_{player_id}.play();
            document.getElementById('playBtn_{player_id}').innerHTML = '⏸️';
            document.getElementById('playBtn_{player_id}').style.background = 'linear-gradient(45deg, #00ff44, #44ff66)';
            isPlaying_{player_id} = true;
        }}
    }}
    
    function stopAudio_{player_id}() {{
        if (audio_{player_id}) {{
            audio_{player_id}.pause();
            audio_{player_id}.currentTime = 0;
        }}
        document.getElementById('playBtn_{player_id}').innerHTML = '▶️';
        document.getElementById('playBtn_{player_id}').style.background = 'linear-gradient(45deg, #ff4444, #ff6666)';
        document.getElementById('progress_{player_id}').style.width = '0%';
        document.getElementById('time_{player_id}').textContent = '0:00 / {int(duration//60)}:{int(duration%60):02d}';
        isPlaying_{player_id} = false;
    }}
    
    function toggleLoop_{player_id}() {{
        isLooping_{player_id} = !isLooping_{player_id};
        const btn = document.getElementById('loopBtn_{player_id}');
        if (isLooping_{player_id}) {{
            btn.innerHTML = '🔄 Loop: ON';
            btn.style.background = '#ff4444';
            btn.style.color = 'white';
        }} else {{
            btn.innerHTML = '🔄 Loop: OFF';
            btn.style.background = '#444';
            btn.style.color = '#ccc';
        }}
    }}
    
    function downloadAudio_{player_id}() {{
        const link = document.createElement('a');
        link.href = 'data:audio/wav;base64,{audio_b64}';
        link.download = '{tile_key}_take_{take_number + 1}.wav';
        link.click();
    }}
    
    // Global functions for onclick
    function togglePlayPause(id) {{ eval('togglePlayPause_' + id + '()'); }}
    function stopAudio(id) {{ eval('stopAudio_' + id + '()'); }}
    function toggleLoop(id) {{ eval('toggleLoop_' + id + '()'); }}
    function downloadAudio(id) {{ eval('downloadAudio_' + id + '()'); }}

    // Auto-play logic after user interaction (Stop & Process click counts as interaction)
    document.addEventListener('DOMContentLoaded', function() {{
        initAudio_{player_id}();
        const shouldAuto = {str(auto_play).lower()};
        if (shouldAuto && audio_{player_id}) {{
            const tryPlay = () => {{
                audio_{player_id}.play().then(() => {{
                    document.getElementById('playBtn_{player_id}').innerHTML = '⏸️';
                    document.getElementById('playBtn_{player_id}').style.background = 'linear-gradient(45deg, #00ff44, #44ff66)';
                    isPlaying_{player_id} = true;
                }}).catch(() => {{ /* autoplay blocked */ }});
            }};
            if (audio_{player_id}.readyState >= 2) {{
                tryPlay();
            }} else {{
                audio_{player_id}.addEventListener('canplay', tryPlay, {{ once: true }});
                setTimeout(tryPlay, 500);
            }}
        }}
    }});
    </script>
    """
    return html

# ----------------------
# Session State Initialization
# ----------------------
if "tiles" not in st.session_state:
    st.session_state.tiles = {
        "beats": {"status": "idle", "recordings": [], "generated_files": [], "playing": False, "current_audio": None},
        "bass": {"status": "idle", "recordings": [], "generated_files": [], "playing": False, "current_audio": None},
        "melody": {"status": "idle", "recordings": [], "generated_files": [], "playing": False, "current_audio": None},
        "vocals": {"status": "idle", "recordings": [], "generated_files": [], "playing": False, "current_audio": None},
    }

if "api_key" not in st.session_state:
    st.session_state.api_key = ""

if "generation_params" not in st.session_state:
    st.session_state.generation_params = {
        "strength": 0.72,
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
    border-radius: 20px;
    padding: 25px;
    margin: 15px 0;
    text-align: center;
    transition: all 0.4s ease;
    min-height: 300px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
}

.tile-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent, rgba(255, 68, 68, 0.1), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.tile-container:hover::before {
    opacity: 1;
}

.tile-container:hover {
    border-color: #ff4444;
    transform: translateY(-5px);
    box-shadow: 0 15px 35px rgba(255, 68, 68, 0.4);
}

.tile-container.recording {
    border-color: #ff0000;
    background: linear-gradient(135deg, #2d1a1a 0%, #3d2a2a 100%);
    animation: pulse 1.5s infinite;
}

.tile-container.playing {
    border-color: #00ff44;
    background: linear-gradient(135deg, #1a2d1a 0%, #2a3d2a 100%);
    box-shadow: 0 0 30px rgba(0, 255, 68, 0.3);
}

.tile-container.processing {
    border-color: #ffaa00;
    background: linear-gradient(135deg, #2d2a1a 0%, #3d3a2a 100%);
    animation: processing 2s infinite;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
}

@keyframes processing {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}

.tile-title {
    color: white;
    font-size: 28px;
    font-weight: bold;
    margin-bottom: 20px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.tile-button {
    background: linear-gradient(45deg, #ff4444, #ff6666);
    color: white;
    border: none;
    border-radius: 30px;
    padding: 15px 35px;
    font-size: 18px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    margin: 8px;
    min-width: 140px;
    box-shadow: 0 6px 20px rgba(255, 68, 68, 0.3);
}

.tile-button:hover {
    background: linear-gradient(45deg, #ff6666, #ff8888);
    transform: scale(1.05);
    box-shadow: 0 8px 25px rgba(255, 68, 68, 0.5);
}

.tile-button:active {
    transform: scale(0.95);
}

.tile-button:disabled {
    background: #666;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

.recording-indicator {
    color: #ff4444;
    font-size: 20px;
    font-weight: bold;
    animation: blink 1s infinite;
    margin: 10px 0;
}

@keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.3; }
}

.controls-container {
    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    border-radius: 15px;
    padding: 25px;
    margin-bottom: 25px;
    border: 1px solid #444;
}

.status-indicator {
    padding: 12px 20px;
    border-radius: 25px;
    font-weight: bold;
    margin: 15px 0;
    font-size: 16px;
    text-align: center;
}

.status-idle {
    background: linear-gradient(45deg, #444, #666);
    color: #ccc;
}

.status-recording {
    background: linear-gradient(45deg, #ff4444, #ff6666);
    color: white;
    animation: pulse 1s infinite;
}

.status-processing {
    background: linear-gradient(45deg, #ffaa00, #ffcc44);
    color: white;
    animation: processing 2s infinite;
}

.status-playing {
    background: linear-gradient(45deg, #00ff44, #44ff66);
    color: white;
    box-shadow: 0 0 20px rgba(0, 255, 68, 0.3);
}

.audio-player-container {
    margin: 15px 0;
    padding: 15px;
    background: linear-gradient(135deg, #2a2a2a, #3a3a3a);
    border-radius: 12px;
    border: 1px solid #444;
    transition: all 0.3s ease;
}

.audio-player-container:hover {
    border-color: #ff4444;
    box-shadow: 0 5px 15px rgba(255, 68, 68, 0.2);
}

.progress-container {
    background: #444;
    height: 8px;
    border-radius: 4px;
    margin: 10px 0;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #ff4444, #ff6666);
    width: 0%;
    transition: width 0.1s ease;
    border-radius: 4px;
}

.recording-tips {
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid #ff4444;
    border-radius: 10px;
    padding: 15px;
    margin: 15px 0;
    color: #ffcccc;
}

.recording-tips h4 {
    color: #ff6666;
    margin-top: 0;
}

.global-status {
    padding: 15px 25px;
    border-radius: 15px;
    font-weight: bold;
    font-size: 18px;
    text-align: center;
    margin: 20px 0;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

.status-success {
    background: linear-gradient(45deg, #00ff44, #44ff66);
    color: white;
}

.status-warning {
    background: linear-gradient(45deg, #ffaa00, #ffcc44);
    color: white;
}

.status-info {
    background: linear-gradient(45deg, #4444ff, #6666ff);
    color: white;
}
</style>
""", unsafe_allow_html=True)

st.title("🎛️ VibeTune — Professional Music Generation Tool")

# Debug information
with st.expander("🔧 System Status", expanded=False):
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
    st.markdown(f'<div class="global-status status-success">{status_msg}</div>', unsafe_allow_html=True)
elif status_type == "warning":
    st.markdown(f'<div class="global-status status-warning">{status_msg}</div>', unsafe_allow_html=True)
else:
    st.markdown(f'<div class="global-status status-info">{status_msg}</div>', unsafe_allow_html=True)

# Sidebar with controls
with st.sidebar:
    st.markdown('<div class="controls-container">', unsafe_allow_html=True)
    st.markdown("## 🎛️ Global Controls")
    
    api_key = st.text_input("🔑 FAL API Key", type="password", value=st.session_state.api_key, help="Enter your FAL API key to enable AI processing")
    st.session_state.api_key = api_key
    
    st.markdown("### 🎚️ Generation Parameters")
    
    strength = st.slider("Strength", 0.0, 1.0, st.session_state.generation_params["strength"], 0.01, key="strength_slider", help="Controls how much the AI transforms your input")
    st.session_state.generation_params["strength"] = strength
    
    steps = st.slider("Inference Steps", 1, 8, st.session_state.generation_params["steps"], 1, key="steps_slider", help="More steps = better quality but slower processing")
    st.session_state.generation_params["steps"] = steps
    
    guidance = st.slider("Guidance Scale", 1.0, 20.0, st.session_state.generation_params["guidance"], 0.5, key="guidance_slider", help="Higher values = more adherence to the prompt")
    st.session_state.generation_params["guidance"] = guidance
    
    st.markdown("### 📝 Prompt Templates")
    st.write("Each tile uses specialized prompts optimized for different musical elements.")
    st.markdown('</div>', unsafe_allow_html=True)

# Default prompts for each tool
default_prompts = {
    "beats": (
        "Enhance the input into a clean, professional drum loop while PRESERVING the original rhythm, timing,"
        " and overall pattern. Keep the same tempo and bar structure. Tighten transients (kick, snare, hats),"
        " reduce noise/room tone, avoid adding new fills or variations. Seamless loop, minimal changes beyond"
        " denoise and polish. No extra instruments."
    ),
    "bass": (
        "Convert the input into a bassline that closely MATCHES the original notes and timing. Preserve phrasing,"
        " groove and rests. Make it deep, clean, mix-ready with even low-end and gentle saturation. Do not change"
        " the melody or add counterlines; keep tempo and structure identical. Seamless loop."
    ),
    "melody": (
        "Render the input as a melodic synth or piano layer that RETAINS the same pitches, rhythm and contour."
        " Preserve key/scale and bar alignment. Clean tone, mild reverb, no extra harmony or ornaments."
        " Output should be loop-safe and very faithful to the input performance."
    ),
    "vocals": (
        "Process the input vocal to be clean and musical while KEEPING the same melody, timing and words/phonemes."
        " Remove noise, plosives and room; light tuning and compression only. No re-writing, no new harmonies,"
        " no ad-libs. Preserve phrasing and breaths; produce a loopable stem."
    ),
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
    
    # Main controls: show recorder directly and auto-process on stop
    col1, col2, col3 = container.columns([1, 1, 1])
    if tile["status"] in ("idle", "recording"):
        audio_data = None
        if mic_recorder:
            audio_data = mic_recorder(start_prompt="🎤 Record", stop_prompt="⏹️ Stop & Process", key=f"micrec_{tile_key}")
        elif audio_recorder:
            audio_data = audio_recorder(
                text="⏹️ Stop & Process",
                recording_color="#ff4444",
                neutral_color="#ffffff",
                icon_size="2x",
                key=f"audiorec_{tile_key}"
            )
        elif st_audiorec:
            audio_data = st_audiorec(key=f"recorder_{tile_key}")
        else:
            container.error("No microphone component available.")

        if audio_data is not None:
            st.session_state[f"mic_{tile_key}"] = audio_data
            tile["status"] = "processing"
            process_recording(tile_key, container)
            st.rerun()
    
    elif tile["status"] == "processing":
        # Processing - show detailed status
        container.info("🔄 Processing your audio... Please wait...")
        with st.spinner("🤖 AI is working on your audio..."):
            time.sleep(0.1)
    
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
        container.markdown("### 🎵 Generated Audio")
        for i, audio_file in enumerate(tile["generated_files"]):
            if os.path.exists(audio_file):
                # Create professional audio player
                audio_html = create_audio_player_html(audio_file, tile_key, i)
                components.html(audio_html, height=200, scrolling=False)

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
        wav_path = mic_data
        container.info("✅ Using uploaded audio file")
    else:
        wav_path = save_mic_output(mic_data)
        if wav_path is None:
            container.error("❌ Failed to save recording. Please try again.")
            tile["status"] = "idle"
            return
    
    # Step 2: Validate recording
    container.info("🔄 Step 2/6: Validating audio quality...")
    duration = get_audio_duration(wav_path)
    if duration < 0.5:
        container.error("❌ Recording too short. Please record for at least 0.5 seconds.")
        os.unlink(wav_path)
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
        
        # Use the input duration (ceil to whole seconds, minimum 1s)
        total_seconds = max(1, int(math.ceil(duration)))
        
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
                total_seconds
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
            last_generated = tile["generated_files"][-1]
            if os.path.exists(last_generated):
                mixed_path = mix_audio_files(last_generated, generated_path)
                tile["generated_files"].append(mixed_path)
                os.unlink(generated_path)
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
        if os.path.exists(wav_path):
            os.unlink(wav_path)

# Main layout with 4 tiles in a 2x2 grid
st.markdown("### 🎵 Create Your Music - Click any tile to start!")

# Create the 2x2 grid
col1, col2 = st.columns(2)

with col1:
    # Beats tile
    beats_container = st.container()
    render_tile("beats", "🥁 Beats", beats_container)
    
    # Melody tile
    melody_container = st.container()
    render_tile("melody", "🎹 Melody", melody_container)

with col2:
    # Bass tile
    bass_container = st.container()
    render_tile("bass", "🎸 Bass", bass_container)
    
    # Vocals tile
    vocals_container = st.container()
    render_tile("vocals", "🎤 Vocals", vocals_container)

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