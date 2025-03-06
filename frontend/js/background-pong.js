
 // Game objects with default values (will be resized)
 let gameState = {
    canvas: { width: 1000, height: 600 },
    ball: { 
      x: 500, y: 300, radius: 8, 
      vx: 3, vy: 2, speed: 3,
      trail: [] // For motion blur effect
    },
    leftPaddle: {
      x: 30, y: 250, width: 12, height: 80,
      speed: 3.5, target: 250, reactionDelay: 50, lastMove: 0
    },
    rightPaddle: {
      x: 958, y: 250, width: 12, height: 80,
      speed: 3.5, target: 250, reactionDelay: 50, lastMove: 0
    },
    // Visual effects
    effects: {
      particles: [],
      glowIntensity: 0.5,
      trailLength: 5
    },
    // AI settings
    ai: {
      leftDifficulty: 0.95,  // 0-1, higher is better
      rightDifficulty: 0.95,
      randomness: 0.05,      // 0-1, higher is more random
      predictionError: 0.03, // 0-1, higher means more mistakes
      anticipation: true,    // Enables advanced position prediction
      lookAhead: 1.2,        // How far ahead AI predicts (multiplier)
      smoothingFactor: 0.6,  // Paddle movement smoothing (0-1, higher = smoother)
      targetMemory: []       // Stores recent target positions for smoothing
    }
  };
  
// Helper function to smoothly move paddle to target
function movePaddleToTarget(paddle, delta) {
    // Current distance to target
    const distanceToTarget = Math.abs(paddle.y - paddle.target);
    
    // Apply easing for smoother movement
    // Use a quadratic easing function for natural motion
    const normalizedDistance = Math.min(1, distanceToTarget / (paddle.height * 0.5));
    const easingMultiplier = normalizedDistance * (2 - normalizedDistance); // Quadratic ease out
    
    // Calculate smoothed movement step
    const moveDistance = paddle.speed * easingMultiplier * 60 * delta;
    
    // Apply movement with direction
    if (Math.abs(distanceToTarget) < 1) {
      // Snap to position when very close to eliminate micro-jitter
      paddle.y = paddle.target;
    } else if (paddle.y < paddle.target) {
      paddle.y += moveDistance;
      if (paddle.y > paddle.target) paddle.y = paddle.target; // Prevent overshooting
    } else if (paddle.y > paddle.target) {
      paddle.y -= moveDistance;
      if (paddle.y < paddle.target) paddle.y = paddle.target; // Prevent overshooting
    }
    
    // Ensure paddle stays in bounds
    paddle.y = Math.max(0, Math.min(gameState.canvas.height - paddle.height, paddle.y));
  }/**
 * Enhanced Background Pong Animation
 * Creates a smooth, responsive ambient background Pong game
 */
document.addEventListener("DOMContentLoaded", () => {
  // Create a background canvas that fills the entire window
  const bgCanvas = document.createElement('canvas');
  bgCanvas.id = 'background-pong';
  
  // Apply styles to position it as a background
  Object.assign(bgCanvas.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: -1,
    opacity: 0.3,
    backgroundColor: '#000',
    transition: 'opacity 0.5s ease'
  });
  
  document.body.insertBefore(bgCanvas, document.body.firstChild);
  const bgPong = initBackgroundPong(bgCanvas);
  
  // Handle visibility changes to save CPU/battery
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      bgCanvas.style.opacity = '0';
      bgPong.pause();
    } else {
      bgCanvas.style.opacity = '0.3';
      bgPong.resume();
    }
  });
});

