/**
 * Tournament Fixes Initialization
 * This script applies all tournament-related fixes when the page loads
 */
(function() {
    // Store original App.handleGameOver if it exists
    let originalHandleGameOver;
    
    // Run after DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
      console.log("Initializing tournament fixes...");
      
      // Apply the handleGameOver fix to App.handleGameOver
      if (window.App) {
        // Store reference to the original function
        originalHandleGameOver = App.handleGameOver;
        
        // Override with our enhanced version
        App.handleGameOver = function(score, winner) {
          console.log(`Enhanced handleGameOver called: score=${score}, winner=${winner}`);
          
          // Deadlock Patch
          if (App.state && App.state.game && App.state.game.rounds) {
            const winThreshold = Math.ceil(App.state.game.rounds.target / 2);
            if (winner === undefined && score >= winThreshold) {
              console.log('Winner undefined but score indicates game over - forcing cleanup');
              App.state.game.active = false;
              
              // Stop the appropriate game engine
              if (App.state.game.isMultiplayer && window.ServerPong) {
                ServerPong.stop();
              } else if (window.PongGame) {
                PongGame.stop();
              }
              
              // Exit fullscreen
              if (typeof App.exitFullscreen === 'function') {
                App.exitFullscreen();
              }
              
              // End game and return to menu
              if (typeof App.endPongGame === 'function') {
                App.endPongGame();
              }
              
              return;
            }
          }
  
          // Game is over if we have a definitive winner
          if (winner === 'left' || winner === 'right') {
            console.log('Game is over - processing end game logic');
            if (App.state) App.state.game.active = false; // Game is no longer active
            
            // If this is a tournament game, handle it differently
            if (App.state && App.state.game && App.state.game.isTournament) {
              console.log('Tournament game over - checking if final match');
              
              // Determine if current player won based on playerSide
              const playerSide = App.state.game.playerSide || 'left';
              const playerWon = (playerSide === 'left' && winner === 'left') || 
                               (playerSide === 'right' && winner === 'right');
              
              // Send game over to WebSocket to notify tournament system
              if (App.modules && App.modules.websocket) {
                App.modules.websocket.sendGameOver(App.state.game.rounds.current);
              }
              
              // Stop the appropriate game engine
              if (App.state.game.isMultiplayer && window.ServerPong) {
                ServerPong.stop();
              } else if (window.PongGame) {
                PongGame.stop();
              }
              
              // Exit fullscreen if active
              if (typeof App.exitFullscreen === 'function') {
                App.exitFullscreen();
              }
              
              // Check if this player won AND if this was the final match
              const isFinalVictory = playerWon && window.TournamentManager && 
                typeof TournamentManager.isTournamentComplete === 'function' && 
                TournamentManager.isTournamentComplete();
              
              if (isFinalVictory) {
                // Show tournament victory screen
                console.log("Tournament final victory - showing victory screen");
                showTournamentVictoryScreen();
              } else {
                // For non-winners or non-final matches
                setTimeout(() => {
                  if (playerWon) {
                    if (typeof App.showToast === 'function') {
                      App.showToast('Match won! Waiting for next match...', 'success');
                    }
                  } else {
                    if (typeof App.showToast === 'function') {
                      App.showToast('Match lost. Tournament complete for you.', 'info');
                    }
                    // Non-winners should exit from tournament
                    resetTournamentState();
                  }
                  
                  if (App.modules && App.modules.ui) {
                    App.modules.ui.navigateTo('game-page');
                  }
                }, 500);
              }
              return;
            } 
          }
          
          // For all other cases, call the original handler
          if (typeof originalHandleGameOver === 'function') {
            originalHandleGameOver.call(App, score, winner);
          }
        };
        
        console.log("Enhanced handleGameOver applied");
        
        // Add resetTournamentState to App
        App.resetTournamentState = function() {
          console.log("App.resetTournamentState called");
          
          // Reset tournament state in TournamentManager if available
          if (window.TournamentManager && typeof TournamentManager.resetTournamentState === 'function') {
            TournamentManager.resetTournamentState();
          }
          
          // Remove tournament warning banners if they exist
          const warningBanner = document.getElementById('tournament-warning-banner');
          if (warningBanner) warningBanner.style.display = 'none';
          
          const leaveWarning = document.getElementById('tournament-leave-warning');
          if (leaveWarning) leaveWarning.style.display = 'none';
          
          // Reset localStorage flags that might cause lockups
          try {
            localStorage.removeItem('inTournament');
            localStorage.removeItem('currentGameRoom');
          } catch (e) {
            console.warn("Could not clear localStorage:", e);
          }
          
          // Reset state variables
          if (App.state && App.state.game) {
            App.state.game.isTournament = false;
          }
          
          console.log("Tournament state reset complete");
        };
        
        console.log("Added resetTournamentState to App");
      }
      
      // Create tournament victory screen function
      window.showTournamentVictoryScreen = function() {
        // Create victory screen container
        const victoryScreen = document.createElement('div');
        victoryScreen.className = 'result-screen winner';
        victoryScreen.style.zIndex = 10000; // Ensure it's on top
        
        victoryScreen.innerHTML = `
          <div class="tournament-victory">
            <h2>🏆 TOURNAMENT CHAMPION! 🏆</h2>
            <h3>Congratulations! You've won the tournament!</h3>
            <p class="victory-message">You have defeated all opponents and claimed victory.</p>
            <button class="button" id="victory-continue">CONTINUE</button>
          </div>
        `;
        
        // Add to body
        document.body.appendChild(victoryScreen);
        
        // Add continue button handler
        document.getElementById('victory-continue').addEventListener('click', () => {
          victoryScreen.remove();
          
          // Reset tournament warnings and state
          if (window.App && typeof App.resetTournamentState === 'function') {
            App.resetTournamentState();
          }
          
          // Navigate back to menu
          if (window.UIManager && typeof UIManager.navigateTo === 'function') {
            UIManager.navigateTo('game-page');
          }
        });
        
        return victoryScreen;
      };
      
      // Function to reset tournament state
      window.resetTournamentState = function() {
        if (window.App && typeof App.resetTournamentState === 'function') {
          App.resetTournamentState();
        }
      };
      
      console.log("Tournament fixes initialization complete");
    });
  })();