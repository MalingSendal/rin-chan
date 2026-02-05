// Global variables
let live2dModel = null;
let isSpeaking = false;
let speakInterval = null;
let idleInterval = null;
let animationInterval = null;
let audioContext = null;
let analyser = null;
let audioSource = null;
let animationId = null;
let currentAudio = null;


// Initialize on page load
window.onload = function() {
    loadLive2D();
};

// Live2D functions
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

// Message handling functions
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
            body: `message=${encodeURIComponent(message)}`
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
                
                // Handle the voice response
                if (data.voice_file) {
                    playVoiceResponse(data.voice_file);
                }
                
                // Handle song playback if present
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

async function playVoiceResponse(voiceFile) {
    // Clean up any existing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }
    
    try {
        // Ensure we have a valid path
        let audioUrl;
        
        // Case 1: If voiceFile is provided and valid, use it
        if (voiceFile && (voiceFile.startsWith('http') || voiceFile.startsWith('/'))) {
            audioUrl = voiceFile;
        }
        // Case 2: Default path if no valid file provided
        else {
            audioUrl = '/audio/response.mp3';
        }
        
        // Add cache buster
        const finalUrl = `${audioUrl}?t=${Date.now()}`;
        console.log('Attempting to play audio from:', finalUrl);

        // Verify the file exists first (optional - can remove if causing issues)
        try {
            const response = await fetch(finalUrl, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error(`Audio file not found at ${finalUrl}`);
            }
        } catch (fetchError) {
            console.warn('HEAD request failed, trying to play anyway:', fetchError);
        }

        // Create new audio element
        currentAudio = new Audio(finalUrl);
        currentAudio.preload = 'auto';
        
        // Set up event listeners
        currentAudio.onerror = (e) => {
            console.error('Audio error:', e, currentAudio.error);
            stopSpeakingAnimation();
            // Fallback to alternative audio path if available
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

        // Attempt to play
        await currentAudio.play().catch(playError => {
            console.error('Play failed, trying fallback:', playError);
            // If play fails, try with just the audio URL without cache buster
            currentAudio.src = audioUrl;
            return currentAudio.play();
        });
        
    } catch (error) {
        console.error('Audio playback failed:', error);
        stopSpeakingAnimation();
        addMessage('bot', 'Voice response unavailable', new Date().toLocaleTimeString());
        
        // Final fallback - try default audio path if current attempt failed
        if (!voiceFile || voiceFile !== '/audio/response.mp3') {
            playVoiceResponse('/audio/response.mp3');
        }
    }
}

function playSong(songFile) {
    // Clean up existing audio
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
        
        // Fallback attempt
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

// Audio analysis functions
function startAudioAnalysis(audioElement) {
    try {
        // Create audio context if not exists
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 32;
        }
        
        // Connect audio source
        if (audioSource) audioSource.disconnect();
        audioSource = audioContext.createMediaElementSource(audioElement);
        audioSource.connect(analyser);
        analyser.connect(audioContext.destination);
        
        // Start analyzing the audio
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        function analyzeAudio() {
            if (!isSpeaking) return;
            
            analyser.getByteFrequencyData(dataArray);
            const volume = Math.max(...dataArray) / 255; // Normalize to 0-1
            
            // Map volume to mouth opening (adjust these values based on your model)
            const mouthOpen = Math.min(volume * 1.5, 0.9); // Cap at 0.9 to avoid over-opening
            
            updateMouthParameters(mouthOpen);
            
            animationId = requestAnimationFrame(analyzeAudio);
        }
        
        animationId = requestAnimationFrame(analyzeAudio);
    } catch (e) {
        console.error("Audio analysis error:", e);
        startRandomMouthMovement();
    }
}

function startRandomMouthMovement() {
    // Fallback mouth movement when audio analysis isn't available
    clearInterval(speakInterval);
    speakInterval = setInterval(() => {
        if (!isSpeaking || !live2dModel || !live2dModel.internalModel) return;
        
        const mouthOpen = Math.random() * 0.5 + 0.3; // Random mouth movement
        updateMouthParameters(mouthOpen);
    }, 100);
}

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

function stopAudioAnalysis() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    clearInterval(speakInterval);
}