function initBackgroundPong(canvas) {
  const ctx = canvas.getContext('2d');
  
      // Game state
  let animationFrameId = null;
  let isPaused = false;
  let lastFrameTime = 0;
  
  
  // Resize canvas and game objects
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Maintain aspect ratio with min dimensions
    gameState.canvas.width = canvas.width;
    gameState.canvas.height = canvas.height;
    
    // Scale factor based on reference dimensions
    const scaleX = canvas.width / 1000;
    const scaleY = canvas.height / 600;
    const scale = Math.min(scaleX, scaleY);
    
    // Scale paddles
    gameState.leftPaddle.width = Math.max(8, Math.round(12 * scale));
    gameState.leftPaddle.height = Math.max(40, Math.round(80 * scale));
    gameState.leftPaddle.x = Math.round(30 * scale);
    
    gameState.rightPaddle.width = gameState.leftPaddle.width;
    gameState.rightPaddle.height = gameState.leftPaddle.height;
    gameState.rightPaddle.x = canvas.width - gameState.leftPaddle.x - gameState.rightPaddle.width;
    
    // Scale ball
    gameState.ball.radius = Math.max(4, Math.round(8 * scale));
    
    // Scale speeds
    const speedScale = Math.max(0.5, Math.min(1.5, scale));
    gameState.ball.speed = 3 * speedScale;
    gameState.leftPaddle.speed = 3.5 * speedScale;
    gameState.rightPaddle.speed = 3.5 * speedScale;
    
    // Center the ball
    gameState.ball.x = canvas.width / 2;
    gameState.ball.y = canvas.height / 2;
    
    // Reset ball velocity with proper scaling
    const angle = Math.random() * Math.PI/4 - Math.PI/8;
    gameState.ball.vx = gameState.ball.speed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1);
    gameState.ball.vy = gameState.ball.speed * Math.sin(angle);
    
    // Center paddles
    gameState.leftPaddle.y = (canvas.height - gameState.leftPaddle.height) / 2;
    gameState.rightPaddle.y = (canvas.height - gameState.rightPaddle.height) / 2;
    
    // Update targets
    gameState.leftPaddle.target = gameState.leftPaddle.y;
    gameState.rightPaddle.target = gameState.rightPaddle.y;
    
    // Clear effects
    gameState.effects.particles = [];
    gameState.ball.trail = [];
  }
  
  // Set up initial sizes and event listeners
  resize();
  window.addEventListener('resize', debounce(resize, 200));
  
  // Game loop
  function gameLoop(timestamp) {
    if (isPaused) return;
    
    // Calculate delta time for smooth animation
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    
    // Skip frames if browser tab is inactive or huge lag
    if (deltaTime > 100) {
      animationFrameId = requestAnimationFrame(gameLoop);
      return;
    }
    
    // Convert to seconds for physics calcs
    const delta = deltaTime / 1000;
    
    // Update game state
    update(delta);
    
    // Render game
    render();
    
    // Continue loop
    animationFrameId = requestAnimationFrame(gameLoop);
  }
  
  // Update game state
  function update(delta) {
    // Store previous ball position for trail effect
    const prevX = gameState.ball.x;
    const prevY = gameState.ball.y;
    
    // Move ball with delta time
    gameState.ball.x += gameState.ball.vx * 60 * delta;
    gameState.ball.y += gameState.ball.vy * 60 * delta;
    
    // Update ball trail
    gameState.ball.trail.unshift({ x: prevX, y: prevY });
    if (gameState.ball.trail.length > gameState.effects.trailLength) {
      gameState.ball.trail.pop();
    }
    
    // Wall collision (top/bottom)
    if (gameState.ball.y - gameState.ball.radius < 0 || 
        gameState.ball.y + gameState.ball.radius > gameState.canvas.height) {
      
      gameState.ball.vy = -gameState.ball.vy;
      
      // Ensure ball stays in bounds
      if (gameState.ball.y - gameState.ball.radius < 0) {
        gameState.ball.y = gameState.ball.radius;
      } else {
        gameState.ball.y = gameState.canvas.height - gameState.ball.radius;
      }
      
      // Add bounce particles
      addBounceParticles(gameState.ball.x, gameState.ball.y, 0, -Math.sign(gameState.ball.vy));
    }
    
    // Paddle collision detection function
    function checkPaddleCollision(paddle, isLeftPaddle) {
      return (
        gameState.ball.x - gameState.ball.radius < paddle.x + paddle.width &&
        gameState.ball.x + gameState.ball.radius > paddle.x &&
        gameState.ball.y > paddle.y && 
        gameState.ball.y < paddle.y + paddle.height
      );
    }
    
    // Handle paddle collisions
    if (checkPaddleCollision(gameState.leftPaddle, true)) {
      // Calculate hit position relative to paddle center (-1 to 1)
      const hitPos = (gameState.ball.y - (gameState.leftPaddle.y + gameState.leftPaddle.height/2)) / 
                     (gameState.leftPaddle.height/2);
      
      // Calculate deflection angle (max 75 degrees)
      const maxAngle = Math.PI * 0.42; // ~75 degrees
      const deflectAngle = hitPos * maxAngle;
      
      // Increase ball speed slightly
      gameState.ball.speed += 0.1;
      
      // Update velocity components
      gameState.ball.vx = Math.abs(gameState.ball.speed * Math.cos(deflectAngle));
      gameState.ball.vy = gameState.ball.speed * Math.sin(deflectAngle);
      
      // Move ball outside paddle to prevent multiple collisions
      gameState.ball.x = gameState.leftPaddle.x + gameState.leftPaddle.width + gameState.ball.radius;
      
      // Add bounce particles
      addBounceParticles(gameState.ball.x, gameState.ball.y, 1, 0);
    }
    
    if (checkPaddleCollision(gameState.rightPaddle, false)) {
      // Calculate hit position relative to paddle center (-1 to 1)
      const hitPos = (gameState.ball.y - (gameState.rightPaddle.y + gameState.rightPaddle.height/2)) / 
                     (gameState.rightPaddle.height/2);
      
      // Calculate deflection angle (max 75 degrees)
      const maxAngle = Math.PI * 0.42; // ~75 degrees
      const deflectAngle = hitPos * maxAngle;
      
      // Increase ball speed slightly
      gameState.ball.speed += 0.1;
      
      // Update velocity components
      gameState.ball.vx = -Math.abs(gameState.ball.speed * Math.cos(deflectAngle));
      gameState.ball.vy = gameState.ball.speed * Math.sin(deflectAngle);
      
      // Move ball outside paddle to prevent multiple collisions
      gameState.ball.x = gameState.rightPaddle.x - gameState.ball.radius;
      
      // Add bounce particles
      addBounceParticles(gameState.ball.x, gameState.ball.y, -1, 0);
    }
    
    // Reset ball if it goes past paddles
    if (gameState.ball.x + gameState.ball.radius < 0 || 
        gameState.ball.x - gameState.ball.radius > gameState.canvas.width) {
      
      gameState.ball.x = gameState.canvas.width / 2;
      gameState.ball.y = gameState.canvas.height / 2;
      gameState.ball.speed = Math.max(3, gameState.ball.speed * 0.8); // Slow down a bit
      
      // Random angle on reset
      const angle = Math.random() * Math.PI/4 - Math.PI/8;
      gameState.ball.vx = gameState.ball.speed * Math.cos(angle);
      if (gameState.ball.x + gameState.ball.radius < 0) {
        gameState.ball.vx = Math.abs(gameState.ball.vx);
      } else {
        gameState.ball.vx = -Math.abs(gameState.ball.vx);
      }
      
      gameState.ball.vy = gameState.ball.speed * Math.sin(angle);
      gameState.ball.trail = []; // Reset trail
    }
    
    // Update AI paddles - with smoothing and periodic updates
    // Initialize target memory arrays if they don't exist
    if (!gameState.ai.targetMemory.left) {
      gameState.ai.targetMemory.left = [];
      gameState.ai.targetMemory.right = [];
    }
    
    // Update paddles less frequently to reduce jitter
    const updateFrequency = 4; // Only update every N frames (higher = smoother but less responsive)
    if (Math.floor(Date.now() / 20) % updateFrequency === 0) {
      // Left paddle updates
      updateAIPaddle(gameState.leftPaddle, gameState.ball, -1, delta, gameState.ai.leftDifficulty);
      
      // Right paddle updates
      updateAIPaddle(gameState.rightPaddle, gameState.ball, 1, delta, gameState.ai.rightDifficulty);
      
      // Additional predictive adjustments for more aggressive AI - only on certain frames
      if (Math.random() < 0.1) {
        // Predict multiple steps ahead for better positioning
        const futureBallX = gameState.ball.x + gameState.ball.vx * 1.5;
        const futureBallY = gameState.ball.y + gameState.ball.vy * 1.5;
        
        // Create a temporary ball object for prediction
        const futureBall = {
          x: futureBallX,
          y: futureBallY,
          vx: gameState.ball.vx,
          vy: gameState.ball.vy
        };
        
        // Run additional predictions with future ball position
        if (gameState.ball.vx < 0) { // Ball moving left
          updateAIPaddle(gameState.leftPaddle, futureBall, -1, delta, gameState.ai.leftDifficulty);
        } else { // Ball moving right
          updateAIPaddle(gameState.rightPaddle, futureBall, 1, delta, gameState.ai.rightDifficulty);
        }
      }
    } else {
      // On non-update frames, continue smooth movement to current target
      // This creates fluid motion without constant target recalculation
      movePaddleToTarget(gameState.leftPaddle, delta);
      movePaddleToTarget(gameState.rightPaddle, delta);
    }
    
    // Update particles
    updateParticles(delta);
  }
  
  // Enhanced AI paddle movement with advanced prediction and smoothing
  function updateAIPaddle(paddle, ball, direction, delta, difficulty) {
    const now = Date.now();
    
    // Only move if enough time has passed (reaction delay)
    if (now - paddle.lastMove < paddle.reactionDelay) return;
    
    // Update AI behavior based on ball direction and position
    const isBallApproaching = Math.sign(ball.vx) === direction;
    
    // Store previous target for smoothing
    const previousTarget = paddle.target;
    
    if (isBallApproaching) {
      // Calculate time until ball reaches paddle's x position
      const distanceX = Math.abs(paddle.x - ball.x);
      const timeToImpact = distanceX / Math.abs(ball.vx);
      
      // Enhanced prediction with look-ahead
      const lookAhead = gameState.ai.anticipation ? gameState.ai.lookAhead : 1.0;
      let predictedY = ball.y + (ball.vy * timeToImpact * lookAhead);
      
      // Advanced bounce prediction with multiple bounces
      let bounceCount = 0;
      let tempY = predictedY;
      
      // Calculate bounces more accurately
      while (tempY < 0 || tempY > gameState.canvas.height) {
        if (tempY < 0) {
          tempY = -tempY; // Reflect at top
        } else if (tempY > gameState.canvas.height) {
          tempY = 2 * gameState.canvas.height - tempY; // Reflect at bottom
        }
        bounceCount++;
        
        // Stop after too many bounces to prevent infinite loops
        if (bounceCount > 5) break;
      }
      predictedY = tempY;
      
      // AI intelligence factors
      // Add slight randomness based on difficulty
      const randomFactor = (1 - difficulty) * paddle.height * 0.6;
      const errorFactor = gameState.ai.predictionError * paddle.height * Math.sign(Math.random() - 0.5);
      
      // Higher difficulty = less randomness
      if (Math.random() > difficulty) {
        predictedY += randomFactor * (Math.random() - 0.5) + errorFactor;
      }
      
      // Strategic targeting - aim to hit with specific part of paddle
      // Higher difficulty = more strategic targeting
      if (Math.random() < difficulty * 0.8) {
        // Aim to hit with the edge of the paddle to create harder angles
        const edgeOffset = (paddle.height * 0.3) * (Math.random() > 0.5 ? 1 : -1);
        predictedY += edgeOffset * difficulty;
      }
      
      // Set raw target position
      const rawTarget = predictedY - (paddle.height / 2);
      
      // Ensure target is in bounds
      const boundedTarget = Math.max(0, Math.min(gameState.canvas.height - paddle.height, rawTarget));
      
      // Apply smoothing between previous target and new target
      // Smoothing factor controls how much we blend with previous target (0-1)
      // Higher values = smoother but less responsive
      const smoothingFactor = 0.6;
      paddle.target = previousTarget * smoothingFactor + boundedTarget * (1 - smoothingFactor);
      
      // Update last move time
      paddle.lastMove = now;
    } else {
      // Smarter behavior when ball is moving away
      // Sometimes keep position, sometimes return to center
      if (Math.random() < 0.3) {
        // Stay in current position
      } else {
        // Move towards strategic position (slightly off-center)
        const centerOffset = (Math.random() - 0.5) * gameState.canvas.height * 0.2;
        const rawTarget = (gameState.canvas.height - paddle.height) / 2 + centerOffset;
        
        // Apply smoothing for center movement too
        const smoothingFactor = 0.8; // Higher smoothing when moving to center
        paddle.target = previousTarget * smoothingFactor + rawTarget * (1 - smoothingFactor);
      }
    }
    
    // Ensure target is in bounds after smoothing
    paddle.target = Math.max(0, Math.min(gameState.canvas.height - paddle.height, paddle.target));
    
    // Intelligent movement speed based on distance
    const distanceToTarget = Math.abs(paddle.y - paddle.target);
    let speedMultiplier = 1.0;
    
    // Move faster when far from target, more precisely when close
    if (distanceToTarget > paddle.height) {
      speedMultiplier = 1.2; // Faster when far
    } else if (distanceToTarget < paddle.height * 0.2) {
      speedMultiplier = 0.7; // More precise when close
    }
    
    // Apply easing function for smoother movement
    // This creates acceleration/deceleration instead of constant speed
    const easingFactor = Math.min(1, distanceToTarget / (paddle.height * 0.5));
    const easedSpeed = paddle.speed * speedMultiplier * easingFactor;
    
    // Smoothly move towards target position with variable speed and easing
    const moveDistance = easedSpeed * 60 * delta;
    
    // Add slight interpolation for even smoother visual movement
    if (paddle.y < paddle.target) {
      paddle.y += moveDistance;
      if (paddle.y > paddle.target) paddle.y = paddle.target; // Prevent overshooting
    } else if (paddle.y > paddle.target) {
      paddle.y -= moveDistance;
      if (paddle.y < paddle.target) paddle.y = paddle.target; // Prevent overshooting
    }
    
    // Ensure paddle stays in bounds
    paddle.y = Math.max(0, Math.min(gameState.canvas.height - paddle.height, paddle.y));
  }
  
  // Add particles for bounce effects
  function addBounceParticles(x, y, dirX, dirY) {
    const particleCount = 4 + Math.floor(Math.random() * 4);
    
    for (let i = 0; i < particleCount; i++) {
      const speed = 60 + Math.random() * 120;
      const angle = Math.PI * 2 * Math.random();
      let vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed;
      
      // Bias direction based on bounce
      if (dirX !== 0) vx = Math.abs(vx) * dirX;
      if (dirY !== 0) vy = Math.abs(vy) * dirY;
      
      gameState.effects.particles.push({
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        radius: 1 + Math.random() * 2,
        life: 0.5 + Math.random() * 0.5, // seconds
        maxLife: 0.5 + Math.random() * 0.5,
        color: '#00d4ff'
      });
    }
  }
  
  // Update particle effects
  function updateParticles(delta) {
    for (let i = gameState.effects.particles.length - 1; i >= 0; i--) {
      const p = gameState.effects.particles[i];
      
      // Move particle
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      
      // Update life
      p.life -= delta;
      
      // Remove dead particles
      if (p.life <= 0) {
        gameState.effects.particles.splice(i, 1);
      }
    }
  }
  
  // Render the game
  function render() {
    // Clear canvas with slight motion blur
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.setLineDash([10, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw particles
    ctx.globalAlpha = 0.7;
    for (const p of gameState.effects.particles) {
      const opacity = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = opacity * 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Draw ball trail for motion blur effect
    if (gameState.ball.trail.length > 0) {
      for (let i = 0; i < gameState.ball.trail.length; i++) {
        const t = gameState.ball.trail[i];
        const alpha = 0.2 * (1 - i / gameState.ball.trail.length);
        
        ctx.fillStyle = `rgba(0, 212, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, gameState.ball.radius * (1 - i * 0.15), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Draw ball with glow effect
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add subtle glow to the ball
    const glow = gameState.effects.glowIntensity;
    const gradient = ctx.createRadialGradient(
      gameState.ball.x, gameState.ball.y, gameState.ball.radius,
      gameState.ball.x, gameState.ball.y, gameState.ball.radius * 2
    );
    gradient.addColorStop(0, `rgba(0, 212, 255, ${glow})`);
    gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw paddles with rounded corners
    const cornerRadius = Math.min(5, gameState.leftPaddle.width / 2);
    
    // Draw left paddle
    ctx.fillStyle = '#007bff';
    drawRoundedRect(
      ctx, 
      gameState.leftPaddle.x, 
      gameState.leftPaddle.y, 
      gameState.leftPaddle.width, 
      gameState.leftPaddle.height, 
      cornerRadius
    );
    
    // Draw right paddle
    ctx.fillStyle = '#ff758c';
    drawRoundedRect(
      ctx, 
      gameState.rightPaddle.x, 
      gameState.rightPaddle.y, 
      gameState.rightPaddle.width, 
      gameState.rightPaddle.height, 
      cornerRadius
    );
  }
  
  // Draw a rounded rectangle
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
  
  // Utility function: Debounce
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait);
    };
  }
  
  // Start the game loop
  animationFrameId = requestAnimationFrame(gameLoop);
  
  // Public API
  return {
    pause: () => {
      isPaused = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },
    resume: () => {
      if (isPaused) {
        isPaused = false;
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
      }
    },
    resize: resize
  };
}