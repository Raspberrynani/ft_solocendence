/**
 * Pong Renderer Module
 * Handles rendering the game to a canvas
 */
const PongRenderer = (function() {
    // Private variables
    let canvas = null;
    let ctx = null;
    let initialized = false;
    
    // Default visual settings
    let visualSettings = {
      // Colors
      ballColor: '#00d4ff',
      leftPaddleColor: '#007bff',
      rightPaddleColor: '#ff758c',
      backgroundColor: '#000000',
      centerLineColor: 'rgba(255, 255, 255, 0.2)',
      textColor: '#ffffff',
      
      // Visual effects
      paddleCornerRadius: 5,
      glowEffects: true,
      retroMode: false
    };
    
    // Text rendering settings
    let textSettings = {
      fontSize: 16,
      fontFamily: 'Arial, sans-serif',
      fontColor: '#ffffff'
    };
    
    /**
     * Initialize the renderer
     * @param {HTMLCanvasElement} canvasElement - Canvas to render on
     * @param {Object} options - Rendering options
     * @returns {Object} - Public API
     */
    function init(canvasElement, options = {}) {
      if (!canvasElement) {
        console.error("No canvas element provided to renderer");
        return null;
      }
      
      // Store canvas reference
      canvas = canvasElement;
      ctx = canvas.getContext('2d');
      
      // Apply options
      if (options.colors) {
        visualSettings = {
          ...visualSettings,
          ...options.colors
        };
      }
      
      // Set text settings based on canvas size
      updateTextSettings();
      
      initialized = true;
      console.log("Pong renderer initialized");
      
      return publicAPI;
    }
    
    /**
     * Update text settings based on canvas size
     */
    function updateTextSettings() {
      // Calculate appropriate font size based on canvas width
      textSettings.fontSize = Math.max(12, Math.min(24, Math.floor(canvas.width / 40)));
      textSettings.fontFamily = 'Arial, sans-serif';
    }
    
    /**
     * Render the game state to the canvas
     * @param {Object} gameState - Current game state
     * @param {Object} metadata - Additional display data (nickname, etc.)
     */
    function render(gameState, metadata = {}) {
      if (!initialized) {
        console.error("Renderer not initialized");
        return;
      }
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      ctx.fillStyle = visualSettings.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw center line
      drawCenterLine();
      
      // Draw score
      drawScore(gameState.rounds.current, gameState.rounds.target, metadata.nickname);
      
      // Draw ball
      drawBall(gameState.ball);
      
      // Draw paddles
      drawPaddle(gameState.leftPaddle, visualSettings.leftPaddleColor);
      drawPaddle(gameState.rightPaddle, visualSettings.rightPaddleColor);
      
      // Draw control disabled notification if specified
      if (metadata.controlsDisabled) {
        drawControlsDisabledNotification();
      }
    }
    
    /**
     * Set custom colors for rendering
     * @param {Object} colors - Color settings object
     */
    function setColors(colors) {
      visualSettings = {
        ...visualSettings,
        ...colors
      };
    }
    
    /**
     * Enable or disable retro visual mode
     * @param {boolean} enabled - Whether retro mode is enabled
     */
    function setRetroMode(enabled) {
      visualSettings.retroMode = enabled;
      
      if (enabled) {
        // Override colors with retro palette
        visualSettings.ballColor = '#ffffff';
        visualSettings.leftPaddleColor = '#ffffff';
        visualSettings.rightPaddleColor = '#ffffff';
        visualSettings.centerLineColor = 'rgba(255, 255, 255, 0.5)';
        visualSettings.glowEffects = false;
      } else {
        // Restore default colors
        visualSettings.ballColor = '#00d4ff';
        visualSettings.leftPaddleColor = '#007bff';
        visualSettings.rightPaddleColor = '#ff758c';
        visualSettings.centerLineColor = 'rgba(255, 255, 255, 0.2)';
        visualSettings.glowEffects = true;
      }
    }
    
    /**
     * Draw the center line on the canvas
     */
    function drawCenterLine() {
      ctx.strokeStyle = visualSettings.centerLineColor;
      ctx.setLineDash([5, 10]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    /**
     * Draw the game score
     * @param {number} currentRounds - Current rounds played
     * @param {number} targetRounds - Target rounds for the game
     * @param {string} nickname - Player nickname
     */
    function drawScore(currentRounds, targetRounds, nickname) {
      // Update text settings in case canvas size changed
      updateTextSettings();
      
      // Draw score
      ctx.fillStyle = visualSettings.textColor;
      ctx.font = `${textSettings.fontSize}px ${textSettings.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText(
        `${currentRounds} / ${targetRounds}`,
        canvas.width / 2,
        textSettings.fontSize * 1.5
      );
      
      // Draw player name if available
      if (nickname) {
        ctx.fillText(
          nickname,
          canvas.width / 2,
          textSettings.fontSize * 3
        );
      }
    }
    
    /**
     * Draw the ball
     * @param {Object} ball - Ball object with position and radius
     */
    function drawBall(ball) {
      ctx.fillStyle = visualSettings.ballColor;
      
      // Add glow effect if enabled
      if (visualSettings.glowEffects) {
        ctx.shadowColor = visualSettings.ballColor;
        ctx.shadowBlur = 10;
      }
      
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Reset shadow
      ctx.shadowBlur = 0;
    }
    
    /**
     * Draw a paddle
     * @param {Object} paddle - Paddle object with position and dimensions
     * @param {string} color - Paddle color
     */
    function drawPaddle(paddle, color) {
      ctx.fillStyle = color;
      
      // Add glow effect if enabled
      if (visualSettings.glowEffects) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 5;
      }
      
      // Calculate corner radius (smaller for smaller paddles)
      const cornerRadius = Math.min(visualSettings.paddleCornerRadius, paddle.width / 2);
      
      // Draw paddle with rounded corners
      drawRoundedRect(paddle.x, paddle.y, paddle.width, paddle.height, cornerRadius);
      
      // Reset shadow
      ctx.shadowBlur = 0;
    }
    
    /**
     * Draw a rounded rectangle
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {number} radius - Corner radius
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
     * Draw notification for disabled controls
     */
    function drawControlsDisabledNotification() {
      // Calculate a more noticeable size for the notification
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
     * Resize the renderer to match canvas dimensions
     */
    function resize() {
      // Update text settings for new size
      updateTextSettings();
    }
    
    // Public API
    const publicAPI = {
      init,
      render,
      setColors,
      setRetroMode,
      resize
    };
    
    return publicAPI;
  })();