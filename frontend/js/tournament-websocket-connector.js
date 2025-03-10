/**
 * Tournament WebSocket Connector
 * Connects the Tournament Manager to the WebSocket server
 */
const TournamentWebSocketConnector = (function() {
    // Private variables
    let webSocket = null;
    let tournamentManager = null;
    
    /**
     * Initialize the WebSocket connector
     * @param {Object} options Configuration options
     */
    function init(options = {}) {
      console.log("TournamentWebSocketConnector: Initializing...");
      
      // Store main WebSocket instance
      webSocket = options.webSocket || window.WebSocketManager;
      if (!webSocket) {
        console.error("TournamentWebSocketConnector: WebSocket instance is required");
        return false;
      }
      
      // Store Tournament Manager instance
      tournamentManager = options.tournamentManager || window.TournamentManager;
      if (!tournamentManager) {
        console.error("TournamentWebSocketConnector: Tournament Manager instance is required");
        return false;
      }
      
      // Set up message handlers
      setupMessageHandlers();
      
      console.log("TournamentWebSocketConnector: Initialized successfully");
      return true;
    }
    
    /**
     * Set up WebSocket message handlers
     */
    function setupMessageHandlers() {
      // Store original WebSocket message handler if available
      const originalMessageHandler = webSocket.onmessage || function() {};
      
      // Override WebSocket message handler with our own
      webSocket.onmessage = function(event) {
        // Call original handler first
        originalMessageHandler(event);
        
        // Handle tournament-specific messages
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case "tournament_list":
              handleTournamentList(data.tournaments);
              break;
            case "tournament_created":
              handleTournamentCreated(data.tournament);
              break;
            case "tournament_joined":
              handleTournamentJoined(data.tournament);
              break;
            case "tournament_update":
              handleTournamentUpdate(data.tournament);
              break;
            case "tournament_left":
              handleTournamentLeft(data.message);
              break;
            case "tournament_error":
              handleTournamentError(data.message);
              break;
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };
    }
    
    /**
     * Send a WebSocket message
     * @param {Object} data Message data to send
     * @returns {boolean} Success status
     */
    function send(data) {
      if (!webSocket || !webSocket.send) {
        console.error("WebSocket not available for sending");
        return false;
      }
      
      return webSocket.send(data);
    }
    
    /**
     * Handle tournament list message
     * @param {Array} tournaments List of available tournaments
     */
    function handleTournamentList(tournaments) {
        console.log("Received tournament list:", tournaments);
        // Try both function names for backward compatibility
        if (tournamentManager) {
          if (tournamentManager.updateTournamentList) {
            tournamentManager.updateTournamentList(tournaments);
          } else if (tournamentManager.updateTournamentsList) {
            tournamentManager.updateTournamentsList(tournaments);
          }
        }
      }
    /**
     * Handle tournament created message
     * @param {Object} tournament Created tournament data
     */
    function handleTournamentCreated(tournament) {
      console.log("Tournament created:", tournament);
      if (tournamentManager && tournamentManager.handleTournamentCreated) {
        tournamentManager.handleTournamentCreated(tournament);
      }
    }
    
    /**
     * Handle tournament joined message
     * @param {Object} tournament Joined tournament data
     */
    function handleTournamentJoined(tournament) {
      console.log("Tournament joined:", tournament);
      if (tournamentManager && tournamentManager.handleTournamentJoined) {
        tournamentManager.handleTournamentJoined(tournament);
      }
    }
    
    /**
     * Handle tournament update message
     * @param {Object} tournament Updated tournament data
     */
    function handleTournamentUpdate(tournament) {
      console.log("Tournament updated:", tournament);
      if (tournamentManager && tournamentManager.handleTournamentUpdate) {
        tournamentManager.handleTournamentUpdate(tournament);
      }
    }
    
    /**
     * Handle tournament left message
     * @param {string} message Notification message
     */
    function handleTournamentLeft(message) {
      console.log("Tournament left:", message);
      if (tournamentManager && tournamentManager.handleTournamentLeft) {
        tournamentManager.handleTournamentLeft();
      }
    }
    
    /**
     * Handle tournament error message
     * @param {string} message Error message
     */
    function handleTournamentError(message) {
      console.error("Tournament error:", message);
      if (tournamentManager && tournamentManager.handleTournamentError) {
        tournamentManager.handleTournamentError(message);
      }
    }
    
    // Public API
    return {
      init,
      send
    };
  })();
  
  // Make available globally
  window.TournamentWebSocketConnector = TournamentWebSocketConnector;