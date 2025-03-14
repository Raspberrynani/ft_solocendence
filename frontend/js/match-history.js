/**
 * Match History Manager
 * Handles storing and retrieving match history from localStorage
 */
const MatchHistoryManager = (function() {
    // Max number of matches to store
    const MAX_HISTORY = 10;
    
    // Key used in localStorage
    const STORAGE_KEY = 'pong_match_history';
    
    /**
     * Add a match to history
     * @param {Object} matchData - Data about the match
     * @param {string} matchData.opponent - Opponent's name
     * @param {boolean} matchData.won - Whether the player won
     * @param {number} matchData.score - Player's score
     * @param {number} matchData.opponentScore - Opponent's score
     * @param {number} matchData.totalRounds - Total rounds in the match
     * @param {string} matchData.gameMode - Game mode (classic, ai, tournament)
     */
    function addMatch(matchData) {
      // Get existing history
      const history = getHistory();
      
      // Create match record
      const match = {
        date: new Date().toISOString(),
        opponent: matchData.opponent || 'Unknown',
        won: !!matchData.won,
        score: matchData.score || 0,
        opponentScore: matchData.opponentScore || 0,
        totalRounds: matchData.totalRounds || 0,
        gameMode: matchData.gameMode || 'classic',
      };
      
      // Add to beginning of array
      history.unshift(match);
      
      // Limit size of history
      if (history.length > MAX_HISTORY) {
        history.length = MAX_HISTORY;
      }
      
      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        console.log('Match saved to history:', match);
      } catch (e) {
        console.error('Failed to save match history:', e);
      }
    }
    
    /**
     * Get match history
     * @param {number} limit - Max number of matches to return
     * @returns {Array} - Match history
     */
    function getHistory(limit = MAX_HISTORY) {
      try {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return history.slice(0, limit);
      } catch (e) {
        console.error('Failed to retrieve match history:', e);
        return [];
      }
    }
    
    /**
     * Clear match history
     */
    function clearHistory() {
      localStorage.removeItem(STORAGE_KEY);
    }
    
    /**
     * Display match history in container
     * @param {HTMLElement} container - Container to render history in
     * @param {number} limit - Max number of matches to display
     */
    function displayHistory(container, limit = 3) {
      if (!container) return;
      
      const history = getHistory(limit);
      
      if (history.length === 0) {
        container.innerHTML = '<p class="text-center">No match history yet</p>';
        return;
      }
      
      const html = ['<h5>Recent Matches</h5>'];
      html.push('<div class="match-history-list">');
      
      history.forEach(match => {
        const date = new Date(match.date);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const resultClass = match.won ? 'win' : 'loss';
        const resultText = match.won ? 'Won' : 'Lost';
        
        html.push(`
          <div class="match-history-item ${resultClass}">
            <div class="match-result-badge">${resultText}</div>
            <div class="match-details">
              <div class="match-opponent">vs ${match.opponent}</div>
              <div class="match-score">${match.score} - ${match.opponentScore}</div>
              <div class="match-date">${formattedDate}</div>
            </div>
            <div class="match-mode-badge">${match.gameMode}</div>
          </div>
        `);
      });
      
      html.push('</div>');
      container.innerHTML = html.join('');
    }
    
    // Public API
    return {
      addMatch,
      getHistory,
      clearHistory,
      displayHistory
    };
  })();
  
  // Export for global access
  window.MatchHistoryManager = MatchHistoryManager;