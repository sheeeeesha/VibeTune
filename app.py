

import streamlit as st
import tempfile
import requests
from mutagen import File
from streamlit_mic_recorder import mic_recorder
import fal_client
import io
import numpy as np
import soundfile as sf

try:
    from st_audiorec import st_audiorec
except Exception:
    st_audiorec = None


# -----------------------------
# Helper Functions
# -----------------------------
def get_audio_duration(file_path):
    """Return audio duration in seconds."""
    try:
        info = sf.info(file_path)
        if info and info.duration:
            return float(info.duration)
    except Exception:
        pass

    try:
        audio = File(file_path)
        if audio and audio.info and getattr(audio.info, "length", None):
            return float(audio.info.length)
    except Exception:
        pass
    return 0.0


def save_wav_file(raw_bytes):
    """Persist raw WAV bytes to a temporary file and return its path."""
    if not raw_bytes:
        return None
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(raw_bytes)
        return tmp.name


def save_mic_audio(mic_audio):
    """Convert mic input (recorder or audiorec) to a WAV file path."""
    if mic_audio is None:
        return None

    # Case: st_audiorec -> WAV bytes
    if isinstance(mic_audio, (bytes, bytearray)):
        return save_wav_file(mic_audio)

    # Case: dict from mic_recorder
    if isinstance(mic_audio, dict):
        if "bytes" in mic_audio and isinstance(mic_audio["bytes"], (bytes, bytearray)):
            return save_wav_file(mic_audio["bytes"])

        if "audio" in mic_audio:
            audio_array = np.array(mic_audio["audio"]).astype(np.float32)
            sr = mic_audio.get("sample_rate", 44100)
            wav_buffer = io.BytesIO()
            sf.write(wav_buffer, audio_array, sr, format="WAV")
            wav_buffer.seek(0)
            return save_wav_file(wav_buffer.read())

    # Case: raw list/ndarray of samples
    if isinstance(mic_audio, (list, np.ndarray)):
        audio_array = np.array(mic_audio).astype(np.float32)
        wav_buffer = io.BytesIO()
        sf.write(wav_buffer, audio_array, 44100, format="WAV")
        wav_buffer.seek(0)
        return save_wav_file(wav_buffer.read())

    return None


def process_audio(api_key, input_audio_path, prompt, duration, strength, steps, guidance):
    """Send audio to FAL API for processing."""
    client = fal_client.SyncClient(key=api_key)

    with open(input_audio_path, "rb") as f:
        file_bytes = f.read()

    audio_url = client.upload(file_bytes, content_type="audio/wav", file_name="input_audio.wav")

    result = client.run(
        "fal-ai/stable-audio-25/audio-to-audio",
        arguments={
            "prompt": prompt,
            "audio_url": audio_url,
            "strength": strength,
            "num_inference_steps": steps,
            "guidance_scale": guidance,
            "total_seconds": duration,
        },
    )

    return result["audio"]["url"]


def loop_audio_to_length(audio_url, target_length):
    """Download audio from URL and loop it to match/exceed target length (in seconds)."""
    try:
        resp = requests.get(audio_url)
        resp.raise_for_status()
        raw_bytes = io.BytesIO(resp.content)

        # Read audio
        data, sr = sf.read(raw_bytes, dtype="float32", always_2d=True)
        duration = len(data) / sr
        if duration <= 0:
            return None

        repeat_count = int(np.ceil(target_length / duration))
        looped_data = np.tile(data, (repeat_count, 1))

        # Trim to exact length
        target_samples = int(target_length * sr)
        looped_data = looped_data[:target_samples]

        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            sf.write(tmp.name, looped_data, sr, format="WAV")
            return tmp.name
    except Exception as e:
        st.warning(f"Looping failed: {e}")
        return None


# -----------------------------
# Prompt Library
# -----------------------------
prompt_library = {
    "🎧 EDM / Dance": [
        "Transform this into a festival-ready EDM track with punchy kicks, side-chained bass, and bright synth leads.",
        "Convert this into deep house beats with groovy basslines, subtle hi-hats, and warm pads.",
        "Make this into a hardstyle drop with distorted kicks, fast tempo, and aggressive synth stabs.",
    ],
    "🌙 Lo-Fi / Chill": [
        "Turn this into a lo-fi hip-hop loop with vinyl crackle, jazzy chords, and mellow drums.",
        "Convert this into a chillhop beat with relaxed guitar riffs, ambient textures, and smooth drums.",
        "Make this into a dreamy lo-fi ambient track with reverb-heavy synths and soft percussions.",
    ],
    "🎷 Jazz / Blues": [
        "Transform this into a smooth jazz jam with saxophone, upright bass, and brushed drums.",
        "Convert this into a bluesy shuffle with electric guitar riffs, bass, and slow swing drums.",
        "Make this into a big band swing with brass sections, walking bass, and energetic drums.",
    ],
    "🎬 Cinematic / Orchestral": [
        "Turn this into a cinematic score with strings, epic percussion, and emotional build-ups.",
        "Convert this into a suspenseful soundtrack with drones, dark synths, and heavy low-end.",
        "Make this into a fantasy-style orchestral score with flutes, violins, and majestic horns.",
    ],
    "🎤 Hip-Hop / Trap": [
        "Transform this into a trap beat with heavy 808s, hi-hat rolls, and snappy snares.",
        "Convert this into an old-school hip-hop groove with boom-bap drums and jazzy samples.",
        "Make this into a drill beat with sliding 808s, aggressive hi-hats, and dark melodies.",
    ],
}


