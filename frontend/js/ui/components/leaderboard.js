/**
 * Leaderboard Component
 * Renders and manages the leaderboard UI
 */
const LeaderboardComponent = (function() {
    // Private variables
    let container = null;
    let entries = [];
    let isLoading = false;
    let sortField = 'wins';
    let sortDirection = 'desc';
    let callbacks = {};
    let currentFilter = '';
    
    /**
     * Initialize the leaderboard component
     * @param {HTMLElement|string} containerElement - Container element or ID
     * @param {Object} options - Component options
     * @returns {Object} - Public API
     */
    function init(containerElement, options = {}) {
      // Get container element
      if (typeof containerElement === 'string') {
        container = document.getElementById(containerElement);
      } else {
        container = containerElement;
      }
      
      if (!container) {
        console.error('Leaderboard container element not found');
        return null;
      }
      
      // Store callbacks
      callbacks = {
        onPlayerSelect: options.onPlayerSelect || null,
        onSortChange: options.onSortChange || null,
        onFilter: options.onFilter || null
      };
      
      // Initial sort config
      if (options.sortField) sortField = options.sortField;
      if (options.sortDirection) sortDirection = options.sortDirection;
      
      // Create base structure if needed
      if (container.children.length === 0) {
        createBaseStructure();
      }
      
      // Set up event handlers
      setupEventHandlers();
      
      console.log('Leaderboard component initialized');
      
      return publicAPI;
    }
    
    /**
     * Create the base leaderboard structure
     */
    function createBaseStructure() {
      container.innerHTML = `
        <div class="leaderboard-header d-flex justify-content-between align-items-center mb-2">
          <h3 class="m-0">Leaderboard</h3>
          <div class="leaderboard-controls">
            <input type="text" class="form-control form-control-sm leaderboard-filter" 
                   placeholder="Filter players...">
          </div>
        </div>
        
        <div class="leaderboard-table-wrapper">
          <table class="leaderboard-table w-100">
            <thead>
              <tr>
                <th class="sortable" data-sort="rank">#</th>
                <th class="sortable" data-sort="name">Player</th>
                <th class="sortable" data-sort="wins">Wins</th>
                <th class="sortable" data-sort="games_played">Games</th>
                <th class="sortable" data-sort="win_ratio">Win %</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="text-center">Loading leaderboard data...</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="leaderboard-footer text-center text-muted mt-2">
          <small>Click on a player's name to see detailed statistics</small>
        </div>
      `;
    }
    
    /**
     * Set up event handlers
     */
    function setupEventHandlers() {
      // Sort headers
      const sortHeaders = container.querySelectorAll('.sortable');
      sortHeaders.forEach(header => {
        header.addEventListener('click', () => {
          const field = header.getAttribute('data-sort');
          toggleSort(field);
        });
      });
      
      // Filter input
      const filterInput = container.querySelector('.leaderboard-filter');
      if (filterInput) {
        filterInput.addEventListener('input', function() {
          currentFilter = this.value.trim().toLowerCase();
          renderEntries();
          
          if (callbacks.onFilter) {
            callbacks.onFilter(currentFilter);
          }
        });
      }
    }
    
    /**
     * Toggle sorting direction or set a new sort field
     * @param {string} field - Field to sort by
     */
    function toggleSort(field) {
      if (sortField === field) {
        // Toggle direction if same field
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        // New field, default to descending
        sortField = field;
        sortDirection = 'desc';
      }
      
      renderEntries();
      
      if (callbacks.onSortChange) {
        callbacks.onSortChange(sortField, sortDirection);
      }
    }
    
    /**
     * Set leaderboard data
     * @param {Array} data - Array of leaderboard entries
     */
    function setEntries(data) {
      entries = Array.isArray(data) ? data : [];
      renderEntries();
    }
    
    /**
     * Set loading state
     * @param {boolean} loading - Whether leaderboard is loading
     */
    function setLoading(loading) {
      isLoading = loading;
      
      const tbody = container.querySelector('tbody');
      if (!tbody) return;
      
      if (isLoading) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center">
              <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <span class="ms-2">Loading leaderboard data...</span>
            </td>
          </tr>
        `;
      } else if (entries.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center">No entries found</td>
          </tr>
        `;
      }
    }
    
    /**
     * Render leaderboard entries
     */
    function renderEntries() {
      const tbody = container.querySelector('tbody');
      if (!tbody) return;
      
      // Show loading if needed
      if (isLoading) {
        setLoading(true);
        return;
      }
      
      // Filter entries
      let filteredEntries = entries;
      if (currentFilter) {
        filteredEntries = entries.filter(entry => 
          entry.name.toLowerCase().includes(currentFilter)
        );
      }
      
      // No entries to show
      if (filteredEntries.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center">
              ${currentFilter ? 'No players match your filter' : 'No entries found'}
            </td>
          </tr>
        `;
        return;
      }
      
      // Sort entries
      filteredEntries.sort((a, b) => {
        // Handle special case for rank field (non-numeric)
        if (sortField === 'rank') {
          const rankOrder = { 'gold': 0, 'silver': 1, 'bronze': 2, 'unranked': 3 };
          const rankA = rankOrder[a.rank] || 3;
          const rankB = rankOrder[b.rank] || 3;
          return sortDirection === 'asc' ? rankA - rankB : rankB - rankA;
        }
        
        // General case - compare values
        const valA = a[sortField];
        const valB = b[sortField];
        
        if (typeof valA === 'string') {
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        } else {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
      });
      
      // Generate table rows
      const rows = filteredEntries.map((entry, index) => {
        const position = index + 1;
        const isTopThree = position <= 3;
        
        return `
          <tr class="rank-${entry.rank} ${isTopThree ? `top-${position}` : ''}">
            <td>
              ${isTopThree ? `<span class="position-indicator">${position}</span>` : position}
            </td>
            <td>
              <span class="player-name" data-player="${Utils.sanitizeHTML(entry.name)}">
                ${Utils.sanitizeHTML(entry.name)}
              </span>
            </td>
            <td>${entry.wins}</td>
            <td>${entry.games_played}</td>
            <td>
              <div class="win-ratio-container">
                <span class="win-ratio-text">${entry.win_ratio}%</span>
                <div class="win-ratio-bar">
                  <div class="win-ratio-progress" style="width: ${Math.max(5, entry.win_ratio)}%"></div>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      tbody.innerHTML = rows;
      
      // Attach click handlers to player names
      tbody.querySelectorAll('.player-name').forEach(nameElement => {
        nameElement.addEventListener('click', () => {
          const playerName = nameElement.getAttribute('data-player');
          
          if (callbacks.onPlayerSelect && playerName) {
            callbacks.onPlayerSelect(playerName);
          }
        });
      });
      
      // Update sort indicators
      updateSortIndicators();
    }
    
    /**
     * Update the sort indicator arrows
     */
    function updateSortIndicators() {
      const headers = container.querySelectorAll('.sortable');
      
      headers.forEach(header => {
        // Remove existing indicators
        header.classList.remove('sort-asc', 'sort-desc');
        
        // Add indicator if this is the active sort field
        if (header.getAttribute('data-sort') === sortField) {
          header.classList.add(`sort-${sortDirection}`);
        }
      });
    }
    
    /**
     * Set error state
     * @param {string} message - Error message
     */
    function setError(message) {
      const tbody = container.querySelector('tbody');
      if (!tbody) return;
      
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-danger">
            <i class="fa fa-exclamation-circle me-2"></i>
            ${Utils.sanitizeHTML(message || 'Error loading leaderboard')}
          </td>
        </tr>
      `;
    }
    
    /**
     * Refresh the leaderboard
     * @param {Function} fetchFunction - Function to fetch new data
     * @returns {Promise} - Promise resolving when refresh is complete
     */
    async function refresh(fetchFunction) {
      setLoading(true);
      
      try {
        const data = await fetchFunction();
        setEntries(data);
      } catch (error) {
        console.error('Error refreshing leaderboard:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
    
    // Public API
    const publicAPI = {
      init,
      setEntries,
      setLoading,
      setError,
      refresh,
      toggleSort
    };
    
    return publicAPI;
  })();
  
  // Support both module.exports and direct browser usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeaderboardComponent;
  }