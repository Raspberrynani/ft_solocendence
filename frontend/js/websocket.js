/**
 * WebSocket Manager Module
 * Handles WebSocket connections and message processing
 */
const WebSocketManager = (function() {
    // Private variables
    let ws = null;
    let reconnectAttempts = 0;
    let isConnected = false;
    let gameCallbacks = {};
    let waitingListCallbacks = [];
    
    // Constants
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000; // 3 seconds
    const WS_URL = "ws://127.0.0.1:8000/ws/pong/";
    
    /**
     * Initialize WebSocket connection
     * @param {Object} callbacks - Callback functions for different message types
     */
    function init(callbacks = {}) {
      gameCallbacks = callbacks;
      connect();
    }
    
    /**
     * Connect to WebSocket server
     */
    function connect() {
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
        
        // Try to reconnect if we haven't exceeded max attempts
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          
          setTimeout(connect, RECONNECT_DELAY);
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
        console.log("WebSocket message:", data);
        
        switch (data.type) {
          case "queue_update":
            if (gameCallbacks.onQueueUpdate) {
              gameCallbacks.onQueueUpdate(data.message);
            }
            break;
            
          case "start_game":
            if (gameCallbacks.onGameStart) {
              gameCallbacks.onGameStart(data.rounds);
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
            
          default:
            console.warn("Unknown message type:", data.type);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
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
      
      try {
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
     * Close the WebSocket connection
     */
    function disconnect() {
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
      disconnect
    };
  })();
  
  // Export for ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketManager;
  }