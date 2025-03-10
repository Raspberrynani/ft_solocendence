/**
 * Tournament Integration Module
 * Connects the tournament system with the main application
 */
(function() {
    // Wait for document to be ready
    document.addEventListener("DOMContentLoaded", initTournamentIntegration);
    
    /**
     * Initialize tournament integration
     */
    function initTournamentIntegration() {
        console.log("Tournament Integration: Initializing...");
        
        // Wait for App and required modules to be available
        if (!window.App || !window.TournamentManager || !window.TournamentConnector) {
            console.log("Tournament Integration: Waiting for required modules...");
            setTimeout(initTournamentIntegration, 100);
            return;
        }
        
        // Set up tournament page navigation
        setupTournamentNavigation();
        
        // Enhance game over handling for tournaments
        enhanceGameOverHandler();
        
        // Add custom styles for tournament notifications
        addTournamentStyles();
        
        console.log("Tournament Integration: Initialized successfully");
    }
    
    /**
     * Set up tournament page navigation
     */
    function setupTournamentNavigation() {
        // Get tournament mode option from main menu
        const tournamentOption = getGameModeOption('tournament');
        if (!tournamentOption) return;
        
        // Get the main start game button
        const startGameBtn = document.getElementById("start-game");
        if (!startGameBtn) return;
        
        // Store original click handler
        const originalClickHandler = startGameBtn.onclick;
        
        // Override click handler to handle tournament mode
        startGameBtn.onclick = function(e) {
            // Get current game mode
            const currentMode = getCurrentGameMode();
            
            // If tournament mode is selected
            if (currentMode === "tournament") {
                e.preventDefault();
                
                // Get player nickname
                const nicknameInput = document.getElementById("nickname");
                if (!nicknameInput || !nicknameInput.value.trim()) {
                    showError("Please enter a nickname to join a tournament");
                    return;
                }
                
                const nickname = nicknameInput.value.trim();
                
                // Store nickname for later use
                try {
                    localStorage.setItem('currentNickname', nickname);
                } catch (e) {
                    console.warn("Failed to store nickname in localStorage:", e);
                }
                
                // Initialize tournament system
                initTournamentSystem(nickname);
                
                // Navigate to tournament page
                navigateToPage("tournament-page");
            } else if (typeof originalClickHandler === "function") {
                // For other modes, use original handler
                originalClickHandler.call(this, e);
            }
        };
    }
    
    /**
     * Initialize the tournament system
     * @param {string} nickname Player nickname
     */
    function initTournamentSystem(nickname) {
        console.log("Initializing tournament system for player:", nickname);
        
        // Initialize Tournament Manager
        if (window.TournamentManager && window.TournamentManager.init) {
            TournamentManager.init({
                username: nickname,
                websocket: window.WebSocketManager
            });
        }
        
        // Initialize Tournament Connector
        if (window.TournamentConnector && window.TournamentConnector.init) {
            TournamentConnector.init({
                webSocket: window.WebSocketManager,
                tournamentManager: window.TournamentManager
            });
        }
    }
    
    /**
     * Enhance game over handler to support tournaments
     */
    function enhanceGameOverHandler() {
        // Get App module
        if (!window.App) return;
        
        // Get the main game state
        const appState = App.state;
        if (!appState || !appState.game) return;
        
        // Store original handleGameOver function if it exists
        const originalHandleGameOver = App.handleGameOver;
        if (typeof originalHandleGameOver !== 'function') return;
        
        // Replace with enhanced version
        App.handleGameOver = function(score, winner) {
            console.log(`Enhanced game over handler: score=${score}, winner=${winner}`);
            
            // Check if this is a tournament game
            if (appState.game.isTournament) {
                console.log("Tournament game detected");
                
                // Determine if current player won
                const playerSide = appState.game.playerSide || 'left';
                const playerWon = (playerSide === 'left' && winner === 'left') || 
                                 (playerSide === 'right' && winner === 'right');
                
                console.log(`Tournament game result: playerSide=${playerSide}, winner=${winner}, playerWon=${playerWon}`);
                
                // Send game over notification to server
                if (window.WebSocketManager && WebSocketManager.send) {
                    WebSocketManager.send({
                        type: "tournament_game_over",
                        score: score,
                        winner: playerWon ? appState.user.nickname : null
                    });
                }
                
                // Stop the appropriate game engine
                stopGameEngine(appState.game.isMultiplayer);
                
                // Exit fullscreen if active
                exitFullscreen();
                
                // Return to tournament page after a short delay
                setTimeout(() => {
                    navigateToPage("tournament-page");
                }, 1000);
                
                return; // Skip original handler
            }
            
            // Not a tournament game, call original handler
            originalHandleGameOver.call(App, score, winner);
        };
    }
    
    /**
     * Stop the active game engine
     * @param {boolean} isMultiplayer Whether multiplayer game engine is active
     */
    function stopGameEngine(isMultiplayer) {
        if (isMultiplayer) {
            // Stop server-side game renderer
            if (window.ServerPong && typeof ServerPong.stop === 'function') {
                ServerPong.stop();
            }
        } else {
            // Stop client-side game
            if (window.PongGame && typeof PongGame.stop === 'function') {
                PongGame.stop();
            }
        }
    }
    
    /**
     * Exit fullscreen mode
     */
    function exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => {
                console.warn("Error exiting fullscreen:", err);
            });
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    
    /**
     * Add tournament-specific styles
     */
    function addTournamentStyles() {
        // Check if styles are already added
        if (document.getElementById('tournament-integration-styles')) return;
        
        // Create style element
        const style = document.createElement('style');
        style.id = 'tournament-integration-styles';
        style.textContent = `
            @keyframes matchAlert {
                0%, 100% { background-color: rgba(0, 0, 0, 0.8); }
                50% { background-color: rgba(255, 153, 0, 0.2); }
            }
            
            .match-alert {
                animation: matchAlert 1s ease-in-out 3;
            }
            
            .tournament-badge {
                position: absolute;
                top: 10px;
                right: 10px;
                background-color: rgba(255, 193, 7, 0.8);
                color: black;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                z-index: 100;
            }
        `;
        
        // Add to document head
        document.head.appendChild(style);
    }
    
    /**
     * Get the game mode option by ID
     * @param {string} modeId Game mode ID to find
     * @returns {Object|null} Game mode object or null if not found
     */
    function getGameModeOption(modeId) {
        if (!window.App || !App.state || !App.state.gameModes) return null;
        
        return App.state.gameModes.find(mode => mode.id === modeId);
    }
    
    /**
     * Get current game mode from App state
     * @returns {string} Current game mode ID
     */
    function getCurrentGameMode() {
        if (!window.App || !App.state || !App.state.ui) return 'classic';
        
        const index = App.state.ui.currentGameModeIndex;
        const modes = App.state.gameModes;
        
        if (modes && modes[index]) {
            return modes[index].id;
        }
        
        return 'classic';
    }
    
    /**
     * Navigate to a page using UIManager
     * @param {string} pageId ID of page to navigate to
     */
    function navigateToPage(pageId) {
        if (window.UIManager && typeof UIManager.navigateTo === 'function') {
            UIManager.navigateTo(pageId);
        }
    }
    
    /**
     * Show error message
     * @param {string} message Error message to display
     */
    function showError(message) {
        if (window.Utils && Utils.showAlert) {
            Utils.showAlert(message, "warning");
        } else if (window.App && App.showError) {
            App.showError(message, "warning");
        } else {
            console.error(message);
            alert(message);
        }
    }
})();