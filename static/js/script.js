// =====================
// Global variables
// =====================
let live2dModel = null;         // The Live2D model instance
let isSpeaking = false;         // Whether the model is currently speaking
let speakInterval = null;       // Interval for speaking animation
let idleInterval = null;        // Interval for idle animation
let animationInterval = null;   // Interval for breathing/head bobbing
let audioContext = null;        // Web Audio API context
let analyser = null;            // Audio analyser node
let audioSource = null;         // Audio source node
let animationId = null;         // Animation frame ID for audio analysis
let currentAudio = null;        // Currently playing audio element
let recognition;                // SpeechRecognition instance
let recognizing = false;        // Is voice recognition active

// =====================
// Voice Recognition Setup
// =====================
// Uses browser's Web Speech API to allow voice input for chat
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // <-- Change this for other languages
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = function() {
        recognizing = true;
        // Optionally, update UI to show listening state
        console.log("Voice recognition started");
    };

    recognition.onend = function() {
        recognizing = false;
        // Optionally, update UI to show stopped state
        console.log("Voice recognition stopped");
    };

    recognition.onerror = function(event) {
        recognizing = false;
        console.warn("Voice recognition error:", event.error);
    };

    recognition.onresult = function(event) {
        if (event.results.length > 0) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('message-input').value = transcript;
            sendMessage(); // Automatically send the recognized message
        }
    };
}

// =====================
// Page Initialization
// =====================
window.onload = function() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
    loadLive2D(); // Load the Live2D model

    // Event listeners for chat input
    document.getElementById('send-button').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Add a mic button for voice recognition if not present
    if (!document.getElementById('mic-button')) {
        const micBtn = document.createElement('button');
        micBtn.id = 'mic-button';
        micBtn.innerHTML = '🎤';
        micBtn.title = 'Speak instead of typing';
        micBtn.style.marginLeft = '8px';
        document.querySelector('.input-area').appendChild(micBtn);
        micBtn.addEventListener('click', startVoiceRecognition);
    }

    // Clean up when page unloads
    window.addEventListener('beforeunload', cleanup);
};

// =====================
// Start voice recognition (called by mic button)
// =====================
function startVoiceRecognition() {
    if (recognition && !recognizing) {
        recognition.start();
    }
}

// =====================
// Clean up audio and animation resources
// =====================
function cleanup() {
    // Clean up audio resources
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }
    if (audioContext) {
        if (audioSource) audioSource.disconnect();
        if (analyser) analyser.disconnect();
        audioContext.close().catch(e => console.warn("Error closing audio context:", e));
    }
    // Stop any ongoing animations
    stopSpeakingAnimation();
    stopAudioAnalysis();
}

// =====================
// Send a chat message to the backend and handle response
// =====================
function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (message) {
        addMessage('user', message, new Date().toLocaleTimeString());
        input.value = '';
        
        fetch('/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: `message=${encodeURIComponent(message)}&platform=web&user_id=null`
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text) });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                addMessage('bot', `Error: ${data.error}`, new Date().toLocaleTimeString());
            } else {
                addMessage('bot', data.response, new Date().toLocaleTimeString());
                
                // Play voice response if available
                if (data.voice_file) {
                    playVoiceResponse(data.voice_file);
                }
                // Play song if available
                if (data.song_file) {
                    playSong(data.song_file);
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            addMessage('bot', `Error: ${error.message.substring(0, 100)}`, new Date().toLocaleTimeString());
            stopSpeakingAnimation();
        });
    }
}

// =====================
// Play the bot's voice response (audio)
// =====================
async function playVoiceResponse(voiceFile) {
    // Stop any existing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }
    
    try {
        // Determine audio URL
        let audioUrl;
        if (voiceFile && (voiceFile.startsWith('http') || voiceFile.startsWith('/'))) {
            audioUrl = voiceFile;
        } else {
            audioUrl = '/audio/response.mp3';
        }
        // Add cache buster
        const finalUrl = `${audioUrl}?t=${Date.now()}`;
        console.log('Attempting to play audio from:', finalUrl);

        // Optional: Check if file exists
        try {
            const response = await fetch(finalUrl, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error(`Audio file not found at ${finalUrl}`);
            }
        } catch (fetchError) {
            console.warn('HEAD request failed, trying to play anyway:', fetchError);
        }

        // Create and play audio
        currentAudio = new Audio(finalUrl);
        currentAudio.preload = 'auto';
        currentAudio.onerror = (e) => {
            console.error('Audio error:', e, currentAudio.error);
            stopSpeakingAnimation();
            // Fallback to default audio path
            if (audioUrl !== '/audio/response.mp3') {
                playVoiceResponse('/audio/response.mp3');
            }
        };
        currentAudio.onplay = () => {
            startSpeakingAnimation();
            startAudioAnalysis(currentAudio);
        };
        currentAudio.onended = () => {
            stopSpeakingAnimation();
            stopAudioAnalysis();
        };
        await currentAudio.play().catch(playError => {
            console.error('Play failed, trying fallback:', playError);
            currentAudio.src = audioUrl;
            return currentAudio.play();
        });
    } catch (error) {
        console.error('Audio playback failed:', error);
        stopSpeakingAnimation();
        addMessage('bot', 'Voice response unavailable', new Date().toLocaleTimeString());
        // Final fallback
        if (!voiceFile || voiceFile !== '/audio/response.mp3') {
            playVoiceResponse('/audio/response.mp3');
        }
    }
}

