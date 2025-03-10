/**
 * Tournament Match Progression Fix
 * Apply this code to fix issues with tournament progression between matches
 */
(function() {
    // Store original App.handleGameOver function
    let originalHandleGameOver;
    
    // Function to apply the fix
    function applyTournamentFix() {
      console.log("Applying tournament match progression fix...");
      
      // Only apply if App exists and has handleGameOver
      if (!window.App || typeof App.handleGameOver !== 'function') {
        console.warn("App not found or missing handleGameOver function. Tournament fix not applied.");
        setTimeout(applyTournamentFix, 1000); // Try again in 1 second
        return;
      }
      
      // Store reference to original function
      originalHandleGameOver = App.handleGameOver;
      
      // Override handleGameOver with our enhanced version
      App.handleGameOver = function(score, winner) {
        console.log(`Enhanced tournament handleGameOver: score=${score}, winner=${winner}`);
        
        // Check if this is a tournament game
        if (App.state && App.state.game && App.state.game.isTournament) {
          // Determine if current player won based on playerSide
          const playerSide = App.state.game.playerSide || 'left';
          const playerWon = (playerSide === 'left' && winner === 'left') || 
                           (playerSide === 'right' && winner === 'right');
          
          console.log(`Tournament result: playerSide=${playerSide}, winner=${winner}, playerWon=${playerWon}`);
          
          // Send game over to WebSocket to notify tournament system
          if (App.modules && App.modules.websocket) {
            App.modules.websocket.sendGameOver(score);
          }
          
          // Stop the game engine
          if (App.state.game.isMultiplayer && window.ServerPong) {
            ServerPong.stop();
          } else if (window.PongGame) {
            PongGame.stop();
          }
          
          // Handle fullscreen exit
          if (typeof App.exitFullscreen === 'function') {
            App.exitFullscreen();
          }
          
          // Navigate back to tournament view for winners instead of game page
          setTimeout(() => {
            if (playerWon) {
              // Don't reset tournament state for winners!
              if (App.modules && App.modules.ui) {
                // Force navigation to tournament page
                App.modules.ui.navigateTo('tournament-page');
                
                // Important: Update UI to show active tournament
                const activeTournament = document.getElementById('active-tournament');
                if (activeTournament) {
                  activeTournament.style.display = 'block';
                }
                
                // Hide available tournaments
                const availableTournaments = document.getElementById('available-tournaments');
                if (availableTournaments) {
                  availableTournaments.style.display = 'none';
                }
                
                // Request fresh tournament state
                if (App.modules.websocket) {
                  App.modules.websocket.send({ type: "get_state" });
                }
                
                // Show toast message
                if (typeof App.showToast === 'function') {
                  App.showToast('Match won! Waiting for next match...', 'success');
                }
              }
            } else {
              // For losers, reset tournament state and go to menu
              if (window.TournamentManager) {
                TournamentManager.resetTournamentState();
              }
              
              if (App.modules && App.modules.ui) {
                App.modules.ui.navigateTo('game-page');
              }
              
              // Show message
              if (typeof App.showToast === 'function') {
                App.showToast('Match lost. Tournament complete for you.', 'info');
              }
            }
          }, 500);
          
          return; // Exit early to not call original function
        }
        
        // Not a tournament game, call original function
        if (typeof originalHandleGameOver === 'function') {
          originalHandleGameOver.call(App, score, winner);
        }
      };
      
      // Also add a function to force tournament UI refresh
      App.refreshTournamentUI = function() {
        console.log("Forcing tournament UI refresh");
        
        if (App.modules && App.modules.websocket) {
          // Request tournament state update
          App.modules.websocket.send({ type: "get_state" });
        }
        
        // Make sure tournament UI is visible
        const activeTournament = document.getElementById('active-tournament');
        if (activeTournament) {
          activeTournament.style.display = 'block';
        }
        
        // Hide available tournaments
        const availableTournaments = document.getElementById('available-tournaments');
        if (availableTournaments) {
          availableTournaments.style.display = 'none';
        }
      };
      
      // Add enhancement to WebSocketManager to refresh tournament state
      if (window.WebSocketManager) {
        const originalHandleTournamentUpdate = WebSocketManager.handleTournamentUpdate;
        
        if (typeof originalHandleTournamentUpdate === 'function') {
          WebSocketManager.handleTournamentUpdate = function(tournament) {
            // Call original handler
            if (typeof originalHandleTournamentUpdate === 'function') {
              originalHandleTournamentUpdate.call(WebSocketManager, tournament);
            }
            
            // Force UI refresh if we have App.refreshTournamentUI
            if (window.App && typeof App.refreshTournamentUI === 'function') {
              App.refreshTournamentUI();
            }
            
            // If there's a current match and one of the players is the current player,
            // highlight this to make it more obvious
            if (tournament && tournament.current_match) {
              const currentPlayer = localStorage.getItem('currentPlayer');
              const isPlayerInMatch = tournament.current_match.player1 === currentPlayer || 
                                    tournament.current_match.player2 === currentPlayer;
              
              if (isPlayerInMatch) {
                console.log("Player is in the current match! Highlighting...");
                
                // Highlight the current match element
                const currentMatchElement = document.getElementById('current-match');
                if (currentMatchElement) {
                  currentMatchElement.classList.add('highlight-match');
                  
                  // Add pulsing animation
                  currentMatchElement.style.animation = 'matchPulse 2s infinite';
                }
                
                // Show a more obvious notification
                if (window.App && typeof App.showToast === 'function') {
                  App.showToast("It's your turn to play! Get ready for your match.", "success");
                }
              }
            }
          };
        }
      }
      
      console.log("Tournament match progression fix applied successfully");
    }
    
    // Wait for document to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyTournamentFix);
    } else {
      applyTournamentFix();
    }
  })();