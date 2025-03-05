/**
 * Tournament Bracket System
 * Generates visual brackets for tournaments with 3+ players
 * Handles player progression, winner/loser screens
 */
(function() {
    // Container for the bracket visualization
    let bracketContainer = null;
    
    // Track if this is a single-elimination or double-elimination tournament
    let isDoubleElimination = false;
    
    // Tournament state
    let tournamentState = {
        players: [],
        matches: [],
        completedMatches: [],
        currentMatch: null,
        winners: [],
        losers: []
    };
    
    // Initialize the bracket system
    function initBracketSystem() {
        console.log("Initializing tournament bracket system...");
        
        // Create the bracket container if it doesn't exist
        createBracketContainer();
        
        // Hook into TournamentManager
        hookTournamentManager();
    }
    
    // Create the bracket container and add styles
    function createBracketContainer() {
        // Add bracket styles
        const style = document.createElement('style');
        style.textContent = `
            .tournament-bracket {
                margin: 20px 0;
                overflow-x: auto;
                padding: 15px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 10px;
                border: 1px solid rgba(0, 212, 255, 0.2);
            }
            
            .bracket-title {
                text-align: center;
                margin-bottom: 15px;
                color: #00d4ff;
                font-weight: bold;
            }
            
            .bracket-container {
                display: flex;
                justify-content: space-between;
                min-height: 200px;
            }
            
            .bracket-round {
                display: flex;
                flex-direction: column;
                justify-content: space-around;
                min-width: 150px;
                margin: 0 10px;
            }
            
            .bracket-match {
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 5px;
                margin: 5px 0;
                padding: 8px;
                background: rgba(0, 0, 0, 0.4);
                position: relative;
            }
            
            .bracket-match.current {
                border: 1px solid #00d4ff;
                box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
                animation: bracketPulse 2s infinite;
            }
            
            .bracket-match.completed {
                border: 1px solid rgba(255, 255, 255, 0.4);
                background: rgba(40, 167, 69, 0.1);
            }
            
            .bracket-match .player {
                padding: 4px;
                border-radius: 3px;
            }
            
            .bracket-match .player.winner {
                background: rgba(40, 167, 69, 0.2);
                color: #28a745;
                font-weight: bold;
            }
            
            .bracket-match .player.loser {
                color: rgba(255, 255, 255, 0.6);
            }
            
            .bracket-match .versus {
                color: rgba(255, 255, 255, 0.4);
                font-size: 12px;
                margin: 4px 0;
                text-align: center;
            }
            
            .bracket-line {
                border-right: 1px solid rgba(255, 255, 255, 0.2);
                position: absolute;
                top: 50%;
                right: -11px;
                width: 10px;
                height: 1px;
            }
            
            .result-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                color: white;
                text-align: center;
                animation: fadeIn 0.5s;
            }
            
            .result-screen.winner {
                background: radial-gradient(circle, rgba(40, 167, 69, 0.8) 0%, rgba(0, 0, 0, 0.95) 70%);
            }
            
            .result-screen.loser {
                background: radial-gradient(circle, rgba(220, 53, 69, 0.8) 0%, rgba(0, 0, 0, 0.95) 70%);
            }
            
            .result-screen h2 {
                font-size: 42px;
                margin-bottom: 20px;
                text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
            }
            
            .result-screen h3 {
                font-size: 24px;
                margin-bottom: 30px;
                opacity: 0.9;
            }
            
            .result-screen .button {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                padding: 10px 20px;
                font-size: 18px;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.3s;
                color: white;
                margin-top: 20px;
            }
            
            .result-screen .button:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.05);
            }
            
            @keyframes bracketPulse {
                0%, 100% { box-shadow: 0 0 5px rgba(0, 212, 255, 0.5); }
                50% { box-shadow: 0 0 15px rgba(0, 212, 255, 0.8); }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .loser-bracket-option {
                margin-top: 15px;
                padding: 10px;
                background: rgba(255, 193, 7, 0.2);
                border: 1px solid rgba(255, 193, 7, 0.4);
                border-radius: 5px;
                text-align: center;
            }
        `;
        document.head.appendChild(style);
        
        // Find the active tournament div
        const activeTournament = document.getElementById('active-tournament');
        if (!activeTournament) {
            console.warn("Active tournament element not found");
            return;
        }
        
        // Create the bracket container
        bracketContainer = document.createElement('div');
        bracketContainer.id = 'tournament-bracket';
        bracketContainer.className = 'tournament-bracket';
        bracketContainer.style.display = 'none'; // Hidden by default
        bracketContainer.innerHTML = `
            <div class="bracket-title">Tournament Bracket</div>
            <div class="bracket-container" id="bracket-container"></div>
        `;
        
        // Add to the DOM after tournament matches section
        const tournamentMatches = document.getElementById('tournament-matches');
        if (tournamentMatches && tournamentMatches.parentNode) {
            tournamentMatches.parentNode.insertBefore(bracketContainer, tournamentMatches.nextSibling);
        } else {
            // Fallback - add to active tournament
            activeTournament.appendChild(bracketContainer);
        }
    }
    
    // Hook into TournamentManager to update bracket
    function hookTournamentManager() {
        // Wait for TournamentManager to be available
        const checkInterval = setInterval(function() {
            if (!window.TournamentManager) return;
            
            clearInterval(checkInterval);
            console.log("Found TournamentManager - hooking bracket functions");
            
            // Store original functions
            const originalUpdate = TournamentManager.handleTournamentUpdate;
            const originalGameOver = TournamentManager.handleGameOver || function() {};
            
            // Override tournament update handler
            if (typeof originalUpdate === 'function') {
                TournamentManager.handleTournamentUpdate = function(tournament) {
                    // Call original function
                    originalUpdate.call(TournamentManager, tournament);
                    
                    // Update our tournament state
                    updateTournamentState(tournament);
                    
                    // Generate bracket if needed
                    if (tournament.players.length >= 3) {
                        generateBracket(tournament);
                    }
                };
            }
            
            // Override game over handler if it exists
            if (typeof window.handleGameOver === 'function') {
                const originalHandleGameOver = window.handleGameOver;
                window.handleGameOver = function(score) {
                    // Call original handler
                    originalHandleGameOver(score);
                    
                    // Check for final match
                    checkForTournamentEnd(score);
                };
            }
        }, 100);
    }
    
    // Update our tournament state from the tournament object
    function updateTournamentState(tournament) {
        tournamentState = {
            players: tournament.players || [],
            matches: tournament.upcoming_matches || [],
            completedMatches: tournament.completed_matches || [],
            currentMatch: tournament.current_match,
            winners: tournament.winners || []
        };
        
        // Compute losers list (players who lost matches)
        const losers = [];
        tournamentState.completedMatches.forEach(match => {
            // The player who isn't the winner is the loser
            const loser = match.player1 === match.winner ? match.player2 : match.player1;
            if (!losers.includes(loser)) {
                losers.push(loser);
            }
        });
        tournamentState.losers = losers;
        
        console.log("Updated tournament state:", tournamentState);
    }
    
    // Generate bracket visualization based on tournament state
    function generateBracket(tournament) {
        if (!bracketContainer) return;
        
        // Show the bracket container
        bracketContainer.style.display = 'block';
        
        // Get the bracket container
        const container = document.getElementById('bracket-container');
        if (!container) return;
        
        // Clear previous content
        container.innerHTML = '';
        
        // Determine number of rounds based on player count
        const playerCount = tournament.players.length;
        const roundCount = Math.ceil(Math.log2(playerCount));
        
        // Create rounds
        for (let i = 0; i < roundCount; i++) {
            const roundDiv = document.createElement('div');
            roundDiv.className = 'bracket-round';
            roundDiv.innerHTML = `<div class="round-title">Round ${i + 1}</div>`;
            
            // Calculate number of matches in this round
            const matchCount = Math.pow(2, roundCount - i - 1);
            
            // Create matches for this round
            for (let j = 0; j < matchCount; j++) {
                const matchDiv = document.createElement('div');
                matchDiv.className = 'bracket-match';
                
                // Find if this is a real match or placeholder
                let matchData = null;
                
                // Check if it's the current match
                if (tournament.current_match && 
                    i === 0 && j === 0) {
                    matchData = tournament.current_match;
                    matchDiv.className += ' current';
                    matchDiv.innerHTML = `
                        <div class="player">${matchData.player1}</div>
                        <div class="versus">vs</div>
                        <div class="player">${matchData.player2}</div>
                    `;
                }
                // Check completed matches
                else if (i < tournament.completed_matches.length) {
                    matchData = tournament.completed_matches[i];
                    matchDiv.className += ' completed';
                    
                    // Highlight winner and loser
                    const player1Class = matchData.winner === matchData.player1 ? 'winner' : 'loser';
                    const player2Class = matchData.winner === matchData.player2 ? 'winner' : 'loser';
                    
                    matchDiv.innerHTML = `
                        <div class="player ${player1Class}">${matchData.player1}</div>
                        <div class="versus">vs</div>
                        <div class="player ${player2Class}">${matchData.player2}</div>
                    `;
                }
                // Check upcoming matches
                else if (i - tournament.completed_matches.length < tournament.upcoming_matches.length) {
                    matchData = tournament.upcoming_matches[i - tournament.completed_matches.length];
                    matchDiv.innerHTML = `
                        <div class="player">${matchData.player1}</div>
                        <div class="versus">vs</div>
                        <div class="player">${matchData.player2}</div>
                    `;
                }
                // Placeholder for future matches
                else {
                    matchDiv.innerHTML = `
                        <div class="player">TBD</div>
                        <div class="versus">vs</div>
                        <div class="player">TBD</div>
                    `;
                }
                
                // Add connecting line if not final round
                if (i < roundCount - 1) {
                    const lineDiv = document.createElement('div');
                    lineDiv.className = 'bracket-line';
                    matchDiv.appendChild(lineDiv);
                }
                
                roundDiv.appendChild(matchDiv);
            }
            
            container.appendChild(roundDiv);
        }
    }
    
    // Check if the tournament has ended
    function checkForTournamentEnd(score) {
        // Only handle if we have 2 or fewer players left
        if (tournamentState.players.length <= 2 && 
            tournamentState.completedMatches.length > 0) {
            
            // Get current player
            const currentPlayer = localStorage.getItem('currentPlayer') || '';
            
            // Get the last completed match
            const lastMatch = tournamentState.completedMatches[tournamentState.completedMatches.length - 1];
            
            // Determine if current player won or lost
            const playerWon = lastMatch && lastMatch.winner === currentPlayer;
            
            // Show appropriate screen
            if (playerWon) {
                showWinnerScreen();
            } else {
                const hasLoserBracket = isDoubleElimination && tournamentState.completedMatches.length > 1;
                showLoserScreen(hasLoserBracket);
            }
        }
    }
    
    // Show winner screen
    function showWinnerScreen() {
        const screen = document.createElement('div');
        screen.className = 'result-screen winner';
        screen.innerHTML = `
            <h2>🏆 VICTORY! 🏆</h2>
            <h3>You won the tournament!</h3>
            <button class="button" id="continue-button">CONTINUE</button>
        `;
        document.body.appendChild(screen);
        
        // Add button handler
        document.getElementById('continue-button').addEventListener('click', function() {
            screen.remove();
            
            // Navigate back to menu
            if (window.UIManager && typeof UIManager.navigateTo === 'function') {
                UIManager.navigateTo('game-page');
            }
        });
    }
    
    // Show loser screen
    function showLoserScreen(hasLoserBracket) {
        const screen = document.createElement('div');
        screen.className = 'result-screen loser';
        
        let content = `
            <h2>DEFEAT</h2>
            <h3>You've been eliminated from the tournament</h3>
            <button class="button" id="continue-button">BACK TO MENU</button>
        `;
        
        // Add loser bracket option if available
        if (hasLoserBracket) {
            content += `
                <div class="loser-bracket-option">
                    <p>You still have a chance in the loser's bracket!</p>
                    <button class="button" id="loser-bracket-button">CONTINUE TO LOSER BRACKET</button>
                </div>
            `;
        }
        
        screen.innerHTML = content;
        document.body.appendChild(screen);
        
        // Add button handlers
        document.getElementById('continue-button').addEventListener('click', function() {
            // If in a tournament, leave it
            if (window.TournamentManager && 
                typeof TournamentManager.isInTournament === 'function' && 
                typeof TournamentManager.leaveTournament === 'function' && 
                TournamentManager.isInTournament()) {
                
                TournamentManager.leaveTournament();
            }
            
            screen.remove();
            
            // Navigate back to menu
            if (window.UIManager && typeof UIManager.navigateTo === 'function') {
                UIManager.navigateTo('game-page');
            }
        });
        
        if (hasLoserBracket) {
            document.getElementById('loser-bracket-button').addEventListener('click', function() {
                screen.remove();
                
                // Continue in tournament
                // The tournament system will handle placing in loser bracket
            });
        }
    }
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', initBracketSystem);
})();

