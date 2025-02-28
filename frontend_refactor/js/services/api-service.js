/**
 * API Service Module
 * Handles all API communication with the backend
 */
const ApiService = (function() {
    // Base API URL - constructed based on current protocol/host
    const API_BASE_URL = (() => {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port;
      
      return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
    })();
    
    // Default request options
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Include cookies for CSRF protection
    };
    
    // Request in progress tracking
    const pendingRequests = new Map();
    
    /**
     * Initialize the API service
     */
    function init() {
      console.log("API Service initialized with base URL:", API_BASE_URL);
      return publicAPI;
    }
    
    /**
     * Fetch CSRF token for protected requests
     * @returns {Promise<string>} - CSRF token
     */
    async function fetchCsrfToken() {
      try {
        const response = await fetch(`${API_BASE_URL}/csrf/`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.csrfToken;
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        throw error;
      }
    }
    
    /**
     * Get entries for the leaderboard
     * @returns {Promise<Object>} - Leaderboard entries
     */
    async function getLeaderboardEntries() {
      return sendRequest('entries/', { method: 'GET' });
    }
    
    /**
     * Get player statistics
     * @param {string} playerName - Name of the player
     * @returns {Promise<Object>} - Player statistics
     */
    async function getPlayerStats(playerName) {
      return sendRequest(`player/${encodeURIComponent(playerName)}/`, { method: 'GET' });
    }
    
    /**
     * Send end game data
     * @param {Object} gameData - Game data to send
     * @param {string} gameData.nickname - Player nickname
     * @param {string} gameData.token - Game token
     * @param {number} gameData.score - Final score
     * @param {number} gameData.totalRounds - Total rounds played
     * @returns {Promise<Object>} - Server response
     */
    async function endGame(gameData) {
      // Get the CSRF token
      const csrfToken = await fetchCsrfToken();
      
      return sendRequest('end_game/', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify(gameData)
      });
    }
    
    /**
     * Delete player data
     * @param {Object} data - Player data to delete
     * @param {string} data.nickname - Player nickname
     * @param {string} data.verification_code - Verification code
     * @returns {Promise<Object>} - Server response
     */
    async function deletePlayerData(data) {
      // Get the CSRF token
      const csrfToken = await fetchCsrfToken();
      
      return sendRequest('delete_player/', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify(data)
      });
    }
    
    /**
     * Generate a verification code for data deletion
     * @param {string} nickname - Player nickname
     * @returns {Promise<string>} - Verification code
     */
    function generateVerificationCode(nickname) {
      // Client-side generation of a verification code
      // This is a simple implementation - the server will validate
      // using its own logic
      const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));
      const verificationString = `${nickname}-${currentHour}-pong-gdpr`;
      
      // Simple hash function for browser environments
      return sha256(verificationString).then(hash => hash.substring(0, 12));
    }
    
    /**
     * Simple SHA-256 hash function for browser environments
     * @param {string} message - Message to hash
     * @returns {Promise<string>} - Hashed message
     */
    async function sha256(message) {
      // Encode as UTF-8
      const msgBuffer = new TextEncoder().encode(message);
      
      // Hash the message
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      
      // Convert to hex string
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    
    /**
     * Send a request to the API
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise<Object>} - Server response
     */
    async function sendRequest(endpoint, options = {}) {
      const url = `${API_BASE_URL}/${endpoint}`;
      
      // Create a request ID to track duplicate requests
      const requestId = `${options.method || 'GET'}-${url}-${options.body || ''}`;
      
      // Check if this exact request is already in progress
      if (pendingRequests.has(requestId)) {
        console.log('Request already in progress, returning existing promise');
        return pendingRequests.get(requestId);
      }
      
      // Create and track the new request
      const requestPromise = (async () => {
        try {
          const response = await fetch(url, {
            ...defaultOptions,
            ...options
          });
          
          // Parse response as JSON
          const data = await response.json();
          
          // Check if response was successful
          if (!response.ok) {
            throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
          }
          
          return {
            success: true,
            ...data
          };
        } catch (error) {
          console.error(`API request failed for ${endpoint}:`, error);
          
          // Return a standardized error format
          return {
            success: false,
            error: error.message || 'Unknown error occurred'
          };
        } finally {
          // Remove from pending requests
          pendingRequests.delete(requestId);
        }
      })();
      
      // Store the promise
      pendingRequests.set(requestId, requestPromise);
      
      return requestPromise;
    }
  
    // Public API
    const publicAPI = {
      init,
      fetchCsrfToken,
      getLeaderboardEntries,
      getPlayerStats,
      endGame,
      deletePlayerData,
      generateVerificationCode
    };
    
    return publicAPI;
  })();