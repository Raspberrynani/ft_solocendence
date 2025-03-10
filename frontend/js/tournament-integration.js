/**
 * Tournament Integration Module
 * Integrates the tournament system with the main application
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
      if (!window.App || !window.TournamentManager || !window.TournamentWebSocketConnector) {
        console.log("Tournament Integration: Waiting for required modules...");
        setTimeout(initTournamentIntegration, 100);
        return;
      }
      
      // Modify the main menu to add tournament option
      setupGameModeSelection();
      
      // Connect Tournament system with game over handling
      enhanceGameOverHandler();
      
      // Add style for match alert animation
      addTournamentStyles();
      
      console.log("Tournament Integration: Initialized successfully");
    }
    
    /**
     * Set up game mode selection to handle tournament mode
     */
    function setupGameModeSelection() {
      // Update the start game button click handler to handle tournament mode
      const startGameBtn = document.getElementById("start-game");
      if (!startGameBtn) return;
      
      const originalClickHandler = startGameBtn.onclick;
      
      startGameBtn.onclick = function(e) {
        // Get current game mode
        const currentMode = getCurrentGameMode();
        
        // If tournament mode is selected
        if (currentMode === "tournament") {
          e.preventDefault();
          
          // Get nickname
          const nickname = document.getElementById("nickname").value.trim();
          
          // Validate nickname
          if (!nickname) {
            showError("Please enter a nickname to participate in a tournament");
            return;
          }
          
          // Initialize Tournament Manager if not already initialized
          if (window.TournamentManager) {
            TournamentManager.init({
              username: nickname,
              websocket: window.WebSocketManager
            });
          }
          
          // Initialize WebSocket Connector
          if (window.TournamentWebSocketConnector) {
            TournamentWebSocketConnector.init({
              webSocket: window.WebSocketManager,
              tournamentManager: window.TournamentManager
            });
          }
          
          // Navigate to tournament page
          if (window.UIManager) {
            UIManager.navigateTo("tournament-page");
          }
        } else if (typeof originalClickHandler === "function") {
          // For other modes, use original handler
          originalClickHandler.call(this, e);
        }
      };
    }
    
    /**
     * Enhance the game over handler to support tournaments
     */
    function enhanceGameOverHandler() {
      // Store original game over handler if available
      if (!window.App || !App.handleGameOver) return;
      
      const originalGameOver = App.handleGameOver;
      
      // Override with enhanced version
      App.handleGameOver = function(score, winner) {
        console.log(`Enhanced handleGameOver called: score=${score}, winner=${winner}`);
        
        // Check if this is a tournament game
        if (App.state && App.state.game && App.state.game.isTournament) {
          console.log("Tournament game over detected");
          
          // Determine if current player won
          const playerSide = App.state.game.playerSide || "left";
          const playerWon = (playerSide === "left" && winner === "left") || 
                           (playerSide === "right" && winner === "right");
          
          console.log(`Tournament result: playerSide=${playerSide}, winner=${winner}, playerWon=${playerWon}`);
          
          // Send game over to WebSocket to notify tournament system
          if (App.modules && App.modules.websocket) {
            App.modules.websocket.sendGameOver(score);
          }
          
          // Stop the game
          const isMultiplayer = App.state?.game?.isMultiplayer || false;
          if (isMultiplayer && window.ServerPong) {
            ServerPong.stop();
          } else if (window.PongGame) {
            PongGame.stop();
          }
          
          // Exit fullscreen if needed
          if (typeof App.exitFullscreen === "function") {
            App.exitFullscreen();
          }
          
          // After short delay, navigate based on result
          setTimeout(() => {
            // Check if tournament is complete and player won
            const tournamentComplete = window.TournamentManager && TournamentManager.isTournamentComplete();
            
            if (playerWon) {
              if (tournamentComplete) {
                // Show tournament victory screen
                showTournamentVictory();
              } else {
                // Navigate back to tournament page
                if (window.UIManager) {
                  UIManager.navigateTo("tournament-page");
                }
                
                // Show success message
                showSuccess("Match won! Waiting for next match...");
              }
            } else {
              // Player lost - show message
              showSuccess("Match lost. Tournament complete for you.");
              
              // Reset tournament state
              if (window.TournamentManager) {
                TournamentManager.resetTournamentState();
              }
              
              // Navigate back to main menu
              if (window.UIManager) {
                UIManager.navigateTo("game-page");
              }
            }
          }, 500);
          
          return; // Skip original handler
        }
        
        // Not a tournament game, call original handler
        originalGameOver.apply(App, [score, winner]);
      };
    }
    
    /**
     * Show tournament victory screen
     */
    function showTournamentVictory() {
      if (!window.TournamentManager) return;
      
      const tournamentStats = {
        matchesPlayed: 0,
        totalPlayers: 0
      };
      
      // Calculate stats if tournament data is available
      if (TournamentManager.getCurrentTournament) {
        const tournament = TournamentManager.getCurrentTournament();
        if (tournament) {
          tournamentStats.matchesPlayed = (tournament.completed_matches || []).length;
          tournamentStats.totalPlayers = (tournament.players || []).length;
        }
      }
      
      // Get current player's nickname
      const currentUsername = document.getElementById("nickname")?.value?.trim() || "You";
      
      // Show tournament result
      TournamentManager.showTournamentResult(currentUsername, tournamentStats);
      
      // Reset tournament state after a delay
      setTimeout(() => {
        TournamentManager.resetTournamentState();
        
        // Navigate back to main menu
        if (window.UIManager) {
          UIManager.navigateTo("game-page");
        }
      }, 5000);
    }
    
    /**
     * Add tournament-specific styles
     */
    function addTournamentStyles() {
      if (document.getElementById("tournament-integration-styles")) return;
      
      const style = document.createElement("style");
      style.id = "tournament-integration-styles";
      style.textContent = `
        @keyframes matchAlert {
          0%, 100% { background-color: rgba(0, 0, 0, 0.8); }
          50% { background-color: rgba(255, 153, 0, 0.2); }
        }
        
        .match-alert {
          animation: matchAlert 1s ease-in-out 3;
        }
      `;
      
      document.head.appendChild(style);
    }
    
    /**
     * Get the current game mode from App state
     * @returns {string} Current game mode ID
     */
    function getCurrentGameMode() {
      if (window.App && App.state && App.state.ui) {
        const index = App.state.ui.currentGameModeIndex;
        const modes = App.state.gameModes;
        
        if (modes && modes[index]) {
          return modes[index].id;
        }
      }
      
      return "classic"; // Default to classic mode
    }
    
    /**
     * Show an error message
     * @param {string} message Error message to display
     */
    function showError(message) {
      if (window.Utils && Utils.showAlert) {
        Utils.showAlert(message, "warning");
      } else if (window.App && App.showError) {
        App.showError(message, "warning");
      } else {
        alert(message);
      }
    }
    
    /**
     * Show a success message
     * @param {string} message Success message to display
     */
    function showSuccess(message) {
      if (window.Utils && Utils.showToast) {
        Utils.showToast(message, "success");
      } else if (window.App && App.showToast) {
        App.showToast(message, "success");
      } else {
        console.log(message);
      }
    }
  })();