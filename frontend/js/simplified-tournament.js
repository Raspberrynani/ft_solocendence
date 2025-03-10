/**
 * Simplified Tournament Manager
 * A streamlined tournament system that focuses on basic matchmaking
 * for even numbers of players with minimal code modifications.
 */
const SimpleTournamentManager = (function() {
    // Private variables
    let currentTournament = null;
    let isCreator = false;
    let elements = {};
    let currentNickname = "";
    
    /**
     * Initialize the tournament manager
     * @param {Object} elementRefs - References to DOM elements
     * @param {string} nickname - Current player's nickname
     * @returns {boolean} - Whether initialization was successful
     */
    function init(elementRefs, nickname) {
      console.log("SimpleTournamentManager: Initializing with nickname:", nickname);
      
      // Validate required parameters
      if (!elementRefs) {
        console.error("Missing element references");
        return false;
      }
      
      if (!nickname || nickname.trim().length === 0) {
        console.error("Nickname is required for tournament initialization");
        return false;
      }
      
      // Store references
      elements = elementRefs;
      currentNickname = nickname;
      
      // Set up event listeners for tournament controls
      setupEventListeners();
      
      // Request latest tournament list if WebSocket is connected
      if (typeof WebSocketManager !== 'undefined' && WebSocketManager.isConnected && WebSocketManager.isConnected()) {
        WebSocketManager.send({
          type: "get_tournaments"
        });
      }
      
      console.log("SimpleTournamentManager initialized successfully");
      return true;
    }
    
    /**
     * Set up event listeners for tournament controls
     */
    function setupEventListeners() {
      // Create tournament button
      if (elements.createTournament) {
        elements.createTournament.addEventListener('click', () => {
          console.log("Tournament creation button clicked");
          createTournament();
        });
      }
      
      // Start tournament button
      if (elements.startTournament) {
        elements.startTournament.addEventListener('click', () => {
          const tournamentId = getCurrentTournamentId();
          if (tournamentId) {
            startTournament(tournamentId);
          } else {
            showError("No active tournament");
          }
        });
      }
      
      // Leave tournament button
      if (elements.leaveTournament) {
        elements.leaveTournament.addEventListener('click', () => {
          if (isInTournament()) {
            leaveTournament();
          } else {
            showError("Not in a tournament");
          }
        });
      }
      
      // Back button to return to menu
      const backButton = document.getElementById('tournament-back-button');
      if (backButton) {
        backButton.addEventListener('click', () => {
          // If in a tournament, prompt before leaving
          if (isInTournament()) {
            if (confirm("Leaving will remove you from the current tournament. Continue?")) {
              leaveTournament();
              navigateToMenu();
            }
          } else {
            navigateToMenu();
          }
        });
      }
    }
    
    /**
     * Navigate back to the main menu
     */
    function navigateToMenu() {
      if (window.UIManager && typeof UIManager.navigateTo === 'function') {
        UIManager.navigateTo('game-page');
      }
    }
    
    /**
     * Show an error message
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
     * Show a success toast
     * @param {string} message - Success message to display
     */
    function showSuccess(message) {
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast(message, 'success');
      } else {
        console.log(message);
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
     * Start a tournament
     * @param {string} tournamentId - ID of tournament to start
     * @returns {boolean} - Whether start request was sent
     */
    function startTournament(tournamentId) {
      if (!WebSocketManager || !WebSocketManager.isConnected()) {
        showError("Cannot start tournament: Not connected to server");
        return false;
      }
      
      // Use specialized method if available
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
     * Leave the current tournament
     * @returns {boolean} - Whether leave request was sent
     */
    function leaveTournament() {
      if (!WebSocketManager || !WebSocketManager.isConnected()) {
        showError("Cannot leave tournament: Not connected to server");
        return false;
      }
      
      // Use specialized method if available
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
     * Update the tournament list display
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
        
        // Sanitize tournament name
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
     * Handle successful tournament creation
     * @param {Object} tournament - Tournament data
     */
    function handleTournamentCreated(tournament) {
      console.log("Tournament created:", tournament);
      
      if (!tournament) {
        console.error("Invalid tournament data");
        return;
      }
      
      currentTournament = tournament;
      isCreator = true;
      
      // Show active tournament section
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
      
      // Update tournament UI
      updateTournamentUI(tournament);
      
      // Add player count status indicator
      updatePlayerCountStatus(tournament);
      
      // Show success notification
      showSuccess("Tournament created successfully!");
      
      // Update localStorage to track tournament participation
      try {
        localStorage.setItem('inTournament', 'true');
        localStorage.setItem('currentTournament', tournament.id);
      } catch (e) {
        console.warn("Could not store in localStorage", e);
      }
    }
    
    /**
     * Update player count status indicator
     * @param {Object} tournament - Tournament data
     */
    function updatePlayerCountStatus(tournament) {
      const tournamentPlayers = document.getElementById('tournament-players');
      if (!tournamentPlayers) return;
      
      // Create status indicator if it doesn't exist
      let statusIndicator = document.getElementById('player-count-status');
      if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'player-count-status';
        statusIndicator.className = 'player-count-status';
        
        // Insert before players list
        tournamentPlayers.parentNode.insertBefore(statusIndicator, tournamentPlayers);
      }
      
      const playerCount = tournament.players.length;
      const isEven = playerCount % 2 === 0;
      const canStart = isEven && playerCount >= 2 && playerCount <= 10;
      
      statusIndicator.className = `player-count-status ${canStart ? 'status-ok' : 'status-warning'}`;
      
      if (tournament.started) {
        statusIndicator.textContent = `Tournament active with ${playerCount} players`;
      } else if (!isEven) {
        statusIndicator.textContent = `${playerCount} players (need even number to start)`;
      } else if (playerCount > 10) {
        statusIndicator.textContent = `${playerCount} players (maximum 10 players)`;
      } else if (playerCount < 2) {
        statusIndicator.textContent = `${playerCount} players (minimum 2 players)`;
      } else {
        statusIndicator.textContent = `${playerCount} players (ready to start)`;
      }
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
      isCreator = false;
      
      // Show active tournament section
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
      
      // Update tournament UI
      updateTournamentUI(tournament);
      
      // Update player count status
      updatePlayerCountStatus(tournament);
      
      // Show success notification
      showSuccess("Joined tournament successfully!");
      
      // Update localStorage to track tournament participation
      try {
        localStorage.setItem('inTournament', 'true');
        localStorage.setItem('currentTournament', tournament.id);
      } catch (e) {
        console.warn("Could not store in localStorage", e);
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
          
          // Sanitize player name
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
          // Sanitize player names
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
          
          // Add highlighting if current player is in this match
          if (tournament.current_match.player1 === currentNickname || 
            tournament.current_match.player2 === currentNickname) {
            elements.currentMatch.classList.add("highlight-match");
          } else {
            elements.currentMatch.classList.remove("highlight-match");
          }
          
          // Add "current-match" class for styling
          elements.currentMatch.classList.add("current-match");
        } else {
          elements.currentMatch.classList.remove("current-match", "highlight-match");
          elements.currentMatch.innerHTML = tournament.started ? 
            'All matches completed' : 
            'Tournament not started';
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
            
            // Sanitize player names
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
            
            // Sanitize player names
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
      
      // Update player count status
      updatePlayerCountStatus(tournament);
      
      // Show tournament leave warning
      const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
      if (tournamentLeaveWarning) {
        tournamentLeaveWarning.style.display = 'block';
      }
    }
    
    /**
     * Handle tournament update
     * @param {Object} tournament - Tournament data
     */
    function handleTournamentUpdate(tournament) {
      console.log("Tournament updated:", tournament);
      
      // Only process if this is our current tournament
      if (!currentTournament || tournament.id !== currentTournament.id) {
        return;
      }
      
      // Store current match info for comparison
      const hadCurrentMatch = currentTournament.current_match !== null;
      const previousMatchPlayers = hadCurrentMatch ? 
        `${currentTournament.current_match.player1} vs ${currentTournament.current_match.player2}` : 
        null;
      
      // Update tournament data
      currentTournament = tournament;
      
      // Check if there's a new match involving the current player
      const hasNewMatch = tournament.current_match !== null;
      
      if (hasNewMatch) {
        const isPlayerInMatch = 
          tournament.current_match.player1 === currentNickname || 
          tournament.current_match.player2 === currentNickname;
        
        const currentMatchPlayers = 
          `${tournament.current_match.player1} vs ${tournament.current_match.player2}`;
        
        // Notify if this is a new match involving the current player
        if (isPlayerInMatch && (!hadCurrentMatch || previousMatchPlayers !== currentMatchPlayers)) {
          console.log("Player is in the current match!");
          
          // Show notification
          showSuccess("It's your turn to play! Get ready for your match.");
        }
      }
      
      // Update the UI
      updateTournamentUI(tournament);
    }
    
    /**
     * Handle tournament left event
     */
    function handleTournamentLeft() {
      console.log("Left tournament");
      resetTournamentState();
      
      // Hide tournament warning
      const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
      if (tournamentLeaveWarning) {
        tournamentLeaveWarning.style.display = 'none';
      }
      
      // Show success notification
      showSuccess("You have left the tournament");
    }
    
    /**
     * Handle tournament errors
     * @param {string} message - Error message
     */
    function handleTournamentError(message) {
      console.error("Tournament error:", message);
      showError(message);
    }
    
    /**
     * Reset tournament state
     */
    function resetTournamentState() {
      currentTournament = null;
      isCreator = false;
      
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
      
      // Remove player count status
      const statusIndicator = document.getElementById('player-count-status');
      if (statusIndicator) {
        statusIndicator.remove();
      }
      
      // Reset tournament leave warning
      const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
      if (tournamentLeaveWarning) {
        tournamentLeaveWarning.style.display = 'none';
      }
      
      // Reset tournament data in localStorage
      try {
        localStorage.removeItem('inTournament');
        localStorage.removeItem('currentTournament');
      } catch (e) {
        console.warn("Could not access localStorage", e);
      }
      
      console.log("Tournament state reset");
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
     * Set current player nickname
     * @param {string} nickname - New nickname
     */
    function setNickname(nickname) {
      if (nickname && typeof nickname === 'string') {
        currentNickname = nickname;
      }
    }
    
    /**
     * Check if current tournament is complete
     * @returns {boolean} - Whether tournament is complete
     */
    function isTournamentComplete() {
      if (!currentTournament) return false;
      
      return (
        currentTournament.started && 
        (!currentTournament.upcoming_matches || currentTournament.upcoming_matches.length === 0) &&
        !currentTournament.current_match
      );
    }
    
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
      isTournamentComplete,
      createTournament,
      joinTournament,
      leaveTournament,
      startTournament
    };
  })();
  
  // Create global reference
  window.SimpleTournamentManager = SimpleTournamentManager;