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
    let websocket = null;
    
    // Tournament structure
    const tournamentSizes = [4, 6, 8];
    
    /**
     * Initialize the Tournament Manager
     * @param {Object} options Configuration options
     */
    function init(options = {}) {
        console.log("TournamentManager: Initializing...");
        
        // Store username
        currentUsername = options.username || localStorage.getItem('currentNickname') || "";
        if (!currentUsername) {
            console.error("TournamentManager: Username is required");
            return false;
        }
        
        // Store WebSocket instance
        websocket = options.websocket || window.WebSocketManager;
        if (!websocket) {
            console.error("TournamentManager: WebSocket instance is required");
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
        // Main sections
        elements.tournamentSelection = document.getElementById("tournament-selection");
        elements.tournamentLobby = document.getElementById("tournament-lobby");
        elements.availableTournamentsSection = document.getElementById("available-tournaments-section");
        elements.tournamentVictory = document.getElementById("tournament-victory");
        elements.tournamentEliminated = document.getElementById("tournament-eliminated");
        
        // Tournament selection elements
        elements.tournamentSize = document.getElementById("tournament-size");
        elements.tournamentRoundsInput = document.getElementById("tournament-rounds-input");
        elements.createTournamentBtn = document.getElementById("create-tournament-btn");
        elements.joinTournamentBtn = document.getElementById("join-tournament-btn");
        
        // Tournament lobby elements
        elements.tournamentLobbyName = document.getElementById("tournament-lobby-name");
        elements.tournamentPlayerCount = document.getElementById("tournament-player-count");
        elements.tournamentStatus = document.getElementById("tournament-status");
        elements.tournamentLobbyMessage = document.getElementById("tournament-lobby-message");
        elements.tournamentPlayersList = document.getElementById("tournament-players-list");
        elements.leaveTournamentBtn = document.getElementById("leave-tournament-btn");
        elements.startTournamentBtn = document.getElementById("start-tournament-btn");
        
        // Current match elements
        elements.currentMatchSection = document.getElementById("current-match-section");
        elements.currentMatchPlayer1 = document.getElementById("current-match-player1");
        elements.currentMatchPlayer2 = document.getElementById("current-match-player2");
        elements.yourMatchIndicator = document.getElementById("your-match-indicator");
        elements.playMatchBtn = document.getElementById("play-match-btn");
        elements.matchResultsSection = document.getElementById("match-results-section");
        elements.matchResultsList = document.getElementById("match-results-list");
        
        // Available tournaments elements
        elements.availableTournamentsList = document.getElementById("available-tournaments-list");
        elements.refreshTournamentsBtn = document.getElementById("refresh-tournaments-btn");
        
        // Victory and elimination elements
        elements.winnerName = document.getElementById("winner-name");
        elements.victoryContinue = document.getElementById("victory-continue");
        elements.eliminationWinnerName = document.getElementById("elimination-winner-name");
        elements.eliminationContinue = document.getElementById("elimination-continue");
        
        // Navigation
        elements.tournamentBackBtn = document.getElementById("tournament-back-btn");
    }
    
    /**
     * Set up event listeners for user interactions
     */
    function setupEventListeners() {
        // Create tournament button
        if (elements.createTournamentBtn) {
            elements.createTournamentBtn.addEventListener("click", createTournament);
        }
        
        // Join available tournament button
        if (elements.joinTournamentBtn) {
            elements.joinTournamentBtn.addEventListener("click", () => {
                elements.tournamentSelection.style.display = "none";
                elements.availableTournamentsSection.style.display = "block";
            });
        }
        
        // Refresh tournaments button
        if (elements.refreshTournamentsBtn) {
            elements.refreshTournamentsBtn.addEventListener("click", requestTournamentsList);
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
        
        // Victory continue button
        if (elements.victoryContinue) {
            elements.victoryContinue.addEventListener("click", () => {
                elements.tournamentVictory.style.display = "none";
                navigateToMainMenu();
            });
        }
        
        // Elimination continue button
        if (elements.eliminationContinue) {
            elements.eliminationContinue.addEventListener("click", () => {
                elements.tournamentEliminated.style.display = "none";
                navigateToMainMenu();
            });
        }
    }
    
    /**
     * Request the list of available tournaments
     */
    function requestTournamentsList() {
        if (!websocket) return;
        
        showLoading(elements.availableTournamentsList);
        
        websocket.send({
            type: "get_tournaments"
        });
    }
    
    /**
     * Create a new tournament
     */
    function createTournament() {
        if (!websocket) {
            showError("Cannot create tournament: WebSocket not connected");
            return;
        }
        
        const tournamentSize = parseInt(elements.tournamentSize.value) || 4;
        const rounds = parseInt(elements.tournamentRoundsInput.value) || 3;
        
        if (!tournamentSizes.includes(tournamentSize)) {
            showError("Invalid tournament size. Please select 4, 6, or 8 players.");
            return;
        }
        
        const tournamentName = `${currentUsername}'s ${tournamentSize}-Player Tournament`;
        
        console.log(`Creating tournament: ${tournamentName} with ${tournamentSize} players and ${rounds} rounds`);
        
        websocket.send({
            type: "create_tournament",
            nickname: currentUsername,
            name: tournamentName,
            size: tournamentSize,
            rounds: rounds
        });
    }
    
    /**
     * Join an existing tournament
     * @param {string} tournamentId The ID of the tournament to join
     */
    function joinTournament(tournamentId) {
        if (!websocket) {
            showError("Cannot join tournament: WebSocket not connected");
            return;
        }
        
        console.log(`Joining tournament: ${tournamentId}`);
        
        websocket.send({
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
        
        websocket.send({
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
        
        websocket.send({
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
        // First, check if there's a current match in the tournament data
        let matchToPlay = null;
        
        if (!currentTournament) {
          showError("No active tournament");
          return;
        }
        
        if (currentTournament.current_match) {
          matchToPlay = currentTournament.current_match;
        } else if (currentTournament.matches) {
          // Try to find the final match that should be played
          const finalMatches = currentTournament.matches.filter(m => 
            m.round === Math.ceil(Math.log2(currentTournament.size)) - 1 && 
            m.player1 && m.player2 && !m.winner);
          
          if (finalMatches.length === 1) {
            matchToPlay = {
              player1: finalMatches[0].player1,
              player2: finalMatches[0].player2
            };
          }
        }
        
        if (!matchToPlay) {
          showError("No match available to play");
          return;
        }
        
        // Check if current user is part of the match
        const isInMatch = checkIfPlayerInMatch(currentUsername, matchToPlay);
        
        if (!isInMatch) {
          showError("You are not part of the current match");
          return;
        }
        
        console.log("Starting match play for tournament match:", matchToPlay);
        
        // Inform the server we're ready to play our match
        if (window.WebSocketManager) {
          WebSocketManager.send({
            type: "ready_for_match",
            tournament_id: currentTournament.id,
            nickname: currentUsername
          });
        }
        
        // Set a flag in App state to indicate this is a tournament game
        if (window.App && App.state && App.state.game) {
          App.state.game.isTournament = true;
          console.log("Tournament game flag set");
        }
        
        // Navigate to game page
        navigateToGamePage();
    }
      
    /**
     * Check if a player is in a match
     * @param {string} playerName Player name to check
     * @param {Object} match Match object to check
     * @returns {boolean} True if player is in match
     */
    function checkIfPlayerInMatch(playerName, match) {
        if (!match || !playerName) return false;
        return match.player1 === playerName || match.player2 === playerName;
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
            
            // Set tournament game flag if we have access to App
            if (window.App && App.state && App.state.game) {
                App.state.game.isTournament = true;
            }
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
        
        // Filter tournaments that haven't started
        const availableTournaments = tournaments.filter(t => !t.started);
        
        if (availableTournaments.length === 0) {
            const li = document.createElement("li");
            li.className = "list-group-item text-center";
            li.innerText = "No open tournaments available";
            elements.availableTournamentsList.appendChild(li);
            return;
        }
        
        availableTournaments.forEach(tournament => {
            const li = document.createElement("li");
            li.className = "list-group-item tournament-item";
            
            // Sanitize name for security
            const safeName = sanitizeHTML(tournament.name);
            
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="tournament-name">${safeName}</span>
                        <span class="badge bg-primary ms-2">${tournament.players} players</span>
                    </div>
                    <button class="btn btn-sm btn-success join-tournament-btn">Join</button>
                </div>
            `;
            
            // Add join button handler
            const joinButton = li.querySelector('.join-tournament-btn');
            joinButton.addEventListener("click", () => joinTournament(tournament.id));
            
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
        
        // Show tournament lobby
        showTournamentLobby();
        
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
        
        // Show tournament lobby
        showTournamentLobby();
        
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
          console.log("Received update for a different tournament or no current tournament");
          return;
        }
        
        // Store previous state to check for changes
        const wasStarted = currentTournament.started;
        const previousCurrentMatch = currentTournament.current_match;
        const previousWinner = currentTournament.winner;
        
        // Update tournament data
        currentTournament = tournament;
        
        // If we're on a non-tournament page but should be viewing the tournament,
        // navigate to the tournament page
        const tournamentPage = document.getElementById("tournament-page");
        if (tournamentPage && !tournamentPage.classList.contains("active")) {
          console.log("Tournament update received while not on tournament page - navigating back");
          if (window.UIManager && typeof UIManager.navigateTo === 'function') {
            // Small delay to ensure all state is updated
            setTimeout(() => {
              UIManager.navigateTo("tournament-page");
            }, 300);
          }
        }
        
        // Check if tournament has started
        if (!wasStarted && tournament.started) {
          // Show match info when tournament starts
          showTournamentMatches();
        } else {
          // Update UI based on current state
          if (tournament.started) {
            updateCurrentMatchDisplay();
            updateMatchResultsDisplay();
          } else {
            updateLobbyDisplay();
          }
        }
        
        // Check if a new match has started with the current player
        if (tournament.current_match && (!previousCurrentMatch || 
            previousCurrentMatch.player1 !== tournament.current_match.player1 || 
            previousCurrentMatch.player2 !== tournament.current_match.player2)) {
            
          const isInMatch = checkIfPlayerInMatch(currentUsername, tournament.current_match);
          if (isInMatch) {
            showYourMatchNotification();
          }
        }
        
        // Check if tournament has ended and player is the winner
        if (tournament.started && tournament.winner === currentUsername && 
            tournament.winner !== previousWinner) {
          showTournamentVictory();
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
     * Show tournament lobby UI
     */
    function showTournamentLobby() {
        // Hide other sections
        elements.tournamentSelection.style.display = "none";
        elements.availableTournamentsSection.style.display = "none";
        
        // Show lobby
        elements.tournamentLobby.style.display = "block";
        
        // If there's a container for match results, hide it
        if (elements.matchResultsSection) {
            elements.matchResultsSection.style.display = "none";
        }
        
        // If there's a container for current match, hide it
        if (elements.currentMatchSection) {
            elements.currentMatchSection.style.display = "none";
        }
        
        // Update lobby display
        updateLobbyDisplay();
    }
    
    /**
     * Update tournament lobby display
     */
    function updateLobbyDisplay() {
        if (!currentTournament) return;
        
        // Update tournament name
        elements.tournamentLobbyName.textContent = sanitizeHTML(currentTournament.name);
        
        // Update player count
        const playerCount = currentTournament.players.length;
        const maxPlayers = currentTournament.size || 8;
        elements.tournamentPlayerCount.textContent = `${playerCount}/${maxPlayers} Players`;
        
        // Update status
        elements.tournamentStatus.textContent = currentTournament.started ? "In Progress" : "Waiting";
        
        // Update message
        const isEven = playerCount % 2 === 0;
        const hasMinPlayers = playerCount >= 4;
        const canStart = isEven && hasMinPlayers && isCreator;
        
        if (currentTournament.started) {
            elements.tournamentLobbyMessage.textContent = "Tournament has started!";
            elements.tournamentLobbyMessage.className = "alert alert-success mb-3";
        } else if (!isEven) {
            elements.tournamentLobbyMessage.textContent = "Waiting for one more player to make even teams...";
            elements.tournamentLobbyMessage.className = "alert alert-warning mb-3";
        } else if (!hasMinPlayers) {
            elements.tournamentLobbyMessage.textContent = "Need at least 4 players to start...";
            elements.tournamentLobbyMessage.className = "alert alert-warning mb-3";
        } else if (!isCreator) {
            elements.tournamentLobbyMessage.textContent = "Waiting for tournament creator to start...";
            elements.tournamentLobbyMessage.className = "alert alert-info mb-3";
        } else {
            elements.tournamentLobbyMessage.textContent = "Tournament is ready to start!";
            elements.tournamentLobbyMessage.className = "alert alert-success mb-3";
        }
        
        // Show/hide start button
        elements.startTournamentBtn.style.display = canStart ? "inline-block" : "none";
        
        // Update players list
        updatePlayersList();
    }
    
    /**
     * Update the players list in the lobby
     */
    function updatePlayersList() {
        if (!elements.tournamentPlayersList || !currentTournament) return;
        
        elements.tournamentPlayersList.innerHTML = "";
        
        currentTournament.players.forEach((player, index) => {
            const li = document.createElement("li");
            li.className = "list-group-item d-flex justify-content-between align-items-center";
            
            // Sanitize name for security
            const safeName = sanitizeHTML(player);
            
            // Add creator indicator
            const isCreatorBadge = index === 0 ? '<span class="badge bg-primary ms-2">Creator</span>' : '';
            
            li.innerHTML = `
                <div>
                    <span class="player-name">${safeName}</span>
                    ${player === currentUsername ? '<span class="badge bg-info ms-2">You</span>' : ''}
                    ${isCreatorBadge}
                </div>
                <span class="player-status">Ready</span>
            `;
            
            elements.tournamentPlayersList.appendChild(li);
        });
    }
    
    /**
     * Show tournament matches and current match info (replaces bracket)
     */
    function showTournamentMatches() {
        // Hide other sections
        elements.tournamentSelection.style.display = "none";
        elements.tournamentLobby.style.display = "none";
        elements.availableTournamentsSection.style.display = "none";
        
        // Show current match section
        if (elements.currentMatchSection) {
            elements.currentMatchSection.style.display = "block";
        }
        
        // Show match results section if there are completed matches
        if (elements.matchResultsSection) {
            elements.matchResultsSection.style.display = "block";
        }
        
        // Update current match display
        updateCurrentMatchDisplay();
        
        // Update match results list
        updateMatchResultsDisplay();
    }
    
    /**
     * Update the current match display
     */
    function updateCurrentMatchDisplay() {
        if (!currentTournament) return;
        
        if (currentTournament.current_match) {
          // Show current match
          elements.currentMatchSection.style.display = "block";
          elements.currentMatchPlayer1.textContent = sanitizeHTML(currentTournament.current_match.player1);
          elements.currentMatchPlayer2.textContent = sanitizeHTML(currentTournament.current_match.player2);
          
          // Check if current user is in the match
          const isInMatch = checkIfPlayerInMatch(currentUsername, currentTournament.current_match);
          elements.yourMatchIndicator.style.display = isInMatch ? "block" : "none";
        } else {
          // No current match
          if (currentTournament.winner) {
            // Tournament is over
            elements.currentMatchSection.style.display = "none";
          } else {
            // Tournament is in progress but no active match - attempt to find a final match
            elements.currentMatchSection.style.display = "block";
            
            // Try to find the final match that should be played
            if (currentTournament.matches) {
              // Look for a final match (one with no "next_match") that has both players but no winner
              const finalMatches = currentTournament.matches.filter(m => 
                m.round === Math.ceil(Math.log2(currentTournament.size)) - 1 && 
                m.player1 && m.player2 && !m.winner);
              
              if (finalMatches.length === 1) {
                // Found a potential final match
                const finalMatch = finalMatches[0];
                console.log("Found potential final match:", finalMatch);
                
                // Show this match as the "current match"
                elements.currentMatchPlayer1.textContent = sanitizeHTML(finalMatch.player1);
                elements.currentMatchPlayer2.textContent = sanitizeHTML(finalMatch.player2);
                
                // Check if current user is in this match
                const isInMatch = finalMatch.player1 === currentUsername || finalMatch.player2 === currentUsername;
                elements.yourMatchIndicator.style.display = isInMatch ? "block" : "none";
                
                // Add a special class to indicate this is a waiting final match
                elements.currentMatchSection.classList.add("final-match-waiting");
                
                // Add a click handler to the whole section to potentially trigger the match
                elements.currentMatchSection.onclick = function() {
                  if (isInMatch) {
                    // Try to force the final match to start by sending a manual request
                    if (window.WebSocketManager) {
                      console.log("Attempting to force start final match");
                      WebSocketManager.send({
                        type: "request_final_match",
                        tournament_id: currentTournament.id
                      });
                    }
                    
                    // Also try to start the match via normal means
                    playCurrentMatch();
                  }
                };
                
                return;
              }
            }
            
            // Default display if no match found
            elements.currentMatchPlayer1.textContent = "Waiting";
            elements.currentMatchPlayer2.textContent = "Waiting";
            elements.yourMatchIndicator.style.display = "none";
            
            // Add a refresh button for matches
            if (!document.getElementById('refresh-matches-btn')) {
              const refreshBtn = document.createElement('button');
              refreshBtn.id = 'refresh-matches-btn';
              refreshBtn.className = 'btn btn-sm btn-info mt-2';
              refreshBtn.innerHTML = 'Refresh Matches';
              refreshBtn.onclick = function() {
                // Request updated tournament state from server
                if (window.WebSocketManager) {
                  WebSocketManager.send({
                    type: "get_tournament_state",
                    tournament_id: currentTournament.id
                  });
                }
              };
              elements.currentMatchSection.appendChild(refreshBtn);
            }
          }
        }
    }
    
    /**
     * Update the match results display
     */
    function updateMatchResultsDisplay() {
        if (!currentTournament || !elements.matchResultsList) return;
        
        // Get completed matches
        const completedMatches = currentTournament.matches ? 
            currentTournament.matches.filter(m => m.winner) : [];
        
        if (completedMatches.length > 0) {
            elements.matchResultsSection.style.display = "block";
            elements.matchResultsList.innerHTML = "";
            
            // Sort matches by round and position
            completedMatches.sort((a, b) => {
                if (a.round !== b.round) return a.round - b.round;
                return a.position - b.position;
            });
            
            // Add match results
            completedMatches.forEach(match => {
                const li = document.createElement("li");
                li.className = "list-group-item";
                
                // Round number display (0-indexed to 1-indexed)
                const roundNumber = match.round + 1;
                
                li.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="badge bg-secondary">Round ${roundNumber}</span>
                        <div class="match-result">
                            <span class="${match.winner === match.player1 ? 'text-success fw-bold' : ''}">${sanitizeHTML(match.player1)}</span>
                            <span class="mx-2">vs</span>
                            <span class="${match.winner === match.player2 ? 'text-success fw-bold' : ''}">${sanitizeHTML(match.player2)}</span>
                        </div>
                        <span class="text-info">Winner: ${sanitizeHTML(match.winner)}</span>
                    </div>
                `;
                
                elements.matchResultsList.appendChild(li);
            });
        } else {
            elements.matchResultsSection.style.display = "none";
        }
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
     * Show tournament victory screen
     */
    function showTournamentVictory() {
        if (!elements.tournamentVictory) return;
        
        // Update winner name
        elements.winnerName.textContent = `Congratulations, ${sanitizeHTML(currentUsername)}!`;
        
        // Show victory screen
        elements.tournamentVictory.style.display = "flex";
        
        // Create confetti effect
        createConfetti();
    }
    
    /**
     * Show tournament elimination screen
     * @param {string} winner Name of the player who eliminated current player
     */
    function showTournamentElimination(winner) {
        if (!elements.tournamentEliminated) return;
        
        // Update winner name
        elements.eliminationWinnerName.textContent = sanitizeHTML(winner);
        
        // Show elimination screen
        elements.tournamentEliminated.style.display = "flex";
    }
    
    /**
     * Create confetti animation for victory screen
     */
    function createConfetti() {
        const confettiContainer = document.querySelector('.confetti-container');
        if (!confettiContainer) return;
        
        // Clear existing confetti
        confettiContainer.innerHTML = '';
        
        // Create confetti pieces
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', 
                       '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', 
                       '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
        
        for (let i = 0; i < 150; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            
            // Random styling
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.random() * 10 + 5;
            const left = Math.random() * 100;
            const animationDuration = Math.random() * 3 + 2;
            const animationDelay = Math.random() * 2;
            
            confetti.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                background-color: ${color};
                left: ${left}%;
                top: -${size}px;
                opacity: ${Math.random() * 0.5 + 0.5};
                transform: rotate(${Math.random() * 360}deg);
                animation: confetti-fall ${animationDuration}s linear ${animationDelay}s infinite;
            `;
            
            confettiContainer.appendChild(confetti);
        }
        
        // Add animation keyframes if not already added
        if (!document.getElementById('confetti-animation')) {
            const style = document.createElement('style');
            style.id = 'confetti-animation';
            style.textContent = `
                @keyframes confetti-fall {
                    0% { transform: translate(0, 0) rotate(0deg); }
                    100% { transform: translate(${Math.random() * 50 - 25}px, 100vh) rotate(${Math.random() * 360}deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Reset the tournament state (after leaving or tournament end)
     */
    function resetTournamentState() {
        currentTournament = null;
        isCreator = false;
        
        // Reset UI
        elements.tournamentSelection.style.display = "block";
        elements.tournamentLobby.style.display = "none";
        
        if (elements.currentMatchSection) {
            elements.currentMatchSection.style.display = "none";
        }
        
        if (elements.matchResultsSection) {
            elements.matchResultsSection.style.display = "none";
        }
        
        elements.tournamentVictory.style.display = "none";
        elements.tournamentEliminated.style.display = "none";
        
        // Request fresh tournament list
        requestTournamentsList();
    }
    
    /**
     * Display loading indicator in an element
     * @param {HTMLElement} element Element to show loading in
     */
    function showLoading(element) {
        if (!element) return;
        
        element.innerHTML = `
            <li class="list-group-item text-center">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                Loading...
            </li>
        `;
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
    
    /**
     * Check if player is in a tournament
     * @returns {boolean} True if player is in a tournament
     */
    function isInTournament() {
        return currentTournament !== null;
    }
    
    /**
     * Get the current tournament 
     * @returns {Object|null} Current tournament data or null
     */
    function getCurrentTournament() {
        return currentTournament;
    }
    
    /**
     * Set current username
     * @param {string} username New username
     */
    function setNickname(username) {
        currentUsername = username;
    }
    
    // Public API
    return {
        init,
        updateTournamentsList,
        handleTournamentCreated,
        handleTournamentJoined,
        handleTournamentUpdate,
        handleTournamentLeft,
        handleTournamentError,
        isInTournament,
        getCurrentTournament,
        resetTournamentState,
        navigateToGamePage,
        showTournamentVictory,
        showTournamentElimination,
        setNickname
    };
})();

// Make available globally
window.TournamentManager = TournamentManager;