from app import create_app

app, socketio = create_app()  # Unpack the tuple

if __name__ == "__main__":
    # Use socketio.run() instead of app.run() for WebSocket support
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)