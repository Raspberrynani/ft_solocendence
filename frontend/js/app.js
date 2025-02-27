/**
 * Main Application Module
 * Initializes and coordinates all application components
 */
const App = (function() {
    // Dependencies and state
    let initialized = false;
    let controllers = {};
    
    // DOM elements cache
    const elements = {};
  
    /**
     * Initialize the application
     */
    function init() {
      if (initialized) return;
      
      console.log("Initializing application...");
      
      try {
        // Cache DOM elements
        cacheElements();
        
        // Initialize services first
        ApiService.init();
        WebSocketService.init({
          onMessage: handleWebSocketMessage,
          onConnect: handleWebSocketConnect,
          onDisconnect: handleWebSocketDisconnect,
          onError: handleWebSocketError
        });
        
        // Initialize managers
        I18nManager.init(elements.languageSelector.value);
        PageManager.init({
          onPageChange: handlePageChange
        });
        
        // Initialize controllers
        controllers.game = GameController.init({
          elements: getGameElements(),
          onGameStart: handleGameStart,
          onGameEnd: handleGameEnd,
          onRoundComplete: handleRoundComplete
        });
        
        controllers.leaderboard = LeaderboardController.init({
          elements: getLeaderboardElements(),
          onPlayerSelect: handlePlayerSelect
        });
        
        controllers.customGame = CustomGameController.init({
          elements: getCustomGameElements(),
          onStartCustomGame: handleStartCustomGame
        });
        
        controllers.privacy = PrivacyController.init({
          elements: getPrivacyElements()
        });
        
        // Set up global event listeners
        setupEventListeners();
        
        // Fetch CSRF token for API calls
        fetchCsrfToken();
        
        // Start with language selection page
        PageManager.navigateTo("language-page");
        
        initialized = true;
        console.log("Application initialized successfully");
      } catch (error) {
        console.error("Failed to initialize application:", error);
        showErrorMessage("Failed to initialize application. Please refresh the page.");
      }
    }
    
    /**
     * Cache all DOM elements used throughout the application
     */
    function cacheElements() {
      // Pages
      elements.languagePage = document.getElementById("language-page");
      elements.gamePage = document.getElementById("game-page");
      elements.pongPage = document.getElementById("pong-page");
      elements.leaderboardPage = document.getElementById("leaderboard-page");
      elements.customGamePage = document.getElementById("custom-game-page");
      elements.privacyPage = document.getElementById("privacy-policy-page");
      
      // Common elements
      elements.languageSelector = document.getElementById("language-selector");
      
      // Verify required elements exist
      const requiredElements = ['languagePage', 'gamePage', 'pongPage', 'leaderboardPage'];
      const missingElements = requiredElements.filter(id => !elements[id]);
      
      if (missingElements.length > 0) {
        throw new Error(`Missing required DOM elements: ${missingElements.join(', ')}`);
      }
    }
    
    /**
     * Set up application-wide event listeners
     */
    function setupEventListeners() {
      // Language change
      elements.languageSelector.addEventListener("change", () => {
        const language = elements.languageSelector.value;
        I18nManager.setLanguage(language);
        PageManager.updateTranslations();
      });
      
      // Global navigation buttons
      document.getElementById('next-button').addEventListener('click', () => {
        PageManager.navigateTo('game-page');
      });
      
      // All elements with data-navigate attribute
      document.querySelectorAll('[data-navigate]').forEach(button => {
        button.addEventListener('click', () => {
          PageManager.navigateTo(button.getAttribute('data-navigate'));
        });
      });
      
      // Fullscreen events
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.addEventListener("mozfullscreenchange", handleFullscreenChange);
      document.addEventListener("MSFullscreenChange", handleFullscreenChange);
      
      // Add any other global event listeners here
    }
    
    /**
     * Fetch CSRF token for API requests
     */
    async function fetchCsrfToken() {
      try {
        const response = await fetch('/api/csrf/');
        const data = await response.json();
        document.cookie = `csrftoken=${data.csrfToken}; path=/`;
        console.log("CSRF token acquired");
        return data.csrfToken;
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        return null;
      }
    }
    
    /**
     * Get game-related elements for GameController
     */
    function getGameElements() {
      return {
        nicknameInput: document.getElementById("nickname"),
        roundsInput: document.getElementById("rounds-input"),
        startGameButton: document.getElementById("start-game"),
        endGameButton: document.getElementById("end-game"),
        prevModeButton: document.getElementById("prevMode"),
        nextModeButton: document.getElementById("nextMode"),
        pongCanvas: document.getElementById("pong-canvas"),
        pongStatus: document.getElementById("pong-status"),
        playerNameDisplay: document.getElementById("overlay-player-name"),
        overlayScoreDisplay: document.getElementById("overlay-score"),
        waitingPlayersList: document.getElementById("waiting-players-list")
      };
    }
    
    /**
     * Get leaderboard-related elements for LeaderboardController
     */
    function getLeaderboardElements() {
      return {
        leaderboardList: document.getElementById("leaderboard")
      };
    }
    
    /**
     * Get custom game elements for CustomGameController
     */
    function getCustomGameElements() {
      return {
        ballSpeed: document.getElementById("ball-speed"),
        ballSpeedValue: document.getElementById("ball-speed-value"),
        paddleSize: document.getElementById("paddle-size"),
        paddleSizeValue: document.getElementById("paddle-size-value"),
        speedIncrement: document.getElementById("speed-increment"),
        speedIncrementValue: document.getElementById("speed-increment-value"),
        ballColor: document.getElementById("ball-color"),
        leftPaddleColor: document.getElementById("left-paddle-color"),
        rightPaddleColor: document.getElementById("right-paddle-color"),
        gravityEnabled: document.getElementById("gravity-enabled"),
        bounceRandom: document.getElementById("bounce-random"),
        gameCode: document.getElementById("game-code"),
        applyCode: document.getElementById("apply-code"),
        generateCode: document.getElementById("generate-code"),
        copyCode: document.getElementById("copy-code"),
        startCustomGame: document.getElementById("start-custom-game")
      };
    }
    
    /**
     * Get privacy-related elements for PrivacyController
     */
    function getPrivacyElements() {
      return {
        deleteNickname: document.getElementById("delete-nickname"),
        verificationInput: document.getElementById("verification-input"),
        verificationCode: document.getElementById("verification-code"),
        generateVerification: document.getElementById("generate-verification"),
        confirmDelete: document.getElementById("confirm-delete"),
        deleteResult: document.getElementById("delete-result"),
        verificationSection: document.getElementById("verification-section")
      };
    }
    
    // WebSocket event handlers
    /**
     * Handle WebSocket messages
     * @param {Object} data - Message data
     * @param {string} type - Message type
     */
    function handleWebSocketMessage(data, type) {
      switch (type) {
        case "queue_update":
          controllers.game.updateQueueStatus(data.message);
          break;
          
        case "start_game":
          controllers.game.handleGameStart(data.rounds);
          break;
          
        case "waiting_list":
          controllers.game.updateWaitingList(data.waiting_list);
          break;
          
        case "game_update":
          if (data.data) {
            controllers.game.updateRemotePaddle(data.data.paddleY);
          }
          break;
          
        case "game_over":
          controllers.game.handleGameOver(data.score);
          break;
          
        case "opponent_left":
          controllers.game.handleOpponentLeft(data.message);
          break;
          
        default:
          console.warn("Unknown message type:", type);
      }
    }
    
    /**
     * Handle WebSocket connection event
     */
    function handleWebSocketConnect() {
      console.log("WebSocket connected to server");
    }
    
    /**
     * Handle WebSocket disconnection
     */
    function handleWebSocketDisconnect() {
      console.log("WebSocket disconnected from server");
      Utils.showToast(I18nManager.get("connectionError"), "warning");
    }
    
    /**
     * Handle WebSocket errors
     * @param {Error} error - Error object
     */
    function handleWebSocketError(error) {
      console.error("WebSocket error:", error);
      Utils.showToast(I18nManager.get("connectionError"), "error");
    }
    
    // Event handlers
    /**
     * Handle page change event
     * @param {string} pageId - ID of the page being navigated to
     */
    function handlePageChange(pageId) {
      if (pageId === "leaderboard-page") {
        controllers.leaderboard.loadLeaderboard();
      }
    }
    
    /**
     * Handle fullscreen change event
     */
    function handleFullscreenChange() {
      controllers.game.handleFullscreenChange(
        !!document.fullscreenElement || 
        !!document.webkitFullscreenElement || 
        !!document.mozFullScreenElement || 
        !!document.msFullscreenElement
      );
    }
    
    /**
     * Handle game start event
     */
    function handleGameStart() {
      console.log("Game started");
    }
    
    /**
     * Handle game end event
     * @param {Object} result - Game result data
     */
    function handleGameEnd(result) {
      console.log("Game ended", result);
      
      // Navigate to leaderboard after game ends
      PageManager.navigateTo("leaderboard-page");
    }
    
    /**
     * Handle round complete event
     * @param {number} round - Current round number
     */
    function handleRoundComplete(round) {
      console.log("Round completed:", round);
    }
    
    /**
     * Handle player selection from leaderboard
     * @param {string} playerName - Selected player name
     */
    function handlePlayerSelect(playerName) {
      controllers.leaderboard.showPlayerDetails(playerName);
    }
    
    /**
     * Handle start custom game event
     * @param {Object} settings - Custom game settings
     */
    function handleStartCustomGame(settings) {
      controllers.game.startCustomGame(settings);
    }
    
    /**
     * Show application error message
     * @param {string} message - Error message
     */
    function showErrorMessage(message) {
      const errorElement = document.createElement('div');
      errorElement.className = 'app-error alert alert-danger';
      errorElement.textContent = message;
      errorElement.style.position = 'fixed';
      errorElement.style.top = '10px';
      errorElement.style.left = '50%';
      errorElement.style.transform = 'translateX(-50%)';
      errorElement.style.zIndex = '9999';
      document.body.appendChild(errorElement);
    }
    
    // Public API
    return {
      init,
      getController(name) {
        return controllers[name];
      }
    };
  })();
  
  // Initialize the application when DOM is ready
  document.addEventListener("DOMContentLoaded", App.init);