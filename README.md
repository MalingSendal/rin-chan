# RinAI &nbsp;

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-Web%20API-lightgrey?logo=flask)
![Discord](https://img.shields.io/badge/Discord-Bot-5865F2?logo=discord)
![NLP](https://img.shields.io/badge/NLP-SentenceTransformers-green?logo=ai)
![License](https://img.shields.io/badge/License-Private-red)

## 🌸 RinAI: Your Evolving AI Companion

**RinAI** is a memory-augmented, Stoic AI chatbot and Discord bot. RinAI remembers facts about users, evolves her personality, and adapts her quirks and traits based on your interactions. She supports both a web chat interface and Discord, can generate and receive voice responses, and features a Live2D animated avatar.

## ✨ Key Features

- **🧠 Long-Term Memory:** Remembers user facts, preferences, and conversation history across sessions.
- **🎭 Dynamic Personality:** Evolves traits and quirks based on user interactions and extracted facts.
- **💬 Web Chat UI:** WhatsApp-inspired chat interface with timestamps and voice playback.
- **🎤 Voice Input & Output:** Talk to RinAI using your voice and receive spoken responses (gTTS-powered).
- **🤖 Discord Bot:** Chat with RinAI directly in your Discord server using `!rin` prefix.
- **🗣️ Voice Synthesis:** Generates voice responses using gTTS (Google Text-to-Speech).
- **⏰ Time Awareness:** Adapts responses based on time since last interaction (see [`app/routes.py`](app/routes.py), [`app/memory.py`](app/memory.py)).
- **📚 Fact Extraction:** Learns and stores facts about users from conversations, with persistent storage.
- **🔗 Embedding Memory:** Uses sentence-transformers for semantic memory and context retrieval.
- **📝 Persistent Storage:** Stores memory, facts, and personality in JSON and CSV files.
- **🌈 Customizable Personality:** Easily tweakable via `personality.json` and user facts.
- **🎵 Audio & Songs:** Supports audio responses and song playback (see `audio/` and `songs/` folders).
- **🧑‍🎤 Live2D Avatar:** Interactive Live2D RinAI avatar for a more engaging chat experience.

---

## 🗂️ Project Structure

```
.
├── app/
│   ├── __init__.py            # Flask app factory
│   ├── config.py              # Config and system prompt (not committed)
│   ├── facts.py               # Fact extraction and memory logic
│   ├── llm_client.py          # LLM API integration
│   ├── memory.py              # Long-term memory logic
│   ├── personality.py         # Personality evolution logic
│   ├── routes.py              # Flask routes (web API)
├── templates/
│   ├── index.html             # Web chat UI
│   └── live2d.html            # Live2D avatar interface
├── Appearance/
│   └── Rin2.png               # Images and avatars
├── audio/
│   └── ...                    # Voice response output (not committed)
├── songs/
│   └── ...                    # Songs and audio files (not committed)
├── discord_bot.py             # Discord bot integration (not committed)
├── main.py                    # App entrypoint
├── requirements.txt           # Python dependencies
├── personality.json           # Persistent personality state (not committed)
├── user_facts.json            # User facts and rules (not committed)
├── interaction_memory.json    # Last interaction timestamps (not committed)
├── chat_memory.csv            # Conversation logs (not committed)
├── facts_memory.csv           # Extracted user facts (not committed)
└── .env                       # Environment variables (not committed)
```

---

## 🚀 Getting Started

### 1. Clone the Repository

```sh
git clone https://github.com/MalingSendal/rin-chan.git
cd rintemo
```

### 2. Install Dependencies

```sh
pip install -r requirements.txt
```

### 3. Set Up Environment

Create a `.env` file with your Discord token and DeepSeek API key:

```
DEEPSEEK_API_KEY=your_api_key_here
DISCORD_TOKEN=your_discord_token_here
AI_NAME=Rin
```

### 4. Run the Web App

```sh
python3 main.py
```

Visit [http://localhost:5000](http://localhost:5000) to chat with RinAI.

### 5. Run the Discord Bot

```sh
python discord_bot.py
```

---

## 🤖 Discord Integration

- Use `!rin` as a prefix to chat with RinAI in Discord.
- RinAI remembers facts and evolves her personality for each user.
- Supports voice responses and fact-based memory in Discord.

---

## 🧩 Personality & Memory

- **Personality:** Defined and evolved in [`app/personality.py`](app/personality.py) and [`personality.json`](personality.json).
- **Facts:** Extracted and stored in [`user_facts.json`](user_facts.json) and [`facts_memory.csv`](facts_memory.csv).
- **Memory:** Embeddings and texts stored in [`personality.json`](personality.json) and [`interaction_memory.json`](interaction_memory.json).
- **Time Awareness:** Tracks and adapts responses based on the time since the last interaction.

---

## 🛠️ Technologies Used

- **Python 3.10+**
- **Flask** (Web API)
- **Flask-SocketIO** (Real-time communication)
- **Discord.py** (Discord bot)
- **sentence-transformers** (Semantic embeddings)
- **gtts** (Text-to-speech)
- **scikit-learn** (NLP utilities)
- **dotenv** (Environment variables)
- **pytz** (Timezone support)
- **Live2D** (Animated avatar integration)

---

## 💡 Credits

- Created by Ren.
- Inspired by NeuroAI and memory-augmented agents.

---

> _"I'm Rin, your AI companion."_
