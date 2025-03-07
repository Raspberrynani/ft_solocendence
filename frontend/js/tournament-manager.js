/**
 * Tournament Manager Module
 * Handles tournament creation, joining, and UI interactions
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
      
      // Set up event listeners for tournament controls
      setupEventListeners();
      
      // Request latest tournament list if WebSocket is connected
      if (typeof WebSocketManager !== 'undefined' && WebSocketManager.isConnected && WebSocketManager.isConnected()) {
          WebSocketManager.send({
              type: "get_tournaments"
          });
      }
      
      // Apply styles
      applyStyles();
      
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
  }
  
  /**
   * Apply custom styles for tournament UI
   */
  function applyStyles() {
      // Create style element if not exists
      if (!document.getElementById('tournament-manager-styles')) {
          const style = document.createElement('style');
          style.id = 'tournament-manager-styles';
          style.textContent = `
              .player-count-status {
                  padding: 5px 10px;
                  border-radius: 5px;
                  text-align: center;
                  font-weight: bold;
                  margin-bottom: 10px;
              }
              
              .status-ok {
                  background-color: rgba(40, 167, 69, 0.2);
                  color: #28a745;
              }
              
              .status-warning {
                  background-color: rgba(255, 193, 7, 0.2);
                  color: #ffc107;
              }
              
              .tournament-rules-list li {
                  margin-bottom: 10px;
              }
              
              .tournament-status.started {
                  color: #28a745;
                  font-weight: bold;
              }
              
              .current-match {
                  animation: matchPulse 2s infinite;
                  border: 2px solid rgba(0, 123, 255, 0.5);
                  border-radius: 5px;
                  padding: 10px;
                  margin-bottom: 10px;
              }
              
              @keyframes matchPulse {
                  0%, 100% { background-color: rgba(0, 123, 255, 0.1); }
                  50% { background-color: rgba(0, 123, 255, 0.2); }
              }
              
              .match-winner {
                  color: #28a745;
                  font-weight: bold;
              }
              
              .highlight-match {
                  animation: highlightPulse 1s infinite;
              }
              
              @keyframes highlightPulse {
                  0%, 100% { background-color: rgba(0, 123, 255, 0.2); }
                  50% { background-color: rgba(0, 123, 255, 0.4); }
              }
          `;
          document.head.appendChild(style);
      }
  }
  
  /**
   * Show tournament rules in a modal
   */
  function showTournamentRules() {
      const rulesModal = document.createElement('div');
      rulesModal.className = 'modal tournament-rules-modal';
      rulesModal.style.position = 'fixed';
      rulesModal.style.top = '0';
      rulesModal.style.left = '0';
      rulesModal.style.width = '100%';
      rulesModal.style.height = '100%';
      rulesModal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      rulesModal.style.display = 'flex';
      rulesModal.style.justifyContent = 'center';
      rulesModal.style.alignItems = 'center';
      rulesModal.style.zIndex = '1050';
      
      rulesModal.innerHTML = `
          <div class="modal-content" style="background-color: rgba(0, 0, 0, 0.8); border-radius: 10px; padding: 20px; max-width: 80%; border: 1px solid rgba(0, 123, 255, 0.5);">
              <h3>Tournament Rules</h3>
              <ul class="tournament-rules-list">
                  <li>Tournaments require an even number of players (2-10)</li>
                  <li>Players are randomly matched in pairs</li>
                  <li>Each match has the specified number of rounds</li>
                  <li>Winners proceed to the next round</li>
                  <li>The tournament continues until all matches are complete</li>
              </ul>
              <button class="close-modal btn btn-primary mt-3">Got it!</button>
          </div>
      `;
      
      // Add close functionality
      const closeBtn = rulesModal.querySelector('.close-modal');
      closeBtn.addEventListener('click', () => {
          rulesModal.remove();
      });
      
      // Close modal when clicking outside
      rulesModal.addEventListener('click', (e) => {
          if (e.target === rulesModal) {
              rulesModal.remove();
          }
      });
      
      document.body.appendChild(rulesModal);
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
      
      // Show tournament rules to the creator
      showTournamentRules();
      
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
      isTournamentCreator = true;
      
      // Update tournament UI
      updateTournamentUI(tournament);
      
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
      
      // Add tournament rules button if not present
      addTournamentRulesButton();
      
      // Add player count status indicator
      updatePlayerCountStatus(tournament);
      
      // Show toast notification
      if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast("Tournament created successfully!", "success");
      }
  }
  
  /**
   * Add tournament rules button to UI
   */
  function addTournamentRulesButton() {
      if (!document.getElementById('tournament-rules-button') && 
          elements.activeTournament) {
          const tournamentControls = elements.activeTournament.querySelector('.tournament-controls');
          
          if (tournamentControls) {
              const rulesButton = document.createElement('button');
              rulesButton.id = 'tournament-rules-button';
              rulesButton.className = 'btn btn-sm btn-info me-2';
              rulesButton.innerHTML = 'Tournament Rules';
              rulesButton.addEventListener('click', showTournamentRules);
              
              tournamentControls.prepend(rulesButton);
          }
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
      isTournamentCreator = false;
      
      // Update tournament UI
      updateTournamentUI(tournament);
      
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
      
      // Add tournament rules button
      addTournamentRulesButton();
      
      // Update player count status
      updatePlayerCountStatus(tournament);
      
      // Show toast notification
      if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast("Joined tournament successfully!", "success");
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
      
      // Show tournament warning
      const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
      if (tournamentLeaveWarning) {
          tournamentLeaveWarning.style.display = 'block';
      }
      
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
              
              // Show toast notification
              if (typeof Utils !== 'undefined' && Utils.showToast) {
                  Utils.showToast("It's your turn to play! Get ready for your match.", "info");
              }
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
      
      // Show toast notification
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
      
      // Show alert
      if (typeof Utils !== 'undefined' && Utils.showAlert) {
          Utils.showAlert(message, "warning");
      } else {
          alert(`Tournament error: ${message}`);
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
      
      // Remove player count status
      const statusIndicator = document.getElementById('player-count-status');
      if (statusIndicator) {
          statusIndicator.remove();
      }
      
      console.log("Tournament state reset");
      
      // Reset in localStorage for tournament warning system
      try {
          localStorage.setItem('inTournament', 'false');
      } catch (e) {
          console.warn("Could not store in localStorage", e);
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
      startTournament,
      showTournamentRules
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TournamentManager;
}

window.TournamentManager = TournamentManager;