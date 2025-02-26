/**
 * Main application entry point
 * Initializes and coordinates game modules
 */
document.addEventListener("DOMContentLoaded", () => {
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
    waitingPlayersList: document.getElementById("waiting-players-list")
  };
  
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
    gameActive: false // Track if game is currently active
  };
  
  // Available game modes
  const gameModes = ["Classic with queue", "Classic with AI", "Unimplemented"];
  
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
    Utils.showToast("Lost connection to server. Attempting to reconnect...", "warning");
  }
  
  /**
   * Handle WebSocket errors
   * @param {Error} error - Error object
   */
  function handleSocketError(error) {
    console.error("WebSocket error:", error);
    Utils.showToast("Connection error. Please check your internet connection.", "error");
  }
  
  /**
   * Handle failed reconnection attempts
   */
  function handleReconnectFailed() {
    Utils.showToast("Could not reconnect to server. Please refresh the page.", "error");
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
   */
  function handleGameStart(rounds) {
    elements.pongStatus.innerText = "";
    if (rounds) {
      appState.targetRounds = rounds;
      elements.targetRounds.innerText = rounds;
    }
    startPongGame();
  }
  
  /**
   * Handle game updates from opponent
   * @param {Object} data - Game update data
   */
  function handleGameUpdate(data) {
    if (data && data.paddleY !== undefined) {
      PongGame.updateRemotePaddle(data.paddleY);
    }
  }
  
  /**
   * Handle game over event
   * @param {number} score - Final score
   */
  function handleGameOver(score) {
    if (!appState.gameOverHandled && (appState.roundsPlayed >= appState.targetRounds || score >= appState.targetRounds)) {
      appState.gameOverHandled = true;
      appState.gameActive = false; // Game is no longer active
      endPongGame();
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
    UIManager.navigateTo("game-page");
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
      li.innerText = "No players waiting";
      li.classList.add("no-players");
      elements.waitingPlayersList.appendChild(li);
      return;
    }

    waitingList.forEach(player => {
      const li = document.createElement("li");
      li.className = "list-group-item clickable-player";
      li.innerHTML = `<span class="player-name">${player.nickname}</span> <span class="player-rounds">(Rounds: ${player.rounds})</span>`;
      
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
    if (!nickname) {
      Utils.showAlert("Please enter a nickname!");
      return;
    }
    
    const validNickname = /^[A-Za-z]{1,16}$/;
    if (!validNickname.test(nickname)) {
      Utils.showAlert("This nickname is too cool to be used here!");
      return;
    }
    
    // Store game info
    appState.nickname = nickname;
    appState.token = Utils.generateToken();
    appState.roundsPlayed = 0;
    appState.targetRounds = parseInt(elements.roundsInput.value) || 3;
    
    // Update UI
    elements.playerNameDisplay.innerText = nickname;
    elements.playerName.innerText = nickname;
    elements.overlayScoreDisplay.innerText = appState.roundsPlayed;
    elements.playerRounds.innerText = appState.roundsPlayed;
    elements.targetRounds.innerText = appState.targetRounds;
    
    // Get selected game mode
    const selectedMode = gameModes[appState.currentGameModeIndex];
    
    // Handle different game modes
    if (selectedMode === "Unimplemented") {
      Utils.showAlert("This game mode is not yet implemented!");
      return;
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
        Utils.showAlert("Not connected to server. Please refresh the page.");
      }
    }
  }
  
  /**
   * Fetch and update the leaderboard
   */
  async function updateLeaderboard() {
    try {
      Utils.showLoading(elements.leaderboardList);
      
      const response = await fetch("http://127.0.0.1:8000/api/entries/");
      const data = await response.json();
      
      elements.leaderboardList.innerHTML = "";
      
      if (data.entries.length === 0) {
        const li = document.createElement("li");
        li.innerText = "No entries yet";
        elements.leaderboardList.appendChild(li);
        return;
      }
      
      data.entries.sort((a, b) => b.wins - a.wins);
      
      data.entries.forEach(entry => {
        const li = document.createElement("li");
        li.innerText = `${entry.name} - Wins: ${entry.wins}`;
        elements.leaderboardList.appendChild(li);
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      elements.leaderboardList.innerHTML = "<li>Error loading leaderboard</li>";
    }
  }
  
  /**
   * Start the Pong game
   */
  function startPongGame() {
    // Set game as active
    appState.gameActive = true;
    
    // Reset game state
    appState.gameOverHandled = false;
    appState.roundsPlayed = 0;
    
    // Update UI
    elements.endGameButton.classList.remove("hidden");
    elements.playerRounds.innerText = appState.roundsPlayed;
    
    // Setup canvas styling
    // Important: Remove any styling that constrains the canvas size
    elements.pongCanvas.style.width = '100%';
    elements.pongCanvas.style.height = 'auto';
    elements.pongCanvas.classList.remove("crt-zoom");
    
    // Try to enter fullscreen
    enterFullscreen(elements.pongCanvas);
    
    // Allow a short delay for fullscreen to complete
    setTimeout(() => {
      // Initialize and start game
      PongGame.init({
        canvasId: 'pong-canvas',
        isMultiplayer: appState.isMultiplayer,
        nickname: appState.nickname,
        token: appState.token,
        rounds: appState.targetRounds,
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
            // No need to pause the game
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
   * End the Pong game
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
        Utils.showLoading(elements.pongStatus);
        
        const response = await fetch("http://127.0.0.1:8000/api/end_game/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            nickname: appState.nickname, 
            token: appState.token, 
            score: appState.roundsPlayed 
          })
        });
        
        if (response.ok) {
          Utils.showToast("Game ended and win recorded!", "success");
        } else {
          Utils.showToast("Failed to record win!", "error");
        }
      } catch (error) {
        console.error("Error ending game:", error);
        Utils.showToast("Error connecting to server", "error");
      }
    }
    
    // Exit fullscreen if active
    if (document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement || 
        document.msFullscreenElement) {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      } catch (e) {
        console.error("Error exiting fullscreen:", e);
      }
    }
    
    // Update UI
    elements.endGameButton.classList.add("hidden");
    
    // Navigate to leaderboard
    UIManager.navigateTo("leaderboard-page");
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
  
  // -----------------------------
  // 5) Initialize the application
  // -----------------------------
  
  // Set initial state
  updateGameModeIndicator();
  
  // Show the language page first
  UIManager.navigateTo("language-page");
});