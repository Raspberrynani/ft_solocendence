/**
 * Background Animation Module
 * Creates an ambient Pong game animation as a background
 */
const BackgroundAnimation = (function() {
    // Private variables
    let canvas = null;
    let ctx = null;
    let gameLoopId = null;
    let lastFrameTime = 0;
    let isRunning = false;
    
    // Game objects
    let gameState = {
      paddleWidth: 10,
      paddleHeight: 60,
      
      leftPaddle: { 
        x: 0, 
        y: 0,
        speed: 3,
        target: 0
      },
      
      rightPaddle: { 
        x: 0, 
        y: 0,
        speed: 3,
        target: 0
      },
      
      ball: {
        x: 0,
        y: 0,
        radius: 5,
        speed: 3,
        vx: 3,
        vy: 3
      }
    };
    
    /**
     * Initialize the background animation
     * @returns {Function} - Cleanup function
     */
    function init() {
      // Create a background canvas that fills the entire window
      canvas = document.createElement('canvas');
      canvas.id = 'background-pong';
      
      // Apply styles to position it as a background
      Object.assign(canvas.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,  // Behind everything
        opacity: 0.3, // Semi-transparent
        backgroundColor: '#000'
      });
      
      document.body.insertBefore(canvas, document.body.firstChild);
      ctx = canvas.getContext('2d');
      
      // Set canvas to full window size
      resizeCanvas();
      
      // Handle window resize
      window.addEventListener('resize', debounce(resizeCanvas, 200));
      
      // Start the animation loop
      start();
      
      // Handle visibility changes to save CPU/battery
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      console.log("Background animation initialized");
      
      // Return cleanup function
      return cleanup;
    }
    
    /**
     * Start the animation
     */
    function start() {
      if (isRunning) return;
      
      isRunning = true;
      lastFrameTime = performance.now();
      gameLoopId = requestAnimationFrame(gameLoop);
      
      console.log("Background animation started");
    }
    
    /**
     * Stop the animation
     */
    function stop() {
      if (!isRunning) return;
      
      isRunning = false;
      
      if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
      }
      
      console.log("Background animation stopped");
    }
    
    /**
     * Resize the canvas to match window size
     */
    function resizeCanvas() {
      if (!canvas) return;
      
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Update game object sizes based on new dimensions
      gameState.paddleWidth = Math.max(10, Math.floor(canvas.width * 0.01));
      gameState.paddleHeight = Math.max(60, Math.floor(canvas.height * 0.15));
      
      // Update paddle positions
      gameState.leftPaddle.x = gameState.paddleWidth * 2;
      gameState.leftPaddle.y = canvas.height / 2 - gameState.paddleHeight / 2;
      
      gameState.rightPaddle.x = canvas.width - gameState.paddleWidth * 3;
      gameState.rightPaddle.y = canvas.height / 2 - gameState.paddleHeight / 2;
      
      // Update ball
      gameState.ball.radius = Math.max(5, Math.floor(Math.min(canvas.width, canvas.height) * 0.005));
      gameState.ball.x = canvas.width / 2;
      gameState.ball.y = canvas.height / 2;
      
      console.log("Background canvas resized");
    }
    
    /**
     * Handle visibility change event
     */
    function handleVisibilityChange() {
      if (document.hidden) {
        // Page is hidden, pause animation
        stop();
      } else {
        // Page is visible again, restart animation
        start();
      }
    }
    
    /**
     * Main game loop
     * @param {number} timestamp - Current animation frame timestamp
     */
    function gameLoop(timestamp) {
      if (!isRunning) return;
      
      // Calculate delta time
      const deltaTime = timestamp - lastFrameTime;
      lastFrameTime = timestamp;
      
      // Use fixed delta time if first frame or unreasonable delta
      const delta = (deltaTime > 0 && deltaTime < 100) ? deltaTime / 16.7 : 1;
      
      updateGame(delta);
      drawGame();
      
      // Continue loop
      gameLoopId = requestAnimationFrame(gameLoop);
    }
    
    /**
     * Update game state
     * @param {number} delta - Time factor for smooth animation
     */
    function updateGame(delta) {
      // Update ball position with delta time
      gameState.ball.x += gameState.ball.vx * delta;
      gameState.ball.y += gameState.ball.vy * delta;
      
      // Ball collision with top and bottom walls
      if (gameState.ball.y - gameState.ball.radius < 0 || 
          gameState.ball.y + gameState.ball.radius > canvas.height) {
        
        gameState.ball.vy = -gameState.ball.vy;
        
        // Keep ball in bounds
        if (gameState.ball.y - gameState.ball.radius < 0) {
          gameState.ball.y = gameState.ball.radius;
        } else {
          gameState.ball.y = canvas.height - gameState.ball.radius;
        }
      }
      
      // Determine which paddle to check for collision
      let currentPaddle = gameState.ball.vx < 0 ? gameState.leftPaddle : gameState.rightPaddle;
      
      // Check for collision with paddle
      if (
        gameState.ball.x - gameState.ball.radius < currentPaddle.x + gameState.paddleWidth && 
        gameState.ball.x + gameState.ball.radius > currentPaddle.x && 
        gameState.ball.y > currentPaddle.y && 
        gameState.ball.y < currentPaddle.y + gameState.paddleHeight
      ) {
        // Calculate hit position relative to the paddle center
        let hitPosition = (gameState.ball.y - (currentPaddle.y + gameState.paddleHeight/2)) / (gameState.paddleHeight/2);
        
        // Calculate reflection angle
        let bounceAngle = hitPosition * Math.PI/4;
        
        // Reverse x velocity and apply angle
        gameState.ball.vx = -gameState.ball.vx;
        
        // Apply angle to y velocity
        gameState.ball.vy = gameState.ball.speed * Math.sin(bounceAngle);
        
        // Slightly increase ball speed on hit
        gameState.ball.speed += 0.1;
      }
      
      // Reset ball if it goes past paddles
      if (gameState.ball.x - gameState.ball.radius > canvas.width || 
          gameState.ball.x + gameState.ball.radius < 0) {
        
        resetBall();
      }
      
      // AI for both paddles - predict ball movement
      updateAIPaddle(gameState.leftPaddle, gameState.ball, -1, delta);
      updateAIPaddle(gameState.rightPaddle, gameState.ball, 1, delta);
    }
    
    /**
     * Reset ball to center with random direction
     */
    function resetBall() {
      gameState.ball.x = canvas.width / 2;
      gameState.ball.y = canvas.height / 2;
      gameState.ball.speed = 3;
      
      // Random angle on reset
      let angle = Math.random() * Math.PI/4 - Math.PI/8;
      gameState.ball.vx = gameState.ball.speed * Math.cos(angle);
      
      // Random direction
      if (Math.random() > 0.5) {
        gameState.ball.vx = -gameState.ball.vx;
      }
      
      gameState.ball.vy = gameState.ball.speed * Math.sin(angle);
    }
    
    /**
     * Update AI paddle position
     * @param {Object} paddle - Paddle to update
     * @param {Object} ball - Ball object
     * @param {number} direction - Direction factor (1 or -1)
     * @param {number} delta - Time factor for smooth animation
     */
    function updateAIPaddle(paddle, ball, direction, delta) {
      // Only move if the ball is coming towards this paddle
      if (Math.sign(ball.vx) === direction) {
        // Simple prediction of where ball will be when it reaches paddle's x position
        const distanceToTravel = direction > 0 ? 
          paddle.x - ball.x : 
          ball.x - paddle.x;
        
        // Avoid division by zero
        if (Math.abs(ball.vx) < 0.1) return;
        
        const timeToImpact = distanceToTravel / Math.abs(ball.vx);
        
        // Predict y position at impact time
        const futureY = ball.y + (ball.vy * timeToImpact);
        
        // Calculate a target position with some randomness for imperfect AI
        paddle.target = futureY - (gameState.paddleHeight / 2) + (Math.random() * 20 - 10);
        
        // Add a delay factor to make the AI seem more human (only check every 15 frames)
        if (Math.random() > 0.93) {
          // Randomly miss sometimes
          paddle.target += (Math.random() > 0.7 ? 1 : -1) * gameState.paddleHeight * (Math.random() * 0.5);
        }
        
        // Constrain target to be within the canvas
        paddle.target = Math.max(0, Math.min(canvas.height - gameState.paddleHeight, paddle.target));
      }
      
      // Move paddle towards target with a smoothing effect
      if (paddle.y < paddle.target) {
        paddle.y = Math.min(paddle.target, paddle.y + paddle.speed * delta);
      } else if (paddle.y > paddle.target) {
        paddle.y = Math.max(paddle.target, paddle.y - paddle.speed * delta);
      }
      
      // Constrain paddle to canvas
      paddle.y = Math.max(0, Math.min(canvas.height - gameState.paddleHeight, paddle.y));
    }
    
    /**
     * Draw the game state
     */
    function drawGame() {
      if (!ctx) return;
      
      // Clear the canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.setLineDash([10, 15]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw paddles with rounded corners
      const cornerRadius = Math.min(5, gameState.paddleWidth / 2);
      
      // Draw left paddle
      ctx.fillStyle = '#007bff';
      drawRoundedRect(ctx, gameState.leftPaddle.x, gameState.leftPaddle.y, 
                     gameState.paddleWidth, gameState.paddleHeight, cornerRadius);
      
      // Draw right paddle
      ctx.fillStyle = '#ff758c';
      drawRoundedRect(ctx, gameState.rightPaddle.x, gameState.rightPaddle.y, 
                     gameState.paddleWidth, gameState.paddleHeight, cornerRadius);
      
      // Draw ball
      ctx.fillStyle = '#00d4ff';
      ctx.beginPath();
      ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    /**
     * Draw a rounded rectangle
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius
     */
    function drawRoundedRect(ctx, x, y, width, height, radius) {
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
     * Debounce function to limit frequent calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    function debounce(func, wait = 100) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
    
    /**
     * Clean up resources
     */
    function cleanup() {
      stop();
      
      // Remove event listeners
      window.removeEventListener('resize', debounce(resizeCanvas, 200));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Remove canvas
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      
      // Reset variables
      canvas = null;
      ctx = null;
      
      console.log("Background animation cleaned up");
    }
    
    // Public API
    return {
      init,
      start,
      stop
    };
  })();
  
  // Initialize the background animation when DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    BackgroundAnimation.init();
  });