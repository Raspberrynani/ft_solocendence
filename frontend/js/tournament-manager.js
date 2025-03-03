/**
 * Tournament Manager Module
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
   */
  function init(elementRefs, nickname) {
    console.log("TournamentManager: Initializing with nickname:", nickname);
    elements = elementRefs;
    currentNickname = nickname;
    
    // Add event listeners
    if (elements.createTournament) {
      elements.createTournament.addEventListener('click', () => {
        console.log("Tournament creation button clicked");
        createTournament();
      });
    }
    
    if (elements.startTournament) {
      elements.startTournament.addEventListener('click', () => {
        const tournamentId = getCurrentTournamentId();
        if (tournamentId) {
          WebSocketManager.send({
            type: "start_tournament",
            tournament_id: tournamentId
          });
        } else {
          Utils.showAlert("No active tournament");
        }
      });
    }
    
    if (elements.leaveTournament) {
      elements.leaveTournament.addEventListener('click', () => {
        if (isInTournament()) {
          WebSocketManager.send({
            type: "leave_tournament"
          });
          resetTournamentState();
        } else {
          Utils.showAlert("No active tournament");
        }
      });
    }
    
    // Request latest tournament list
    if (WebSocketManager.isConnected()) {
      WebSocketManager.send({
        type: "get_tournaments"
      });
    }
  }
  
  /**
   * Create a new tournament
   */
  function createTournament() {
    if (!WebSocketManager.isConnected()) {
      Utils.showAlert("Cannot create tournament: Not connected to server");
      return;
    }
    
    if (!currentNickname) {
      Utils.showAlert("Please enter your nickname first");
      return;
    }
    
    // Get rounds from rounds input
    const rounds = parseInt(elements.roundsInput.value) || 3;
    
    console.log("Creating tournament:", {
      nickname: currentNickname,
      rounds: rounds
    });
    
    // Send create tournament request
    WebSocketManager.send({
      type: "create_tournament",
      nickname: currentNickname,
      name: `${currentNickname}'s Tournament`,
      rounds: rounds
    });
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
      li.innerHTML = `
        <div class="tournament-info">
          <span>${Utils.sanitizeHTML(tournament.name)}</span>
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
          WebSocketManager.send({
            type: "join_tournament",
            tournament_id: tournament.id,
            nickname: currentNickname
          });
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
    
    Utils.showToast("Tournament created successfully!", "success");
  }
  
  /**
   * Update tournament UI
   * @param {Object} tournament - Tournament data
   */
  function updateTournamentUI(tournament) {
    if (!tournament) return;
    
    // Update tournament name
    if (elements.tournamentName) {
      elements.tournamentName.innerText = tournament.name;
    }
    
    // Update player list
    if (elements.tournamentPlayers) {
      elements.tournamentPlayers.innerHTML = '';
      
      tournament.players.forEach(player => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerHTML = `
          <span>${Utils.sanitizeHTML(player)}</span>
          ${player === currentNickname ? '<span class="badge bg-info">You</span>' : ''}
        `;
        elements.tournamentPlayers.appendChild(li);
      });
    }
    
    // Update current match
    if (elements.currentMatch) {
      if (tournament.current_match) {
        elements.currentMatch.innerHTML = `
          <div class="match-players">
            ${Utils.sanitizeHTML(tournament.current_match.player1)} 
            <span class="vs">vs</span> 
            ${Utils.sanitizeHTML(tournament.current_match.player2)}
          </div>
        `;
      } else {
        elements.currentMatch.innerHTML = tournament.started ? 'All matches completed' : 'Tournament not started';
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
    
    Utils.showToast("Joined tournament successfully!", "success");
  }
  
  /**
   * Handle tournament update event
   * @param {Object} tournament - Tournament data
   */
  function handleTournamentUpdate(tournament) {
    console.log("Tournament updated:", tournament);
    
    if (currentTournament && tournament.id === currentTournament.id) {
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
          Utils.showToast("It's your turn to play! Get ready for your match.", "info");
          
          // Add visual highlighting to the current match
          if (elements.currentMatch) {
            elements.currentMatch.classList.add("highlight-match");
            setTimeout(() => {
              elements.currentMatch.classList.remove("highlight-match");
            }, 5000);
          }
        }
      }
      
      // Update UI
      updateTournamentUI(tournament);
    }
  }
  /**
   * Handle tournament left event
   */
  function handleTournamentLeft() {
    console.log("Left tournament");
    resetTournamentState();
    Utils.showToast("You have left the tournament", "info");
  }
  
  /**
   * Handle tournament errors
   * @param {string} message - Error message
   */
  function handleTournamentError(message) {
    console.error("Tournament error:", message);
    Utils.showAlert(message, "warning");
  }
  
  // Public API
  const publicAPI = {
    init,
    updateTournamentList,
    handleTournamentCreated,
    handleTournamentJoined,
    handleTournamentUpdate,
    handleTournamentLeft,
    handleTournamentError,
    getCurrentTournamentId,
    isInTournament,
    resetTournamentState
  };
  
  // Expose to global window object
  if (typeof window !== 'undefined') {
    window.TournamentManager = publicAPI;
  }
  
  return publicAPI;
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
module.exports = TournamentManager;
}