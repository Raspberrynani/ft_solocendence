/**
 * Module Integration Adapter
 * 
 * This file provides adapters and integration fixes to ensure that components
 * from the old codebase can work with the new modular architecture until
 * the full transition is complete.
 */

// Create a global PongGame object first thing to prevent reference errors
window.PongGame = window.PongGame || {};

/**
 * PongGame to PongEngine adapter
 * Allows the existing PongGame interface to work with the new system
 */
const PongGameAdapter = (function() {
  
  // Maps old PongGame methods to new PongEngine methods
  function init(config) {
    console.log("PongGameAdapter.init called with:", config);
    
    // Store callbacks for later
    const callbacks = config.callbacks || {};
    
    try {
      // Get canvas element
      const canvas = document.getElementById(config.canvasId);
      if (!canvas) {
        console.error(`Canvas element with ID ${config.canvasId} not found`);
        return this;
      }
      
      // Initialize PongEngine with converted config if it exists
      if (typeof PongEngine !== 'undefined') {
        PongEngine.init({
          width: canvas.width,
          height: canvas.height,
          isMultiplayer: config.isMultiplayer || false,
          rounds: config.rounds || 3,
          nickname: config.nickname,
          aiDifficulty: config.aiDifficulty,
          options: {
            initialBallSpeed: config.initialBallSpeed || 4,
            speedIncrement: config.speedIncrement || 0.5,
            paddleSizeMultiplier: config.paddleSizeMultiplier || 1.0,
            gravityEnabled: config.gravityEnabled || false,
            bounceRandom: config.bounceRandom || false
          },
          onRoundComplete: callbacks.onRoundComplete,
          onGameOver: callbacks.onGameOver,
          onUpdate: function(state) {
            // Render the game if PongRenderer exists
            if (typeof PongRenderer !== 'undefined') {
              PongRenderer.render(state, {
                nickname: config.nickname,
                controlsDisabled: !document.fullscreenElement
              });
            }
            
            // Call the original onUpdate if provided
            if (callbacks.onUpdate) {
              callbacks.onUpdate(state);
            }
          }
        });
        
        // Initialize renderer if it exists
        if (typeof PongRenderer !== 'undefined') {
          PongRenderer.init(canvas, {
            colors: {
              ballColor: config.ballColor || '#00d4ff',
              leftPaddleColor: config.leftPaddleColor || '#007bff',
              rightPaddleColor: config.rightPaddleColor || '#ff758c'
            },
            retroMode: config.retroMode || false
          });
        }
      } else {
        console.warn("PongEngine not available. Functionality will be limited.");
      }
    } catch (error) {
      console.error("Error in PongGameAdapter.init:", error);
    }
    
    return this;
  }
  
  // Public API mirroring the original PongGame interface
  return {
    init: function(config) {
      return init.call(this, config);
    },
    start: function() {
      if (typeof PongEngine !== 'undefined') {
        PongEngine.start();
      } else {
        console.warn("PongEngine not available. Cannot start game.");
      }
      return this;
    },
    stop: function() {
      if (typeof PongEngine !== 'undefined') {
        PongEngine.stop();
      } else {
        console.warn("PongEngine not available. Cannot stop game.");
      }
      return this;
    },
    resize: function() {
      try {
        if (document.getElementById('pong-canvas')) {
          const canvas = document.getElementById('pong-canvas');
          if (typeof PongEngine !== 'undefined') {
            PongEngine.resize(canvas.width, canvas.height);
          }
          if (typeof PongRenderer !== 'undefined') {
            PongRenderer.resize();
          }
        }
      } catch (error) {
        console.error("Error in PongGame.resize:", error);
      }
      return this;
    },
    updateRemotePaddle: function(y) {
      if (typeof PongEngine !== 'undefined') {
        PongEngine.updateRemotePaddle(y);
      }
      return this;
    },
    setDifficulty: function(difficulty) {
      if (typeof PongEngine !== 'undefined') {
        PongEngine.setAIDifficulty(difficulty);
      }
      return this;
    },
    getState: function() {
      if (typeof PongEngine !== 'undefined') {
        return PongEngine.getState();
      }
      return {};
    },
    setControlEnabled: function(enabled) {
      // This is handled by the renderer in the new architecture
      return this;
    }
  };
})();

