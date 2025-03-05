/**
 * Background Pong Animation
 * Creates an ambient background Pong game animation
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
        zIndex: -1,  // Behind everything
        opacity: 0.3, // Semi-transparent
        backgroundColor: '#000'
    });
    
    document.body.insertBefore(bgCanvas, document.body.firstChild);
    
    // Initialize the background Pong game
    initBackgroundPong();
    
    function initBackgroundPong() {
        const canvas = document.getElementById('background-pong');
        const ctx = canvas.getContext('2d');
        
        // Set canvas to full window size
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        
        resizeCanvas();
        window.addEventListener('resize', Utils.debounce(resizeCanvas, 200));
        
        // Game objects
        const paddleWidth = Math.max(10, Math.floor(canvas.width * 0.01));
        const paddleHeight = Math.max(60, Math.floor(canvas.height * 0.15));
        
        let leftPaddle = { 
            x: paddleWidth * 2, 
            y: canvas.height / 2 - paddleHeight / 2,
            speed: 3,
            target: 0
        };
        
        let rightPaddle = { 
            x: canvas.width - paddleWidth * 3, 
            y: canvas.height / 2 - paddleHeight / 2,
            speed: 3,
            target: 0
        };
        
        let ball = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            radius: Math.max(5, Math.floor(canvas.width * 0.005)),
            speed: 3,
            velocityX: 3,
            velocityY: 3
        };
        
        let lastFrameTime = 0;
        let gameLoopId;
        
        // Main game loop
        function gameLoop(timestamp) {
            // Calculate delta time
            const deltaTime = timestamp - lastFrameTime;
            lastFrameTime = timestamp;
            
            // Use fixed delta time if first frame or unreasonable delta
            const delta = (deltaTime > 0 && deltaTime < 100) ? deltaTime / 16.7 : 1;
            
            updateGame(delta);
            drawGame();
            gameLoopId = requestAnimationFrame(gameLoop);
        }
        
        function updateGame(delta) {
            // Update ball position with delta time
            ball.x += ball.velocityX * delta;
            ball.y += ball.velocityY * delta;
            
            // Ball collision with top and bottom walls
            if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
                ball.velocityY = -ball.velocityY;
                
                // Keep ball in bounds
                if (ball.y - ball.radius < 0) {
                    ball.y = ball.radius;
                } else {
                    ball.y = canvas.height - ball.radius;
                }
            }
            
            // Determine which paddle to check for collision
            let currentPaddle = ball.velocityX < 0 ? leftPaddle : rightPaddle;
            
            // Check for collision with paddle
            if (
                ball.x - ball.radius < currentPaddle.x + paddleWidth && 
                ball.x + ball.radius > currentPaddle.x && 
                ball.y > currentPaddle.y && 
                ball.y < currentPaddle.y + paddleHeight
            ) {
                // Calculate hit position relative to the paddle center
                let hitPosition = (ball.y - (currentPaddle.y + paddleHeight/2)) / (paddleHeight/2);
                
                // Calculate reflection angle
                let bounceAngle = hitPosition * Math.PI/4;
                
                // Reverse x velocity and apply angle
                ball.velocityX = -ball.velocityX;
                
                // Apply a bit of the angle to the y velocity
                ball.velocityY = ball.speed * Math.sin(bounceAngle);
                
                // Slightly increase ball speed on hit
                ball.speed += 0.1;
            }
            
            // Reset ball if it goes past paddles
            if (ball.x - ball.radius > canvas.width || ball.x + ball.radius < 0) {
                ball.x = canvas.width / 2;
                ball.y = canvas.height / 2;
                ball.speed = 3;
                
                // Random angle on reset
                let angle = Math.random() * Math.PI/4 - Math.PI/8;
                ball.velocityX = ball.speed * Math.cos(angle);
                if (ball.x + ball.radius < 0) ball.velocityX = Math.abs(ball.velocityX);
                else ball.velocityX = -Math.abs(ball.velocityX);
                
                ball.velocityY = ball.speed * Math.sin(angle);
            }
            
            // AI for both paddles - predict ball movement
            updateAIPaddle(leftPaddle, ball, -1, delta);
            updateAIPaddle(rightPaddle, ball, 1, delta);
        }
        
        function updateAIPaddle(paddle, ball, direction, delta) {
            // Only move if the ball is coming towards this paddle
            if (Math.sign(ball.velocityX) === direction) {
                // Simple prediction of where ball will be when it reaches paddle's x position
                const distanceToTravel = direction > 0 ? 
                    paddle.x - ball.x : 
                    ball.x - paddle.x;
                
                // Avoid division by zero
                if (Math.abs(ball.velocityX) < 0.1) return;
                
                const timeToImpact = distanceToTravel / Math.abs(ball.velocityX);
                
                // Predict y position at impact time
                const futureY = ball.y + (ball.velocityY * timeToImpact);
                
                // Calculate a target position with some randomness for imperfect AI
                paddle.target = futureY - (paddleHeight / 2) + (Math.random() * 20 - 10);
                
                // Add a delay factor to make the AI seem more human (only check every 15 frames)
                if (Math.random() > 0.93) {
                    // Randomly miss sometimes
                    paddle.target += (Math.random() > 0.7 ? 1 : -1) * paddleHeight * (Math.random() * 0.5);
                }
                
                // Constrain target to be within the canvas
                paddle.target = Math.max(0, Math.min(canvas.height - paddleHeight, paddle.target));
            }
            
            // Move paddle towards target with a smoothing effect
            if (paddle.y < paddle.target) {
                paddle.y = Math.min(paddle.target, paddle.y + paddle.speed * delta);
            } else if (paddle.y > paddle.target) {
                paddle.y = Math.max(paddle.target, paddle.y - paddle.speed * delta);
            }
            
            // Constrain paddle to canvas
            paddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, paddle.y));
        }
        
        function drawGame() {
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
            const cornerRadius = Math.min(5, paddleWidth / 2);
            
            // Draw left paddle
            ctx.fillStyle = '#007bff';
            drawRoundedRect(ctx, leftPaddle.x, leftPaddle.y, paddleWidth, paddleHeight, cornerRadius);
            
            // Draw right paddle
            ctx.fillStyle = '#ff758c';
            drawRoundedRect(ctx, rightPaddle.x, rightPaddle.y, paddleWidth, paddleHeight, cornerRadius);
            
            // Draw ball
            ctx.fillStyle = '#00d4ff';
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
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
        
        // Start the game loop
        gameLoopId = requestAnimationFrame(gameLoop);
        
        // Handle visibility changes to save CPU/battery
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, pause animation
                cancelAnimationFrame(gameLoopId);
            } else {
                // Page is visible again, restart animation
                lastFrameTime = performance.now();
                gameLoopId = requestAnimationFrame(gameLoop);
            }
        });
        
        // Return cleanup function
        return function cleanup() {
            cancelAnimationFrame(gameLoopId);
            window.removeEventListener('resize', resizeCanvas);
        };
    }
});