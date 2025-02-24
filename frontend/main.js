document.addEventListener("DOMContentLoaded", () => {
    const languageSelector = document.getElementById("language-selector");
    const nicknameInput = document.getElementById("nickname");
    const startGameButton = document.getElementById("start-game");
    const leaderboardList = document.getElementById("leaderboard");
    const debugJoinButton = document.getElementById("debug-join");
    const playerNameDisplay = document.getElementById("player-name");
    const playerScoreDisplay = document.getElementById("player-score");
    const endGameButton = document.getElementById("end-game");

    let currentScore = 0;
    let gameLoopId;
    let ws;
    let gameToken = null; // token to secure game-end API call
    let nicknameGlobal = "";
    let isMultiplayer = false;
    let remotePaddleY = 0;

    // Default page: language selection
    navigateTo("language-page");

    // Translations and status messages
    const translations = {
        "en": { 
            enterName: "Enter Your Nickname", 
            waitingQueue: "Waiting in queue...", 
            waitingOpponent: "Waiting for an opponent...", 
            aiMode: "Playing with AI" 
        },
        "es": { 
            enterName: "Ingrese su Apodo", 
            waitingQueue: "Esperando en cola...", 
            waitingOpponent: "Esperando a un oponente...", 
            aiMode: "Jugando con IA" 
        },
        "fr": { 
            enterName: "Entrez votre pseudo", 
            waitingQueue: "En attente dans la file...", 
            waitingOpponent: "En attente d'un adversaire...", 
            aiMode: "Jouer contre IA" 
        }
    };

    // Handle language change
    languageSelector.addEventListener("change", () => {
        document.getElementById("enter-name").innerText = translations[languageSelector.value].enterName;
    });

    // Fade-in effect for the "Join Game" button when typing nickname
    nicknameInput.addEventListener("input", () => {
        if (nicknameInput.value.trim().length > 0) {
            startGameButton.classList.remove("hidden");
        } else {
            startGameButton.classList.add("hidden");
        }
    });

    // Define available game modes (3 modes)
    const gameModes = ["Classic with queue", "Classic with AI", "Unimplemented"];
    let currentGameModeIndex = 0;

    // Function to update the gamemode indicator text
    function updateGameModeIndicator() {
      document.querySelector(".game-mode-indicator").innerText = gameModes[currentGameModeIndex];
    }
    updateGameModeIndicator();

    // Arrow buttons to cycle game modes
    document.getElementById("prevMode").addEventListener("click", () => {
      currentGameModeIndex = (currentGameModeIndex - 1 + gameModes.length) % gameModes.length;
      updateGameModeIndicator();
    });
    document.getElementById("nextMode").addEventListener("click", () => {
      currentGameModeIndex = (currentGameModeIndex + 1) % gameModes.length;
      updateGameModeIndicator();
    });

    // Validate and start game based on selected mode
    startGameButton.addEventListener("click", async () => {
        const nickname = nicknameInput.value.trim();
        if (!nickname) {
            alert("Please enter a nickname!");
            return;
        }
        const validNickname = /^[A-Za-z]{1,16}$/;
        if (!validNickname.test(nickname)) {
            alert("this nickname is too cool to be used here!");
            return;
        }
        nicknameGlobal = nickname;
        playerNameDisplay.innerText = nickname;
        currentScore = 0;
        playerScoreDisplay.innerText = currentScore;

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
            // Connect via WebSocket; wait for pairing
            connectWebSocket(nickname);
            navigateTo("pong-page");
            document.getElementById("pong-status").innerText = translations[languageSelector.value].waitingQueue;
        }
    });

    // Debug button for testing
    debugJoinButton.addEventListener("click", () => {
        startPongGame();
    });

    // SPA navigation function
    function navigateTo(pageId) {
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        document.getElementById(pageId).classList.add("active");
        if (pageId === "leaderboard-page") {
            updateLeaderboard();
        }
    }
    window.navigateTo = navigateTo;

    // Update leaderboard from backend API (sorted by wins)
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

    // WebSocket connection for multiplayer (Classic with queue)
    function connectWebSocket(nickname) {
        ws = new WebSocket("ws://127.0.0.1:8000/ws/pong/");
        ws.onopen = () => {
            console.log("WebSocket connected");
            gameToken = Math.random().toString(36).substring(2);
            ws.send(JSON.stringify({ type: "join", nickname, token: gameToken }));
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("WebSocket message:", data);
            if (data.type === "queue_update") {
                document.getElementById("pong-status").innerText = data.message;
            } else if (data.type === "start_game") {
                // When paired, start the game and record the game room (if needed)
                document.getElementById("pong-status").innerText = "";
                startPongGame();
            } else if (data.type === "game_update") {
                // Update opponent's paddle position
                if (data.data && data.data.paddleY !== undefined) {
                    remotePaddleY = data.data.paddleY;
                }
            } else if (data.type === "opponent_left") {
                alert(data.message);
                // Optionally, return to lobby
                navigateTo("game-page");
            }
        };
        ws.onerror = (error) => console.error("WebSocket error:", error);
        ws.onclose = () => console.log("WebSocket closed");
    }

    // Start Pong game with CRT zoom effect and setup multiplayer game state
    function startPongGame() {
        const canvas = document.getElementById("pong-canvas");
        canvas.classList.add("enlarged");
        // Trigger CRT zoom animation
        canvas.classList.remove("crt-zoom");
        void canvas.offsetWidth;
        canvas.classList.add("crt-zoom");
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        endGameButton.classList.remove("hidden");
        initPongGame();
    }

    // End game: stop loop and call backend to record win
    async function endPongGame() {
        cancelAnimationFrame(gameLoopId);
        try {
            const response = await fetch("http://127.0.0.1:8000/api/end_game/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nickname: nicknameGlobal, token: gameToken, score: currentScore })
            });
            if (response.ok) {
                alert("Game ended and win recorded!");
            } else {
                alert("Failed to record win!");
            }
        } catch (error) {
            console.error("Error ending game:", error);
        }
        const canvas = document.getElementById("pong-canvas");
        canvas.classList.remove("enlarged");
        endGameButton.classList.add("hidden");
        navigateTo("leaderboard-page");
    }

    // Pong game implementation
    function initPongGame() {
        const canvas = document.getElementById("pong-canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        const paddleWidth = 10, paddleHeight = 60;
        let leftPaddle = { x: 10, y: canvas.height / 2 - paddleHeight / 2 };
        // For multiplayer, rightPaddle will be controlled by opponent update;
        // otherwise, use simple AI.
        let rightPaddle = { x: canvas.width - 20, y: canvas.height / 2 - paddleHeight / 2 };
        let ball = { x: canvas.width / 2, y: canvas.height / 2, vx: 4, vy: 4 };

        // For multiplayer, send paddle updates to server
        canvas.addEventListener("mousemove", (e) => {
            const rect = canvas.getBoundingClientRect();
            leftPaddle.y = e.clientY - rect.top - paddleHeight / 2;
            // In multiplayer mode, send our paddle position update
            if (isMultiplayer && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "game_update",
                    data: { paddleY: leftPaddle.y }
                }));
            }
        });

        // Game loop
        function gameLoop() {
            update();
            draw();
            gameLoopId = requestAnimationFrame(gameLoop);
        }
        gameLoop();

        function update() {
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Bounce off top and bottom
            if (ball.y + ballRadius() > canvas.height || ball.y - ballRadius() < 0) {
                ball.vy = -ball.vy;
                triggerSparkle(ball.x, ball.y);
            }
            // Bounce off left paddle
            if (ball.x - ballRadius() < leftPaddle.x + paddleWidth &&
                ball.y > leftPaddle.y && ball.y < leftPaddle.y + paddleHeight) {
                ball.vx = -ball.vx;
                triggerSparkle(ball.x, ball.y);
            }
            // Bounce off right paddle (multiplayer or AI)
            if (ball.x + ballRadius() > rightPaddle.x &&
                ball.y > rightPaddle.y && ball.y < rightPaddle.y + paddleHeight) {
                ball.vx = -ball.vx;
                triggerSparkle(ball.x, ball.y);
            }
            // Off-screen ball: update score and reset ball
            if (ball.x + ballRadius() < 0 || ball.x - ballRadius() > canvas.width) {
                currentScore++;
                playerScoreDisplay.innerText = currentScore;
                ball.x = canvas.width / 2;
                ball.y = canvas.height / 2;
                ball.vx = -ball.vx;
            }
            // Update right paddle:
            if (isMultiplayer) {
                // In multiplayer, set right paddle based on remote update
                rightPaddle.y = remotePaddleY;
            } else {
                // AI: simple tracking of the ball
                if (ball.y < rightPaddle.y + paddleHeight / 2) {
                    rightPaddle.y -= 3;
                } else {
                    rightPaddle.y += 3;
                }
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw ball
            ctx.fillStyle = "#00d4ff";
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballRadius(), 0, Math.PI * 2);
            ctx.fill();
            // Draw left paddle
            ctx.fillStyle = "#007bff";
            ctx.fillRect(leftPaddle.x, leftPaddle.y, paddleWidth, paddleHeight);
            // Draw right paddle
            ctx.fillStyle = "#ff758c";
            ctx.fillRect(rightPaddle.x, rightPaddle.y, paddleWidth, paddleHeight);
        }

        function ballRadius() {
            return 7;
        }
    }

    // Three.js sparkle effect on collision
    function triggerSparkle(x, y) {
        let sparkleCanvas = document.getElementById("sparkle-canvas");
        if (!sparkleCanvas) {
            sparkleCanvas = document.createElement("canvas");
            sparkleCanvas.id = "sparkle-canvas";
            sparkleCanvas.style.position = "absolute";
            sparkleCanvas.style.top = "0";
            sparkleCanvas.style.left = "0";
            sparkleCanvas.style.pointerEvents = "none";
            sparkleCanvas.width = window.innerWidth;
            sparkleCanvas.height = window.innerHeight;
            document.body.appendChild(sparkleCanvas);
        }
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, sparkleCanvas.width / sparkleCanvas.height, 0.1, 1000);
        camera.position.z = 50;
        const renderer = new THREE.WebGLRenderer({ canvas: sparkleCanvas, alpha: true });
        renderer.setSize(sparkleCanvas.width, sparkleCanvas.height);
        const particleCount = 20;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        for (let i = 0; i < particleCount; i++) {
            positions.push(x + (Math.random() - 0.5) * 20);
            positions.push(y + (Math.random() - 0.5) * 20);
            positions.push(0);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ color: 0x00d4ff, size: 3 });
        const particles = new THREE.Points(geometry, material);
        scene.add(particles);
        let opacity = 1;
        const animate = function () {
            requestAnimationFrame(animate);
            opacity -= 0.02;
            material.opacity = opacity;
            material.transparent = true;
            renderer.render(scene, camera);
            if (opacity <= 0) {
                if (renderer.domElement.parentNode) {
                    renderer.domElement.parentNode.removeChild(renderer.domElement);
                }
            }
        };
        animate();
    }
});