// Create a new simpler implementation of PongGame if needed
if (!window.PongGame.init) {
  console.log("Creating PongGame from adapter");
  window.PongGame = PongGameAdapter;
} else {
  console.log("PongGame already exists, not replacing");
}

/**
 * Basic PongEngine placeholder in case the full version isn't loaded
 */
if (typeof PongEngine === 'undefined') {
  console.log("Creating PongEngine placeholder");
  
  window.PongEngine = {
    init: function() { 
      console.warn("Using placeholder PongEngine.init"); 
      return this; 
    },
    start: function() { 
      console.warn("Using placeholder PongEngine.start"); 
      return this; 
    },
    stop: function() { 
      console.warn("Using placeholder PongEngine.stop"); 
      return this; 
    },
    resize: function() { 
      console.warn("Using placeholder PongEngine.resize"); 
      return this; 
    },
    updateRemotePaddle: function() { 
      console.warn("Using placeholder PongEngine.updateRemotePaddle"); 
      return this; 
    },
    setAIDifficulty: function() { 
      console.warn("Using placeholder PongEngine.setAIDifficulty"); 
      return this; 
    },
    getState: function() { 
      console.warn("Using placeholder PongEngine.getState"); 
      return {}; 
    }
  };
}

/**
 * Basic PongRenderer placeholder in case the full version isn't loaded
 */
if (typeof PongRenderer === 'undefined') {
  console.log("Creating PongRenderer placeholder");
  
  window.PongRenderer = {
    init: function() { 
      console.warn("Using placeholder PongRenderer.init"); 
      return this; 
    },
    render: function() { 
      console.warn("Using placeholder PongRenderer.render"); 
      return this; 
    },
    resize: function() { 
      console.warn("Using placeholder PongRenderer.resize"); 
      return this; 
    },
    setColors: function() { 
      console.warn("Using placeholder PongRenderer.setColors"); 
      return this; 
    }
  };
}

/**
 * Enhanced event bus for better module communication
 * Provides a standardized way for modules to communicate
 */
const EventBus = (function() {
  const events = {};
  
  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Function to call when event is triggered
   * @returns {Function} - Unsubscribe function
   */
  function subscribe(event, callback) {
    if (!events[event]) {
      events[event] = [];
    }
    
    events[event].push(callback);
    
    // Return unsubscribe function
    return function() {
      const index = events[event].indexOf(callback);
      if (index !== -1) {
        events[event].splice(index, 1);
      }
    };
  }
  
  /**
   * Publish an event
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  function publish(event, data) {
    if (!events[event]) {
      return;
    }
    
    events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
  
  /**
   * Clear all event subscriptions
   */
  function clear() {
    Object.keys(events).forEach(event => {
      events[event] = [];
    });
  }
  
  // Public API
  return {
    subscribe,
    publish,
    clear
  };
})();

// Make EventBus globally available
window.EventBus = EventBus;

/**
 * Module dependency checker
 * Logs warnings for missing dependencies
 */
function checkDependencies() {
  const requiredModules = [
    { name: 'Utils', global: window.Utils },
    { name: 'I18nManager', global: window.I18nManager },
    { name: 'PageManager', global: window.PageManager },
    { name: 'ApiService', global: window.ApiService },
    { name: 'WebSocketService', global: window.WebSocketService },
    { name: 'Storage', global: window.Storage }
  ];
  
  const missingModules = [];
  
  requiredModules.forEach(module => {
    if (typeof module.global === 'undefined') {
      missingModules.push(module.name);
      
      // Create a placeholder to prevent errors
      window[module.name] = createDummyModule(module.name);
    }
  });
  
  if (missingModules.length > 0) {
    console.warn(`Missing modules: ${missingModules.join(', ')}`);
  }
}

