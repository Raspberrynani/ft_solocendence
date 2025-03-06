/**
 * Server-Side Pong Renderer
 * Handles rendering of server-side Pong game state
 */
const ServerPong = (function() {
    // Private variables
    let canvas, ctx;
    let isRunning = false;
    let gameState = null;
    let playerSide = 'left'; // Default to left side
    let animationFrameId = null;
    let lastMouseY = 0;
    let localPaddleY = 0;
    let paddleUpdateThrottle = 16; // ms between paddle updates (60fps)
    let lastPaddleUpdateTime = 0;
    
    // Configuration
    const config = {
        rounds: 3,
        currentRounds: 0,
        ballColor: '#00d4ff',
        leftPaddleColor: '#007bff',
        rightPaddleColor: '#ff758c',
        showFps: false,
    };
    
    // Input tracking
    let mousePosition = { x: 0, y: 0 };
    let inputHandlers = null;
    
    // References to player data
    let playerInfo = {
      nickname: "",
      token: ""
    };
    
    // Callbacks for game events
    let eventCallbacks = {};
    
    // Stats
    let fps = 0;
    let frameCount = 0;
    let lastFpsUpdateTime = 0;
    
    /**
     * Initialize the game renderer
     * @param {Object} options - Configuration options
     * @returns {boolean} - Success status
     */
    function init(options = {}) {
        console.log("ServerPong initializing with options:", options);
        
        // Get canvas and setup context
        canvas = document.getElementById(options.canvasId || 'pong-canvas');
        if (!canvas) {
            console.error("Canvas element not found!");
            return false;
        }
        
        ctx = canvas.getContext('2d');
        
        // Store options
        if (options.playerSide) playerSide = options.playerSide;
        if (options.nickname) playerInfo.nickname = options.nickname;
        if (options.token) playerInfo.token = options.token;
        if (options.rounds) config.rounds = options.rounds;
        
        // Store callbacks
        eventCallbacks = options.callbacks || {};
        
        // Setup event listeners
        setupInputHandlers();
        setupResizeHandler();
        
        // Initial resize
        handleResize();
        
        console.log("ServerPong initialized successfully");
        return true;
    }
    
    /**
     * Setup input handlers for mouse/touch/keyboard
     */
    function setupInputHandlers() {
        // Mouse sensitivity factor (higher = more sensitive)
        const mouseSensitivity = 1.8;
        
        // Mouse movement handler with improved sensitivity
        const mouseMoveHandler = Utils.throttle((e) => {
            if (!isRunning) return;
            
            const rect = canvas.getBoundingClientRect();
            
            // Store previous mouse position
            const prevMouseY = mousePosition.y;
            
            // Update mouse position
            mousePosition.x = e.clientX - rect.left;
            mousePosition.y = e.clientY - rect.top;
            
            // Calculate mouse movement delta and apply sensitivity
            const deltaY = (mousePosition.y - prevMouseY) * mouseSensitivity;
            
            // If we have game state, use that for paddle position
            if (gameState && gameState.paddles && gameState.paddles[playerSide]) {
                // Get current paddle position from game state
                const paddleHeight = gameState.paddles[playerSide].height;
                
                // Apply delta with sensitivity to current paddle position
                localPaddleY = Math.max(0, 
                    Math.min(canvas.height - paddleHeight, 
                        gameState.paddles[playerSide].y + deltaY));
            } else {
                // Fallback calculation if we don't have game state
                const paddleHeight = 100; // Default height
                localPaddleY = Math.max(0, 
                    Math.min(canvas.height - paddleHeight, 
                        localPaddleY + deltaY));
            }
            
            // Send paddle position to server
            updatePaddlePosition(localPaddleY);
        }, 8); // ~120fps throttling for smoother updates
        
        // Touch handler for mobile with sensitivity
        const touchMoveHandler = Utils.throttle((e) => {
            if (!isRunning) return;
            e.preventDefault();
            
            const rect = canvas.getBoundingClientRect();
            
            // Store previous touch position
            const prevTouchY = mousePosition.y;
            
            // Update touch position
            mousePosition.x = e.touches[0].clientX - rect.left;
            mousePosition.y = e.touches[0].clientY - rect.top;
            
            // Calculate touch movement delta and apply sensitivity
            const deltaY = (mousePosition.y - prevTouchY) * mouseSensitivity;
            
            // If we have game state, use that for paddle position
            if (gameState && gameState.paddles && gameState.paddles[playerSide]) {
                // Get current paddle position from game state
                const paddleHeight = gameState.paddles[playerSide].height;
                
                // Apply delta with sensitivity to current paddle position
                localPaddleY = Math.max(0, 
                    Math.min(canvas.height - paddleHeight, 
                        gameState.paddles[playerSide].y + deltaY));
            } else {
                // Fallback calculation if we don't have game state
                const paddleHeight = 100; // Default height
                localPaddleY = Math.max(0, 
                    Math.min(canvas.height - paddleHeight, 
                        localPaddleY + deltaY));
            }
            
            // Send paddle position to server
            updatePaddlePosition(localPaddleY);
        }, 8); // ~120fps throttling
        
        // Keyboard handler for up/down arrow keys and W/S keys
        const keyboardSpeed = 15; // Paddle movement speed per keypress
        let keysPressed = {
            up: false,
            down: false
        };
        
        // Handle key down events
        const keyDownHandler = (e) => {
            if (!isRunning) return;
            
            // Check for arrow keys and W/S keys
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                keysPressed.up = true;
            } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                keysPressed.down = true;
            }
            
            movePaddleWithKeyboard();
        };
        
        // Handle key up events
        const keyUpHandler = (e) => {
            if (!isRunning) return;
            
            // Check for arrow keys and W/S keys
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                keysPressed.up = false;
            } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                keysPressed.down = false;
            }
        };
        
        // Continuous keyboard movement function
        function movePaddleWithKeyboard() {
            if (!isRunning) return;
            
            // Skip if no key is pressed
            if (!keysPressed.up && !keysPressed.down) return;
            
            // If we have game state, use that for paddle position
            if (gameState && gameState.paddles && gameState.paddles[playerSide]) {
                const paddleHeight = gameState.paddles[playerSide].height;
                let newPaddleY = gameState.paddles[playerSide].y;
                
                // Apply movement based on keys pressed
                if (keysPressed.up) {
                    newPaddleY -= keyboardSpeed;
                }
                if (keysPressed.down) {
                    newPaddleY += keyboardSpeed;
                }
                
                // Ensure paddle stays within bounds
                localPaddleY = Math.max(0, Math.min(canvas.height - paddleHeight, newPaddleY));
                
                // Send paddle position to server
                updatePaddlePosition(localPaddleY);
            }
            
            // Continue movement if keys are still pressed
            if (keysPressed.up || keysPressed.down) {
                requestAnimationFrame(movePaddleWithKeyboard);
            }
        }
        
        // Add all event listeners
        canvas.addEventListener("mousemove", mouseMoveHandler);
        canvas.addEventListener("touchmove", touchMoveHandler, { passive: false });
        document.addEventListener("keydown", keyDownHandler);
        document.addEventListener("keyup", keyUpHandler);
        
        // Store reference to remove later
        inputHandlers = { 
            mouseMoveHandler, 
            touchMoveHandler,
            keyDownHandler,
            keyUpHandler
        };
    }
    
    /**
     * Setup window resize handler
     */
    function setupResizeHandler() {
        window.addEventListener('resize', Utils.debounce(handleResize, 200));
    }
    
    /**
     * Handle window resize
     */
    function handleResize() {
        // Get container dimensions
        const containerWidth = canvas.clientWidth;
        
        // Maintain aspect ratio based on server dimensions or default to 16:9
        let aspectRatio = 16/9;
        if (gameState && gameState.dimensions) {
            aspectRatio = gameState.dimensions.width / gameState.dimensions.height;
        }
        
        // Set canvas dimensions
        canvas.width = containerWidth;
        canvas.height = containerWidth / aspectRatio;
        
        console.log(`Canvas resized to ${canvas.width}x${canvas.height}`);
    }
    
    /**
     * Start the game renderer
     */

    let connectionCheckInterval = null;
    function start() {
        if (isRunning) {
            console.log("Game already running, ignoring start request");
            return;
        }
        
        console.log("Starting game renderer");
        isRunning = true;
        
        // Reset stats
        frameCount = 0;
        lastFpsUpdateTime = performance.now();
        
        // Start render loop
        animationFrameId = requestAnimationFrame(renderLoop);

        //Full screen patch
        if (canvas) {
            try {
              if (document.fullscreenEnabled) {
                canvas.requestFullscreen().catch(err => {
                  console.warn("Fullscreen request failed:", err);
                });
              } else if (canvas.webkitRequestFullscreen) {
                canvas.webkitRequestFullscreen();
              } else if (canvas.mozRequestFullScreen) {
                canvas.mozRequestFullScreen();
              } else if (canvas.msRequestFullscreen) {
                canvas.msRequestFullscreen();
              }
            } catch (err) {
              console.warn("Error attempting to enter fullscreen:", err);
            }
        }
        
        // Trigger callback if provided
        if (eventCallbacks.onGameStart) {
            eventCallbacks.onGameStart();
        }

        connectionCheckInterval = setInterval(() => {
            // Check if we're still receiving game updates
            const now = Date.now();
            const lastUpdateTime = gameState ? gameState.lastUpdateTime : 0;
            
            // If we haven't received an update in 3 seconds, something's wrong
            if (now - lastUpdateTime > 3000 && isRunning) {
                console.log("No game updates received for 3 seconds - possible connection issue");
                
                // Try to force a reconnection
                if (window.WebSocketManager && WebSocketManager.reconnect) {
                    WebSocketManager.reconnect();
                }
                
                // As a last resort, force game cleanup
                stop();
                
                // Show an error message to the user
                if (window.Utils && Utils.showToast) {
                    Utils.showToast("Connection to game server lost. Returning to menu.", "error");
                }
                
                // Navigate back to menu
                if (window.modules && modules.ui) {
                    modules.ui.navigateTo('game-page');
                }
            }
        }, 3000);
    
    }
    
    /**
     * Stop the game renderer
     */
    function stop() {
        console.log("Stopping game renderer");
        isRunning = false;
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        // Remove input handlers
        if (inputHandlers) {
            canvas.removeEventListener("mousemove", inputHandlers.mouseMoveHandler);
            canvas.removeEventListener("touchmove", inputHandlers.touchMoveHandler);
            document.removeEventListener("keydown", inputHandlers.keyDownHandler);
            document.removeEventListener("keyup", inputHandlers.keyUpHandler);
        }
        
        // Call onGameEnd callback if provided
        if (eventCallbacks.onGameEnd) {
            eventCallbacks.onGameEnd();
        }

        if (connectionCheckInterval) {
            clearInterval(connectionCheckInterval);
            connectionCheckInterval = null;
        }
    }
    
    /**
     * Update the game state from server
     * @param {Object} state - Game state from server
     */
    function updateGameState(state) {
        if (!state) return;
        state.lastUpdateTime = Date.now();
        
        // Store previous state for interpolation if needed
        const previousState = gameState;

        console.log("Received game state update:", state);
        // Update game state
        gameState = state;
        
        // If server dimensions changed, resize canvas
        if (previousState && 
            previousState.dimensions && 
            state.dimensions && 
            (previousState.dimensions.width !== state.dimensions.width || 
             previousState.dimensions.height !== state.dimensions.height)) {
            handleResize();
        }
        
        // Update score if needed
        if (previousState && state.score && 
            (previousState.score.left !== state.score.left || 
             previousState.score.right !== state.score.right)) {
            
            // Calculate total rounds played
            const totalRounds = state.score.left + state.score.right;
            
            // Trigger round complete callback
            if (eventCallbacks.onRoundComplete) {
                eventCallbacks.onRoundComplete(totalRounds);
            }
        }
    }
    
    /**
     * Update paddle position (send to server)
     * @param {number} y - Paddle Y position
     */
    function updatePaddlePosition(y) {
        // Throttle updates to avoid flooding the server
        const now = Date.now();
        if (now - lastPaddleUpdateTime < paddleUpdateThrottle) {
            return;
        }
        
        lastPaddleUpdateTime = now;
        
        // Send to server if WebSocketManager is available
        if (window.WebSocketManager && WebSocketManager.sendPaddleUpdate) {
            WebSocketManager.sendPaddleUpdate(Math.round(y));
        }
    }
    
    /**
     * Main render loop
     * @param {number} timestamp - Animation frame timestamp
     */
    function renderLoop(timestamp) {
        if (!isRunning) return;
        
        // Update FPS counter
        frameCount++;
        if (timestamp - lastFpsUpdateTime >= 1000) {
            fps = Math.round((frameCount * 1000) / (timestamp - lastFpsUpdateTime));
            frameCount = 0;
            lastFpsUpdateTime = timestamp;
        }
        
        // Render current game state
        draw();
        
        // Continue loop
        animationFrameId = requestAnimationFrame(renderLoop);
    }
    
    /**
     * Draw the game state
     */
    function draw() {
        if (!gameState) return;
        
        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Scale coordinates from server dimensions to canvas dimensions
        const scaleX = canvas.width / gameState.dimensions.width;
        const scaleY = canvas.height / gameState.dimensions.height;
        
        // Draw center line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.setLineDash([5, 10]);
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw score
        const fontSize = Math.max(12, Math.min(24, Math.floor(canvas.width / 40)));
        ctx.fillStyle = '#fff';
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(
            `${gameState.score.left} - ${gameState.score.right}`,
            canvas.width / 2,
            fontSize * 1.5
        );
        
        // Draw player name if available
        if (playerInfo.nickname) {
            ctx.fillText(
                playerInfo.nickname,
                canvas.width / 2,
                fontSize * 3
            );
        }
        
        // Draw ball
        if (gameState.ball) {
            ctx.fillStyle = config.ballColor;
            ctx.beginPath();
            ctx.arc(
                gameState.ball.x * scaleX, 
                gameState.ball.y * scaleY, 
                gameState.ball.radius * scaleX,
                0, Math.PI * 2
            );
            ctx.fill();
        }
        
        // Draw paddles
        if (gameState.paddles) {
            // Left paddle
            if (gameState.paddles.left) {
                ctx.fillStyle = config.leftPaddleColor;
                drawRoundedRect(
                    gameState.paddles.left.x * scaleX || 0,
                    gameState.paddles.left.y * scaleY,
                    gameState.paddles.left.width * scaleX,
                    gameState.paddles.left.height * scaleY,
                    Math.min(5, gameState.paddles.left.width * scaleX / 2)
                );
            }
            
            // Right paddle
            if (gameState.paddles.right) {
                ctx.fillStyle = config.rightPaddleColor;
                drawRoundedRect(
                    (gameState.paddles.right.x || (gameState.dimensions.width - gameState.paddles.left.width)) * scaleX,
                    gameState.paddles.right.y * scaleY,
                    gameState.paddles.right.width * scaleX,
                    gameState.paddles.right.height * scaleY,
                    Math.min(5, gameState.paddles.right.width * scaleX / 2)
                );
            }
        }
        
        // Draw FPS counter if enabled
        if (config.showFps) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`FPS: ${fps}`, 10, 15);
        }
    }
    
    /**
     * Helper function to draw rounded rectangles
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} radius - Corner radius
     */
    function drawRoundedRect(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
        ctx.fill();
    }
    
    /**
     * Get current game state
     * @returns {Object} - Game state
     */
    function getState() {
        return gameState;
    }
    
    /**
     * Set player side (left or right)
     * @param {string} side - Player side
     */
    function setPlayerSide(side) {
        if (side === 'left' || side === 'right') {
            playerSide = side;
        }
    }
    
    /**
     * Toggle FPS display
     * @param {boolean} show - Whether to show FPS
     */
    function toggleFps(show) {
        config.showFps = show;
    }
    
    // Public API
    return {
        init,
        start,
        stop,
        updateGameState,
        getState,
        setPlayerSide,
        toggleFps
    };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ServerPong;
}

window.ServerPong = ServerPong;