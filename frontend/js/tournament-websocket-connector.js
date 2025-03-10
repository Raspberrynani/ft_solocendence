/**
 * Tournament WebSocket Connector
 * Connects the Tournament Manager to the WebSocket server
 */
const TournamentConnector = (function() {
    // Private variables
    let webSocket = null;
    let tournamentManager = null;
    
    /**
     * Initialize the WebSocket connector
     * @param {Object} options Configuration options
     */
    function init(options = {}) {
        console.log("TournamentConnector: Initializing...");
        
        // Store WebSocket instance
        webSocket = options.webSocket || window.WebSocketManager;
        if (!webSocket) {
            console.error("TournamentConnector: WebSocket instance is required");
            return false;
        }
        
        // Store Tournament Manager instance
        tournamentManager = options.tournamentManager || window.TournamentManager;
        if (!tournamentManager) {
            console.error("TournamentConnector: Tournament Manager instance is required");
            return false;
        }
        
        // Register WebSocket message handlers
        registerMessageHandlers();
        
        console.log("TournamentConnector: Initialized successfully");
        return true;
    }
    
    /**
     * Register WebSocket message handlers for tournament events
     */
    function registerMessageHandlers() {
        if (!webSocket || !tournamentManager) return;
        
        // Define message handlers
        const messageHandlers = {
            // Tournament listings
            tournament_list: (data) => {
                tournamentManager.updateTournamentsList(data.tournaments);
            },
            
            // Tournament updates
            tournament_created: (data) => {
                tournamentManager.handleTournamentCreated(data.tournament);
            },
            tournament_joined: (data) => {
                tournamentManager.handleTournamentJoined(data.tournament);
            },
            tournament_update: (data) => {
                tournamentManager.handleTournamentUpdate(data.tournament);
            },
            tournament_left: (data) => {
                tournamentManager.handleTournamentLeft(data.message);
            },
            tournament_error: (data) => {
                tournamentManager.handleTournamentError(data.message);
            },
            
            // Tournament results
            tournament_eliminated: (data) => {
                tournamentManager.showTournamentElimination(data.winner);
            },
            tournament_victory: (data) => {
                tournamentManager.showTournamentVictory();
            }
        };
        
        // Register a single message handler that delegates to the appropriate function
        webSocket.onTournamentMessage = function(data) {
            const messageType = data.type;
            const handler = messageHandlers[messageType];
            
            if (handler) {
                handler(data);
            } else {
                console.warn(`Unhandled tournament message type: ${messageType}`);
            }
        };
        
        // Hook into the WebSocket receive logic to detect tournament messages
        enhanceWebSocketReceive();
    }
    
    /**
     * Enhance the WebSocket receive method to detect tournament messages
     */
    function enhanceWebSocketReceive() {
        // Only enhance if not already enhanced
        if (webSocket._tournamentEnhanced) return;
        
        // Store the original receive method
        const originalReceive = webSocket.receive || function() {};
        
        // Replace with enhanced version
        webSocket.receive = function(message) {
            try {
                // Parse the message data
                const data = JSON.parse(message.data);
                
                // Check if it's a tournament-related message
                if (data && data.type && data.type.startsWith('tournament_')) {
                    // Handle tournament message
                    if (webSocket.onTournamentMessage) {
                        webSocket.onTournamentMessage(data);
                    }
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
            
            // Call original receive method
            if (typeof originalReceive === 'function') {
                originalReceive.call(webSocket, message);
            }
        };
        
        // Mark as enhanced to prevent multiple enhancements
        webSocket._tournamentEnhanced = true;
    }
    
    /**
     * Send a tournament-related message
     * @param {Object} data Message data
     * @returns {boolean} Success status
     */
    function sendMessage(data) {
        if (!webSocket || !webSocket.send) {
            console.error("Cannot send message: WebSocket not available");
            return false;
        }
        
        return webSocket.send(data);
    }
    
    // Public API
    return {
        init,
        send: sendMessage
    };
})();

// Make available globally
window.TournamentConnector = TournamentConnector;