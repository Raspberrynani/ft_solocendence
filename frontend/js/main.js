/**
 * Main application entry point
 * Initializes and coordinates game modules
 */

async function fetchCsrfToken() {
  try {
    const response = await fetch('/api/csrf/');
    const data = await response.json();
    document.cookie = `csrftoken=${data.csrfToken}; path=/`;
    return data.csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetchCsrfToken();
  // Ensure cookies have secure attributes when on HTTPS
  
  // Activate only the language page
  const languagePage = document.getElementById("language-page");
  if (languagePage) {
    languagePage.classList.add("active");
  }
  
  // Check if the privacy page has the "active" class in the HTML
  const privacyPage = document.getElementById("privacy-policy-page");
  if (privacyPage && privacyPage.classList.contains("active")) {
    // Remove the active class from the HTML
    privacyPage.classList.remove("active");
    console.log("Removed active class from privacy policy page");
  }

  function setupSecureCookies() {
    if (window.location.protocol === 'https:') {
      document.cookie = "secureOnly=true; secure; SameSite=Strict";
    }
  }
  
  // Setup secure cookies
  setupSecureCookies();


  // -----------------------------
  // DevTools Detection & Fair Play Warning
  // -----------------------------
  
  // Create the warning overlay element
  function createFairPlayWarning() {
    const warning = document.createElement('div');
    warning.className = 'fair-play-warning';
    warning.innerHTML = `
      <h2>⚠️ Fair Play Warning ⚠️</h2>
      <p>We've detected that you may be attempting to inspect or modify the game.</p>
      <p>Tampering with game code violates fair play principles and may affect other players' experience.</p>
      <button>I understand - Continue Playing</button>
    `;
    
    // Add click handler to dismiss
    warning.addEventListener('click', () => {
      warning.remove();
    });
    
    return warning;
  }
  
  // Show the fair play warning
  function showFairPlayWarning() {
    // Only show if not already displayed
    if (!document.querySelector('.fair-play-warning')) {
      document.body.appendChild(createFairPlayWarning());
    }
  }
  
  // DevTools detection methods
  let devToolsTimeout;
  let isDevToolsOpen = false;
  
  // Method 1: Console overriding detection
  const devToolsDetector = () => {
    const timestamp = new Date().getTime();
    debugger; // This will pause execution in DevTools
    if (new Date().getTime() - timestamp > 100) {
      // If execution took too long, DevTools is likely open
      showFairPlayWarning();
      return true;
    }
    return false;
  };
  
  // Method 2: Window size change detection
  function checkWindowChanges() {
    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      if (!isDevToolsOpen) {
        isDevToolsOpen = true;
        showFairPlayWarning();
      }
    } else {
      isDevToolsOpen = false;
    }
  }
  
  // Method 3: DevTools orientation detection
  function orientationChange() {
    // Wait for resize to complete
    clearTimeout(devToolsTimeout);
    devToolsTimeout = setTimeout(checkWindowChanges, 100);
  }
  
  // Set up event listeners for DevTools detection
  window.addEventListener('resize', orientationChange);
  
  // Run periodic check during gameplay
  function setupDevToolsChecks() {
    if (appState && appState.gameActive) {
      // Only run checks during active gameplay
      if (!devToolsDetector()) {
        checkWindowChanges();
      }
      setTimeout(setupDevToolsChecks, 1000); // Check every second
    }
  }
  
  // -----------------------------
  // 1) Grab UI elements up front
  // -----------------------------
  const elements = {
    // Pages
    languagePage: document.getElementById("language-page"),
    gamePage: document.getElementById("game-page"),
    pongPage: document.getElementById("pong-page"),
    leaderboardPage: document.getElementById("leaderboard-page"),
    
    // Form inputs and buttons
    languageSelector: document.getElementById("language-selector"),
    nicknameInput: document.getElementById("nickname"),
    roundsInput: document.getElementById("rounds-input"),
    startGameButton: document.getElementById("start-game"),
    endGameButton: document.getElementById("end-game"),
    prevModeButton: document.getElementById("prevMode"),
    nextModeButton: document.getElementById("nextMode"),
    
    // Game elements
    pongCanvas: document.getElementById("pong-canvas"),
    pongStatus: document.getElementById("pong-status"),
    playerNameDisplay: document.getElementById("overlay-player-name"),
    overlayScoreDisplay: document.getElementById("overlay-score"),
    playerRounds: document.getElementById("player-rounds"),
    targetRounds: document.getElementById("target-rounds"),
    gameInfo: document.getElementById("game-info"),
    playerName: document.getElementById("player-name"),
    
    // Lists
    leaderboardList: document.getElementById("leaderboard"),
    waitingPlayersList: document.getElementById("waiting-players-list"),

    // Custom game elements
    customGamePage: document.getElementById("custom-game-page"),
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
    startCustomGame: document.getElementById("start-custom-game"),
    playerStatsDashboard: document.getElementById("player-stats-dashboard"),

    // Tournament elements
    createTournament: document.getElementById("create-tournament"),
    startTournament: document.getElementById("start-tournament"),
    leaveTournament: document.getElementById("leave-tournament"),
    activeTournament: document.getElementById("active-tournament"),
    tournamentName: document.getElementById("tournament-name"),
    tournamentPlayers: document.getElementById("tournament-players"),
    currentMatch: document.getElementById("current-match"),
    upcomingMatches: document.getElementById("upcoming-matches"),
    completedMatches: document.getElementById("completed-matches"),
    availableTournaments: document.getElementById("available-tournaments"),
    tournamentList: document.getElementById("tournament-list"),
  };
  
  CustomGameManager.init(elements);

  function getApiBaseUrl() {
    // Use the same protocol and host as the current page
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
  }
  
  // Application state
  const appState = {
    nickname: "",
    token: "",
    currentGameModeIndex: 0,
    isMultiplayer: false,
    isFullscreen: false,
    roundsPlayed: 0,
    targetRounds: 3,
    gameOverHandled: false,
    gameActive: false, // Track if game is currently active
    isTournamentGame: false // Track if current game is part of a tournament
  };
  
  // Available game modes
  const gameModes = ["Classic with queue", "Classic with AI", "Tournament", "Custom Game"];
  
  // -----------------------------
  // 2) Initialize modules
  // -----------------------------
  
  // Initialize UI Manager
  UIManager.init({
    elements,
    callbacks: {
      onPageChange: handlePageChange,
      onLanguageChange: handleLanguageChange
    }
  });
  
  // Initialize websocket with callbacks
  WebSocketManager.init({
    onConnect: handleSocketConnect,
    onDisconnect: handleSocketDisconnect,
    onError: handleSocketError,
    onReconnectFailed: handleReconnectFailed,
    onQueueUpdate: handleQueueUpdate,
    onGameStart: handleGameStart,
    onGameUpdate: handleGameUpdate,
    onGameOver: handleGameOver,
    onOpponentLeft: handleOpponentLeft
  });
  
  // Register for waiting list updates
  WebSocketManager.onWaitingListUpdate(updateWaitingList);
  
  // Initialize localization
  LocalizationManager.init(elements.languageSelector.value);
  
  // -----------------------------
  // 3) Setup event listeners
  // -----------------------------
  
  // Language selector
  elements.languageSelector.addEventListener("change", () => {
    LocalizationManager.setLanguage(elements.languageSelector.value);
    UIManager.updateTranslations();
  });
  
  // Nickname input
  elements.nicknameInput.addEventListener("input", () => {
    UIManager.toggleStartButton(elements.nicknameInput.value.trim().length > 0);
  });
  
  function addPrivacyPolicyButton() {
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
      console.error("Could not find leaderboard button to insert privacy policy button");
      // Fallback - add to game page
      const gamePage = document.getElementById('game-page');
      if (gamePage) {
        gamePage.appendChild(privacyButton);
      }
    }
    
    // Add event listener for navigation
    privacyButton.addEventListener('click', function() {
      UIManager.navigateTo('privacy-policy-page');
    });
  }
  
  // Call the function to add the button
  addPrivacyPolicyButton();
  
  // Also make back button work
  const privacyBackButton = document.getElementById('privacy-back-button');
  if (privacyBackButton) {
    privacyBackButton.addEventListener('click', function() {
      UIManager.navigateTo('game-page');
    });
  } else {
    console.warn("Privacy back button not found in DOM");
  }

  function setupNavigationButtons() {
    // Handle all elements with data-navigate attribute
    document.querySelectorAll('[data-navigate]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = button.getAttribute('data-navigate');
        UIManager.navigateTo(targetPage);
      });
    });
    
    // Handle special navigation buttons without data attributes if needed
    const nextButton = document.getElementById('next-button');
    if (nextButton) {
      nextButton.addEventListener('click', (e) => {
        e.preventDefault();
        UIManager.navigateTo('game-page');
      });
    }
  }

  setupNavigationButtons();

  // Find and fix all other navigation buttons
  document.querySelectorAll('[data-navigate]').forEach(button => {
    button.addEventListener('click', () => {
      UIManager.navigateTo(button.getAttribute('data-navigate'));
    });
  });

  // Game mode selection
  elements.prevModeButton.addEventListener("click", () => {
    appState.currentGameModeIndex = (appState.currentGameModeIndex - 1 + gameModes.length) % gameModes.length;
    updateGameModeIndicator();
  });
  
  elements.nextModeButton.addEventListener("click", () => {
    appState.currentGameModeIndex = (appState.currentGameModeIndex + 1) % gameModes.length;
    updateGameModeIndicator();
  });
  
  // Start game button
  elements.startGameButton.addEventListener("click", handleStartGame);
  
  // End game button
  elements.endGameButton.addEventListener("click", endPongGame);
  
  // Tournament buttons (if they exist)
  function initializeTournamentManager(nickname) {
    console.log("Attempting to initialize TournamentManager...");
    
    if (typeof window.TournamentManager === 'undefined') {
      console.error("TournamentManager is not loaded. Attempting to diagnose issue.");
      
      // Additional diagnostic logging
      const requiredScripts = [
        'utils.js', 
        'websocket.js', 
        'tournament-manager.js'
      ];
      
      requiredScripts.forEach(script => {
        const scriptElement = document.querySelector(`script[src*="${script}"]`);
        if (scriptElement) {
          console.log(`${script} is present in the document`);
        } else {
          console.error(`${script} MISSING from document`);
        }
      });
      
      // Fallback error display
      Utils.showAlert("Tournament functionality is currently unavailable. Please refresh the page or check your browser's console.", "error");
      return false;
    }
  
    try {
      console.log("Initializing TournamentManager with elements:", elements);
      window.TournamentManager.init(elements, nickname);
      return true;
    } catch (error) {
      console.error("Error initializing TournamentManager:", error);
      Utils.showAlert("Failed to initialize tournaments. Please try again.", "error");
      return false;
    }
  }
  
  // Modify the tournament creation handling in your existing code
  if (elements.createTournament) {
    elements.createTournament.addEventListener('click', () => {
      const nickname = elements.nicknameInput.value.trim();
      
      if (!nickname) {
        Utils.showAlert("Please enter your nickname first");
        return;
      }
  
      // Use the new initialization method
      if (initializeTournamentManager(nickname)) {
        // If initialization succeeds, send tournament creation request
        const rounds = parseInt(elements.roundsInput.value) || 3;
        
        console.log("Creating tournament with rounds:", rounds);
        
        if (WebSocketManager.isConnected()) {
          WebSocketManager.send({
            type: "create_tournament",
            nickname: nickname,
            name: `${nickname}'s Tournament`,
            rounds: rounds
          });
        } else {
          Utils.showAlert("Cannot create tournament: Not connected to server");
        }
      }
    });
  }
  
  if (elements.startTournament) {
    elements.startTournament.addEventListener('click', () => {
      if (window.TournamentManager && window.TournamentManager.getCurrentTournamentId()) {
        WebSocketManager.send({
          type: "start_tournament",
          tournament_id: window.TournamentManager.getCurrentTournamentId()
        });
      } else {
        Utils.showAlert("No active tournament");
      }
    });
  }
  
  if (elements.leaveTournament) {
    elements.leaveTournament.addEventListener('click', () => {
      if (window.TournamentManager && window.TournamentManager.isInTournament()) {
        WebSocketManager.send({
          type: "leave_tournament"
        });
        window.TournamentManager.resetTournamentState();
      } else {
        Utils.showAlert("No active tournament");
      }
    });
  }
  
  // Fullscreen change handler
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleFullscreenChange);
  document.addEventListener("MSFullscreenChange", handleFullscreenChange);
  
  // Prevent Escape key from ending the game
  document.addEventListener('keydown', (e) => {
    // Check if the game is active and Escape key was pressed
    if (appState.gameActive && e.key === 'Escape') {
      // We want to let the fullscreen exit happen naturally,
      // but we'll prevent the game from ending due to ESC
      console.log('Escape pressed - fullscreen will exit but game continues');
      
      // We don't preventDefault() because we want to allow the 
      // fullscreen exit, but we do need to handle the transition gracefully
    }
  });
  
  // Canvas click for fullscreen
  elements.pongCanvas.addEventListener("click", () => {
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement &&
        !document.mozFullScreenElement &&
        !document.msFullscreenElement) {
      enterFullscreen(elements.pongCanvas);
    }
  });
  
  // -----------------------------
  // 4) Handler functions
  // -----------------------------
  
  /**
   * Validate user input
   * @param {string} nickname - User's nickname
   * @param {string|number} rounds - Number of rounds
   * @returns {boolean} - Whether input is valid
   */
  function validateInput(nickname, rounds) {
    if (!nickname || nickname.trim().length === 0) {
      Utils.showAlert(LocalizationManager.get("nicknameRequired"));
      return false;
    }
    
    // More thorough nickname validation (alphanumeric + some special chars)
    const validNickname = /^[A-Za-z0-9_-]{1,16}$/;
    if (!validNickname.test(nickname)) {
      Utils.showAlert("Nickname must be 1-16 characters with only letters, numbers, underscore or hyphen.");
      return false;
    }
    
    // Validate rounds as number within range
    const roundsNum = parseInt(rounds);
    if (isNaN(roundsNum) || roundsNum < 1 || roundsNum > 20) {
      Utils.showAlert("Rounds must be a number between 1 and 20.");
      return false;
    }
    
    return true;
  }
  
  /**
   * Handle page change events
   * @param {string} pageId - ID of the target page
   */
  function handlePageChange(pageId) {
    if (pageId === "leaderboard-page") {
      updateLeaderboard();
    }
  }
  
  /**
   * Handle language changes
   * @param {string} language - Selected language code
   */
  function handleLanguageChange(language) {
    // Update any language-specific elements
  }
  
  /**
   * Handle WebSocket connection event
   */
  function handleSocketConnect() {
    console.log("WebSocket connected to server");
  }
  
  /**
   * Handle WebSocket disconnection
   */
  function handleSocketDisconnect() {
    console.log("WebSocket disconnected from server");
    Utils.showToast(LocalizationManager.get("connectionError"), "warning");
  }
  
  /**
   * Handle WebSocket errors
   * @param {Error} error - Error object
   */
  function handleSocketError(error) {
    console.error("WebSocket error:", error);
    Utils.showToast(LocalizationManager.get("connectionError"), "error");
  }
  
  /**
   * Handle failed reconnection attempts
   */
  function handleReconnectFailed() {
    Utils.showToast(LocalizationManager.get("reconnectFailed"), "error");
  }
  
  /**
   * Handle queue update messages
   * @param {string} message - Queue update message
   */
  function handleQueueUpdate(message) {
    elements.pongStatus.innerText = message;
  }
  
  /**
   * Handle game start event
   * @param {number} rounds - Number of rounds for the game
   * @param {boolean} isTournament - Whether this is a tournament game
   * @param {string} gameRoom - Game room identifier from server
   */
  function handleGameStart(rounds, isTournament = false, gameRoom = null) {
    console.log(`Game start handler: rounds=${rounds}, isTournament=${isTournament}, room=${gameRoom}`);
    
    // Clear status
    elements.pongStatus.innerText = "";
    
    // Set rounds
    if (rounds) {
      appState.targetRounds = rounds;
      elements.targetRounds.innerText = rounds;
    }
    
    // Set tournament game flag
    appState.isTournamentGame = isTournament;
    
    // IMPORTANT: For tournament games, ALWAYS ensure multiplayer is enabled
    if (isTournament) {
      console.log("Tournament game starting - enabling multiplayer mode");
      appState.isMultiplayer = true;
      
      // Set a tournament status message
      elements.pongStatus.innerText = "Tournament Match Starting...";
    }
    
    // Store game room info if provided
    if (gameRoom) {
      appState.currentGameRoom = gameRoom;
    }
    
    // Reset game state
    appState.gameOverHandled = false;
    appState.roundsPlayed = 0;
    
    // Update UI with player info
    elements.playerNameDisplay.innerText = Utils.sanitizeHTML(appState.nickname);
    elements.playerName.innerText = Utils.sanitizeHTML(appState.nickname);
    elements.overlayScoreDisplay.innerText = appState.roundsPlayed;
    elements.playerRounds.innerText = appState.roundsPlayed;
    
    // Navigate to game page if not already there
    if (!document.getElementById('pong-page').classList.contains('active')) {
      UIManager.navigateTo("pong-page");
    }
    
    // Start the game with a slight delay to allow UI to update
    setTimeout(() => {
      console.log("Starting pong game...");
      startPongGame();
    }, 100);
  }
  /**
   * Handle game updates from opponent
   * @param {Object} data - Game update data
   */
  function handleGameUpdate(data) {
    if (!data) return;
    
    // Handle paddle position updates
    if (data.paddleY !== undefined) {
      console.log(`Received remote paddle update: Y=${data.paddleY}`);
      
      // Ensure PongGame is initialized
      if (PongGame && typeof PongGame.updateRemotePaddle === 'function') {
        PongGame.updateRemotePaddle(data.paddleY);
      } else {
        console.warn("PongGame not initialized, can't update paddle");
      }
    }
    
    // Handle any other game state updates
    // (future expansion point)
  }
  
    /**
   * Handle game over event
   * @param {number} score - Final score
   */
  function handleGameOver(score) {
    console.log(`handleGameOver called: score=${score}, rounds=${appState.roundsPlayed}, target=${appState.targetRounds}, already handled=${appState.gameOverHandled}`);
    
    // Check if this is a valid game over condition
    const isGameOver = appState.roundsPlayed >= appState.targetRounds || score >= appState.targetRounds / 2;
    
    if (!appState.gameOverHandled && isGameOver) {
      console.log("Game is over - processing end game logic");
      appState.gameOverHandled = true;
      appState.gameActive = false; // Game is no longer active
      
      // If this is a tournament game, handle it differently
      if (appState.isTournamentGame) {
        console.log("Tournament game over - notifying server and returning to tournament view");
        
        // Send game over to WebSocket to notify tournament system
        WebSocketManager.sendGameOver(appState.roundsPlayed);
        
        // Stop the game 
        PongGame.stop();
        
        // Exit fullscreen if active
        exitFullscreen();
        
        // Navigate back to game page where tournament UI is
        setTimeout(() => {
          // Show an informative toast
          Utils.showToast("Tournament match completed! Waiting for next match...", "info");
          
          UIManager.navigateTo("game-page");
        }, 500);
      } else {
        console.log("Regular game over - ending game");
        endPongGame();
      }
    } else if (appState.gameOverHandled) {
      console.log("Game over already handled - ignoring");
    } else {
      console.log("Not enough rounds for game over - continuing");
    }
  }
    
  /**
   * Handle fullscreen changes
   */
  function handleFullscreenChange() {
    // Detect if we're in fullscreen mode
    appState.isFullscreen = !!document.fullscreenElement || 
                           !!document.webkitFullscreenElement || 
                           !!document.mozFullScreenElement || 
                           !!document.msFullscreenElement;
    
    console.log("Fullscreen changed:", appState.isFullscreen ? "entered fullscreen" : "exited fullscreen");
    
    if (appState.isFullscreen) {
      showGameInfo(false);
    } else {
      showGameInfo(true);
    }
    
    // Important: Don't end the game when exiting fullscreen
    // Just update the UI state and continue
  }
  
  /**
   * Handle opponent leaving the game
   * @param {string} message - Message about opponent leaving
   */
  function handleOpponentLeft(message) {
    appState.gameActive = false; // Game is no longer active
    Utils.showAlert(message);
    
    // If this is a tournament game and we're in a tournament, go back to tournament view
    if (appState.isTournamentGame && window.TournamentManager && window.TournamentManager.isInTournament()) {
      UIManager.navigateTo("game-page");
    } else {
      UIManager.navigateTo("game-page");
    }
  }
  
  /**
   * Update the waiting list UI
   * @param {Array} waitingList - List of waiting players
   */
  function updateWaitingList(waitingList) {
    console.log("Updating waiting list UI with:", waitingList);
    elements.waitingPlayersList.innerHTML = "";

    if (!waitingList || waitingList.length === 0) {
      const li = document.createElement("li");
      li.innerText = LocalizationManager.get("noPlayersWaiting");
      li.classList.add("no-players");
      elements.waitingPlayersList.appendChild(li);
      return;
    }

    waitingList.forEach(player => {
      const li = document.createElement("li");
      li.className = "list-group-item clickable-player";
      li.innerHTML = `<span class="player-name">${Utils.sanitizeHTML(player.nickname)}</span> <span class="player-rounds">(${LocalizationManager.get("rounds")}: ${player.rounds})</span>`;
      
      // Add click handler
      li.onclick = function() {
        console.log("Player clicked:", player);
        
        // Set rounds and update UI
        elements.roundsInput.value = player.rounds;
        appState.currentGameModeIndex = 0; // Set to "Classic with queue"
        updateGameModeIndicator();
        
        // Highlight rounds input
        elements.roundsInput.classList.add("highlight-input");
        setTimeout(() => {
          elements.roundsInput.classList.remove("highlight-input");
        }, 1000);
        
        // Focus on appropriate element
        if (elements.nicknameInput.value.trim().length > 0) {
          if (!elements.startGameButton.classList.contains("hidden")) {
            elements.startGameButton.classList.add("pulse");
            setTimeout(() => {
              elements.startGameButton.classList.remove("pulse");
            }, 1500);
          }
        } else {
          elements.nicknameInput.focus();
        }
      };
      
      elements.waitingPlayersList.appendChild(li);
    });
  }
  
  /**
   * Update the game mode indicator text
   */
  function updateGameModeIndicator() {
    document.querySelector(".game-mode-indicator").innerText = gameModes[appState.currentGameModeIndex];
  }
  
  /**
   * Show/hide the small game info display
   * @param {boolean} showSmall - Whether to show the small info
   */
  function showGameInfo(showSmall) {
    if (showSmall) {
      elements.gameInfo.classList.add("visible");
    } else {
      elements.gameInfo.classList.remove("visible");
    }
  }
  
  /**
   * Handle start game button click
   */
  function handleStartGame() {
    const nickname = elements.nicknameInput.value.trim();
    const rounds = elements.roundsInput.value;
    
    if (devToolsDetector()) {
      showFairPlayWarning();
    }
  
    if (!validateInput(nickname, rounds)) {
      return;
    }
    
    // Store game info
    appState.nickname = nickname;
    appState.token = Utils.generateToken();
    appState.roundsPlayed = 0;
    appState.targetRounds = parseInt(rounds) || 3;
    
    // Update UI with sanitized values
    elements.playerNameDisplay.innerText = Utils.sanitizeHTML(nickname);
    elements.playerName.innerText = Utils.sanitizeHTML(nickname);
    elements.overlayScoreDisplay.innerText = appState.roundsPlayed;
    elements.playerRounds.innerText = appState.roundsPlayed;
    elements.targetRounds.innerText = appState.targetRounds;
    
    // Get selected game mode
    const selectedMode = gameModes[appState.currentGameModeIndex];
    
    // Handle different game modes using UIManager for navigation
    // In handleStartGame function, when Tournament mode is selected:
if (selectedMode === "Tournament") {
  // Check if TournamentManager exists
  if (!window.TournamentManager) {
    console.error("TournamentManager not found! Make sure tournament-manager.js is loaded.");
    Utils.showAlert("Tournament functionality unavailable. Please try again later.");
    return;
  }
  
  console.log("Initializing Tournament Manager...");
  // Initialize Tournament Manager with proper elements and nickname
  window.TournamentManager.init(elements, nickname);
  
  // Navigate to game page
  UIManager.navigateTo("game-page");
  
  // Make sure tournament sections are visible
  if (elements.availableTournaments) {
    elements.availableTournaments.style.display = 'block';
  }
  
  // Request latest tournament list
  if (WebSocketManager.isConnected()) {
    console.log("Requesting tournament list...");
    WebSocketManager.send({
      type: "get_tournaments"
    });
  } else {
    Utils.showAlert(LocalizationManager.get("connectionError"));
  }
} else if (selectedMode === "Custom Game") {
      // Navigate to custom game page instead of starting game
      UIManager.navigateTo("custom-game-page");
    } else if (selectedMode === "Classic with AI") {
      appState.isMultiplayer = false;
      UIManager.navigateTo("pong-page");
      elements.pongStatus.innerText = LocalizationManager.get("aiMode");
      startPongGame();
    } else if (selectedMode === "Classic with queue") {
      appState.isMultiplayer = true;
      
      // Join queue via WebSocket
      if (WebSocketManager.isConnected()) {
        WebSocketManager.joinQueue(
          appState.nickname,
          appState.token,
          appState.targetRounds
        );
        UIManager.navigateTo("pong-page");
        elements.pongStatus.innerText = LocalizationManager.get("waitingQueue");
      } else {
        Utils.showAlert(LocalizationManager.get("connectionError"));
      }
    }
  }
  
  // Add event listener for Start Custom Game button
  elements.startCustomGame.addEventListener("click", function() {
    appState.isMultiplayer = false; // Custom games are single player for now
    
    // Get custom settings
    const customSettings = CustomGameManager.getSettings();
    
    // Navigate to pong page
    UIManager.navigateTo("pong-page");
    elements.pongStatus.innerText = "Custom Game Mode";
    
    // Start game with custom settings
    startCustomGameWithSettings(customSettings);
  });
  
  function startCustomGameWithSettings(customSettings) {
    // Set game as active
    appState.gameActive = true;
    
    // Reset game state
    appState.gameOverHandled = false;
    appState.roundsPlayed = 0;
    
    // Update UI
    elements.endGameButton.classList.remove("hidden");
    elements.playerRounds.innerText = appState.roundsPlayed;
    
    // Setup canvas styling
    elements.pongCanvas.style.width = '100%';
    elements.pongCanvas.style.height = 'auto';
    elements.pongCanvas.classList.remove("crt-zoom");
    
    // Try to enter fullscreen
    enterFullscreen(elements.pongCanvas);
    
    // Allow a short delay for fullscreen to complete
    setTimeout(() => {
      // Initialize and start game with custom settings
      PongGame.init({
        canvasId: 'pong-canvas',
        isMultiplayer: appState.isMultiplayer,
        nickname: appState.nickname,
        token: appState.token,
        rounds: appState.targetRounds,
        // Add custom settings
        initialBallSpeed: customSettings.ballSpeed,
        speedIncrement: customSettings.speedIncrement,
        paddleSizeMultiplier: customSettings.paddleSize,
        ballColor: customSettings.ballColor,
        leftPaddleColor: customSettings.leftPaddleColor,
        rightPaddleColor: customSettings.rightPaddleColor,
        gravityEnabled: customSettings.gravityEnabled,
        bounceRandom: customSettings.bounceRandom,
        // Callbacks
        callbacks: {
          onRoundComplete: (roundsPlayed) => {
            appState.roundsPlayed = roundsPlayed;
            elements.overlayScoreDisplay.innerText = roundsPlayed;
            elements.playerRounds.innerText = roundsPlayed;
          },
          onGameOver: (score) => {
            handleGameOver(score);
          },
          onPaddleMove: (paddleY) => {
            // Send paddle position to server in multiplayer mode
            if (appState.isMultiplayer) {
              WebSocketManager.sendPaddleUpdate(paddleY);
            }
          },
          onFullscreenChange: (isFullscreen) => {
            // Update control enabled state based on fullscreen
          }
        }
      });
      
      PongGame.start();
      
      // Apply "CRT zoom" effect for visual flair
      void elements.pongCanvas.offsetWidth; // Force reflow
      elements.pongCanvas.classList.add("crt-zoom");
    }, 100);
  }

  /**
   * Fetch and update the leaderboard
   */
  async function updateLeaderboard() {
    try {
      Utils.showLoading(elements.leaderboardList);
      
      const apiUrl = `${getApiBaseUrl()}/entries/`;
      console.log("Fetching leaderboard from:", apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      elements.leaderboardList.innerHTML = "";
      
      if (!data.entries || data.entries.length === 0) {
        const li = document.createElement("li");
        li.innerText = "No entries yet";
        elements.leaderboardList.appendChild(li);
        return;
      }
      
      // Sort entries by wins
      data.entries.sort((a, b) => b.wins - a.wins);
      
      // Add a title/header for the leaderboard
      const header = document.createElement("li");
      header.className = "leaderboard-header";
      header.innerHTML = `
        <div class="d-flex justify-content-between w-100 py-2">
          <span><strong>Player</strong></span>
          <span><strong>Stats</strong></span>
        </div>
      `;
      elements.leaderboardList.appendChild(header);
      
      // Create player entries
      data.entries.forEach((entry, index) => {
        const li = document.createElement("li");
        li.classList.add(`rank-${entry.rank}`);
        
        // Add 'top3' class for the top 3 players
        if (index < 3) {
          li.classList.add(`top-${index + 1}`);
        }
        
        // Calculate win/loss ratio visual indicator width
        const winRatioWidth = Math.max(5, entry.win_ratio); // Min 5% for visibility
        
        li.innerHTML = `
          <div class="d-flex justify-content-between w-100 align-items-center">
            <span class="player-name" data-player="${Utils.sanitizeHTML(entry.name)}">
              ${index < 3 ? `<span class="position-indicator">${index + 1}</span>` : ''}
              ${Utils.sanitizeHTML(entry.name)}
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
        
        elements.leaderboardList.appendChild(li);
      });
      
      // Add leaderboard description at the bottom
      const footer = document.createElement("li");
      footer.className = "leaderboard-footer";
      footer.innerHTML = `
        <small class="text-muted">
          Click on a player's name to see detailed statistics
        </small>
      `;
      elements.leaderboardList.appendChild(footer);
      
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      elements.leaderboardList.innerHTML = "<li>Error loading leaderboard</li>";
    }
  }

  /**
   * Fetch and display detailed player stats
   * @param {string} playerName - Name of the player to fetch stats for
   */
  async function showPlayerDetails(playerName) {
    try {
      const apiUrl = `${getApiBaseUrl()}/player/${playerName}/`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const playerStats = await response.json();
      
      // Create a modal or overlay to show detailed stats
      const statsModal = document.createElement('div');
      statsModal.className = 'modal player-stats-modal';
      
      // Calculate win/loss data for the chart
      const wins = playerStats.wins;
      const losses = playerStats.games_played - playerStats.wins;
      
      statsModal.innerHTML = `
        <div class="modal-content">
          <h2>${Utils.sanitizeHTML(playerStats.name)}'s Stats</h2>
          
          <!-- Stats Summary -->
          <div class="player-details mb-3">
            <div class="row text-center">
              <div class="col">
                <div class="stat-card">
                  <div class="stat-value">${playerStats.games_played}</div>
                  <div class="stat-label">Total Games</div>
                </div>
              </div>
              <div class="col">
                <div class="stat-card">
                  <div class="stat-value">${playerStats.wins}</div>
                  <div class="stat-label">Wins</div>
                </div>
              </div>
              <div class="col">
                <div class="stat-card">
                  <div class="stat-value">${playerStats.win_ratio}%</div>
                  <div class="stat-label">Win Rate</div>
                </div>
              </div>
            </div>
            <div class="text-center mt-3">
              <span class="rank-badge rank-${playerStats.rank}">
                ${playerStats.rank.toUpperCase()} RANK
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
                style="width: ${playerStats.win_ratio}%" 
                aria-valuenow="${playerStats.win_ratio}" 
                aria-valuemin="0" 
                aria-valuemax="100">
                ${playerStats.win_ratio}% Wins
              </div>
            </div>
            <p class="text-center">
              ${getPlayerSummary(playerStats)}
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
      console.error("Error fetching player details:", error);
      Utils.showAlert(`Could not fetch stats for ${playerName}`);
    }
  }
  
  /**
   * Create a simple win/loss doughnut chart
   * @param {number} wins - Number of wins
   * @param {number} losses - Number of losses
   */
  function createWinLossChart(wins, losses) {
    const ctx = document.getElementById('winLossChart').getContext('2d');
    
    // Simple chart using canvas (without Chart.js)
    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Colors
    const winColor = '#28a745';  // Green
    const lossColor = '#dc3545'; // Red
    
    // Calculate angles for pie slices
    const total = wins + losses;
    const winAngle = wins / total * Math.PI * 2;
    const lossAngle = losses / total * Math.PI * 2;
    
    // Set up chart parameters
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
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
      return "Not enough games to determine a pattern. Keep playing!";
    } else if (winRatio >= 70) {
      return "Exceptional performance! You're dominating the game!";
    } else if (winRatio >= 50) {
      return "Good performance! You're winning more than losing.";
    } else if (winRatio >= 30) {
      return "You're improving, but need more practice to get a positive win ratio.";
    } else {
      return "Keep practicing to improve your win rate!";
    }
  }
  
  /**
   * Start the Pong game
   * @param {Object} customSettings - Optional custom game settings
   */
  function startPongGame(customSettings = null) {
    console.log("startPongGame called with mode:", 
      appState.isMultiplayer ? "Multiplayer" : 
      customSettings ? "Custom" : "AI");
    
    // Set game as active
    appState.gameActive = true;
    
    // Reset game state
    appState.gameOverHandled = false;
    appState.roundsPlayed = 0;
    
    // Update UI
    elements.endGameButton.classList.remove("hidden");
    elements.playerRounds.innerText = appState.roundsPlayed;
    
    // Setup canvas styling
    elements.pongCanvas.style.width = '100%';
    elements.pongCanvas.style.height = 'auto';
    elements.pongCanvas.classList.remove("crt-zoom");
    
    // Try to enter fullscreen
    enterFullscreen(elements.pongCanvas);
    
    // Allow a short delay for fullscreen to complete
    setTimeout(() => {
      // Prepare game initialization options - start with basic settings
      const gameInitOptions = {
        canvasId: 'pong-canvas',
        isMultiplayer: appState.isMultiplayer,
        nickname: appState.nickname,
        token: appState.token,
        rounds: appState.targetRounds
      };
      
      // If this is a custom game, add custom settings
      if (customSettings) {
        console.log("Adding custom game settings:", customSettings);
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
      } else {
        // For non-custom games, explicitly set to default values
        // This ensures any previous custom settings are cleared
        console.log("Using default game settings (non-custom game)");
        Object.assign(gameInitOptions, {
          initialBallSpeed: 4,
          speedIncrement: 0.5,
          paddleSizeMultiplier: 100,
          ballColor: '#00d4ff',
          leftPaddleColor: '#007bff',
          rightPaddleColor: '#ff758c',
          gravityEnabled: false,
          bounceRandom: false
        });
      }
      
      // Add callbacks
      gameInitOptions.callbacks = {
        onRoundComplete: (roundsPlayed) => {
          appState.roundsPlayed = roundsPlayed;
          elements.overlayScoreDisplay.innerText = roundsPlayed;
          elements.playerRounds.innerText = roundsPlayed;
          
          console.log(`Round completed: ${roundsPlayed}/${appState.targetRounds}`);
        },
        onGameOver: (score) => {
          console.log("Game over callback triggered with score:", score);
          handleGameOver(score);
        },
        onPaddleMove: (paddleY) => {
          // Send paddle position to server in multiplayer mode
          if (appState.isMultiplayer) {
            WebSocketManager.sendPaddleUpdate(paddleY);
          }
        },
        onGameStart: () => {
          console.log("Game started callback");
        },
        onGameEnd: () => {
          console.log("Game ended callback");
        },
        onFullscreenChange: (isFullscreen) => {
          console.log("Fullscreen changed:", isFullscreen);
        }
      };
      
      console.log("Initializing PongGame with options:", gameInitOptions);
      
      // Initialize and start game
      PongGame.init(gameInitOptions);
      PongGame.start();
      
      // Apply "CRT zoom" effect for visual flair
      void elements.pongCanvas.offsetWidth; // Force reflow
      elements.pongCanvas.classList.add("crt-zoom");
      
      console.log("PongGame started successfully");
    }, 300); // Increased timeout for more reliable fullscreen transition
  }

  function startCustomGameWithSettings(customSettings) {
    appState.isMultiplayer = false; // Custom games are single player for now
    
    // Navigate to pong page
    UIManager.navigateTo("pong-page");
    elements.pongStatus.innerText = "Custom Game Mode";
    
    // Start game with custom settings
    startPongGame(customSettings);
  }
  
  /**
   * End the Pong game
   */
  async function endPongGame() {
    console.log("Ending game...");
    
    // Mark game as inactive
    appState.gameActive = false;
    
    // Stop the game
    PongGame.stop();
  
    const csrftoken = await fetchCsrfToken();
    
    // For multiplayer mode, report score to server
    if (appState.isMultiplayer) {
      try {
        const response = await fetch(`${getApiBaseUrl()}/end_game/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
          },
          body: JSON.stringify({
            nickname: appState.nickname,
            token: appState.token,
            score: appState.roundsPlayed,
            totalRounds: appState.targetRounds
          })
        });

        if (!response.ok) {
          throw new Error('Failed to record game');
        }

        const result = await response.json();
        
        // Check if this was a tournament game
        if (appState.isTournamentGame && window.TournamentManager && window.TournamentManager.isInTournament()) {
          // Send game over to WebSocket to notify tournament system
          WebSocketManager.sendGameOver(appState.roundsPlayed);
          
          // Navigate back to game page where tournament UI is
          UIManager.navigateTo("game-page");
        } else {
          // Show game result toast for non-tournament games
          if (result.winner) {
            Utils.showToast(LocalizationManager.get("gameWon"), "success");
          } else {
            Utils.showToast(LocalizationManager.get("gameLost"), "warning");
          }
          
          // Update UI
          elements.endGameButton.classList.add("hidden");
          
          // Navigate to leaderboard for non-tournament games
          UIManager.navigateTo("leaderboard-page");
        }
      } catch (error) {
        console.error("Error ending game:", error);
        Utils.showToast(LocalizationManager.get("failedToRecord"), "error");
      }
    } else {
      // For non-multiplayer games (AI or custom), do not record
      console.log("Not recording game result for non-multiplayer mode");
      Utils.showToast("Custom/AI game completed", "info");
      
      // Update UI
      elements.endGameButton.classList.add("hidden");
      
      // Navigate to leaderboard for non-tournament games
      UIManager.navigateTo("leaderboard-page");
    }
    
    // Exit fullscreen if active
    exitFullscreen();
  }
  
  /**
   * Request fullscreen mode for an element
   * @param {HTMLElement} element - Element to display in fullscreen
   */
  function enterFullscreen(element) {
    try {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    } catch (e) {
      console.error("Error entering fullscreen:", e);
    }
  }
  
  /**
   * Exit fullscreen mode
   */
  function exitFullscreen() {
    try {
      if (document.fullscreenElement || 
          document.webkitFullscreenElement || 
          document.mozFullScreenElement || 
          document.msFullscreenElement) {
        
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    } catch (e) {
      console.error("Error exiting fullscreen:", e);
    }
  }
  
  // -----------------------------
  // 5) Initialize the application
  // -----------------------------
  
  // Set initial state
  updateGameModeIndicator();
  
  // Show the language page first
  UIManager.navigateTo("language-page");
});