/**
 * Module Integration Adapter
 * 
 * This file provides adapters and integration fixes to ensure that components
 * from the old codebase can work with the new modular architecture until
 * the full transition is complete.
 */

// Create a global PongGame object first thing to prevent reference errors
window.PongGame = window.PongGame || {};

// Track initialization state to prevent duplicate initializations
const initStatus = {
  pongEngine: false,
  pongRenderer: false,
  gameLoop: false
};

/**
 * Global game state for compatibility
 */
window.gameState = window.gameState || {
  gameActive: false,
  isFullscreen: false
};

/**
 * PongGame to PongEngine adapter
 * Allows the existing PongGame interface to work with the new system
 */
const PongGameAdapter = (function() {
  // Private variables
  let canvas = null;
  let gameState = {
    ball: {
      x: 0,
      y: 0,
      radius: 5,
      vx: 3,
      vy: 2,
      speed: 3
    },
    leftPaddle: {
      x: 0,
      y: 0,
      width: 10,
      height: 60
    },
    rightPaddle: {
      x: 0,
      y: 0,
      width: 10,
      height: 60
    },
    width: 800,
    height: 400,
    isRunning: false,
    rounds: {
      current: 0,
      target: 3
    }
  };
  
  let callbacks = {};
  let gameLoopId = null;
  let lastFrameTime = 0;
  
  /**
   * Handle canvas sizing issues
   * @param {HTMLCanvasElement} canvasElement - The game canvas
   */
  function fixCanvasDimensions(canvasElement) {
    if (!canvasElement) return;
    
    // Store reference
    canvas = canvasElement;
    
    // Fixed dimensions if not set
    if (canvas.width < 50 || canvas.height < 50) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight || 300;
      console.log("Fixed canvas dimensions:", canvas.width, canvas.height);
    }
    
    // Update game state dimensions
    gameState.width = canvas.width;
    gameState.height = canvas.height;
    
    // Calculate paddle dimensions based on canvas size
    const paddleWidth = Math.max(10, Math.floor(canvas.width * 0.02));
    const paddleHeight = Math.max(60, Math.floor(canvas.height * 0.2));
    const ballRadius = Math.max(5, Math.floor(Math.min(canvas.width, canvas.height) * 0.01));
    
    // Update paddle positions
    gameState.leftPaddle = {
      x: paddleWidth * 2,
      y: canvas.height / 2 - paddleHeight / 2,
      width: paddleWidth,
      height: paddleHeight
    };
    
    gameState.rightPaddle = {
      x: canvas.width - (paddleWidth * 3),
      y: canvas.height / 2 - paddleHeight / 2,
      width: paddleWidth,
      height: paddleHeight
    };
    
    // Update ball
    gameState.ball.radius = ballRadius;
    gameState.ball.x = canvas.width / 2;
    gameState.ball.y = canvas.height / 2;
  }
  
  /**
   * Reset ball position with random direction
   */
  function resetBall() {
    const angle = Math.random() * Math.PI / 4 - Math.PI / 8;
    const direction = Math.random() > 0.5 ? 1 : -1;
    
    gameState.ball.x = gameState.width / 2;
    gameState.ball.y = gameState.height / 2;
    gameState.ball.speed = 3;
    gameState.ball.vx = gameState.ball.speed * Math.cos(angle) * direction;
    gameState.ball.vy = gameState.ball.speed * Math.sin(angle);
  }
  
  /**
   * Initialize the game state and components
   * @param {Object} config - Configuration options
   */
  function init(config) {
    console.log("PongGameAdapter.init called with:", config);
    
    // Get canvas element
    const canvasElement = document.getElementById(config.canvasId);
    if (!canvasElement) {
      console.error(`Canvas element with ID ${config.canvasId} not found`);
      return this;
    }
    
    // Store callbacks
    callbacks = config.callbacks || {};
    
    // Fix canvas dimensions and reset game state
    fixCanvasDimensions(canvasElement);
    resetBall();
    
    // Store other configuration
    gameState.isRunning = false;
    gameState.rounds.target = config.rounds || 3;
    gameState.rounds.current = 0;
    
    // Update game options
    if (config.paddleSizeMultiplier) {
      gameState.leftPaddle.height *= config.paddleSizeMultiplier;
      gameState.rightPaddle.height *= config.paddleSizeMultiplier;
    }
    
    // Store configuration
    window.gameConfig = config;
    
    // Try to use real PongEngine if available
    if (typeof PongEngine !== 'undefined' && typeof PongEngine.init === 'function' && !initStatus.pongEngine) {
      try {
        PongEngine.init({
          width: canvas.width,
          height: canvas.height,
          isMultiplayer: config.isMultiplayer || false,
          rounds: config.rounds || 3,
          options: {
            initialBallSpeed: config.initialBallSpeed || 4,
            speedIncrement: config.speedIncrement || 0.5,
            paddleSizeMultiplier: config.paddleSizeMultiplier || 1.0,
            gravityEnabled: config.gravityEnabled || false,
            bounceRandom: config.bounceRandom || false
          },
          onRoundComplete: callbacks.onRoundComplete,
          onGameOver: callbacks.onGameOver
        });
        
        initStatus.pongEngine = true;
        console.log("PongEngine initialized successfully");
      } catch (error) {
        console.error("Error initializing PongEngine:", error);
      }
    }
    
    // Try to use real PongRenderer if available
    if (typeof PongRenderer !== 'undefined' && typeof PongRenderer.init === 'function' && !initStatus.pongRenderer) {
      try {
        PongRenderer.init(canvasElement, {
          colors: {
            ballColor: config.ballColor || '#00d4ff',
            leftPaddleColor: config.leftPaddleColor || '#007bff',
            rightPaddleColor: config.rightPaddleColor || '#ff758c'
          }
        });
        
        initStatus.pongRenderer = true;
        console.log("PongRenderer initialized successfully");
      } catch (error) {
        console.error("Error initializing PongRenderer:", error);
      }
    }
    
    // Fall back to this simple implementation if needed
    if (!initStatus.pongEngine || !initStatus.pongRenderer) {
      console.log("Using fallback game implementation");
      this.renderFrame = renderGameFrame;
    }
    
    console.log("Game initialized with dimensions:", gameState.width, "x", gameState.height);
    
    return this;
  }
  
  /**
   * Simple game physics update
   * @param {number} deltaTime - Time since last frame in ms
   */
  function updateGameState(deltaTime) {
    if (!gameState.isRunning) return;
    
    // Normalize delta to get smooth motion regardless of frame rate
    const delta = (deltaTime / 16.67); // 60fps = 16.67ms per frame
    
    // Ball movement
    gameState.ball.x += gameState.ball.vx * delta;
    gameState.ball.y += gameState.ball.vy * delta;
    
    // Wall collision (top/bottom)
    if (gameState.ball.y - gameState.ball.radius < 0 || 
        gameState.ball.y + gameState.ball.radius > gameState.height) {
      
      gameState.ball.vy = -gameState.ball.vy;
      
      // Keep in bounds
      if (gameState.ball.y - gameState.ball.radius < 0) {
        gameState.ball.y = gameState.ball.radius;
      } else {
        gameState.ball.y = gameState.height - gameState.ball.radius;
      }
    }
    
    // Paddle collision - left paddle
    if (gameState.ball.x - gameState.ball.radius < gameState.leftPaddle.x + gameState.leftPaddle.width &&
        gameState.ball.x + gameState.ball.radius > gameState.leftPaddle.x &&
        gameState.ball.y > gameState.leftPaddle.y && 
        gameState.ball.y < gameState.leftPaddle.y + gameState.leftPaddle.height) {
      
      // Calculate hit position relative to paddle center
      const hitPos = (gameState.ball.y - (gameState.leftPaddle.y + gameState.leftPaddle.height/2)) / (gameState.leftPaddle.height/2);
      
      // Calculate deflection angle
      const maxAngle = Math.PI * 0.4;
      const angle = hitPos * maxAngle;
      
      // Set new velocity
      gameState.ball.vx = Math.abs(gameState.ball.speed * Math.cos(angle));
      gameState.ball.vy = gameState.ball.speed * Math.sin(angle);
      
      // Ensure minimum horizontal velocity
      gameState.ball.vx = Math.max(gameState.ball.vx, gameState.ball.speed * 0.5);
      
      // Move ball outside paddle
      gameState.ball.x = gameState.leftPaddle.x + gameState.leftPaddle.width + gameState.ball.radius;
      
      // Increase speed slightly
      gameState.ball.speed += 0.2;
    }
    
    // Paddle collision - right paddle
    if (gameState.ball.x + gameState.ball.radius > gameState.rightPaddle.x &&
        gameState.ball.x - gameState.ball.radius < gameState.rightPaddle.x + gameState.rightPaddle.width &&
        gameState.ball.y > gameState.rightPaddle.y && 
        gameState.ball.y < gameState.rightPaddle.y + gameState.rightPaddle.height) {
      
      // Calculate hit position relative to paddle center
      const hitPos = (gameState.ball.y - (gameState.rightPaddle.y + gameState.rightPaddle.height/2)) / (gameState.rightPaddle.height/2);
      
      // Calculate deflection angle
      const maxAngle = Math.PI * 0.4;
      const angle = hitPos * maxAngle;
      
      // Set new velocity
      gameState.ball.vx = -Math.abs(gameState.ball.speed * Math.cos(angle));
      gameState.ball.vy = gameState.ball.speed * Math.sin(angle);
      
      // Ensure minimum horizontal velocity
      gameState.ball.vx = Math.min(gameState.ball.vx, -gameState.ball.speed * 0.5);
      
      // Move ball outside paddle
      gameState.ball.x = gameState.rightPaddle.x - gameState.ball.radius;
      
      // Increase speed slightly
      gameState.ball.speed += 0.2;
    }
    
    // Scoring - ball off screen
    if (gameState.ball.x + gameState.ball.radius < 0 || 
        gameState.ball.x - gameState.ball.radius > gameState.width) {
      
      // Increment round counter
      gameState.rounds.current++;
      
      // Notify callback
      if (callbacks.onRoundComplete) {
        callbacks.onRoundComplete(gameState.rounds.current);
      }
      
      // Check for game over
      if (gameState.rounds.current >= gameState.rounds.target) {
        if (callbacks.onGameOver) {
          callbacks.onGameOver(gameState.rounds.current);
        }
        gameState.isRunning = false;
        return;
      }
      
      // Reset ball
      resetBall();
    }
    
    // Update AI movement if not multiplayer
    if (window.gameConfig && !window.gameConfig.isMultiplayer) {
      updateAI(delta);
    }
  }
  
  /**
   * Simple AI logic to move the right paddle
   * @param {number} delta - Time factor
   */
  function updateAI(delta) {
    // Only move if ball is moving toward AI paddle
    if (gameState.ball.vx > 0) {
      // Predict where ball will be
      const paddleCenter = gameState.rightPaddle.y + gameState.rightPaddle.height / 2;
      const ballCenter = gameState.ball.y;
      
      // Add some "AI difficulty" - don't always follow perfectly
      if (Math.random() > 0.1) {
        // Move paddle toward ball
        if (paddleCenter < ballCenter - 10) {
          // Move down
          gameState.rightPaddle.y += 5 * delta;
        } else if (paddleCenter > ballCenter + 10) {
          // Move up
          gameState.rightPaddle.y -= 5 * delta;
        }
      }
      
      // Keep paddle in bounds
      gameState.rightPaddle.y = Math.max(0, Math.min(
        gameState.height - gameState.rightPaddle.height,
        gameState.rightPaddle.y
      ));
    }
  }
  
  /**
   * Render the game state to canvas
   */
  function renderGameFrame() {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([5, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw ball
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw paddles
    ctx.fillStyle = '#007bff';
    ctx.fillRect(
      gameState.leftPaddle.x, 
      gameState.leftPaddle.y, 
      gameState.leftPaddle.width, 
      gameState.leftPaddle.height
    );
    
    ctx.fillStyle = '#ff758c';
    ctx.fillRect(
      gameState.rightPaddle.x, 
      gameState.rightPaddle.y, 
      gameState.rightPaddle.width, 
      gameState.rightPaddle.height
    );
    
    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${gameState.rounds.current} / ${gameState.rounds.target}`,
      canvas.width / 2,
      30
    );
    
    // Draw player name if available
    if (window.gameConfig && window.gameConfig.nickname) {
      ctx.font = '16px Arial';
      ctx.fillText(
        window.gameConfig.nickname,
        canvas.width / 2,
        60
      );
    }
  }
  
  /**
   * Main game loop
   * @param {number} timestamp - Current animation frame timestamp
   */
  function gameLoop(timestamp) {
    if (!gameState.isRunning) return;
    
    // Calculate delta time for smooth animation
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    
    // Update game state
    updateGameState(deltaTime);
    
    // Render frame
    if (initStatus.pongRenderer && typeof PongRenderer.render === 'function') {
      // Use actual renderer if available
      PongRenderer.render(gameState, {
        nickname: window.gameConfig ? window.gameConfig.nickname : '',
        controlsDisabled: !window.gameState.isFullscreen
      });
    } else {
      // Use fallback renderer
      renderGameFrame();
    }
    
    // Continue loop
    gameLoopId = requestAnimationFrame(gameLoop);
  }
  
  // Public API mirroring the original PongGame interface
  return {
    init: function(config) {
      return init.call(this, config);
    },
    start: function() {
      gameState.isRunning = true;
      lastFrameTime = performance.now();
      
      // Start the loop if not already running
      if (!initStatus.gameLoop) {
        gameLoopId = requestAnimationFrame(gameLoop);
        initStatus.gameLoop = true;
      }
      
      // Also try to use real PongEngine if available
      if (initStatus.pongEngine && typeof PongEngine.start === 'function') {
        PongEngine.start();
      }
      
      console.log("Game started");
      return this;
    },
    stop: function() {
      gameState.isRunning = false;
      
      // Stop animation loop
      if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
        initStatus.gameLoop = false;
      }
      
      // Also try to use real PongEngine if available
      if (initStatus.pongEngine && typeof PongEngine.stop === 'function') {
        PongEngine.stop();
      }
      
      console.log("Game stopped");
      return this;
    },
    resize: function() {
      if (canvas) {
        // Update canvas dimensions
        fixCanvasDimensions(canvas);
        
        // Also try to use real PongEngine if available
        if (initStatus.pongEngine && typeof PongEngine.resize === 'function') {
          PongEngine.resize(canvas.width, canvas.height);
        }
        
        console.log("Game resized");
      }
      return this;
    },
    updateRemotePaddle: function(y) {
      if (gameState.rightPaddle) {
        gameState.rightPaddle.y = Math.max(0, Math.min(
          gameState.height - gameState.rightPaddle.height,
          y
        ));
      }
      
      // Also try to use real PongEngine if available
      if (initStatus.pongEngine && typeof PongEngine.updateRemotePaddle === 'function') {
        PongEngine.updateRemotePaddle(y);
      }
      
      return this;
    },
    moveLeftPaddle: function(y) {
      if (gameState.leftPaddle) {
        gameState.leftPaddle.y = Math.max(0, Math.min(
          gameState.height - gameState.leftPaddle.height,
          y - (gameState.leftPaddle.height / 2)
        ));
      }
      
      return this;
    },
    setDifficulty: function(difficulty) {
      // Store difficulty for AI
      window.aiDifficulty = difficulty;
      
      // Also try to use real PongEngine if available
      if (initStatus.pongEngine && typeof PongEngine.setAIDifficulty === 'function') {
        PongEngine.setAIDifficulty(difficulty);
      }
      
      return this;
    },
    getState: function() {
      return { ...gameState };
    },
    setControlEnabled: function(enabled) {
      window.gameState.controlEnabled = enabled;
      return this;
    },
    
    // Extra functions not in original interface
    renderFrame: function() {
      // Will be replaced in init if needed
    }
  };
})();

// Create a new PongGame implementation
console.log("Creating PongGame from adapter");
window.PongGame = PongGameAdapter;

// Ensure we have a PongEngine even if the real one isn't loaded
if (typeof PongEngine === 'undefined') {
  console.log("Creating PongEngine placeholder");
  
  window.PongEngine = {
    init: function(config) {
      console.log("PongEngine.init called with:", config);
      return this;
    },
    start: function() {
      console.log("PongEngine.start called");
      return this;
    },
    stop: function() {
      console.log("PongEngine.stop called");
      return this;
    },
    resize: function(width, height) {
      console.log("PongEngine.resize called:", width, height);
      return this;
    },
    updateRemotePaddle: function(y) {
      // Will be handled by adapter
      return this;
    },
    setAIDifficulty: function(difficulty) {
      console.log("PongEngine.setAIDifficulty called:", difficulty);
      return this;
    },
    getState: function() {
      // Return state from adapter
      return window.PongGame ? window.PongGame.getState() : {};
    }
  };
}

// Ensure we have a PongRenderer even if the real one isn't loaded
if (typeof PongRenderer === 'undefined') {
  console.log("Creating PongRenderer placeholder");
  
  window.PongRenderer = {
    init: function(canvas, options) {
      console.log("PongRenderer.init called with canvas and options:", options);
      return this;
    },
    render: function(state, metadata) {
      // Rendering will be handled by adapter
      return this;
    },
    resize: function() {
      console.log("PongRenderer.resize called");
      return this;
    },
    setColors: function(colors) {
      console.log("PongRenderer.setColors called:", colors);
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
  
  // Fix mouse events for paddle control
  const pongCanvas = document.getElementById('pong-canvas');
  if (pongCanvas && !pongCanvas._mouseEventsFixed) {
    pongCanvas.addEventListener('mousemove', function(e) {
      if (!window.gameState || !window.gameState.gameActive) return;
      
      const rect = pongCanvas.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      
      // Update paddle position in PongGame
      if (window.PongGame && window.PongGame.moveLeftPaddle) {
        window.PongGame.moveLeftPaddle(mouseY);
      }
      
      // Send paddle update in multiplayer mode
      if (window.gameConfig && window.gameConfig.isMultiplayer && 
          window.WebSocketService && window.WebSocketService.sendPaddleUpdate) {
        window.WebSocketService.sendPaddleUpdate(mouseY);
      }
    });
    
    // Also handle touch events for mobile
    pongCanvas.addEventListener('touchmove', function(e) {
      if (!window.gameState || !window.gameState.gameActive) return;
      e.preventDefault();
      
      const rect = pongCanvas.getBoundingClientRect();
      const touchY = e.touches[0].clientY - rect.top;
      
      // Update paddle position in PongGame
      if (window.PongGame && window.PongGame.moveLeftPaddle) {
        window.PongGame.moveLeftPaddle(touchY);
      }
      
      // Send paddle update in multiplayer mode
      if (window.gameConfig && window.gameConfig.isMultiplayer && 
          window.WebSocketService && window.WebSocketService.sendPaddleUpdate) {
        window.WebSocketService.sendPaddleUpdate(touchY);
      }
    }, { passive: false });
    
    pongCanvas._mouseEventsFixed = true;
    console.log("Fixed mouse/touch events for paddle control");
  }
  
  // Fix canvas dimensions on window resize
  if (!window._resizeHandlerFixed) {
    window.addEventListener('resize', function() {
      if (window.PongGame && window.PongGame.resize) {
        window.PongGame.resize();
      }
    });
    
    window._resizeHandlerFixed = true;
    console.log("Fixed window resize handler");
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