const WebSocketManager = (function() {
  // Private variables
  let ws = null;
  let reconnectAttempts = 0;
  let isConnected = false;
  let gameCallbacks = {};
  let waitingListCallbacks = [];
  let pendingMessages = []; // Store messages received while page is not in focus
  let forcedReconnect = false;
  
  // Constants
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds
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

  console.log("WebSocket connecting to:", WS_URL);
  
  /**
   * Initialize WebSocket connection
   * @param {Object} callbacks - Callback functions for different message types
   */
  function init(callbacks = {}) {
    gameCallbacks = callbacks;
    connect();
    
    // Add visibility change handler
    document.addEventListener('visibilitychange', handleVisibilityChange);
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
      console.log("WebSocket message received:", data);
      
      // If page is not visible, queue critical messages for later processing
      if (document.visibilityState !== 'visible' && data.type === 'start_game') {
        console.log("Page not visible, queueing important message:", data);
        pendingMessages.push(data);
        return;
      }
      
      processMessage(data);
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }
  
  /**
   * Process a WebSocket message
   * @param {Object} data - Parsed message data
   */
  function processMessage(data) {
    // Add enhanced debugging for tournament messages
    if (data.type.includes('tournament') || data.type === 'start_game') {
      console.log("WebSocket [TOURNAMENT DEBUG]:", data);
    }
    
    switch (data.type) {
      case "queue_update":
        if (gameCallbacks.onQueueUpdate) {
          gameCallbacks.onQueueUpdate(data.message);
        }
        break;
        
      case "start_game":
        console.log("Received start_game event, triggering callback with rounds:", data.rounds);
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
              data.room || null
            );
          }, 50);
        }
        break;
        
      case "waiting_list":
        waitingListCallbacks.forEach(callback => callback(data.waiting_list));
        break;
        
      case "game_update":
        if (gameCallbacks.onGameUpdate && data.data) {
          gameCallbacks.onGameUpdate(data.data);
        }
        break;
        
      case "game_over":
        if (gameCallbacks.onGameOver) {
          gameCallbacks.onGameOver(data.score);
        }
        break;
        
      case "opponent_left":
        if (gameCallbacks.onOpponentLeft) {
          gameCallbacks.onOpponentLeft(data.message);
        }
        break;
        
      // Tournament message types
      case "tournament_list":
        if (window.TournamentManager) {
          window.TournamentManager.updateTournamentList(data.tournaments);
        }
        break;
        
      case "tournament_created":
        if (window.TournamentManager) {
          window.TournamentManager.handleTournamentCreated(data.tournament);
        }
        break;
        
      case "tournament_joined":
        if (window.TournamentManager) {
          window.TournamentManager.handleTournamentJoined(data.tournament);
        }
        break;
        
      case "tournament_update":
        if (window.TournamentManager) {
          window.TournamentManager.handleTournamentUpdate(data.tournament);
        }
        break;
        
      case "tournament_left":
        if (window.TournamentManager) {
          window.TournamentManager.handleTournamentLeft();
        }
        break;
        
      case "tournament_error":
        if (window.TournamentManager) {
          window.TournamentManager.handleTournamentError(data.message);
        }
        break;
        
      default:
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
   */
  function joinQueue(nickname, token, rounds) {
    if (!isConnected) {
      if (gameCallbacks.onError) {
        gameCallbacks.onError("Not connected to server");
      }
      return false;
    }
    
    try {
      ws.send(JSON.stringify({
        type: "join",
        nickname,
        token,
        rounds
      }));
      return true;
    } catch (error) {
      console.error("Error joining queue:", error);
      return false;
    }
  }
  
  /**
   * Send paddle position update
   * @param {number} paddleY - Y position of the paddle
   */
  function sendPaddleUpdate(paddleY) {
    if (!isConnected) return false;
    
    // Add extra validation to ensure we're sending valid data
    if (typeof paddleY !== 'number' || isNaN(paddleY)) {
      console.warn("Invalid paddle Y position:", paddleY);
      return false;
    }
    
    try {
      // Log occasional paddle updates (not every frame to avoid spam)
      if (Math.random() < 0.05) {
        console.log(`Sending paddle update: Y=${paddleY.toFixed(1)}`);
      }
      
      ws.send(JSON.stringify({
        type: "game_update",
        data: { paddleY }
      }));
      return true;
    } catch (error) {
      console.error("Error sending paddle update:", error);
      return false;
    }
  }
  
  /**
   * Send game over notification
   * @param {number} score - Final score
   */
  function sendGameOver(score) {
    if (!isConnected) return false;
    
    try {
      ws.send(JSON.stringify({
        type: "game_over", 
        score
      }));
      return true;
    } catch (error) {
      console.error("Error sending game over:", error);
      return false;
    }
  }
  
  /**
   * Add a callback for waiting list updates
   * @param {Function} callback - Function to call with waiting list data
   */
  function onWaitingListUpdate(callback) {
    waitingListCallbacks.push(callback);
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
    send // Added for tournament functionality
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSocketManager;
}