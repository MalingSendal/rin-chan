from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Initialize extensions without app
socketio = SocketIO()  # Single global instance

def create_app():
    load_dotenv()
    app = Flask(__name__, template_folder="../templates", static_folder="../static")
    CORS(app)
    
    # Initialize with app
    socketio.init_app(app)  # Use the global instance
    
    from .memory import LongTermMemory
    LongTermMemory.init_memory()

    from .routes import register_routes
    register_routes(app, socketio)

    return app, socketio  # Correct return order