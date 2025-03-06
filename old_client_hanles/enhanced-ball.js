/**
 * Enhanced Ball Dynamics
 * Adds player-specific ball variations and improvements
 */
(function() {
    // Track original ball update function
    let originalUpdateBall;
    
    // Ball variation settings
    const ballVariations = {
        player1: {
            speedMultiplier: 1.0,  // Base speed multiplier
            spinFactor: 1.0,       // How much the ball can curve
            colorShift: false,     // Whether ball color changes
            trailEffect: false,    // Whether to show trail effect
            particleEffect: false  // Whether to show particle effects
        },
        player2: {
            speedMultiplier: 1.0,
            spinFactor: 1.0,
            colorShift: false,
            trailEffect: false,
            particleEffect: false
        }
    };
    
    // Track which player hit the ball last
    let lastPlayerHit = 'player1';
    
    // Ball appearance and effects data
    const ballEffects = {
        trail: [],
        particles: [],
        baseColor: '#00d4ff',
        currentColor: '#00d4ff'
    };
    
    // Game state tracking (to handle minimized state)
    let isGameMinimized = false;
    let minimizedTimeAccumulator = 0;
    let lastFrameTime = 0;
    
    // Initialize the enhanced ball system
    function initEnhancedBall() {
        console.log("Initializing enhanced ball dynamics...");
        
        // Hook into PongGame to modify ball behavior
        hookPongGame();
        
        // Set up random ball variations
        setupRandomBallVariations();
    }
    
    // Hook into PongGame to override ball behavior
    function hookPongGame() {
        // Wait for PongGame to be available
        const checkInterval = setInterval(function() {
            if (!window.PongGame) return;
            
            clearInterval(checkInterval);
            console.log("Found PongGame - hooking ball functions");
            
            // Wait for game to start
            const gameStartCheck = setInterval(function() {
                // Access the update method
                if (typeof PongGame.update === 'function') {
                    clearInterval(gameStartCheck);
                    
                    // Store original update function
                    originalUpdateBall = PongGame.update;
                    
                    // Override update method
                    PongGame.update = function(deltaFactor) {
                        // Handle minimized state
                        if (isGameMinimized) {
                            handleMinimizedUpdate(deltaFactor);
                        } else {
                            // Get current ball state before update
                            const ballBefore = getBallState();
                            
                            // Call original update function
                            originalUpdateBall.call(this, deltaFactor);
                            
                            // Get ball state after update
                            const ballAfter = getBallState();
                            
                            // Check if ball hit a paddle
                            if (ballBefore && ballAfter) {
                                if (ballBefore.vx < 0 && ballAfter.vx > 0) {
                                    // Ball hit left paddle (player 1)
                                    lastPlayerHit = 'player1';
                                    applyBallVariation(lastPlayerHit, ballAfter);
                                } else if (ballBefore.vx > 0 && ballAfter.vx < 0) {
                                    // Ball hit right paddle (player 2)
                                    lastPlayerHit = 'player2';
                                    applyBallVariation(lastPlayerHit, ballAfter);
                                }
                            }
                            
                            // Update ball effects
                            updateBallEffects(deltaFactor);
                        }
                    };
                    
                    // Override draw method
                    const originalDraw = PongGame.draw;
                    PongGame.draw = function() {
                        // Call original draw
                        originalDraw.call(this);
                        
                        // Draw our custom ball effects
                        drawBallEffects();
                    };
                    
                    // Monitor fullscreen/minimize state
                    monitorGameState();
                    
                    console.log("Enhanced ball dynamics initialized");
                }
            }, 100);
        }, 100);
    }
    
    // Setup random variations for both players
    function setupRandomBallVariations() {
        // Player 1 variations
        ballVariations.player1 = {
            speedMultiplier: 1.0 + (Math.random() * 0.5),  // 1.0-1.5x
            spinFactor: 1.0 + (Math.random() * 1.0),       // 1.0-2.0x
            colorShift: Math.random() > 0.5,               // 50% chance
            trailEffect: Math.random() > 0.5,              // 50% chance
            particleEffect: Math.random() > 0.7            // 30% chance
        };
        
        // Player 2 variations - make different from player 1
        ballVariations.player2 = {
            speedMultiplier: 1.0 + (Math.random() * 0.5),
            spinFactor: 1.0 + (Math.random() * 1.0),
            colorShift: !ballVariations.player1.colorShift,
            trailEffect: !ballVariations.player1.trailEffect,
            particleEffect: Math.random() > 0.7
        };
        
        console.log("Ball variations:", ballVariations);
    }
    
    // Apply player-specific ball variations
    function applyBallVariation(player, ball) {
        if (!ball) return;
        
        const variation = ballVariations[player];
        if (!variation) return;
        
        // Store original ball color
        ballEffects.baseColor = ball.color || ballEffects.baseColor;
        
        // Apply speed multiplier (increase speed based on player's modifier)
        ball.speed *= variation.speedMultiplier;
        
        // Apply spin factor (adjust vertical velocity based on player's modifier)
        const spinAmount = (Math.random() - 0.5) * variation.spinFactor;
        ball.vy += ball.speed * spinAmount;
        
        // Apply color shift if enabled
        if (variation.colorShift) {
            // Generate a random color
            const hue = Math.floor(Math.random() * 360);
            ballEffects.currentColor = `hsl(${hue}, 70%, 60%)`;
        } else {
            // Reset to base color
            ballEffects.currentColor = ballEffects.baseColor;
        }
        
        // Clear previous effects
        ballEffects.trail = [];
        ballEffects.particles = [];
        
        console.log(`Applied ${player} ball variation`);
    }
    
    // Get the current ball state from PongGame
    function getBallState() {
        // Try to access ball state from PongGame
        if (PongGame && PongGame.getState) {
            const state = PongGame.getState();
            return state.ball;
        }
        return null;
    }
    
    // Update ball visual effects
    function updateBallEffects(deltaFactor) {
        const ball = getBallState();
        if (!ball) return;
        
        const variation = ballVariations[lastPlayerHit];
        if (!variation) return;
        
        // Update trail effect
        if (variation.trailEffect) {
            // Add current position to trail
            ballEffects.trail.unshift({
                x: ball.x,
                y: ball.y,
                radius: ball.radius,
                alpha: 0.8
            });
            
            // Limit trail length
            if (ballEffects.trail.length > 8) {
                ballEffects.trail.pop();
            }
            
            // Update trail alpha
            ballEffects.trail.forEach((point, index) => {
                point.alpha -= 0.1 * deltaFactor;
                if (point.alpha < 0) point.alpha = 0;
            });
        }
        
        // Update particle effects
        if (variation.particleEffect) {
            // Random chance to emit particles
            if (Math.random() > 0.7) {
                // Create new particle
                ballEffects.particles.push({
                    x: ball.x,
                    y: ball.y,
                    radius: ball.radius * 0.3,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    alpha: 0.7,
                    color: ballEffects.currentColor
                });
            }
            
            // Update particles
            for (let i = ballEffects.particles.length - 1; i >= 0; i--) {
                const particle = ballEffects.particles[i];
                
                // Move particle
                particle.x += particle.vx * deltaFactor;
                particle.y += particle.vy * deltaFactor;
                
                // Reduce alpha
                particle.alpha -= 0.03 * deltaFactor;
                
                // Remove faded particles
                if (particle.alpha <= 0) {
                    ballEffects.particles.splice(i, 1);
                }
            }
        }
    }
    
    // Draw ball effects
    function drawBallEffects() {
        const canvas = document.getElementById('pong-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const ball = getBallState();
        if (!ball) return;
        
        const variation = ballVariations[lastPlayerHit];
        if (!variation) return;
        
        // Draw trail effect
        if (variation.trailEffect && ballEffects.trail.length > 0) {
            ballEffects.trail.forEach((point, index) => {
                if (point.alpha <= 0) return;
                
                ctx.globalAlpha = point.alpha;
                ctx.fillStyle = ballEffects.currentColor;
                ctx.beginPath();
                ctx.arc(point.x, point.y, point.radius * (1 - index/10), 0, Math.PI * 2);
                ctx.fill();
            });
            
            // Reset global alpha
            ctx.globalAlpha = 1;
        }
        
        // Draw particle effects
        if (variation.particleEffect && ballEffects.particles.length > 0) {
            ballEffects.particles.forEach(particle => {
                ctx.globalAlpha = particle.alpha;
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                ctx.fill();
            });
            
            // Reset global alpha
            ctx.globalAlpha = 1;
        }
        
        // Redraw ball with current color if needed
        if (variation.colorShift) {
            // Redraw ball with current color
            ctx.fillStyle = ballEffects.currentColor;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Monitor game state to handle minimized mode
    function monitorGameState() {
        // Listen for visibility change
        document.addEventListener('visibilitychange', function() {
            isGameMinimized = document.hidden;
            console.log("Game minimized state:", isGameMinimized);
        });
        
        // Check fullscreen state
        document.addEventListener('fullscreenchange', function() {
            isGameMinimized = !document.fullscreenElement;
            console.log("Game minimized state:", isGameMinimized);
        });
        
        // Also poll game state periodically
        setInterval(function() {
            const ball = getBallState();
            if (ball) {
                // Game is active, update last frame time if needed
                if (lastFrameTime === 0) {
                    lastFrameTime = performance.now();
                }
            }
        }, 1000);
    }
    
    // Handle updates when game is minimized
    function handleMinimizedUpdate(deltaFactor) {
        // Calculate time passed since last update
        const now = performance.now();
        const timeDelta = now - lastFrameTime;
        lastFrameTime = now;
        
        // Accumulate time
        minimizedTimeAccumulator += timeDelta;
        
        // Update once per second at minimum
        if (minimizedTimeAccumulator > 1000) {
            // Calculate effective delta factor based on accumulated time
            const effectiveDelta = minimizedTimeAccumulator / 16.7; // Normalize to ~60fps
            
            // Call original update
            originalUpdateBall.call(PongGame, effectiveDelta);
            
            // Reset accumulator
            minimizedTimeAccumulator = 0;
            
            console.log("Applied minimized update with delta:", effectiveDelta);
        }
    }
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', initEnhancedBall);
})();