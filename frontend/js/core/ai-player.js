/**
 * AI Player Module
 * Handles AI opponent logic for single-player mode
 */
const AIPlayer = (function() {
    // Private variables
    let config = {
      difficulty: 0.7,     // 0-1, higher is harder
      reactionTime: 1000,  // milliseconds between decisions
      predictionError: 0.2 // 0-1, lower means more accurate
    };
    
    let state = {
      lastUpdateTime: 0,
      lastBallPosition: { x: 0, y: 0 },
      calculatedVelocity: { x: 0, y: 0 },
      action: null,
      targetY: null
    };
    
    /**
     * Initialize the AI player
     * @param {Object} options - Configuration options
     * @returns {Object} - Public API
     */
    function init(options = {}) {
      // Apply custom options
      if (options.difficulty !== undefined) {
        config.difficulty = Math.max(0, Math.min(1, options.difficulty));
      }
      
      if (options.reactionTime !== undefined) {
        config.reactionTime = options.reactionTime;
      }
      
      if (options.predictionError !== undefined) {
        config.predictionError = options.predictionError;
      }
      
      // Reset state
      resetState();
      
      console.log("AI Player initialized with difficulty:", config.difficulty);
      
      return publicAPI;
    }
    
    /**
     * Reset the AI state
     */
    function resetState() {
      state = {
        lastUpdateTime: 0,
        lastBallPosition: { x: 0, y: 0 },
        calculatedVelocity: { x: 0, y: 0 },
        action: null,
        targetY: null
      };
    }
    
    /**
     * Update AI state and decide next action
     * @param {Object} gameState - Current game state
     * @param {number} deltaTime - Time since last update in ms
     * @returns {string|null} - Action to take ('up', 'down', or null)
     */
    function update(gameState, deltaTime) {
      const now = Date.now();
      
      // Calculate ball velocity
      state.calculatedVelocity.x = gameState.ball.x - state.lastBallPosition.x;
      state.calculatedVelocity.y = gameState.ball.y - state.lastBallPosition.y;
      
      // Only make new decisions periodically to simulate human reaction time
      if (now - state.lastUpdateTime >= config.reactionTime) {
        state.lastUpdateTime = now;
        state.action = calculateAction(gameState);
        state.lastBallPosition.x = gameState.ball.x;
        state.lastBallPosition.y = gameState.ball.y;
      }
      
      return state.action;
    }
    
    /**
     * Calculate the best action based on current game state
     * @param {Object} gameState - Current game state
     * @returns {string|null} - Action to take ('up', 'down', or null)
     */
    function calculateAction(gameState) {
      const paddle = gameState.rightPaddle;
      const ball = gameState.ball;
      
      // If ball is moving away from AI paddle, return to center
      if (ball.vx < 0) {
        const paddleCenter = paddle.y + paddle.height / 2;
        const canvasCenter = gameState.height / 2;
        
        if (paddleCenter < canvasCenter - 20) {
          return 'down';
        } else if (paddleCenter > canvasCenter + 20) {
          return 'up';
        }
        return null;
      }
      
      // Calculate time until ball reaches paddle x-position
      const distanceToImpact = paddle.x - ball.x;
      
      // Avoid division by zero
      if (Math.abs(ball.vx) < 0.1) return null;
      
      const timeToImpact = distanceToImpact / ball.vx;
      
      // If ball is moving away, no action needed
      if (timeToImpact <= 0) return null;
      
      // Predict y position at impact
      let predictedY = ball.y + (ball.vy * timeToImpact);
      
      // Account for bounces off walls
      const bounces = Math.floor(predictedY / gameState.height);
      if (bounces % 2 === 1) {
        predictedY = gameState.height - (predictedY % gameState.height);
      } else {
        predictedY = predictedY % gameState.height;
      }
      
      // Add randomness based on difficulty
      // Lower difficulty = more randomness
      const randomFactor = (1 - config.difficulty) * paddle.height * 0.8;
      const randomOffset = (Math.random() - 0.5) * randomFactor * config.predictionError;
      predictedY += randomOffset;
      
      // If AI is exceptionally good, sometimes deliberately miss
      if (config.difficulty > 0.8 && Math.random() > 0.9) {
        // 10% chance to make a mistake at high difficulty
        predictedY += (Math.random() > 0.5 ? 1 : -1) * paddle.height * 0.8;
      }
      
      // Store target for debugging/visualization
      state.targetY = predictedY;
      
      // Calculate center of paddle and desired position
      const paddleCenter = paddle.y + paddle.height / 2;
      
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
     * Set AI difficulty
     * @param {number} difficulty - Difficulty level (0-1)
     */
    function setDifficulty(difficulty) {
      config.difficulty = Math.max(0, Math.min(1, difficulty));
    }
    
    /**
     * Get current AI state (for debugging)
     * @returns {Object} - AI state
     */
    function getState() {
      return {
        ...state,
        config: { ...config }
      };
    }
    
    // Public API
    const publicAPI = {
      init,
      update,
      setDifficulty,
      getState,
      resetState
    };
    
    return publicAPI;
  })();
  
  // Support both module.exports and direct browser usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIPlayer;
  }