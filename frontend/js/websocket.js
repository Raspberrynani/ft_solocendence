/**
 * WebSocket Manager
 * Handles WebSocket connection, reconnection, and message handling
 * with better performance and organization
 */
const WebSocketManager = (function() {
  // Private variables
  let ws = null;
  let reconnectAttempts = 0;
  let isConnected = false;
  let gameCallbacks = {};
  let waitingListCallbacks = [];
  let pendingMessages = []; // Store messages received while page is not in focus
  let forcedReconnect = false;
  let lastPaddleUpdate = 0; // Timestamp of last paddle update (for throttling)
  
  // Constants
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds
  const PADDLE_UPDATE_THROTTLE = 16; // ~30fps max for paddle updates
  
  // WebSocket URL based on current location
  const WS_URL = (() => {
    // Get protocol (ws or wss) based on current page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    
    // Get hostname
    const hostname = window.location.hostname;
    
    // Get port - use the same port as the current page
    // This ensures the WebSocket connection goes through the same Nginx proxy
    const port = window.location.port;
    
    // Build the URL
    return `${protocol}${hostname}${port ? ':' + port : ''}/ws/pong/`;
  })();

  /**
   * Initialize WebSocket connection
   * @param {Object} callbacks - Callback functions for different message types
   */
  function init(callbacks = {}) {
    console.log("WebSocket Manager initializing, connecting to:", WS_URL);
    gameCallbacks = callbacks;
    connect();
    
    // Add visibility change handler
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Add window beforeunload handler to gracefully close connection
    window.addEventListener('beforeunload', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Don't use close() here as it triggers reconnection logic
        // Just signal the server we're disconnecting
        try {
          ws.send(JSON.stringify({ type: "client_disconnect" }));
        } catch (e) {
          // Ignore errors during page unload
        }
      }
    });
  }
  
  /**
   * Handle page visibility changes
   */
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      console.log("Page is now visible");
      // If we were disconnected when page was hidden, try to reconnect
      if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
        forcedReconnect = true;
        console.log("Forcing reconnection on page visibility change");
        connect();
      }
      
      // Process any pending messages
      if (pendingMessages.length > 0) {
        console.log(`Processing ${pendingMessages.length} queued messages`);
        pendingMessages.forEach(data => processMessage(data));
        pendingMessages = [];
      }
    } else {
      console.log("Page is now hidden");
      // We'll keep the connection but flag the state
    }
  }
  
  /**
   * Connect to WebSocket server
   */
  function connect() {
    // If there's an existing connection, close it
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        console.error("Error closing existing WebSocket:", e);
      }
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log("WebSocket connected to lobby");
      isConnected = true;
      reconnectAttempts = 0;
      
      // Notify any listeners about the connection
      if (gameCallbacks.onConnect) {
        gameCallbacks.onConnect();
      }
      
      // Request current state (waiting list, tournaments) after reconnect
      if (forcedReconnect) {
        send({ type: "get_state" });
        forcedReconnect = false;
      }
    };
    
    ws.onmessage = (event) => {
      handleMessage(event);
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      
      if (gameCallbacks.onError) {
        gameCallbacks.onError(error);
      }
    };
    
    ws.onclose = () => {
      console.log("WebSocket closed");
      isConnected = false;
      
      if (gameCallbacks.onDisconnect) {
        gameCallbacks.onDisconnect();
      }
      
      // Try to reconnect if we haven't exceeded max attempts or if it's a forced reconnect
      if (forcedReconnect || reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        
        setTimeout(connect, RECONNECT_DELAY);
        forcedReconnect = false;
      } else {
        if (gameCallbacks.onReconnectFailed) {
          gameCallbacks.onReconnectFailed();
        }
      }
    };
  }
  
  /**
   * Handle incoming WebSocket messages
   * @param {MessageEvent} event - The WebSocket message event
   */
  function handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Only log important messages to reduce console spam
      if (data.type !== 'game_update' && data.type !== 'game_state_update') {
        console.log("WebSocket message received:", data);
      }
      
      // If page is not visible, queue important messages for later processing
      if (document.visibilityState !== 'visible') {
        if (['start_game', 'game_over', 'opponent_left', 'tournament_update'].includes(data.type)) {
          console.log("Page not visible, queueing important message:", data);
          pendingMessages.push(data);
          return;
        }
      }
      
      processMessage(data);
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }
  
  /**
   * Process a parsed WebSocket message based on its type
   * @param {Object} data - Parsed message data
   */
  function processMessage(data) {
    // Special case for game_over to ensure winner is preserved
    if (data.type === 'game_over') {
        console.log("Processing game_over message:", data);
        
        if (gameCallbacks.onGameOver) {
            // Explicitly pass score and winner
            gameCallbacks.onGameOver(data.score, data.winner);
        }
        return;
    }

    // Add enhanced debugging for tournament messages
    if (data.type.includes('tournament') || data.type === 'start_game') {
      console.log("WebSocket [TOURNAMENT DEBUG]:", data);
    }

    // Map of message types to handler functions
    const messageHandlers = {
      // Game-related handlers
      queue_update: () => {
        if (gameCallbacks.onQueueUpdate) {
          gameCallbacks.onQueueUpdate(data.message);
        }
      },
      
      start_game: () => {
        console.log("Received start_game event, triggering callback with rounds:", data.rounds);
        
        // Set player side in ServerPong if available
        if (window.ServerPong && data.player_side) {
          window.ServerPong.setPlayerSide(data.player_side);
        }
        
        if (data.room) {
          try {
            localStorage.setItem('currentGameRoom', data.room);
          } catch (e) {
            console.error("Error saving game room:", e);
          }
        }
        
        if (gameCallbacks.onGameStart) {
          // Use timeout to ensure UI is ready
          setTimeout(() => {
            // Explicitly pass all relevant data to the callback
            gameCallbacks.onGameStart(
              data.rounds || 3, 
              data.is_tournament || false,
              data.room || null,
              data.player_side || 'left'
            );
          }, 50);
        }
      },
      
      waiting_list: () => {
        waitingListCallbacks.forEach(callback => callback(data.waiting_list));
      },
      
      game_update: () => {
        if (gameCallbacks.onGameUpdate && data.data) {
          gameCallbacks.onGameUpdate(data.data);
        }
      },
      
      // New handler for server-side game state updates
      game_state_update: () => {
        if (window.ServerPong) {
          window.ServerPong.updateGameState(data.state);
        }
      },
      
      // Keep this as a fallback, but our special case above should handle it first
      game_over: () => {
        console.log("Received game over event from handler");
        if (gameCallbacks.onGameOver) {
          gameCallbacks.onGameOver(data.score, data.winner);
        }
      },
      
      opponent_left: () => {
        if (gameCallbacks.onOpponentLeft) {
          gameCallbacks.onOpponentLeft(data.message);
        }
      },
      
      // Tournament handlers
      tournament_list: () => {
        if (window.TournamentManager) {
          window.TournamentManager.updateTournamentList(data.tournaments);
        }
      },

      tournament_match_ready: () => {
        // Show toast notification
        if (typeof Utils !== 'undefined' && Utils.showToast) {
          Utils.showToast(data.message || "Your tournament match is about to begin!", "info");
        }
        
        // Forward to TournamentManager
        if (window.TournamentManager && typeof TournamentManager.handleMatchReady === 'function') {
          TournamentManager.handleMatchReady(data.message);
        }
      },
      
      tournament_created: () => {
        if (window.TournamentManager) {
          window.TournamentManager.handleTournamentCreated(data.tournament);
        }
      },
      
      tournament_joined: () => {
        if (window.TournamentManager) {
          window.TournamentManager.handleTournamentJoined(data.tournament);
        }
      },
      
      tournament_update: () => {
        if (window.TournamentManager) {
          window.TournamentManager.handleTournamentUpdate(data.tournament);
        }
      },
      
      tournament_left: () => {
        if (window.TournamentManager) {
          window.TournamentManager.handleTournamentLeft();
        }
      },
      
      tournament_error: () => {
        if (window.TournamentManager) {
          window.TournamentManager.handleTournamentError(data.message);
        }
      }
    };
    
    // Call appropriate handler based on message type
    const handler = messageHandlers[data.type];
    if (handler) {
      handler();
    } else {
      console.warn("Unknown message type:", data.type);
    }
  }
  
  /**
   * Send a message to the WebSocket server
   * @param {Object} data - Message data to send
   * @returns {boolean} - Success status
   */
  function send(data) {
    if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
      console.error("Cannot send message: WebSocket not connected");
      return false;
    }
    
    try {
      ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  }
  
  /**
   * Join a game queue
   * @param {string} nickname - Player's nickname
   * @param {string} token - Game token for verification
   * @param {number} rounds - Number of rounds to play
   * @returns {boolean} - Success status
   */
  function joinQueue(nickname, token, rounds) {
    if (!isConnected) {
      if (gameCallbacks.onError) {
        gameCallbacks.onError("Not connected to server");
      }
      return false;
    }
    
    if (!nickname || !token) {
      console.error("Invalid nickname or token");
      return false;
    }
    
    return send({
      type: "join",
      nickname,
      token,
      rounds: rounds || 3
    });
  }
  
  /**
   * Send paddle position update with throttling
   * @param {number} paddleY - Y position of the paddle
   * @returns {boolean} - Success status
   */
  function sendPaddleUpdate(paddleY) {
    if (!isConnected) return false;
    
    // Add extra validation to ensure we're sending valid data
    if (typeof paddleY !== 'number' || isNaN(paddleY)) {
        console.warn("Invalid paddle Y position:", paddleY);
        return false;
    }
    
    // Throttle paddle updates to reduce network traffic
    const now = Date.now();
    if (now - lastPaddleUpdate < PADDLE_UPDATE_THROTTLE) {
        return true; // Pretend success but skip sending
    }
    
    lastPaddleUpdate = now;
    
    // Round paddleY to reduce precision and bandwidth
    const roundedY = Math.round(paddleY);
    
    return send({
        type: "game_update",
        data: { paddleY: roundedY }
    });
  }
  
  /**
   * Send game over notification
   * @param {number} score - Final score
   * @returns {boolean} - Success status
   */
  function sendGameOver(score) {
    if (!isConnected) return false;
    
    if (typeof score !== 'number' || isNaN(score)) {
      console.warn("Invalid score:", score);
      return false;
    }
    
    return send({
      type: "game_over", 
      score
    });
  }
  
  /**
   * Add a callback for waiting list updates
   * @param {Function} callback - Function to call with waiting list data
   */
  function onWaitingListUpdate(callback) {
    if (typeof callback === 'function') {
      waitingListCallbacks.push(callback);
    }
  }
  
  /**
   * Remove a waiting list callback
   * @param {Function} callback - Function to remove
   */
  function offWaitingListUpdate(callback) {
    waitingListCallbacks = waitingListCallbacks.filter(cb => cb !== callback);
  }
  
  /**
   * Check if WebSocket is connected
   * @returns {boolean} - Connection status
   */
  function isWebSocketConnected() {
    return isConnected && ws && ws.readyState === WebSocket.OPEN;
  }
  
  /**
   * Reconnect WebSocket manually
   */
  function manualReconnect() {
    forcedReconnect = true;
    connect();
  }
  
  /**
   * Close the WebSocket connection
   */
  function disconnect() {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (ws) {
      ws.close();
    }
  }
  
  // Tournament-specific methods
  function sendTournamentAction(action, data = {}) {
    const message = { type: action, ...data };
    return send(message);
  }
  
  function createTournament(nickname, name, rounds) {
    return sendTournamentAction("create_tournament", {
      nickname,
      name: name || `${nickname}'s Tournament`,
      rounds: rounds || 3
    });
  }
  
  function joinTournament(tournamentId, nickname) {
    return sendTournamentAction("join_tournament", {
      tournament_id: tournamentId,
      nickname
    });
  }
  
  function startTournament(tournamentId) {
    return sendTournamentAction("start_tournament", {
      tournament_id: tournamentId
    });
  }
  
  function leaveTournament() {
    return sendTournamentAction("leave_tournament");
  }
  
  // Public API
  return {
    init,
    joinQueue,
    sendPaddleUpdate,
    sendGameOver,
    onWaitingListUpdate,
    offWaitingListUpdate,
    isConnected: isWebSocketConnected,
    reconnect: manualReconnect,
    disconnect,
    send,
    
    // Tournament-specific methods
    createTournament,
    joinTournament,
    startTournament,
    leaveTournament
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSocketManager;
}

window.WebSocketManager = WebSocketManager;