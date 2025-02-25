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
        window.addEventListener('resize', resizeCanvas);
        
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
        
        // Main game loop
        function gameLoop() {
            updateGame();
            drawGame();
            requestAnimationFrame(gameLoop);
        }
        
        function updateGame() {
            // Update ball position
            ball.x += ball.velocityX;
            ball.y += ball.velocityY;
            
            // Ball collision with top and bottom walls
            if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
                ball.velocityY = -ball.velocityY;
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
            updateAIPaddle(leftPaddle, ball, -1);
            updateAIPaddle(rightPaddle, ball, 1);
        }
        
        function updateAIPaddle(paddle, ball, direction) {
            // Only move if the ball is coming towards this paddle
            if (Math.sign(ball.velocityX) === direction) {
                // Simple prediction of where ball will be when it reaches paddle's x position
                const distanceToTravel = direction > 0 ? 
                    paddle.x - ball.x : 
                    ball.x - paddle.x;
                
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
                paddle.y = Math.min(paddle.target, paddle.y + paddle.speed);
            } else if (paddle.y > paddle.target) {
                paddle.y = Math.max(paddle.target, paddle.y - paddle.speed);
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
            
            // Draw paddles
            ctx.fillStyle = '#007bff';
            ctx.fillRect(leftPaddle.x, leftPaddle.y, paddleWidth, paddleHeight);
            
            ctx.fillStyle = '#ff758c';
            ctx.fillRect(rightPaddle.x, rightPaddle.y, paddleWidth, paddleHeight);
            
            // Draw ball
            ctx.fillStyle = '#00d4ff';
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Start the game loop
        gameLoop();
    }
});