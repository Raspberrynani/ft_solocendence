/**
 * Tournament Integration Script
 * Connects the SimpleTournamentManager to the main application
 * and handles navigation between the main menu and tournament page.
 */
(function() {
    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function() {
      console.log('Tournament Integration: Initializing');
      
      // Check if the SimpleTournamentManager exists
      if (!window.SimpleTournamentManager) {
        console.error('SimpleTournamentManager not found');
        return;
      }
      
      // Check if App exists
      if (!window.App) {
        console.error('App not found');
        return;
      }
      
      // Initialize UI elements
      initializeTournamentUI();
      
      // Set up event handlers for tournament navigation
      setupTournamentNavigation();
      
      // Connect WebSocket handlers to SimpleTournamentManager
      connectWebSocketHandlers();
      
      // Handle game over events for tournaments
      overrideGameOverHandler();
      
      console.log('Tournament Integration: Initialization complete');
    });
    
    /**
     * Initialize tournament UI elements
     */
    function initializeTournamentUI() {
      // Find the tournament option in the game mode selector
      const gameModes = document.querySelectorAll('.game-mode-indicator');
      gameModes.forEach(mode => {
        if (mode.textContent.includes('Tournament')) {
          // Store the index for tournament mode
          window.tournamentModeIndex = Array.from(gameModes).indexOf(mode);
        }
      });
      
      // Ensure the tournament rounds input exists
      const roundsInput = document.getElementById('tournament-rounds-input');
      if (!roundsInput && document.getElementById('tournament-page')) {
        // If missing, create it dynamically
        const input = document.createElement('input');
        input.id = 'tournament-rounds-input';
        input.type = 'number';
        input.value = '3';
        input.min = '1';
        input.max = '9';
        input.className = 'form-control mb-3';
        
        // Find the appropriate place to insert it
        const createBtn = document.getElementById('create-tournament');
        if (createBtn && createBtn.parentNode) {
          createBtn.parentNode.insertBefore(input, createBtn);
        }
      }
    }
    
    /**
     * Set up event handlers for tournament navigation
     */
    function setupTournamentNavigation() {
      // Handle navigation to tournament page from main menu
      const startGameBtn = document.getElementById('start-game');
      if (startGameBtn) {
        const originalClickHandler = startGameBtn.onclick;
        
        startGameBtn.onclick = function(e) {
          // Get the current game mode
          const gameMode = getCurrentGameMode();
          
          // If tournament mode is selected
          if (gameMode === 'tournament') {
            e.preventDefault();
            
            // Get nickname from input
            const nickname = document.getElementById('nickname').value.trim();
            
            // Validate nickname
            if (!nickname) {
              showError('Please enter your nickname to join a tournament');
              return;
            }
            
            // Navigate to tournament page
            if (window.UIManager && typeof UIManager.navigateTo === 'function') {
              UIManager.navigateTo('tournament-page');
              
              // Initialize SimpleTournamentManager with nickname
              const elements = getTournamentElements();
              SimpleTournamentManager.init(elements, nickname);
            }
          } else if (originalClickHandler) {
            // For other game modes, use the original handler
            originalClickHandler.call(this, e);
          }
        };
      }
      
      // Handle back button from tournament page
      const backButton = document.getElementById('tournament-back-button');
      if (backButton) {
        backButton.onclick = function(e) {
          e.preventDefault();
          
          // Check if player is in a tournament
          if (SimpleTournamentManager.isInTournament()) {
            // Confirm before leaving
            if (confirm('Leaving will remove you from the current tournament. Continue?')) {
              SimpleTournamentManager.leaveTournament();
              navigateToMainMenu();
            }
          } else {
            navigateToMainMenu();
          }
        };
      }
    }
    
    /**
     * Connect WebSocket handlers to SimpleTournamentManager
     */
    function connectWebSocketHandlers() {
      // Store original WebSocket methods
      if (window.WebSocketManager) {
        const originalReceive = WebSocketManager.receive;
        
        // Enhance with tournament handlers
        if (typeof originalReceive === 'function') {
          WebSocketManager.receive = function(event) {
            // Call original handler
            originalReceive.call(WebSocketManager, event);
            
            try {
              const data = JSON.parse(event.data);
              
              // Route tournament-related messages to SimpleTournamentManager
              switch (data.type) {
                case 'tournament_list':
                  SimpleTournamentManager.updateTournamentList(data.tournaments);
                  break;
                case 'tournament_created':
                  SimpleTournamentManager.handleTournamentCreated(data.tournament);
                  break;
                case 'tournament_joined':
                  SimpleTournamentManager.handleTournamentJoined(data.tournament);
                  break;
                case 'tournament_update':
                  SimpleTournamentManager.handleTournamentUpdate(data.tournament);
                  break;
                case 'tournament_left':
                  SimpleTournamentManager.handleTournamentLeft();
                  break;
                case 'tournament_error':
                  SimpleTournamentManager.handleTournamentError(data.message);
                  break;
              }
            } catch (error) {
              console.error('Error processing WebSocket message:', error);
            }
          };
        }
      }
    }
    
    /**
     * Override the game over handler to handle tournament games
     */
    function overrideGameOverHandler() {
      // Store original game over handler
      if (window.App && App.handleGameOver) {
        const originalGameOver = App.handleGameOver;
        
        // Override with enhanced version
        App.handleGameOver = function(score, winner) {
          console.log(`Enhanced handleGameOver called: score=${score}, winner=${winner}`);
          
          // Check if this is a tournament game
          if (App.state && App.state.game && App.state.game.isTournament) {
            console.log('Tournament game over - determining winner status');
            
            // Determine if current player won based on playerSide
            const playerSide = App.state.game.playerSide || 'left';
            const playerWon = (playerSide === 'left' && winner === 'left') || 
                            (playerSide === 'right' && winner === 'right');
            
            console.log(`Tournament result: playerSide=${playerSide}, winner=${winner}, playerWon=${playerWon}`);
            
            // Send game over to WebSocket to notify tournament system
            if (App.modules && App.modules.websocket) {
              App.modules.websocket.sendGameOver(score);
            }
            
            // Stop the game
            if (App.state.game.isMultiplayer && window.ServerPong) {
              ServerPong.stop();
            } else if (window.PongGame) {
              PongGame.stop();
            }
            
            // Exit fullscreen if active
            if (typeof App.exitFullscreen === 'function') {
              App.exitFullscreen();
            }
            
            // Check if this was the final tournament match and player won
            const isFinalMatch = SimpleTournamentManager.isTournamentComplete();
            
            if (playerWon && isFinalMatch) {
              // Show tournament victory screen
              console.log("Tournament final victory - showing victory screen");
              showTournamentVictoryScreen();
              return;
            } else {
              // Regular tournament match end
              if (playerWon) {
                showSuccess('Match won! Waiting for next match...');
              } else {
                showSuccess('Match lost. Tournament complete for you.');
                // Non-winners should exit the tournament
                SimpleTournamentManager.resetTournamentState();
              }
              
              // Navigate back to tournament page
              setTimeout(() => {
                if (window.UIManager) {
                  UIManager.navigateTo('tournament-page');
                }
              }, 500);
              return;
            }
          }
          
          // For non-tournament games, call the original handler
          originalGameOver.call(App, score, winner);
        };
      }
    }
    
    /**
     * Show tournament victory screen
     */
    function showTournamentVictoryScreen() {
      // Create victory screen from template
      const template = document.getElementById('tournament-victory-template');
      if (!template) {
        console.error('Tournament victory template not found');
        return;
      }
      
      // Clone template content
      const victoryScreen = document.importNode(template.content, true).firstElementChild;
      document.body.appendChild(victoryScreen);
      
      // Add continue button handler
      document.getElementById('victory-continue').addEventListener('click', () => {
        victoryScreen.remove();
        
        // Reset tournament state
        SimpleTournamentManager.resetTournamentState();
        
        // Navigate back to menu
        navigateToMainMenu();
      });
    }
    
    /**
     * Navigate back to the main menu
     */
    function navigateToMainMenu() {
      if (window.UIManager && typeof UIManager.navigateTo === 'function') {
        UIManager.navigateTo('game-page');
      }
    }
    
    /**
     * Get the current game mode
     * @returns {string} - Current game mode
     */
    function getCurrentGameMode() {
      if (window.App && App.state && App.state.ui) {
        const index = App.state.ui.currentGameModeIndex;
        const modes = App.state.gameModes;
        
        if (modes && modes[index]) {
          return modes[index].id;
        }
      }
      
      return 'classic'; // Default to classic mode
    }
    
    /**
     * Get references to tournament UI elements
     * @returns {Object} - Element references
     */
    function getTournamentElements() {
      return {
        createTournament: document.getElementById('create-tournament'),
        startTournament: document.getElementById('start-tournament'),
        leaveTournament: document.getElementById('leave-tournament'),
        tournamentName: document.getElementById('tournament-name'),
        tournamentPlayers: document.getElementById('tournament-players'),
        currentMatch: document.getElementById('current-match'),
        upcomingMatches: document.getElementById('upcoming-matches'),
        completedMatches: document.getElementById('completed-matches'),
        tournamentList: document.getElementById('tournament-list'),
        activeTournament: document.getElementById('active-tournament'),
        availableTournaments: document.getElementById('available-tournaments'),
        roundsInput: document.getElementById('tournament-rounds-input') || document.getElementById('rounds-input')
      };
    }
    
    /**
     * Show an error message
     * @param {string} message - Error message
     */
    function showError(message) {
      if (window.Utils && Utils.showAlert) {
        Utils.showAlert(message, 'warning');
      } else if (window.App && App.showError) {
        App.showError(message, 'warning');
      } else {
        alert(message);
      }
    }
    
    /**
     * Show a success message
     * @param {string} message - Success message
     */
    function showSuccess(message) {
      if (window.Utils && Utils.showToast) {
        Utils.showToast(message, 'success');
      } else if (window.App && App.showToast) {
        App.showToast(message, 'success');
      } else {
        console.log(message);
      }
    }
    
  })();