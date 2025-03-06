/**
 * Multiplayer Sync Controller
 * Complete replacement for ball and paddle synchronization
 */
(function() {
    // Configuration
    const UPDATE_RATE = 20; // Send updates every 20ms (~50fps)
    const AUTHORITY_MARGIN = 20; // Pixels from center to switch authority
    const CORRECTION_STRENGTH = 0.6; // How strongly to apply corrections (0-1)
    
    // State
    let gameActive = false;
    let isHost = false; // If we're the hosting player (left side)
    let syncEnabled = true;
    let lastBallState = null;
    let lastUpdateTime = 0;
    let frameCounter = 0;
    let ballResetCounter = 0;
    let latency = 50; // Estimated network latency in ms
    let netCanvas = null; // Canvas for network visualization
    let hostSide = "left"; // Which side is the host (default: left)
    
    // Debug settings
    const DEBUG = true; // Enable debug overlay
    
    // ===== INITIALIZATION =====
    
    // Initialize sync controller when DOM is ready
    function init() {
        console.log("Sync Controller initializing...");
        
        // Create debug overlay
        if (DEBUG) {
            createDebugOverlay();
        }
        
        // Wait for WebSocketManager and PongGame to be ready
        whenReady(["WebSocketManager", "PongGame"], () => {
            console.log("Required components ready, setting up sync controller");
            setupNetworkHandlers();
            setupGameHooks();
            startSyncLoop();
        });
    }
    
    // ===== CORE SYNC LOGIC =====
    
    // Determine if this player has authority over the ball
    function hasBallAuthority() {
        if (!window.PongGame) return false;
        
        try {
            // Get the current ball state
            const state = PongGame.getState();
            if (!state || !state.ball) return isHost;
            
            // Get canvas dimensions to determine center
            const canvas = document.getElementById('pong-canvas');
            if (!canvas) return isHost;
            
            const centerX = canvas.width / 2;
            
            // Left side has authority when ball is on left side
            if (hostSide === "left") {
                return (state.ball.x <= centerX + AUTHORITY_MARGIN) === isHost;
            } else {
                return (state.ball.x >= centerX - AUTHORITY_MARGIN) === isHost;
            }
        } catch (e) {
            console.error("Error determining ball authority:", e);
            return isHost;
        }
    }
    
    // Main sync loop - sends and applies game state
    function syncLoop() {
        if (!gameActive || !syncEnabled) return;
        
        frameCounter++;
        
        try {
            // 1. Send our state to remote player if we have authority
            if (hasBallAuthority()) {
                // Every 100 frames (2s at 50fps), send a full forced reset
                const forceReset = frameCounter % 100 === 0;
                sendGameState(forceReset);
            }
            
            // 2. Apply local corrections if we don't have authority
            if (!hasBallAuthority() && lastBallState) {
                applyRemoteState(lastBallState);
            }
            
            // 3. Update debug display
            if (DEBUG && frameCounter % 5 === 0) { // Update every 5 frames
                updateDebugDisplay();
            }
        } catch (e) {
            console.error("Error in sync loop:", e);
        }
    }
    
    // Send current game state to other player
    function sendGameState(forceReset = false) {
        if (!window.PongGame || !window.WebSocketManager) return;
        
        try {
            const state = PongGame.getState();
            if (!state || !state.ball) return;
            
            // Create state snapshot to send
            const gameSnapshot = {
                ball: {
                    x: state.ball.x,
                    y: state.ball.y,
                    vx: state.ball.vx,
                    vy: state.ball.vy,
                    speed: state.ball.speed,
                    radius: state.ball.radius
                },
                paddles: {
                    left: { y: state.paddles.left.y },
                    right: { y: state.paddles.right.y }
                },
                timestamp: Date.now(),
                frameCount: frameCounter,
                resetCount: forceReset ? ++ballResetCounter : ballResetCounter,
                hostSide: hostSide
            };
            
            // Send the state
            WebSocketManager.send({
                type: "game_update",
                data: {
                    syncState: gameSnapshot,
                    forceReset: forceReset
                }
            });
            
            // Draw network activity visualization
            if (DEBUG && netCanvas) {
                drawNetworkActivity("send");
            }
            
            // Update last send time
            lastUpdateTime = Date.now();
        } catch (e) {
            console.error("Error sending game state:", e);
        }
    }
    
    // Apply remote state to local game
    function applyRemoteState(remoteState, force = false) {
        if (!window.PongGame) return;
        
        try {
            // Get current state
            const currentState = PongGame.getState();
            if (!currentState || !currentState.ball) return;
            
            // If this is a forced reset or we're severely out of sync, apply immediately
            if (force || Math.abs(currentState.ball.x - remoteState.ball.x) > 30 || 
                Math.abs(currentState.ball.y - remoteState.ball.y) > 30) {
                
                // Update ball position and velocity directly
                if (PongGame.updateBallPosition) {
                    PongGame.updateBallPosition(remoteState.ball);
                } else {
                    // Direct access if method not available
                    currentState.ball.x = remoteState.ball.x;
                    currentState.ball.y = remoteState.ball.y;
                    currentState.ball.vx = remoteState.ball.vx;
                    currentState.ball.vy = remoteState.ball.vy;
                    currentState.ball.speed = remoteState.ball.speed;
                }
            } else {
                // Smooth correction using interpolation
                currentState.ball.x = lerp(currentState.ball.x, remoteState.ball.x, CORRECTION_STRENGTH);
                currentState.ball.y = lerp(currentState.ball.y, remoteState.ball.y, CORRECTION_STRENGTH);
                currentState.ball.vx = remoteState.ball.vx; // Take velocity directly for better prediction
                currentState.ball.vy = remoteState.ball.vy;
                currentState.ball.speed = remoteState.ball.speed;
            }
            
            // Update opponent's paddle position
            if (isHost) {
                // We're the host, so update right paddle
                if (PongGame.updateRemotePaddle) {
                    PongGame.updateRemotePaddle(remoteState.paddles.right.y);
                }
            } else {
                // We're the client, update left paddle if it came from host
                if (remoteState.paddles && remoteState.paddles.left && 
                    hostSide === "left" && remoteState.hostSide === "left") {
                    currentState.paddles.left.y = remoteState.paddles.left.y;
                }
            }
        } catch (e) {
            console.error("Error applying remote state:", e);
        }
    }
    
    // ===== NETWORK HANDLERS =====
    
    // Set up WebSocket message handlers
    function setupNetworkHandlers() {
        if (!window.WebSocketManager) return;
        
        // Hook into existing handler
        const originalHandler = WebSocketManager.handleGameUpdate;
        WebSocketManager.handleGameUpdate = function(data) {
            // Call original handler first
            if (originalHandler) {
                originalHandler.call(this, data);
            }
            
            // Process sync messages
            if (data && data.syncState) {
                // Update last received state
                lastBallState = data.syncState;
                
                // Calculate network latency based on timestamp
                const now = Date.now();
                latency = now - data.syncState.timestamp;
                
                // If host side info is provided, update it
                if (data.syncState.hostSide) {
                    hostSide = data.syncState.hostSide;
                }
                
                // If this is a force reset or from an authoritative source, apply immediately
                const isFromAuthority = hasBallAuthority() !== true;
                applyRemoteState(data.syncState, data.forceReset || isFromAuthority);
                
                // Draw network activity visualization
                if (DEBUG && netCanvas) {
                    drawNetworkActivity("receive");
                }
            }
            
            // Handle side determination messages
            if (data && data.hostSideInfo !== undefined) {
                hostSide = data.hostSideInfo === "left" ? "left" : "right";
                determineIsHost();
            }
        };
        
        // Override paddle update to include side information
        const originalPaddleUpdate = WebSocketManager.sendPaddleUpdate;
        WebSocketManager.sendPaddleUpdate = function(paddleY) {
            // Determine if we're the host based on paddle updates
            // If we're sending paddle updates for left paddle, we're likely host
            if (!isHost && hostSide === "left") {
                isHost = true;
                console.log("Determined host status: This player is the HOST (left side)");
                announceHostSide();
            }
            
            // Call original method
            return originalPaddleUpdate.call(this, paddleY);
        };
        
        // Add method to announce host side
        WebSocketManager.announceHostSide = function() {
            return this.send({
                type: "game_update",
                data: {
                    hostSideInfo: hostSide
                }
            });
        };
    }
    
    // Determine if this player is the host
    function determineIsHost() {
        // We're the host if we control the left paddle 
        // (or right paddle if hostSide is "right")
        isHost = (hostSide === "left");
        console.log(`Host determination: This player is ${isHost ? 'HOST' : 'CLIENT'} (${hostSide} side)`);
    }
    
    // Announce host side to other players
    function announceHostSide() {
        if (window.WebSocketManager && WebSocketManager.announceHostSide) {
            WebSocketManager.announceHostSide();
        }
    }
    
    // ===== GAME HOOKS =====
    
    // Set up hooks into the PongGame
    function setupGameHooks() {
        if (!window.PongGame) return;
        
        // Save original methods
        const originalStart = PongGame.start;
        const originalStop = PongGame.stop;
        const originalUpdate = PongGame.update;
        
        // Override start method
        PongGame.start = function() {
            console.log("Game starting - activating sync");
            gameActive = true;
            frameCounter = 0;
            ballResetCounter = 0;
            
            // Determine if we're the host
            determineIsHost();
            
            // Send our host status
            announceHostSide();
            
            // Call original method
            return originalStart.apply(this, arguments);
        };
        
        // Override stop method
        PongGame.stop = function() {
            console.log("Game stopping - deactivating sync");
            gameActive = false;
            
            // Call original method
            return originalStop.apply(this, arguments);
        };
        
        // Add or update the updateBallPosition method
        if (!PongGame.updateBallPosition) {
            PongGame.updateBallPosition = function(ballData) {
                const state = this.getState();
                if (!state || !state.ball) return false;
                
                // Update ball properties
                if (ballData.x !== undefined) state.ball.x = ballData.x;
                if (ballData.y !== undefined) state.ball.y = ballData.y;
                if (ballData.vx !== undefined) state.ball.vx = ballData.vx;
                if (ballData.vy !== undefined) state.ball.vy = ballData.vy;
                if (ballData.speed !== undefined) state.ball.speed = ballData.speed;
                
                return true;
            };
        }
    }
    
    // Start the sync loop
    function startSyncLoop() {
        setInterval(syncLoop, UPDATE_RATE);
    }
    
    // ===== DEBUG TOOLS =====
    
    // Create debug overlay
    function createDebugOverlay() {
        // Create debug panel
        const debugPanel = document.createElement('div');
        debugPanel.id = 'sync-debug-panel';
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background-color: rgba(0,0,0,0.7);
            color: #fff;
            padding: 5px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 11px;
            z-index: 10000;
            width: 180px;
        `;
        document.body.appendChild(debugPanel);
        
        // Create network activity canvas
        netCanvas = document.createElement('canvas');
        netCanvas.width = 160;
        netCanvas.height = 30;
        netCanvas.style.display = 'block';
        netCanvas.style.marginTop = '5px';
        netCanvas.style.backgroundColor = 'rgba(0,0,0,0.5)';
        debugPanel.appendChild(netCanvas);
        
        // Add keyboard shortcut to toggle sync
        document.addEventListener('keydown', function(e) {
            // Ctrl+Shift+S toggles sync
            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                syncEnabled = !syncEnabled;
                console.log(`Sync ${syncEnabled ? 'enabled' : 'disabled'}`);
            }
        });
    }
    
    // Update debug display
    function updateDebugDisplay() {
        const debugPanel = document.getElementById('sync-debug-panel');
        if (!debugPanel) return;
        
        // Get ball info
        let ballInfo = "N/A";
        let paddleInfo = "N/A";
        let authority = "N/A";
        
        try {
            if (window.PongGame) {
                const state = PongGame.getState();
                if (state && state.ball) {
                    ballInfo = `x:${Math.round(state.ball.x)} y:${Math.round(state.ball.y)}`;
                    paddleInfo = `L:${Math.round(state.paddles.left.y)} R:${Math.round(state.paddles.right.y)}`;
                    authority = hasBallAuthority() ? "YES" : "NO";
                }
            }
        } catch (e) {
            // Ignore errors during debug
        }
        
        // Update debug display
        debugPanel.innerHTML = `
            <div>Role: ${isHost ? 'HOST' : 'CLIENT'} (${hostSide})</div>
            <div>Authority: ${authority}</div>
            <div>Ball: ${ballInfo}</div>
            <div>Paddles: ${paddleInfo}</div>
            <div>Latency: ~${latency}ms</div>
            <div>Sync: ${syncEnabled ? 'ON' : 'OFF'}</div>
            <div>Frame: ${frameCounter}</div>
        `;
        
        // Add network canvas back
        if (netCanvas) {
            debugPanel.appendChild(netCanvas);
        }
    }
    
    // Draw network activity on the canvas
    function drawNetworkActivity(type) {
        if (!netCanvas) return;
        
        const ctx = netCanvas.getContext('2d');
        
        // Shift existing content left
        const imageData = ctx.getImageData(1, 0, netCanvas.width - 1, netCanvas.height);
        ctx.putImageData(imageData, 0, 0);
        
        // Clear rightmost column
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(netCanvas.width - 1, 0, 1, netCanvas.height);
        
        // Draw new activity
        if (type === "send") {
            ctx.fillStyle = '#00ff00'; // Green for send
        } else {
            ctx.fillStyle = '#0099ff'; // Blue for receive
        }
        
        ctx.fillRect(netCanvas.width - 1, netCanvas.height - 5, 1, 5);
    }
    
    // ===== UTILITY FUNCTIONS =====
    
    // Wait for objects to be available
    function whenReady(objects, callback, maxWait = 10000) {
        const startTime = Date.now();
        
        const checkObjects = () => {
            // Check if all objects exist
            const allReady = objects.every(obj => window[obj] !== undefined);
            
            if (allReady) {
                callback();
                return;
            }
            
            // Check timeout
            if (Date.now() - startTime > maxWait) {
                console.error("Timeout waiting for objects:", objects);
                return;
            }
            
            // Check again in 100ms
            setTimeout(checkObjects, 100);
        };
        
        checkObjects();
    }
    
    // Linear interpolation
    function lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    // Initialize module
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();