// =====================
// Play a song file (audio)
// =====================
function playSong(songFile) {
    // Stop any existing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }
    // Add cache buster
    const audioUrl = `${songFile}?t=${Date.now()}`;
    const songAudio = new Audio(audioUrl);
    songAudio.type = 'audio/mpeg';
    songAudio.onerror = (e) => {
        console.error('Song playback error:', e, songAudio.error);
    };
    songAudio.play().catch(e => {
        console.error("Song playback failed:", e);
        // Fallback: fetch as blob and play
        fetch(songFile)
            .then(response => response.blob())
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob);
                songAudio.src = blobUrl;
                songAudio.onended = () => URL.revokeObjectURL(blobUrl);
                songAudio.play().catch(e => console.error('Fallback failed:', e));
            })
            .catch(error => console.error('Error loading song:', error));
    });
}

// =====================
// Add a message to the chat UI
// =====================
function addMessage(sender, message, timestamp) {
    const chatMessages = document.getElementById('chat-messages');
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.innerHTML = `
        ${message}
        <div class="message-time">${timestamp}</div>
    `;
    messageContainer.appendChild(messageDiv);
    chatMessages.appendChild(messageContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// =====================
// Start analyzing audio for mouth movement sync
// =====================
function startAudioAnalysis(audioElement) {
    try {
        // Create audio context and analyser if not exists
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 32; // <-- Tweak this for mouth movement sensitivity
        }
        // Connect audio source to analyser
        if (audioSource) audioSource.disconnect();
        audioSource = audioContext.createMediaElementSource(audioElement);
        audioSource.connect(analyser);
        analyser.connect(audioContext.destination);
        // Analyze audio and update mouth movement
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        function analyzeAudio() {
            if (!isSpeaking) return;
            analyser.getByteFrequencyData(dataArray);
            const volume = Math.max(...dataArray) / 255; // Normalize to 0-1
            const mouthOpen = Math.min(volume * 1.5, 0.9); // <-- Tweak multiplier/cap for mouth open range
            updateMouthParameters(mouthOpen);
            animationId = requestAnimationFrame(analyzeAudio);
        }
        animationId = requestAnimationFrame(analyzeAudio);
    } catch (e) {
        console.error("Audio analysis error:", e);
        startRandomMouthMovement();
    }
}

// =====================
// Fallback: random mouth movement if audio analysis fails
// =====================
function startRandomMouthMovement() {
    clearInterval(speakInterval);
    speakInterval = setInterval(() => {
        if (!isSpeaking || !live2dModel || !live2dModel.internalModel) return;
        const mouthOpen = Math.random() * 0.5 + 0.3; // <-- Tweak range for idle/random mouth
        updateMouthParameters(mouthOpen);
    }, 100);
}

// =====================
// Update mouth parameters on the Live2D model
// =====================
function updateMouthParameters(value) {
    if (!live2dModel || !live2dModel.internalModel) return;
    try {
        const mouthParams = ["ParamMouthOpenY", "ParamMouthForm", "ParamMouthOpen"];
        mouthParams.forEach(param => {
            if (live2dModel.internalModel.coreModel.getParameterIndex(param) >= 0) {
                live2dModel.internalModel.coreModel.setParameterValueById(param, value);
            }
        });
    } catch (e) {
        console.warn("Error updating mouth parameters:", e);
    }
}

// =====================
// Stop audio analysis and mouth movement
// =====================
function stopAudioAnalysis() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    clearInterval(speakInterval);
}

