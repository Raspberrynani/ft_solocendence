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
     * Setup input handlers for mouse/touch
     */
    function setupInputHandlers() {
        // Mouse movement handler with throttling
        const mouseMoveHandler = Utils.throttle((e) => {
            if (!isRunning) return;
            
            const rect = canvas.getBoundingClientRect();
            mousePosition.x = e.clientX - rect.left;
            mousePosition.y = e.clientY - rect.top;
            
            // Calculate paddle position (middle of paddle at mouse y)
            const paddleHeight = gameState?.paddles?.[playerSide]?.height || 100;
            localPaddleY = mousePosition.y - (paddleHeight / 2);
            
            // Ensure paddle stays within canvas
            if (gameState && gameState.dimensions) {
                localPaddleY = Math.max(0, Math.min(gameState.dimensions.height - paddleHeight, localPaddleY));
            }
            
            // Send paddle position to server
            updatePaddlePosition(localPaddleY);
        }, 16); // ~60fps throttling
        
        // Touch handler for mobile
        const touchMoveHandler = Utils.throttle((e) => {
            if (!isRunning) return;
            e.preventDefault();
            
            const rect = canvas.getBoundingClientRect();
            mousePosition.x = e.touches[0].clientX - rect.left;
            mousePosition.y = e.touches[0].clientY - rect.top;
            
            // Calculate paddle position (middle of paddle at touch y)
            const paddleHeight = gameState?.paddles?.[playerSide]?.height || 100;
            localPaddleY = mousePosition.y - (paddleHeight / 2);
            
            // Ensure paddle stays within canvas
            if (gameState && gameState.dimensions) {
                localPaddleY = Math.max(0, Math.min(gameState.dimensions.height - paddleHeight, localPaddleY));
            }
            
            // Send paddle position to server
            updatePaddlePosition(localPaddleY);
        }, 16); // ~60fps throttling
        
        // Add event listeners
        canvas.addEventListener("mousemove", mouseMoveHandler);
        canvas.addEventListener("touchmove", touchMoveHandler, { passive: false });
        
        // Store reference to remove later
        inputHandlers = { mouseMoveHandler, touchMoveHandler };
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
        
        // Trigger callback if provided
        if (eventCallbacks.onGameStart) {
            eventCallbacks.onGameStart();
        }
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
        }
        
        // Call onGameEnd callback if provided
        if (eventCallbacks.onGameEnd) {
            eventCallbacks.onGameEnd();
        }
    }
    
    /**
     * Update the game state from server
     * @param {Object} state - Game state from server
     */
    function updateGameState(state) {
        if (!state) return;
        
        // Store previous state for interpolation if needed
        const previousState = gameState;
        
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
        if (state.score && (state.score.left !== config.currentRounds || state.score.right !== config.currentRounds)) {
            const totalRounds = state.score.left + state.score.right;
            config.currentRounds = totalRounds;
            
            // Notify about round completion
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