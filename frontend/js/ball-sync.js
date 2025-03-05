/**
 * ULTRA-AGGRESSIVE Ball Synchronization System
 * Ensures perfect sync between players with multiple redundant techniques
 */
(function() {
    const SYNC_FREQUENCY_MS = 16;        // Sync every frame (~60fps)
    const FULL_RESET_FREQUENCY = 10;     // Force full reset every 10 frames
    const ERROR_THRESHOLD = 3;           // Extremely low threshold for corrections (3px)
    const INTERPOLATION_WEIGHT = 0.9;    // Aggressive correction weight (90% new, 10% old)
    const PING_FREQUENCY_MS = 1000;      // Check network latency every second
    const MAX_PREDICTION_MS = 100;       // Maximum prediction window
    
    // State variables
    let gameState = {
        active: false,
        latency: 0,
        lastSyncTime: 0,
        frameCount: 0,
        isLeftSide: null,               // null means we don't know yet
        ballAuthority: false,
        syncEnabled: true,
        pingStart: 0,
        lastBallReset: 0
    };
    
    // Ball state history
    const ballHistory = [];
    const MAX_HISTORY = 30;              // 0.5 seconds at 60fps
    
    // Debug mode
    const DEBUG = true;
    
    // Initialize
    function init() {
        debug("Ultra-aggressive ball sync initializing");
        
        // Add a delay to initial setup to allow the game to initialize
        setTimeout(() => {
            setupNetworkHooks();
            setupGameHooks();
            createDebugUI();
            startSyncLoop();
            
            // Start latency measurement
            measureLatency();
            setInterval(measureLatency, PING_FREQUENCY_MS);
        }, 1000); // 1-second delay before initializing
    }
    
    // Debug logging
    function debug(...args) {
        if (DEBUG) {
            console.log("[BALL-SYNC]", ...args);
        }
    }
    
    // Create debug UI
    function createDebugUI() {
        if (!DEBUG) return;
        
        const debugPanel = document.createElement('div');
        debugPanel.id = 'ball-sync-debug';
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: #fff;
            font-family: monospace;
            font-size: 10px;
            padding: 5px;
            border-radius: 5px;
            z-index: 10000;
            pointer-events: none;
            max-width: 200px;
            overflow: hidden;
        `;
        document.body.appendChild(debugPanel);
        
        // Update debug info
        setInterval(() => {
            if (!document.getElementById('ball-sync-debug')) return;
            
            let ballX = "N/A";
            let ballY = "N/A";
            
            try {
                if (window.PongGame && typeof PongGame.getState === 'function') {
                    const state = PongGame.getState();
                    if (state && state.ball && typeof state.ball.x === 'number') {
                        ballX = state.ball.x.toFixed(2);
                        ballY = state.ball.y.toFixed(2);
                    }
                }
            } catch (e) {
                // Silently handle errors during debug info gathering
                debug("Error getting ball info:", e);
            }
            
            debugPanel.innerHTML = `
                <div>Sync: ${gameState.syncEnabled ? 'ON' : 'OFF'}</div>
                <div>Side: ${gameState.isLeftSide === null ? 'UNKNOWN' : gameState.isLeftSide ? 'LEFT' : 'RIGHT'}</div>
                <div>Authority: ${gameState.ballAuthority ? 'YES' : 'NO'}</div>
                <div>Latency: ${gameState.latency}ms</div>
                <div>Ball: ${ballX}, ${ballY}</div>
                <div>History: ${ballHistory.length} entries</div>
            `;
        }, 200);
    }
    
    // Setup network hooks
    function setupNetworkHooks() {
        // Wait for WebSocketManager to be available
        waitForObject('WebSocketManager', (wsm) => {
            debug("WebSocketManager found - intercepting");
            
            // Hook into the onGameUpdate method
            const originalHandler = wsm.handleGameUpdate || function() {};
            wsm.handleGameUpdate = function(data) {
                // Call original first for any paddle updates
                originalHandler.call(this, data);
                
                // Process ball sync messages
                processSyncMessage(data);
            };
            
            // Override sendPaddleUpdate
            const originalSendPaddle = wsm.sendPaddleUpdate || function() {};
            wsm.sendPaddleUpdate = function(paddleY) {
                // Side detection: if we're sending paddle updates, we're likely left side
                if (gameState.isLeftSide === null) {
                    determinePlayerSide(true);
                }
                
                return originalSendPaddle.call(this, paddleY);
            };
            
            // Add ping method for latency measurement
            wsm.sendPing = function() {
                gameState.pingStart = performance.now();
                return this.send({
                    type: "game_update",
                    data: { 
                        pingRequest: true,
                        timestamp: gameState.pingStart
                    }
                });
            };
            
            // Add ball sync method
            wsm.sendBallSync = function(forced = false) {
                if (!gameState.active || !gameState.syncEnabled) return false;
                
                // Get current ball state
                const ball = getBallState();
                if (!ball) return false;
                
                return this.send({
                    type: "game_update",
                    data: {
                        ballSync: {
                            x: ball.x,
                            y: ball.y,
                            vx: ball.vx,
                            vy: ball.vy,
                            speed: ball.speed,
                            radius: ball.radius,
                            timestamp: performance.now(),
                            forced: forced,
                            side: gameState.isLeftSide
                        }
                    }
                });
            };
        });
    }
    
    // Process sync messages from the network
    function processSyncMessage(data) {
        if (!data) return;
        
        // Handle ping/pong for latency measurement
        if (data.pingRequest) {
            // Send pong response
            sendPongResponse(data.timestamp);
        }
        
        if (data.pongResponse) {
            // Calculate latency
            const now = performance.now();
            const sentTime = data.originalTimestamp;
            gameState.latency = Math.round((now - sentTime) / 2); // RTT/2
            debug("Latency measured:", gameState.latency, "ms");
        }
        
        // Handle ball sync
        if (data.ballSync) {
            processBallSync(data.ballSync);
        }
        
        // Handle ball reset
        if (data.ballReset) {
            processBallReset(data.ballReset);
        }
        
        // Handle side determination
        if (data.sideInfo !== undefined) {
            if (gameState.isLeftSide === null) {
                determinePlayerSide(!data.sideInfo);
            }
        }
    }
    
    // Process ball synchronization data
    function processBallSync(ballData) {
        // Reject if we don't know our side yet
        if (gameState.isLeftSide === null) return;
        
        // Update last sync time
        gameState.lastSyncTime = performance.now();
        
        // Update side info if different from what we think
        if (ballData.side !== undefined && ballData.side !== gameState.isLeftSide) {
            debug("Side mismatch detected, updating");
            gameState.isLeftSide = !ballData.side;
            determineAuthority();
        }
        
        // Decide whether to apply this sync based on authority rules
        let shouldApply = false;
        
        // Rule 1: If it's a forced sync, always apply it
        if (ballData.forced) {
            shouldApply = true;
        }
        // Rule 2: If we don't have authority, apply it
        else if (!gameState.ballAuthority) {
            shouldApply = true;
        }
        // Rule 3: If the ball is heading towards us, other side has authority
        else {
            const ball = getBallState();
            if (ball) {
                // For left side (ball moving left)
                if (gameState.isLeftSide && ball.vx < 0) {
                    shouldApply = true;
                }
                // For right side (ball moving right)
                else if (!gameState.isLeftSide && ball.vx > 0) {
                    shouldApply = true;
                }
            }
        }
        
        // Add to history regardless
        ballHistory.push({...ballData, received: performance.now()});
        while (ballHistory.length > MAX_HISTORY) {
            ballHistory.shift();
        }
        
        // Apply if needed
        if (shouldApply) {
            updateBallPosition(ballData, true);
        }
    }
    
    // Process ball reset command
    function processBallReset(resetData) {
        // If we've already done a more recent reset, ignore
        if (resetData.timestamp < gameState.lastBallReset) return;
        
        gameState.lastBallReset = resetData.timestamp;
        
        // Apply the reset
        updateBallPosition(resetData, true);
        
        debug("Applied forced ball reset");
    }
    
    // Send a pong response to a ping
    function sendPongResponse(originalTimestamp) {
        if (window.WebSocketManager && WebSocketManager.send) {
            WebSocketManager.send({
                type: "game_update",
                data: {
                    pongResponse: true,
                    originalTimestamp: originalTimestamp,
                    timestamp: performance.now()
                }
            });
        }
    }
    
    // Measure network latency
    function measureLatency() {
        if (window.WebSocketManager && WebSocketManager.sendPing) {
            WebSocketManager.sendPing();
        }
    }
    
    // Setup game hooks
    function setupGameHooks() {
        // Wait for PongGame to be available
        waitForObject('PongGame', (game) => {
            debug("PongGame found - intercepting");
            
            // Hook into start method
            const originalStart = game.start;
            game.start = function() {
                debug("Game starting");
                gameState.active = true;
                gameState.frameCount = 0;
                
                // Reset history
                ballHistory.length = 0;
                
                // Determine side if not already done
                if (gameState.isLeftSide === null) {
                    // Default to left side, will be corrected once paddle moves
                    determinePlayerSide(true);
                }
                
                // Call original
                const result = originalStart.apply(this, arguments);
                
                // Send our side info
                sendSideInfo();
                
                return result;
            };
            
            // Hook into stop method
            const originalStop = game.stop;
            game.stop = function() {
                debug("Game stopping");
                gameState.active = false;
                
                // Call original
                return originalStop.apply(this, arguments);
            };
            
            // Hook into update method
            const originalUpdate = game.update;
            if (typeof originalUpdate === 'function') {
                game.update = function(deltaFactor) {
                    if (!gameState.active || !gameState.syncEnabled) {
                        return originalUpdate.apply(this, arguments);
                    }
                    
                    // Increment frame counter
                    gameState.frameCount++;
                    
                    // Determine if we should apply a full reset
                    const needsFullReset = (gameState.frameCount % FULL_RESET_FREQUENCY === 0);
                    if (needsFullReset && gameState.ballAuthority) {
                        // We're the authority, tell others to fully reset
                        sendBallReset();
                    }
                    
                    // Check for sync issues before calling original update
                    if (!gameState.ballAuthority) {
                        detectAndCorrectDrift();
                    }
                    
                    // Call original update
                    const result = originalUpdate.apply(this, arguments);
                    
                    // After update, send our ball state if we're the authority
                    if (gameState.ballAuthority) {
                        sendBallUpdate(needsFullReset);
                    }
                    
                    return result;
                };
            }
            
            // Add a method to explicitly update ball position
            game.updateBallPosition = function(position) {
                // Try to find the ball
                const ball = getBallDirectly();
                if (!ball) return false;
                
                // Update all properties
                if (position.x !== undefined) ball.x = position.x;
                if (position.y !== undefined) ball.y = position.y;
                if (position.vx !== undefined) ball.vx = position.vx;
                if (position.vy !== undefined) ball.vy = position.vy;
                if (position.speed !== undefined) ball.speed = position.speed;
                
                return true;
            };
        });
    }
    
    // Start the sync loop
    function startSyncLoop() {
        setInterval(() => {
            if (!gameState.active || !gameState.syncEnabled) return;
            
            if (gameState.ballAuthority) {
                // We already sync in the update hook
            } else {
                // Check for drift and request sync if needed
                const now = performance.now();
                if (now - gameState.lastSyncTime > SYNC_FREQUENCY_MS * 3) {
                    requestSync();
                }
            }
        }, SYNC_FREQUENCY_MS);
    }
    
    // Request sync from other player
    function requestSync() {
        if (window.WebSocketManager && WebSocketManager.send) {
            WebSocketManager.send({
                type: "game_update",
                data: {
                    syncRequest: true,
                    timestamp: performance.now()
                }
            });
        }
    }
    
    // Send ball position update
    function sendBallUpdate(forced = false) {
        if (window.WebSocketManager && WebSocketManager.sendBallSync) {
            WebSocketManager.sendBallSync(forced);
        }
    }
    
    // Send a full ball reset command
    function sendBallReset() {
        const ball = getBallState();
        if (!ball || !window.WebSocketManager || !WebSocketManager.send) return;
        
        // Generate a reset command with current state
        WebSocketManager.send({
            type: "game_update",
            data: {
                ballReset: {
                    x: ball.x,
                    y: ball.y,
                    vx: ball.vx,
                    vy: ball.vy,
                    speed: ball.speed,
                    radius: ball.radius,
                    timestamp: performance.now()
                }
            }
        });
        
        // Update our own last reset time
        gameState.lastBallReset = performance.now();
    }
    
    // Send our side information
    function sendSideInfo() {
        if (window.WebSocketManager && WebSocketManager.send) {
            WebSocketManager.send({
                type: "game_update",
                data: {
                    sideInfo: gameState.isLeftSide, 
                    timestamp: performance.now()
                }
            });
        }
    }
    
    // Determine which side this player is on
    function determinePlayerSide(isLeft) {
        // Update our side
        gameState.isLeftSide = isLeft;
        debug("Player side determined:", isLeft ? "LEFT" : "RIGHT");
        
        // Determine ball authority based on side
        determineAuthority();
        
        // Send our side info to other player
        sendSideInfo();
    }
    
    // Determine ball authority
    function determineAuthority() {
        // Get current ball state
        const ball = getBallState();
        if (!ball) {
            gameState.ballAuthority = gameState.isLeftSide; // Default: left side has authority
            return;
        }
        
        // Determine authority based on ball direction
        if (ball.vx > 0) {
            // Ball moving right, left side has authority
            gameState.ballAuthority = gameState.isLeftSide;
        } else {
            // Ball moving left, right side has authority
            gameState.ballAuthority = !gameState.isLeftSide;
        }
        
        debug("Ball authority:", gameState.ballAuthority ? "YES" : "NO");
    }
    
    // Update ball position
    function updateBallPosition(position, force = false) {
        // Skip if we're the authority and not forced
        if (gameState.ballAuthority && !force) return;
        
        // Try all possible methods to update the ball
        
        // Method 1: Use PongGame.updateBallPosition
        if (window.PongGame && PongGame.updateBallPosition) {
            PongGame.updateBallPosition(position);
        }
        
        // Method 2: Direct update of ball object
        const ball = getBallDirectly();
        if (ball) {
            // Update all properties with interpolation for smoother movement
            if (position.x !== undefined) ball.x = interpolateValue(ball.x, position.x, INTERPOLATION_WEIGHT);
            if (position.y !== undefined) ball.y = interpolateValue(ball.y, position.y, INTERPOLATION_WEIGHT);
            if (position.vx !== undefined) ball.vx = position.vx; // Don't interpolate velocities
            if (position.vy !== undefined) ball.vy = position.vy;
            if (position.speed !== undefined) ball.speed = position.speed;
        }
    }
    
    // Detect and correct drift between local and remote ball state
    function detectAndCorrectDrift() {
        // Need at least one history entry
        if (ballHistory.length === 0) return;
        
        // Get current ball state
        const ball = getBallState();
        if (!ball) return;
        
        // Get latest history entry
        const latest = ballHistory[ballHistory.length - 1];
        
        // Calculate time since that update
        const now = performance.now();
        const elapsed = now - latest.received;
        
        // Skip if too recent
        if (elapsed < 5) return;
        
        // Predict where ball should be now
        const predictedX = latest.x + (latest.vx * (elapsed / 16)); // 16ms is ~60fps
        const predictedY = latest.y + (latest.vy * (elapsed / 16));
        
        // Calculate drift
        const driftX = Math.abs(ball.x - predictedX);
        const driftY = Math.abs(ball.y - predictedY);
        
        // If drift exceeds threshold, apply correction
        if (driftX > ERROR_THRESHOLD || driftY > ERROR_THRESHOLD) {
            // Create a prediction with latest velocity
            const prediction = {
                x: predictedX,
                y: predictedY,
                vx: latest.vx,
                vy: latest.vy,
                speed: latest.speed
            };
            
            // Apply the correction
            updateBallPosition(prediction, true);
        }
    }
    
    // Get ball state from PongGame
    function getBallState() {
        try {
            if (window.PongGame && typeof PongGame.getState === 'function') {
                const state = PongGame.getState();
                if (state && state.ball && 
                    typeof state.ball.x === 'number' && 
                    typeof state.ball.y === 'number' &&
                    typeof state.ball.vx === 'number' && 
                    typeof state.ball.vy === 'number') {
                    return state.ball;
                }
            }
        } catch (e) {
            debug("Error getting ball state:", e);
        }
        return null;
    }
    
    
    // Get direct reference to ball object
    function getBallDirectly() {
        try {
            // Method 1: Through PongGame.getState
            if (window.PongGame && typeof PongGame.getState === 'function') {
                const state = PongGame.getState();
                if (state && state.ball) {
                    return state.ball;
                }
            }
            
            // Method 2: Direct global variable
            if (window.ball) {
                return window.ball;
            }
        } catch (e) {
            debug("Error accessing ball directly:", e);
        }
        
        return null;
    }
    
    // Helper function to wait for an object to be defined
    function waitForObject(objectName, callback, maxTries = 100, interval = 100) {
        let tries = 0;
        
        const check = () => {
            tries++;
            if (window[objectName]) {
                callback(window[objectName]);
                return true;
            } else if (tries >= maxTries) {
                debug(`Timed out waiting for ${objectName}`);
                return false;
            }
            setTimeout(check, interval);
            return false;
        };
        
        check();
    }
    
    // Helper function to interpolate between values
    function interpolateValue(current, target, weight) {
        return current + (target - current) * weight;
    }
    
    // Add keyboard shortcut to toggle sync for testing
    document.addEventListener('keydown', (e) => {
        // Ctrl+Alt+S to toggle sync
        if (e.ctrlKey && e.altKey && e.key === 's') {
            gameState.syncEnabled = !gameState.syncEnabled;
            debug("Ball sync " + (gameState.syncEnabled ? "ENABLED" : "DISABLED"));
        }
    });
    
    // Initialize when DOM loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();