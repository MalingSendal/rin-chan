#routes.py

from datetime import datetime
from flask import request, jsonify, current_app, render_template, send_file, send_from_directory, Response, json
from flask_socketio import emit
from .memory import LongTermMemory
from .facts import FactMemory
from .llm_client import call_llm
from .config import Config
from .personality import Personality
from gtts import gTTS
import requests
import json
import pytz
import csv
import os
import re

DEFAULT_USER_ID = "DISCORD_USER_ID"  # Ren's user ID
AUDIO_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "audio")
SONGS_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "songs")
AUDIO_FILENAME = "response.mp3"  # Fixed filename for audio responses

# Ensure directories exist
os.makedirs(AUDIO_FOLDER, exist_ok=True)
os.makedirs(SONGS_FOLDER, exist_ok=True)

def talk_to_other_ai(message):
    """
    Send a message to the other Flask AI running on port 4000 and return its response.
    """
    try:
        resp = requests.post(
            "http://localhost:4000/chat",
            data={"message": message, "platform": "web", "user_id": "external"},
            timeout=10
        )
        if resp.status_code == 200:
            return resp.json().get("response", "")
        else:
            return f"[Other AI error: {resp.status_code}]"
    except Exception as e:
        return f"[Failed to contact other AI: {e}]"

def calculate_time_difference(last_interaction):
    jakarta_tz = pytz.timezone("Asia/Jakarta")
    now = datetime.now(jakarta_tz)

    if not last_interaction:
        return "This is our first interaction!"
    last_time = datetime.strptime(last_interaction, "%Y-%m-%d %H:%M:%S")
    now = datetime.now()
    delta = now - last_time
    if delta.days > 0:
        return f"It's been {delta.days} day(s) since we last talked."
    elif delta.seconds > 3600:
        return f"It's been {delta.seconds // 3600} hour(s) since we last talked."
    elif delta.seconds > 60:
        return f"It's been {delta.seconds // 60} minute(s) since we last talked."
    else:
        return "We just talked a moment ago!"
    
def generate_voice_response(text, personality_traits=None, voice_name=None):
    """
    Generate a voice response using gTTS with fixed filename
    """
    try:
        filepath = os.path.join(AUDIO_FOLDER, AUDIO_FILENAME)
        
        # Create/overwrite the audio file
        tts = gTTS(text=text, lang="en")
        tts.save(filepath)
        
        # Return the fixed audio path
        return f"/audio/{AUDIO_FILENAME}"
    except Exception as e:
        current_app.logger.error(f"Voice generation error: {str(e)}")
        raise RuntimeError(f"Error generating voice response: {str(e)}")

