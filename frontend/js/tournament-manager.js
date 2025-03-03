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
      elements = elementRefs;
      currentNickname = nickname;
      
      // Add event listeners
      if (elements.createTournament) {
        elements.createTournament.addEventListener('click', createTournament);
      }
      
      if (elements.startTournament) {
        elements.startTournament.addEventListener('click', startTournament);
      }
      
      if (elements.leaveTournament) {
        elements.leaveTournament.addEventListener('click', leaveTournament);
      }
      
      // Initialize tournament list
      if (WebSocketManager && WebSocketManager.isConnected()) {
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
      
      // Send create tournament request
      WebSocketManager.send({
        type: "create_tournament",
        nickname: currentNickname,
        name: `${currentNickname}'s Tournament`,
        rounds: rounds
      });
    }
    
    /**
     * Start the current tournament
     */
    function startTournament() {
      if (!currentTournament) {
        Utils.showAlert("No active tournament");
        return;
      }
      
      WebSocketManager.send({
        type: "start_tournament",
        tournament_id: currentTournament.id
      });
    }
    
    /**
     * Leave the current tournament
     */
    function leaveTournament() {
      if (!currentTournament) {
        Utils.showAlert("No active tournament");
        return;
      }
      
      WebSocketManager.send({
        type: "leave_tournament"
      });
      
      // Reset tournament state
      resetTournamentState();
    }
    
    /**
     * Join a tournament
     * @param {string} tournamentId - ID of tournament to join
     */
    function joinTournament(tournamentId) {
      if (!WebSocketManager.isConnected()) {
        Utils.showAlert("Cannot join tournament: Not connected to server");
        return;
      }
      
      if (!currentNickname) {
        Utils.showAlert("Please enter your nickname first");
        return;
      }
      
      WebSocketManager.send({
        type: "join_tournament",
        tournament_id: tournamentId,
        nickname: currentNickname
      });
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
     * Update the tournament list
     * @param {Array} tournaments - List of available tournaments
     */
    function updateTournamentList(tournaments) {
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
        
        console.log("Updating tournament list with:", tournaments.length, "tournaments");
        
        // Make sure the tournament container is visible
        if (elements.availableTournaments) {
          elements.availableTournaments.style.display = 'block';
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
            li.addEventListener('click', () => joinTournament(tournament.id));
          }
          
          elements.tournamentList.appendChild(li);
        });
    }
    
    /**
     * Handle tournament created event
     * @param {Object} tournament - Tournament data
     */
    function handleTournamentCreated(tournament) {
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
     * Handle tournament joined event
     * @param {Object} tournament - Tournament data
     */
    function handleTournamentJoined(tournament) {
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
      // Only update if we're in this tournament
      if (currentTournament && tournament.id === currentTournament.id) {
        currentTournament = tournament;
        updateTournamentUI(tournament);
      }
    }
    
    /**
     * Update tournament UI with tournament data
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
          
          // Highlight if current player is in the match
          if (tournament.current_match.player1 === currentNickname || tournament.current_match.player2 === currentNickname) {
            elements.currentMatch.classList.add('your-match');
          } else {
            elements.currentMatch.classList.remove('your-match');
          }
        } else {
          elements.currentMatch.innerHTML = tournament.started ? 'All matches completed' : 'Tournament not started';
        }
      }
      
      // Update upcoming matches
      if (elements.upcomingMatches) {
        elements.upcomingMatches.innerHTML = '';
        
        if (tournament.upcoming_matches && tournament.upcoming_matches.length > 0) {
          tournament.upcoming_matches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'list-group-item match-item';
            li.innerHTML = `
              ${Utils.sanitizeHTML(match.player1)} vs ${Utils.sanitizeHTML(match.player2)}
            `;
            elements.upcomingMatches.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.className = 'list-group-item';
          li.innerText = 'No upcoming matches';
          elements.upcomingMatches.appendChild(li);
        }
      }
      
      // Update completed matches
      if (elements.completedMatches) {
        elements.completedMatches.innerHTML = '';
        
        if (tournament.completed_matches && tournament.completed_matches.length > 0) {
          tournament.completed_matches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'list-group-item match-item completed';
            li.innerHTML = `
              <span>
                ${Utils.sanitizeHTML(match.player1)} vs ${Utils.sanitizeHTML(match.player2)}
              </span>
              <span class="match-winner">
                Winner: ${Utils.sanitizeHTML(match.winner)}
              </span>
            `;
            elements.completedMatches.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.className = 'list-group-item';
          li.innerText = 'No completed matches';
          elements.completedMatches.appendChild(li);
        }
      }
    }
    
    /**
     * Check if the tournament has been left
     */
    function handleTournamentLeft() {
      resetTournamentState();
      Utils.showToast("You have left the tournament", "info");
    }
    
    /**
     * Handle tournament error
     * @param {string} message - Error message
     */
    function handleTournamentError(message) {
      Utils.showAlert(message, "warning");
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
      resetTournamentState
    };
  })();
  
  // Export for ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TournamentManager;
  }