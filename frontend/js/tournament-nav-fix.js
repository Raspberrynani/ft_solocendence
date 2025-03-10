/**
 * Tournament Navigation Enhancement
 * Ensures players stay in tournament view until properly eliminated
 */
(function() {
    // Store references to original methods
    let originalNavigateTo;
    let originalPageChange;
    
    // Function to apply the fix
    function applyNavigationFix() {
      console.log("Applying tournament navigation enhancement...");
      
      // Only apply if UIManager exists
      if (!window.UIManager || typeof UIManager.navigateTo !== 'function') {
        console.warn("UIManager not found. Tournament navigation fix not applied.");
        setTimeout(applyNavigationFix, 1000); // Try again in 1 second
        return;
      }
      
      // Store reference to original function
      originalNavigateTo = UIManager.navigateTo;
      
      // Override navigateTo with enhanced version
      UIManager.navigateTo = function(pageId) {
        console.log(`Enhanced navigation requested to: ${pageId}`);
        
        // Check if we're in a tournament and trying to navigate away
        if (isTournamentActive() && pageId !== 'tournament-page' && pageId !== 'pong-page') {
          // Show confirmation dialog
          const confirmLeave = confirm("WARNING: Navigating away will remove you from the tournament. Continue?");
          
          if (!confirmLeave) {
            console.log("Navigation canceled - staying in tournament");
            
            // Force tournament page instead
            if (typeof originalNavigateTo === 'function') {
              originalNavigateTo.call(UIManager, 'tournament-page');
            }
            
            // Force tournament UI refresh
            if (window.App && typeof App.refreshTournamentUI === 'function') {
              App.refreshTournamentUI();
            }
            
            return;
          } else {
            console.log("User confirmed tournament exit");
            
            // User chose to exit - clean up tournament state
            if (window.TournamentManager && typeof TournamentManager.resetTournamentState === 'function') {
              TournamentManager.resetTournamentState();
            }
            
            // Remove from tournament via WebSocket
            if (window.WebSocketManager && typeof WebSocketManager.leaveTournament === 'function') {
              WebSocketManager.leaveTournament();
            }
          }
        }
        
        // Call original method
        if (typeof originalNavigateTo === 'function') {
          originalNavigateTo.call(UIManager, pageId);
        }
      };
      
      // Enhanced handlePageChange to keep tournament UI refreshed
      if (window.App && App.modules && App.modules.ui && typeof App.modules.ui.handlePageChange === 'function') {
        originalPageChange = App.modules.ui.handlePageChange;
        
        App.modules.ui.handlePageChange = function(pageId) {
          // Call original function
          if (typeof originalPageChange === 'function') {
            originalPageChange.call(App.modules.ui, pageId);
          }
          
          // Extra actions for tournament page
          if (pageId === 'tournament-page' && isTournamentActive()) {
            console.log("Enhancing tournament page navigation");
            
            // Show the active tournament section
            const activeTournament = document.getElementById('active-tournament');
            if (activeTournament) {
              activeTournament.style.display = 'block';
            }
            
            // Hide available tournaments list
            const availableTournaments = document.getElementById('available-tournaments');
            if (availableTournaments) {
              availableTournaments.style.display = 'none';
            }
            
            // Refresh tournament state
            if (window.WebSocketManager) {
              WebSocketManager.send({ type: "get_state" });
            }
          }
        };
      }
      
      console.log("Tournament navigation enhancement applied");
    }
    
    /**
     * Check if player is currently in an active tournament
     */
    function isTournamentActive() {
      // Method 1: Check TournamentManager
      if (window.TournamentManager && typeof TournamentManager.isInTournament === 'function') {
        const inTournament = TournamentManager.isInTournament();
        if (inTournament) return true;
      }
      
      // Method 2: Check localStorage flag (backup)
      try {
        const tournamentFlag = localStorage.getItem('inTournament');
        if (tournamentFlag === 'true') return true;
      } catch (e) {
        console.warn("Error checking localStorage:", e);
      }
      
      // Method 3: Check App state if available
      if (window.App && App.state && App.state.game) {
        return App.state.game.isTournament === true;
      }
      
      return false;
    }
    
    // Wait for document to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyNavigationFix);
    } else {
      applyNavigationFix();
    }
  })();