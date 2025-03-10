/**
 * Tournament UI Enhancement
 * Improves visibility of current matches and tournament state
 */
(function() {
    // Add CSS to make tournament matches more visible
    function addStyles() {
      if (document.getElementById('tournament-enhancement-styles')) {
        return; // Already added
      }
      
      const styles = document.createElement('style');
      styles.id = 'tournament-enhancement-styles';
      styles.textContent = `
        .current-match {
          position: relative;
          animation: pulseBackground 3s infinite;
          border: 2px solid rgba(0, 212, 255, 0.8) !important;
          box-shadow: 0 0 15px rgba(0, 212, 255, 0.5);
          padding: 15px !important;
          margin-bottom: 15px !important;
          background-color: rgba(0, 50, 100, 0.2);
        }
        
        .current-match.highlight-match {
          animation: highlightMatch 2s infinite;
          border: 2px solid #ff9900 !important;
          box-shadow: 0 0 20px rgba(255, 153, 0, 0.6);
        }
        
        .current-match.highlight-match::before {
          content: "👉 YOUR MATCH! 👈";
          position: absolute;
          top: -30px;
          left: 0;
          right: 0;
          text-align: center;
          color: #ff9900;
          font-weight: bold;
          font-size: 16px;
          text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
        }
        
        .current-match .match-players {
          font-size: 18px;
          font-weight: bold;
        }
        
        .tournament-notification {
          position: fixed;
          top: 70px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0, 0, 0, 0.8);
          color: #fff;
          padding: 15px 25px;
          border-radius: 8px;
          z-index: 9999;
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.6);
          border: 2px solid rgba(0, 212, 255, 0.6);
          text-align: center;
          max-width: 80%;
          font-weight: bold;
        }
        
        .play-button {
          display: inline-block;
          margin-top: 10px;
          padding: 8px 20px;
          background-color: #FF9900;
          color: #000;
          border: none;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .play-button:hover {
          background-color: #ffb340;
          transform: scale(1.05);
        }
        
        @keyframes pulseBackground {
          0%, 100% { background-color: rgba(0, 50, 100, 0.2); }
          50% { background-color: rgba(0, 50, 100, 0.4); }
        }
        
        @keyframes highlightMatch {
          0%, 100% { 
            background-color: rgba(255, 153, 0, 0.2);
            box-shadow: 0 0 20px rgba(255, 153, 0, 0.3);
          }
          50% { 
            background-color: rgba(255, 153, 0, 0.3);
            box-shadow: 0 0 25px rgba(255, 153, 0, 0.6);
          }
        }
        
        #tournament-name {
          color: #00d4ff;
          text-shadow: 0 0 5px rgba(0, 212, 255, 0.5);
        }
        
        .tournament-status.started {
          animation: statusBlink 2s infinite;
          font-weight: bold;
        }
        
        @keyframes statusBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        /* Make the active tournament more prominent */
        #active-tournament {
          border: 2px solid rgba(0, 212, 255, 0.3);
          border-radius: 10px;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
          background-color: rgba(0, 30, 60, 0.2);
        }
      `;
      
      document.head.appendChild(styles);
    }
    
    // Show a notification when a match is ready
    function showMatchNotification(playerName) {
      // Remove existing notifications
      const existingNotification = document.querySelector('.tournament-notification');
      if (existingNotification) {
        existingNotification.remove();
      }
      
      // Create notification
      const notification = document.createElement('div');
      notification.className = 'tournament-notification';
      notification.innerHTML = `
        <div>Your match is starting!</div>
        <div>You are playing against: <strong>${playerName}</strong></div>
        <button class="play-button">GO TO MATCH</button>
      `;
      
      // Add event handler for play button
      notification.querySelector('.play-button').addEventListener('click', () => {
        // Remove notification
        notification.remove();
        
        // Find and click the current match element
        const currentMatch = document.querySelector('.current-match.highlight-match');
        if (currentMatch) {
          currentMatch.click();
        } else {
          // Navigate to tournament page as fallback
          if (window.UIManager && typeof UIManager.navigateTo === 'function') {
            UIManager.navigateTo('tournament-page');
          }
        }
      });
      
      // Add to DOM
      document.body.appendChild(notification);
      
      // Auto-remove after 8 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.remove();
        }
      }, 8000);
    }
    
    // Enhanced tournament update handler
    function enhanceTournamentManager() {
      if (!window.TournamentManager) {
        setTimeout(enhanceTournamentManager, 1000); // Try again in 1 second
        return;
      }
      
      // Store original method
      const originalHandleTournamentUpdate = TournamentManager.handleTournamentUpdate;
      
      // Override with enhanced version
      TournamentManager.handleTournamentUpdate = function(tournament) {
        // Call original function
        if (typeof originalHandleTournamentUpdate === 'function') {
          originalHandleTournamentUpdate.call(TournamentManager, tournament);
        }
        
        // Check if the current player is in the current match
        if (tournament && tournament.current_match) {
          const currentPlayer = localStorage.getItem('currentPlayer') || '';
          
          if (currentPlayer && (
              tournament.current_match.player1 === currentPlayer || 
              tournament.current_match.player2 === currentPlayer)) {
            console.log("Current player is in the active match!");
            
            // Find current match element and highlight it
            const currentMatchElement = document.getElementById('current-match');
            if (currentMatchElement) {
              currentMatchElement.classList.add('highlight-match');
              
              // Find opponent name
              const opponentName = tournament.current_match.player1 === currentPlayer ? 
                tournament.current_match.player2 : 
                tournament.current_match.player1;
              
              // Show notification
              showMatchNotification(opponentName);
            }
          }
        }
      };
      
      console.log("Enhanced TournamentManager with better UI highlighting");
    }
    
    // Main function to apply all enhancements
    function applyEnhancements() {
      console.log("Applying tournament UI enhancements...");
      
      // Add styles
      addStyles();
      
      // Enhance TournamentManager
      enhanceTournamentManager();
      
      // Check for current match on page load
      setTimeout(() => {
        if (window.TournamentManager && TournamentManager._currentTournamentState) {
          const tournament = TournamentManager._currentTournamentState;
          
          if (tournament && tournament.current_match) {
            const currentPlayer = localStorage.getItem('currentPlayer') || '';
            
            if (currentPlayer && (
                tournament.current_match.player1 === currentPlayer || 
                tournament.current_match.player2 === currentPlayer)) {
              
              // Find current match element and highlight it
              const currentMatchElement = document.getElementById('current-match');
              if (currentMatchElement) {
                currentMatchElement.classList.add('highlight-match');
                
                // Find opponent name
                const opponentName = tournament.current_match.player1 === currentPlayer ? 
                  tournament.current_match.player2 : 
                  tournament.current_match.player1;
                
                // Show notification
                showMatchNotification(opponentName);
              }
            }
          }
        }
      }, 1000); // Check after 1 second
      
      console.log("Tournament UI enhancements applied");
    }
    
    // Apply enhancements when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyEnhancements);
    } else {
      applyEnhancements();
    }
  })();