# -----------------------------
# Streamlit UI
# -----------------------------
st.title("🎶 Audio Style Converter")

# API Key input
api_key = st.text_input("🔑 Enter your FAL API Key", type="password")

# Audio input
st.subheader("🎤 Input Audio")
input_method = st.radio(
    "Choose input method",
    ["Upload", "Mic (streamlit_mic_recorder)"] + (["Mic (st_audiorec)"] if st_audiorec else []),
    horizontal=True,
)

uploaded_file, mic_audio, audio_bytes_alt = None, None, None
if input_method == "Upload":
    uploaded_file = st.file_uploader("Upload an audio file", type=["mp3", "wav", "ogg"])
elif input_method == "Mic (streamlit_mic_recorder)":
    mic_audio = mic_recorder(start_prompt="🎙️ Start recording", stop_prompt="⏹️ Stop recording", key="recorder")
elif input_method == "Mic (st_audiorec)" and st_audiorec:
    audio_bytes_alt = st_audiorec()

input_audio_path, duration = None, 0

if uploaded_file:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(uploaded_file.read())
        input_audio_path = tmp.name
    st.audio(input_audio_path, format="audio/wav")
    duration = get_audio_duration(input_audio_path)
    st.write(f"⏱️ Detected clip duration: {duration:.2f} seconds")

elif mic_audio:
    input_audio_path = save_mic_audio(mic_audio)
    if input_audio_path:
        st.audio(input_audio_path)
        duration = get_audio_duration(input_audio_path)
        st.write(f"⏱️ Recorded duration: {duration:.2f} seconds")
    else:
        st.warning("⚠️ No audio captured from microphone. Please retry.")

elif audio_bytes_alt:
    input_audio_path = save_mic_audio(audio_bytes_alt)
    if input_audio_path:
        st.audio(input_audio_path)
        duration = get_audio_duration(input_audio_path)
        st.write(f"⏱️ Recorded duration: {duration:.2f} seconds")
    else:
        st.warning("⚠️ No audio captured from st_audiorec. Please retry.")


# Prompt Section
st.subheader("✨ Choose or Write a Prompt")
genre = st.selectbox("🎵 Pick a genre/style", ["Custom"] + list(prompt_library.keys()))
if genre == "Custom":
    prompt = st.text_area("Write your detailed prompt here (be as descriptive as possible)")
else:
    prompt = st.selectbox("Pick a detailed prompt", prompt_library[genre])


# Advanced Parameters
st.subheader("⚙️ Advanced Settings")
target_length = st.number_input("🎯 Target Audio Length (seconds)", min_value=5, max_value=600, value=30, step=5)
strength = st.slider("Strength", 0.0, 1.0, 0.85, 0.05)
steps = st.slider("Num Inference Steps", 1, 50, 8, 1)
guidance = st.slider("Guidance Scale", 1.0, 10.0, 3.0, 0.5)


# Process Button
if st.button("🚀 Convert Audio"):
    if not api_key:
        st.error("Please enter your FAL API key.")
    elif not input_audio_path:
        st.error("Please upload or record an audio file.")
    elif not prompt.strip():
        st.error("Please provide a prompt.")
    else:
        eff_duration = max(1, int(round(duration)))
        with st.spinner("Processing with FAL... 🎶"):
            try:
                output_url = process_audio(api_key, input_audio_path, prompt, eff_duration, strength, steps, guidance)

                # Loop to target length
                looped_path = loop_audio_to_length(output_url, target_length)
                if looped_path:
                    st.success("✅ Conversion Complete!")
                    st.audio(looped_path, format="audio/wav")
                    st.download_button("⬇️ Download Result", open(looped_path, "rb"), file_name="converted_looped.wav")
                else:
                    st.audio(output_url, format="audio/wav")
                    st.markdown(f"[Download Result]({output_url})")
            except Exception as e:
                st.error(f"Processing failed: {e}")
