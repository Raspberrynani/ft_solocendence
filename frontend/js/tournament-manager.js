/**
 * Tournament Manager Module - Optimized
 * Handles tournament creation, joining, and UI updates
 */
const TournamentManager = (function() {
    // Private variables
    let currentTournament = null;
    let isTournamentCreator = false;
    let elements = {};
    let currentNickname = "";
    
    /**
     * Initialize the tournament manager
     * @param {Object} elementRefs - References to DOM elements
     * @param {string} nickname - Current player's nickname
     * @returns {boolean} - Whether initialization was successful
     */
    function init(elementRefs, nickname) {
      console.log("TournamentManager: Initializing with nickname:", nickname);
      
      // Validate parameters
      if (!elementRefs) {
        console.error("Missing element references");
        return false;
      }
      
      // Store references
      elements = elementRefs;
      currentNickname = nickname || "";
      
      // Add event listeners if elements exist
      setupEventListeners();
      
      // Request latest tournament list if WebSocket is available
      if (typeof WebSocketManager !== 'undefined' && WebSocketManager.isConnected && WebSocketManager.isConnected()) {
        WebSocketManager.send({
          type: "get_tournaments"
        });
      }
      
      console.log("TournamentManager initialized successfully");
      return true;
    }

    /**
     * Show waiting for next match screen
     * @param {boolean} playerWon - Whether the player won the last match
     */
    function showWaitingForNextMatch(playerWon) {
      const waitingOverlay = document.createElement('div');
      waitingOverlay.id = 'tournament-waiting-overlay';
      waitingOverlay.className = 'tournament-waiting-overlay';
      waitingOverlay.innerHTML = `
          <div class="waiting-content">
              <h3>${playerWon ? '🏆 Match Victory!' : 'Match Complete'}</h3>
              <p>${playerWon ? 
                  'Congratulations! You won the match.' : 
                  'Match completed. Better luck in the next one!'}</p>
              <div class="waiting-animation">
                  <p>Waiting for next match...</p>
                  <div class="waiting-spinner"></div>
              </div>
              <p class="waiting-tip">Stay on this page until your next match begins</p>
          </div>
      `;
      
      document.body.appendChild(waitingOverlay);
      
      // Add overlay styles if not already added
      if (!document.getElementById('tournament-waiting-styles')) {
          const waitingStyles = document.createElement('style');
          waitingStyles.id = 'tournament-waiting-styles';
          waitingStyles.textContent = `
              .tournament-waiting-overlay {
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background: rgba(0, 0, 0, 0.8);
                  z-index: 9999;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  color: white;
                  font-family: Arial, sans-serif;
              }
              
              .waiting-content {
                  background: rgba(0, 20, 40, 0.8);
                  border: 2px solid #00d4ff;
                  border-radius: 10px;
                  padding: 30px;
                  text-align: center;
                  max-width: 400px;
                  box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
              }
              
              .waiting-content h3 {
                  font-size: 24px;
                  margin-bottom: 15px;
                  color: #00d4ff;
              }
              
              .waiting-animation {
                  margin: 25px 0;
              }
              
              .waiting-spinner {
                  width: 40px;
                  height: 40px;
                  margin: 15px auto;
                  border: 4px solid rgba(0, 212, 255, 0.3);
                  border-top: 4px solid #00d4ff;
                  border-radius: 50%;
                  animation: spin 2s linear infinite;
              }
              
              .waiting-tip {
                  font-size: 14px;
                  opacity: 0.7;
                  margin-top: 20px;
              }
              
              @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
              }
          `;
          document.head.appendChild(waitingStyles);
      }
      
      return waitingOverlay;
    }

    /**
    * Hide waiting overlay
    */
    function hideWaitingOverlay() {
      const overlay = document.getElementById('tournament-waiting-overlay');
      if (overlay) {
          // Fade out and remove
          overlay.style.transition = 'opacity 0.5s';
          overlay.style.opacity = '0';
          setTimeout(() => {
              if (overlay.parentNode) {
                  overlay.parentNode.removeChild(overlay);
              }
          }, 500);
      }
    }

    /**
    * Handle match ready event (called when server signals match is ready)
    * @param {string} message - Server message
    */
    function handleMatchReady(message) {
      console.log("Match ready:", message);
      
      // Hide the waiting overlay


      hideWaitingOverlay();
      
      // Show toast notification
      if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast(message || "Your match is starting!", "info");
      }
      
      // Ensure we're on tournament page
      if (window.UIManager) {
          UIManager.navigateTo('tournament-page');
      }
    }

    /**
     * Show match waiting screen between tournament matches
     * @param {boolean} playerWon - Whether the current player won the last match
     */
    function showMatchWaitingScreen(playerWon) {
      console.log("Showing tournament match waiting screen");
      
      // Create the waiting screen if it doesn't exist
      let waitingScreen = document.getElementById('tournament-waiting-screen');
      if (!waitingScreen) {
          waitingScreen = document.createElement('div');
          waitingScreen.id = 'tournament-waiting-screen';
          waitingScreen.className = 'tournament-waiting-screen';
          waitingScreen.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.8);
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              z-index: 1000;
              color: white;
              text-align: center;
          `;
          
          // Create content
          const content = document.createElement('div');
          content.innerHTML = `
              <h2>${playerWon ? '🏆 Victory! 🏆' : 'Match Complete'}</h2>
              <p class="match-result">${playerWon ? 
                  'Congratulations! You won this match!' : 
                  'This match is complete.'}</p>
              <div class="waiting-message mt-4">
                  <p>Waiting for next tournament match...</p>
                  <div class="next-match-countdown mt-3">
                      <p>Next match starts in: <span id="match-countdown">10</span></p>
                  </div>
              </div>
              <div class="tournament-status mt-4">
                  <p>Tournament in progress. Please don't navigate away.</p>
              </div>
          `;
          
          waitingScreen.appendChild(content);
          document.body.appendChild(waitingScreen);
          
          // Start countdown
          startMatchCountdown(10);
      } else {
          // Update existing waiting screen
          const resultElement = waitingScreen.querySelector('.match-result');
          if (resultElement) {
              resultElement.textContent = playerWon ? 
                  'Congratulations! You won this match!' : 
                  'This match is complete.';
          }
          
          // Show the waiting screen
          waitingScreen.style.display = 'flex';
          
          // Restart countdown
          startMatchCountdown(10);
      }
    }

    /**
     * Set up event listeners for tournament controls
     */
    function setupEventListeners() {
      // Create tournament button
      if (elements.createTournament) {
        elements.createTournament.addEventListener('click', () => {
          console.log("Tournament creation button clicked");
          if (!validateNickname()) {
            showError("Please enter your nickname first");
            return;
          }
          createTournament();
        });
      }
      
      // Start tournament button
      if (elements.startTournament) {
        elements.startTournament.addEventListener('click', () => {
          const tournamentId = getCurrentTournamentId();
          if (tournamentId) {
            if (typeof WebSocketManager !== 'undefined') {
              WebSocketManager.send({
                type: "start_tournament",
                tournament_id: tournamentId
              });
            }
          } else {
            showError("No active tournament");
          }
        });
      }
      
      // Leave tournament button
      if (elements.leaveTournament) {
        elements.leaveTournament.addEventListener('click', () => {
          if (isInTournament()) {
            if (typeof WebSocketManager !== 'undefined') {
              WebSocketManager.send({
                type: "leave_tournament"
              });
            }
            resetTournamentState();
          } else {
            showError("No active tournament");
          }
        });
      }
    }

    /**
     * Start countdown for next match
     * @param {number} seconds - Seconds to count down
     */
    function startMatchCountdown(seconds) {
      const countdownElement = document.getElementById('match-countdown');
      if (!countdownElement) return;
      
      let count = seconds;
      countdownElement.textContent = count;
      
      const interval = setInterval(() => {
          count--;
          if (countdownElement) {
              countdownElement.textContent = count;
          }
          
          if (count <= 0) {
              clearInterval(interval);
              // Hide waiting screen once countdown is complete
              hideMatchWaitingScreen();
          }
      }, 1000);
    }

    /**
    * Hide match waiting screen
    */
    function hideMatchWaitingScreen() {
      const waitingScreen = document.getElementById('tournament-waiting-screen');
      if (waitingScreen) {
          waitingScreen.style.display = 'none';
      }
    }
    
    /**
     * Validate that the nickname is set
     * @returns {boolean} - Whether nickname is valid
     */
    function validateNickname() {
      return currentNickname && currentNickname.trim().length > 0;
    }
    
    /**
     * Show an error message using Utils or alert
     * @param {string} message - Error message to display
     */
    function showError(message) {
      if (typeof Utils !== 'undefined' && Utils.showAlert) {
        Utils.showAlert(message);
      } else {
        alert(message);
      }
    }
    
    /**
     * Create a new tournament
     * @returns {boolean} - Whether creation request was sent
     */
    function createTournament() {
      if (!WebSocketManager || !WebSocketManager.isConnected()) {
        showError("Cannot create tournament: Not connected to server");
        return false;
      }
      
      if (!validateNickname()) {
        showError("Please enter your nickname first");
        return false;
      }
      
      // Get rounds from rounds input
      const rounds = elements.roundsInput && parseInt(elements.roundsInput.value) || 3;
      
      console.log("Creating tournament:", {
        nickname: currentNickname,
        rounds: rounds
      });
      
      // Use specialized WebSocketManager method if available
      if (WebSocketManager.createTournament) {
        return WebSocketManager.createTournament(currentNickname, `${currentNickname}'s Tournament`, rounds);
      } else {
        // Fallback to generic send
        return WebSocketManager.send({
          type: "create_tournament",
          nickname: currentNickname,
          name: `${currentNickname}'s Tournament`,
          rounds: rounds
        });
      }
    }
    
    /**
     * Join an existing tournament
     * @param {string} tournamentId - ID of tournament to join
     * @returns {boolean} - Whether join request was sent
     */
    function joinTournament(tournamentId) {
      if (!WebSocketManager || !WebSocketManager.isConnected()) {
        showError("Cannot join tournament: Not connected to server");
        return false;
      }
      
      if (!validateNickname()) {
        showError("Please enter your nickname first");
        return false;
      }
      
      // Use specialized WebSocketManager method if available
      if (WebSocketManager.joinTournament) {
        return WebSocketManager.joinTournament(tournamentId, currentNickname);
      } else {
        // Fallback to generic send
        return WebSocketManager.send({
          type: "join_tournament",
          tournament_id: tournamentId,
          nickname: currentNickname
        });
      }
    }
    
    /**
     * Leave the current tournament
     * @returns {boolean} - Whether leave request was sent
     */
    function leaveTournament() {
      if (!isInTournament()) {
        console.log("Not in a tournament, nothing to leave");
        return false;
      }
      
      if (!WebSocketManager || !WebSocketManager.isConnected()) {
        showError("Cannot leave tournament: Not connected to server");
        return false;
      }
      
      // Use specialized WebSocketManager method if available
      if (WebSocketManager.leaveTournament) {
        const result = WebSocketManager.leaveTournament();
        if (result) resetTournamentState();
        return result;
      } else {
        // Fallback to generic send
        const result = WebSocketManager.send({
          type: "leave_tournament"
        });
        if (result) resetTournamentState();
        return result;
      }
    }
    
    /**
     * Start the current tournament
     * @returns {boolean} - Whether start request was sent
     */
    function startTournament() {
      const tournamentId = getCurrentTournamentId();
      
      if (!tournamentId) {
        showError("No active tournament to start");
        return false;
      }
      
      if (!isTournamentCreator) {
        showError("Only the tournament creator can start the tournament");
        return false;
      }
      
      if (!WebSocketManager || !WebSocketManager.isConnected()) {
        showError("Cannot start tournament: Not connected to server");
        return false;
      }
      
      // Use specialized WebSocketManager method if available
      if (WebSocketManager.startTournament) {
        return WebSocketManager.startTournament(tournamentId);
      } else {
        // Fallback to generic send
        return WebSocketManager.send({
          type: "start_tournament",
          tournament_id: tournamentId
        });
      }
    }
    
    /**
     * Update the tournament list
     * @param {Array} tournaments - List of available tournaments
     */
    function updateTournamentList(tournaments) {
      console.log("Updating tournament list:", tournaments);
      
      if (!elements.tournamentList) {
        console.error("Tournament list element not found");
        return;
      }
      
      elements.tournamentList.innerHTML = '';
      
      if (!tournaments || tournaments.length === 0) {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerText = 'No tournaments available';
        elements.tournamentList.appendChild(li);
        return;
      }
      
      tournaments.forEach(tournament => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        
        // Sanitize tournament name if Utils is available
        const tournamentName = typeof Utils !== 'undefined' && Utils.sanitizeHTML ? 
          Utils.sanitizeHTML(tournament.name) : 
          tournament.name;
        
        li.innerHTML = `
          <div class="tournament-info">
            <span>${tournamentName}</span>
            <span>
              <span class="badge bg-primary">${tournament.players} players</span>
              <span class="tournament-status ${tournament.started ? 'started' : ''}">${tournament.started ? 'In Progress' : 'Waiting'}</span>
            </span>
          </div>
        `;
        
        // Only allow joining if tournament hasn't started
        if (!tournament.started) {
          li.style.cursor = 'pointer';
          li.addEventListener('click', () => {
            console.log("Joining tournament:", tournament.id);
            joinTournament(tournament.id);
          });
        }
        
        elements.tournamentList.appendChild(li);
      });
    }
    
    /**
     * Handle tournament created event
     * @param {Object} tournament - Tournament data
     */
    function handleTournamentCreated(tournament) {
      console.log("Tournament created:", tournament);
      
      if (!tournament) {
        console.error("Invalid tournament data");
        return;
      }
      
      currentTournament = tournament;
      isTournamentCreator = true;
      
      // Show tournament info
      updateTournamentUI(tournament);
      
      // Show the active tournament section
      if (elements.activeTournament) {
        elements.activeTournament.style.display = 'block';
      }
      
      // Show start tournament button since user is creator
      if (elements.startTournament) {
        elements.startTournament.style.display = 'block';
      }
      
      // Hide available tournaments
      if (elements.availableTournaments) {
        elements.availableTournaments.style.display = 'none';
      }
      
      // Show toast notification if Utils is available
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast("Tournament created successfully!", "success");
      }
    }
    
    /**
     * Update tournament UI
     * @param {Object} tournament - Tournament data
     */
    function updateTournamentUI(tournament) {
      if (!tournament) return;
      
      // Update tournament name
      if (elements.tournamentName) {
        // Sanitize tournament name if Utils is available
        const tournamentName = typeof Utils !== 'undefined' && Utils.sanitizeHTML ? 
          Utils.sanitizeHTML(tournament.name) : 
          tournament.name;
        
        elements.tournamentName.innerText = tournamentName;
      }
      
      // Update player list
      if (elements.tournamentPlayers) {
        elements.tournamentPlayers.innerHTML = '';
        
        tournament.players.forEach(player => {
          const li = document.createElement('li');
          li.className = 'list-group-item';
          
          // Sanitize player name if Utils is available
          const playerName = typeof Utils !== 'undefined' && Utils.sanitizeHTML ? 
            Utils.sanitizeHTML(player) : 
            player;
          
          li.innerHTML = `
            <span>${playerName}</span>
            ${player === currentNickname ? '<span class="badge bg-info">You</span>' : ''}
          `;
          elements.tournamentPlayers.appendChild(li);
        });
      }
      
      // Update current match
      if (elements.currentMatch) {
        if (tournament.current_match) {
          // Sanitize player names if Utils is available
          const sanitize = typeof Utils !== 'undefined' && Utils.sanitizeHTML ? 
            Utils.sanitizeHTML : 
            (text) => text;
          
          elements.currentMatch.innerHTML = `
            <div class="match-players">
              ${sanitize(tournament.current_match.player1)} 
              <span class="vs">vs</span> 
              ${sanitize(tournament.current_match.player2)}
            </div>
          `;
        } else {
          elements.currentMatch.innerHTML = tournament.started ? 'All matches completed' : 'Tournament not started';
        }
      }
      
      // Update upcoming matches
      if (elements.upcomingMatches && tournament.upcoming_matches) {
        elements.upcomingMatches.innerHTML = '';
        
        if (tournament.upcoming_matches.length === 0) {
          elements.upcomingMatches.innerHTML = '<li class="list-group-item">No upcoming matches</li>';
        } else {
          tournament.upcoming_matches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'list-group-item match-item';
            
            // Sanitize player names if Utils is available
            const sanitize = typeof Utils !== 'undefined' && Utils.sanitizeHTML ? 
              Utils.sanitizeHTML : 
              (text) => text;
            
            li.innerHTML = `
              <div>${sanitize(match.player1)} vs ${sanitize(match.player2)}</div>
            `;
            
            elements.upcomingMatches.appendChild(li);
          });
        }
      }
      
      // Update completed matches
      if (elements.completedMatches && tournament.completed_matches) {
        elements.completedMatches.innerHTML = '';
        
        if (tournament.completed_matches.length === 0) {
          elements.completedMatches.innerHTML = '<li class="list-group-item">No completed matches</li>';
        } else {
          tournament.completed_matches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'list-group-item match-item completed';
            
            // Sanitize player names if Utils is available
            const sanitize = typeof Utils !== 'undefined' && Utils.sanitizeHTML ? 
              Utils.sanitizeHTML : 
              (text) => text;
            
            li.innerHTML = `
              <div>${sanitize(match.player1)} vs ${sanitize(match.player2)}</div>
              <div class="match-winner">Winner: ${sanitize(match.winner)}</div>
            `;
            
            elements.completedMatches.appendChild(li);
          });
        }
      }
    }
    
    /**
     * Reset tournament state
     */
    function resetTournamentState() {
      currentTournament = null;
      isTournamentCreator = false;
      
      // Hide tournament info
      if (elements.activeTournament) {
        elements.activeTournament.style.display = 'none';
      }
      
      // Hide start tournament button
      if (elements.startTournament) {
        elements.startTournament.style.display = 'none';
      }
      
      // Show available tournaments
      if (elements.availableTournaments) {
        elements.availableTournaments.style.display = 'block';
      }
      
      console.log("Tournament state reset");
    }
    
    /**
     * Complete tournament cleanup
     */
    function completeTournamentCleanup() {
      // Reset tournament state
      resetTournamentState();
      
      // Clear any UI elements
      if (window.UIManager && typeof UIManager.cleanupTournamentUI === 'function') {
        UIManager.cleanupTournamentUI();
      }
      
      // Clear localStorage flag for tournament
      try {
        localStorage.setItem('inTournament', 'false');
      } catch (e) {
        console.warn("Could not access localStorage", e);
      }
    }

    /**
     * Show tournament completion screen
     * @param {boolean} isWinner - Whether current player is the tournament winner
     */
    function showTournamentCompletionScreen(isWinner) {
      // Create tournament completion screen
      const screen = document.createElement('div');
      screen.className = isWinner ? 'result-screen winner' : 'result-screen loser';
      
      let content = '';
      if (isWinner) {
        content = `
          <h2>🏆 TOURNAMENT VICTORY! 🏆</h2>
          <h3>You won the tournament!</h3>
          <button class="button" id="continue-button">CONTINUE</button>
        `;
      } else {
        content = `
          <h2>TOURNAMENT COMPLETE</h2>
          <h3>Thank you for participating!</h3>
          <button class="button" id="continue-button">BACK TO MENU</button>
        `;
      }
      
      screen.innerHTML = content;
      document.body.appendChild(screen);
      
      // Add button handler
      document.getElementById('continue-button').addEventListener('click', function() {
        screen.remove();
        
        // Complete cleanup
        completeTournamentCleanup();
        
        // Navigate back to menu
        if (window.UIManager && typeof UIManager.navigateTo === 'function') {
          UIManager.navigateTo('game-page');
        }
      });
    }

    /**
     * Get the current tournament ID
     * @returns {string|null} - Tournament ID or null
     */
    function getCurrentTournamentId() {
      return currentTournament ? currentTournament.id : null;
    }
    
    /**
     * Check if currently in a tournament
     * @returns {boolean} - Whether in a tournament
     */
    function isInTournament() {
      return currentTournament !== null;
    }
    
    /**
     * Handle tournament joined event
     * @param {Object} tournament - Tournament data
     */
    function handleTournamentJoined(tournament) {
      console.log("Tournament joined:", tournament);
      
      if (!tournament) {
        console.error("Invalid tournament data");
        return;
      }
      
      currentTournament = tournament;
      isTournamentCreator = false;
      
      // Show tournament info
      updateTournamentUI(tournament);
      
      // Show the active tournament section
      if (elements.activeTournament) {
        elements.activeTournament.style.display = 'block';
      }
      
      // Hide start tournament button since user is not creator
      if (elements.startTournament) {
        elements.startTournament.style.display = 'none';
      }
      
      // Hide available tournaments
      if (elements.availableTournaments) {
        elements.availableTournaments.style.display = 'none';
      }
      
      // Show toast notification if Utils is available
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast("Joined tournament successfully!", "success");
      }
    }
    
    /**
     * Handle tournament update event
     * @param {Object} tournament - Tournament data
     */
    function handleTournamentUpdate(tournament) {
      console.log("Tournament updated:", tournament);
      
      if (!tournament || !currentTournament || tournament.id !== currentTournament.id) {
        return;
      }
      
      // Store previous state to detect changes
      const hadCurrentMatch = currentTournament.current_match !== null;
      const previousMatchPlayers = hadCurrentMatch ? 
        `${currentTournament.current_match.player1} vs ${currentTournament.current_match.player2}` : 
        null;
      
      // Update tournament data
      currentTournament = tournament;

      // Show leave warning when in a tournament
      const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
      if (tournamentLeaveWarning) {
          tournamentLeaveWarning.style.display = 'block';
      }
      
      // Check if there's a new match
      const hasNewMatch = tournament.current_match !== null;
      
      // If there's a new current match and the player is in it, highlight it
      if (hasNewMatch) {
        const isPlayerInMatch = 
          tournament.current_match.player1 === currentNickname || 
          tournament.current_match.player2 === currentNickname;
        
        const currentMatchPlayers = 
          `${tournament.current_match.player1} vs ${tournament.current_match.player2}`;
        
        // Notify if this is a new match involving the current player
        if (isPlayerInMatch && (!hadCurrentMatch || previousMatchPlayers !== currentMatchPlayers)) {
          console.log("Player is in the current match!");
          
          // Show toast notification if Utils is available
          if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast("It's your turn to play! Get ready for your match.", "info");
          }
          
          // Add visual highlighting to the current match
          if (elements.currentMatch) {
            elements.currentMatch.classList.add("highlight-match");
            setTimeout(() => {
              if (elements.currentMatch) {
                elements.currentMatch.classList.remove("highlight-match");
              }
            }, 5000);
          }
        }
      }
      
      // Update UI
      updateTournamentUI(tournament);
    }
    
    /**
     * Handle tournament left event
     */
    function handleTournamentLeft() {
      console.log("Left tournament");
      resetTournamentState();
  
      // Hide leave warning when exiting a tournament
      const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
      if (tournamentLeaveWarning) {
          tournamentLeaveWarning.style.display = 'none';
      }
      
      // Remove any tournament waiting screens
      const waitingScreen = document.getElementById('tournament-waiting-screen');
      if (waitingScreen) {
          waitingScreen.remove();
      }
      
      // Clear any tournament-related banners
      const banner = document.getElementById('tournament-warning-banner');
      if (banner) {
          banner.style.display = 'none';
      }
      
      // Show toast notification if Utils is available
      if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast("You have left the tournament", "info");
      }
  }
    
    /**
     * Handle tournament errors
     * @param {string} message - Error message
     */
    function handleTournamentError(message) {
      console.error("Tournament error:", message);
      
      // Show alert if Utils is available
      if (typeof Utils !== 'undefined' && Utils.showAlert) {
        Utils.showAlert(message, "warning");
      } else {
        alert(`Tournament error: ${message}`);
      }
    }
    
    /**
     * Set current player nickname
     * @param {string} nickname - New nickname
     */
    function setNickname(nickname) {
      if (nickname && typeof nickname === 'string') {
        currentNickname = nickname;
      }
    }

    /**
     * Show the ready-for-match section
     * @param {boolean} show - Whether to show or hide
     */
    function showReadySection(show) {
      const readySection = document.getElementById('tournament-ready-section');
      if (readySection) {
        readySection.style.display = show ? 'block' : 'none';
      }
    }

    /**
     * Show tournament status notification
     * @param {string} message - Message to display
     * @param {string} type - Alert type (primary, success, warning, danger)
     */
    function showTournamentStatus(message, type = 'primary') {
      const statusArea = document.getElementById('tournament-status-notification');
      const statusMessage = document.getElementById('tournament-status-message');
      
      if (statusArea && statusMessage) {
        // Update message
        statusMessage.textContent = message;
        
        // Update alert type
        statusArea.className = `alert alert-${type} mt-3`;
        
        // Show the notification
        statusArea.style.display = 'block';
      }
    }

    /**
     * Hide tournament status notification
     */
    function hideTournamentStatus() {
      const statusArea = document.getElementById('tournament-status-notification');
      if (statusArea) {
        statusArea.style.display = 'none';
      }
    }

    /**
     * Recover active tournament if player is in one
     * @returns {boolean} - Whether recovery was successful
     */
    function recoverActiveTournament() {
      // Check localStorage for tournament ID
      let tournamentId = null;
      
      try {
        tournamentId = localStorage.getItem('activeTournamentId');
      } catch (e) {
        console.warn("Could not access localStorage", e);
      }
      
      // If no stored ID, check current internal state
      if (!tournamentId && currentTournament) {
        tournamentId = currentTournament.id;
      }
      
      if (!tournamentId) {
        // No active tournament found
        if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast("No active tournament found", "warning");
        } else {
          alert("No active tournament found");
        }
        return false;
      }
      
      // Request latest tournament data
      if (modules.websocket && modules.websocket.isConnected()) {
        modules.websocket.send({
          type: "get_tournament_info",
          tournament_id: tournamentId
        });
        
        if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast("Rejoining tournament...", "info");
        }
        
        // Ensure active tournament section is visible
        if (elements.activeTournament) {
          elements.activeTournament.style.display = 'block';
        }
        
        // Ensure available tournaments section is hidden
        if (elements.availableTournaments) {
          elements.availableTournaments.style.display = 'none';
        }
        
        // Display a loading spinner or message while we wait for server response
        if (modules.ui && modules.ui.showLoading) {
          modules.ui.showLoading(elements.tournamentPlayers);
        }
        
        return true;
      }
      
      return false;
    }

    /**
     * Send player ready status to server
     */
    function sendPlayerReady() {
      if (!isInTournament()) {
        console.warn("Can't send ready status: not in a tournament");
        return false;
      }
      
      if (modules.websocket && modules.websocket.isConnected()) {
        // Show waiting status
        showTournamentStatus("Waiting for other players to be ready...");
        
        // Hide ready button to prevent repeated clicks
        showReadySection(false);
        
        // Send ready status to server
        return modules.websocket.send({
          type: "tournament_player_ready"
        });
      }
      
      return false;
    }

    /**
     * Update the match ready UI after a match
     * @param {boolean} show - Whether to show the ready UI
     */
    function updateMatchReadyUI(show) {
      // Show/hide ready section
      showReadySection(show);
      
      // Reset status notification if hiding
      if (!show) {
        hideTournamentStatus();
      }
    }

    /**
     * Enhanced method to handle match ready event
     * @param {string} message - Server message
     */
    function handleMatchReady(message) {
      console.log("Match ready:", message);
      
      // Hide waiting overlay if it exists
      hideWaitingOverlay();
      
      // Hide ready section since we're about to start a match
      showReadySection(false);
      
      // Update status with success message
      showTournamentStatus("Your match is starting!", "success");
      
      // Show toast notification
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast(message || "Your match is starting!", "success");
      }
      
      // Store tournament ID in localStorage for recovery
      if (currentTournament && currentTournament.id) {
        try {
          localStorage.setItem('activeTournamentId', currentTournament.id);
        } catch (e) {
          console.warn("Could not save tournament ID to localStorage", e);
        }
      }
    }

    // Extend the handleTournamentUpdate function to add support for the ready UI
    // Save original function
    const originalHandleTournamentUpdate = handleTournamentUpdate;

    // Override with enhanced version
    handleTournamentUpdate = function(tournament) {
      // Call original function
      originalHandleTournamentUpdate.call(this, tournament);
      
      // Check if the tournament has started and this player should show ready button
      if (tournament && tournament.started) {
        // Show ready section if player is in tournament but not in current match
        const playerIsInCurrentMatch = tournament.current_match && 
          (tournament.current_match.player1 === currentNickname || 
          tournament.current_match.player2 === currentNickname);
        
        // If player is not in current match, show ready section
        if (!playerIsInCurrentMatch) {
          // Player should see ready button if:
          // 1. There is a current match (tournament is active)
          // 2. Player is not in the current match (waiting for their turn)
          const shouldShowReadyButton = tournament.current_match !== null;
          
          // Update ready UI
          updateMatchReadyUI(shouldShowReadyButton);
        } else {
          // If player is in current match, hide ready section
          updateMatchReadyUI(false);
        }
      } else {
        // Tournament hasn't started, hide ready section
        updateMatchReadyUI(false);
      }
    };
    
    // Public API
    return {
      init,
      updateTournamentList,
      handleTournamentCreated,
      handleTournamentJoined,
      handleTournamentUpdate,
      handleTournamentLeft,
      handleTournamentError,
      getCurrentTournamentId,
      isInTournament,
      resetTournamentState,
      setNickname,
      createTournament,
      joinTournament,
      leaveTournament,
      startTournament,
      recoverActiveTournament,
      sendPlayerReady,
      updateMatchReadyUI,
      showReadySection,
      showTournamentStatus,
      hideTournamentStatus,
      showWaitingForNextMatch,
      hideWaitingOverlay,
      handleMatchReady
        };
  })();
  
  // Export for ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TournamentManager;
  }

  window.TournamentManager = TournamentManager;