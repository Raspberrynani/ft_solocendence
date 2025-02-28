/**
 * Pong Engine Module
 * Handles core game physics and logic
 */
const PongEngine = (function() {
    // Private state variables
    let gameState = {
      // Game dimensions
      width: 0,
      height: 0,
      
      // Game objects
      ball: {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 0,
        speed: 0
      },
      
      leftPaddle: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      },
      
      rightPaddle: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      },
      
      // Game configuration
      paddleSpeed: 0,
      speedScaleFactor: 1,
      
      // Game state tracking
      isRunning: false,
      isMultiplayer: false,
      rounds: {
        current: 0,
        target: 3
      },
      
      // Custom game options
      options: {
        paddleSizeMultiplier: 1.0,
        initialBallSpeed: 4,
        speedIncrement: 0.5,
        gravityEnabled: false,
        gravityStrength: 0.1,
        bounceRandom: false
      }
    };
    
    // AI state for single player mode
    let aiState = {
      difficulty: 0.7,
      lastUpdateTime: 0,
      lastBallPosition: { x: 0, y: 0 },
      calculatedVelocity: { x: 0, y: 0 },
      action: null,
      decisionInterval: 1000 // 1 second
    };
    
    // Callback functions
    let callbacks = {
      onRoundComplete: null,
      onGameOver: null,
      onUpdate: null
    };
    
    /**
     * Initialize the game engine
     * @param {Object} config - Game configuration object
     * @returns {Object} - Public API
     */
    function init(config = {}) {
      // Set dimensions
      gameState.width = config.width || 800;
      gameState.height = config.height || 400;
      
      // Set game configuration
      gameState.isMultiplayer = config.isMultiplayer || false;
      gameState.rounds.target = config.rounds || 3;
      
      // Set callbacks
      callbacks = {
        onRoundComplete: config.onRoundComplete || null,
        onGameOver: config.onGameOver || null,
        onUpdate: config.onUpdate || null
      };
      
      // Apply custom options if provided
      if (config.options) {
        gameState.options = {
          ...gameState.options,
          ...config.options
        };
      }
      
      // Set AI difficulty
      if (config.aiDifficulty !== undefined) {
        aiState.difficulty = Math.max(0, Math.min(1, config.aiDifficulty));
      }
      
      // Initialize game state
      resetGameState();
      
      console.log("Pong engine initialized with config:", config);
      
      return publicAPI;
    }
    
    /**
     * Reset the game state to initial values
     */
    function resetGameState() {
      // Calculate dimensions based on game size
      updateGameDimensions(true);
      
      // Reset counters
      gameState.rounds.current = 0;
      
      // Apply paddle size multiplier
      const paddleHeight = gameState.leftPaddle.height * gameState.options.paddleSizeMultiplier;
      
      // Reset paddles
      gameState.leftPaddle = {
        x: gameState.paddleWidth * 2,
        y: gameState.height / 2 - paddleHeight / 2,
        width: gameState.paddleWidth,
        height: paddleHeight
      };
      
      gameState.rightPaddle = {
        x: gameState.width - (gameState.paddleWidth * 3),
        y: gameState.height / 2 - paddleHeight / 2,
        width: gameState.paddleWidth,
        height: paddleHeight
      };
      
      // Reset ball
      resetBall();
    }
    
    /**
     * Reset ball position and velocity
     */
    function resetBall() {
      // Calculate random angle for ball launch
      const angle = Math.random() * Math.PI / 4 - Math.PI / 8;
      
      // Set random direction (left or right)
      const direction = Math.random() > 0.5 ? 1 : -1;
      
      // Reset ball to center with random velocity
      gameState.ball = {
        x: gameState.width / 2,
        y: gameState.height / 2,
        radius: gameState.ballRadius,
        speed: gameState.options.initialBallSpeed * gameState.speedScaleFactor,
        vx: gameState.options.initialBallSpeed * Math.cos(angle) * direction * gameState.speedScaleFactor,
        vy: gameState.options.initialBallSpeed * Math.sin(angle) * gameState.speedScaleFactor
      };
    }
    
    /**
     * Update game dimensions based on canvas size
     * @param {boolean} forceReset - Force a complete reset of dimensions
     */
    function updateGameDimensions(forceReset = false) {
      // Calculate speed scale based on game size
      const referenceDimension = Math.max(gameState.width, gameState.height);
      gameState.speedScaleFactor = referenceDimension / 1000; // Reference size of 1000px
      
      // Clamp the speed factor to avoid extreme values
      gameState.speedScaleFactor = Math.max(0.5, Math.min(1.5, gameState.speedScaleFactor));
      
      // Calculate game element dimensions
      gameState.paddleWidth = Math.max(10, Math.floor(gameState.width * 0.02));
      gameState.paddleHeight = Math.max(60, Math.floor(gameState.height * 0.2));
      gameState.ballRadius = Math.max(5, Math.floor(Math.min(gameState.width, gameState.height) * 0.01));
      
      // Update paddle speed
      gameState.paddleSpeed = 4.5 * gameState.speedScaleFactor;
      
      if (forceReset) {
        // Reset positions based on new dimensions
        gameState.leftPaddle = {
          x: gameState.paddleWidth * 2,
          y: gameState.height / 2 - gameState.paddleHeight / 2,
          width: gameState.paddleWidth,
          height: gameState.paddleHeight
        };
        
        gameState.rightPaddle = {
          x: gameState.width - (gameState.paddleWidth * 3),
          y: gameState.height / 2 - gameState.paddleHeight / 2,
          width: gameState.paddleWidth,
          height: gameState.paddleHeight
        };
        
        // Reset ball if needed
        if (gameState.ball.radius) {
          resetBall();
        }
      } else {
        // Just update positions to stay in bounds
        if (gameState.leftPaddle) {
          gameState.leftPaddle.x = gameState.paddleWidth * 2;
          gameState.leftPaddle.y = Math.max(0, Math.min(
            gameState.height - gameState.leftPaddle.height, 
            gameState.leftPaddle.y
          ));
        }
        
        if (gameState.rightPaddle) {
          gameState.rightPaddle.x = gameState.width - (gameState.paddleWidth * 3);
          gameState.rightPaddle.y = Math.max(0, Math.min(
            gameState.height - gameState.rightPaddle.height, 
            gameState.rightPaddle.y
          ));
        }
        
        if (gameState.ball.radius) {
          // Keep ball in bounds
          gameState.ball.x = Math.min(
            Math.max(gameState.ball.radius, gameState.ball.x), 
            gameState.width - gameState.ball.radius
          );
          
          gameState.ball.y = Math.min(
            Math.max(gameState.ball.radius, gameState.ball.y), 
            gameState.height - gameState.ball.radius
          );
        }
      }
    }
    
    /**
     * Start the game
     */
    function start() {
      if (gameState.isRunning) return;
      
      gameState.isRunning = true;
      resetGameState();
      
      console.log("Game started");
    }
    
    /**
     * Stop the game
     */
    function stop() {
      gameState.isRunning = false;
      console.log("Game stopped");
    }
    
    /**
     * Update game state (physics simulation)
     * @param {number} deltaFactor - Time factor for smooth animation (1.0 = 60fps)
     */
    function update(deltaFactor = 1) {
      if (!gameState.isRunning) return;
      
      // Move ball
      gameState.ball.x += gameState.ball.vx * deltaFactor;
      gameState.ball.y += gameState.ball.vy * deltaFactor;
      
      // Apply gravity if enabled
      if (gameState.options.gravityEnabled) {
        gameState.ball.vy += gameState.options.gravityStrength * deltaFactor;
      }
      
      // Wall collision (top/bottom)
      if (gameState.ball.y - gameState.ball.radius < 0 || 
          gameState.ball.y + gameState.ball.radius > gameState.height) {
        
        gameState.ball.vy = -gameState.ball.vy;
        
        // Add randomness if enabled
        if (gameState.options.bounceRandom) {
          const randomFactor = 0.3; // Maximum 30% variation
          gameState.ball.vy += (Math.random() * 2 - 1) * gameState.ball.speed * randomFactor;
          
          // Make sure the ball doesn't get stuck moving horizontally
          if (Math.abs(gameState.ball.vy) < gameState.ball.speed * 0.2) {
            gameState.ball.vy = (gameState.ball.vy > 0 ? 1 : -1) * gameState.ball.speed * 0.2;
          }
        }
        
        // Keep ball in bounds
        if (gameState.ball.y - gameState.ball.radius < 0) {
          gameState.ball.y = gameState.ball.radius;
        } else {
          gameState.ball.y = gameState.height - gameState.ball.radius;
        }
      }
      
      // Paddle collision - left paddle
      if (checkPaddleCollision(gameState.leftPaddle)) {
        handlePaddleCollision(gameState.leftPaddle, true);
      }
      
      // Paddle collision - right paddle
      if (checkPaddleCollision(gameState.rightPaddle)) {
        handlePaddleCollision(gameState.rightPaddle, false);
      }
      
      // Scoring - ball off screen left/right
      if (gameState.ball.x + gameState.ball.radius < 0 || 
          gameState.ball.x - gameState.ball.radius > gameState.width) {
        
        // Increment round counter
        gameState.rounds.current++;
        
        // Notify round completion
        if (callbacks.onRoundComplete) {
          callbacks.onRoundComplete(gameState.rounds.current);
        }
        
        // Check for game over
        if (gameState.rounds.current >= gameState.rounds.target) {
          if (callbacks.onGameOver) {
            callbacks.onGameOver(gameState.rounds.current);
          }
          stop();
          return;
        }
        
        // Reset ball for next round
        resetBall();
      }
      
      // Update AI paddle in single player mode
      if (!gameState.isMultiplayer) {
        updateAI(deltaFactor);
      }
      
      // Notify state update
      if (callbacks.onUpdate) {
        callbacks.onUpdate(gameState);
      }
    }
    
    /**
     * Check if ball collides with a paddle
     * @param {Object} paddle - Paddle object to check
     * @returns {boolean} - Whether collision occurred
     */
    function checkPaddleCollision(paddle) {
      return (
        gameState.ball.x - gameState.ball.radius < paddle.x + paddle.width &&
        gameState.ball.x + gameState.ball.radius > paddle.x &&
        gameState.ball.y > paddle.y &&
        gameState.ball.y < paddle.y + paddle.height
      );
    }
    
    /**
     * Handle paddle collision physics
     * @param {Object} paddle - Paddle that was hit
     * @param {boolean} isLeftPaddle - Whether it's the left paddle
     */
    function handlePaddleCollision(paddle, isLeftPaddle) {
      // Calculate hit position relative to paddle center (-1 to 1)
      const hitPos = (gameState.ball.y - (paddle.y + paddle.height/2)) / (paddle.height/2);
      
      // Calculate deflection angle (max ±75 degrees)
      const maxAngle = Math.PI * 0.42; // ~75 degrees
      const deflectAngle = hitPos * maxAngle;
      
      // Increase ball speed
      gameState.ball.speed += gameState.options.speedIncrement * gameState.speedScaleFactor;
      
      // Update velocity components based on which paddle was hit
      if (isLeftPaddle) {
        // Hit left paddle - ball goes right
        gameState.ball.vx = Math.abs(gameState.ball.speed * Math.cos(deflectAngle));
        gameState.ball.vy = gameState.ball.speed * Math.sin(deflectAngle);
        
        // Move ball outside paddle to prevent multiple collisions
        gameState.ball.x = paddle.x + paddle.width + gameState.ball.radius;
      } else {
        // Hit right paddle - ball goes left
        gameState.ball.vx = -Math.abs(gameState.ball.speed * Math.cos(deflectAngle));
        gameState.ball.vy = gameState.ball.speed * Math.sin(deflectAngle);
        
        // Move ball outside paddle
        gameState.ball.x = paddle.x - gameState.ball.radius;
      }
      
      // Ensure minimum horizontal velocity
      const minHorizSpeed = gameState.ball.speed * 0.5;
      if (Math.abs(gameState.ball.vx) < minHorizSpeed) {
        gameState.ball.vx = (gameState.ball.vx > 0 ? 1 : -1) * minHorizSpeed;
      }
    }
    
    /**
     * Update AI paddle position
     * @param {number} deltaFactor - Time factor for smooth animation
     */
    function updateAI(deltaFactor) {
      const now = Date.now();
      
      // Calculate current ball velocity
      aiState.calculatedVelocity.x = gameState.ball.x - aiState.lastBallPosition.x;
      aiState.calculatedVelocity.y = gameState.ball.y - aiState.lastBallPosition.y;
      
      // Only update decision periodically to simulate human reaction time
      if (now - aiState.lastUpdateTime >= aiState.decisionInterval) {
        aiState.lastUpdateTime = now;
        aiState.action = calculateAIAction();
        aiState.lastBallPosition.x = gameState.ball.x;
        aiState.lastBallPosition.y = gameState.ball.y;
      }
      
      // Apply the calculated action
      if (aiState.action === 'up') {
        gameState.rightPaddle.y -= gameState.paddleSpeed * deltaFactor;
      } else if (aiState.action === 'down') {
        gameState.rightPaddle.y += gameState.paddleSpeed * deltaFactor;
      }
      
      // Keep paddle in bounds
      gameState.rightPaddle.y = Math.max(0, Math.min(
        gameState.height - gameState.rightPaddle.height, 
        gameState.rightPaddle.y
      ));
    }
    
    /**
     * Calculate AI paddle action based on ball trajectory
     * @returns {string|null} - 'up', 'down', or null
     */
    function calculateAIAction() {
      // If ball is moving away from AI paddle, return to center
      if (gameState.ball.vx < 0) {
        const paddleCenter = gameState.rightPaddle.y + gameState.rightPaddle.height / 2;
        const canvasCenter = gameState.height / 2;
        
        if (paddleCenter < canvasCenter - 20) {
          return 'down';
        } else if (paddleCenter > canvasCenter + 20) {
          return 'up';
        }
        return null;
      }
      
      // Calculate time until ball reaches paddle x-position
      const distanceToImpact = gameState.rightPaddle.x - gameState.ball.x;
      
      // Avoid division by zero
      if (Math.abs(gameState.ball.vx) < 0.1) return null;
      
      const timeToImpact = distanceToImpact / gameState.ball.vx;
      
      // If ball is moving away, no action needed
      if (timeToImpact <= 0) return null;
      
      // Predict y position at impact
      let predictedY = gameState.ball.y + (gameState.ball.vy * timeToImpact);
      
      // Account for bounces off walls
      const bounces = Math.floor(predictedY / gameState.height);
      if (bounces % 2 === 1) {
        predictedY = gameState.height - (predictedY % gameState.height);
      } else {
        predictedY = predictedY % gameState.height;
      }
      
      // Add randomness based on difficulty
      // Lower difficulty = more randomness
      const randomFactor = (1 - aiState.difficulty) * gameState.rightPaddle.height * 0.8;
      const randomOffset = (Math.random() - 0.5) * randomFactor;
      predictedY += randomOffset;
      
      // If AI is exceptionally good, sometimes deliberately miss
      if (aiState.difficulty > 0.8 && Math.random() > 0.9) {
        // 10% chance to make a mistake at high difficulty
        predictedY += (Math.random() > 0.5 ? 1 : -1) * gameState.rightPaddle.height * 0.8;
      }
      
      // Calculate center of paddle and desired position
      const paddleCenter = gameState.rightPaddle.y + gameState.rightPaddle.height / 2;
      
      // Tolerance to prevent jitter
      const tolerance = 10;
      
      // Determine action
      if (paddleCenter < predictedY - tolerance) {
        return 'down';
      } else if (paddleCenter > predictedY + tolerance) {
        return 'up';
      }
      
      return null;
    }
    
    /**
     * Move the left paddle
     * @param {number} y - New Y position for paddle center
     */
    function moveLeftPaddle(y) {
      // Adjust y to be paddle top position
      const paddleTop = y - (gameState.leftPaddle.height / 2);
      
      // Keep paddle in bounds
      gameState.leftPaddle.y = Math.max(0, Math.min(
        gameState.height - gameState.leftPaddle.height,
        paddleTop
      ));
    }
    
    /**
     * Update the remote (right) paddle position
     * @param {number} y - New Y position for paddle
     */
    function updateRemotePaddle(y) {
      if (gameState.isMultiplayer) {
        // Keep paddle in bounds
        gameState.rightPaddle.y = Math.max(0, Math.min(
          gameState.height - gameState.rightPaddle.height,
          y
        ));
      }
    }
    
    /**
     * Resize the game
     * @param {number} width - New width
     * @param {number} height - New height
     */
    function resize(width, height) {
      gameState.width = width;
      gameState.height = height;
      updateGameDimensions(true);
    }
    
    /**
     * Set AI difficulty
     * @param {number} difficulty - Difficulty level (0-1)
     */
    function setAIDifficulty(difficulty) {
      aiState.difficulty = Math.max(0, Math.min(1, difficulty));
    }
    
    /**
     * Get the current game state
     * @returns {Object} - Deep copy of game state
     */
    function getState() {
      // Create a deep copy of the game state to prevent external modification
      return JSON.parse(JSON.stringify({
        ball: gameState.ball,
        leftPaddle: gameState.leftPaddle,
        rightPaddle: gameState.rightPaddle,
        width: gameState.width,
        height: gameState.height,
        isRunning: gameState.isRunning,
        rounds: gameState.rounds,
        options: gameState.options
      }));
    }
    
    // Public API
    const publicAPI = {
      init,
      start,
      stop,
      update,
      moveLeftPaddle,
      updateRemotePaddle,
      resize,
      setAIDifficulty,
      getState
    };
    
    return publicAPI;
  })();