async function loadLive2D() {
    try {
        const canvas = document.getElementById('live2d-canvas');
        if (!canvas) throw new Error("Canvas element not found");
        
        console.log("Creating PIXI application...");
        const app = new PIXI.Application({
            view: canvas,
            width: window.innerWidth,
            height: window.innerHeight,
            transparent: true,
            antialias: true,
            autoStart: true,
            resolution: window.devicePixelRatio || 1
        });
        
        console.log("Loading Live2D model...");
        try {
            live2dModel = await PIXI.live2d.Live2DModel.from("/static/live2d/haru/runtime/haru_greeter_t05.model3.json");
            console.log("Model loaded successfully");
        } catch (error) {
            console.error("Model loading failed:", error);
            document.getElementById('live2d-container').innerHTML = "Failed to load Live2D model";
            return;
        }
        
        app.stage.addChild(live2dModel);
        
        // Center the model properly
        live2dModel.anchor.set(0.5, 0.5);
        live2dModel.position.set(
            app.screen.width / 2,
            app.screen.height / 0.7
        );
        
        // Adjust scale to fit container
        const scale = Math.min(
            (app.screen.width * 3) / live2dModel.width,
            (app.screen.height * 3) / live2dModel.height
        );
        live2dModel.scale.set(scale);
        
        // Initialize model parameters
        if (live2dModel.internalModel) {
            // Reset all parameters to default
            const coreModel = live2dModel.internalModel.coreModel;
            coreModel.saveParameters();
            
            // Start idle animations
            startIdleAnimations();
        }
        
        // Handle window resize
        const resizeModel = () => {
            app.renderer.resize(window.innerWidth, window.innerHeight);
            live2dModel.position.set(
                app.screen.width / 2,
                app.screen.height / 2
            );
            const newScale = Math.min(
                (app.screen.width * 0.8) / live2dModel.width,
                (app.screen.height * 0.8) / live2dModel.height
            );
            live2dModel.scale.set(newScale);
        };
        
        window.addEventListener('resize', resizeModel);
        
        // Enable dragging
        live2dModel.interactive = true;
        live2dModel.on('pointerdown', (e) => {
            live2dModel.dragging = true;
            live2dModel.dragStart = e.data.global.clone();
            live2dModel.dragStartPosition = live2dModel.position.clone();
        });
        
        live2dModel.on('pointerup', () => {
            live2dModel.dragging = false;
        });
        
        live2dModel.on('pointerupoutside', () => {
            live2dModel.dragging = false;
        });
        
        live2dModel.on('pointermove', (e) => {
            if (live2dModel.dragging) {
                const newPosition = live2dModel.dragStartPosition.add(e.data.global.subtract(live2dModel.dragStart));
                live2dModel.position.copyFrom(newPosition);
            }
        });
        
        console.log("Live2D setup complete");
        
    } catch (error) {
        console.error("Live2D initialization failed:", error);
        document.getElementById('live2d-container').innerHTML = "Live2D Error: " + error.message;
        throw error;
    }
}

