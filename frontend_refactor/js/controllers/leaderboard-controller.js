/**
 * Leaderboard Controller Module
 * Handles leaderboard display and player statistics
 */
const LeaderboardController = (function() {
    // Private variables
    let elements = {};
    let callbacks = {};
    let currentData = [];
    
    /**
     * Initialize the leaderboard controller
     * @param {Object} config - Configuration object
     * @returns {Object} - Public API
     */
    function init(config = {}) {
      elements = config.elements || {};
      callbacks = config.callbacks || {};
      
      // Validate required elements
      if (!elements.leaderboardList) {
        console.error("Missing required element: leaderboardList");
        return null;
      }
      
      console.log("Leaderboard controller initialized");
      
      return publicAPI;
    }
    
    /**
     * Load and display leaderboard data
     */
    async function loadLeaderboard() {
      try {
        // Show loading state
        PageManager.showLoading(elements.leaderboardList);
        
        // Fetch leaderboard data
        const response = await ApiService.getLeaderboardEntries();
        
        if (!response.success) {
          throw new Error(response.error || "Failed to load leaderboard");
        }
        
        // Store leaderboard data
        currentData = response.entries || [];
        
        // Display leaderboard
        renderLeaderboard();
      } catch (error) {
        console.error("Error loading leaderboard:", error);
        
        // Show error message
        if (elements.leaderboardList) {
          elements.leaderboardList.innerHTML = `
            <li class="text-center py-3">
              <div class="alert alert-danger">
                Error loading leaderboard. Please try again later.
              </div>
            </li>
          `;
        }
      }
    }
    
    /**
     * Render the leaderboard with current data
     */
    function renderLeaderboard() {
      if (!elements.leaderboardList) return;
      
      elements.leaderboardList.innerHTML = "";
      
      if (!currentData || currentData.length === 0) {
        const li = document.createElement("li");
        li.innerText = "No entries yet";
        li.className = "text-center py-3";
        elements.leaderboardList.appendChild(li);
        return;
      }
      
      // Add a title/header for the leaderboard
      const header = document.createElement("li");
      header.className = "leaderboard-header";
      header.innerHTML = `
        <div class="d-flex justify-content-between w-100 py-2">
          <span><strong>Player</strong></span>
          <span><strong>Stats</strong></span>
        </div>
      `;
      elements.leaderboardList.appendChild(header);
      
      // Sort entries by wins
      currentData.sort((a, b) => b.wins - a.wins);
      
      // Create player entries
      currentData.forEach((entry, index) => {
        const li = document.createElement("li");
        li.classList.add(`rank-${entry.rank}`);
        
        // Add 'top3' class for the top 3 players
        if (index < 3) {
          li.classList.add(`top-${index + 1}`);
        }
        
        // Calculate win/loss ratio visual indicator width
        const winRatioWidth = Math.max(5, entry.win_ratio); // Min 5% for visibility
        
        li.innerHTML = `
          <div class="d-flex justify-content-between w-100 align-items-center">
            <span class="player-name" data-player="${Utils.sanitizeHTML(entry.name)}">
              ${index < 3 ? `<span class="position-indicator">${index + 1}</span>` : ''}
              ${Utils.sanitizeHTML(entry.name)}
            </span> 
            <span class="player-stats">
              <span class="badge bg-success">${entry.wins} W</span>
              <span class="badge bg-secondary">${entry.games_played} G</span>
            </span>
          </div>
          <div class="win-ratio-bar mt-1">
            <div class="win-ratio-progress" style="width: ${winRatioWidth}%" title="${entry.win_ratio}% Win Rate"></div>
          </div>
        `;
        
        // Add click event to show player details
        li.querySelector('.player-name').addEventListener('click', () => {
          handlePlayerSelect(entry.name);
        });
        
        elements.leaderboardList.appendChild(li);
      });
      
      // Add leaderboard description at the bottom
      const footer = document.createElement("li");
      footer.className = "leaderboard-footer";
      footer.innerHTML = `
        <small class="text-muted">
          Click on a player's name to see detailed statistics
        </small>
      `;
      elements.leaderboardList.appendChild(footer);
    }
    
    /**
     * Handle player selection from leaderboard
     * @param {string} playerName - Selected player name
     */
    function handlePlayerSelect(playerName) {
      if (callbacks.onPlayerSelect) {
        callbacks.onPlayerSelect(playerName);
      } else {
        showPlayerDetails(playerName);
      }
    }
    
    /**
     * Show detailed player statistics
     * @param {string} playerName - Player name to show details for
     */
    async function showPlayerDetails(playerName) {
      try {
        // Fetch player details
        const response = await ApiService.getPlayerStats(playerName);
        
        if (!response.success) {
          throw new Error(response.error || `Could not fetch stats for ${playerName}`);
        }
        
        const playerStats = response;
        
        // Calculate win/loss data for the chart
        const wins = playerStats.wins;
        const losses = playerStats.games_played - playerStats.wins;
        
        // Create a modal to show detailed stats
        const statsModal = document.createElement('div');
        statsModal.className = 'modal player-stats-modal';
        
        statsModal.innerHTML = `
          <div class="modal-content">
            <h2>${Utils.sanitizeHTML(playerStats.name)}'s Stats</h2>
            
            <!-- Stats Summary -->
            <div class="player-details mb-3">
              <div class="row text-center">
                <div class="col">
                  <div class="stat-card">
                    <div class="stat-value">${playerStats.games_played}</div>
                    <div class="stat-label">Total Games</div>
                  </div>
                </div>
                <div class="col">
                  <div class="stat-card">
                    <div class="stat-value">${playerStats.wins}</div>
                    <div class="stat-label">Wins</div>
                  </div>
                </div>
                <div class="col">
                  <div class="stat-card">
                    <div class="stat-value">${playerStats.win_ratio}%</div>
                    <div class="stat-label">Win Rate</div>
                  </div>
                </div>
              </div>
              <div class="text-center mt-3">
                <span class="rank-badge rank-${playerStats.rank}">
                  ${playerStats.rank.toUpperCase()} RANK
                </span>
              </div>
            </div>
            
            <!-- Win/Loss Chart -->
            <div class="chart-container">
              <canvas id="winLossChart" width="250" height="150"></canvas>
            </div>
            
            <!-- Performance Summary -->
            <div class="performance-summary mt-3">
              <h4>Performance Summary</h4>
              <div class="progress mb-2">
                <div 
                  class="progress-bar bg-success" 
                  role="progressbar" 
                  style="width: ${playerStats.win_ratio}%" 
                  aria-valuenow="${playerStats.win_ratio}" 
                  aria-valuemin="0" 
                  aria-valuemax="100">
                  ${playerStats.win_ratio}% Wins
                </div>
              </div>
              <p class="text-center">
                ${getPlayerSummary(playerStats)}
              </p>
            </div>
            
            <button class="close-modal btn btn-primary mt-3">Close</button>
          </div>
        `;
        
        // Add close functionality
        statsModal.querySelector('.close-modal').addEventListener('click', () => {
          statsModal.remove();
        });
        
        // Close modal when clicking outside
        statsModal.addEventListener('click', (e) => {
          if (e.target === statsModal) {
            statsModal.remove();
          }
        });
        
        // Add to body
        document.body.appendChild(statsModal);
        
        // Create the chart after the modal is in the DOM
        createWinLossChart(wins, losses);
      } catch (error) {
        console.error("Error fetching player details:", error);
        PageManager.showAlert(`Could not fetch stats for ${playerName}`);
      }
    }
    
    /**
     * Create a win/loss chart for player statistics
     * @param {number} wins - Number of wins
     * @param {number} losses - Number of losses
     */
    function createWinLossChart(wins, losses) {
      const canvas = document.getElementById('winLossChart');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Colors
      const winColor = '#28a745';  // Green
      const lossColor = '#dc3545'; // Red
      
      // Calculate angles for pie slices
      const total = wins + losses;
      const winAngle = wins / total * Math.PI * 2;
      const lossAngle = losses / total * Math.PI * 2;
      
      // Set up chart parameters
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(centerX, centerY) - 10;
      const innerRadius = radius * 0.6; // For donut hole
      
      // Draw donut slices
      // Wins slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, 0, winAngle, false);
      ctx.lineTo(centerX, centerY);
      ctx.fillStyle = winColor;
      ctx.fill();
      
      // Losses slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, winAngle, Math.PI * 2, false);
      ctx.lineTo(centerX, centerY);
      ctx.fillStyle = lossColor;
      ctx.fill();
      
      // Draw donut hole
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, false);
      ctx.fillStyle = '#000';
      ctx.fill();
      
      // Draw legend
      const legendY = centerY + radius + 20;
      
      // Wins legend
      ctx.fillStyle = winColor;
      ctx.fillRect(centerX - 70, legendY, 15, 15);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Wins: ${wins}`, centerX - 50, legendY + 12);
      
      // Losses legend
      ctx.fillStyle = lossColor;
      ctx.fillRect(centerX + 10, legendY, 15, 15);
      ctx.fillStyle = '#fff';
      ctx.fillText(`Losses: ${losses}`, centerX + 30, legendY + 12);
    }
    
    /**
     * Generate a performance summary based on player statistics
     * @param {Object} stats - Player statistics
     * @returns {string} - Performance summary text
     */
    function getPlayerSummary(stats) {
      const games = stats.games_played;
      const winRatio = stats.win_ratio;
      
      if (games < 5) {
        return "Not enough games to determine a pattern. Keep playing!";
      } else if (winRatio >= 70) {
        return "Exceptional performance! You're dominating the game!";
      } else if (winRatio >= 50) {
        return "Good performance! You're winning more than losing.";
      } else if (winRatio >= 30) {
        return "You're improving, but need more practice to get a positive win ratio.";
      } else {
        return "Keep practicing to improve your win rate!";
      }
    }
    
    // Public API
    const publicAPI = {
      init,
      loadLeaderboard,
      showPlayerDetails
    };
    
    return publicAPI;
  })();