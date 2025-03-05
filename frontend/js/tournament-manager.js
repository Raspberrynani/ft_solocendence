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
      startTournament
    };
  })();
  
  // Export for ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TournamentManager;
  }