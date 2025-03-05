/**
 * Main Application - Optimized
 * Coordinates all game modules and manages application state
 */

// Application State
const appState = {
    nickname: "",
    token: "",
    currentGameModeIndex: 0,
    isMultiplayer: false,
    isFullscreen: false,
    roundsPlayed: 0,
    targetRounds: 3,
    gameOverHandled: false,
    gameActive: false,
    isTournamentGame: false,
    currentGameRoom: null,
    language: 'en'
  };
  
  // Available game modes
  const gameModes = ["Classic with queue", "Classic with AI", "Tournament", "Custom Game"];
  
  // Application initialization
  document.addEventListener("DOMContentLoaded", async function() {
    console.log("Application initializing...");
    
    // Initialize services first
    ApiService.init();
    
    // Start DevTools detection with reasonable frequency to avoid performance impact
    DevToolsDetector.startMonitoring(2000);
    
    // Gather DOM elements for all modules
    const elements = gatherUIElements();
    
    // Initialize modules with proper dependencies
    initializeModules(elements);
    
    // Setup event handlers for UI interaction
    setupEventHandlers(elements);
    
    // Apply initial state based on URL
    handleInitialState();
    
    console.log("Application initialized successfully");
  });
  
  /**
   * Gather all UI elements needed by different modules
   * @returns {Object} - Object containing DOM element references
   */
  function gatherUIElements() {
    // Create an object to hold all DOM element references
    const elements = {
      // Pages
      languagePage: document.getElementById("language-page"),
      gamePage: document.getElementById("game-page"),
      pongPage: document.getElementById("pong-page"),
      leaderboardPage: document.getElementById("leaderboard-page"),
      customGamePage: document.getElementById("custom-game-page"),
      privacyPolicyPage: document.getElementById("privacy-policy-page"),
      
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
    
    // In case some elements don't exist, log warnings but don't fail
    Object.keys(elements).forEach(key => {
      if (!elements[key] && key !== 'playerStatsDashboard') { // Some elements are optional
        console.warn(`Element not found: ${key}`);
      }
    });
    
    return elements;
  }
  
  /**
   * Initialize all application modules
   * @param {Object} elements - DOM element references
   */
  function initializeModules(elements) {
    // Initialize UI Manager
    UIManager.init({
      elements,
      callbacks: {
        onPageChange: handlePageChange,
        onLanguageChange: handleLanguageChange
      }
    });
    
    // Initialize Localization Manager
    LocalizationManager.init(elements.languageSelector?.value || 'en');
    appState.language = LocalizationManager.getCurrentLanguage();
    
    // Initialize WebSocket with callbacks
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
    
    // Initialize Custom Game Manager
    CustomGameManager.init(elements);
    
    // Initialize GDPR Manager if the page exists
    if (elements.privacyPolicyPage && window.GDPRManager) {
      window.GDPRManager.init();
    }
    
    // Initialize Tournament Manager with empty nickname (will be set later)
    if (typeof TournamentManager !== 'undefined') {
      TournamentManager.init(elements, "");
    }
  }
  
  /**
   * Set up event handlers for UI interactions
   * @param {Object} elements - DOM element references
   */
  function setupEventHandlers(elements) {
    // Language selector
    if (elements.languageSelector) {
      elements.languageSelector.addEventListener("change", () => {
        const lang = elements.languageSelector.value;
        LocalizationManager.setLanguage(lang);
        appState.language = lang;
        UIManager.updateTranslations();
      });
    }
    
    // Nickname input
    if (elements.nicknameInput) {
      elements.nicknameInput.addEventListener("input", () => {
        const hasNickname = elements.nicknameInput.value.trim().length > 0;
        UIManager.toggleStartButton(hasNickname);
        
        // Update Tournament Manager with new nickname if it exists
        if (hasNickname && typeof TournamentManager !== 'undefined') {
          TournamentManager.setNickname(elements.nicknameInput.value.trim());
        }
      });
    }
    
    // Add privacy policy button if it doesn't exist
    addPrivacyPolicyButton(elements);
    
    // Set up navigation buttons
    setupNavigationButtons();
    
    // Game mode selection
    if (elements.prevModeButton) {
      elements.prevModeButton.addEventListener("click", () => {
        appState.currentGameModeIndex = (appState.currentGameModeIndex - 1 + gameModes.length) % gameModes.length;
        updateGameModeIndicator();
      });
    }
    
    if (elements.nextModeButton) {
      elements.nextModeButton.addEventListener("click", () => {
        appState.currentGameModeIndex = (appState.currentGameModeIndex + 1) % gameModes.length;
        updateGameModeIndicator();
      });
    }
    
    // Start game button
    if (elements.startGameButton) {
      elements.startGameButton.addEventListener("click", handleStartGame);
    }
    
    // End game button
    if (elements.endGameButton) {
      elements.endGameButton.addEventListener("click", endPongGame);
    }
    
    // Custom game button
    if (elements.startCustomGame) {
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
    }
    
    // Fullscreen change handler
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    
    // Prevent Escape key from ending the game
    document.addEventListener('keydown', (e) => {
      if (appState.gameActive && e.key === 'Escape') {
        console.log('Escape pressed - fullscreen will exit but game continues');
      }
    });
    
    // Canvas click for fullscreen
    if (elements.pongCanvas) {
      elements.pongCanvas.addEventListener("click", () => {
        if (!document.fullscreenElement && 
            !document.webkitFullscreenElement &&
            !document.mozFullScreenElement &&
            !document.msFullscreenElement) {
          enterFullscreen(elements.pongCanvas);
        }
      });
    }
  }
  
  /**
   * Handle initial application state
   */
  function handleInitialState() {
    // Set initial game mode indicator
    updateGameModeIndicator();
    
    // Check screen size initially
    UIManager.checkWindowSize();
  }
  
  /**
   * Add a privacy policy button if it doesn't exist
   * @param {Object} elements - DOM element references
   */
  function addPrivacyPolicyButton(elements) {
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
      console.warn("Could not find leaderboard button to insert privacy policy button");
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
  
  /**
   * Setup navigation buttons
   */
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
  
  //------------------------
  // API INTERACTION
  //------------------------
  
  /**
   * Get the API base URL
   * @returns {string} - API base URL
   */
  function getApiBaseUrl() {
    return ApiService.getBaseUrl();
  }
  
  /**
   * Fetch and update the leaderboard
   */
  async function updateLeaderboard() {
    try {
      const leaderboardElement = document.getElementById('leaderboard');
      if (!leaderboardElement) {
        console.error("Leaderboard element not found");
        return;
      }
      
      UIManager.showLoading(leaderboardElement);
      
      const data = await ApiService.get('entries/');
      
      leaderboardElement.innerHTML = "";
      
      if (!data.entries || data.entries.length === 0) {
        leaderboardElement.innerHTML = "<li>No entries yet</li>";
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
      leaderboardElement.appendChild(header);
      
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
        
        leaderboardElement.appendChild(li);
      });
      
      // Add leaderboard description at the bottom
      const footer = document.createElement("li");
      footer.className = "leaderboard-footer";
      footer.innerHTML = `
        <small class="text-muted">
          Click on a player's name to see detailed statistics
        </small>
      `;
      leaderboardElement.appendChild(footer);
      
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      
      const leaderboardElement = document.getElementById('leaderboard');
      if (leaderboardElement) {
        leaderboardElement.innerHTML = "<li>Error loading leaderboard</li>";
      }
      
      ErrorHandler.handleNetworkError(error);
    }
  }
  
  /**
   * Fetch and display detailed player stats
   * @param {string} playerName - Name of the player to fetch stats for
   */
  async function showPlayerDetails(playerName) {
    try {
      const data = await ApiService.get(`player/${playerName}/`);
      
      // Create a modal to show detailed stats
      const statsModal = document.createElement('div');
      statsModal.className = 'modal player-stats-modal';
      
      // Calculate win/loss data for the chart
      const wins = data.wins;
      const losses = data.games_played - data.wins;
      
      statsModal.innerHTML = `
        <div class="modal-content">
          <h2>${Utils.sanitizeHTML(data.name)}'s Stats</h2>
          
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
      console.error("Error fetching player details:", error);
      ErrorHandler.handleNetworkError(`Could not fetch stats for ${playerName}`);
    }
  }
  
  /**
   * Create a simple win/loss doughnut chart
   * @param {number} wins - Number of wins
   * @param {number} losses - Number of losses
   */
  function createWinLossChart(wins, losses) {
    const ctx = document.getElementById('winLossChart')?.getContext('2d');
    if (!ctx) {
      console.error("Chart canvas not found");
      return;
    }
    
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
   * Record a game result with the server
   * @param {string} nickname - Player nickname
   * @param {string} token - Game token
   * @param {number} score - Player score
   * @param {number} totalRounds - Total rounds played
   * @returns {Promise<Object>} - Server response
   */
  async function recordGameResult(nickname, token, score, totalRounds) {
    try {
      return await ApiService.post('end_game/', {
        nickname,
        token,
        score,
        totalRounds
      });
    } catch (error) {
      console.error("Error recording game result:", error);
      throw error;
    }
  }
  
  //------------------------
  // EVENT HANDLERS
  //------------------------
  
  /**
   * Handle page change events
   * @param {string} pageId - ID of the target page
   */
  function handlePageChange(pageId) {
    if (pageId === "leaderboard-page") {
      updateLeaderboard();
    } else if (pageId === "privacy-policy-page" && window.GDPRManager) {
      // Ensure GDPR Manager is initialized when visiting the privacy page
      window.GDPRManager.init();
    }
  }
  
  /**
   * Handle language changes
   * @param {string} language - Selected language code
   */
  function handleLanguageChange(language) {
    appState.language = language;
    
    // Update localStorage if available
    try {
      LocalStorageService.setItem('preferredLanguage', language);
    } catch (e) {
      // Ignore localStorage errors
    }
  }
  
  /**
   * Handle WebSocket connection
   */
  function handleSocketConnect() {
    console.log("WebSocket connected to server");
  }
  
  /**
   * Handle WebSocket disconnection
   */
  function handleSocketDisconnect() {
    console.log("WebSocket disconnected from server");
    ErrorHandler.showError(LocalizationManager.get("connectionError"), "warning");
  }
  
  /**
   * Handle WebSocket errors
   * @param {Error} error - Error object
   */
  function handleSocketError(error) {
    console.error("WebSocket error:", error);
    ErrorHandler.handleNetworkError(error);
  }
  
  /**
   * Handle failed reconnection attempts
   */
  function handleReconnectFailed() {
    ErrorHandler.showError(LocalizationManager.get("reconnectFailed"), "error");
  }
  
  /**
   * Handle queue update messages
   * @param {string} message - Queue update message
   */
  function handleQueueUpdate(message) {
    const pongStatus = document.getElementById("pong-status");
    if (pongStatus) {
      pongStatus.innerText = message;
    }
  }
  
  /**
   * Handle game start event from WebSocket
   * @param {number} rounds - Number of rounds for the game
   * @param {boolean} isTournament - Whether this is a tournament game
   * @param {string} gameRoom - Game room identifier from server
   */
  function handleGameStart(rounds, isTournament = false, gameRoom = null) {
    console.log(`Game start handler: rounds=${rounds}, isTournament=${isTournament}, room=${gameRoom}`);
    
    // Clear status
    const pongStatus = document.getElementById("pong-status");
    if (pongStatus) {
      pongStatus.innerText = "";
    }
    
    // Set rounds
    if (rounds) {
      appState.targetRounds = rounds;
      const targetRoundsElement = document.getElementById("target-rounds");
      if (targetRoundsElement) {
        targetRoundsElement.innerText = rounds;
      }
    }
    
    // Set tournament game flag
    appState.isTournamentGame = isTournament;
    
    // IMPORTANT: For tournament games, ALWAYS ensure multiplayer is enabled
    if (isTournament) {
      console.log("Tournament game starting - enabling multiplayer mode");
      appState.isMultiplayer = true;
      
      // Set a tournament status message
      if (pongStatus) {
        pongStatus.innerText = "Tournament Match Starting...";
      }
    }
    
    // Store game room info if provided
    if (gameRoom) {
      appState.currentGameRoom = gameRoom;
      // Store in localStorage for potential reconnection
      try {
        LocalStorageService.setItem('currentGameRoom', gameRoom);
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    
    // Reset game state
    appState.gameOverHandled = false;
    appState.roundsPlayed = 0;
    
    // Update UI with player info
    const playerNameDisplay = document.getElementById("overlay-player-name");
    const playerName = document.getElementById("player-name");
    const overlayScoreDisplay = document.getElementById("overlay-score");
    const playerRounds = document.getElementById("player-rounds");
    
    if (playerNameDisplay) playerNameDisplay.innerText = Utils.sanitizeHTML(appState.nickname);
    if (playerName) playerName.innerText = Utils.sanitizeHTML(appState.nickname);
    if (overlayScoreDisplay) overlayScoreDisplay.innerText = appState.roundsPlayed;
    if (playerRounds) playerRounds.innerText = appState.roundsPlayed;
    
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
      // Ensure PongGame is initialized
      if (PongGame && typeof PongGame.updateRemotePaddle === 'function') {
        PongGame.updateRemotePaddle(data.paddleY);
      } else {
        console.warn("PongGame not initialized, can't update paddle");
      }
    }
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
   * Handle opponent leaving the game
   * @param {string} message - Message about opponent leaving
   */
  function handleOpponentLeft(message) {
    appState.gameActive = false; // Game is no longer active
    ErrorHandler.showError(message);
    
    // If this is a tournament game and we're in a tournament, go back to tournament view
    if (appState.isTournamentGame && window.TournamentManager && window.TournamentManager.isInTournament()) {
      UIManager.navigateTo("game-page");
    } else {
      UIManager.navigateTo("game-page");
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
    
    const gameInfo = document.getElementById("game-info");
    if (gameInfo) {
      if (appState.isFullscreen) {
        gameInfo.classList.remove("visible");
      } else {
        gameInfo.classList.add("visible");
      }
    }
  }
  
  /**
   * Update the waiting players list
   * @param {Array} waitingList - List of waiting players
   */
  function updateWaitingList(waitingList) {
    console.log("Updating waiting list UI with:", waitingList);
    
    const waitingPlayersList = document.getElementById("waiting-players-list");
    if (!waitingPlayersList) {
      console.error("Waiting players list element not found");
      return;
    }
    
    waitingPlayersList.innerHTML = "";
  
    if (!waitingList || waitingList.length === 0) {
      const li = document.createElement("li");
      li.innerText = LocalizationManager.get("noPlayersWaiting");
      li.classList.add("no-players");
      waitingPlayersList.appendChild(li);
      return;
    }
  
    waitingList.forEach(player => {
      const li = document.createElement("li");
      li.className = "list-group-item clickable-player";
      li.innerHTML = `<span class="player-name">${Utils.sanitizeHTML(player.nickname)}</span> <span class="player-rounds">(${LocalizationManager.get("rounds")}: ${player.rounds})</span>`;
      
      // Add click handler
      li.onclick = function() {
        console.log("Player clicked:", player);
        
        const roundsInput = document.getElementById("rounds-input");
        if (roundsInput) {
          // Set rounds and update UI
          roundsInput.value = player.rounds;
          
          // Set game mode to Classic with queue
          appState.currentGameModeIndex = 0;
          updateGameModeIndicator();
          
          // Highlight rounds input
          roundsInput.classList.add("highlight-input");
          setTimeout(() => {
            roundsInput.classList.remove("highlight-input");
          }, 1000);
        }
        
        // Focus on appropriate element
        const nicknameInput = document.getElementById("nickname");
        const startGameButton = document.getElementById("start-game");
        
        if (nicknameInput && nicknameInput.value.trim().length > 0) {
          if (startGameButton && !startGameButton.classList.contains("hidden")) {
            startGameButton.classList.add("pulse");
            setTimeout(() => {
              startGameButton.classList.remove("pulse");
            }, 1500);
          }
        } else if (nicknameInput) {
          nicknameInput.focus();
        }
      };
      
      waitingPlayersList.appendChild(li);
    });
  }
  
  /**
   * Update the game mode indicator text
   */
  function updateGameModeIndicator() {
    const gameModeIndicator = document.querySelector(".game-mode-indicator");
    if (gameModeIndicator) {
      gameModeIndicator.innerText = gameModes[appState.currentGameModeIndex];
    }
  }
  
  /**
   * Handle start game button click
   */
  function handleStartGame() {
    const nicknameInput = document.getElementById("nickname");
    const roundsInput = document.getElementById("rounds-input");
    
    if (!nicknameInput || !roundsInput) {
      ErrorHandler.handleValidationError("Game initialization failed: Required elements not found");
      return;
    }
    
    const nickname = nicknameInput.value.trim();
    const rounds = roundsInput.value;
    
    // Check for DevTools (only during game start to avoid affecting performance)
    if (DevToolsDetector.check()) {
      // The detector will show a warning if DevTools are open
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
    const playerNameDisplay = document.getElementById("overlay-player-name");
    const playerName = document.getElementById("player-name");
    const overlayScoreDisplay = document.getElementById("overlay-score");
    const playerRounds = document.getElementById("player-rounds");
    const targetRounds = document.getElementById("target-rounds");
    
    if (playerNameDisplay) playerNameDisplay.innerText = Utils.sanitizeHTML(nickname);
    if (playerName) playerName.innerText = Utils.sanitizeHTML(nickname);
    if (overlayScoreDisplay) overlayScoreDisplay.innerText = appState.roundsPlayed;
    if (playerRounds) playerRounds.innerText = appState.roundsPlayed;
    if (targetRounds) targetRounds.innerText = appState.targetRounds;
    
    // Get selected game mode
    const selectedMode = gameModes[appState.currentGameModeIndex];
    
    // Handle different game modes
    if (selectedMode === "Tournament") {
      handleTournamentMode(nickname);
    } else if (selectedMode === "Custom Game") {
      UIManager.navigateTo("custom-game-page");
    } else if (selectedMode === "Classic with AI") {
      startAIGame();
    } else { // Classic with queue
      startMultiplayerGame(nickname, appState.token, appState.targetRounds);
    }
  }
  
  /**
   * Handle Tournament mode selection
   * @param {string} nickname - Player nickname
   */
  function handleTournamentMode(nickname) {
    // Check if TournamentManager exists
    if (!window.TournamentManager) {
      console.error("TournamentManager not found! Make sure tournament-manager.js is loaded.");
      ErrorHandler.showError("Tournament functionality unavailable. Please try again later.");
      return;
    }
    
    console.log("Initializing Tournament Manager...");
    // Initialize Tournament Manager with proper elements and nickname
    window.TournamentManager.setNickname(nickname);
    
    // Navigate to game page
    UIManager.navigateTo("game-page");
    
    // Make sure tournament sections are visible
    const availableTournamentsElement = document.getElementById("available-tournaments");
    if (availableTournamentsElement) {
      availableTournamentsElement.style.display = 'block';
    }
    
    // Request latest tournament list
    if (WebSocketManager.isConnected()) {
      console.log("Requesting tournament list...");
      WebSocketManager.send({
        type: "get_tournaments"
      });
    } else {
      ErrorHandler.showError(LocalizationManager.get("connectionError"));
    }
  }
  
  /**
   * Start a game with AI opponent
   */
  function startAIGame() {
    appState.isMultiplayer = false;
    
    const pongStatus = document.getElementById("pong-status");
    if (pongStatus) {
      pongStatus.innerText = LocalizationManager.get("aiMode");
    }
    
    UIManager.navigateTo("pong-page");
    startPongGame();
  }
  
  /**
   * Start a multiplayer game by joining queue
   * @param {string} nickname - Player nickname
   * @param {string} token - Player token
   * @param {number} rounds - Number of rounds
   */
  function startMultiplayerGame(nickname, token, rounds) {
    appState.isMultiplayer = true;
    
    // Join queue via WebSocket
    if (WebSocketManager.isConnected()) {
      WebSocketManager.joinQueue(
        nickname,
        token,
        rounds
      );
      
      UIManager.navigateTo("pong-page");
      
      const pongStatus = document.getElementById("pong-status");
      if (pongStatus) {
        pongStatus.innerText = LocalizationManager.get("waitingQueue");
      }
    } else {
      ErrorHandler.showError(LocalizationManager.get("connectionError"));
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
      ErrorHandler.handleValidationError(LocalizationManager.get("nicknameRequired"));
      return false;
    }
    
    // More thorough nickname validation (alphanumeric + some special chars)
    if (!Utils.isValidNickname(nickname)) {
      ErrorHandler.handleValidationError("Nickname must be 1-16 characters with only letters, numbers, underscore or hyphen.");
      return false;
    }
    
    // Validate rounds as number within range
    const roundsNum = parseInt(rounds);
    if (isNaN(roundsNum) || roundsNum < 1 || roundsNum > 20) {
      ErrorHandler.handleValidationError("Rounds must be a number between 1 and 20.");
      return false;
    }
    
    return true;
  }
  
  //------------------------
  // GAME CONTROL FUNCTIONS
  //------------------------
  
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
    const endGameButton = document.getElementById("end-game");
    const playerRounds = document.getElementById("player-rounds");
    
    if (endGameButton) endGameButton.classList.remove("hidden");
    if (playerRounds) playerRounds.innerText = appState.roundsPlayed;
    
    // Setup canvas styling
    const pongCanvas = document.getElementById("pong-canvas");
    if (pongCanvas) {
      pongCanvas.style.width = '100%';
      pongCanvas.style.height = 'auto';
      pongCanvas.classList.remove("crt-zoom");
    }
    
    // Try to enter fullscreen
    if (pongCanvas) {
      enterFullscreen(pongCanvas).catch(err => {
        console.warn("Fullscreen request failed:", err);
        // Game can still run without fullscreen
      });
    }
    
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
      }
      
      // Add callbacks
      gameInitOptions.callbacks = {
        onRoundComplete: (roundsPlayed) => {
          appState.roundsPlayed = roundsPlayed;
          
          const overlayScoreDisplay = document.getElementById("overlay-score");
          const playerRounds = document.getElementById("player-rounds");
          
          if (overlayScoreDisplay) overlayScoreDisplay.innerText = roundsPlayed;
          if (playerRounds) playerRounds.innerText = roundsPlayed;
          
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
          appState.isFullscreen = isFullscreen;
        }
      };
      
      console.log("Initializing PongGame with options:", gameInitOptions);
      
      // Initialize and start game
      if (PongGame.init(gameInitOptions)) {
        PongGame.start();
        
        // Apply "CRT zoom" effect for visual flair
        if (pongCanvas) {
          void pongCanvas.offsetWidth; // Force reflow
          pongCanvas.classList.add("crt-zoom");
        }
        
        console.log("PongGame started successfully");
      } else {
        ErrorHandler.handleGameError("Failed to initialize game. Please refresh the page.");
      }
    }, 300); // Increased timeout for more reliable fullscreen transition
  }
  
  /**
   * Start a custom game with specified settings
   * @param {Object} customSettings - Custom game settings
   */
  function startCustomGameWithSettings(customSettings) {
    appState.isMultiplayer = false; // Custom games are single player for now
    
    // Navigate to pong page
    UIManager.navigateTo("pong-page");
    
    const pongStatus = document.getElementById("pong-status");
    if (pongStatus) {
      pongStatus.innerText = "Custom Game Mode";
    }
    
    // Start game with custom settings
    startPongGame(customSettings);
  }
  
  /**
   * End the Pong game and record results
   */
  async function endPongGame() {
    console.log("Ending game...");
    
    // Mark game as inactive
    appState.gameActive = false;
    
    // Stop the game
    PongGame.stop();
  
    // For multiplayer mode, report score to server
    if (appState.isMultiplayer) {
      try {
        const result = await recordGameResult(
          appState.nickname,
          appState.token,
          appState.roundsPlayed,
          appState.targetRounds
        );
        
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
          const endGameButton = document.getElementById("end-game");
          if (endGameButton) endGameButton.classList.add("hidden");
          
          // Navigate to leaderboard for non-tournament games
          UIManager.navigateTo("leaderboard-page");
        }
      } catch (error) {
        console.error("Error ending game:", error);
        ErrorHandler.handleNetworkError("Failed to record game result");
        
        // Navigate back to menu even on error
        UIManager.navigateTo("game-page");
      }
    } else {
      // For non-multiplayer games (AI or custom), do not record
      console.log("Not recording game result for non-multiplayer mode");
      Utils.showToast("Custom/AI game completed", "info");
      
      // Update UI
      const endGameButton = document.getElementById("end-game");
      if (endGameButton) endGameButton.classList.add("hidden");
      
      // Navigate to menu
      UIManager.navigateTo("game-page");
    }
    
    // Exit fullscreen if active
    exitFullscreen().catch(err => {
      // Ignore fullscreen exit errors
      console.warn("Error exiting fullscreen:", err);
    });
  }
  
  /**
   * Request fullscreen mode for an element
   * @param {HTMLElement} element - Element to display in fullscreen
   * @returns {Promise} - Promise that resolves when fullscreen starts
   */
  function enterFullscreen(element) {
    if (!element) {
      return Promise.reject(new Error("No element provided for fullscreen"));
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
      console.error("Error entering fullscreen:", error);
      return Promise.reject(error);
    }
    
    return Promise.reject(new Error("Fullscreen not supported"));
  }
  
  /**
   * Exit fullscreen mode
   * @returns {Promise} - Promise that resolves when fullscreen ends
   */
  function exitFullscreen() {
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement && 
        !document.msFullscreenElement) {
      // Already not in fullscreen
      return Promise.resolve();
    }
    
    try {
      if (document.exitFullscreen) {
        return document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        return document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        return document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        return document.msExitFullscreen();
      }
    } catch (error) {
      console.error("Error exiting fullscreen:", error);
      return Promise.reject(error);
    }
    
    return Promise.reject(new Error("Fullscreen exit not supported"));
  }