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
        onError: handleWebSocketError,
        onReconnectFailed: handleReconnectFailed
      });
      
      // Initialize the background animation
      if (typeof BackgroundAnimation !== 'undefined') {
        BackgroundAnimation.init();
      }
      
      // Load language preference from storage if available
      let storedLanguage = 'en';
      if (typeof Storage !== 'undefined' && Storage.isAvailable) {
        storedLanguage = Storage.loadLanguagePreference('en');
        if (elements.languageSelector) {
          elements.languageSelector.value = storedLanguage;
        }
      }
      
      // Initialize managers
      I18nManager.init(storedLanguage);
      PageManager.init({
        callbacks: {
          onPageChange: handlePageChange
        }
      });
      
      // Initialize controllers
      controllers.game = GameController.init({
        elements: getGameElements(),
        callbacks: {
          onGameStart: handleGameStart,
          onGameEnd: handleGameEnd,
          onRoundComplete: handleRoundComplete
        }
      });
      
      controllers.leaderboard = LeaderboardController.init({
        elements: getLeaderboardElements(),
        callbacks: {
          onPlayerSelect: handlePlayerSelect
        }
      });
      
      controllers.customGame = CustomGameController.init({
        elements: getCustomGameElements(),
        callbacks: {
          onStartCustomGame: handleStartCustomGame
        }
      });
      
      controllers.privacy = PrivacyController.init({
        elements: getPrivacyElements()
      });
      
      // Setup global event listeners
      setupEventListeners();
      
      // Register WebSocket waiting list handler
      WebSocketService.onWaitingListUpdate(controllers.game.updateWaitingList);
      
      // Fetch CSRF token for API calls
      fetchCsrfToken();
      
      // Update translations based on current language
      PageManager.updateTranslations();
      
      // Start with language selection page
      PageManager.navigateTo("language-page");
      
      // Check if nickname is stored
      if (typeof Storage !== 'undefined' && Storage.isAvailable) {
        const savedNickname = Storage.loadPlayerNickname();
        if (savedNickname && elements.nicknameInput) {
          elements.nicknameInput.value = savedNickname;
          // Trigger input event to update UI
          const event = new Event('input', { bubbles: true });
          elements.nicknameInput.dispatchEvent(event);
        }
      }
      
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
    console.log("Caching DOM elements...");
    
    // Pages
    elements.languagePage = document.getElementById("language-page");
    elements.gamePage = document.getElementById("game-page");
    elements.pongPage = document.getElementById("pong-page");
    elements.leaderboardPage = document.getElementById("leaderboard-page");
    elements.customGamePage = document.getElementById("custom-game-page");
    elements.privacyPage = document.getElementById("privacy-policy-page");
    
    // Common elements
    elements.languageSelector = document.getElementById("language-selector");
    elements.nicknameInput = document.getElementById("nickname");
    elements.roundsInput = document.getElementById("rounds-input");
    elements.startGameButton = document.getElementById("start-game");
    elements.endGameButton = document.getElementById("end-game");
    elements.prevModeButton = document.getElementById("prevMode");
    elements.nextModeButton = document.getElementById("nextMode");
    elements.pongCanvas = document.getElementById("pong-canvas");
    elements.pongStatus = document.getElementById("pong-status");
    elements.playerNameDisplay = document.getElementById("overlay-player-name");
    elements.overlayScoreDisplay = document.getElementById("overlay-score");
    elements.playerRounds = document.getElementById("player-rounds");
    elements.targetRounds = document.getElementById("target-rounds");
    elements.waitingPlayersList = document.getElementById("waiting-players-list");
    elements.leaderboardList = document.getElementById("leaderboard");
    
    // Verify required elements exist
    const requiredElements = ['languagePage', 'gamePage', 'pongPage', 'leaderboardPage'];
    const missingElements = requiredElements.filter(id => !elements[id]);
    
    if (missingElements.length > 0) {
      console.warn(`Missing some DOM elements: ${missingElements.join(', ')}`);
    }
  }
  
  /**
   * Set up application-wide event listeners
   */
  function setupEventListeners() {
    console.log("Setting up event listeners...");
    
    // Language change
    if (elements.languageSelector) {
      elements.languageSelector.addEventListener("change", () => {
        const language = elements.languageSelector.value;
        I18nManager.setLanguage(language);
        PageManager.updateTranslations();
        
        // Save language preference if storage is available
        if (typeof Storage !== 'undefined' && Storage.isAvailable) {
          Storage.saveLanguagePreference(language);
        }
      });
    }
    
    // Global navigation buttons
    const nextButton = document.getElementById('next-button');
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        PageManager.navigateTo('game-page');
      });
    }
    
    // All elements with data-navigate attribute
    document.querySelectorAll('[data-navigate]').forEach(button => {
      button.addEventListener('click', () => {
        const targetPage = button.getAttribute('data-navigate');
        PageManager.navigateTo(targetPage);
      });
    });
    
    // Nickname input to save to storage
    if (elements.nicknameInput) {
      elements.nicknameInput.addEventListener('change', () => {
        const nickname = elements.nicknameInput.value.trim();
        if (nickname && typeof Storage !== 'undefined' && Storage.isAvailable) {
          Storage.savePlayerNickname(nickname);
        }
      });
    }
    
    // Fullscreen events
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    
    // Escape key handling
    document.addEventListener('keydown', (e) => {
      // Check if the game is active and Escape key was pressed
      if (controllers.game && controllers.game.getState && 
          controllers.game.getState().gameActive && e.key === 'Escape') {
        // We want to let the fullscreen exit happen naturally,
        // but prevent immediate game end
        console.log('Escape pressed - fullscreen will exit but game continues');
      }
    });
    
    // Window resize event
    window.addEventListener('resize', Utils.debounce(() => {
      if (controllers.game && controllers.game.handleResize) {
        controllers.game.handleResize();
      }
    }, 200));
  }
  
  /**
   * Fetch CSRF token for API requests
   */
  async function fetchCsrfToken() {
    try {
      const token = await ApiService.fetchCsrfToken();
      console.log("CSRF token acquired");
      return token;
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
      nicknameInput: elements.nicknameInput,
      roundsInput: elements.roundsInput,
      startGameButton: elements.startGameButton,
      endGameButton: elements.endGameButton,
      prevModeButton: elements.prevModeButton,
      nextModeButton: elements.nextModeButton,
      pongCanvas: elements.pongCanvas,
      pongStatus: elements.pongStatus,
      playerNameDisplay: elements.playerNameDisplay,
      overlayScoreDisplay: elements.overlayScoreDisplay,
      playerRounds: elements.playerRounds,
      targetRounds: elements.targetRounds,
      playerName: document.getElementById("player-name"),
      gameInfo: document.getElementById("game-info"),
      waitingPlayersList: elements.waitingPlayersList
    };
  }
  
  /**
   * Get leaderboard-related elements for LeaderboardController
   */
  function getLeaderboardElements() {
    return {
      leaderboardList: elements.leaderboardList
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
    console.log(`WebSocket message received: ${type}`, data);
    
    switch (type) {
      case "queue_update":
        if (controllers.game && controllers.game.updateQueueStatus) {
          controllers.game.updateQueueStatus(data.message);
        }
        break;
        
      case "start_game":
        if (controllers.game && controllers.game.handleGameStart) {
          controllers.game.handleGameStart(data.rounds);
        }
        break;
        
      case "waiting_list":
        // This is handled by the callback registered with onWaitingListUpdate
        break;
        
      case "game_update":
        if (data.data && controllers.game && controllers.game.updateRemotePaddle) {
          controllers.game.updateRemotePaddle(data.data.paddleY);
        }
        break;
        
      case "game_over":
        if (controllers.game && controllers.game.handleGameOver) {
          controllers.game.handleGameOver(data.score);
        }
        break;
        
      case "opponent_left":
        if (controllers.game && controllers.game.handleOpponentLeft) {
          controllers.game.handleOpponentLeft(data.message);
        }
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
    PageManager.showToast(I18nManager.get("connectionError"), "warning");
  }
  
  /**
   * Handle WebSocket errors
   * @param {Error} error - Error object
   */
  function handleWebSocketError(error) {
    console.error("WebSocket error:", error);
    PageManager.showToast(I18nManager.get("connectionError"), "error");
  }
  
  /**
   * Handle WebSocket reconnection failure
   */
  function handleReconnectFailed() {
    console.error("WebSocket reconnection failed");
    PageManager.showToast(I18nManager.get("reconnectFailed"), "error");
  }
  
  // Event handlers
  /**
   * Handle page change event
   * @param {string} pageId - ID of the page being navigated to
   */
  function handlePageChange(pageId) {
    console.log(`Navigated to page: ${pageId}`);
    
    if (pageId === "leaderboard-page") {
      if (controllers.leaderboard && controllers.leaderboard.loadLeaderboard) {
        controllers.leaderboard.loadLeaderboard();
      }
    }
  }
  
  /**
   * Handle fullscreen change event
   */
  function handleFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement || 
                        !!document.webkitFullscreenElement || 
                        !!document.mozFullScreenElement || 
                        !!document.msFullscreenElement;
    
    console.log(`Fullscreen changed: ${isFullscreen ? 'entered' : 'exited'}`);
    
    if (controllers.game && controllers.game.handleFullscreenChange) {
      controllers.game.handleFullscreenChange(isFullscreen);
    }
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
    if (controllers.leaderboard && controllers.leaderboard.showPlayerDetails) {
      controllers.leaderboard.showPlayerDetails(playerName);
    }
  }
  
  /**
   * Handle start custom game event
   * @param {Object} settings - Custom game settings
   */
  function handleStartCustomGame(settings) {
    if (controllers.game && controllers.game.startCustomGame) {
      controllers.game.startCustomGame(settings);
    }
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