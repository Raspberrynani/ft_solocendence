/**
 * Enhanced Ball Synchronization System
 * Solves cross-monitor synchronization issues for multiplayer Pong
 */
(function() {
    // Track game state
    let isWindowMinimized = false;
    let isGameRunning = false;
    let lastSyncTime = 0;
    let syncInterval = null;
    let isLeftSide = true; // Determines if this is the left or right player
    let localAuthority = false; // Whether this client has authority over ball state
    
    // Time constants
    const SYNC_INTERVAL_MS = 100;     // More frequent syncing (was 500ms)
    const SYNC_TIMEOUT_MS = 1000;     // Shorter timeout (was 2000ms)
    const AUTHORITY_DURATION_MS = 5000; // How long a side keeps authority
    
    // Ball state history for interpolation
    const stateHistory = [];
    const MAX_HISTORY = 10;
    
    // Initialize the enhanced ball sync system
    function initBallSync() {
        console.log("Initializing enhanced ball synchronization system...");
        
        // Set up visibility change detection
        setupVisibilityDetection();
        
        // Set up WebSocket handlers for ball sync
        setupNetworkSync();
        
        // Set up predictive corrections
        setupPredictiveCorrections();
        
        // Start position negotiation
        startPositionNegotiation();
    }
    
    // Set up visibility change detection (unchanged)
    function setupVisibilityDetection() {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', () => setMinimized(true));
        window.addEventListener('focus', () => setMinimized(false));
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        console.log("Visibility detection initialized");
    }
    
    // Handle document visibility change (unchanged)
    function handleVisibilityChange() {
        if (document.hidden) {
            setMinimized(true);
        } else {
            setTimeout(() => setMinimized(false), 100);
        }
    }
    
    // Handle fullscreen change (unchanged)
    function handleFullscreenChange() {
        const isFullscreen = !!document.fullscreenElement || 
                           !!document.webkitFullscreenElement;
        
        if (isFullscreen && isWindowMinimized) {
            setMinimized(false);
        }
    }
    
    // Set minimized state (unchanged)
    function setMinimized(minimized) {
        if (isWindowMinimized === minimized) return;
        
        console.log("Window minimized state:", minimized);
        isWindowMinimized = minimized;
        
        if (minimized) {
            handleGameMinimized();
        } else {
            handleGameRestored();
        }
    }
    
    // Handle game being minimized (unchanged)
    function handleGameMinimized() {
        showMinimizedIndicator(true);
        sendGameStatus('minimized');
        
        // Relinquish ball authority when minimized
        if (localAuthority) {
            localAuthority = false;
            sendAuthorityUpdate(false);
        }
    }
    
    // Handle game being restored (unchanged)
    function handleGameRestored() {
        showMinimizedIndicator(false);
        requestBallSync();
        sendGameStatus('restored');
    }
    
    // Set up WebSocket handlers for enhanced ball sync
    function setupNetworkSync() {
        // Wait for WebSocketManager to be available
        const checkInterval = setInterval(function() {
            if (!window.WebSocketManager) return;
            
            clearInterval(checkInterval);
            console.log("WebSocketManager found - setting up enhanced ball sync");
            
            // Get original send update function
            const originalSendUpdate = WebSocketManager.sendPaddleUpdate;
            
            // Override to include authority information
            WebSocketManager.sendPaddleUpdate = function(paddleY) {
                if (isWindowMinimized) {
                    return false;
                }
                
                const result = originalSendUpdate.call(this, paddleY);
                
                // Determine if we're the left side based on paddle updates
                // Left paddle is controlled by this client
                isLeftSide = true;
                
                return result;
            };
            
            // Create new function for ball sync
            WebSocketManager.requestBallSync = function() {
                return this.send({
                    type: "game_update",
                    data: { 
                        syncRequest: true,
                        timestamp: Date.now(),
                        isLeftSide: isLeftSide 
                    }
                });
            };
            
            // Override the existing game update handler
            const originalGameUpdateHandler = WebSocketManager.handleGameUpdate || function() {};
            
            WebSocketManager.handleGameUpdate = function(data) {
                // Process sync messages
                if (data) {
                    // Handle ball sync requests
                    if (data.syncRequest) {
                        handleBallSyncRequest(data);
                    }
                    
                    // Handle ball position updates
                    if (data.ballPosition) {
                        applyBallSync(data.ballPosition, data.hasAuthority);
                    }
                    
                    // Handle authority updates
                    if (data.authorityUpdate !== undefined) {
                        handleAuthorityUpdate(data.authorityUpdate, data.isLeftSide);
                    }
                    
                    // Handle player status updates
                    if (data.playerStatus) {
                        handlePlayerStatusUpdate(data.playerStatus);
                    }
                }
                
                // Call original handler for paddle position etc.
                if (typeof originalGameUpdateHandler === 'function') {
                    originalGameUpdateHandler.call(this, data);
                }
            };
            
            // Start periodic sync
            startPeriodicSync();
        }, 100);
    }
    
    // Set up predictive corrections for smoother gameplay
    function setupPredictiveCorrections() {
        // Wait for PongGame to be available
        const checkInterval = setInterval(function() {
            if (!window.PongGame) return;
            
            clearInterval(checkInterval);
            console.log("PongGame found - setting up predictive corrections");
            
            // Get original update function
            const originalUpdate = PongGame.update;
            
            // Override to apply prediction and correction
            if (typeof originalUpdate === 'function') {
                PongGame.update = function(deltaFactor) {
                    // Call original update
                    originalUpdate.call(this, deltaFactor);
                    
                    // Apply prediction or correction based on authority
                    if (!localAuthority) {
                        applyPredictiveCorrection();
                    }
                };
            }
        }, 100);
    }
    
    // Apply predictive correction to smooth ball movement between syncs
    function applyPredictiveCorrection() {
        // Only apply if we have enough history
        if (stateHistory.length < 2) return;
        
        // Get current ball state
        const gameState = PongGame.getState();
        if (!gameState || !gameState.ball) return;
        
        // Use the two most recent history entries to predict current position
        const mostRecent = stateHistory[stateHistory.length - 1];
        const previous = stateHistory[stateHistory.length - 2];
        
        // Calculate time elapsed since most recent update
        const timeElapsed = Date.now() - mostRecent.timestamp;
        
        // Apply prediction at small errors, correction at large errors
        const diffX = Math.abs(gameState.ball.x - mostRecent.x);
        const diffY = Math.abs(gameState.ball.y - mostRecent.y);
        
        if (diffX > 50 || diffY > 50) {
            // Large error - apply full correction
            updateBallPosition(mostRecent);
        } else if (diffX > 10 || diffY > 10) {
            // Medium error - blend current with correction
            const blend = 0.3; // 30% correction, 70% current
            const correctedX = blend * mostRecent.x + (1 - blend) * gameState.ball.x;
            const correctedY = blend * mostRecent.y + (1 - blend) * gameState.ball.y;
            
            updateBallPosition({
                x: correctedX,
                y: correctedY,
                vx: mostRecent.vx,
                vy: mostRecent.vy,
                speed: mostRecent.speed
            });
        }
        // Small errors are allowed as-is for smoother local appearance
    }
    
    // Start periodic ball sync
    function startPeriodicSync() {
        // Clear any existing interval
        if (syncInterval) {
            clearInterval(syncInterval);
        }
        
        // Set up new interval
        syncInterval = setInterval(function() {
            if (isGameRunning) {
                const now = Date.now();
                
                // If we have authority, send position updates
                if (localAuthority && !isWindowMinimized) {
                    sendBallPosition(true);
                }
                // Otherwise request updates if it's been too long
                else if (now - lastSyncTime > SYNC_TIMEOUT_MS) {
                    requestBallSync();
                }
            }
        }, SYNC_INTERVAL_MS);
    }
    
    // Start position authority negotiation
    function startPositionNegotiation() {
        // Determine initial authority
        setTimeout(() => {
            // Initially, give authority to the left side
            if (isLeftSide) {
                localAuthority = true;
                sendAuthorityUpdate(true);
                console.log("Taking initial ball authority (left side)");
            }
            
            // Set up authority rotation
            setInterval(() => {
                if (isGameRunning && !isWindowMinimized) {
                    // Toggle authority between sides every AUTHORITY_DURATION_MS
                    if (localAuthority) {
                        // We currently have authority, check if it's time to transfer
                        const gameState = PongGame.getState();
                        if (gameState && gameState.ball) {
                            // Transfer authority when ball crosses center
                            const centerX = document.getElementById('pong-canvas')?.width / 2 || 400;
                            const isRightSide = gameState.ball.x > centerX;
                            
                            if ((isLeftSide && isRightSide) || (!isLeftSide && !isRightSide)) {
                                // Ball is on the other player's side, transfer authority
                                localAuthority = false;
                                sendAuthorityUpdate(false);
                                console.log("Transferring ball authority to other side");
                            }
                        }
                    }
                }
            }, 1000); // Check every second
        }, 1000); // Initial delay
    }
    
    // Request a ball position sync from other players
    function requestBallSync() {
        if (window.WebSocketManager && WebSocketManager.requestBallSync) {
            console.log("Requesting ball sync");
            WebSocketManager.requestBallSync();
            lastSyncTime = Date.now();
        }
    }
    
    // Send our ball position to other players
    function sendBallPosition(withAuthority = false) {
        if (!window.WebSocketManager || !window.PongGame) return;
        if (!WebSocketManager.send || !PongGame.getState) return;
        
        // Get current ball state
        const gameState = PongGame.getState();
        if (!gameState || !gameState.ball) return;
        
        // Send ball position update with authority flag
        WebSocketManager.send({
            type: "game_update",
            data: {
                ballPosition: {
                    x: gameState.ball.x,
                    y: gameState.ball.y,
                    vx: gameState.ball.vx,
                    vy: gameState.ball.vy,
                    speed: gameState.ball.speed,
                    timestamp: Date.now()
                },
                hasAuthority: withAuthority,
                isLeftSide: isLeftSide
            }
        });
    }
    
    // Send authority update
    function sendAuthorityUpdate(hasAuthority) {
        if (window.WebSocketManager && WebSocketManager.send) {
            WebSocketManager.send({
                type: "game_update",
                data: {
                    authorityUpdate: hasAuthority,
                    isLeftSide: isLeftSide,
                    timestamp: Date.now()
                }
            });
        }
    }
    
    // Handle a ball sync request from another player
    function handleBallSyncRequest(data) {
        // Only respond with position if we have authority
        if (localAuthority) {
            sendBallPosition(true);
        }
        
        // Update our side flag based on the request
        if (data.isLeftSide !== undefined) {
            isLeftSide = !data.isLeftSide; // We're the opposite side
        }
    }
    
    // Handle authority update from the other player
    function handleAuthorityUpdate(hasAuthority, otherIsLeftSide) {
        if (otherIsLeftSide !== undefined) {
            isLeftSide = !otherIsLeftSide; // We're the opposite side
        }
        
        // If other player is giving up authority, take it
        if (!hasAuthority) {
            localAuthority = true;
            console.log("Taking ball authority");
        }
        // If other player is claiming authority, release it
        else if (localAuthority) {
            localAuthority = false;
            console.log("Releasing ball authority");
        }
    }
    
    // Apply ball position sync from network
    function applyBallSync(ballPosition, remoteHasAuthority) {
        // Update the last sync time
        lastSyncTime = Date.now();
        
        // Only apply if we don't have authority or remote explicitly has authority
        if (!localAuthority || remoteHasAuthority) {
            // Add to state history for interpolation
            stateHistory.push({...ballPosition});
            while (stateHistory.length > MAX_HISTORY) {
                stateHistory.shift();
            }
            
            // Apply the position update
            updateBallPosition(ballPosition);
        }
    }
    
    // Update ball position in the game
    function updateBallPosition(position) {
        // Only if we have PongGame available
        if (!window.PongGame || !PongGame.getState) return;
        
        // Get the ball object
        const gameState = PongGame.getState();
        if (!gameState || !gameState.ball) return;
        
        // Find all possible ways to update the ball position
        if (window.ball) {
            // Direct access
            window.ball.x = position.x;
            window.ball.y = position.y;
            window.ball.vx = position.vx;
            window.ball.vy = position.vy;
            window.ball.speed = position.speed;
        } else if (PongGame.updateBallPosition) {
            // Method may exist
            PongGame.updateBallPosition(position);
        } else if (PongGame.setBallState) {
            // Alternative method
            PongGame.setBallState(position);
        } else {
            // Try to access ball through internal structures
            const internalBall = findBallObject();
            if (internalBall) {
                internalBall.x = position.x;
                internalBall.y = position.y;
                internalBall.vx = position.vx;
                internalBall.vy = position.vy;
                internalBall.speed = position.speed;
            } else {
                console.warn("Unable to update ball position - no suitable method found");
            }
        }
    }
    
    // Try to find the ball object in various places
    function findBallObject() {
        // Check common patterns
        if (window.ball) return window.ball;
        if (window.PongGame && PongGame.ball) return PongGame.ball;
        if (window.PongGame && PongGame.getState) {
            const state = PongGame.getState();
            if (state && state.ball) return state.ball;
        }
        
        // Try to find any object that looks like a ball
        for (let key in window) {
            const obj = window[key];
            if (obj && typeof obj === 'object' && 
                'x' in obj && 'y' in obj && 
                'vx' in obj && 'vy' in obj && 
                'radius' in obj) {
                return obj;
            }
        }
        
        return null;
    }
    
    // Handle player status update
    function handlePlayerStatusUpdate(status) {
        // If other player is minimized, show indicator
        if (status === 'minimized') {
            showOpponentMinimizedIndicator(true);
        } else if (status === 'restored') {
            showOpponentMinimizedIndicator(false);
        }
    }
    
    // Send game status to other players
    function sendGameStatus(status) {
        if (window.WebSocketManager && WebSocketManager.send) {
            WebSocketManager.send({
                type: "game_update",
                data: {
                    playerStatus: status
                }
            });
        }
    }
    
    // Show minimized indicator (simplified version)
    function showMinimizedIndicator(show) {
        // Find or create the indicator
        let indicator = document.getElementById('minimized-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'minimized-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: #fff;
                padding: 15px 25px;
                border-radius: 8px;
                font-size: 18px;
                z-index: 1000;
                display: none;
                box-shadow: 0 0 15px rgba(0, 212, 255, 0.5);
            `;
            indicator.innerHTML = 'Game Minimized - Click to Resume';
            document.body.appendChild(indicator);
            
            // Add click handler to restore fullscreen
            indicator.addEventListener('click', function() {
                const canvas = document.getElementById('pong-canvas');
                if (canvas && document.fullscreenEnabled) {
                    canvas.requestFullscreen().catch(err => {
                        console.error("Error attempting to enable fullscreen:", err);
                    });
                }
                setMinimized(false);
            });
        }
        
        // Show/hide
        indicator.style.display = show ? 'block' : 'none';
    }
    
    // Show opponent minimized warning
    function showOpponentMinimizedIndicator(show) {
        // Find or create the indicator
        let indicator = document.getElementById('opponent-minimized');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'opponent-minimized';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 193, 7, 0.8);
                color: #000;
                padding: 8px 15px;
                border-radius: 5px;
                font-size: 14px;
                font-weight: bold;
                z-index: 1000;
                display: none;
            `;
            indicator.innerHTML = 'Opponent\'s Game is Minimized';
            document.body.appendChild(indicator);
        }
        
        // Show/hide
        indicator.style.display = show ? 'block' : 'none';
    }
    
    // Hook into PongGame to detect when game is running
    function monitorGameState() {
        // Check for PongGame periodically
        const checkInterval = setInterval(function() {
            if (!window.PongGame) return;
            
            clearInterval(checkInterval);
            
            // Save original start/stop functions
            const originalStart = PongGame.start;
            const originalStop = PongGame.stop;
            
            // Override start
            PongGame.start = function() {
                // Call original
                originalStart.apply(this, arguments);
                
                // Update state
                isGameRunning = true;
                console.log("Game started - enabling enhanced sync");
                
                // Initial sync request
                setTimeout(requestBallSync, 500);
            };
            
            // Override stop
            PongGame.stop = function() {
                // Call original
                originalStop.apply(this, arguments);
                
                // Update state
                isGameRunning = false;
                localAuthority = false;
                console.log("Game stopped - disabling sync");
            };
        }, 100);
    }
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log("Initializing enhanced ball synchronization");
        initBallSync();
        monitorGameState();
    });
})();