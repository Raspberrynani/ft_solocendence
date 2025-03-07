/**
 * Tournament Manager Module - Rewritten
 * Handles tournament creation, joining, and UI updates
 * with improved reliability and state management
 */
const TournamentManager = (function() {
  // Private variables
  let currentTournament = null;
  let lastTournamentVersion = 0;
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
    
    // Clear any persisted tournament state that might be stale
    try {
      localStorage.removeItem('inTournament');
      localStorage.removeItem('activeTournamentId');
    } catch (e) {
      console.warn("Could not access localStorage", e);
    }
    
    console.log("TournamentManager initialized successfully");
    return true;
  }
  
  /**
   * Set up event listeners for tournament controls
   */
  function setupEventListeners() {
    console.log("Setting up tournament event listeners");
    
    // Create tournament button
    if (elements.createTournament) {
      // Clone to remove previous handlers
      const oldCreateBtn = elements.createTournament;
      const newCreateBtn = oldCreateBtn.cloneNode(true);
      if (oldCreateBtn.parentNode) {
        oldCreateBtn.parentNode.replaceChild(newCreateBtn, oldCreateBtn);
        elements.createTournament = newCreateBtn;
      }
      
      elements.createTournament.addEventListener('click', () => {
        console.log("Tournament creation button clicked");
        if (!validateNickname()) {
          showError("Please enter your nickname first");
          return;
        }
        createTournament();
      });
    }
    
    // START TOURNAMENT BUTTON - CRITICAL FIX
    const startTournamentBtn = document.getElementById('start-tournament');
    if (startTournamentBtn) {
      console.log("Setting up start tournament button");
      
      // Clone to remove previous handlers
      const newStartBtn = startTournamentBtn.cloneNode(true);
      if (startTournamentBtn.parentNode) {
        startTournamentBtn.parentNode.replaceChild(newStartBtn, startTournamentBtn);
      }
      
      // Add click handler directly
      newStartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Start tournament button clicked");
        
        // Get tournament ID
        const tournamentId = getCurrentTournamentId();
        if (!tournamentId) {
          showError("No active tournament to start");
          return;
        }
        
        console.log("Sending start tournament request:", tournamentId);
        
        // Use WebSocketManager to send start command
        if (typeof WebSocketManager !== 'undefined' && WebSocketManager.isConnected && WebSocketManager.isConnected()) {
          WebSocketManager.send({
            type: "start_tournament",
            tournament_id: tournamentId
          });
          
          // Visual feedback
          newStartBtn.disabled = true;
          newStartBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Starting...';
          
          // Re-enable after timeout
          setTimeout(() => {
            newStartBtn.disabled = false;
            newStartBtn.innerHTML = '<i class="fa fa-play-circle"></i> Start Tournament';
          }, 3000);
          
          // Toast notification
          if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast("Starting tournament...", "info");
          }
        } else {
          showError("Not connected to server");
        }
      });

          // Show button only if we're the creator
        if (isTournamentCreator && currentTournament && !currentTournament.started) {
          console.log("Player is creator, showing start button");
          newStartBtn.style.display = 'block';
        } else {
          console.log("Player is not creator or tournament already started");
          newStartBtn.style.display = 'none';
        }
      } else {
        console.warn("Start tournament button not found in DOM");
      }
        // Leave tournament button
        if (elements.leaveTournament) {
          // Clone to remove previous handlers
          const oldLeaveBtn = elements.leaveTournament;
          const newLeaveBtn = oldLeaveBtn.cloneNode(true);
          if (oldLeaveBtn.parentNode) {
            oldLeaveBtn.parentNode.replaceChild(newLeaveBtn, oldLeaveBtn);
            elements.leaveTournament = newLeaveBtn;
          }
          
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
        
        // Ready for match button
        const readyForMatchButton = document.getElementById('ready-for-match');
        if (readyForMatchButton) {
          // Clone to remove previous handlers
          const newReadyBtn = readyForMatchButton.cloneNode(true);
          if (readyForMatchButton.parentNode) {
            readyForMatchButton.parentNode.replaceChild(newReadyBtn, readyForMatchButton);
          }
          
          newReadyBtn.addEventListener('click', () => {
            sendPlayerReady();
          });
        }
        
        // Recover tournament button
        const recoverTournamentButton = document.getElementById('recover-tournament');
        if (recoverTournamentButton) {
          // Clone to remove previous handlers
          const newRecoverBtn = recoverTournamentButton.cloneNode(true);
          if (recoverTournamentButton.parentNode) {
            recoverTournamentButton.parentNode.replaceChild(newRecoverBtn, recoverTournamentButton);
          }
          
          newRecoverBtn.addEventListener('click', () => {
            recoverActiveTournament();
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
    
    // Check if we're already in a tournament - if so, we shouldn't see other tournaments
    if (isInTournament()) {
      elements.tournamentList.innerHTML = '<li class="list-group-item">You are already in a tournament</li>';
      return;
    }
    
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
  function handleTournamentJoined(tournament) {
    console.log("Tournament joined:", tournament);
    
    if (!tournament) {
      console.error("Invalid tournament data");
      return;
    }
    
    currentTournament = tournament;
    lastTournamentVersion = tournament.version || 0;
    
    // Set creator status based on server information
    if (tournament.hasOwnProperty("is_creator")) {
      isTournamentCreator = tournament.is_creator;
    } else {
      // Default to false for safety if joining
      isTournamentCreator = false;
    }
    
    console.log("Tournament creator status:", isTournamentCreator);
    
    // Mark player as in tournament
    try {
      localStorage.setItem('inTournament', 'true');
      localStorage.setItem('activeTournamentId', tournament.id);
      localStorage.setItem('isTournamentCreator', isTournamentCreator ? 'true' : 'false');
    } catch (e) {
      console.warn("Could not access localStorage", e);
    }
    
    // Show tournament info
    updateTournamentUI(tournament);
    
    // Show the active tournament section
    if (elements.activeTournament) {
      elements.activeTournament.style.display = 'block';
    }
    
    // Show start tournament button only for creator
    if (elements.startTournament) {
      if (isTournamentCreator) {
        console.log("Showing start tournament button for creator");
        elements.startTournament.style.display = 'block';
        
        // Make sure button is enabled
        elements.startTournament.disabled = false;
      } else {
        console.log("Hiding start tournament button for non-creator");
        elements.startTournament.style.display = 'none';
      }
    }
    
    // Hide available tournaments
    if (elements.availableTournaments) {
      elements.availableTournaments.style.display = 'none';
    }
    
    // Show toast notification if Utils is available
    if (typeof Utils !== 'undefined' && Utils.showToast) {
      Utils.showToast("Joined tournament successfully!", "success");
    }
    
    // Force setup of event listeners
    setupEventListeners();
  }
  
  /**
   * Update tournament UI
   * @param {Object} tournament - Tournament data
   */
  function updateTournamentUI(tournament) {
    if (!tournament) return;
    
    // Skip update if we already have this version
    if (tournament.version && tournament.version <= lastTournamentVersion) {
      return;
    }
    
    // Update version tracking
    if (tournament.version) {
      lastTournamentVersion = tournament.version;
    }
    
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
        
        // Determine if this player is ready for next match
        const isReady = tournament.ready_players && tournament.ready_players.includes(player);
        
        li.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <span>${playerName} ${player === currentNickname ? '<span class="badge bg-info">You</span>' : ''}</span>
            ${isReady ? '<span class="badge bg-success">Ready</span>' : ''}
          </div>
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
        
        const player1 = sanitize(tournament.current_match.player1);
        const player2 = sanitize(tournament.current_match.player2);
        
        // Highlight player names if the current user is in the match
        const isPlayer1 = player1 === currentNickname;
        const isPlayer2 = player2 === currentNickname;
        
        elements.currentMatch.innerHTML = `
          <div class="match-players">
            <span class="${isPlayer1 ? 'highlight-player' : ''}">${player1}</span> 
            <span class="vs">vs</span> 
            <span class="${isPlayer2 ? 'highlight-player' : ''}">${player2}</span>
          </div>
          ${isPlayer1 || isPlayer2 ? '<div class="your-match-indicator">Your match!</div>' : ''}
        `;
        
        // Add a highlight class to make it more noticeable
        elements.currentMatch.classList.add('active-match');
        
        // Hide ready section if player is in current match
        if (isPlayer1 || isPlayer2) {
          hideReadySection();
        }
      } else if (tournament.champion) {
        // Tournament is complete, show champion
        const sanitize = typeof Utils !== 'undefined' && Utils.sanitizeHTML ? 
          Utils.sanitizeHTML : 
          (text) => text;
        
        const champion = sanitize(tournament.champion);
        const isChampion = champion === currentNickname;
        
        elements.currentMatch.innerHTML = `
          <div class="tournament-complete">
            <h4>Tournament Complete!</h4>
            <div class="champion">
              Champion: <span class="champion-name ${isChampion ? 'highlight-player' : ''}">${champion}</span>
              ${isChampion ? '🏆 Congratulations!' : ''}
            </div>
          </div>
        `;
        
        // Hide ready section when tournament is over
        hideReadySection();
        
        // Remove active match highlight
        elements.currentMatch.classList.remove('active-match');
      } else {
        elements.currentMatch.innerHTML = tournament.started ? 
          '<div class="waiting-for-next-match">Waiting for next match...</div>' : 
          '<div class="tournament-not-started">Tournament not started</div>';
        
        // Show ready section if tournament has started but no current match
        if (tournament.started) {
          showReadySection();
        } else {
          hideReadySection();
        }
        
        // Remove active match highlight
        elements.currentMatch.classList.remove('active-match');
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
          
          const player1 = sanitize(match.player1);
          const player2 = sanitize(match.player2);
          
          // Highlight player names if the current user is in the match
          const isPlayer1 = player1 === currentNickname;
          const isPlayer2 = player2 === currentNickname;
          
          li.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
              <span>
                <span class="${isPlayer1 ? 'highlight-player' : ''}">${player1}</span> vs 
                <span class="${isPlayer2 ? 'highlight-player' : ''}">${player2}</span>
              </span>
              ${match.round ? `<span class="badge bg-secondary">Round ${match.round}</span>` : ''}
            </div>
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
          
          const player1 = sanitize(match.player1);
          const player2 = sanitize(match.player2);
          const winner = sanitize(match.winner);
          
          // Highlight player names if the current user is in the match
          const isPlayer1 = player1 === currentNickname;
          const isPlayer2 = player2 === currentNickname;
          const isWinner = winner === currentNickname;
          
          li.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
              <span>
                <span class="${isPlayer1 ? 'highlight-player' : ''} ${player1 === winner ? 'winner' : ''}">${player1}</span> vs 
                <span class="${isPlayer2 ? 'highlight-player' : ''} ${player2 === winner ? 'winner' : ''}">${player2}</span>
              </span>
              <div>
                ${match.round ? `<span class="badge bg-secondary">Round ${match.round}</span>` : ''}
                <span class="badge bg-success">Winner: ${winner}</span>
              </div>
            </div>
          `;
          
          elements.completedMatches.appendChild(li);
        });
      }
    }
    
    // Update ready UI based on tournament state
    updateReadyUI(tournament);
  }
  
  /**
   * Update ready UI based on tournament state
   * @param {Object} tournament - Tournament data
   */
  function updateReadyUI(tournament) {
    if (!tournament) return;
    
    // Ready section should be shown if:
    // 1. Tournament has started
    // 2. There is no current match (waiting for next match)
    // 3. Player is not already marked as ready
    // 4. Player has not been eliminated
    const shouldShowReadySection = 
      tournament.started && 
      !tournament.current_match && 
      !tournament.ready_players?.includes(currentNickname) &&
      !tournament.champion; // Don't show if tournament is over
    
    if (shouldShowReadySection) {
      showReadySection();
    } else {
      hideReadySection();
    }
    
    // Update ready button state
    const readyButton = document.getElementById('ready-for-match');
    if (readyButton) {
      // Disable button if player is already ready
      const isPlayerReady = tournament.ready_players?.includes(currentNickname);
      readyButton.disabled = isPlayerReady;
      
      // Update button text based on ready state
      if (isPlayerReady) {
        readyButton.innerHTML = '<i class="fa fa-check-circle"></i> You\'re Ready';
      } else {
        readyButton.innerHTML = '<i class="fa fa-check-circle"></i> I\'m Ready for My Next Match';
      }
    }
    
    // Update status notification
    const statusArea = document.getElementById('tournament-status-notification');
    const statusMessage = document.getElementById('tournament-status-message');
    
    if (statusArea && statusMessage) {
      // Determine appropriate status message
      let message = "";
      let type = "primary";
      
      if (tournament.champion) {
        // Tournament is over
        if (tournament.champion === currentNickname) {
          message = "Congratulations! You are the tournament champion!";
          type = "success";
        } else {
          message = `Tournament complete. ${tournament.champion} is the champion.`;
          type = "info";
        }
        statusArea.style.display = 'block';
      } else if (!tournament.started) {
        // Tournament hasn't started
        message = "Waiting for tournament to start...";
        statusArea.style.display = 'block';
      } else if (tournament.current_match) {
        // There's an active match
        if (tournament.current_match.player1 === currentNickname || 
            tournament.current_match.player2 === currentNickname) {
          message = "It's your turn to play!";
          type = "warning";
        } else {
          message = "Match in progress. Please wait for your turn.";
        }
        statusArea.style.display = 'block';
      } else if (tournament.ready_players?.includes(currentNickname)) {
        // Player is ready, waiting for others
        message = "You are ready! Waiting for other players...";
        type = "success";
        statusArea.style.display = 'block';
      } else {
        // Default - hide status
        statusArea.style.display = 'none';
      }
      
      // Update status message
      statusMessage.textContent = message;
      
      // Update alert type
      statusArea.className = `alert alert-${type} mt-3`;
    }
  }
  
  /**
   * Show the ready-for-match section
   */
  function showReadySection() {
    const readySection = document.getElementById('tournament-ready-section');
    if (readySection) {
      readySection.style.display = 'block';
    }
  }
  
  /**
   * Hide the ready-for-match section
   */
  function hideReadySection() {
    const readySection = document.getElementById('tournament-ready-section');
    if (readySection) {
      readySection.style.display = 'none';
    }
  }
  
  /**
   * Reset tournament state
   */
  function resetTournamentState() {
    currentTournament = null;
    lastTournamentVersion = 0;
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
    
    // Clear localStorage markers
    try {
      localStorage.setItem('inTournament', 'false');
      localStorage.removeItem('activeTournamentId');
    } catch (e) {
      console.warn("Could not access localStorage", e);
    }
    
    console.log("Tournament state reset");
  }
  
  /**
   * Show waiting for next match screen between tournament matches
   * @param {boolean} playerWon - Whether the current player won the last match
   */
  function showWaitingForNextMatch(playerWon) {
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
      content.className = 'waiting-content p-5 rounded';
      content.style.cssText = `
        background: rgba(0, 0, 20, 0.8);
        border: 2px solid #00d4ff;
        max-width: 500px;
      `;
      
      content.innerHTML = `
        <h2 class="mb-4">${playerWon ? '🏆 Victory! 🏆' : 'Match Complete'}</h2>
        <p class="match-result mb-4">${playerWon ? 
          'Congratulations! You won this match!' : 
          'This match is complete.'}</p>
        <div class="waiting-message mt-4">
          <p>Waiting for next tournament match...</p>
          <div class="spinner-border text-info mt-3" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <div class="mt-4 pt-3 border-top">
          <p>Click below when you're ready for your next match:</p>
          <button id="waiting-ready-button" class="btn btn-success mt-2">
            <i class="fa fa-check-circle"></i> I'm Ready for My Next Match
          </button>
        </div>
      `;
      
      waitingScreen.appendChild(content);
      document.body.appendChild(waitingScreen);
      
      // Add click handler for ready button
      const readyButton = document.getElementById('waiting-ready-button');
      if (readyButton) {
        readyButton.addEventListener('click', () => {
          sendPlayerReady();
          readyButton.disabled = true;
          readyButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Waiting for other players...';
          
          // Show toast notification
          if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast("You're marked as ready for the next match", "success");
          }
        });
      }
    } else {
      // Update existing waiting screen
      const resultElement = waitingScreen.querySelector('.match-result');
      if (resultElement) {
        resultElement.textContent = playerWon ? 
          'Congratulations! You won this match!' : 
          'This match is complete.';
      }
      
      // Reset ready button
      const readyButton = waitingScreen.querySelector('#waiting-ready-button');
      if (readyButton) {
        readyButton.disabled = false;
        readyButton.innerHTML = '<i class="fa fa-check-circle"></i> I\'m Ready for My Next Match';
      }
      
      // Show the waiting screen
      waitingScreen.style.display = 'flex';
    }
  }
  
  /**
   * Hide waiting screen
   */
  function hideWaitingScreen() {
    const waitingScreen = document.getElementById('tournament-waiting-screen');
    if (waitingScreen) {
      // Animate out
      waitingScreen.style.opacity = '0';
      setTimeout(() => {
        waitingScreen.style.display = 'none';
        waitingScreen.style.opacity = '1';
      }, 300);
    }
  }
  
  /**
   * Handle match ready event (called when server signals match is ready)
   * @param {string} message - Server message
   */
  function handleMatchReady(message) {
    console.log("Match ready:", message);
    
    // Hide the waiting overlay
    hideWaitingScreen();
    
    // Show toast notification
    if (typeof Utils !== 'undefined' && Utils.showToast) {
      Utils.showToast(message || "Your match is starting!", "info");
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
    
    if (!tournament) {
      console.error("Invalid tournament data");
      return;
    }
    
    currentTournament = tournament;
    lastTournamentVersion = tournament.version || 0;
    
    // Set creator status based on server information if available
    if (tournament.hasOwnProperty("is_creator")) {
      isTournamentCreator = tournament.is_creator;
    } else {
      // If server didn't specify, check if first player (as fallback)
      isTournamentCreator = tournament.players && 
                           tournament.players.length > 0 && 
                           tournament.players[0] === currentNickname;
    }
    
    console.log("Tournament creator status:", isTournamentCreator);
    
    // Mark player as in tournament
    try {
      localStorage.setItem('inTournament', 'true');
      localStorage.setItem('activeTournamentId', tournament.id);
      localStorage.setItem('isTournamentCreator', isTournamentCreator ? 'true' : 'false');
    } catch (e) {
      console.warn("Could not access localStorage", e);
    }
    
    // Show tournament info
    updateTournamentUI(tournament);
    
    // Show the active tournament section
    if (elements.activeTournament) {
      elements.activeTournament.style.display = 'block';
    }
    
    // Show start tournament button if creator
    if (elements.startTournament) {
      if (isTournamentCreator) {
        console.log("Showing start tournament button for creator");
        elements.startTournament.style.display = 'block';
      } else {
        console.log("Hiding start tournament button for non-creator");
        elements.startTournament.style.display = 'none';
      }
    }
    
    // Hide available tournaments
    if (elements.availableTournaments) {
      elements.availableTournaments.style.display = 'none';
    }
    
    // Show toast notification if Utils is available
    if (typeof Utils !== 'undefined' && Utils.showToast) {
      Utils.showToast("Joined tournament successfully!", "success");
    }
    
    // Force setup of event listeners
    setupEventListeners();
  }
  
  
  function checkWebSocketConnection() {
    if (typeof WebSocketManager === 'undefined' || !WebSocketManager.isConnected()) {
      console.error("WebSocket not connected, attempting to reconnect");
      
      // Try to reconnect if WebSocketManager exists
      if (typeof WebSocketManager !== 'undefined' && typeof WebSocketManager.reconnect === 'function') {
        WebSocketManager.reconnect();
        
        // After reconnecting, request tournament data if we're in a tournament
        setTimeout(() => {
          if (isInTournament() && currentTournament && currentTournament.id) {
            console.log("Requesting tournament refresh after reconnection");
            WebSocketManager.send({
              type: "get_tournament_info",
              tournament_id: currentTournament.id
            });
          }
        }, 1000);
      }
      
      return false;
    }
    
    return true;
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
    
    // Check for completion
    const wasComplete = currentTournament.champion !== undefined;
    const isNowComplete = tournament.champion !== undefined;
    const justCompleted = !wasComplete && isNowComplete;
    
    // Store previous state to detect changes
    const hadCurrentMatch = currentTournament.current_match !== null;
    const hasNewMatch = tournament.current_match !== null;
    const previousMatchPlayers = hadCurrentMatch ? 
      [currentTournament.current_match.player1, currentTournament.current_match.player2] : [];
    const currentMatchPlayers = hasNewMatch ? 
      [tournament.current_match.player1, tournament.current_match.player2] : [];
    
    // Update tournament data
    currentTournament = tournament;

    // Update creator status if included
    if (tournament.hasOwnProperty("is_creator")) {
      isTournamentCreator = tournament.is_creator;
      
      // Update in localStorage
      try {
        localStorage.setItem('isTournamentCreator', isTournamentCreator ? 'true' : 'false');
      } catch (e) {
        console.warn("Could not access localStorage", e);
      }
      
      // Update start tournament button visibility
      if (elements.startTournament) {
        if (isTournamentCreator && !tournament.started) {
          console.log("Showing start tournament button for creator");
          elements.startTournament.style.display = 'block';
        } else {
          console.log("Hiding start tournament button (not creator or already started)");
          elements.startTournament.style.display = 'none';
        }
      }
    }
    
    // Show leave warning when in a tournament
    const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
    if (tournamentLeaveWarning) {
      tournamentLeaveWarning.style.display = 'block';
    }
    
    // If the tournament just completed, show completion screen
    if (justCompleted) {
      const isChampion = tournament.champion === currentNickname;
      
      // Show toast notification
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        if (isChampion) {
          Utils.showToast("Congratulations! You are the tournament champion!", "success");
        } else {
          Utils.showToast(`Tournament complete. ${tournament.champion} is the champion.`, "info");
        }
      }
    }
    
    // If there's a new current match and the player is in it, highlight it
    if (hasNewMatch) {
      const isPlayerInMatch = 
        tournament.current_match.player1 === currentNickname || 
        tournament.current_match.player2 === currentNickname;
      
      const isNewMatch = !hadCurrentMatch || 
        !previousMatchPlayers.includes(tournament.current_match.player1) || 
        !previousMatchPlayers.includes(tournament.current_match.player2);
      
      // Notify if this is a new match involving the current player
      if (isPlayerInMatch && isNewMatch) {
        console.log("Player is in a new match!");
        
        // Show toast notification if Utils is available
        if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast("It's your turn to play! Get ready for your match.", "warning");
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
    
    // Check if a match just completed (had match before, no match now)
    if (hadCurrentMatch && !hasNewMatch) {
      // Find if player was in the previous match
      const wasPlayerInPreviousMatch = 
        previousMatchPlayers.includes(currentNickname);
      
      if (wasPlayerInPreviousMatch) {
        // Find if player won the match
        const playerWon = tournament.winners?.includes(currentNickname);
        
        // Don't show waiting screen if tournament is over
        if (!tournament.champion) {
          // Show waiting for next match screen
          showWaitingForNextMatch(playerWon);
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
    
    // Reset tournament state
    resetTournamentState();
    
    // Hide leave warning when exiting a tournament
    const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
    if (tournamentLeaveWarning) {
      tournamentLeaveWarning.style.display = 'none';
    }
    
    // Hide any waiting screens
    hideWaitingScreen();
    
    // Hide tournament status notification
    hideTournamentStatus();
    
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
   * Send player ready status to server
   * @returns {boolean} - Whether ready status was sent
   */
  function sendPlayerReady() {
    if (!isInTournament()) {
      console.warn("Can't send ready status: not in a tournament");
      return false;
    }
    
    if (typeof WebSocketManager !== 'undefined' && WebSocketManager.isConnected()) {
      // Send ready status to server
      const result = WebSocketManager.send({
        type: "tournament_player_ready"
      });
      
      if (result) {
        // Show a waiting message
        showTournamentStatus("Sending ready status...");
        
        // Disable ready button to prevent repeated clicks
        const readyButton = document.getElementById('ready-for-match');
        if (readyButton) {
          readyButton.disabled = true;
          readyButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Sending...';
        }
        
        const waitingReadyButton = document.getElementById('waiting-ready-button');
        if (waitingReadyButton) {
          waitingReadyButton.disabled = true;
          waitingReadyButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Sending...';
        }
      }
      
      return result;
    }
    
    return false;
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

  function initTournamentButtons() {
    console.log("Initializing tournament buttons");
    
    // Force setup event listeners
    setupEventListeners();
    
    // If in a tournament, ensure proper UI state
    if (currentTournament) {
      // Show tournament section and hide list
      if (elements.activeTournament) {
        elements.activeTournament.style.display = 'block';
      }
      
      if (elements.availableTournaments) {
        elements.availableTournaments.style.display = 'none';
      }
      
      // Check start button
      const startTournamentBtn = document.getElementById('start-tournament');
      if (startTournamentBtn) {
        // Only show if creator and not started
        if (isTournamentCreator && !currentTournament.started) {
          console.log("Showing start tournament button (init)");
          startTournamentBtn.style.display = 'block';
          startTournamentBtn.disabled = false;
        } else {
          console.log("Hiding start tournament button (init)");
          startTournamentBtn.style.display = 'none';
        }
      }
      
      // Request fresh tournament data
      requestTournamentRefresh();
    }
  }
    
    // Add the button click handlers directly as a failsafe
    const startTournamentBtn = document.getElementById('start-tournament');
    if (startTournamentBtn) {
      console.log("Attaching handler directly to start tournament button");
      
      // Remove any existing event listeners
      const newBtn = startTournamentBtn.cloneNode(true);
      if (startTournamentBtn.parentNode) {
        startTournamentBtn.parentNode.replaceChild(newBtn, startTournamentBtn);
      }
      
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Start tournament button clicked");
        
        if (!checkWebSocketConnection()) {
          showError("Not connected to server. Please refresh the page.");
          return;
        }
        
        const tournamentId = getCurrentTournamentId();
        if (!tournamentId) {
          showError("No active tournament to start");
          return;
        }
        
        console.log("Sending start request for tournament:", tournamentId);
        WebSocketManager.send({
          type: "start_tournament",
          tournament_id: tournamentId
        });
        
        // Visual feedback
        newBtn.disabled = true;
        newBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Starting...';
        
        // Re-enable after timeout as a failsafe
        setTimeout(() => {
          newBtn.disabled = false;
          newBtn.innerHTML = '<i class="fa fa-play-circle"></i> Start Tournament';
        }, 3000);
      });
    } else {
      console.warn("Start tournament button not found in DOM");
    }

  
  function requestTournamentRefresh() {
    if (currentTournament && currentTournament.id && 
        typeof WebSocketManager !== 'undefined' && 
        WebSocketManager.isConnected && WebSocketManager.isConnected()) {
      
      console.log("Requesting tournament refresh");
      WebSocketManager.send({
        type: "get_tournament_info",
        tournament_id: currentTournament.id
      });
      
      return true;
    }
    return false;
  }

  /**
   * Recover active tournament if player is in one
   * @returns {boolean} - Whether recovery was successful
   */
  function recoverActiveTournament() {
    // Check localStorage for tournament ID
    let tournamentId = null;
    let isCreator = false;
    
    try {
      tournamentId = localStorage.getItem('activeTournamentId');
      isCreator = localStorage.getItem('isTournamentCreator') === 'true';
    } catch (e) {
      console.warn("Could not access localStorage", e);
    }
    
    // If no stored ID, check current internal state
    if (!tournamentId && currentTournament) {
      tournamentId = currentTournament.id;
      isCreator = isTournamentCreator;
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
    
    // Set creator status for when we receive the tournament data
    isTournamentCreator = isCreator;
    console.log("Recovering tournament, creator status:", isCreator);
    
    // Request latest tournament data
    if (typeof WebSocketManager !== 'undefined' && WebSocketManager.isConnected()) {
      WebSocketManager.send({
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
      
      // If we know we're the creator, show the start button immediately
      if (isCreator && elements.startTournament) {
        console.log("Recovering as creator, showing start button");
        elements.startTournament.style.display = 'block';
      }
      
      // Ensure available tournaments section is hidden
      if (elements.availableTournaments) {
        elements.availableTournaments.style.display = 'none';
      }
      
      // Display a loading spinner or message while we wait for server response
      if (typeof Utils !== 'undefined' && Utils.showLoading) {
        Utils.showLoading(elements.tournamentPlayers);
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Clear any tournament-related warnings and UI elements
   */
  function clearWarnings() {
    // Hide tournament leave warning
    const leaveWarning = document.getElementById('tournament-leave-warning');
    if (leaveWarning) {
      leaveWarning.style.display = 'none';
    }
    
    // Hide tournament warning banner
    const warningBanner = document.getElementById('tournament-warning-banner');
    if (warningBanner) {
      warningBanner.style.display = 'none';
    }
    
    // Hide waiting screen
    hideWaitingScreen();
    
    // Hide status notification
    hideTournamentStatus();
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
    startTournament,
    recoverActiveTournament,
    sendPlayerReady,
    showReadySection,
    hideReadySection,
    showTournamentStatus,
    hideTournamentStatus,
    showWaitingForNextMatch,
    hideWaitingScreen,
    handleMatchReady,
    clearWarnings,
    checkWebSocketConnection,
    initTournamentButtons
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
module.exports = TournamentManager;
}

window.TournamentManager = TournamentManager;