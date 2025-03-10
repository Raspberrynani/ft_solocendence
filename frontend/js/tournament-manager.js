/**
 * Tournament Manager
 * Handles all tournament-related functionality
 */
const TournamentManager = (function() {
    // Private variables
    let currentTournament = null;
    let isCreator = false;
    let currentUsername = "";
    let elements = {};
    let websocketConnector = null;
    
    /**
     * Initialize the Tournament Manager
     * @param {Object} options Configuration options
     */
    function init(options = {}) {
      console.log("TournamentManager: Initializing...");
      
      // Store username
      currentUsername = options.username || "";
      if (!currentUsername) {
        console.error("TournamentManager: Username is required");
        return false;
      }
      
      // Store WebSocket connector
      websocketConnector = options.websocket || null;
      if (!websocketConnector) {
        console.error("TournamentManager: WebSocket connector is required");
        return false;
      }
      
      // Cache DOM elements
      cacheElements();
      
      // Set up event listeners
      setupEventListeners();
      
      // Request available tournaments
      requestTournamentsList();
      
      console.log("TournamentManager: Initialized successfully");
      return true;
    }
    
    /**
     * Cache DOM elements for quick access
     */
    function cacheElements() {
      elements = {
        // Sections
        createTournamentSection: document.getElementById("create-tournament-section"),
        activeTournamentSection: document.getElementById("active-tournament-section"),
        availableTournamentsSection: document.getElementById("available-tournaments-section"),
        currentMatchSection: document.getElementById("current-match-section"),
        upcomingMatchesSection: document.getElementById("upcoming-matches-section"),
        completedMatchesSection: document.getElementById("completed-matches-section"),
        
        // Lists
        tournamentPlayersList: document.getElementById("tournament-players-list"),
        availableTournamentsList: document.getElementById("available-tournaments-list"),
        upcomingMatchesList: document.getElementById("upcoming-matches-list"),
        completedMatchesList: document.getElementById("completed-matches-list"),
        
        // Buttons
        createTournamentBtn: document.getElementById("create-tournament-btn"),
        startTournamentBtn: document.getElementById("start-tournament-btn"),
        leaveTournamentBtn: document.getElementById("leave-tournament-btn"),
        tournamentBackBtn: document.getElementById("tournament-back-btn"),
        playMatchBtn: document.getElementById("play-match-btn"),
        
        // Inputs
        tournamentNameInput: document.getElementById("tournament-name-input"),
        tournamentRoundsInput: document.getElementById("tournament-rounds-input"),
        
        // Display elements
        activeTournamentName: document.getElementById("active-tournament-name"),
        playerCountIndicator: document.getElementById("player-count-indicator"),
        currentMatchDisplay: document.getElementById("current-match-display"),
        currentMatchPlayer1: document.getElementById("current-match-player1"),
        currentMatchPlayer2: document.getElementById("current-match-player2"),
        yourMatchIndicator: document.getElementById("your-match-indicator"),
        
        // Modal elements
        tournamentResultModal: document.getElementById("tournament-result-modal"),
        tournamentWinnerName: document.getElementById("tournament-winner-name"),
        matchesPlayedCount: document.getElementById("matches-played-count"),
        totalPlayersCount: document.getElementById("total-players-count")
      };
    }
    
    /**
     * Set up event listeners for user interactions
     */
    function setupEventListeners() {
      // Create tournament button
      if (elements.createTournamentBtn) {
        elements.createTournamentBtn.addEventListener("click", createTournament);
      }
      
      // Start tournament button
      if (elements.startTournamentBtn) {
        elements.startTournamentBtn.addEventListener("click", startTournament);
      }
      
      // Leave tournament button
      if (elements.leaveTournamentBtn) {
        elements.leaveTournamentBtn.addEventListener("click", leaveTournament);
      }
      
      // Tournament back button
      if (elements.tournamentBackBtn) {
        elements.tournamentBackBtn.addEventListener("click", handleBackButton);
      }
      
      // Play match button
      if (elements.playMatchBtn) {
        elements.playMatchBtn.addEventListener("click", playCurrentMatch);
      }
    }
    
    /**
     * Request the list of available tournaments
     */
    function requestTournamentsList() {
      if (!websocketConnector) return;
      
      websocketConnector.send({
        type: "get_tournaments"
      });
    }
    
    /**
     * Create a new tournament
     */
    function createTournament() {
      if (!websocketConnector) {
        showError("Cannot create tournament: WebSocket not connected");
        return;
      }
      
      const tournamentName = elements.tournamentNameInput.value.trim() || `${currentUsername}'s Tournament`;
      const rounds = parseInt(elements.tournamentRoundsInput.value) || 3;
      
      console.log(`Creating tournament: ${tournamentName} with ${rounds} rounds`);
      
      websocketConnector.send({
        type: "create_tournament",
        nickname: currentUsername,
        name: tournamentName,
        rounds: rounds
      });
    }
    
    /**
     * Join an existing tournament
     * @param {string} tournamentId The ID of the tournament to join
     */
    function joinTournament(tournamentId) {
      if (!websocketConnector) {
        showError("Cannot join tournament: WebSocket not connected");
        return;
      }
      
      console.log(`Joining tournament: ${tournamentId}`);
      
      websocketConnector.send({
        type: "join_tournament",
        tournament_id: tournamentId,
        nickname: currentUsername
      });
    }
    
    /**
     * Start a tournament (creator only)
     */
    function startTournament() {
      if (!currentTournament || !isCreator) {
        showError("You cannot start this tournament");
        return;
      }
      
      console.log(`Starting tournament: ${currentTournament.id}`);
      
      websocketConnector.send({
        type: "start_tournament",
        tournament_id: currentTournament.id
      });
    }
    
    /**
     * Leave the current tournament
     */
    function leaveTournament() {
      if (!currentTournament) {
        showError("You are not in a tournament");
        return;
      }
      
      console.log("Leaving tournament");
      
      websocketConnector.send({
        type: "leave_tournament"
      });
    }
    
    /**
     * Handle the back button on the tournament page
     */
    function handleBackButton() {
      if (currentTournament) {
        // Show confirmation if in a tournament
        if (confirm("Leaving will remove you from the current tournament. Continue?")) {
          leaveTournament();
          navigateToMainMenu();
        }
      } else {
        navigateToMainMenu();
      }
    }
    
    /**
     * Play the current match (if it's the user's turn)
     */
    function playCurrentMatch() {
      if (!currentTournament || !currentTournament.current_match) {
        return;
      }
      
      // Check if current user is part of the match
      const currentMatch = currentTournament.current_match;
      if (currentMatch.player1 !== currentUsername && currentMatch.player2 !== currentUsername) {
        showError("You are not part of the current match");
        return;
      }
      
      console.log("Starting match play");
      
      // Hide tournament section and show game section
      navigateToGamePage();
    }
    
    /**
     * Navigate to the main menu
     */
    function navigateToMainMenu() {
      if (window.UIManager && typeof UIManager.navigateTo === 'function') {
        UIManager.navigateTo("game-page");
      }
    }
    
    /**
     * Navigate to the game page
     */
    function navigateToGamePage() {
      if (window.UIManager && typeof UIManager.navigateTo === 'function') {
        UIManager.navigateTo("pong-page");
      }
    }
    
    /**
     * Update the available tournaments list UI
     * @param {Array} tournaments List of available tournaments
     */
    function updateTournamentsList(tournaments) {
      if (!elements.availableTournamentsList) return;
      
      elements.availableTournamentsList.innerHTML = "";
      
      if (!tournaments || tournaments.length === 0) {
        const li = document.createElement("li");
        li.className = "list-group-item text-center";
        li.innerText = "No tournaments available";
        elements.availableTournamentsList.appendChild(li);
        return;
      }
      
      tournaments.forEach(tournament => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        
        // Sanitize name for security
        const safeName = sanitizeHTML(tournament.name);
        
        li.innerHTML = `
          <div>
            <span class="tournament-name">${safeName}</span>
            <span class="badge bg-primary ms-2">${tournament.players} players</span>
          </div>
          <span class="tournament-status ${tournament.started ? 'text-warning' : 'text-success'}">
            ${tournament.started ? 'In Progress' : 'Open'}
          </span>
        `;
        
        // Only allow joining tournaments that haven't started
        if (!tournament.started) {
          li.style.cursor = "pointer";
          li.addEventListener("click", () => joinTournament(tournament.id));
        }
        
        elements.availableTournamentsList.appendChild(li);
      });
    }
    
    /**
     * Handle successful tournament creation
     * @param {Object} tournament The created tournament data
     */
    function handleTournamentCreated(tournament) {
      console.log("Tournament created:", tournament);
      currentTournament = tournament;
      isCreator = true;
      
      // Update UI for active tournament
      showActiveTournament();
      
      // Show success message
      showSuccess("Tournament created successfully!");
    }
    
    /**
     * Handle successful tournament join
     * @param {Object} tournament The joined tournament data
     */
    function handleTournamentJoined(tournament) {
      console.log("Tournament joined:", tournament);
      currentTournament = tournament;
      isCreator = false;
      
      // Update UI for active tournament
      showActiveTournament();
      
      // Show success message
      showSuccess("Tournament joined successfully!");
    }
    
    /**
     * Handle tournament updates
     * @param {Object} tournament Updated tournament data
     */
    function handleTournamentUpdate(tournament) {
      console.log("Tournament updated:", tournament);
      
      // Only process updates for the current tournament
      if (!currentTournament || tournament.id !== currentTournament.id) {
        return;
      }
      
      // Store previous match info to check for changes
      const hadCurrentMatch = currentTournament.current_match !== null;
      const previousMatchPlayers = hadCurrentMatch 
        ? `${currentTournament.current_match.player1} vs ${currentTournament.current_match.player2}` 
        : null;
      
      // Update tournament data
      currentTournament = tournament;
      
      // Update UI
      updateTournamentUI();
      
      // Check if a new match has started with the current player
      const hasNewMatch = tournament.current_match !== null;
      if (hasNewMatch) {
        const currentMatch = tournament.current_match;
        const isPlayerInMatch = currentMatch.player1 === currentUsername || 
                              currentMatch.player2 === currentUsername;
        
        const currentMatchPlayers = `${currentMatch.player1} vs ${currentMatch.player2}`;
        
        // If this is a new match involving the current player, show notification
        if (isPlayerInMatch && (!hadCurrentMatch || previousMatchPlayers !== currentMatchPlayers)) {
          showYourMatchNotification();
        }
      }
    }
    
    /**
     * Handle tournament left event
     */
    function handleTournamentLeft() {
      console.log("Left tournament");
      resetTournamentState();
      showSuccess("You have left the tournament");
    }
    
    /**
     * Handle tournament errors
     * @param {string} message Error message
     */
    function handleTournamentError(message) {
      console.error("Tournament error:", message);
      showError(message);
    }
    
    /**
     * Update the UI to show the active tournament
     */
    function showActiveTournament() {
      if (!currentTournament) return;
      
      // Show/hide appropriate sections
      elements.createTournamentSection.style.display = "none";
      elements.activeTournamentSection.style.display = "block";
      elements.availableTournamentsSection.style.display = "none";
      
      // Show/hide start tournament button based on creator status
      elements.startTournamentBtn.style.display = isCreator ? "block" : "none";
      
      // Update tournament UI with current data
      updateTournamentUI();
    }
    
    /**
     * Update tournament UI with current data
     */
    function updateTournamentUI() {
      if (!currentTournament) return;
      
      // Update tournament name
      elements.activeTournamentName.textContent = sanitizeHTML(currentTournament.name);
      
      // Update player count indicator
      updatePlayerCountIndicator();
      
      // Update players list
      updatePlayersList();
      
      // Update match displays
      updateMatchDisplays();
    }
    
    /**
     * Update the player count indicator
     */
    function updatePlayerCountIndicator() {
      if (!elements.playerCountIndicator || !currentTournament) return;
      
      const playerCount = currentTournament.players.length;
      const isEven = playerCount % 2 === 0;
      const canStart = isEven && playerCount >= 2 && playerCount <= 10;
      
      let message;
      let alertClass;
      
      if (currentTournament.started) {
        message = `Tournament active with ${playerCount} players`;
        alertClass = "alert-info";
      } else if (!isEven) {
        message = `${playerCount} players (need even number to start)`;
        alertClass = "alert-warning";
      } else if (playerCount < 2) {
        message = `${playerCount} players (minimum 2 players)`;
        alertClass = "alert-warning";
      } else if (playerCount > 10) {
        message = `${playerCount} players (maximum 10 players)`;
        alertClass = "alert-warning";
      } else {
        message = `${playerCount} players (ready to start)`;
        alertClass = "alert-success";
      }
      
      elements.playerCountIndicator.textContent = message;
      elements.playerCountIndicator.className = `alert ${alertClass} mb-3`;
    }
    
    /**
     * Update the players list
     */
    function updatePlayersList() {
      if (!elements.tournamentPlayersList || !currentTournament) return;
      
      elements.tournamentPlayersList.innerHTML = "";
      
      currentTournament.players.forEach(player => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        
        // Sanitize name for security
        const safeName = sanitizeHTML(player);
        
        li.innerHTML = `
          <span>${safeName}</span>
          ${player === currentUsername ? '<span class="badge bg-info">You</span>' : ''}
        `;
        
        elements.tournamentPlayersList.appendChild(li);
      });
    }
    
    /**
     * Update match displays (current, upcoming, completed)
     */
    function updateMatchDisplays() {
      if (!currentTournament) return;
      
      // Current match
      if (currentTournament.current_match) {
        elements.currentMatchSection.style.display = "block";
        elements.currentMatchPlayer1.textContent = sanitizeHTML(currentTournament.current_match.player1);
        elements.currentMatchPlayer2.textContent = sanitizeHTML(currentTournament.current_match.player2);
        
        // Check if current user is in the match
        const isInMatch = currentTournament.current_match.player1 === currentUsername || 
                        currentTournament.current_match.player2 === currentUsername;
        
        elements.yourMatchIndicator.style.display = isInMatch ? "block" : "none";
      } else {
        elements.currentMatchSection.style.display = currentTournament.started ? "block" : "none";
        if (elements.currentMatchDisplay) {
          elements.currentMatchDisplay.innerHTML = `
            <p class="text-center m-0">No active match</p>
            ${currentTournament.started ? '<p class="text-center m-0">Waiting for next match...</p>' : ''}
          `;
        }
        elements.yourMatchIndicator.style.display = "none";
      }
      
      // Upcoming matches
      if (currentTournament.upcoming_matches && currentTournament.upcoming_matches.length > 0) {
        elements.upcomingMatchesSection.style.display = "block";
        updateUpcomingMatchesList();
      } else {
        elements.upcomingMatchesSection.style.display = "none";
      }
      
      // Completed matches
      if (currentTournament.completed_matches && currentTournament.completed_matches.length > 0) {
        elements.completedMatchesSection.style.display = "block";
        updateCompletedMatchesList();
      } else {
        elements.completedMatchesSection.style.display = "none";
      }
    }
    
    /**
     * Update the upcoming matches list
     */
    function updateUpcomingMatchesList() {
      if (!elements.upcomingMatchesList || !currentTournament) return;
      
      elements.upcomingMatchesList.innerHTML = "";
      
      currentTournament.upcoming_matches.forEach(match => {
        const li = document.createElement("li");
        li.className = "list-group-item match-item";
        
        // Sanitize names for security
        const player1 = sanitizeHTML(match.player1);
        const player2 = sanitizeHTML(match.player2);
        
        li.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <span>${player1}</span>
            <span class="vs-badge">VS</span>
            <span>${player2}</span>
          </div>
        `;
        
        elements.upcomingMatchesList.appendChild(li);
      });
    }
    
    /**
     * Update the completed matches list
     */
    function updateCompletedMatchesList() {
      if (!elements.completedMatchesList || !currentTournament) return;
      
      elements.completedMatchesList.innerHTML = "";
      
      currentTournament.completed_matches.forEach(match => {
        const li = document.createElement("li");
        li.className = "list-group-item match-item";
        
        // Sanitize names for security
        const player1 = sanitizeHTML(match.player1);
        const player2 = sanitizeHTML(match.player2);
        const winner = sanitizeHTML(match.winner);
        
        li.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <span>${player1}</span>
            <span class="vs-badge">VS</span>
            <span>${player2}</span>
          </div>
          <div class="text-end mt-1">
            <span class="match-winner">Winner: ${winner}</span>
          </div>
        `;
        
        elements.completedMatchesList.appendChild(li);
      });
    }
    
    /**
     * Show notification when it's the player's turn
     */
    function showYourMatchNotification() {
      // Flash the background
      document.body.classList.add("match-alert");
      setTimeout(() => {
        document.body.classList.remove("match-alert");
      }, 2000);
      
      // Show toast notification
      showSuccess("It's your turn to play! Get ready for your match.");
      
      // Play sound if available
      if (window.Audio) {
        try {
          const audio = new Audio("sounds/match-ready.mp3");
          audio.play().catch(e => console.log("Couldn't play notification sound", e));
        } catch (e) {
          console.log("Audio playback error:", e);
        }
      }
    }
    
    /**
     * Reset the tournament state (after leaving or tournament end)
     */
    function resetTournamentState() {
      currentTournament = null;
      isCreator = false;
      
      // Reset UI
      elements.createTournamentSection.style.display = "block";
      elements.activeTournamentSection.style.display = "none";
      elements.availableTournamentsSection.style.display = "block";
      
      // Clear tournament name input
      if (elements.tournamentNameInput) {
        elements.tournamentNameInput.value = "";
      }
      
      // Request fresh tournament list
      requestTournamentsList();
    }
    
    /**
     * Check if user is currently in a tournament
     * @returns {boolean} True if in a tournament
     */
    function isInTournament() {
      return currentTournament !== null;
    }
    
    /**
     * Check if the tournament is complete
     * @returns {boolean} True if the tournament is complete
     */
    function isTournamentComplete() {
      if (!currentTournament) return false;
      
      return (
        currentTournament.started && 
        (!currentTournament.upcoming_matches || currentTournament.upcoming_matches.length === 0) &&
        !currentTournament.current_match
      );
    }
    
    /**
     * Show a tournament result modal
     * @param {string} winner The tournament winner
     * @param {Object} stats Tournament statistics
     */
    function showTournamentResult(winner, stats = {}) {
      if (!elements.tournamentResultModal) return;
      
      // Set winner name
      elements.tournamentWinnerName.textContent = sanitizeHTML(winner);
      
      // Set stats
      elements.matchesPlayedCount.textContent = stats.matchesPlayed || 0;
      elements.totalPlayersCount.textContent = stats.totalPlayers || 0;
      
      // Show modal
      const modal = new bootstrap.Modal(elements.tournamentResultModal);
      modal.show();
    }
    
    /**
     * Show an error message
     * @param {string} message Error message to display
     */
    function showError(message) {
      if (window.Utils && Utils.showAlert) {
        Utils.showAlert(message, "warning");
      } else if (window.App && App.showError) {
        App.showError(message, "warning");
      } else {
        console.error(message);
        alert(message);
      }
    }
    
    /**
     * Show a success message
     * @param {string} message Success message to display
     */
    function showSuccess(message) {
      if (window.Utils && Utils.showToast) {
        Utils.showToast(message, "success");
      } else if (window.App && App.showToast) {
        App.showToast(message, "success");
      } else {
        console.log(message);
      }
    }
    
    /**
     * Sanitize HTML to prevent XSS
     * @param {string} str The string to sanitize
     * @returns {string} Sanitized string
     */
    function sanitizeHTML(str) {
      if (window.Utils && Utils.sanitizeHTML) {
        return Utils.sanitizeHTML(str);
      }
      
      if (!str) return '';
      const temp = document.createElement('div');
      temp.textContent = str;
      return temp.innerHTML;
    }
    
    // Public API
    return {
      init,
      updateTournamentList: updateTournamentsList, // Alias for backward compatibility
      handleTournamentCreated,
      handleTournamentJoined,
      handleTournamentUpdate,
      handleTournamentLeft,
      handleTournamentError,
      isInTournament,
      isTournamentComplete,
      resetTournamentState,
      createTournament,
      joinTournament,
      leaveTournament,
      startTournament,
      navigateToGamePage, // Used by App when tournament match is starting
      showTournamentResult
    };
  })();
  
  // Make available globally
  window.TournamentManager = TournamentManager;