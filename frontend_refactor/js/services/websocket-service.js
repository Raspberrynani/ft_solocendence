/**
 * WebSocket Service Module
 * Handles WebSocket connections and message processing
 */
const WebSocketService = (function() {
    // Private variables
    let ws = null;
    let reconnectAttempts = 0;
    let isConnected = false;
    let callbacks = {};
    let waitingListCallbacks = [];
    
    // Configuration
    const config = {
      // Maximum reconnection attempts before giving up
      MAX_RECONNECT_ATTEMPTS: 5,
      
      // Delay between reconnection attempts (in ms)
      RECONNECT_DELAY: 3000,
      
      // Base WebSocket URL (constructed based on current protocol/host)
      WS_URL: (() => {
        // Get protocol (ws or wss) based on current page protocol
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        
        // Get hostname
        const hostname = window.location.hostname;
        
        // Get port - use the same port as the current page
        // This ensures the WebSocket connection goes through the same proxy
        const port = window.location.port;
        
        // Build the URL
        return `${protocol}${hostname}${port ? ':' + port : ''}/ws/pong/`;
      })()
    };
  
    /**
     * Initialize WebSocket connection
     * @param {Object} options - Initialization options and callbacks
     * @returns {Object} - Public API
     */
    function init(options = {}) {
      callbacks = {
        onMessage: options.onMessage || function() {},
        onConnect: options.onConnect || function() {},
        onDisconnect: options.onDisconnect || function() {},
        onError: options.onError || function() {},
        onReconnectFailed: options.onReconnectFailed || function() {}
      };
      
      console.log("WebSocket initializing, connecting to:", config.WS_URL);
      connect();
      
      return publicAPI;
    }
    
    /**
     * Connect to WebSocket server
     */
    function connect() {
      try {
        ws = new WebSocket(config.WS_URL);
        
        ws.onopen = handleOpen;
        ws.onmessage = handleMessage;
        ws.onerror = handleError;
        ws.onclose = handleClose;
      } catch (error) {
        console.error("Error creating WebSocket connection:", error);
        
        // Try to reconnect after delay
        scheduleReconnect();
      }
    }
    
    /**
     * Handle WebSocket open event
     */
    function handleOpen() {
      console.log("WebSocket connected to server");
      isConnected = true;
      reconnectAttempts = 0;
      
      // Notify connection
      callbacks.onConnect();
    }
    
    /**
     * Handle WebSocket message event
     * @param {MessageEvent} event - WebSocket message event
     */
    function handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message:", data);
        
        // Notify about specific message types
        if (data.type) {
          // Handle waiting list separately
          if (data.type === "waiting_list") {
            notifyWaitingListCallbacks(data.waiting_list);
          }
          
          // Notify the general message handler
          callbacks.onMessage(data, data.type);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
    
    /**
     * Handle WebSocket error event
     * @param {Event} error - WebSocket error event
     */
    function handleError(error) {
      console.error("WebSocket error:", error);
      callbacks.onError(error);
    }
    
    /**
     * Handle WebSocket close event
     * @param {CloseEvent} event - WebSocket close event
     */
    function handleClose(event) {
      console.log("WebSocket closed", event.code, event.reason);
      isConnected = false;
      
      // Notify disconnection
      callbacks.onDisconnect();
      
      // Try to reconnect if not closed deliberately
      if (event.code !== 1000) {
        scheduleReconnect();
      }
    }
    
    /**
     * Schedule a reconnection attempt
     */
    function scheduleReconnect() {
      if (reconnectAttempts < config.MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        
        console.log(`Attempting to reconnect (${reconnectAttempts}/${config.MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(connect, config.RECONNECT_DELAY);
      } else {
        console.error("Maximum reconnection attempts reached");
        callbacks.onReconnectFailed();
      }
    }
    
    /**
     * Notify all waiting list callbacks
     * @param {Array} waitingList - List of waiting players
     */
    function notifyWaitingListCallbacks(waitingList) {
      waitingListCallbacks.forEach(callback => {
        try {
          callback(waitingList);
        } catch (error) {
          console.error("Error in waiting list callback:", error);
        }
      });
    }
    
    /**
     * Join a game queue
     * @param {string} nickname - Player's nickname
     * @param {string} token - Game token for verification
     * @param {number} rounds - Number of rounds to play
     * @returns {boolean} - Whether the join request was sent successfully
     */
    function joinQueue(nickname, token, rounds) {
      if (!isConnected) {
        callbacks.onError(new Error("Not connected to server"));
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
     * @returns {boolean} - Whether the update was sent successfully
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
     * @returns {boolean} - Whether the notification was sent successfully
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
     * Close the WebSocket connection
     */
    function disconnect() {
      if (ws) {
        try {
          ws.close(1000, "Deliberate disconnect");
        } catch (error) {
          console.error("Error disconnecting WebSocket:", error);
        }
      }
    }
    
    // Public API
    const publicAPI = {
      init,
      joinQueue,
      sendPaddleUpdate,
      sendGameOver,
      onWaitingListUpdate,
      offWaitingListUpdate,
      isConnected: isWebSocketConnected,
      disconnect
    };
    
    return publicAPI;
  })();