/**
 * Create a dummy module that logs warnings when methods are called
 * @param {string} name - Module name
 * @returns {Object} - Dummy module
 */
function createDummyModule(name) {
  return new Proxy({}, {
    get: function(target, prop) {
      if (prop === 'init') {
        // Return a function that logs a warning and returns the dummy module
        return function() {
          console.warn(`WARNING: Using dummy ${name}.${prop}()`);
          return this;
        };
      }
      
      // For any other property access, return a warning function
      return function() {
        console.warn(`WARNING: Module ${name} is missing, ${prop}() called with:`, arguments);
        return null;
      };
    }
  });
}

/**
 * Fix key integrations between modules
 */
function fixModuleIntegration() {
  console.log("Fixing module integrations...");
  
  // Fix WebSocketService and GameController integration
  if (typeof window.WebSocketService !== 'undefined' && typeof window.GameController !== 'undefined') {
    try {
      // Add game update handling if not already present
      if (window.WebSocketService.sendPaddleUpdate && !window.WebSocketService._paddleUpdateFixed) {
        const originalSendPaddleUpdate = window.WebSocketService.sendPaddleUpdate;
        window.WebSocketService.sendPaddleUpdate = function(paddleY) {
          // Call the original method
          const result = originalSendPaddleUpdate.call(this, paddleY);
          
          // Log only occasionally to avoid flooding the console
          if (Math.random() < 0.05) {
            console.log("Sent paddle update:", paddleY);
          }
          
          return result;
        };
        
        window.WebSocketService._paddleUpdateFixed = true;
      }
    } catch (error) {
      console.error("Error fixing WebSocketService integration:", error);
    }
  }
  
  // Fix API service
  if (typeof window.ApiService !== 'undefined') {
    try {
      // Ensure API calls include credentials
      if (window.ApiService.sendRequest && !window.ApiService._sendRequestFixed) {
        const originalSendRequest = window.ApiService.sendRequest;
        window.ApiService.sendRequest = function(endpoint, options = {}) {
          // Ensure credentials are included
          options.credentials = options.credentials || 'include';
          
          // Call the original method
          return originalSendRequest.call(this, endpoint, options);
        };
        
        window.ApiService._sendRequestFixed = true;
      }
    } catch (error) {
      console.error("Error fixing ApiService integration:", error);
    }
  }
  
  // Fix PongGame/PongEngine integration
  if (typeof window.GameController !== 'undefined') {
    try {
      // Patch handleResize method if it exists
      if (window.GameController.handleResize && !window.GameController._handleResizeFixed) {
        const originalHandleResize = window.GameController.handleResize;
        window.GameController.handleResize = function() {
          try {
            // Call original method with error handling
            return originalHandleResize.apply(this, arguments);
          } catch (error) {
            console.error("Error in GameController.handleResize:", error);
            
            // Fallback implementation
            if (document.getElementById('pong-canvas') && window.gameState && window.gameState.gameActive) {
              if (typeof window.PongEngine !== 'undefined') {
                window.PongEngine.resize();
              } else if (typeof window.PongGame !== 'undefined' && window.PongGame.resize) {
                window.PongGame.resize();
              }
            }
          }
        };
        
        window.GameController._handleResizeFixed = true;
      }
    } catch (error) {
      console.error("Error fixing GameController integration:", error);
    }
  }
}

// Initialize dependency checking when the page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log("Running integration fixes and dependency checks...");
  checkDependencies();
  fixModuleIntegration();
});

// Fix integrations when all modules are loaded
window.addEventListener('load', function() {
  console.log("Page fully loaded - applying final integration fixes...");
  fixModuleIntegration();
  
  // Create a quick access for debugging
  window.debug = {
    EventBus: EventBus,
    fixIntegration: fixModuleIntegration,
    checkDeps: checkDependencies,
    PongGame: window.PongGame,
    PongEngine: window.PongEngine,
    PongRenderer: window.PongRenderer
  };
});

console.log("Integration fixes script loaded");