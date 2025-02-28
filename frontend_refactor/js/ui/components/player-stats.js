/**
 * Player Stats Component
 * Renders player statistics and analytics
 */
const PlayerStatsComponent = (function() {
    // Private variables
    let modalElement = null;
    let playerData = null;
    let config = {
      showChart: true,
      showPerformanceSummary: true,
      animateChart: true,
      chartType: 'donut' // 'donut', 'pie', or 'bar'
    };
    
    /**
     * Initialize the player stats component
     * @param {Object} options - Component configuration
     * @returns {Object} - Public API
     */
    function init(options = {}) {
      // Apply custom options
      Object.assign(config, options);
      
      console.log('Player Stats component initialized');
      
      return publicAPI;
    }
    
    /**
     * Show player statistics
     * @param {Object} stats - Player statistics data
     * @returns {HTMLElement} - The modal element created
     */
    function show(stats) {
      // Store player data
      playerData = stats;
      
      // Calculate wins and losses
      const wins = stats.wins;
      const losses = stats.games_played - stats.wins;
      
      // Create modal if it doesn't exist
      if (!modalElement) {
        modalElement = document.createElement('div');
        modalElement.className = 'modal player-stats-modal';
        document.body.appendChild(modalElement);
      }
      
      // Generate modal content
      modalElement.innerHTML = `
        <div class="modal-content">
          <h2>${Utils.sanitizeHTML(stats.name)}'s Stats</h2>
          
          <!-- Stats Summary Cards -->
          <div class="player-details mb-3">
            <div class="row text-center">
              <div class="col">
                <div class="stat-card">
                  <div class="stat-value">${stats.games_played}</div>
                  <div class="stat-label">Total Games</div>
                </div>
              </div>
              <div class="col">
                <div class="stat-card">
                  <div class="stat-value">${stats.wins}</div>
                  <div class="stat-label">Wins</div>
                </div>
              </div>
              <div class="col">
                <div class="stat-card">
                  <div class="stat-value">${stats.win_ratio}%</div>
                  <div class="stat-label">Win Rate</div>
                </div>
              </div>
            </div>
            <div class="text-center mt-3">
              <span class="rank-badge rank-${stats.rank}">
                ${stats.rank.toUpperCase()} RANK
              </span>
            </div>
          </div>
          
          ${config.showChart ? `
          <!-- Win/Loss Chart -->
          <div class="chart-container">
            <canvas id="winLossChart" width="250" height="150"></canvas>
          </div>
          ` : ''}
          
          ${config.showPerformanceSummary ? `
          <!-- Performance Summary -->
          <div class="performance-summary mt-3">
            <h4>Performance Summary</h4>
            <div class="progress mb-2">
              <div 
                class="progress-bar bg-success" 
                role="progressbar" 
                style="width: ${stats.win_ratio}%" 
                aria-valuenow="${stats.win_ratio}" 
                aria-valuemin="0" 
                aria-valuemax="100">
                ${stats.win_ratio}% Wins
              </div>
            </div>
            <p class="text-center">
              ${getPlayerSummary(stats)}
            </p>
          </div>
          ` : ''}
          
          <button class="close-modal btn btn-primary mt-3">Close</button>
        </div>
      `;
      
      // Add event listeners
      modalElement.querySelector('.close-modal').addEventListener('click', () => {
        hide();
      });
      
      // Close modal when clicking outside
      modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
          hide();
        }
      });
      
      // Add escape key handler
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          hide();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
      
      // Draw chart if enabled
      if (config.showChart) {
        setTimeout(() => {
          createChart(wins, losses);
        }, 100);
      }
      
      return modalElement;
    }
    
    /**
     * Hide the player stats modal
     */
    function hide() {
      if (modalElement) {
        // Apply exit animation
        modalElement.classList.add('fade-out');
        
        // Remove after animation completes
        setTimeout(() => {
          modalElement.classList.remove('fade-out');
          modalElement.remove();
          modalElement = null;
        }, 300);
      }
    }
    
    /**
     * Create the win/loss chart
     * @param {number} wins - Number of wins
     * @param {number} losses - Number of losses
     */
    function createChart(wins, losses) {
      const canvas = document.getElementById('winLossChart');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Define colors
      const winColor = '#28a745';  // Green
      const lossColor = '#dc3545'; // Red
      
      if (config.chartType === 'donut' || config.chartType === 'pie') {
        drawPieChart(ctx, wins, losses, winColor, lossColor);
      } else if (config.chartType === 'bar') {
        drawBarChart(ctx, wins, losses, winColor, lossColor);
      }
    }
    
    /**
     * Draw a pie/donut chart
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} wins - Number of wins
     * @param {number} losses - Number of losses
     * @param {string} winColor - Color for wins
     * @param {string} lossColor - Color for losses
     */
    function drawPieChart(ctx, wins, losses, winColor, lossColor) {
      const total = wins + losses || 1; // Avoid division by zero
      
      // Calculate angles
      const winAngle = (wins / total) * Math.PI * 2;
      const lossAngle = (losses / total) * Math.PI * 2;
      
      // Chart dimensions
      const centerX = ctx.canvas.width / 2;
      const centerY = ctx.canvas.height / 2;
      const radius = Math.min(centerX, centerY) - 10;
      const innerRadius = config.chartType === 'donut' ? radius * 0.6 : 0;
      
      // Animation parameters
      const duration = config.animateChart ? 1000 : 0;
      const startTime = performance.now();
      
      // Draw function for animation
      function draw(currentTime) {
        // Calculate animation progress (0 to 1)
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Clear canvas
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Draw Wins slice (animated)
        const currentWinAngle = winAngle * progress;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, 0, currentWinAngle, false);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = winColor;
        ctx.fill();
        
        // Draw Losses slice (animated)
        const currentLossAngle = lossAngle * progress;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentWinAngle, currentWinAngle + currentLossAngle, false);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = lossColor;
        ctx.fill();
        
        // Draw donut hole
        if (config.chartType === 'donut') {
          ctx.beginPath();
          ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, false);
          ctx.fillStyle = '#000';
          ctx.fill();
        }
        
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
        
        // Continue animation if not complete
        if (progress < 1 && config.animateChart) {
          requestAnimationFrame(draw);
        }
      }
      
      // Start animation
      requestAnimationFrame(draw);
    }
    
    /**
     * Draw a bar chart
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} wins - Number of wins
     * @param {number} losses - Number of losses
     * @param {string} winColor - Color for wins
     * @param {string} lossColor - Color for losses
     */
    function drawBarChart(ctx, wins, losses, winColor, lossColor) {
      // Chart dimensions
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      const padding = 40;
      const barWidth = (width - padding * 2) / 2 - 20;
      
      // Calculate max value for y-axis scale
      const maxValue = Math.max(wins, losses, 1);
      const yScale = (height - padding * 2) / maxValue;
      
      // Animation parameters
      const duration = config.animateChart ? 1000 : 0;
      const startTime = performance.now();
      
      // Draw function for animation
      function draw(currentTime) {
        // Calculate animation progress (0 to 1)
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.strokeStyle = '#555';
        ctx.stroke();
        
        // Draw bars (animated)
        const winsHeight = wins * yScale * progress;
        const lossesHeight = losses * yScale * progress;
        
        // Wins bar
        ctx.fillStyle = winColor;
        ctx.fillRect(
          padding + 10,
          height - padding - winsHeight,
          barWidth,
          winsHeight
        );
        
        // Losses bar
        ctx.fillStyle = lossColor;
        ctx.fillRect(
          padding + barWidth + 30,
          height - padding - lossesHeight,
          barWidth,
          lossesHeight
        );
        
        // Draw labels
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        // Win label
        ctx.fillText('Wins', padding + 10 + barWidth / 2, height - padding + 15);
        ctx.fillText(String(wins), padding + 10 + barWidth / 2, height - padding - winsHeight - 5);
        
        // Loss label
        ctx.fillText('Losses', padding + barWidth + 30 + barWidth / 2, height - padding + 15);
        ctx.fillText(String(losses), padding + barWidth + 30 + barWidth / 2, height - padding - lossesHeight - 5);
        
        // Continue animation if not complete
        if (progress < 1 && config.animateChart) {
          requestAnimationFrame(draw);
        }
      }
      
      // Start animation
      requestAnimationFrame(draw);
    }
    
    /**
     * Generate a performance summary based on player stats
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
    
    /**
     * Change the chart type
     * @param {string} type - Chart type ('donut', 'pie', or 'bar')
     */
    function setChartType(type) {
      if (['donut', 'pie', 'bar'].includes(type)) {
        config.chartType = type;
        
        // Redraw chart if data is available
        if (playerData && document.getElementById('winLossChart')) {
          const wins = playerData.wins;
          const losses = playerData.games_played - playerData.wins;
          createChart(wins, losses);
        }
      }
    }
    
    // Public API
    const publicAPI = {
      init,
      show,
      hide,
      setChartType
    };
    
    return publicAPI;
  })();
  
  // Support both module.exports and direct browser usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerStatsComponent;
  }