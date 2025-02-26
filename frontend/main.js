document.addEventListener("DOMContentLoaded", () => {
    // -----------------------------
    // 1) Grab UI elements up front
    // -----------------------------
    const languageSelector = document.getElementById("language-selector");
    const nicknameInput = document.getElementById("nickname");
    const roundsInput = document.getElementById("rounds-input");
    const startGameButton = document.getElementById("start-game");
    const leaderboardList = document.getElementById("leaderboard");
    const debugJoinButton = document.getElementById("debug-join");
    const playerNameDisplay = document.getElementById("overlay-player-name"); // overlay element
    const overlayScoreDisplay = document.getElementById("overlay-score"); // overlay element
    const endGameButton = document.getElementById("end-game");
    const waitingPlayersList = document.getElementById("waiting-players-list"); // <ul> for waiting players
    const windowSizeWarning = document.getElementById("window-size-warning"); // Window size warning banner

    const pongCanvas = document.getElementById("pong-canvas");
    const gameInfo = document.getElementById("game-info");

    // Some state variables
    let roundsPlayed = 0;
    let targetRounds = 3;
    let gameLoopId;
    let ws = null;                // <-- Our single WebSocket connection
    let gameToken = null;
    let nicknameGlobal = "";
    let isMultiplayer = false;
    let remotePaddleY = 0;
    let gameOverHandled = false;
    let isFullscreen = false;
    let isWindowSizeValid = false; // Track if the window size is valid for gameplay

    // -----------------------------
    // 2) UI "Pages" and navigation
    // -----------------------------
    function navigateTo(pageId) {
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        document.getElementById(pageId).classList.add("active");
        if (pageId === "leaderboard-page") {
            updateLeaderboard();
        }
    }
    window.navigateTo = navigateTo;

    // Show the initial page
    navigateTo("language-page");

    // Remove the window-size-warning element from the DOM completely
    const warningElement = document.getElementById("window-size-warning");
    if (warningElement) {
        warningElement.remove();
    }

    // Translations for a few user-visible strings
    const translations = {
        "en": {
            enterName: "Enter Your Nickname",
            waitingQueue: "Waiting in queue...",
            waitingOpponent: "Waiting for an opponent...",
            aiMode: "Playing with AI",
            minimizedWarning: "Game is minimized. Click to enlarge!"
        },
        "es": {
            enterName: "Ingrese su Apodo",
            waitingQueue: "Esperando en cola...",
            waitingOpponent: "Esperando a un oponente...",
            aiMode: "Jugando con IA",
            minimizedWarning: "Juego minimizado. ¡Haz clic para agrandar!"
        },
        "fr": {
            enterName: "Entrez votre pseudo",
            waitingQueue: "En attente dans la file...",
            waitingOpponent: "En attente d'un adversaire...",
            aiMode: "Jouer contre IA",
            minimizedWarning: "Jeu minimisé. Cliquez pour agrandir!"
        }
    };

    // ------------------------------------------
    // 3) WebSocket: connect as soon as we load
    // ------------------------------------------
    // This way, we always join the "lobby" group
    // and receive real-time waiting list updates.
    ws = new WebSocket("ws://127.0.0.1:8000/ws/pong/");
    ws.onopen = () => {
        console.log("WebSocket connected to lobby (for waiting list)");
        // We do NOT send `type: "join"` yet. Only do that on "Classic with queue."
    };
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WebSocket message:", data);

        if (data.type === "queue_update") {
            document.getElementById("pong-status").innerText = data.message;
        } else if (data.type === "start_game") {
            document.getElementById("pong-status").innerText = "";
            if (data.rounds) {
                targetRounds = data.rounds;
                document.getElementById("target-rounds").innerText = targetRounds;
            }
            startPongGame();
        } else if (data.type === "waiting_list") {
            // Real-time updates of who is in the waiting list
            console.log("Received waiting list:", data.waiting_list);
            updateWaitingList(data.waiting_list);
        } else if (data.type === "game_update") {
            // Opponent's paddle position
            if (data.data && data.data.paddleY !== undefined) {
                remotePaddleY = data.data.paddleY;
            }
        } else if (data.type === "game_over") {
            if (!gameOverHandled) {
                gameOverHandled = true;
                endPongGame();
            }
        } else if (data.type === "opponent_left") {
            alert(data.message);
            navigateTo("game-page");
        }
    };
    ws.onerror = (error) => console.error("WebSocket error:", error);
    ws.onclose = () => console.log("WebSocket closed");

    // -----------------------------
    // 4) Language UI
    // -----------------------------
    languageSelector.addEventListener("change", () => {
        document.getElementById("enter-name").innerText = translations[languageSelector.value].enterName;
    });

    // -----------------------------
    // 5) Nickname input
    // -----------------------------
    nicknameInput.addEventListener("input", () => {
        if (nicknameInput.value.trim().length > 0) {
            startGameButton.classList.remove("hidden");
            startGameButton.style.opacity = "0";
            
            requestAnimationFrame(() => {
                startGameButton.style.transition = "opacity 0.5s ease-in-out";
                requestAnimationFrame(() => {
                    startGameButton.style.opacity = "1";
                    startGameButton.style.pointerEvents = "auto";
                });
            });
        } else {
            startGameButton.style.transition = "opacity 0.5s ease-in-out";
            startGameButton.style.opacity = "0";
            startGameButton.style.pointerEvents = "none";
            
            setTimeout(() => {
                if (nicknameInput.value.trim().length === 0) {
                    startGameButton.classList.add("hidden");
                }
            }, 500);
        }
    });

    // -----------------------------
    // 6) Game mode selection
    // -----------------------------
    const gameModes = ["Classic with queue", "Classic with AI", "Unimplemented"];
    let currentGameModeIndex = 0;
    function updateGameModeIndicator() {
        document.querySelector(".game-mode-indicator").innerText = gameModes[currentGameModeIndex];
    }
    updateGameModeIndicator();

    document.getElementById("prevMode").addEventListener("click", () => {
        currentGameModeIndex = (currentGameModeIndex - 1 + gameModes.length) % gameModes.length;
        updateGameModeIndicator();
    });
    document.getElementById("nextMode").addEventListener("click", () => {
        currentGameModeIndex = (currentGameModeIndex + 1) % gameModes.length;
        updateGameModeIndicator();
    });

    // -----------------------------
    // 7) Minimization / Fullscreen
    // -----------------------------
    const minimizedWarning = document.createElement("div");
    minimizedWarning.id = "minimized-warning";
    minimizedWarning.className = "minimized-warning hidden";
    // Append directly to body instead of the pong-page for proper fixed positioning
    document.body.appendChild(minimizedWarning);

    function updateMinimizedWarning() {
        const currentLang = languageSelector.value;
        minimizedWarning.innerText = translations[currentLang].minimizedWarning;
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    function handleFullscreenChange() {
        isFullscreen = !!document.fullscreenElement;
        if (!isFullscreen) {
            updateMinimizedWarning();
            minimizedWarning.classList.remove("hidden");
            showGameInfo(true);
        } else {
            minimizedWarning.classList.add("hidden");
            showGameInfo(false);
        }
    }

    function showGameInfo(showSmall) {
        if (showSmall) {
            gameInfo.classList.add("visible");
        } else {
            gameInfo.classList.remove("visible");
        }
    }

    // Also allow tapping the canvas or the warning to re-enter fullscreen
    pongCanvas.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            if (pongCanvas.requestFullscreen) {
                pongCanvas.requestFullscreen();
            } else if (pongCanvas.webkitRequestFullscreen) {
                pongCanvas.webkitRequestFullscreen();
            }
        }
    });
    minimizedWarning.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            if (pongCanvas.requestFullscreen) {
                pongCanvas.requestFullscreen();
            } else if (pongCanvas.webkitRequestFullscreen) {
                pongCanvas.webkitRequestFullscreen();
            }
        }
    });

    // -----------------------------
    // 8) Start Game Button
    // -----------------------------
    startGameButton.addEventListener("click", async () => {
        const nickname = nicknameInput.value.trim();
        if (!nickname) {
            alert("Please enter a nickname!");
            return;
        }
        const validNickname = /^[A-Za-z]{1,16}$/;
        if (!validNickname.test(nickname)) {
            alert("This nickname is too cool to be used here!");
            return;
        }
        
        nicknameGlobal = nickname;
        playerNameDisplay.innerText = nickname;
        document.getElementById("player-name").innerText = nickname; // Update in-game info
        roundsPlayed = 0;
        overlayScoreDisplay.innerText = roundsPlayed;
        document.getElementById("player-rounds").innerText = roundsPlayed; // Update in-game rounds
        targetRounds = parseInt(roundsInput.value) || 3;
        document.getElementById("target-rounds").innerText = targetRounds; // Update target rounds

        const selectedMode = gameModes[currentGameModeIndex];
        if (selectedMode === "Unimplemented") {
            alert("This game mode is not yet implemented!");
            return;
        } else if (selectedMode === "Classic with AI") {
            isMultiplayer = false;
            navigateTo("pong-page");
            document.getElementById("pong-status").innerText = translations[languageSelector.value].aiMode;
            startPongGame();
        } else if (selectedMode === "Classic with queue") {
            isMultiplayer = true;
            // Here is where we actually "join" the queue, using the
            // same WebSocket we opened on page load:
            gameToken = Math.random().toString(36).substring(2);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "join",
                    nickname,
                    token: gameToken,
                    rounds: targetRounds
                }));
            }
            navigateTo("pong-page");
            document.getElementById("pong-status").innerText = translations[languageSelector.value].waitingQueue;
        }
    });

    // Debug button if needed
    debugJoinButton.addEventListener("click", () => {
        startPongGame();
    });

    // -----------------------------
    // 9) Updating the waiting list
    // -----------------------------
    // Single function used by both the menu page and
    // real-time waiting_list updates from the server:
    function updateWaitingList(waitingList) {
        console.log("Updating waiting list UI with:", waitingList);
        waitingPlayersList.innerHTML = "";

        if (!waitingList || waitingList.length === 0) {
            const li = document.createElement("li");
            li.innerText = "No players waiting";
            li.classList.add("no-players");
            waitingPlayersList.appendChild(li);
            return;
        }

        // Make sure we're using the right elements
        const roundsInputElement = document.getElementById("rounds-input");
        const nicknameInputElement = document.getElementById("nickname");
        const startGameButtonElement = document.getElementById("start-game");

        waitingList.forEach(player => {
            const li = document.createElement("li");
            li.className = "list-group-item clickable-player";
            li.innerHTML = `<span class="player-name">${player.nickname}</span> <span class="player-rounds">(Rounds: ${player.rounds})</span>`;
            
            // Add click handler directly on the element
            li.onclick = function() {
                console.log("Player clicked:", player);
                
                // Set the rounds input value
                roundsInputElement.value = player.rounds;
                
                // Force UI update for the game mode
                currentGameModeIndex = 0; // Set to "Classic with queue"
                updateGameModeIndicator();
                
                // Highlight the rounds input briefly to show it was updated
                roundsInputElement.classList.add("highlight-input");
                setTimeout(() => {
                    roundsInputElement.classList.remove("highlight-input");
                }, 1000);
                
                // Focus on the start game button or nickname input
                if (nicknameInputElement.value.trim().length > 0) {
                    if (!startGameButtonElement.classList.contains("hidden")) {
                        startGameButtonElement.classList.add("pulse");
                        setTimeout(() => {
                            startGameButtonElement.classList.remove("pulse");
                        }, 1500);
                    }
                } else {
                    nicknameInputElement.focus();
                }
            };
            
            waitingPlayersList.appendChild(li);
        });
    }

    // -----------------------------
    // 10) Leaderboard fetch
    // -----------------------------
    async function updateLeaderboard() {
        try {
            const response = await fetch("http://127.0.0.1:8000/api/entries/");
            const data = await response.json();
            leaderboardList.innerHTML = "";
            data.entries.sort((a, b) => b.wins - a.wins);
            data.entries.forEach(entry => {
                const li = document.createElement("li");
                li.innerText = `${entry.name} - Wins: ${entry.wins}`;
                leaderboardList.appendChild(li);
            });
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
        }
    }

    // ---------------------------------------------
    // 11) Pong game logic (both AI and multiplayer)
    // ---------------------------------------------
    function startPongGame() {
        // Request fullscreen if not already
        if (!document.fullscreenElement) {
            if (pongCanvas.requestFullscreen) {
                pongCanvas.requestFullscreen();
            } else if (pongCanvas.webkitRequestFullscreen) {
                pongCanvas.webkitRequestFullscreen();
            }
        }
        // CRT zoom effect
        pongCanvas.classList.remove("crt-zoom");
        void pongCanvas.offsetWidth;
        pongCanvas.classList.add("crt-zoom");

        pongCanvas.width = window.innerWidth;
        pongCanvas.height = window.innerHeight;
        endGameButton.classList.remove("hidden");

        // Update info
        document.getElementById("player-name").innerText = nicknameGlobal;
        document.getElementById("player-rounds").innerText = roundsPlayed;
        document.getElementById("target-rounds").innerText = targetRounds;

        gameOverHandled = false;
        initPongGame();
    }

    endGameButton.addEventListener("click", () => {
        endPongGame();
    });

    async function endPongGame() {
        cancelAnimationFrame(gameLoopId);
        // For both AI and multiplayer mode, handle game ending
        if (isMultiplayer) {
            try {
                const response = await fetch("http://127.0.0.1:8000/api/end_game/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nickname: nicknameGlobal, token: gameToken, score: roundsPlayed })
                });
                if (response.ok) {
                    alert("Game ended and win recorded!");
                } else {
                    alert("Failed to record win!");
                }
            } catch (error) {
                console.error("Error ending game:", error);
            }
        }
        // Exit fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        minimizedWarning.classList.add("hidden");
        endGameButton.classList.add("hidden");
        navigateTo("leaderboard-page");
    }

    // NEW FUNCTION: calculateAIAction for improved AI decision making
    function calculateAIAction(paddle, ball, ballVelocity, paddleHeight) {
        // If ball is moving away from the AI paddle, just center paddle
        if (ballVelocity.x < 0) {
            const paddleCenter = paddle.y + paddleHeight / 2;
            const canvasCenter = pongCanvas.height / 2;
            
            if (paddleCenter < canvasCenter - 20) {
                return 'down';
            } else if (paddleCenter > canvasCenter + 20) {
                return 'up';
            }
            return null; // No action needed
        }
        
        // Ball is moving toward AI paddle, try to predict
        // Calculate time to impact based on x distance and velocity
        const distanceToImpact = paddle.x - ball.x;
        
        // Avoid division by zero
        if (ballVelocity.x === 0) return null;
        
        const timeToImpact = distanceToImpact / ballVelocity.x;
        
        // If negative time, ball is moving away
        if (timeToImpact <= 0) return null;
        
        // Predict y position of ball at impact
        let predictedY = ball.y + (ballVelocity.y * timeToImpact);
        
        // Account for ball bouncing off walls
        const bounces = Math.floor(predictedY / pongCanvas.height);
        if (bounces % 2 === 1) {
            // Odd number of bounces
            predictedY = pongCanvas.height - (predictedY % pongCanvas.height);
        } else {
            // Even number of bounces
            predictedY = predictedY % pongCanvas.height;
        }
        
        // Add some randomness to make AI imperfect
        const randomOffset = (Math.random() - 0.5) * paddleHeight * 0.5;
        predictedY += randomOffset;
        
        // Calculate target position
        const targetY = predictedY - paddleHeight / 2;
        const currentCenter = paddle.y + paddleHeight / 2;
        
        // Determine action based on target position
        const tolerance = 10; // Tolerance to avoid jitter
        
        if (currentCenter < targetY - tolerance) {
            return 'down';
        } else if (currentCenter > targetY + tolerance) {
            return 'up';
        }
        
        return null; // No action needed, already aligned
    }

    function initPongGame() {
        const ctx = pongCanvas.getContext("2d");
        pongCanvas.width = pongCanvas.clientWidth;
        pongCanvas.height = pongCanvas.clientHeight;
    
        // These variables need to be accessible throughout the function
        let paddleWidth = Math.max(10, Math.floor(pongCanvas.width * 0.02));
        let paddleHeight = Math.max(60, Math.floor(pongCanvas.height * 0.2));
        let ballRadius = Math.max(5, Math.floor(Math.min(pongCanvas.width, pongCanvas.height) * 0.01));    
        
        // Calculate initial paddle positions
        let leftPaddle = { 
            x: paddleWidth * 2, 
            y: pongCanvas.height / 2 - paddleHeight / 2 
        };
        
        let rightPaddle = { 
            x: pongCanvas.width - (paddleWidth * 3), 
            y: pongCanvas.height / 2 - paddleHeight / 2 
        };
    
        let ball = {
            x: pongCanvas.width / 2,
            y: pongCanvas.height / 2,
            radius: ballRadius,
            speed: Math.max(4, Math.floor(pongCanvas.width * 0.005)),
            angle: Math.random() * Math.PI / 4 - Math.PI / 8
        };
        
        ball.vx = ball.speed * Math.cos(ball.angle);
        ball.vy = ball.speed * Math.sin(ball.angle);
        
        const speedIncrement = 0.5;
    
        // AI state tracking
        let aiState = {
            lastUpdateTime: 0,
            action: null, // 'up', 'down', or null
            lastBallPosition: { x: ball.x, y: ball.y },
            decisionInterval: 1000 // 1 second interval between decisions
        };
    
        // Function to update game dimensions and positions
        function updateGameDimensions() {
            // Update paddle dimensions based on new canvas size
            paddleWidth = Math.max(10, Math.floor(pongCanvas.width * 0.02));
            paddleHeight = Math.max(60, Math.floor(pongCanvas.height * 0.2));
            ballRadius = Math.max(5, Math.floor(Math.min(pongCanvas.width, pongCanvas.height) * 0.01));
            
            // Critical fix: Always recalculate the right paddle's X position
            leftPaddle.x = paddleWidth * 2;
            rightPaddle.x = pongCanvas.width - (paddleWidth * 3);
            
            // Constrain paddles to canvas
            leftPaddle.y = Math.max(0, Math.min(pongCanvas.height - paddleHeight, leftPaddle.y));
            rightPaddle.y = Math.max(0, Math.min(pongCanvas.height - paddleHeight, rightPaddle.y));
        }
    
        let mouseMoveHandler = (e) => {
            const rect = pongCanvas.getBoundingClientRect();
            // Get the mouse position relative to the canvas
            const mouseY = e.clientY - rect.top;
            
            // Calculate paddle position, keeping it centered on the cursor
            leftPaddle.y = mouseY - (paddleHeight / 2);
            
            // Constrain paddle to canvas
            leftPaddle.y = Math.max(0, Math.min(pongCanvas.height - paddleHeight, leftPaddle.y));
            
            if (isMultiplayer && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "game_update",
                    data: { paddleY: leftPaddle.y }
                }));
            }
        };
    
        // Add the event listener to both canvas and window
        pongCanvas.addEventListener("mousemove", mouseMoveHandler);
        window.addEventListener("mousemove", mouseMoveHandler);
        
        // Resize handler that updates all game elements
        window.addEventListener('resize', () => {
            if (document.fullscreenElement) {
                pongCanvas.width = window.innerWidth;
                pongCanvas.height = window.innerHeight;
                updateGameDimensions();
            }
        });
        
        // Fullscreen change handler
        document.addEventListener("fullscreenchange", () => {
            // Short delay to allow fullscreen to complete
            setTimeout(() => {
                if (document.fullscreenElement) {
                    pongCanvas.width = window.innerWidth;
                    pongCanvas.height = window.innerHeight;
                    updateGameDimensions();
                }
                // Reset paddle position to middle of screen height when changing display modes
                leftPaddle.y = pongCanvas.height / 2 - paddleHeight / 2;
                rightPaddle.y = pongCanvas.height / 2 - paddleHeight / 2;
            }, 100);
        });
    
        function gameLoop() {
            update();
            draw();
            overlayScoreDisplay.innerText = roundsPlayed;
            document.getElementById("player-rounds").innerText = roundsPlayed;
            gameLoopId = requestAnimationFrame(gameLoop);
        }
        gameLoop();
    
        function update() {
            ball.x += ball.vx;
            ball.y += ball.vy;
    
            if (ball.y - 7 < 0 || ball.y + 7 > pongCanvas.height) {
                ball.vy = -ball.vy;
            }
    
            // Collision with left paddle
            if (ball.x - 7 < leftPaddle.x + paddleWidth &&
                ball.y > leftPaddle.y && ball.y < leftPaddle.y + paddleHeight) {
                let hitPos = (ball.y - leftPaddle.y) / paddleHeight;
                let reflectAngle = (hitPos - 0.5) * Math.PI / 2;
                ball.speed += speedIncrement;
                ball.vx = ball.speed * Math.cos(reflectAngle);
                ball.vy = ball.speed * Math.sin(reflectAngle);
                if (ball.vx < 0) ball.vx = -ball.vx;
            }
    
            // Collision with right paddle
            if (ball.x + 7 > rightPaddle.x &&
                ball.y > rightPaddle.y && ball.y < rightPaddle.y + paddleHeight) {
                let hitPos = (ball.y - rightPaddle.y) / paddleHeight;
                let reflectAngle = (hitPos - 0.5) * Math.PI / 2;
                ball.speed += speedIncrement;
                ball.vx = -ball.speed * Math.cos(reflectAngle);
                ball.vy = ball.speed * Math.sin(reflectAngle);
                if (ball.vx > 0) ball.vx = -ball.vx;
            }
    
            // Off-screen check => we count a "round"
            if (ball.x + 7 < 0 || ball.x - 7 > pongCanvas.width) {
                roundsPlayed++;
                if (roundsPlayed >= targetRounds) {
                    if (isMultiplayer && ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: "game_over", score: roundsPlayed }));
                    }
                    endPongGame();
                    return;
                }
                ball.speed = 6;
                ball.x = pongCanvas.width / 2;
                ball.y = pongCanvas.height / 2;
                ball.angle = Math.random() * Math.PI / 4 - Math.PI / 8;
                if (ball.x + 7 < 0) {
                    ball.vx = ball.speed * Math.cos(ball.angle);
                } else {
                    ball.vx = -ball.speed * Math.cos(ball.angle);
                }
                ball.vy = ball.speed * Math.sin(ball.angle);
            }
    
            // AI or multiplayer paddle updates
            if (isMultiplayer) {
                rightPaddle.y = remotePaddleY;
            } else {
                // AI mode - only make decisions once per second
                const now = Date.now();
                
                // Record current ball position and calculate velocity
                const ballVelocity = {
                    x: ball.x - aiState.lastBallPosition.x,
                    y: ball.y - aiState.lastBallPosition.y
                };
                
                // Only update AI decision once per second
                if (now - aiState.lastUpdateTime >= aiState.decisionInterval) {
                    aiState.lastUpdateTime = now;
                    
                    // Decide what action to take based on ball position
                    aiState.action = calculateAIAction(rightPaddle, ball, {x: ball.vx, y: ball.vy}, paddleHeight);
                    
                    // Save current ball position for next calculation
                    aiState.lastBallPosition = { x: ball.x, y: ball.y };
                }
                
                // Execute the stored action (simulating keyboard input)
                if (aiState.action === 'up') {
                    rightPaddle.y -= 4.5; // Move up
                } else if (aiState.action === 'down') {
                    rightPaddle.y += 4.5; // Move down
                }
                
                // Constrain paddle to canvas
                rightPaddle.y = Math.max(0, Math.min(pongCanvas.height - paddleHeight, rightPaddle.y));
            }
        }
    
        function draw() {
            ctx.clearRect(0, 0, pongCanvas.width, pongCanvas.height);
        
            // Dividing line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.setLineDash([5, 10]);
            ctx.beginPath();
            ctx.moveTo(pongCanvas.width / 2, 0);
            ctx.lineTo(pongCanvas.width / 2, pongCanvas.height);
            ctx.stroke();
            ctx.setLineDash([]);
        
            // Show score info if in fullscreen
            if (isFullscreen) {
                ctx.fillStyle = "#ffffff";
                ctx.font = "24px Arial";
                ctx.textAlign = "center";
                ctx.fillText(nicknameGlobal + ": " + roundsPlayed + " / " + targetRounds,
                             pongCanvas.width / 2, 30);
            }
        
            // Ball
            ctx.fillStyle = "#00d4ff";
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
            ctx.fill();
        
            // Draw rounded paddles
            
            // Left paddle with rounded corners
            const paddleRadius = Math.min(8, paddleWidth / 2); // Radius for rounded corners
            
            // Create thinner paddles by reducing the width
            const thinnerWidth = paddleWidth * 0.6; // Make paddles 60% of original width
            
            // Left paddle (blue)
            ctx.fillStyle = "#007bff";
            drawRoundedRect(leftPaddle.x, leftPaddle.y, thinnerWidth, paddleHeight, paddleRadius);
            
            // Right paddle (pink)
            ctx.fillStyle = "#ff758c";
            drawRoundedRect(rightPaddle.x, rightPaddle.y, thinnerWidth, paddleHeight, paddleRadius);
        }
        
        // Helper function to draw rounded rectangles
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
    }

    window.addEventListener('resize', () => {
        if (document.fullscreenElement) {
            pongCanvas.width = window.innerWidth;
            pongCanvas.height = window.innerHeight;
        }
    });
});