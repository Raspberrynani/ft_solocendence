/**
 * Main Application Module
 * Central coordinator for all game modules and application state
 * 
 * @module App
 */
const App = (function() {
    /**
     * Application State
     * Centralized state store for all app-wide data
     */
    const state = {
        // User info
        user: {
            nickname: '',
            token: '',
            language: 'en'
        },
        
        // Game settings
        game: {
            mode: 'classic', // classic, ai, tournament, custom
            isMultiplayer: false,
            isFullscreen: false,
            rounds: {
                current: 0,
                target: 3
            },
            active: false,
            room: null,
            isTournament: false,
            playerSide: 'left'
        },
        
        // UI state
        ui: {
            currentPage: null,
            currentGameModeIndex: 0,
            isTransitioning: false,
            isDevToolsDetected: false
        },
        
        // Available game modes
        gameModes: [
            {id: 'classic', label: 'Classic with queue'},
            {id: 'ai', label: 'Classic with AI'},
            {id: 'tournament', label: 'Tournament'},
            {id: 'custom', label: 'Custom Game'}
        ]
    };
    
    /**
     * Module references for dependency management
     */
    const modules = {
        ui: null,
        game: null,
        websocket: null,
        localization: null,
        customGame: null,
        tournament: null,
        gdpr: null,
        api: null
    };
    
    /**
     * DOM element references
     */
    let elements = {};
    
    /**
     * Initialize the application
     * Entry point for the entire application
     */
    async function init() {
        console.log('Application initializing...');
        
        try {
            // Gather DOM elements first
            elements = gatherUIElements();
            
            // Initialize modules in order of dependency
            await initializeModules();
            
            // Setup event handlers
            setupEventHandlers();
            
            // Apply initial application state
            applyInitialState();
            
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Application initialization failed:', error);
            showFatalError('Failed to initialize application. Please refresh the page.', error);
        }
    }
    
    /**
     * Gather UI element references
     * @returns {Object} - Element references object
     */
    function gatherUIElements() {
        const elementIds = [
            // Pages
            'language-page', 'game-page', 'pong-page', 'leaderboard-page', 
            'custom-game-page', 'privacy-policy-page',
            
            // Form elements
            'language-selector', 'nickname', 'rounds-input', 'start-game',
            'end-game', 'prevMode', 'nextMode',
            
            // Game elements
            'pong-canvas', 'pong-status', 'overlay-player-name', 'overlay-score',
            'player-rounds', 'target-rounds', 'game-info', 'player-name',
            
            // Lists
            'leaderboard', 'waiting-players-list',
            
            // Custom game elements
            'ball-speed', 'ball-speed-value', 'paddle-size', 'paddle-size-value',
            'speed-increment', 'speed-increment-value', 'ball-color',
            'left-paddle-color', 'right-paddle-color', 'gravity-enabled',
            'bounce-random', 'game-code', 'apply-code', 'generate-code',
            'copy-code', 'start-custom-game',
            
            // Tournament elements
            'create-tournament', 'start-tournament', 'leave-tournament',
            'active-tournament', 'tournament-name', 'tournament-players',
            'current-match', 'upcoming-matches', 'completed-matches',
            'available-tournaments', 'tournament-list',
            
            // Privacy policy elements
            'privacy-back-button', 'generate-verification', 'confirm-delete',
            'delete-nickname', 'verification-section'
        ];
        
        const result = {};
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                // Convert from kebab-case to camelCase for property names
                const propName = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
                result[propName] = element;
            } else if (!id.includes('dashboard')) { // Optional elements don't warn
                console.warn(`Element not found: ${id}`);
            }
        });
        
        return result;
    }
    
    /**
     * Initialize application modules in dependency order
     * @returns {Promise} - Resolves when all modules are initialized
     */
    async function initializeModules() {
        console.log('Initializing modules...');
        
        // A helper function for safer module initialization
        const initModule = (name, initFn) => {
            console.log(`Initializing ${name} module...`);
            try {
                const result = initFn();
                console.log(`${name} module initialized successfully`);
                return result;
            } catch (error) {
                console.error(`Failed to initialize ${name} module:`, error);
                throw new Error(`Module initialization failed: ${name}`);
            }
        };
        
        // 1. Initialize essential services first
        if (window.ApiService && typeof ApiService.init === 'function') {
            await initModule('API', () => ApiService.init());
            modules.api = ApiService;
        }
        
        // 2. Initialize UI Manager
        if (window.UIManager && typeof UIManager.init === 'function') {
            initModule('UI', () => UIManager.init({
                elements,
                callbacks: {
                    onPageChange: handlePageChange,
                    onLanguageChange: handleLanguageChange
                }
            }));
            modules.ui = UIManager;
        } else {
            throw new Error('UIManager module is required but not available');
        }
        
        // 3. Initialize Localization Manager
        if (window.LocalizationManager && typeof LocalizationManager.init === 'function') {
            const initialLanguage = elements.languageSelector?.value || 'en';
            initModule('Localization', () => LocalizationManager.init(initialLanguage));
            state.user.language = LocalizationManager.getCurrentLanguage();
            modules.localization = LocalizationManager;
        }
        
        // 4. Initialize WebSocket Manager
        if (window.WebSocketManager && typeof WebSocketManager.init === 'function') {
            initModule('WebSocket', () => WebSocketManager.init({
                onConnect: handleSocketConnect,
                onDisconnect: handleSocketDisconnect,
                onError: handleSocketError,
                onReconnectFailed: handleReconnectFailed,
                onQueueUpdate: handleQueueUpdate,
                onGameStart: handleGameStart,
                onGameUpdate: handleGameUpdate,
                onGameOver: handleGameOver,
                onOpponentLeft: handleOpponentLeft
            }));
            
            // Register for waiting list updates
            WebSocketManager.onWaitingListUpdate(updateWaitingList);
            modules.websocket = WebSocketManager;
        }
        
        // 5. Initialize Custom Game Manager
        if (window.CustomGameManager && typeof CustomGameManager.init === 'function') {
            initModule('CustomGame', () => CustomGameManager.init(elements));
            modules.customGame = CustomGameManager;
        }

        // 6. Store reference to SimpleTournamentManager but don't initialize yet
        if (window.SimpleTournamentManager) {
            modules.tournament = SimpleTournamentManager;
            console.log('SimpleTournamentManager module referenced (will initialize on tournament page)');
        }
        
        // 7. Initialize GDPR Manager
        if (window.GDPRManager && typeof GDPRManager.init === 'function') {
            initModule('GDPR', () => GDPRManager.init());
            modules.gdpr = GDPRManager;
        }
        
        // 8. Initialize DevTools detection with moderate frequency
        if (window.DevToolsDetector && typeof DevToolsDetector.startMonitoring === 'function') {
            initModule('DevTools', () => DevToolsDetector.startMonitoring(2000));
        }
        
        // 9. Initialize LocalStorage Wrapper
        if (window.LocalStorageService) {
            modules.storage = LocalStorageService;
            
            // Restore saved preferences if available
            try {
                const savedLanguage = LocalStorageService.getItem('preferredLanguage');
                if (savedLanguage && modules.localization) {
                    modules.localization.setLanguage(savedLanguage);
                    state.user.language = savedLanguage;
                    if (elements.languageSelector) {
                        elements.languageSelector.value = savedLanguage;
                    }
                }
            } catch (e) {
                console.warn('Failed to restore preferences from localStorage:', e);
            }
        }
        
        console.log('All modules initialized successfully');
    }
    
    /**
     * Set up event handlers for user interaction
     */
    function setupEventHandlers() {
        console.log('Setting up event handlers...');
        
        // Add missing privacy policy button if needed
        addPrivacyPolicyButton();
        
        // 1. Language selector
        if (elements.languageSelector) {
            elements.languageSelector.addEventListener('change', () => {
                const lang = elements.languageSelector.value;
                if (modules.localization) {
                    modules.localization.setLanguage(lang);
                    state.user.language = lang;
                    
                    // Update UI translations
                    if (modules.ui) {
                        modules.ui.updateTranslations();
                    }
                    
                    // Save preference
                    if (modules.storage) {
                        modules.storage.setItem('preferredLanguage', lang);
                    }
                }
            });
        }
        
        // 2. Nickname input (enable/disable start button)
        if (elements.nickname) {
            elements.nickname.addEventListener('input', () => {
                const hasNickname = elements.nickname.value.trim().length > 0;
                
                // Toggle start button visibility
                if (modules.ui) {
                    modules.ui.toggleStartButton(hasNickname);
                }
                
                // Update Tournament Manager with new nickname
                if (hasNickname && modules.tournament) {
                    modules.tournament.setNickname(elements.nickname.value.trim());
                }
            });
        }
        
        // 3. Game mode navigation (prev/next)
        if (elements.prevMode) {
            elements.prevMode.addEventListener('click', () => {
                state.ui.currentGameModeIndex = (state.ui.currentGameModeIndex - 1 + state.gameModes.length) % state.gameModes.length;
                updateGameModeIndicator();
            });
        }
        
        if (elements.nextMode) {
            elements.nextMode.addEventListener('click', () => {
                state.ui.currentGameModeIndex = (state.ui.currentGameModeIndex + 1) % state.gameModes.length;
                updateGameModeIndicator();
            });
        }
        
        // 4. Start game button
        if (elements.startGame) {
            elements.startGame.addEventListener('click', handleStartGame);
        }
        
        // 5. End game button
        if (elements.endGame) {
            elements.endGame.addEventListener('click', endPongGame);
        }
        
        // 6. Custom game button
        if (elements.startCustomGame) {
            elements.startCustomGame.addEventListener('click', () => {
                state.game.isMultiplayer = false; // Custom games are single player for now
                
                // Get custom settings
                const customSettings = modules.customGame?.getSettings() || {};
                
                // Navigate to pong page
                if (modules.ui) {
                    modules.ui.navigateTo('pong-page');
                }
                
                if (elements.pongStatus) {
                    elements.pongStatus.innerText = 'Custom Game Mode';
                }
                
                // Start game with custom settings
                startCustomGameWithSettings(customSettings);
            });
        }
        
        // 7. Navigation buttons (data-navigate attribute)
        document.querySelectorAll('[data-navigate]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = button.getAttribute('data-navigate');
                if (modules.ui) {
                    modules.ui.navigateTo(targetPage);
                }
            });
        });
        
        // 8. Next button in language page
        const nextButton = document.getElementById('next-button');
        if (nextButton) {
            nextButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (modules.ui) {
                    modules.ui.navigateTo('game-page');
                }
            });
        }
        
        // 9. Fullscreen handling
        setupFullscreenHandlers();
        
        // 10. Canvas click for fullscreen
        if (elements.pongCanvas) {
            elements.pongCanvas.addEventListener('click', () => {
                if (!document.fullscreenElement && 
                    !document.webkitFullscreenElement &&
                    !document.mozFullScreenElement &&
                    !document.msFullscreenElement) {
                    enterFullscreen(elements.pongCanvas);
                }
            });
        }
        
        console.log('Event handlers setup complete');
    }
    
    /**
     * Set up fullscreen event handlers
     */
    function setupFullscreenHandlers() {
        // Fullscreen change handlers
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
        
        // Prevent Escape key from ending the game
        document.addEventListener('keydown', (e) => {
            if (state.game.active && e.key === 'Escape') {
                console.log('Escape pressed - fullscreen will exit but game continues');
            }
        });
    }
    
    /**
     * Add privacy policy button if it doesn't exist
     */
    function addPrivacyPolicyButton() {
        if (document.getElementById('privacy-policy-button')) {
            return; // Button already exists
        }
        
        const privacyButton = document.createElement('button');
        privacyButton.id = 'privacy-policy-button';
        privacyButton.className = 'button btn btn-secondary mt-2 w-100';
        privacyButton.setAttribute('data-navigate', 'privacy-policy-page');
        privacyButton.innerHTML = 'Privacy Policy / GDPR';
        
        // Find where to insert it (after the leaderboard button)
        const leaderboardButton = document.getElementById('leaderboard-button');
        if (leaderboardButton && leaderboardButton.parentNode) {
            leaderboardButton.parentNode.insertBefore(privacyButton, leaderboardButton.nextSibling);
        } else {
            console.warn('Could not find leaderboard button to insert privacy policy button');
            // Fallback - add to game page
            const gamePage = document.getElementById('game-page');
            if (gamePage) {
                gamePage.appendChild(privacyButton);
            }
        }
        
        // Add event listener for navigation
        privacyButton.addEventListener('click', function() {
            if (modules.ui) {
                modules.ui.navigateTo('privacy-policy-page');
            }
        });
    }
    
    /**
     * Apply initial application state
     */
    function applyInitialState() {
        console.log('Applying initial application state...');
        
        // Set initial game mode indicator
        updateGameModeIndicator();
        
        // Check screen size
        if (modules.ui) {
            modules.ui.checkWindowSize();
        }
        
        // Apply language if saved
        if (state.user.language && modules.localization) {
            modules.localization.setLanguage(state.user.language);
            if (modules.ui) {
                modules.ui.updateTranslations();
            }
        }
        
        console.log('Initial state applied');
    }
    
    /**
     * Update the game mode indicator text
     */
    function updateGameModeIndicator() {
        const gameModeIndicator = document.querySelector('.game-mode-indicator');
        if (gameModeIndicator) {
            const currentMode = state.gameModes[state.ui.currentGameModeIndex];
            gameModeIndicator.innerText = currentMode.label;
        }
    }
    
    /**
     * Show a fatal error message
     * @param {string} message - Error message
     * @param {Error} error - Error object
     */
    function showFatalError(message, error) {
        console.error('Fatal error:', message, error);
        
        // Create error UI
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fatal-error';
        errorDiv.innerHTML = `
            <div class="error-content">
                <h2>Something went wrong</h2>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    Refresh Page
                </button>
            </div>
        `;
        
        // Style error UI
        Object.assign(errorDiv.style, {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        });
        
        // Style error content
        const contentDiv = errorDiv.querySelector('.error-content');
        Object.assign(contentDiv.style, {
            backgroundColor: 'rgba(220,53,69,0.2)',
            border: '2px solid rgba(220,53,69,0.5)',
            borderRadius: '10px',
            padding: '20px',
            textAlign: 'center',
            maxWidth: '80%'
        });
        
        document.body.appendChild(errorDiv);
    }
    
    /**
     * Initialize the tournament page
     */
    function initTournamentPage() {
        console.log('Initializing tournament page...');
        
        // Reset state if needed
        if (modules.tournament) {
            modules.tournament.resetTournamentState();
        }
        
        // Request latest tournament list
        if (modules.websocket && modules.websocket.isConnected()) {
            console.log('Requesting tournament list...');
            modules.websocket.send({
                type: 'get_tournaments'
            });
        } else {
            const message = modules.localization ? 
                modules.localization.get('connectionError') : 
                'Connection error. Please check your internet connection.';
                
            showError(message);
        }
    }

    /**
     * Handle page change events
     * @param {string} pageId - ID of the page being navigated to
     */
    function handlePageChange(pageId) {
        console.log(`Page changed to: ${pageId}`);
        
        // NEW CODE: If leaving the pong page and we were waiting in queue, leave queue
        if (pageId !== 'pong-page' && state.game.isMultiplayer && 
            !state.game.active && !state.game.isTournament) {
          if (modules.websocket && typeof modules.websocket.leaveQueue === 'function') {
            console.log('Leaving queue due to page navigation');
            modules.websocket.leaveQueue();
          }
        }
        
        if (pageId === 'leaderboard-page') {
          updateLeaderboard();
        } else if (pageId === 'privacy-policy-page') {
          // Ensure GDPR Manager is initialized
          if (modules.gdpr && modules.gdpr.init) {
            modules.gdpr.init();
          }
        } else if (pageId === 'tournament-page') {
          // Initialize tournament page
          initTournamentPage();
        }
    }
    
    /**
     * Handle language change events
     * @param {string} language - Selected language code
     */
    function handleLanguageChange(language) {
        state.user.language = language;
        
        // Save preference
        if (modules.storage) {
            modules.storage.setItem('preferredLanguage', language);
        }
    }
    
    /**
     * Handle WebSocket connection
     */
    function handleSocketConnect() {
        console.log('WebSocket connected to server');
    }
    
    /**
     * Handle WebSocket disconnection
     */
    function handleSocketDisconnect() {
        console.log('WebSocket disconnected from server');
        
        const message = modules.localization ? 
            modules.localization.get('connectionError') : 
            'Connection error. Please check your internet connection.';
            
        showError(message, 'warning');
    }
    
    /**
     * Handle WebSocket errors
     * @param {Error} error - Error object
     */
    function handleSocketError(error) {
        console.error('WebSocket error:', error);
        showNetworkError(error);
    }
    
    /**
     * Handle failed reconnection attempts
     */
    function handleReconnectFailed() {
        const message = modules.localization ? 
            modules.localization.get('reconnectFailed') : 
            'Could not reconnect to server. Please refresh the page.';
            
        showError(message, 'error');
    }
    
    /**
     * Handle queue update messages
     * @param {string} message - Queue update message
     */
    function handleQueueUpdate(message) {
        if (elements.pongStatus) {
            elements.pongStatus.innerText = message;
        }
    }
    
    /**
     * Handle game start event from WebSocket
     * @param {number} rounds - Number of rounds for the game
     * @param {boolean} isTournament - Whether this is a tournament game
     * @param {string} gameRoom - Game room identifier from server
     * @param {string} playerSide - Which side the player is on ('left' or 'right')
     */
    function handleGameStart(rounds, isTournament = false, gameRoom = null, playerSide = 'left') {
        console.log(`Game start handler: rounds=${rounds}, isTournament=${isTournament}, room=${gameRoom}, playerSide=${playerSide}`);
        
        // Clear status
        if (elements.pongStatus) {
            elements.pongStatus.innerText = isTournament ? 'Tournament Match' : '';
        }
        
        // Set rounds
        if (rounds) {
            state.game.rounds.target = rounds;
            if (elements.targetRounds) {
                elements.targetRounds.innerText = rounds;
            }
        }
        
        // Set tournament game flag
        state.game.isTournament = isTournament;
        
        // IMPORTANT: For tournament games, always enable multiplayer
        if (isTournament) {
            console.log('Tournament game starting - enabling multiplayer mode');
            state.game.isMultiplayer = true;
        }
        
        // Store game room info if provided
        if (gameRoom) {
            state.game.room = gameRoom;
            // Store in localStorage for potential reconnection
            if (modules.storage) {
                modules.storage.setItem('currentGameRoom', gameRoom);
            }
        }
        
        // Reset game state
        state.game.rounds.current = 0;
        state.game.playerSide = playerSide;
        
        // Update UI with player info
        if (elements.overlayPlayerName) {
            elements.overlayPlayerName.innerText = sanitizeHTML(state.user.nickname);
        }
        if (elements.playerName) {
            elements.playerName.innerText = sanitizeHTML(state.user.nickname);
        }
        if (elements.overlayScore) {
            elements.overlayScore.innerText = state.game.rounds.current;
        }
        if (elements.playerRounds) {
            elements.playerRounds.innerText = state.game.rounds.current;
        }
        
        // Navigate to game page if not already there
        const pongPage = document.getElementById('pong-page');
        if (pongPage && !pongPage.classList.contains('active') && modules.ui) {
            modules.ui.navigateTo('pong-page');
        }
        
        // Start the game with a slight delay to allow UI to update
        setTimeout(() => {
            console.log('Starting pong game...');
            
            // For multiplayer games (including tournaments), use ServerPong
            if (state.game.isMultiplayer) {
                console.log('Using ServerPong renderer for multiplayer/tournament game');
                if (window.ServerPong && typeof ServerPong.init === 'function') {
                    ServerPong.init({
                        canvasId: 'pong-canvas',
                        playerSide: playerSide,
                        nickname: state.user.nickname,
                        token: state.user.token,
                        rounds: rounds,
                        callbacks: {
                            onRoundComplete: (roundsPlayed) => {
                                state.game.rounds.current = roundsPlayed;
                                
                                if (elements.overlayScore) {
                                    elements.overlayScore.innerText = roundsPlayed;
                                }
                                if (elements.playerRounds) {
                                    elements.playerRounds.innerText = roundsPlayed;
                                }
                                
                                console.log(`Round completed: ${roundsPlayed}/${state.game.rounds.target}`);
                            },
                            onGameStart: () => {
                                console.log('ServerPong game started');
                                state.game.active = true;
                            },
                            onGameEnd: () => {
                                console.log('ServerPong game ended');
                                state.game.active = false;
                            }
                        }
                    });
                    ServerPong.start();
                } else {
                    console.error('ServerPong renderer not available!');
                    startPongGame(); // Fallback to regular PongGame
                }
            } else {
                // For AI and custom games, use the regular PongGame
                startPongGame();
            }
        }, 500); // Increased delay for more reliable initialization
    }
        
    /**
     * Handle game updates from opponent
     * @param {Object} data - Game update data
     */
    function handleGameUpdate(data) {
        if (!data) return;
        
        // Handle paddle position updates
        if (data.paddleY !== undefined && window.PongGame && typeof PongGame.updateRemotePaddle === 'function') {
            PongGame.updateRemotePaddle(data.paddleY);
        }
    }
    
    function handleGameOver(score, winner) {
        console.log(`handleGameOver called: score=${score}, winner=${winner}`);
        
        // Deadlock Patch
        const winThreshold = Math.ceil(state.game.rounds.target / 2);
        if (winner === undefined && score >= winThreshold) {
            console.log('Winner undefined but score indicates game over - forcing cleanup');
            state.game.active = false;
            
            // Stop the appropriate game engine
            if (state.game.isMultiplayer && window.ServerPong) {
                ServerPong.stop();
            } else if (window.PongGame) {
                PongGame.stop();
            }
            
            // Exit fullscreen
            exitFullscreen();
            
            // End game and return to menu
            endPongGame();
            return;
        }
    
        // Game is over if we have a definitive winner
        if (winner === 'left' || winner === 'right') {
            console.log('Game is over - processing end game logic');
            state.game.active = false; // Game is no longer active
            
            // For multiplayer games, send game over notification to server
            if (state.game.isMultiplayer && modules.websocket) {
                modules.websocket.sendGameOver(score);
            }
            
            // Stop the appropriate game engine
            if (state.game.isMultiplayer && window.ServerPong) {
                ServerPong.stop();
            } else if (window.PongGame) {
                PongGame.stop();
            }
            
            // Exit fullscreen if active
            exitFullscreen();
            
            // For non-tournament games, record the result
            if (!state.game.isTournament) {
                // Record game result with a winning score value
                const winningScore = Math.ceil(state.game.rounds.target / 2);
                
                // Determine if current player won based on playerSide
                const playerSide = state.game.playerSide || 'left';
                const playerWon = (playerSide === 'left' && winner === 'left') || 
                                (playerSide === 'right' && winner === 'right');
                
                // Get opponent name (use a default if not available)
                const opponentName = state.game.opponent || (playerSide === 'left' ? 'Right Player' : 'Left Player');
                
                // Determine actual scores
                let playerScore = 0;
                let opponentScore = 0;
                
                if (window.ServerPong && ServerPong.getState()) {
                    const gameState = ServerPong.getState();
                    if (gameState.score) {
                        if (playerSide === 'left') {
                            playerScore = gameState.score.left || 0;
                            opponentScore = gameState.score.right || 0;
                        } else {
                            playerScore = gameState.score.right || 0;
                            opponentScore = gameState.score.left || 0;
                        }
                    }
                } else if (window.PongGame && PongGame.getState) {
                    // For AI games, try to get scores from PongGame
                    try {
                        const gameState = PongGame.getState();
                        playerScore = gameState.rounds.current || 0;
                        opponentScore = winningScore - playerScore;
                    } catch (e) {
                        console.warn('Could not get accurate scores from game state');
                        // Use fallback values
                        playerScore = playerWon ? winningScore : Math.max(0, score - 1);
                        opponentScore = playerWon ? Math.max(0, score - 1) : winningScore;
                    }
                }
                
                // Record match in match history
                if (window.MatchHistoryManager) {
                    MatchHistoryManager.addMatch({
                        opponent: state.game.isMultiplayer ? opponentName : 'AI',
                        won: playerWon,
                        score: playerScore,
                        opponentScore: opponentScore,
                        totalRounds: state.game.rounds.target,
                        gameMode: state.game.isMultiplayer ? 'classic' : (state.game.mode || 'ai')
                    });
                }
                            
                recordGameResult(
                    state.user.nickname,
                    state.user.token,
                    playerWon ? winningScore : 0,
                    state.game.rounds.target
                ).then(result => {
                    // Success messages
                    showToast('Game ended and result recorded!', 'success');
                    
                    // Show appropriate win/loss message
                    if (playerWon) {
                        showToast('Congratulations! You won the game!', 'success');
                    } else {
                        showToast('Game over. Better luck next time!', 'warning');
                    }
                    
                    // Navigate to leaderboard after a short delay
                    setTimeout(() => {
                        if (modules.ui) {
                            modules.ui.navigateTo('leaderboard-page');
                        }
                    }, 1000);
                }).catch(error => {
                    console.error('Error recording game result:', error);
                    showNetworkError('Failed to record game result!');
                });
            }
            
            endPongGame();
        }
    }

    /**
     * Handle opponent leaving the game
     * @param {string} message - Message about opponent leaving
     */
    function handleOpponentLeft(message) {
        state.game.active = false; // Game is no longer active
        showError(message);
        
        // If this is a tournament game and we're in a tournament, go back to tournament view
        if (state.game.isTournament && modules.tournament && modules.tournament.isInTournament()) {
            if (modules.ui) {
                modules.ui.navigateTo('game-page');
            }
        } else if (modules.ui) {
            modules.ui.navigateTo('game-page');
        }
    }
    
    /**
     * Handle fullscreen changes
     */
    function handleFullscreenChange() {
        // Detect if we're in fullscreen mode
        state.game.isFullscreen = !!document.fullscreenElement || 
                                 !!document.webkitFullscreenElement || 
                                 !!document.mozFullScreenElement || 
                                 !!document.msFullscreenElement;
        
        console.log('Fullscreen changed:', state.game.isFullscreen ? 'entered fullscreen' : 'exited fullscreen');
        
        const gameInfo = document.getElementById('game-info');
        if (gameInfo) {
            if (state.game.isFullscreen) {
                gameInfo.classList.remove('visible');
            } else {
                gameInfo.classList.add('visible');
            }
        }
    }
    
    /**
     * Update the waiting players list
     * @param {Array} waitingList - List of waiting players
     */
    function updateWaitingList(waitingList) {
        console.log('Updating waiting list UI with:', waitingList);
        
        if (!elements.waitingPlayersList) {
            console.error('Waiting players list element not found');
            return;
        }
        
        elements.waitingPlayersList.innerHTML = '';
    
        if (!waitingList || waitingList.length === 0) {
            const li = document.createElement('li');
            
            li.innerText = modules.localization ? 
                modules.localization.get('noPlayersWaiting') : 
                'No players waiting';
                
            li.classList.add('no-players');
            elements.waitingPlayersList.appendChild(li);
            return;
        }
    
        waitingList.forEach(player => {
            const li = document.createElement('li');
            li.className = 'list-group-item clickable-player';
            
            // Sanitize player name
            const playerName = sanitizeHTML(player.nickname);
            const roundsLabel = modules.localization ? 
                modules.localization.get('rounds') : 
                'Rounds';
                
            li.innerHTML = `<span class="player-name">${playerName}</span> <span class="player-rounds">(${roundsLabel}: ${player.rounds})</span>`;
            
            // Add click handler
            li.onclick = function() {
                console.log('Player clicked:', player);
                
                if (elements.roundsInput) {
                    // Set rounds and update UI
                    elements.roundsInput.value = player.rounds;
                    
                    // Set game mode to Classic with queue
                    state.ui.currentGameModeIndex = 0;
                    updateGameModeIndicator();
                    
                    // Highlight rounds input
                    elements.roundsInput.classList.add('highlight-input');
                    setTimeout(() => {
                        elements.roundsInput.classList.remove('highlight-input');
                    }, 1000);
                }
                
                // Focus on appropriate element
                if (elements.nickname && elements.nickname.value.trim().length > 0) {
                    if (elements.startGame && !elements.startGame.classList.contains('hidden')) {
                        elements.startGame.classList.add('pulse');
                        setTimeout(() => {
                            elements.startGame.classList.remove('pulse');
                        }, 1500);
                    }
                } else if (elements.nickname) {
                    elements.nickname.focus();
                }
            };
            
            elements.waitingPlayersList.appendChild(li);
        });
    }
    
    /**
     * Handle start game button click
     */
    function handleStartGame() {
        if (!elements.nickname || !elements.roundsInput) {
            showError('Game initialization failed: Required elements not found', 'warning');
            return;
        }
        
        const nickname = elements.nickname.value.trim();
        const rounds = elements.roundsInput.value;
        
        // Check for DevTools (only during game start to avoid affecting performance)
        if (window.DevToolsDetector && typeof DevToolsDetector.check === 'function') {
            state.ui.isDevToolsDetected = DevToolsDetector.check();
        }
        
        if (!validateInput(nickname, rounds)) {
            return;
        }
        
        // Store game info
        state.user.nickname = nickname;
        state.user.token = generateToken();
        state.game.rounds.current = 0;
        state.game.rounds.target = parseInt(rounds) || 3;
        
        // Update UI with sanitized values
        if (elements.overlayPlayerName) {
            elements.overlayPlayerName.innerText = sanitizeHTML(nickname);
        }
        if (elements.playerName) {
            elements.playerName.innerText = sanitizeHTML(nickname);
        }
        if (elements.overlayScore) {
            elements.overlayScore.innerText = state.game.rounds.current;
        }
        if (elements.playerRounds) {
            elements.playerRounds.innerText = state.game.rounds.current;
        }
        if (elements.targetRounds) {
            elements.targetRounds.innerText = state.game.rounds.target;
        }
        
        // Get selected game mode
        const selectedMode = state.gameModes[state.ui.currentGameModeIndex];
        
        // Handle different game modes
        switch (selectedMode.id) {
            case 'tournament':
                // Go to tournament page instead of starting tournament immediately
                if (modules.ui) {
                    // Update Tournament Manager nickname first
                    try {
                        localStorage.setItem('currentNickname', nickname);
                    } catch(e) {
                        console.warn('Could not store nickname in localStorage', e);
                    }
                    modules.ui.navigateTo('tournament-page');
                }
                break;
                
            case 'custom':
                // Go to custom game page
                if (modules.ui) {
                    modules.ui.navigateTo('custom-game-page');
                }
                break;
                
            case 'ai':
                // Start AI game directly
                startAIGame();
                break;
                
            default:
                // Classic with queue (default)
                startMultiplayerGame(nickname, state.user.token, state.game.rounds.target);
                break;
        }
    }
    
    /**
     * Start a game with AI opponent
     */
    function startAIGame() {
        state.game.isMultiplayer = false;
        
        if (elements.pongStatus) {
            const aiModeText = modules.localization ? 
                modules.localization.get('aiMode') : 
                'Playing with AI';
                
            elements.pongStatus.innerText = aiModeText;
        }
        
        if (modules.ui) {
            modules.ui.navigateTo('pong-page');
        }
        
        startPongGame();
    }
    
    /**
     * Start a multiplayer game by joining queue
     * @param {string} nickname - Player nickname
     * @param {string} token - Player token
     * @param {number} rounds - Number of rounds
     */
    function startMultiplayerGame(nickname, token, rounds) {
        state.game.isMultiplayer = true;
        
        // Join queue via WebSocket
        if (modules.websocket && modules.websocket.isConnected()) {
            modules.websocket.joinQueue(
                nickname,
                token,
                rounds
            );
            
            if (modules.ui) {
                modules.ui.navigateTo('pong-page');
            }
            
            if (elements.pongStatus) {
                const waitingText = modules.localization ? 
                    modules.localization.get('waitingQueue') : 
                    'Waiting in queue...';
                    
                elements.pongStatus.innerText = waitingText;
            }
        } else {
            const message = modules.localization ? 
                modules.localization.get('connectionError') : 
                'Connection error. Please check your internet connection.';
                
            showError(message);
        }
    }
    
    /**
     * Validate user input
     * @param {string} nickname - User's nickname
     * @param {string|number} rounds - Number of rounds
     * @returns {boolean} - Whether input is valid
     */
    function validateInput(nickname, rounds) {
        if (!nickname || nickname.trim().length === 0) {
            const message = modules.localization ? 
                modules.localization.get('nicknameRequired') : 
                'Please enter a nickname!';
                
            showError(message, 'warning');
            return false;
        }
        
        // More thorough nickname validation (alphanumeric + some special chars)
        if (!isValidNickname(nickname)) {
            showError('Nickname must be 1-16 characters with only letters, numbers, underscore or hyphen.', 'warning');
            return false;
        }
        
        // Validate rounds as number within range
        const roundsNum = parseInt(rounds);
        if (isNaN(roundsNum) || roundsNum < 1 || roundsNum > 20) {
            showError('Rounds must be a number between 1 and 20.', 'warning');
            return false;
        }
        
        return true;
    }
    
    /**
     * Start the Pong game
     * @param {Object} customSettings - Optional custom game settings
     */
    function startPongGame(customSettings = null) {
        console.log('startPongGame called with mode:', 
            state.game.isMultiplayer ? 'Multiplayer' : 
            customSettings ? 'Custom' : 'AI');
        
        // Set game as active
        state.game.active = true;
        
        // Reset game state
        state.game.rounds.current = 0;
        
        // Update UI
        if (elements.endGame) {
            elements.endGame.classList.remove('hidden');
        }
        if (elements.playerRounds) {
            elements.playerRounds.innerText = state.game.rounds.current;
        }
        
        // Setup canvas styling
        if (elements.pongCanvas) {
            elements.pongCanvas.style.width = '100%';
            elements.pongCanvas.style.height = 'auto';
            elements.pongCanvas.classList.remove('crt-zoom');
        }
        
        // Try to enter fullscreen
        if (elements.pongCanvas) {
            enterFullscreen(elements.pongCanvas).catch(err => {
                console.warn('Fullscreen request failed:', err);
                // Game can still run without fullscreen
            });
        }
        
        // Allow a short delay for fullscreen to complete
        setTimeout(() => {
            // Prepare game initialization options - start with basic settings
            const gameInitOptions = {
                canvasId: 'pong-canvas',
                isMultiplayer: state.game.isMultiplayer,
                nickname: state.user.nickname,
                token: state.user.token,
                rounds: state.game.rounds.target
            };
            
            // If this is a custom game, add custom settings
            if (customSettings) {
                console.log('Adding custom game settings:', customSettings);
                Object.assign(gameInitOptions, {
                    initialBallSpeed: customSettings.ballSpeed,
                    speedIncrement: customSettings.speedIncrement,
                    paddleSizeMultiplier: customSettings.paddleSize,
                    ballColor: customSettings.ballColor,
                    leftPaddleColor: customSettings.leftPaddleColor,
                    rightPaddleColor: customSettings.rightPaddleColor,
                    gravityEnabled: customSettings.gravityEnabled,
                    bounceRandom: customSettings.bounceRandom
                });
            }
            
            // Add callbacks
            gameInitOptions.callbacks = {
                onRoundComplete: (roundsPlayed) => {
                    state.game.rounds.current = roundsPlayed;
                    
                    if (elements.overlayScore) {
                        elements.overlayScore.innerText = roundsPlayed;
                    }
                    if (elements.playerRounds) {
                        elements.playerRounds.innerText = roundsPlayed;
                    }
                    
                    console.log(`Round completed: ${roundsPlayed}/${state.game.rounds.target}`);
                },
                onGameOver: (score) => {
                    console.log('Game over callback triggered with score:', score);
                    handleGameOver(score);
                },
                onPaddleMove: (paddleY) => {
                    // Send paddle position to server in multiplayer mode
                    if (state.game.isMultiplayer && modules.websocket) {
                        modules.websocket.sendPaddleUpdate(paddleY);
                    }
                },
                onGameStart: () => {
                    console.log('Game started callback');
                },
                onGameEnd: () => {
                    console.log('Game ended callback');
                },
                onFullscreenChange: (isFullscreen) => {
                    console.log('Fullscreen changed:', isFullscreen);
                    state.game.isFullscreen = isFullscreen;
                }
            };
            
            console.log('Initializing PongGame with options:', gameInitOptions);
            
            // Initialize and start game
            if (window.PongGame && typeof PongGame.init === 'function') {
                if (PongGame.init(gameInitOptions)) {
                    PongGame.start();
                    
                    // Apply "CRT zoom" effect for visual flair
                    if (elements.pongCanvas) {
                        void elements.pongCanvas.offsetWidth; // Force reflow
                        elements.pongCanvas.classList.add('crt-zoom');
                    }
                    
                    console.log('PongGame started successfully');
                } else {
                    showError('Failed to initialize game. Please refresh the page.', 'error');
                }
            } else {
                showError('PongGame module not found. Please refresh the page.', 'error');
            }
        }, 300); // Increased timeout for more reliable fullscreen transition
    }
    
    /**
     * Start a custom game with specified settings
     * @param {Object} customSettings - Custom game settings
     */
    function startCustomGameWithSettings(customSettings) {
        state.game.isMultiplayer = false; // Custom games are single player for now
        
        // Navigate to pong page
        if (modules.ui) {
            modules.ui.navigateTo('pong-page');
        }
        
        if (elements.pongStatus) {
            elements.pongStatus.innerText = 'Custom Game Mode';
        }
        
        // Start game with custom settings
        startPongGame(customSettings);
    }
    
    /**
     * End the Pong game and record results
     */
    // Update endPongGame function in main.js to properly handle tournaments