def register_routes(app, socketio):
    @app.route("/")
    def home():
        conversation = []
        user_ip = request.remote_addr
        
        if os.path.exists("chat_memory.csv"):
            with open("chat_memory.csv", 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    conversation.append({
                        "timestamp": row["timestamp"],
                        "sender": "user",
                        "message": row["user_message"]
                    })
                    conversation.append({
                        "timestamp": row["timestamp"],
                        "sender": "bot",
                        "message": row["bot_response"]
                    })
        return render_template("index.html", conversation=conversation)
    
    @app.route('/live2d')
    def live2d():
        return render_template('live2d.html')
 
    @app.route('/static/<path:filename>')
    def custom_static(filename):
        return send_from_directory(app.static_folder, filename)
    
    @app.route('/audio/<filename>')
    def serve_audio(filename):
        """Endpoint to serve audio files with proper headers"""
        try:
            # Only allow the fixed filename
            if filename != AUDIO_FILENAME:
                return "Invalid filename", 400

            filepath = os.path.join(AUDIO_FOLDER, filename)
            if not os.path.exists(filepath):
                return "Audio file not found", 404

            # Use the absolute path for send_from_directory
            return send_from_directory(AUDIO_FOLDER, filename)

        except Exception as e:
            current_app.logger.error(f"Audio serve error: {str(e)}")
            return str(e), 500
        
    @app.route("/chat", methods=["POST"])
    def chat():
        platform = request.form.get("platform", "web")  # Default to web if not specified
        user_id = request.form.get("user_id")
        
        # If it's web/Flask (not Discord) and user_id is null/None, use Ren's ID
        if platform != "discord" and (not user_id or user_id == "null"):
            user_id = DEFAULT_USER_ID
            
        user_reference = request.form.get("user_reference")
        user_input = request.form.get("message")

        if not user_input:
            return jsonify({"error": "No message provided"}), 400
        
                # Check if the user wants to talk to the other AI
        if user_input.lower().startswith("ask other:"):
            other_message = user_input[len("ask other:"):].strip()
            other_ai_response = talk_to_other_ai(other_message)
            # Optionally, you can process or rephrase the response here
            bot_response = f"Other AI says: {other_ai_response}"
            voice_file = generate_voice_response(bot_response)
            return jsonify({
                "response": bot_response,
                "voice_file": voice_file,
                "memories_used": []
            })
        
        try:
            # Detect if the user is asking to play a song
            song_request_match = re.search(r"play(?: the)? (.+?) song", user_input, re.IGNORECASE)
            if song_request_match:
                song_name = song_request_match.group(1).strip()
                song_filename = f"{song_name}.mp3"
                song_path = os.path.join(SONGS_FOLDER, song_filename)

                if os.path.exists(song_path):
                    # Generate a voice response announcing the song
                    announcement = f"Now playing {song_name}."
                    voice_file = generate_voice_response(announcement)

                    return jsonify({
                        "response": announcement,
                        "voice_file": voice_file,
                        "song_file": f"/song/{song_filename}"  # Use the song endpoint
                    })
                else:
                    # Respond if the song is not found
                    not_found_message = f"Sorry, I couldn't find the song '{song_name}'."
                    voice_file = generate_voice_response(not_found_message)

                    return jsonify({
                        "response": not_found_message,
                        "voice_file": voice_file
                    })

            # Retrieve last interaction time
            last_interaction = LongTermMemory.get_last_interaction_time(user_id)
            time_message = calculate_time_difference(last_interaction)
            LongTermMemory.update_last_interaction_time(user_id)

            # Retrieve user-specific facts
            user_facts = FactMemory.get_user_facts(user_id)
            if user_facts:
                facts_text = ", ".join(f"{k.replace('_', ' ')}: {v}" for k, v in user_facts.items())
            else:
                facts_text = f"I don't know much about {user_reference} yet."

            if not user_facts:
                user_reference = request.form.get("user_reference", "Unknown User")
            else:
                user_reference = user_facts.get("user_name", request.form.get("user_reference", "Unknown User"))

            # Prepare system messages
            messages = [{"role": "system", "content": Config.get_system_prompt()}]
            messages.append({"role": "system", "content": f"Facts about {user_reference}: {facts_text}"})

            # Extract and save user-specific facts
            new_facts = FactMemory.extract_facts_from_message(user_input)
            for key, value in new_facts.items():
                FactMemory.save_user_fact(user_id, key, value)

            # Personality and memory handling
            personality = Personality(user_id)
            recalled_memories = LongTermMemory.recall_memories(user_input)
            personality.evolve_from_facts(new_facts)

            personality_context = personality.get_traits_and_quirks()
            messages.append({
                "role": "system",
                "content": f"Here are your current behavioral tendencies and quirks: {personality_context}. "
                        "Maintain consistency with your evolving traits."
            })

            for memory in recalled_memories:
                messages.append({"role": "system", "content": memory})

            # Add user input and get bot response
            messages.append({"role": "user", "content": user_input})
            bot_response = call_llm(messages)

            # Save memory and observe interaction
            LongTermMemory.save_memory(user_id, user_input, bot_response)
            personality.observe_interaction(user_input, bot_response)

            # Generate voice response
            voice_file = generate_voice_response(bot_response)

            return jsonify({
                "response": bot_response,
                "voice_file": voice_file,
                "memories_used": recalled_memories
            })

        except Exception as e:
            current_app.logger.error(f"Chat error: {str(e)}")
            return jsonify({"error": "Internal server error", "details": str(e)}), 500

    @app.route("/song/<filename>")
    def serve_song(filename):
        """Endpoint to serve song files with proper headers"""
        try:
            # Security check
            if not filename.endswith('.mp3') or '../' in filename:
                return "Invalid filename", 400
                
            filepath = os.path.join(SONGS_FOLDER, filename)
            if not os.path.exists(filepath):
                return "Song not found", 404
                
            return send_file(
                filepath,
                mimetype='audio/mpeg',
                as_attachment=False,
                conditional=True
            )
        except Exception as e:
            current_app.logger.error(f"Song serve error: {str(e)}")
            return str(e), 500

    @app.route("/play_song", methods=["POST"])
    def play_song():
        song_name = request.form.get("song_name")
        if not song_name:
            return jsonify({"error": "No song name provided"}), 400

        # Check if the song exists in the folder
        song_path = os.path.join(SONGS_FOLDER, f"{song_name}.mp3")
        if not os.path.exists(song_path):
            return jsonify({"error": f"Song '{song_name}' not found"}), 404

        try:
            # Generate a voice response announcing the song
            announcement = f"Now playing {song_name}."
            voice_file = generate_voice_response(announcement)

            # Return the voice file and the song file
            return jsonify({
                "announcement_voice_file": voice_file,
                "song_file": song_path
            })
        except Exception as e:
            app.logger.error(f"Error playing song: {str(e)}")
            return jsonify({"error": "Internal server error", "details": str(e)}), 500

    @app.route("/get_conversation")
    def get_conversation():
        try:
            conversation = []
            if os.path.exists("chat_memory.csv"):
                with open("chat_memory.csv", 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        conversation.append({
                            "timestamp": row["timestamp"],
                            "sender": "user",
                            "message": row["user_message"]
                        })
                        conversation.append({
                            "timestamp": row["timestamp"],
                            "sender": "bot",
                            "message": row["bot_response"]
                        })
            return jsonify(conversation)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        
    @socketio.on('user_message')
    def handle_message(message):
        # Get your AI response (use your existing chat logic)
        ai_response = call_llm(message)  # Replace with your actual LLM call
        
        # Emit response with Live2D action
        emit('bot_response', {'text': 'Message received'})
        
    @app.route("/stream")
    def stream():
        def event_stream():
            while True:
                # Replace with your logic to get Live2D triggers
                data = {"action": "blink"}  
                yield f"data: {json.dumps(data)}\n\n"
        return Response(event_stream(), mimetype="text/event-stream")

    @app.route('/test-static')
    def test_static():
        return app.send_static_file('live2d/cubismweb/Core/live2dcubismcore.min.js')
    