// =====================
// Load and set up the Live2D model
// =====================
async function loadLive2D() {
    try {
        const canvas = document.getElementById('live2d-canvas');
        if (!canvas) throw new Error("Canvas element not found");
        // Create PIXI application for rendering
        console.log("Creating PIXI application...");
        const app = new PIXI.Application({
            view: canvas,
            width: 300, // <-- Change canvas size here
            height: 300,
            transparent: true,
            antialias: true,
            autoStart: true,
            resolution: window.devicePixelRatio || 1
        });
        // Load the Live2D model
        console.log("Loading Live2D model...");
        try {
            live2dModel = await PIXI.live2d.Live2DModel.from("/static/live2d/haru/runtime/haru_greeter_t05.model3.json");
            // <-- Change model path above to use a different Live2D model
            console.log("Model loaded successfully");
        } catch (error) {
            console.error("Model loading failed:", error);
            document.getElementById('live2d-container').innerHTML = "Failed to load Live2D model";
            return;
        }
        app.stage.addChild(live2dModel);
        // Center and scale the model
        live2dModel.anchor.set(0.5, 0.5);
        live2dModel.position.set(
            app.screen.width / 2,
            app.screen.height / 0.6 // <-- Adjust vertical position here
        );
        // Adjust scale to fit container
        const scale = Math.min(
            (app.screen.width * 4) / live2dModel.width,
            (app.screen.height * 4) / live2dModel.height
        );
        live2dModel.scale.set(scale * 0.8); // <-- Change 0.8 for overall model size
        // Initialize model parameters
        if (live2dModel.internalModel) {
            const coreModel = live2dModel.internalModel.coreModel;
            coreModel.saveParameters();
        }
        // Handle window resize for responsive model
        const resizeModel = () => {
            live2dModel.position.set(
                app.screen.width / 2,
                app.screen.height / 2
            );
            const newScale = Math.min(
                (app.screen.width * 0.8) / live2dModel.width,
                (app.screen.height * 0.8) / live2dModel.height
            );
            live2dModel.scale.set(newScale * 0.8);
        };
        window.addEventListener('resize', resizeModel);
        console.log("Live2D setup complete");
    } catch (error) {
        console.error("Live2D initialization failed:", error);
        document.getElementById('live2d-container').innerHTML = "Live2D Error: " + error.message;
        throw error;
    }
}

// =====================
// Start idle animations (head/body movement, blinking, breathing)
// =====================


// =====================
// Smoothly transition a model parameter to a target value
// =====================
function smoothTransition(param, targetValue, duration) {
    if (!live2dModel || !live2dModel.internalModel) return;
    const coreModel = live2dModel.internalModel.coreModel;
    const paramIndex = coreModel.getParameterIndex(param);
    if (paramIndex < 0) return;
    const startValue = coreModel.getParameterValueByIndex(paramIndex);
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    function update() {
        const now = Date.now();
        if (now >= endTime) {
            coreModel.setParameterValueByIndex(paramIndex, targetValue);
            return;
        }
        const progress = (now - startTime) / (endTime - startTime);
        const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // Smooth easing
        const currentValue = startValue + (targetValue - startValue) * easedProgress;
        coreModel.setParameterValueByIndex(paramIndex, currentValue);
        requestAnimationFrame(update);
    }
    update();
}

// =====================
// Blink the model's eyes (close then open)
// =====================
function blinkEyes() {
    if (!live2dModel || isSpeaking) return;
    try {
        // Close eyes
        smoothTransition("ParamEyeLOpen", 0, 0.1);
        smoothTransition("ParamEyeROpen", 0, 0.1);
        // Open eyes after short delay
        setTimeout(() => {
            smoothTransition("ParamEyeLOpen", 1, 0.15);
            smoothTransition("ParamEyeROpen", 1, 0.15);
        }, 150); // <-- Tweak blink duration
    } catch (e) {
        console.warn("Error blinking:", e);
    }
}

// =====================
// Start speaking animation (head movement while speaking)
// =====================
function startSpeakingAnimation() {
    if (!live2dModel || isSpeaking) return;
    isSpeaking = true;
    // Stop idle animations
    clearInterval(idleInterval);
    clearInterval(animationInterval);
    idleInterval = null;
    animationInterval = null;
    // Head and body movement while speaking
    speakInterval = setInterval(() => {
        if (!live2dModel || !live2dModel.internalModel) return;
        try {
            const t = Date.now();
            // Head movement
            live2dModel.internalModel.coreModel.setParameterValueById(
                "ParamAngleX", 
                Math.sin(t / 600) * 5 // Slower, wider head X movement
            );
            live2dModel.internalModel.coreModel.setParameterValueById(
                "ParamAngleY", 
                Math.sin(t / 900) * 4 // Slower, wider head Y movement
            );
            live2dModel.internalModel.coreModel.setParameterValueById(
                "ParamAngleZ", 
                Math.sin(t / 1200) * 3 // Head tilt
            );
            // Body movement
            live2dModel.internalModel.coreModel.setParameterValueById(
                "ParamBodyAngleX",
                Math.sin(t / 1000) * 6 // Body sway X
            );
            live2dModel.internalModel.coreModel.setParameterValueById(
                "ParamBodyAngleY",
                Math.sin(t / 1400) * 5 // Body sway Y
            );
        } catch (e) {
            console.warn("Error during speaking animation:", e);
        }
    }, 50);
}

// =====================
// Stop speaking animation and return to idle
// =====================
function stopSpeakingAnimation() {
    isSpeaking = false;
    stopAudioAnalysis();
    if (live2dModel && live2dModel.internalModel) {
        // Reset mouth to closed
        const mouthParams = ["ParamMouthOpenY", "ParamMouthForm", "ParamMouthOpen"];
        mouthParams.forEach(param => {
            if (live2dModel.internalModel.coreModel.getParameterIndex(param) >= 0) {
                live2dModel.internalModel.coreModel.setParameterValueById(param, 0);
            }
        });
    }
}