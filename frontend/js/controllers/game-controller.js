/**
 * Game Controller Module
 * Handles game state management and coordination
 */
const GameController = (function() {
    // Private variables
    let elements = {};
    let callbacks = {};
    let gameState = {
      nickname: "",
      token: "",
      currentGameModeIndex: 0,
      isMultiplayer: false,
      isFullscreen: false,
      roundsPlayed: 0,
      targetRounds: 3,
      gameOverHandled: false,
      gameActive: false
    };
    
    // Available game modes
    const gameModes = ["Classic with queue", "Classic with AI", "Custom Game"];
  
    /**
     * Initialize the game controller
     * @param {Object} config - Configuration object with elements and callbacks
     * @returns {Object} - Public API
     */
    function init(config = {}) {
      elements = config.elements || {};
      callbacks = config.callbacks || {};
      
      // Validate required elements
      if (!elements.pongCanvas) {
        console.error("Missing required element: pongCanvas");
        return null;
      }
      
      // Set up game mode selection
      setupGameModeSelection();
      
      // Set up nickname input events
      setupNicknameInput();
      
      // Set up start/end game buttons
      setupGameButtons();
      
      console.log("Game controller initialized");
      
      return publicAPI;
    }
    
    /**
     * Set up game mode selection buttons
     */
    function setupGameModeSelection() {
      elements.prevModeButton.addEventListener("click", () => {
        gameState.currentGameModeIndex = (gameState.currentGameModeIndex - 1 + gameModes.length) % gameModes.length;
        updateGameModeIndicator();
      });
      
      elements.nextModeButton.addEventListener("click", () => {
        gameState.currentGameModeIndex = (gameState.currentGameModeIndex + 1) % gameModes.length;
        updateGameModeIndicator();
      });
      
      // Initialize game mode indicator
      updateGameModeIndicator();
    }
    
    /**
     * Set up nickname input behavior
     */
    function setupNicknameInput() {
      if (elements.nicknameInput) {
        elements.nicknameInput.addEventListener("input", () => {
          if (elements.startGameButton) {
            // Show start button only when nickname is present
            const hasNickname = elements.nicknameInput.value.trim().length > 0;
            
            if (hasNickname) {
              elements.startGameButton.classList.remove("hidden");
              elements.startGameButton.style.opacity = "1";
              elements.startGameButton.style.pointerEvents = "auto";
            } else {
              elements.startGameButton.style.opacity = "0";
              elements.startGameButton.style.pointerEvents = "none";
              setTimeout(() => {
                if (!hasNickname) {
                  elements.startGameButton.classList.add("hidden");
                }
              }, 500);
            }
          }
        });
      }
    }
    
    /**
     * Set up start and end game buttons
     */
    function setupGameButtons() {
      if (elements.startGameButton) {
        elements.startGameButton.addEventListener("click", handleStartGame);
      }
      
      if (elements.endGameButton) {
        elements.endGameButton.addEventListener("click", endGame);
      }
      
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
     * Handle start game button click
     */
    function handleStartGame() {
      const nickname = elements.nicknameInput.value.trim();
      const rounds = elements.roundsInput.value;
      
      if (!validateInput(nickname, rounds)) {
        return;
      }
      
      // Store game info
      gameState.nickname = nickname;
      gameState.token = Utils.generateToken();
      gameState.roundsPlayed = 0;
      gameState.targetRounds = parseInt(rounds) || 3;
      
      // Update UI with player info
      updatePlayerDisplay(nickname, gameState.roundsPlayed, gameState.targetRounds);
      
      // Get selected game mode
      const selectedMode = gameModes[gameState.currentGameModeIndex];
      
      // Handle different game modes
      if (selectedMode === "Custom Game") {
        // Navigate to custom game page
        PageManager.navigateTo("custom-game-page");
      } else if (selectedMode === "Classic with AI") {
        gameState.isMultiplayer = false;
        PageManager.navigateTo("pong-page");
        
        if (elements.pongStatus) {
          elements.pongStatus.innerText = I18nManager.get("aiMode");
        }
        
        startGame();
      } else if (selectedMode === "Classic with queue") {
        gameState.isMultiplayer = true;
        
        // Join queue via WebSocket
        if (WebSocketService.isConnected()) {
          WebSocketService.joinQueue(
            gameState.nickname,
            gameState.token,
            gameState.targetRounds
          );
          
          PageManager.navigateTo("pong-page");
          
          if (elements.pongStatus) {
            elements.pongStatus.innerText = I18nManager.get("waitingQueue");
          }
        } else {
          Utils.showAlert(I18nManager.get("connectionError"));
        }
      }
    }
    
    /**
     * Start the game
     */
    function startGame() {
      // Set game as active
      gameState.gameActive = true;
      
      // Reset game state
      gameState.gameOverHandled = false;
      gameState.roundsPlayed = 0;
      
      // Update UI
      if (elements.endGameButton) {
        elements.endGameButton.classList.remove("hidden");
      }
      
      if (elements.playerRounds) {
        elements.playerRounds.innerText = gameState.roundsPlayed;
      }
      
      // Setup canvas styling
      elements.pongCanvas.style.width = '100%';
      elements.pongCanvas.style.height = 'auto';
      elements.pongCanvas.classList.remove("crt-zoom");
      
      // Try to enter fullscreen
      enterFullscreen(elements.pongCanvas);
      
      // Allow a short delay for fullscreen to complete
      setTimeout(() => {
        // Initialize and start game
        PongGame.init({
          canvasId: elements.pongCanvas.id,
          isMultiplayer: gameState.isMultiplayer,
          nickname: gameState.nickname,
          token: gameState.token,
          rounds: gameState.targetRounds,
          callbacks: {
            onRoundComplete: handleRoundComplete,
            onGameOver: handleGameOver,
            onPaddleMove: handlePaddleMove,
            onFullscreenChange: handleFullscreenChange
          }
        });
        
        PongGame.start();
        
        // Apply "CRT zoom" effect for visual flair
        void elements.pongCanvas.offsetWidth; // Force reflow
        elements.pongCanvas.classList.add("crt-zoom");
        
        // Notify game start
        if (callbacks.onGameStart) {
          callbacks.onGameStart();
        }
      }, 100);
    }
    
    /**
     * Start a custom game with specific settings
     * @param {Object} settings - Custom game settings
     */
    function startCustomGame(settings) {
      // Set game mode to single player for custom games
      gameState.isMultiplayer = false;
      
      // Navigate to pong page
      PageManager.navigateTo("pong-page");
      
      if (elements.pongStatus) {
        elements.pongStatus.innerText = "Custom Game Mode";
      }
      
      // Set game as active
      gameState.gameActive = true;
      
      // Reset game state
      gameState.gameOverHandled = false;
      gameState.roundsPlayed = 0;
      
      // Update UI
      if (elements.endGameButton) {
        elements.endGameButton.classList.remove("hidden");
      }
      
      if (elements.playerRounds) {
        elements.playerRounds.innerText = gameState.roundsPlayed;
      }
      
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
          canvasId: elements.pongCanvas.id,
          isMultiplayer: gameState.isMultiplayer,
          nickname: gameState.nickname,
          token: gameState.token,
          rounds: gameState.targetRounds,
          // Add custom settings
          initialBallSpeed: settings.ballSpeed,
          speedIncrement: settings.speedIncrement,
          paddleSizeMultiplier: settings.paddleSize,
          ballColor: settings.ballColor,
          leftPaddleColor: settings.leftPaddleColor,
          rightPaddleColor: settings.rightPaddleColor,
          gravityEnabled: settings.gravityEnabled,
          bounceRandom: settings.bounceRandom,
          // Callbacks
          callbacks: {
            onRoundComplete: handleRoundComplete,
            onGameOver: handleGameOver,
            onPaddleMove: handlePaddleMove,
            onFullscreenChange: handleFullscreenChange
          }
        });
        
        PongGame.start();
        
        // Apply "CRT zoom" effect for visual flair
        void elements.pongCanvas.offsetWidth; // Force reflow
        elements.pongCanvas.classList.add("crt-zoom");
        
        // Notify game start
        if (callbacks.onGameStart) {
          callbacks.onGameStart();
        }
      }, 100);
    }
    
    /**
     * End the current game
     */
    async function endGame() {
      console.log("Ending game...");
      
      // Mark game as inactive
      gameState.gameActive = false;
      
      // Stop the game
      PongGame.stop();
      
      // For multiplayer mode, report score to server
      if (gameState.isMultiplayer) {
        try {
          if (elements.pongStatus) {
            Utils.showLoading(elements.pongStatus);
          }
          
          // Get CSRF token
          const csrftoken = await ApiService.fetchCsrfToken();
          
          const response = await ApiService.endGame({
            nickname: gameState.nickname, 
            token: gameState.token, 
            score: gameState.roundsPlayed,
            totalRounds: gameState.targetRounds
          });
          
          if (response.success) {
            Utils.showToast(
              response.winner 
                ? I18nManager.get("gameWon") 
                : I18nManager.get("gameLost"), 
              response.winner ? "success" : "warning"
            );
          }
        } catch (error) {
          console.error("Error ending game:", error);
          Utils.showToast(I18nManager.get("connectionError"), "error");
        }
      }
      
      // Exit fullscreen if active
      exitFullscreen();
      
      // Update UI
      if (elements.endGameButton) {
        elements.endGameButton.classList.add("hidden");
      }
      
      // Navigate to leaderboard
      PageManager.navigateTo("leaderboard-page");
      
      // Notify game end
      if (callbacks.onGameEnd) {
        callbacks.onGameEnd({
          roundsPlayed: gameState.roundsPlayed,
          targetRounds: gameState.targetRounds,
          isMultiplayer: gameState.isMultiplayer
        });
      }
    }
    
    /**
     * Exit fullscreen mode
     */
    function exitFullscreen() {
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
     * Handle round completion
     * @param {number} roundsPlayed - Number of rounds completed
     */
    function handleRoundComplete(roundsPlayed) {
      gameState.roundsPlayed = roundsPlayed;
      
      // Update UI
      if (elements.overlayScoreDisplay) {
        elements.overlayScoreDisplay.innerText = roundsPlayed;
      }
      
      if (elements.playerRounds) {
        elements.playerRounds.innerText = roundsPlayed;
      }
      
      // Notify round complete
      if (callbacks.onRoundComplete) {
        callbacks.onRoundComplete(roundsPlayed);
      }
    }
    
    /**
     * Handle game over event
     * @param {number} score - Final score
     */
    function handleGameOver(score) {
      if (!gameState.gameOverHandled && (gameState.roundsPlayed >= gameState.targetRounds || score >= gameState.targetRounds)) {
        gameState.gameOverHandled = true;
        gameState.gameActive = false; // Game is no longer active
        
        endGame();
      }
    }
    
    /**
     * Handle paddle movement
     * @param {number} paddleY - Y position of paddle
     */
    function handlePaddleMove(paddleY) {
      // Send paddle position to server in multiplayer mode
      if (gameState.isMultiplayer) {
        WebSocketService.sendPaddleUpdate(paddleY);
      }
    }
    
    /**
     * Handle fullscreen change
     * @param {boolean} isFullscreen - Whether game is in fullscreen mode
     */
    function handleFullscreenChange(isFullscreen) {
      gameState.isFullscreen = isFullscreen;
      
      // Show/hide game info
      showGameInfo(!isFullscreen);
    }
    
    /**
     * Update the game mode indicator
     */
    function updateGameModeIndicator() {
      const indicator = document.querySelector(".game-mode-indicator");
      if (indicator) {
        indicator.innerText = gameModes[gameState.currentGameModeIndex];
      }
    }
    
    /**
     * Show/hide game info display
     * @param {boolean} show - Whether to show the info
     */
    function showGameInfo(show) {
      const gameInfo = document.getElementById("game-info");
      if (gameInfo) {
        if (show) {
          gameInfo.classList.add("visible");
        } else {
          gameInfo.classList.remove("visible");
        }
      }
    }
    
    /**
     * Update player display information
     * @param {string} nickname - Player nickname
     * @param {number} rounds - Rounds played
     * @param {number} targetRounds - Target rounds
     */
    function updatePlayerDisplay(nickname, rounds, targetRounds) {
      if (elements.playerNameDisplay) {
        elements.playerNameDisplay.innerText = Utils.sanitizeHTML(nickname);
      }
      
      if (elements.playerName) {
        elements.playerName.innerText = Utils.sanitizeHTML(nickname);
      }
      
      if (elements.overlayScoreDisplay) {
        elements.overlayScoreDisplay.innerText = rounds;
      }
      
      if (elements.playerRounds) {
        elements.playerRounds.innerText = rounds;
      }
      
      if (elements.targetRounds) {
        elements.targetRounds.innerText = targetRounds;
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
        Utils.showAlert(I18nManager.get("nicknameRequired"));
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
    
    // WebSocket-related handlers
    /**
     * Update queue status message
     * @param {string} message - Status message
     */
    function updateQueueStatus(message) {
      if (elements.pongStatus) {
        elements.pongStatus.innerText = message;
      }
    }
    
    /**
     * Handle opponent leaving the game
     * @param {string} message - Message about opponent leaving
     */
    function handleOpponentLeft(message) {
      gameState.gameActive = false;
      Utils.showAlert(message);
      PageManager.navigateTo("game-page");
    }
    
    /**
     * Update waiting players list
     * @param {Array} waitingList - List of waiting players
     */
    function updateWaitingList(waitingList) {
      if (!elements.waitingPlayersList) return;
      
      elements.waitingPlayersList.innerHTML = "";
      
      if (!waitingList || waitingList.length === 0) {
        const li = document.createElement("li");
        li.innerText = I18nManager.get("noPlayersWaiting");
        li.classList.add("no-players");
        elements.waitingPlayersList.appendChild(li);
        return;
      }
      
      waitingList.forEach(player => {
        const li = document.createElement("li");
        li.className = "list-group-item clickable-player";
        li.innerHTML = `<span class="player-name">${Utils.sanitizeHTML(player.nickname)}</span> <span class="player-rounds">(${I18nManager.get("rounds")}: ${player.rounds})</span>`;
        
        // Add click handler
        li.addEventListener('click', () => {
          console.log("Player clicked:", player);
          
          // Set rounds and update UI
          elements.roundsInput.value = player.rounds;
          gameState.currentGameModeIndex = 0; // Set to "Classic with queue"
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
        });
        
        elements.waitingPlayersList.appendChild(li);
      });
    }
    
    /**
     * Update remote paddle position (for multiplayer)
     * @param {number} y - Y position of remote paddle
     */
    function updateRemotePaddle(y) {
      if (gameState.isMultiplayer && PongGame) {
        PongGame.updateRemotePaddle(y);
      }
    }
    
    /**
     * Handle game start message from server
     * @param {number} rounds - Number of rounds
     */
    function handleGameStart(rounds) {
      if (elements.pongStatus) {
        elements.pongStatus.innerText = "";
      }
      
      if (rounds) {
        gameState.targetRounds = rounds;
        
        if (elements.targetRounds) {
          elements.targetRounds.innerText = rounds;
        }
      }
      
      startGame();
    }
    
    // Public API
    const publicAPI = {
      init,
      startGame,
      startCustomGame,
      endGame,
      updateQueueStatus,
      updateWaitingList,
      updateRemotePaddle,
      handleGameStart,
      handleGameOver,
      handleOpponentLeft,
      handleFullscreenChange,
      getState() {
        return { ...gameState };
      }
    };
    
    return publicAPI;
  })();