function startIdleAnimations() {
    if (!live2dModel || idleInterval) return;
    
    // Clear any existing intervals
    if (idleInterval) clearInterval(idleInterval);
    if (animationInterval) clearInterval(animationInterval);
    
    // Slow random movements (every 5-10 seconds)
    idleInterval = setInterval(() => {
        try {
            // Random head movement
            const headX = Math.random() * 6 - 3; // -3 to 3 degrees
            const headY = Math.random() * 4 - 2; // -2 to 2 degrees
            const headZ = Math.random() * 2 - 1; // -1 to 1 degrees
            
            smoothTransition("ParamAngleX", headX, 2);
            smoothTransition("ParamAngleY", headY, 2);
            smoothTransition("ParamAngleZ", headZ, 2);
            
            // Random body movement (subtle)
            const bodyX = Math.random() * 4 - 2;
            const bodyY = Math.random() * 4 - 2;
            smoothTransition("ParamBodyAngleX", bodyX, 3);
            smoothTransition("ParamBodyAngleY", bodyY, 3);
            
            // Blinking
            if (Math.random() > 0.7) { // 30% chance to blink
                blinkEyes();
            }
            
        } catch (e) {
            console.warn("Error in idle animation:", e);
        }
    }, 5000); // Every 5 seconds
    
    // Constant subtle breathing animation
    animationInterval = setInterval(() => {
        try {
            // Subtle breathing effect (body up/down)
            const breath = Math.sin(Date.now() / 1500) * 0.3;
            live2dModel.internalModel.coreModel.setParameterValueById("ParamBodyAngleY", breath);
            
            // Very subtle head bobbing
            const bob = Math.sin(Date.now() / 2000) * 0.5;
            live2dModel.internalModel.coreModel.setParameterValueById("ParamAngleX", bob);
            
        } catch (e) {
            console.warn("Error in constant animation:", e);
        }
    }, 50);
}

function smoothTransition(param, targetValue, duration) {
    if (!live2dModel || !live2dModel.internalModel) return;
    
    const coreModel = live2dModel.internalModel.coreModel;
    const paramIndex = coreModel.getParameterIndex(param);
    if (paramIndex < 0) return;
    
    const startValue = coreModel.getParameterValue(paramIndex);
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    
    function update() {
        const now = Date.now();
        if (now >= endTime) {
            coreModel.setParameterValue(paramIndex, targetValue);
            return;
        }
        
        const progress = (now - startTime) / (endTime - startTime);
        const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // Smooth easing
        const currentValue = startValue + (targetValue - startValue) * easedProgress;
        
        coreModel.setParameterValue(paramIndex, currentValue);
        requestAnimationFrame(update);
    }
    
    update();
}

function blinkEyes() {
    if (!live2dModel) return;
    
    try {
        // Close eyes
        smoothTransition("ParamEyeLOpen", 0, 0.1);
        smoothTransition("ParamEyeROpen", 0, 0.1);
        
        // Open eyes after a short delay
        setTimeout(() => {
            smoothTransition("ParamEyeLOpen", 1, 0.15);
            smoothTransition("ParamEyeROpen", 1, 0.15);
        }, 150);
    } catch (e) {
        console.warn("Error blinking:", e);
    }
}

function startSpeakingAnimation() {
    if (!live2dModel || isSpeaking) return;
    
    isSpeaking = true;
    
    // Clear any idle animations
    clearInterval(idleInterval);
    clearInterval(animationInterval);
    idleInterval = null;
    animationInterval = null;
    
    // Add subtle head movement while speaking
    speakInterval = setInterval(() => {
        if (!live2dModel || !live2dModel.internalModel) return;
        
        try {
            // Head movement while speaking
            live2dModel.internalModel.coreModel.setParameterValueById(
                "ParamAngleX", 
                Math.sin(Date.now() / 300) * 2
            );
            live2dModel.internalModel.coreModel.setParameterValueById(
                "ParamAngleY", 
                Math.sin(Date.now() / 500) * 2
            );
            
        } catch (e) {
            console.warn("Error during speaking animation:", e);
        }
    }, 100);
}

function stopSpeakingAnimation() {
    isSpeaking = false;
    stopAudioAnalysis();
    
    if (live2dModel && live2dModel.internalModel) {
        // Reset mouth to closed position
        const mouthParams = ["ParamMouthOpenY", "ParamMouthForm", "ParamMouthOpen"];
        mouthParams.forEach(param => {
            if (live2dModel.internalModel.coreModel.getParameterIndex(param) >= 0) {
                live2dModel.internalModel.coreModel.setParameterValueById(param, 0);
            }
        });
    }
    
    // Return to idle animations
    startIdleAnimations();
}