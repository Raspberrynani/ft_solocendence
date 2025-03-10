/**
 * Complete Tournament UI Implementation
 * 
 * This file contains all the code needed to enhance the tournament UI
 * to show current match, upcoming matches, and completed matches.
 */

// Wait for document to be ready
document.addEventListener("DOMContentLoaded", function() {
    // Wait for TournamentManager to be available
    waitForTournamentManager();
  });
  
  /**
   * Wait for TournamentManager to be available before enhancing it
   */
  function waitForTournamentManager() {
    if (window.TournamentManager) {
      enhanceTournamentUI();
    } else {
      setTimeout(waitForTournamentManager, 100);
    }
  }
  
  /**
   * Enhance the Tournament UI
   */
  function enhanceTournamentUI() {
    console.log("Enhancing Tournament UI...");
    
    // Add CSS styles for tournament enhancements
    addTournamentStyles();
    
    // Update HTML for tournament page
    updateTournamentPageHTML();
    
    // Enhance TournamentManager with new methods
    enhanceTournamentManager();
    
    console.log("Tournament UI enhancements complete");
  }
  
  /**
   * Add CSS styles for tournament UI
   */
  function addTournamentStyles() {
    if (document.getElementById('tournament-enhanced-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'tournament-enhanced-styles';
    styleElement.textContent = `
      /* Add pulsing border animation for current match */
      @keyframes pulse-border {
        0% { border-color: #dc3545; }
        50% { border-color: #ffc107; }
        100% { border-color: #dc3545; }
      }
      
      .pulsing-border {
        border: 3px solid #dc3545;
        animation: pulse-border 2s infinite;
      }
      
      /* Style for current match section */
      .current-match-active {
        background-color: rgba(220, 53, 69, 0.1);
        border-radius: 10px;
        padding: 10px;
        margin-bottom: 15px;
      }
      
      /* Style for match items */
      .match-result {
        text-align: center;
        flex-grow: 1;
      }
      
      /* Make scrollable sections for matches */
      .scrollable-container {
        max-height: 200px;
        overflow-y: auto;
        margin-bottom: 15px;
      }
      
      /* Tournament badge styling */
      .tournament-badge {
        position: absolute;
        top: 10px;
        right: 10px;
        background-color: rgba(255, 193, 7, 0.8);
        color: black;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        z-index: 100;
      }
      
      /* Status indicators */
      .match-status {
        font-weight: bold;
      }
      .match-status.upcoming {
        color: #17a2b8;
      }
      .match-status.active {
        color: #dc3545;
      }
      .match-status.completed {
        color: #28a745;
      }
      
      /* VS badge in matches */
      .vs-badge {
        background-color: #343a40;
        color: #fff;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
      }
      
      /* Player cards in matches */
      .player-card {
        background-color: rgba(255,255,255,0.1);
        padding: 5px 10px;
        border-radius: 4px;
        min-width: 100px;
        text-align: center;
      }
    `;
    
    document.head.appendChild(styleElement);
  }
  
  /**
   * Update the tournament page HTML
   */
  function updateTournamentPageHTML() {
    const tournamentPage = document.getElementById('tournament-page');
    if (!tournamentPage) return;
    
    // Check if tournament matches card exists
    let matchesCard = document.getElementById('tournament-matches-card');
    
    // If not, create it
    if (!matchesCard) {
      // Create the matches card
      matchesCard = document.createElement('div');
      matchesCard.id = 'tournament-matches-card';
      matchesCard.className = 'card bg-transparent mb-3';
      matchesCard.style.display = 'none'; // Initially hidden
      
      matchesCard.innerHTML = `
        <div class="card-body">
          <!-- Current Match -->
          <div id="current-match-section" class="mt-3">
            <h5 class="text-center mb-3">Current Match</h5>
            <div id="current-match-card" class="card bg-dark text-white p-3">
              <div class="d-flex justify-content-between align-items-center">
                <div class="player-card">
                  <span id="current-match-player1">Player 1</span>
                </div>
                <div class="vs-container">
                  <span class="vs-badge">VS</span>
                </div>
                <div class="player-card">
                  <span id="current-match-player2">Player 2</span>
                </div>
              </div>
              <div id="your-match-indicator" class="text-center mt-2" style="display: none;">
                <span class="badge bg-warning">Your Match!</span>
                <button id="play-match-btn" class="btn btn-primary btn-sm mt-1">Play Now</button>
              </div>
            </div>
          </div>
          
          <!-- Upcoming Matches Section -->
          <div id="upcoming-matches-section" class="mt-3">
            <h5 class="text-center mb-3">Upcoming Matches</h5>
            <ul id="upcoming-matches-list" class="list-group list-group-flush scrollable-container">
              <li class="list-group-item text-center">No upcoming matches yet</li>
            </ul>
          </div>
          
          <!-- Match Results -->
          <div id="match-results-section" class="mt-3">
            <h5 class="text-center mb-3">Completed Matches</h5>
            <ul id="match-results-list" class="list-group list-group-flush scrollable-container">
              <li class="list-group-item text-center">No matches completed yet</li>
            </ul>
          </div>
          
          <!-- Tournament Progress -->
          <div id="tournament-status" class="text-center mt-3">
            <div class="progress">
              <div id="tournament-progress-bar" class="progress-bar bg-success" role="progressbar" style="width: 0%"></div>
            </div>
            <small class="text-muted mt-1">Tournament Progress</small>
          </div>
        </div>
      `;
      
      // Find a good position to insert the card - before the back button
      const tournamentBackBtn = document.getElementById('tournament-back-btn');
      if (tournamentBackBtn) {
        tournamentPage.insertBefore(matchesCard, tournamentBackBtn);
      } else {
        tournamentPage.appendChild(matchesCard);
      }
      
      // Add event listener for Play Now button
      setTimeout(() => {
        const playMatchBtn = document.getElementById('play-match-btn');
        if (playMatchBtn) {
          playMatchBtn.addEventListener('click', () => {
            if (window.TournamentManager && TournamentManager.playCurrentMatch) {
              TournamentManager.playCurrentMatch();
            }
          });
        }
      }, 100);
    }
  }
  
  /**
   * Enhance TournamentManager with new methods
   */
  function enhanceTournamentManager() {
    // Skip if TournamentManager doesn't exist
    if (!window.TournamentManager) return;
    
    // Cache important DOM elements
    const elements = cacheElements();
    
    // Ensure TournamentManager has essential utility methods
    ensureUtilityMethods();
    
    // Enhance showTournamentLobby method
    enhanceShowTournamentLobby(elements);
    
    // Enhance handleTournamentUpdate method
    enhanceHandleTournamentUpdate(elements);
    
    // Add new methods for updating match displays
    addMatchDisplayMethods(elements);
  }
  
  /**
   * Cache important DOM elements for use in the enhanced methods
   */
  function cacheElements() {
    return {
      tournamentSelection: document.getElementById('tournament-selection'),
      tournamentLobby: document.getElementById('tournament-lobby'),
      availableTournamentsSection: document.getElementById('available-tournaments-section'),
      matchesCard: document.getElementById('tournament-matches-card'),
      currentMatchSection: document.getElementById('current-match-section'),
      currentMatchPlayer1: document.getElementById('current-match-player1'),
      currentMatchPlayer2: document.getElementById('current-match-player2'),
      yourMatchIndicator: document.getElementById('your-match-indicator'),
      playMatchBtn: document.getElementById('play-match-btn'),
      upcomingMatchesSection: document.getElementById('upcoming-matches-section'),
      upcomingMatchesList: document.getElementById('upcoming-matches-list'),
      matchResultsSection: document.getElementById('match-results-section'),
      matchResultsList: document.getElementById('match-results-list'),
      tournamentStatus: document.getElementById('tournament-status'),
      progressBar: document.getElementById('tournament-progress-bar')
    };
  }
  
  /**
   * Ensure TournamentManager has essential utility methods
   */
  function ensureUtilityMethods() {
    // Ensure the TournamentManager has a sanitizeHTML method
    if (!TournamentManager.sanitizeHTML) {
      TournamentManager.sanitizeHTML = function(str) {
        if (window.Utils && Utils.sanitizeHTML) {
          return Utils.sanitizeHTML(str);
        }
        
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
      };
    }
    
    // Ensure the TournamentManager has a getCurrentUsername method
    if (!TournamentManager.getCurrentUsername) {
      TournamentManager.getCurrentUsername = function() {
        return this.currentUsername || localStorage.getItem('currentNickname') || '';
      };
    }
    
    // Ensure the TournamentManager has a showError method
    if (!TournamentManager.showError) {
      TournamentManager.showError = function(message) {
        if (window.Utils && Utils.showAlert) {
          Utils.showAlert(message, "warning");
        } else if (window.App && App.showError) {
          App.showError(message, "warning");
        } else {
          console.error(message);
          alert(message);
        }
      };
    }
  }
  
  /**
   * Enhance the showTournamentLobby method
   */
  function enhanceShowTournamentLobby(elements) {
    // Store original method
    const originalShowTournamentLobby = TournamentManager.showTournamentLobby;
    
    // Override the method
    TournamentManager.showTournamentLobby = function() {
      // Call original method if it exists
      if (typeof originalShowTournamentLobby === 'function') {
        originalShowTournamentLobby.call(this);
      }
      
      // Additional functionality - show match information if tournament has started
      const currentTournament = this.getCurrentTournament();
      
      // Hide other sections
      if (elements.tournamentSelection) {
        elements.tournamentSelection.style.display = "none";
      }
      if (elements.availableTournamentsSection) {
        elements.availableTournamentsSection.style.display = "none";
      }
      
      // Show lobby
      if (elements.tournamentLobby) {
        elements.tournamentLobby.style.display = "block";
      }
      
      // If tournament has started, show match sections
      if (currentTournament && currentTournament.started) {
        // Show matches card
        if (elements.matchesCard) {
          elements.matchesCard.style.display = "block";
        }
        
        // Update displays
        if (this.updateCurrentMatchDisplay) {
          this.updateCurrentMatchDisplay();
        }
        if (this.updateMatchResultsDisplay) {
          this.updateMatchResultsDisplay();
        }
        if (this.updateUpcomingMatches) {
          this.updateUpcomingMatches();
        }
        if (this.updateTournamentProgress) {
          this.updateTournamentProgress();
        }
      } else {
        // Hide match sections if tournament hasn't started
        if (elements.matchesCard) {
          elements.matchesCard.style.display = "none";
        }
      }
    };
  }
  
  /**
   * Enhance the handleTournamentUpdate method
   */
  function enhanceHandleTournamentUpdate(elements) {
    // Store original method
    const originalHandleTournamentUpdate = TournamentManager.handleTournamentUpdate;
    
    // Override the method
    TournamentManager.handleTournamentUpdate = function(tournament) {
      // Skip if tournament is null or doesn't match current
      if (!tournament) return;
      
      // Get current tournament
      const currentTournament = this.getCurrentTournament();
      if (!currentTournament || tournament.id !== currentTournament.id) {
        // Call original method to handle this case
        if (typeof originalHandleTournamentUpdate === 'function') {
          originalHandleTournamentUpdate.call(this, tournament);
        }
        return;
      }
      
      // Store previous state to check for changes
      const wasStarted = currentTournament.started;
      const previousCurrentMatch = currentTournament.current_match;
      const previousWinner = currentTournament.winner;
      
      // Call original method
      if (typeof originalHandleTournamentUpdate === 'function') {
        originalHandleTournamentUpdate.call(this, tournament);
      }
      
      // Additional functionality
      
      // If tournament has started, show match sections
      if (tournament.started) {
        // Show matches card
        if (elements.matchesCard) {
          elements.matchesCard.style.display = "block";
        }
        
        // Update displays
        if (this.updateCurrentMatchDisplay) {
          this.updateCurrentMatchDisplay();
        }
        if (this.updateMatchResultsDisplay) {
          this.updateMatchResultsDisplay();
        }
        if (this.updateUpcomingMatches) {
          this.updateUpcomingMatches();
        }
        if (this.updateTournamentProgress) {
          this.updateTournamentProgress();
        }
      }
      
      // Check if a new match has started with the current player
      if (tournament.current_match && 
          (!previousCurrentMatch || 
           previousCurrentMatch.player1 !== tournament.current_match.player1 || 
           previousCurrentMatch.player2 !== tournament.current_match.player2)) {
        
        const playerName = this.getCurrentUsername();
        const isInMatch = tournament.current_match.player1 === playerName || 
                          tournament.current_match.player2 === playerName;
        
        if (isInMatch && this.showYourMatchNotification) {
          this.showYourMatchNotification();
        }
      }
    };
  }
  
  /**
   * Add new methods for updating match displays
   */
  function addMatchDisplayMethods(elements) {
    // Add/override updateCurrentMatchDisplay method
    TournamentManager.updateCurrentMatchDisplay = function() {
      const currentTournament = this.getCurrentTournament();
      if (!currentTournament) return;
      
      // Make sure we have the current match section
      if (!elements.currentMatchSection) return;
      
      // Make section visible
      elements.currentMatchSection.style.display = "block";
      
      if (currentTournament.current_match) {
        // Update title to be more obvious
        const matchTitle = elements.currentMatchSection.querySelector('h5');
        if (matchTitle) {
          matchTitle.innerHTML = '🔴 CURRENT MATCH 🔴';
          matchTitle.className = 'text-center mb-3';
        }
        
        // Update player names
        if (elements.currentMatchPlayer1) {
          elements.currentMatchPlayer1.textContent = 
            this.sanitizeHTML(currentTournament.current_match.player1);
        }
        if (elements.currentMatchPlayer2) {
          elements.currentMatchPlayer2.textContent = 
            this.sanitizeHTML(currentTournament.current_match.player2);
        }
        
        // Check if current user is in the match
        const playerName = this.getCurrentUsername();
        const isInMatch = currentTournament.current_match.player1 === playerName || 
                          currentTournament.current_match.player2 === playerName;
        
        if (elements.yourMatchIndicator) {
          elements.yourMatchIndicator.style.display = isInMatch ? "block" : "none";
        }
        
        // Add a special class to highlight the current match
        elements.currentMatchSection.classList.add('current-match-active');
        
        // Add an animated border to make it stand out
        const currentMatchCard = document.getElementById('current-match-card');
        if (currentMatchCard) {
          currentMatchCard.classList.add('pulsing-border');
        }
      } else {
        // No current match
        if (currentTournament.winner) {
          // Tournament is over
          elements.currentMatchSection.style.display = "none";
        } else {
          // Tournament is in progress but no active match
          elements.currentMatchSection.style.display = "block";
          
          // Update title
          const matchTitle = elements.currentMatchSection.querySelector('h5');
          if (matchTitle) {
            matchTitle.innerHTML = 'Waiting for Next Match';
            matchTitle.className = 'text-center mb-3';
          }
          
          // Default display if no match found
          if (elements.currentMatchPlayer1) {
            elements.currentMatchPlayer1.textContent = "Waiting";
          }
          if (elements.currentMatchPlayer2) {
            elements.currentMatchPlayer2.textContent = "Waiting";
          }
          if (elements.yourMatchIndicator) {
            elements.yourMatchIndicator.style.display = "none";
          }
          
          // Remove special highlighting
          elements.currentMatchSection.classList.remove('current-match-active');
          
          const currentMatchCard = document.getElementById('current-match-card');
          if (currentMatchCard) {
            currentMatchCard.classList.remove('pulsing-border');
          }
        }
      }
    };
    
    // Add/override updateMatchResultsDisplay method
    TournamentManager.updateMatchResultsDisplay = function() {
      const currentTournament = this.getCurrentTournament();
      if (!currentTournament || !elements.matchResultsList) return;
      
      // Get completed matches
      const completedMatches = currentTournament.matches ? 
        currentTournament.matches.filter(m => m.winner) : [];
      
      if (completedMatches.length > 0) {
        if (elements.matchResultsSection) {
          elements.matchResultsSection.style.display = "block";
        }
        elements.matchResultsList.innerHTML = "";
        
        // Update the title to be more descriptive
        const resultsTitle = elements.matchResultsSection.querySelector('h5');
        if (resultsTitle) {
          resultsTitle.innerHTML = '✅ Completed Matches';
        }
        
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
                <span class="${match.winner === match.player1 ? 'text-success fw-bold' : ''}">${this.sanitizeHTML(match.player1)}</span>
                <span class="mx-2">vs</span>
                <span class="${match.winner === match.player2 ? 'text-success fw-bold' : ''}">${this.sanitizeHTML(match.player2)}</span>
              </div>
              <span class="badge bg-success">Winner: ${this.sanitizeHTML(match.winner)}</span>
            </div>
          `;
          
          elements.matchResultsList.appendChild(li);
        });
      } else {
        if (elements.matchResultsSection) {
          elements.matchResultsSection.style.display = currentTournament.started ? "block" : "none";
        }
        
        if (currentTournament.started) {
          elements.matchResultsList.innerHTML = `
            <li class="list-group-item text-center">No matches completed yet</li>
          `;
        }
      }
    };
    
    // Add updateUpcomingMatches method
    TournamentManager.updateUpcomingMatches = function() {
      const currentTournament = this.getCurrentTournament();
      if (!currentTournament || !currentTournament.matches) return;
      
      if (!elements.upcomingMatchesSection || !elements.upcomingMatchesList) return;
      
      // Filter for matches that have both players but no winner, and aren't the current match
      const upcomingMatches = currentTournament.matches.filter(match => 
        match.winner === null && 
        match.player1 && match.player2 &&
        (!currentTournament.current_match || 
         match.player1 !== currentTournament.current_match.player1 || 
         match.player2 !== currentTournament.current_match.player2)
      );
      
      // Show section if there are upcoming matches
      elements.upcomingMatchesSection.style.display = upcomingMatches.length > 0 ? "block" : "none";
      
      // Update list of upcoming matches
      elements.upcomingMatchesList.innerHTML = "";
      
      if (upcomingMatches.length === 0) {
        const li = document.createElement("li");
        li.className = "list-group-item text-center";
        li.textContent = "No upcoming matches";
        elements.upcomingMatchesList.appendChild(li);
      } else {
        // Sort by round first, then by position
        upcomingMatches.sort((a, b) => {
          if (a.round !== b.round) return a.round - b.round;
          return a.position - b.position;
        });
        
        // Add each upcoming match
        upcomingMatches.forEach(match => {
          const li = document.createElement("li");
          li.className = "list-group-item";
          
          // Round number display (0-indexed to 1-indexed)
          const roundNumber = match.round + 1;
          
          li.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
              <span class="badge bg-secondary">Round ${roundNumber}</span>
              <div class="match-result">
                <span>${this.sanitizeHTML(match.player1)}</span>
                <span class="mx-2">vs</span>
                <span>${this.sanitizeHTML(match.player2)}</span>
              </div>
              <span class="badge bg-info">Upcoming</span>
            </div>
          `;
          
          elements.upcomingMatchesList.appendChild(li);
        });
      }
    };
    
    // Add updateTournamentProgress method
    TournamentManager.updateTournamentProgress = function() {
      const currentTournament = this.getCurrentTournament();
      if (!currentTournament || !currentTournament.matches) return;
      
      // Skip if progress bar doesn't exist
      if (!elements.progressBar) return;
      
      // Calculate progress based on completed matches
      const totalMatches = currentTournament.matches.length;
      const completedMatches = currentTournament.matches.filter(m => m.winner).length;
      
      if (totalMatches > 0) {
        const progressPercent = Math.floor((completedMatches / totalMatches) * 100);
        elements.progressBar.style.width = `${progressPercent}%`;
        elements.progressBar.setAttribute('aria-valuenow', progressPercent);
        
        // Add text to the progress bar if wide enough
        if (progressPercent > 10) {
          elements.progressBar.textContent = `${progressPercent}%`;
        } else {
          elements.progressBar.textContent = '';
        }
      }
    };
    
    // Add playCurrentMatch method if it doesn't exist
    if (!TournamentManager.playCurrentMatch) {
      TournamentManager.playCurrentMatch = function() {
        const currentTournament = this.getCurrentTournament();
        if (!currentTournament || !currentTournament.current_match) {
          this.showError("No active match to play");
          return;
        }
        
        const playerName = this.getCurrentUsername();
        const isInMatch = currentTournament.current_match.player1 === playerName || 
                          currentTournament.current_match.player2 === playerName;
        
        if (!isInMatch) {
          this.showError("You are not part of the current match");
          return;
        }
        
        // Send ready signal to server
        if (window.WebSocketManager) {
          WebSocketManager.send({
            type: "ready_for_match",
            tournament_id: currentTournament.id,
            nickname: playerName
          });
        }
        
        // Set a flag in App state to indicate this is a tournament game
        if (window.App && App.state && App.state.game) {
          App.state.game.isTournament = true;
          console.log("Tournament game flag set");
        }
        
        // Navigate to game page
        if (this.navigateToGamePage) {
          this.navigateToGamePage();
        } else if (window.UIManager && typeof UIManager.navigateTo === 'function') {
          UIManager.navigateTo("pong-page");
        }
      };
    }
  }
  
  enhanceTournamentUI();