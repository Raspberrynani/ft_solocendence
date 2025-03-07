// Add this code to a new file called tournament-debug.js in your frontend/js directory

/**
 * Tournament Debug Interface
 * Provides debugging utilities for tournament development and testing
 * To enable: Add ?debug=1 to the URL or press Ctrl+Shift+D
 */
(function() {
    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Check if debug mode is enabled
        const isDebugMode = window.location.search.includes('debug=1') || 
                           window.location.hostname === 'localhost';
        
        // Also allow enabling via keyboard shortcut
        let debugEnabled = isDebugMode;
        let ctrlShiftPressed = false;
        
        document.addEventListener('keydown', function(e) {
            // Enable debug mode with Ctrl+Shift+D
            if (e.ctrlKey && e.shiftKey) {
                ctrlShiftPressed = true;
                
                if (e.key === 'd' || e.key === 'D') {
                    debugEnabled = !debugEnabled;
                    if (debugEnabled) {
                        createDebugPanel();
                        console.log("Tournament debug mode enabled");
                    } else {
                        removeDebugPanel();
                        console.log("Tournament debug mode disabled");
                    }
                }
            }
        });
        
        document.addEventListener('keyup', function(e) {
            if (!e.ctrlKey || !e.shiftKey) {
                ctrlShiftPressed = false;
            }
        });
        
        // Create debug panel if debug mode is enabled
        if (debugEnabled) {
            createDebugPanel();
        }
    });
    
    /**
     * Create and show the debug panel
     */
    function createDebugPanel() {
        // Remove existing panel if any
        removeDebugPanel();
        
        // Create debug panel
        const panel = document.createElement('div');
        panel.id = 'tournament-debug-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            width: 300px;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #00d4ff;
            border-radius: 5px;
            padding: 10px;
            color: white;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            max-height: 400px;
            overflow-y: auto;
        `;
        
        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 1px solid #00d4ff;
            padding-bottom: 5px;
        `;
        
        const title = document.createElement('div');
        title.textContent = '🏆 Tournament Debug';
        title.style.fontWeight = 'bold';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 16px;
            cursor: pointer;
        `;
        closeBtn.onclick = removeDebugPanel;
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        panel.appendChild(header);
        
        // Create content
        const content = document.createElement('div');
        content.id = 'tournament-debug-content';
        panel.appendChild(content);
        
        // Create action buttons
        const actions = document.createElement('div');
        actions.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 10px;
        `;
        
        // Add action buttons
        const buttons = [
            { label: 'Start Tournament', action: startTournament },
            { label: 'Force Ready', action: forceReady },
            { label: 'Show State', action: showTournamentState },
            { label: 'Reconnect WS', action: reconnectWebSocket },
            { label: 'Clear Local Storage', action: clearLocalStorage },
            { label: 'Fix Creator Status', action: fixCreatorStatus }
        ];
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = btn.label;
            button.style.cssText = `
                background: #303030;
                border: 1px solid #00d4ff;
                color: white;
                padding: 3px 5px;
                border-radius: 3px;
                font-size: 10px;
                cursor: pointer;
            `;
            button.onclick = btn.action;
            actions.appendChild(button);
        });
        
        panel.appendChild(actions);
        
        // Add to body
        document.body.appendChild(panel);
        
        // Initialize content
        updateDebugPanel();
        
        // Set up periodic updates
        window.tournamentDebugInterval = setInterval(updateDebugPanel, 1000);
    }
    
    /**
     * Remove the debug panel
     */
    function removeDebugPanel() {
        const panel = document.getElementById('tournament-debug-panel');
        if (panel) {
            panel.remove();
        }
        
        // Clear update interval
        if (window.tournamentDebugInterval) {
            clearInterval(window.tournamentDebugInterval);
            window.tournamentDebugInterval = null;
        }
    }
    
    /**
     * Update debug panel content
     */
    function updateDebugPanel() {
        const content = document.getElementById('tournament-debug-content');
        if (!content) return;
        
        // Get current state
        let stateHtml = '';
        
        // WebSocket status
        const wsConnected = window.WebSocketManager && WebSocketManager.isConnected && WebSocketManager.isConnected();
        stateHtml += `<div>WebSocket: <span style="color: ${wsConnected ? '#4CAF50' : '#F44336'}">${wsConnected ? 'Connected' : 'Disconnected'}</span></div>`;
        
        // Tournament status
        const inTournament = window.TournamentManager && TournamentManager.isInTournament && TournamentManager.isInTournament();
        stateHtml += `<div>In Tournament: <span style="color: ${inTournament ? '#4CAF50' : '#F44336'}">${inTournament ? 'Yes' : 'No'}</span></div>`;
        
        // Creator status
        let isCreator = false;
        try {
            isCreator = localStorage.getItem('isTournamentCreator') === 'true';
        } catch(e) {}
        
        stateHtml += `<div>Is Creator: <span style="color: ${isCreator ? '#4CAF50' : '#F44336'}">${isCreator ? 'Yes' : 'No'}</span></div>`;
        
        // Tournament ID
        let tournamentId = null;
        try {
            tournamentId = localStorage.getItem('activeTournamentId');
        } catch(e) {}
        
        if (window.TournamentManager && TournamentManager.getCurrentTournamentId) {
            const currentId = TournamentManager.getCurrentTournamentId();
            if (currentId) tournamentId = currentId;
        }
        
        stateHtml += `<div>Tournament ID: <span style="color: ${tournamentId ? '#4CAF50' : '#F44336'}">${tournamentId || 'None'}</span></div>`;
        
        // Start button visibility
        const startBtn = document.getElementById('start-tournament');
        const startBtnVisible = startBtn && startBtn.style.display !== 'none';
        stateHtml += `<div>Start Button: <span style="color: ${startBtnVisible ? '#4CAF50' : '#F44336'}">${startBtnVisible ? 'Visible' : 'Hidden'}</span></div>`;
        
        // Current nickname
        let nickname = '';
        if (window.TournamentManager && typeof TournamentManager.getCurrentNickname === 'function') {
            nickname = TournamentManager.getCurrentNickname();
        } else {
            const nicknameInput = document.getElementById('nickname');
            if (nicknameInput) nickname = nicknameInput.value;
        }
        
        stateHtml += `<div>Nickname: <span style="color: ${nickname ? '#4CAF50' : '#F44336'}">${nickname || 'None'}</span></div>`;
        
        content.innerHTML = stateHtml;
    }
    
    /**
     * Debug action: Force start tournament
     */
    function startTournament() {
        let tournamentId = null;
        try {
            tournamentId = localStorage.getItem('activeTournamentId');
        } catch(e) {}
        
        if (window.TournamentManager && TournamentManager.getCurrentTournamentId) {
            const currentId = TournamentManager.getCurrentTournamentId();
            if (currentId) tournamentId = currentId;
        }
        
        if (!tournamentId) {
            alert('No active tournament found');
            return;
        }
        
        if (window.WebSocketManager && WebSocketManager.send) {
            WebSocketManager.send({
                type: "start_tournament",
                tournament_id: tournamentId
            });
            
            console.log('Debug: Sent start tournament command for ID', tournamentId);
            updateDebugPanel();
        } else {
            alert('WebSocket not available');
        }
    }
    
    /**
     * Debug action: Force player ready
     */
    function forceReady() {
        if (window.WebSocketManager && WebSocketManager.send) {
            WebSocketManager.send({
                type: "tournament_player_ready"
            });
            
            console.log('Debug: Sent player ready command');
            updateDebugPanel();
        } else {
            alert('WebSocket not available');
        }
    }
    
    /**
     * Debug action: Show tournament state
     */
    function showTournamentState() {
        if (window.TournamentManager && TournamentManager.isInTournament && TournamentManager.isInTournament()) {
            // Use internal tournament state
            const stateStr = JSON.stringify(window.currentTournament || {}, null, 2);
            
            // Create a modal to show state
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            `;
            
            const box = document.createElement('div');
            box.style.cssText = `
                background: #1a1a1a;
                border: 1px solid #00d4ff;
                border-radius: 5px;
                padding: 20px;
                max-width: 80%;
                max-height: 80%;
                overflow: auto;
            `;
            
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                border-bottom: 1px solid #00d4ff;
                padding-bottom: 5px;
            `;
            
            const title = document.createElement('div');
            title.textContent = 'Tournament State';
            title.style.fontWeight = 'bold';
            title.style.color = 'white';
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
            `;
            closeBtn.onclick = () => modal.remove();
            
            header.appendChild(title);
            header.appendChild(closeBtn);
            box.appendChild(header);
            
            const pre = document.createElement('pre');
            pre.style.cssText = `
                color: #00d4ff;
                font-family: monospace;
                font-size: 12px;
                white-space: pre-wrap;
                word-break: break-all;
            `;
            pre.textContent = stateStr;
            box.appendChild(pre);
            
            modal.appendChild(box);
            document.body.appendChild(modal);
        } else {
            alert('Not in a tournament');
        }
    }
    
    /**
     * Debug action: Reconnect WebSocket
     */
    function reconnectWebSocket() {
        if (window.WebSocketManager && WebSocketManager.reconnect) {
            WebSocketManager.reconnect();
            console.log('Debug: Reconnecting WebSocket');
            updateDebugPanel();
        } else {
            alert('WebSocket reconnect not available');
        }
    }
    
    /**
     * Debug action: Clear localStorage tournament data
     */
    function clearLocalStorage() {
        try {
            localStorage.removeItem('inTournament');
            localStorage.removeItem('activeTournamentId');
            localStorage.removeItem('isTournamentCreator');
            
            console.log('Debug: Cleared tournament localStorage data');
            updateDebugPanel();
        } catch(e) {
            alert('Error clearing localStorage: ' + e.message);
        }
    }
    
    /**
     * Debug action: Fix creator status
     */
    function fixCreatorStatus() {
        try {
            localStorage.setItem('isTournamentCreator', 'true');
            
            // Also update internal state if TournamentManager is available
            if (window.TournamentManager) {
                window.isTournamentCreator = true;
            }
            
            // Show start tournament button
            const startBtn = document.getElementById('start-tournament');
            if (startBtn) {
                startBtn.style.display = 'block';
            }
            
            console.log('Debug: Fixed creator status to TRUE');
            updateDebugPanel();
        } catch(e) {
            alert('Error fixing creator status: ' + e.message);
        }
    }
})();