// Find this function in frontend/js/main.js

async function endPongGame() {
    console.log('Ending game...');
    
    // Mark game as inactive
    state.game.active = false;

    if (state.game.isMultiplayer && !state.game.isTournament) {
        // Check if the WebSocket manager has the leaveQueue method
        if (modules.websocket && typeof modules.websocket.leaveQueue === 'function') {
          console.log('Leaving queue via WebSocket');
          modules.websocket.leaveQueue();
        }
    }
    
    // Store tournament flag before we clean up
    const wasInTournament = state.game.isTournament;
    
    // Stop the game
    if (state.game.isMultiplayer) {
      // Stop server-side game renderer
      if (window.ServerPong) {
        ServerPong.stop();
      }
    } else {
      // Stop client-side game
      if (window.PongGame) {
        PongGame.stop();
      }
    }
  
    // For multiplayer mode, report score to server
    if (state.game.isMultiplayer) {
      try {
        // Check if this was a tournament game
        if (wasInTournament) {
          console.log('Tournament game ended - will navigate to tournament view');
          
          // Clean up UI
          if (elements.endGame) {
            elements.endGame.classList.add('hidden');
          }
          
          // Reset state
          state.game.isTournament = false;
          
          // Navigate back to tournament page with a slight delay to ensure
          // all tournament state updates are processed first
          setTimeout(() => {
            if (modules.ui) {
              console.log('Navigating back to tournament page');
              modules.ui.navigateTo('tournament-page');
            }
          }, 500);
        } else {
          // Non-tournament game - regular flow
          // Get the final result from ServerPong
          let result = { winner: false };
          
          // Show game result toast for non-tournament games
          if (result.winner) {
            const winMessage = modules.localization ? 
              modules.localization.get('gameWon') : 
              'Congratulations! You won the game!';
              
            showToast(winMessage, 'success');
          } else {
            const lossMessage = modules.localization ? 
              modules.localization.get('gameLost') : 
              'Game over. Better luck next time!';
              
            showToast(lossMessage, 'warning');
          }
          
          // Update UI
          if (elements.endGame) {
            elements.endGame.classList.add('hidden');
          }
          
          // Navigate to leaderboard for non-tournament games
          if (modules.ui) {
            modules.ui.navigateTo('leaderboard-page');
          }
        }
      } catch (error) {
        console.error('Error ending game:', error);
        
        const errorMessage = modules.localization ? 
          modules.localization.get('failedToRecord') : 
          'Failed to record game result!';
          
        showNetworkError(errorMessage);
        
        // Navigate based on game type
        if (modules.ui) {
          if (wasInTournament) {
            console.log('Error but still navigating to tournament page');
            modules.ui.navigateTo('tournament-page');
          } else {
            modules.ui.navigateTo('game-page');
          }
        }
      }
    } else {
      // For non-multiplayer games (AI or custom), do not record
      console.log('Not recording game result for non-multiplayer mode');
      showToast('Custom/AI game completed', 'info');
      
      // Update UI
      if (elements.endGame) {
        elements.endGame.classList.add('hidden');
      }
      
      // Navigate to menu
      if (modules.ui) {
        modules.ui.navigateTo('game-page');
      }
    }
    
    // Exit fullscreen if active
    exitFullscreen().catch(err => {
      // Ignore fullscreen exit errors
      console.warn('Error exiting fullscreen:', err);
    });
  }
    
    /**
     * Record a game result with the server
     * @param {string} nickname - Player nickname
     * @param {string} token - Game token
     * @param {number} score - Player score
     * @param {number} totalRounds - Total rounds played
     * @returns {Promise<Object>} - Server response
     */
    async function recordGameResult(nickname, token, score, totalRounds) {
        try {
            // Get CSRF token first
            const csrfResponse = await fetch(`${getApiBaseUrl()}/csrf/`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!csrfResponse.ok) {
                throw new Error(`CSRF token request failed: ${csrfResponse.status} ${csrfResponse.statusText}`);
            }
            
            const csrfData = await csrfResponse.json();
            const csrfToken = csrfData.csrfToken;
            
            console.log("Got CSRF token:", csrfToken);
            
            // Ensure the CSRF cookie is set
            document.cookie = `csrftoken=${csrfToken}; path=/; SameSite=Lax`;
            
            // Now make the end_game request with the fresh token
            const apiUrl = getApiBaseUrl();
            const response = await fetch(`${apiUrl}/end_game/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({
                    nickname,
                    token,
                    score,
                    totalRounds
                })
            });
            
            // More detailed error handling
            if (!response.ok) {
                console.error(`Request failed: ${response.status} ${response.statusText}`);
                console.error('Request details:', {
                    url: `${apiUrl}/end_game/`,
                    nickname,
                    score,
                    totalRounds,
                    csrfToken: csrfToken.substring(0, 10) + '...' // Show part of token for debugging
                });
                
                let errorMessage;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || `${response.status}: ${response.statusText}`;
                } catch (e) {
                    errorMessage = `${response.status}: ${response.statusText}`;
                }
                throw new Error(`Server responded with ${errorMessage}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error recording game result:', error);
            throw error;
        }
    }
    
    /**
     * Update the leaderboard with latest player data
     */
    async function updateLeaderboard() {
        try {
            if (!elements.leaderboard) {
                console.error('Leaderboard element not found');
                return;
            }
    
            // Check if match history container exists, if not, create it
            let matchHistoryContainer = document.getElementById('match-history-container');
            if (!matchHistoryContainer) {
                // Create match history section
                matchHistoryContainer = document.createElement('div');
                matchHistoryContainer.id = 'match-history-container';
                matchHistoryContainer.className = 'match-history-container';
                
                // Create toggle button
                const toggleButton = document.createElement('div');
                toggleButton.className = 'match-history-toggle';
                toggleButton.innerHTML = '<button class="match-history-button"><i class="fas fa-history"></i> Match History</button>';
                
                // Add click handler for toggle
                toggleButton.querySelector('button').addEventListener('click', function() {
                    if (matchHistoryContainer.classList.contains('hidden')) {
                        matchHistoryContainer.classList.remove('hidden');
                        this.innerHTML = '<i class="fas fa-times"></i> Hide History';
                    } else {
                        matchHistoryContainer.classList.add('hidden');
                        this.innerHTML = '<i class="fas fa-history"></i> Match History';
                    }
                });
                
                // Get leaderboard container and insert before the leaderboard
                const leaderboardPage = document.getElementById('leaderboard-page');
                const leaderboardCard = leaderboardPage.querySelector('.card');
                
                if (leaderboardPage && leaderboardCard) {
                    leaderboardPage.insertBefore(toggleButton, leaderboardCard);
                    leaderboardPage.insertBefore(matchHistoryContainer, leaderboardCard);
                    
                    // Initially hide the match history
                    matchHistoryContainer.classList.add('hidden');
                }
            }
    
            // Display match history if the container exists
            if (window.MatchHistoryManager && matchHistoryContainer) {
                MatchHistoryManager.displayHistory(matchHistoryContainer, 3);
            }
            
            showLoading(elements.leaderboard);
            
            // Use ApiService if available
            let data;
            if (modules.api && modules.api.get) {
                data = await modules.api.get('entries/');
            } else {
                // Fallback to direct fetch
                const apiUrl = getApiBaseUrl();
                const response = await fetch(`${apiUrl}/entries/`);
                
                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                }
                
                data = await response.json();
            }
            
            elements.leaderboard.innerHTML = '';
            
            if (!data.entries || data.entries.length === 0) {
                elements.leaderboard.innerHTML = '<li>No entries yet</li>';
                return;
            }
            
            // Sort entries by wins
            data.entries.sort((a, b) => b.wins - a.wins);
            
            // Add a title/header for the leaderboard
            const header = document.createElement('li');
            header.className = 'leaderboard-header';
            header.innerHTML = `
                <div class="d-flex justify-content-between w-100 py-2">
                    <span><strong>Player</strong></span>
                    <span><strong>Stats</strong></span>
                </div>
            `;
            elements.leaderboard.appendChild(header);
            
            // Create player entries
            data.entries.forEach((entry, index) => {
                const li = document.createElement('li');
                li.classList.add(`rank-${entry.rank}`);
                
                // Add 'top3' class for the top 3 players
                if (index < 3) {
                    li.classList.add(`top-${index + 1}`);
                }
                
                // Calculate win/loss ratio visual indicator width
                const winRatioWidth = Math.max(5, entry.win_ratio); // Min 5% for visibility
                
                li.innerHTML = `
                    <div class="d-flex justify-content-between w-100 align-items-center">
                        <span class="player-name" data-player="${sanitizeHTML(entry.name)}">
                            ${index < 3 ? `<span class="position-indicator">${index + 1}</span>` : ''}
                            ${sanitizeHTML(entry.name)}
                        </span> 
                        <span class="player-stats">
                            <span class="badge bg-success">${entry.wins} W</span>
                            <span class="badge bg-secondary">${entry.games_played} G</span>
                        </span>
                    </div>
                    <div class="win-ratio-bar mt-1">
                        <div class="win-ratio-progress" style="width: ${winRatioWidth}%" title="${entry.win_ratio}% Win Rate"></div>
                    </div>
                `;
                
                // Add click event to show player details
                li.querySelector('.player-name').addEventListener('click', () => showPlayerDetails(entry.name));
                
                elements.leaderboard.appendChild(li);
            });
            
            // Add leaderboard description at the bottom
            const footer = document.createElement('li');
            footer.className = 'leaderboard-footer';
            footer.innerHTML = `
                <small class="text-muted">
                    Click on a player's name to see detailed statistics
                </small>
            `;
            elements.leaderboard.appendChild(footer);
            
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            
            if (elements.leaderboard) {
                elements.leaderboard.innerHTML = '<li>Error loading leaderboard</li>';
            }
            
            showNetworkError(error);
        }
    }
    
    /**
     * Show detailed stats for a single player
     * @param {string} playerName - Name of the player to show stats for
     */
    async function showPlayerDetails(playerName) {
        try {
            // Use ApiService if available
            let data;
            if (modules.api && modules.api.get) {
                data = await modules.api.get(`player/${playerName}/`);
            } else {
                // Fallback to direct fetch
                const apiUrl = getApiBaseUrl();
                const response = await fetch(`${apiUrl}/player/${playerName}/`);
                
                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                }
                
                data = await response.json();
            }
            
            // Create a modal to show detailed stats
            const statsModal = document.createElement('div');
            statsModal.className = 'modal player-stats-modal';
            
            // Calculate win/loss data for the chart
            const wins = data.wins;
            const losses = data.games_played - data.wins;
            
            statsModal.innerHTML = `
                <div class="modal-content">
                    <h2>${sanitizeHTML(data.name)}'s Stats</h2>
                    
                    <!-- Stats Summary -->
                    <div class="player-details mb-3">
                        <div class="row text-center">
                            <div class="col">
                                <div class="stat-card">
                                    <div class="stat-value">${data.games_played}</div>
                                    <div class="stat-label">Total Games</div>
                                </div>
                            </div>
                            <div class="col">
                                <div class="stat-card">
                                    <div class="stat-value">${data.wins}</div>
                                    <div class="stat-label">Wins</div>
                                </div>
                            </div>
                            <div class="col">
                                <div class="stat-card">
                                    <div class="stat-value">${data.win_ratio}%</div>
                                    <div class="stat-label">Win Rate</div>
                                </div>
                            </div>
                        </div>
                        <div class="text-center mt-3">
                            <span class="rank-badge rank-${data.rank}">
                                ${data.rank.toUpperCase()} RANK
                            </span>
                        </div>
                    </div>
                    
                    <!-- Win/Loss Chart -->
                    <div class="chart-container">
                        <canvas id="winLossChart" width="250" height="150"></canvas>
                    </div>
                    
                    <!-- Performance Summary -->
                    <div class="performance-summary mt-3">
                        <h4>Performance Summary</h4>
                        <div class="progress mb-2">
                            <div 
                                class="progress-bar bg-success" 
                                role="progressbar" 
                                style="width: ${data.win_ratio}%" 
                                aria-valuenow="${data.win_ratio}" 
                                aria-valuemin="0" 
                                aria-valuemax="100">
                                ${data.win_ratio}% Wins
                            </div>
                        </div>
                        <p class="text-center">
                            ${getPlayerSummary(data)}
                        </p>
                    </div>
                    
                    <button class="close-modal btn btn-primary mt-3">Close</button>
                </div>
            `;
            
            // Add close functionality
            statsModal.querySelector('.close-modal').addEventListener('click', () => {
                statsModal.remove();
            });
            
            // Close modal when clicking outside
            statsModal.addEventListener('click', (e) => {
                if (e.target === statsModal) {
                    statsModal.remove();
                }
            });
            
            // Add to body
            document.body.appendChild(statsModal);
            
            // Create the chart after the modal is in the DOM
            createWinLossChart(wins, losses);
            
        } catch (error) {
            console.error('Error fetching player details:', error);
            
            const errorMessage = `Could not fetch stats for ${playerName}`;
            showNetworkError(errorMessage);
        }
    }
    
    /**
     * Create a simple win/loss chart using canvas
     * @param {number} wins - Number of wins
     * @param {number} losses - Number of losses
     */
    function createWinLossChart(wins, losses) {
        const canvas = document.getElementById('winLossChart');
        if (!canvas) {
            console.error('Chart canvas not found');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Colors
        const winColor = '#28a745';  // Green
        const lossColor = '#dc3545'; // Red
        
        // Calculate angles for pie slices
        const total = wins + losses;
        const winAngle = wins / total * Math.PI * 2;
        const lossAngle = losses / total * Math.PI * 2;
        
        // Set up chart parameters
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        const innerRadius = radius * 0.6; // For donut hole
        
        // Draw donut slices
        // Wins slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, 0, winAngle, false);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = winColor;
        ctx.fill();
        
        // Losses slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, winAngle, Math.PI * 2, false);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = lossColor;
        ctx.fill();
        
        // Draw donut hole
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, false);
        ctx.fillStyle = '#000';
        ctx.fill();
        
        // Draw legend
        const legendY = centerY + radius + 20;
        
        // Wins legend
        ctx.fillStyle = winColor;
        ctx.fillRect(centerX - 70, legendY, 15, 15);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Wins: ${wins}`, centerX - 50, legendY + 12);
        
        // Losses legend
        ctx.fillStyle = lossColor;
        ctx.fillRect(centerX + 10, legendY, 15, 15);
        ctx.fillStyle = '#fff';
        ctx.fillText(`Losses: ${losses}`, centerX + 30, legendY + 12);
    }
    
    /**
     * Generate a personalized summary based on player stats
     * @param {Object} stats - Player statistics
     * @returns {string} - Performance summary text
     */
    function getPlayerSummary(stats) {
        const games = stats.games_played;
        const winRatio = stats.win_ratio;
        
        if (games < 5) {
            return 'Not enough games to determine a pattern. Keep playing!';
        } else if (winRatio >= 70) {
            return 'Exceptional performance! You\'re dominating the game!';
        } else if (winRatio >= 50) {
            return 'Good performance! You\'re winning more than losing.';
        } else if (winRatio >= 30) {
            return 'You\'re improving, but need more practice to get a positive win ratio.';
        } else {
            return 'Keep practicing to improve your win rate!';
        }
    }
    
    //--------------------------------------------
    // Utility functions
    //--------------------------------------------
    
    /**
     * Get API base URL
     * @returns {string} - API base URL
     */
    function getApiBaseUrl() {
        // Use ApiService if available
        if (modules.api && modules.api.getBaseUrl) {
            return modules.api.getBaseUrl();
        }
        
        // Fallback to direct calculation
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port;
        
        return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
    }
    
    /**
     * Generate a random token
     * @returns {string} - Random token
     */
    function generateToken() {
        // Use Utils if available
        if (window.Utils && Utils.generateToken) {
            return Utils.generateToken();
        }
        
        // Fallback implementation
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    
    /**
     * Validate nickname format
     * @param {string} nickname - Nickname to validate
     * @returns {boolean} - Whether nickname is valid
     */
    function isValidNickname(nickname) {
        // Use Utils if available
        if (window.Utils && Utils.isValidNickname) {
            return Utils.isValidNickname(nickname);
        }
        
        // Fallback implementation
        if (!nickname || typeof nickname !== 'string') return false;
        
        // Nicknames must be 1-16 characters with only alphanumeric, underscore, or hyphen
        const validNickname = /^[A-Za-z0-9_-]{1,16}$/;
        return validNickname.test(nickname);
    }
    
    /**
     * Sanitize HTML to prevent XSS
     * @param {string} str - String to sanitize
     * @returns {string} - Sanitized string
     */
    function sanitizeHTML(str) {
        // Use Utils if available
        if (window.Utils && Utils.sanitizeHTML) {
            return Utils.sanitizeHTML(str);
        }
        
        // Fallback implementation
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }
    
    /**
     * Get CSRF token from cookies
     * @returns {string} - CSRF token
     */
    function getCsrfToken() {
        // Use Utils if available
        if (window.Utils && Utils.getCsrfToken) {
            return Utils.getCsrfToken();
        }
        
        // Fallback implementation
        return document.cookie.split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1] || '';
    }
    
    /**
     * Request fullscreen mode for an element
     * @param {HTMLElement} element - Element to display in fullscreen
     * @returns {Promise} - Promise that resolves when fullscreen starts
     */
    function enterFullscreen(element) {
        // Use Utils if available
        if (window.Utils && Utils.enterFullscreen) {
            return Utils.enterFullscreen(element);
        }
        
        // Fallback implementation
        if (!element) {
            return Promise.reject(new Error('No element provided for fullscreen'));
        }
        
        try {
            if (element.requestFullscreen) {
                return element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                return element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                return element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                return element.msRequestFullscreen();
            }
        } catch (error) {
            console.error('Error entering fullscreen:', error);
            return Promise.reject(error);
        }
        
        return Promise.reject(new Error('Fullscreen not supported'));
    }
    
    /**
 * Exit fullscreen mode safely
 * @returns {Promise} - Promise that resolves when fullscreen ends
 */
function exitFullscreen() {
    // Return immediately if already not in fullscreen
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement && 
        !document.msFullscreenElement) {
        return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
        try {
            // Define the function to be executed
            const exitFunction = document.exitFullscreen || 
                                 document.webkitExitFullscreen || 
                                 document.mozCancelFullScreen || 
                                 document.msExitFullscreen;
            
            // Check if document is active before attempting to exit fullscreen
            if (document.visibilityState === 'visible' && exitFunction) {
                exitFunction.call(document);
                resolve();
            } else {
                // If document not active or no exit function, just resolve without error
                console.log('Skipping fullscreen exit - document not active or function not available');
                resolve();
            }
        } catch (error) {
            // Log error but don't reject - allows code to continue
            console.warn('Error during fullscreen exit:', error);
            resolve(); // Resolve anyway to prevent disrupting the flow
        }
    });
}
    
    /**
     * Show a loading spinner in an element
     * @param {HTMLElement} element - Element to show loading in
     */
    function showLoading(element) {
        // Use Utils or UI if available
        if (window.Utils && Utils.showLoading) {
            return Utils.showLoading(element);
        }
        if (modules.ui && modules.ui.showLoading) {
            return modules.ui.showLoading(element);
        }
        
        // Fallback implementation
        if (!element) {
            console.error('Element not provided for showLoading');
            return;
        }
        
        element.innerHTML = `
            <div class="d-flex justify-content-center my-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Show an error message
     * @param {string} message - Error message
     * @param {string} type - Error type (error, warning, info)
     */
    function showError(message, type = 'warning') {
        console.warn('Error:', message);
        
        // Use Utils or UI if available
        if (window.Utils && Utils.showAlert) {
            return Utils.showAlert(message, type);
        }
        if (modules.ui && modules.ui.showAlert) {
            return modules.ui.showAlert(message, type);
        }
        
        // Fallback to alert for critical errors
        if (type === 'error') {
            alert(message);
        } else {
            // Create a simple toast for other messages
            const toast = document.createElement('div');
            toast.className = 'alert alert-' + type;
            toast.style.position = 'fixed';
            toast.style.top = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.zIndex = '9999';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '5px';
            toast.innerHTML = message;
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 5000);
        }
    }
    
    /**
     * Show a network error message
     * @param {string|Error} error - Error message or object
     */
    function showNetworkError(error) {
        console.error('Network error:', error);
        
        const message = error instanceof Error ? 
            `Network error: ${error.message}` : 
            `Network error: ${error}`;
        
        showError(message, 'warning');
    }
    
    /**
     * Record a match to match history
     * @param {Object} matchData - Match data
     */
    function recordMatchHistory(matchData = {}) {
        if (!window.MatchHistoryManager) {
        console.warn('MatchHistoryManager not available, match not recorded');
        return;
        }
        
        const currentGameState = App.state.game;
        
        // Default values
        const defaultData = {
        opponent: 'Unknown',
        won: false,
        score: 0,
        opponentScore: 0,
        totalRounds: currentGameState.rounds?.target || 3,
        gameMode: currentGameState.mode || 'classic'
        };
        
        // Merge with provided data
        const finalData = { ...defaultData, ...matchData };
        
        console.log('Recording match history:', finalData);
        MatchHistoryManager.addMatch(finalData);
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of toast (success, info, warning, error)
     */
    function showToast(message, type = 'info') {
        // Use Utils or UI if available
        if (window.Utils && Utils.showToast) {
            return Utils.showToast(message, type);
        }
        if (modules.ui && modules.ui.showToast) {
            return modules.ui.showToast(message, type);
        }
        
        // Fallback - use showError which has its own fallback
        showError(message, type);
    }
    
    // Public API
    return {
        init,
        state, // Expose state for debugging
        getApiBaseUrl,
        showError,
        showToast,
        modules // Expose modules for debugging
    };
})();

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Global error handler
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('Global error:', error);
        if (App && App.showError) {
            App.showError(`An error occurred: ${message}`, 'error');
        }
        // Don't prevent default error handling
        return false;
    };
    
    // Initialize app
    App.init().catch(error => {
        DevToolsDetector.startMonitoring();
        console.error('Failed to initialize application:', error);
        // Try to show error using vanilla JS if App initialization failed
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '20px';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translateX(-50%)';
        errorDiv.style.background = 'rgba(220,53,69,0.9)';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '10px 20px';
        errorDiv.style.borderRadius = '5px';
        errorDiv.style.zIndex = '9999';
        errorDiv.innerHTML = 'Failed to initialize application. Please refresh the page.';
        document.body.appendChild(errorDiv);
    });
});

window.App = App;