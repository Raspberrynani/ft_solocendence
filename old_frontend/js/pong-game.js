/**
 * Pong Game Module
 * Handles game logic, physics, and rendering
 */
const PongGame = (function() {
  // Private variables for game state
  let canvas, ctx;
  let leftPaddle, rightPaddle;
  let ball;
  let paddleWidth, paddleHeight, ballRadius;
  let gameLoopId;
  let isRunning = false;
  let isMultiplayer = false;
  let aiState = {};
  let isControlEnabled = true;
  let isFullscreen = false;
  let baseSpeed = 4; // Base speed for reference
  let speedScaleFactor = 1; // Adjust based on screen size
  
  let gameConfig = {
    rounds: 3,
    currentRounds: 0,
    speedIncrement: 0.5,
    paddleSpeed: 4.5,
    initialBallSpeed: 4,
    // Add new properties for custom game
    paddleSizeMultiplier: 1.0,  // Default 100%
    ballColor: '#00d4ff',
    leftPaddleColor: '#007bff',
    rightPaddleColor: '#ff758c',
    gravityEnabled: false,
    gravityStrength: 0.1,
    bounceRandom: false
  };
  
  // References to player data and WebSocket
  let playerInfo = {
    nickname: "",
    token: ""
  };
  
  // Callbacks for game events
  let eventCallbacks = {};
  
  /**
   * Initialize the game canvas and setup
   * @param {Object} config - Game configuration object
  */
  function init(config = {}) {
    console.log("PongGame initializing with config:", config);
    
    // Get canvas and setup context
    canvas = document.getElementById(config.canvasId || 'pong-canvas');
    if (!canvas) {
      console.error("Canvas element not found!");
      return false;
    }
    
    ctx = canvas.getContext('2d');
    
    // Perform a comprehensive reset with new config
    resetGame(config);
    
    // Set mode
    isMultiplayer = config.isMultiplayer || false;
    
    // Store player info
    if (config.nickname) playerInfo.nickname = config.nickname;
    if (config.token) playerInfo.token = config.token;
    
    // Setup AI if needed
    if (!isMultiplayer) {
      initAI();
    }
    
    // Store event callbacks
    eventCallbacks = config.callbacks || {};
    
    // Setup event listeners for resize and fullscreen
    setupResizeHandlers();
    
    // Check initial fullscreen state
    checkFullscreenState();
    
    console.log("PongGame initialized successfully");
    return true;
  }
  
  /**
   * Setup resize and fullscreen event handlers
   */
  function setupResizeHandlers() {
    // Resize handler that updates all game elements
    window.addEventListener('resize', Utils.debounce(() => {
      updateGameDimensions();
    }, 100));
    
    // Fullscreen change handler to update dimensions
    document.addEventListener("fullscreenchange", () => {
      // Short delay to allow fullscreen to complete
      setTimeout(() => {
        checkFullscreenState();
        updateGameDimensions();
      }, 100);
    });
    
    document.addEventListener("webkitfullscreenchange", () => {
      setTimeout(() => {
        checkFullscreenState();
        updateGameDimensions();
      }, 100);
    });
  }
  
  /**
   * Check if the game is currently in fullscreen mode
   */
  function checkFullscreenState() {
    const wasFullscreen = isFullscreen;
    
    isFullscreen = !!document.fullscreenElement || 
                   !!document.webkitFullscreenElement ||
                   !!document.mozFullScreenElement ||
                   !!document.msFullscreenElement;
    
    // Update control state based on fullscreen
    isControlEnabled = isFullscreen;
    
    // If state changed, notify
    if (wasFullscreen !== isFullscreen) {
      if (eventCallbacks.onFullscreenChange) {
        eventCallbacks.onFullscreenChange(isFullscreen);
      }
      
      // On fullscreen change, force a complete resize
      if (isFullscreen) {
        // Slight delay to ensure proper transition
        setTimeout(() => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          updateGameDimensions(true); // Force update with reset
        }, 50);
      }
    }
  }
  
  /**
   * Reset the game state (paddles and ball)
   */
  /**
 * Reset the game state (paddles and ball)
  */
  function resetGame(config = {}) {
    console.log("Performing comprehensive game reset");
    
    // Store reference to essential data that should persist
    const preservedNickname = playerInfo.nickname;
    const preservedToken = playerInfo.token;
    
    // Default game configuration (vanilla settings)
    const defaultConfig = {
      rounds: 3,
      currentRounds: 0,
      speedIncrement: 0.5,
      paddleSpeed: 4.5,
      initialBallSpeed: 4,
      paddleSizeMultiplier: 1.0,
      ballColor: '#00d4ff',
      leftPaddleColor: '#007bff',
      rightPaddleColor: '#ff758c',
      gravityEnabled: false,
      gravityStrength: 0.1,
      bounceRandom: false
    };
    
    // Reset gameConfig to defaults first
    gameConfig = { ...defaultConfig };
    
    // Now apply any new config settings
    if (config) {
      gameConfig = { ...gameConfig, ...config };
    }
    
    // Reset player info (but preserve nickname and token)
    playerInfo = {
      nickname: preservedNickname,
      token: preservedToken
    };
    
    // Reset game objects
    resetGameState();
    
    // Reset AI state if it exists
    if (aiState) {
      aiState = {
        lastUpdateTime: 0,
        action: null,
        lastBallPosition: { x: 0, y: 0 },
        calculatedVelocity: { x: 0, y: 0 },
        decisionInterval: 1000,
        difficulty: 0.7
      };
    }
    
    // Reset control state
    isControlEnabled = true;
    
    // Reset fullscreen state
    isFullscreen = !!document.fullscreenElement || 
                   !!document.webkitFullscreenElement ||
                   !!document.mozFullScreenElement ||
                   !!document.msFullscreenElement;
    
    // Log reset completion
    console.log("Game reset complete with config:", gameConfig);
  }
  
  /**
   * Reset the game state (paddles and ball)
   */
  function resetGameState() {
    // Reset current rounds counter
    gameConfig.currentRounds = 0;
    
    // Calculate dimensions based on canvas size
    updateGameDimensions(true); // Force update with reset
    
    // Apply paddle size multiplier but maintain minimum size
    paddleHeight = Math.max(60, Math.floor(canvas.height * 0.2) * (gameConfig.paddleSizeMultiplier / 100));
    paddleWidth = Math.max(10, Math.floor(canvas.width * 0.02));
    
    // Ensure ball radius is set properly
    ballRadius = Math.max(5, Math.floor(Math.min(canvas.width, canvas.height) * 0.01));
    
    // Log dimensions for debugging
    console.log(`Game dimensions: canvas=${canvas.width}x${canvas.height}, paddle=${paddleWidth}x${paddleHeight}, ball=${ballRadius}`);
    
    // Reset paddles with explicit dimensions
    leftPaddle = { 
      x: paddleWidth * 2, 
      y: canvas.height / 2 - paddleHeight / 2,
      width: paddleWidth,
      height: paddleHeight
    };
    
    rightPaddle = { 
      x: canvas.width - (paddleWidth * 3), 
      y: canvas.height / 2 - paddleHeight / 2,
      width: paddleWidth,
      height: paddleHeight
    };
  
    // Reset ball
    resetBall();
    
    // Reset any other game-specific state here
    lastFrameTime = 0;
    speedScaleFactor = canvas.width / 800;
    speedScaleFactor = Math.max(0.3, Math.min(0.8, speedScaleFactor));
  }
  
  /**
   * Reset ball position and velocity
   */
  function resetBall() {
    const angle = Math.random() * Math.PI / 4 - Math.PI / 8;
    
    ball = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      radius: ballRadius,
      speed: gameConfig.initialBallSpeed * speedScaleFactor,
      vx: gameConfig.initialBallSpeed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1) * speedScaleFactor,
      vy: gameConfig.initialBallSpeed * Math.sin(angle) * speedScaleFactor
    };
  }
  
  /**
   * Update game dimensions based on canvas size
   * @param {boolean} forceReset - Force a complete reset of dimensions
   */
  function updateGameDimensions(forceReset = false) {
    // Check if we're in fullscreen mode
    checkFullscreenState();
    
    if (isFullscreen) {
      // Use window dimensions in fullscreen mode
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      console.log("Fullscreen mode - Canvas resized to:", canvas.width, canvas.height);
      
      // Calculate speed scale based on screen size
      // Use the larger dimension as reference
      const referenceDimension = Math.max(window.innerWidth, window.innerHeight);
      speedScaleFactor = referenceDimension / 1000; // Reference size of 1000px
      
      // Clamp the speed factor to avoid too slow or too fast motion
      speedScaleFactor = Math.max(0.5, Math.min(1.5, speedScaleFactor));
    } else {
      // In windowed mode, use client width but maintain aspect ratio
      const containerWidth = canvas.clientWidth;
      const aspectRatio = 16 / 9; // Standard game aspect ratio
      
      canvas.width = containerWidth;
      canvas.height = containerWidth / aspectRatio;
      console.log("Windowed mode - Canvas resized to:", canvas.width, canvas.height);
      
      // Reduce speed for smaller windows
      speedScaleFactor = canvas.width / 800; // Reference width of 800px for normal speed
      
      // Clamp the speed factor to avoid very slow motion
      speedScaleFactor = Math.max(0.3, Math.min(0.8, speedScaleFactor));
    }
    
    console.log("Speed scale factor:", speedScaleFactor);
    
    // Calculate game element dimensions based on new canvas size
    paddleWidth = Math.max(10, Math.floor(canvas.width * 0.02));
    paddleHeight = Math.max(60, Math.floor(canvas.height * 0.2));
    ballRadius = Math.max(5, Math.floor(Math.min(canvas.width, canvas.height) * 0.01));
    
    console.log("Ball radius updated to:", ballRadius);
    
    // Update paddle positions if they exist
    if (leftPaddle) {
      leftPaddle.x = paddleWidth * 2;
      leftPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, leftPaddle.y));
    }
    
    if (rightPaddle) {
      rightPaddle.x = canvas.width - (paddleWidth * 3);
      rightPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, rightPaddle.y));
    }
    
    // If ball exists, update it
    if (ball) {
      // Update ball radius
      ball.radius = ballRadius;
      
      // Keep ball in bounds
      ball.x = Math.min(Math.max(ball.radius, ball.x), canvas.width - ball.radius);
      ball.y = Math.min(Math.max(ball.radius, ball.y), canvas.height - ball.radius);
      
      // If forcing a reset, recalculate all ball properties
      if (forceReset) {
        // Center the ball
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
        
        // Scale ball speed with canvas size
        ball.speed = gameConfig.initialBallSpeed * speedScaleFactor;
        
        // Keep the same direction but adjust speed
        const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (currentSpeed > 0) {
          const direction = { 
            x: ball.vx / currentSpeed, 
            y: ball.vy / currentSpeed 
          };
          
          ball.vx = direction.x * ball.speed;
          ball.vy = direction.y * ball.speed;
        } else {
          // If no velocity, set a default
          const angle = Math.random() * Math.PI / 4 - Math.PI / 8;
          ball.vx = ball.speed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1);
          ball.vy = ball.speed * Math.sin(angle);
        }
      }
    }
    
    // Update paddle speed based on canvas size
    gameConfig.paddleSpeed = 4.5 * speedScaleFactor;
  }
  
  /**
   * Initialize AI for single player mode
   */
  function initAI() {
    aiState = {
      lastUpdateTime: 0,
      action: null,
      lastBallPosition: { x: 0, y: 0 },
      calculatedVelocity: { x: 0, y: 0 },
      decisionInterval: 1000, // 1 second between decisions
      difficulty: gameConfig.aiDifficulty || 0.7 // 0 to 1, higher is harder
    };
  }
  
  /**
   * Start the game
   */
  function start() {
    if (isRunning) {
      console.log("Game already running, ignoring start request");
      return;
    }
    
    console.log("Starting game");
    
    isRunning = true;
    
    // Ensure game state is fresh
    resetGameState();
    
    // Setup input handlers
    setupInputHandlers();
    
    // Start game loop
    lastFrameTime = performance.now();
    gameLoopId = requestAnimationFrame(gameLoop);
    
    // Trigger callback if provided
    if (eventCallbacks.onGameStart) {
      eventCallbacks.onGameStart();
    }
  }
  
  /**
   * Setup mouse/touch input handlers
   */
  function setupInputHandlers() {
    // Mouse movement handler
    const mouseMoveHandler = (e) => {
      if (!isRunning || !isControlEnabled) return;
      
      const rect = canvas.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      
      // Update left paddle position
      leftPaddle.y = mouseY - (paddleHeight / 2);
      leftPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, leftPaddle.y));
      
      // Send paddle position if in multiplayer mode
      if (isMultiplayer && eventCallbacks.onPaddleMove) {
        eventCallbacks.onPaddleMove(leftPaddle.y);
      }
    };
    
    // Touch handler for mobile
    const touchMoveHandler = (e) => {
      if (!isRunning || !isControlEnabled) return;
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const touchY = e.touches[0].clientY - rect.top;
      
      // Update left paddle position
      leftPaddle.y = touchY - (paddleHeight / 2);
      leftPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, leftPaddle.y));
      
      // Send paddle position if in multiplayer mode
      if (isMultiplayer && eventCallbacks.onPaddleMove) {
        eventCallbacks.onPaddleMove(leftPaddle.y);
      }
    };
    
    // Add event listeners
    canvas.addEventListener("mousemove", mouseMoveHandler);
    canvas.addEventListener("touchmove", touchMoveHandler, { passive: false });
    
    // Store reference to remove later
    inputHandlers = { mouseMoveHandler, touchMoveHandler };
  }
  
  /**
   * Remove input handlers
   */
  function removeInputHandlers() {
    if (inputHandlers) {
      canvas.removeEventListener("mousemove", inputHandlers.mouseMoveHandler);
      canvas.removeEventListener("touchmove", inputHandlers.touchMoveHandler);
    }
  }
  
  // Track time for smooth animation
  let lastFrameTime = 0;
  let inputHandlers = null;
  
  /**
   * Main game loop
   * @param {number} timestamp - Current animation frame timestamp
   */
  function gameLoop(timestamp) {
    if (!isRunning) return;
    
    // Calculate delta time for smooth animation
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    
    // Always update the game state (no pause)
    update(deltaTime / 16); // Normalize to ~60fps
    
    // Draw the game
    draw();
    
    // Continue loop
    gameLoopId = requestAnimationFrame(gameLoop);
  }
  
  /**
   * Update game state
   * @param {number} deltaFactor - Normalized time factor
   */
  function update(deltaFactor = 1) {

    
    // Move ball
    ball.x += ball.vx * deltaFactor;
    ball.y += ball.vy * deltaFactor;

    // Apply gravity if enabled
    if (gameConfig.gravityEnabled) {
      ball.vy += gameConfig.gravityStrength * deltaFactor;
    }

    
    // Wall collision (top/bottom)
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
      ball.vy = -ball.vy;
      
      if (gameConfig.bounceRandom) {
        const randomFactor = 0.3; // Maximum 30% variation
        ball.vy += (Math.random() * 2 - 1) * ball.speed * randomFactor;
        
        // Make sure the ball doesn't get stuck moving horizontally
        if (Math.abs(ball.vy) < ball.speed * 0.2) {
          ball.vy = (ball.vy > 0 ? 1 : -1) * ball.speed * 0.2;
        }
      }
      // Keep ball in bounds
      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
      } else {
        ball.y = canvas.height - ball.radius;
      }
    }
    
    // Paddle collision - left paddle
    if (ball.x - ball.radius < leftPaddle.x + paddleWidth &&
        ball.x + ball.radius > leftPaddle.x &&
        ball.y > leftPaddle.y && 
        ball.y < leftPaddle.y + paddleHeight) {
      
      // Calculate hit position relative to paddle center (0 = middle, -1 = top, 1 = bottom)
      const hitPos = (ball.y - (leftPaddle.y + paddleHeight/2)) / (paddleHeight/2);
      
      // Calculate deflection angle (max ±75 degrees)
      const maxAngle = Math.PI * 0.42; // ~75 degrees
      const deflectAngle = hitPos * maxAngle;
      
      // Increase ball speed
      ball.speed += gameConfig.speedIncrement * speedScaleFactor;
      
      // Update velocity components
      ball.vx = Math.abs(ball.speed * Math.cos(deflectAngle));
      ball.vy = ball.speed * Math.sin(deflectAngle);
      
      // Ensure minimum horizontal velocity
      ball.vx = Math.max(ball.vx, ball.speed * 0.5);
      
      // Move ball outside paddle to prevent multiple collisions
      ball.x = leftPaddle.x + paddleWidth + ball.radius;
    }
    
    // Paddle collision - right paddle
    if (ball.x + ball.radius > rightPaddle.x &&
        ball.x - ball.radius < rightPaddle.x + paddleWidth &&
        ball.y > rightPaddle.y && 
        ball.y < rightPaddle.y + paddleHeight) {
      
      // Calculate hit position relative to paddle center
      const hitPos = (ball.y - (rightPaddle.y + paddleHeight/2)) / (paddleHeight/2);
      
      // Calculate deflection angle
      const maxAngle = Math.PI * 0.42;
      const deflectAngle = hitPos * maxAngle;
      
      // Increase ball speed
      ball.speed += gameConfig.speedIncrement * speedScaleFactor;
      
      // Update velocity components (negative vx for left direction)
      ball.vx = -Math.abs(ball.speed * Math.cos(deflectAngle));
      ball.vy = ball.speed * Math.sin(deflectAngle);
      
      // Ensure minimum horizontal velocity
      ball.vx = Math.min(ball.vx, -ball.speed * 0.5);
      
      // Move ball outside paddle
      ball.x = rightPaddle.x - ball.radius;
    }
    
    // Scoring - ball off screen left/right
    if (ball.x + ball.radius < 0 || ball.x - ball.radius > canvas.width) {
      gameConfig.currentRounds++;
      
      // Notify about round completion
      if (eventCallbacks.onRoundComplete) {
        eventCallbacks.onRoundComplete(gameConfig.currentRounds);
      }
      
      // Check for game over
      if (gameConfig.currentRounds >= gameConfig.rounds) {
        if (eventCallbacks.onGameOver) {
          eventCallbacks.onGameOver(gameConfig.currentRounds);
        }
        stop();
        return;
      }
      
      // Reset ball for next round
      resetBall();
    }
    
    // Update AI paddle if in single player mode
    if (!isMultiplayer) {
      updateAIPaddle(deltaFactor);
    }
  }
  
  /**
   * Update AI paddle position based on ball trajectory
   * @param {number} deltaFactor - Normalized time factor
   */
  function updateAIPaddle(deltaFactor) {
    const now = Date.now();
    
    // Calculate current ball velocity
    aiState.calculatedVelocity.x = ball.x - aiState.lastBallPosition.x;
    aiState.calculatedVelocity.y = ball.y - aiState.lastBallPosition.y;
    
    // Only update decision periodically to simulate human reaction time
    if (now - aiState.lastUpdateTime >= aiState.decisionInterval) {
      aiState.lastUpdateTime = now;
      aiState.action = calculateAIAction();
      aiState.lastBallPosition.x = ball.x;
      aiState.lastBallPosition.y = ball.y;
    }
    
    // Apply the calculated action
    if (aiState.action === 'up') {
      rightPaddle.y -= gameConfig.paddleSpeed * deltaFactor;
    } else if (aiState.action === 'down') {
      rightPaddle.y += gameConfig.paddleSpeed * deltaFactor;
    }
    
    // Keep paddle in bounds
    rightPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, rightPaddle.y));
  }
  
  /**
   * Calculate AI paddle action based on ball trajectory
   * @returns {string|null} - 'up', 'down', or null
   */
  function calculateAIAction() {
    // If ball is moving away from AI paddle, return to center
    if (ball.vx < 0) {
      const paddleCenter = rightPaddle.y + paddleHeight / 2;
      const canvasCenter = canvas.height / 2;
      
      if (paddleCenter < canvasCenter - 20) {
        return 'down';
      } else if (paddleCenter > canvasCenter + 20) {
        return 'up';
      }
      return null;
    }
    
    // Calculate time until ball reaches paddle x-position
    const distanceToImpact = rightPaddle.x - ball.x;
    
    // Avoid division by zero
    if (ball.vx === 0) return null;
    
    const timeToImpact = distanceToImpact / ball.vx;
    
    // If ball is moving away, no action needed
    if (timeToImpact <= 0) return null;
    
    // Predict y position at impact
    let predictedY = ball.y + (ball.vy * timeToImpact);
    
    // Account for bounces off walls
    const bounces = Math.floor(predictedY / canvas.height);
    if (bounces % 2 === 1) {
      predictedY = canvas.height - (predictedY % canvas.height);
    } else {
      predictedY = predictedY % canvas.height;
    }
    
    // Add randomness based on difficulty
    // Lower difficulty = more randomness
    const randomFactor = (1 - aiState.difficulty) * paddleHeight * 0.8;
    const randomOffset = (Math.random() - 0.5) * randomFactor;
    predictedY += randomOffset;
    
    // If AI is exceptionally good, sometimes deliberately miss
    if (aiState.difficulty > 0.8 && Math.random() > 0.9) {
      // 10% chance to make a mistake at high difficulty
      predictedY += (Math.random() > 0.5 ? 1 : -1) * paddleHeight * 0.8;
    }
    
    // Calculate center of paddle and desired position
    const paddleCenter = rightPaddle.y + paddleHeight / 2;
    
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
   * Draw the game state
   */
  /**
 * Draw the game state
 */
  function draw() {
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
    
    // Calculate appropriate font size based on canvas width
    const fontSize = Math.max(12, Math.min(24, Math.floor(canvas.width / 40)));
    
    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(
      `${gameConfig.currentRounds} / ${gameConfig.rounds}`,
      canvas.width / 2,
      fontSize * 1.5
    );
    
    // Draw player name if available (below score)
    if (playerInfo.nickname) {
      ctx.fillText(
        playerInfo.nickname,
        canvas.width / 2,
        fontSize * 3
      );
    }
    
    // Draw ball
    ctx.fillStyle = gameConfig.ballColor;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Get paddle dimensions - ensure they exist
    const pWidth = leftPaddle.width || paddleWidth;
    const pHeight = leftPaddle.height || paddleHeight;
    
    // Draw paddles with rounded corners
    const cornerRadius = Math.min(5, pWidth / 2);
    
    // Draw left paddle
    ctx.fillStyle = gameConfig.leftPaddleColor;
    drawRoundedRect(leftPaddle.x, leftPaddle.y, pWidth, pHeight, cornerRadius);
    
    // Draw right paddle
    ctx.fillStyle = gameConfig.rightPaddleColor;
    drawRoundedRect(rightPaddle.x, rightPaddle.y, pWidth, pHeight, cornerRadius);
    
    // If control is disabled (minimized mode), show a notification
    if (!isControlEnabled) {
      drawControlDisabledNotification();
    }
  }
  
  /**
   * Draw notification for disabled controls
   */
  function drawControlDisabledNotification() {
    // Calculate a more noticeable size for the notification
    // Make the banner height proportional to canvas height but with minimum
    const bannerHeight = Math.max(40, Math.floor(canvas.height * 0.08));
    const fontSize = Math.max(16, Math.floor(bannerHeight * 0.5));
    
    // Semi-transparent background for the notification - full width banner
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, bannerHeight);
    
    // Add a bright border to make it more noticeable
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, bannerHeight);
    
    // Draw text
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'CLICK TO RETURN',
      canvas.width / 2,
      bannerHeight / 2
    );
  }
  
  /**
   * Helper function to draw rounded rectangles
   */
  function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill();
  }
  
  /**
   * Update remote paddle position (for multiplayer)
   * @param {number} y - Y position of remote paddle
   */
  /**
 * Update remote paddle position (for multiplayer)
 * @param {number} y - Y position of remote paddle
 */
  function updateRemotePaddle(y) {
    if (!isMultiplayer || !rightPaddle) return;
    
    // Ensure paddle height is properly initialized
    if (!paddleHeight || paddleHeight < 10) {
      console.log("Paddle height not properly initialized, recalculating");
      paddleHeight = Math.max(60, Math.floor(canvas.height * 0.2));
    }
    
    // Ensure rightPaddle has proper dimensions
    if (!rightPaddle.height) {
      rightPaddle.height = paddleHeight;
    }
    
    // Clamp the position to be within the canvas bounds
    rightPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, y));
    
    // For debugging - remove in production
    console.log(`Updated remote paddle to Y=${rightPaddle.y}, canvas height=${canvas.height}, paddle height=${paddleHeight}`);
  }
  
    /**
   * Stop the game
   */
  function stop() {
    console.log("Stopping game");
    
    isRunning = false;
    
    if (gameLoopId) {
      cancelAnimationFrame(gameLoopId);
      gameLoopId = null;
    }
    
    // Remove input handlers
    removeInputHandlers();
    
    // Call onGameEnd callback if provided
    if (eventCallbacks.onGameEnd) {
      eventCallbacks.onGameEnd();
    }
  }
  
  /**
   * Resize the game canvas
   */
  function resize() {
    updateGameDimensions(true); // Force a full reset of dimensions
  }
  
  /**
   * Get current game state
   * @returns {Object} - Game state object
   */
  function getState() {
    return {
      isRunning,
      isControlEnabled,
      isFullscreen,
      rounds: {
        current: gameConfig.currentRounds,
        target: gameConfig.rounds
      },
      ball: {
        x: ball.x,
        y: ball.y,
        vx: ball.vx,
        vy: ball.vy,
        speed: ball.speed,
        radius: ball.radius
      },
      paddles: {
        left: { ...leftPaddle },
        right: { ...rightPaddle }
      }
    };
  }
  
  /**
   * Set control enabled state
   * @param {boolean} enabled - New control state
   */
  function setControlEnabled(enabled) {
    isControlEnabled = enabled;
  }
  
  // Public API
  return {
    init,
    start,
    stop,
    resize,
    updateRemotePaddle,
    setDifficulty,
    getState,
    setControlEnabled
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PongGame;
}