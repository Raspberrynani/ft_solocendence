document.addEventListener("DOMContentLoaded", () => {
    const languageSelector = document.getElementById("language-selector");
    const nicknameInput = document.getElementById("nickname");
    const startGameButton = document.getElementById("start-game");
    const gameMessage = document.getElementById("game-message");
    const leaderboardList = document.getElementById("leaderboard");

    // Default page (starts on language selection)
    navigateTo("language-page");

    // Translations
    const translations = {
        "en": { enterName: "Enter Your Nickname", startGame: "Start Game", youWin: "You Win!", leaderboard: "Leaderboard" },
        "es": { enterName: "Ingrese su Apodo", startGame: "Iniciar Juego", youWin: "¡Ganaste!", leaderboard: "Tabla de clasificación" },
        "fr": { enterName: "Entrez votre pseudo", startGame: "Commencer le jeu", youWin: "Vous avez gagné!", leaderboard: "Classement" }
    };

    // Handle language change
    languageSelector.addEventListener("change", () => {
        document.getElementById("enter-name").innerText = translations[languageSelector.value].enterName;
    });

    // Handle language selection and move to game page
    document.querySelector("#language-page button").addEventListener("click", () => {
        navigateTo("game-page");
    });

    // Fade-in effect for the "Start Game" button
    nicknameInput.addEventListener("input", () => {
        startGameButton.classList.toggle("hidden", nicknameInput.value.trim().length === 0);
    });

    // Handle game start
    startGameButton.addEventListener("click", async () => {
        const nickname = nicknameInput.value.trim();
        if (!nickname) return;

        gameMessage.innerText = translations[languageSelector.value].youWin;
        gameMessage.classList.remove("hidden");

        try {
            await fetch("http://127.0.0.1:8000/api/add-entry/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: nickname })
            });
            updateLeaderboard();
        } catch (error) {
            console.error("Error updating leaderboard:", error);
        }
    });

    // Function to update leaderboard
    async function updateLeaderboard() {
        try {
            const response = await fetch("http://127.0.0.1:8000/api/entries/");
            const data = await response.json();
            leaderboardList.innerHTML = "";
            data.entries.forEach(entry => {
                const li = document.createElement("li");
                li.innerText = entry.name;
                leaderboardList.appendChild(li);
            });
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
        }
    }

    function navigateTo(pageId) {
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        document.getElementById(pageId).classList.add("active");
        if (pageId === "leaderboard-page") {
            updateLeaderboard();
        }
    }
    window.navigateTo = navigateTo;
});
