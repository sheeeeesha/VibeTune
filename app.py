
import streamlit as st
import tempfile
import requests
from mutagen import File
from streamlit_mic_recorder import mic_recorder
import fal_client


# -----------------------------
# Helper Functions
# -----------------------------
def get_audio_duration(file_path):
    audio = File(file_path)
    if audio and audio.info:
        return int(audio.info.length)
    return 0


def process_audio(api_key, input_audio_path, prompt, duration):
    """Send audio to FAL API for processing."""
    client = fal_client.SyncClient(key=api_key)  # ✅ No env var needed

    # Upload input audio to FAL
    with open(input_audio_path, "rb") as f:
        file_bytes = f.read()

    audio_url = client.upload(
        file_bytes, content_type="audio/wav", file_name="input_audio.wav"
    )

    # Process audio
    result = client.run(
        "fal-ai/stable-audio-25/audio-to-audio",
        arguments={
            "prompt": prompt,
            "audio_url": audio_url,
            "strength": 0.85,
            "num_inference_steps": 8,
            "guidance_scale": 3,
            "total_seconds": duration,
        },
    )

    return result["audio"]["url"]


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
# Streamlit App UI
# -----------------------------
st.title("🎶 Audio Style Converter")

# API Key input
api_key = st.text_input("🔑 Enter your FAL API Key", type="password")

# Audio input (upload or mic)
st.subheader("🎤 Input Audio")
uploaded_file = st.file_uploader("Upload an audio file", type=["mp3", "wav", "ogg"])
mic_audio = mic_recorder(start_prompt="🎙️ Start recording", stop_prompt="⏹️ Stop recording", key="recorder")

input_audio_path = None
duration = 0

if uploaded_file:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(uploaded_file.read())
        input_audio_path = tmp.name
    st.audio(input_audio_path, format="audio/wav")
    duration = get_audio_duration(input_audio_path)
    st.write(f"Clip duration: {duration} seconds")

elif mic_audio:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(mic_audio)
        input_audio_path = tmp.name
    st.audio(input_audio_path, format="audio/wav")
    duration = get_audio_duration(input_audio_path)
    st.write(f"Clip duration: {duration} seconds")

# Prompt Section
st.subheader("✨ Choose or Write a Prompt")

# Genre category
genre = st.selectbox("🎵 Pick a genre/style", ["Custom"] + list(prompt_library.keys()))

if genre == "Custom":
    prompt = st.text_area("Write your detailed prompt here (be as descriptive as possible)")
else:
    prompt = st.selectbox("Pick a detailed prompt", prompt_library[genre])

# Process Button
if st.button("🚀 Convert Audio"):
    if not api_key:
        st.error("Please enter your FAL API key.")
    elif not input_audio_path:
        st.error("Please upload or record an audio file.")
    elif not prompt.strip():
        st.error("Please provide a prompt.")
    else:
        with st.spinner("Processing with FAL... 🎶"):
            try:
                output_url = process_audio(api_key, input_audio_path, prompt, duration)
                st.success("✅ Conversion Complete!")
                st.audio(output_url, format="audio/wav")
                st.markdown(f"[Download Result]({output_url})")
            except Exception as e:
                st.error(f"Processing failed: {e}")
