/**
 * Tournament Protection System
 * Prevents users from accidentally leaving tournaments
 */
(function() {
    // Initialize state
    let inTournament = false;
    
    // Try to load from localStorage
    try {
        inTournament = localStorage.getItem('inTournament') === 'true';
    } catch (e) {
        console.warn("Could not access localStorage");
    }
    
    // Create a history entry stack to prevent back navigation
    history.pushState({page: 'tournament'}, "Tournament", window.location.pathname);
    
    /**
     * Check tournament status and update state
     * @returns {boolean} - Current tournament status
     */
    function checkTournamentStatus() {
        // First try from localStorage for persistence across refreshes
        try {
            const storedState = localStorage.getItem('inTournament');
            if (storedState !== null) {
                inTournament = storedState === 'true';
            }
        } catch (e) {
            console.warn("Could not access localStorage", e);
        }
        
        // Then check actual TournamentManager state if available
        if (window.TournamentManager && typeof TournamentManager.isInTournament === 'function') {
            inTournament = TournamentManager.isInTournament();
            
            // Update localStorage
            try {
                localStorage.setItem('inTournament', inTournament.toString());
            } catch (e) {
                console.warn("Could not store in localStorage", e);
            }
        }
        
        return inTournament;
    }
    
    /**
     * Leave tournament safely
     * @returns {boolean} - Success status
     */
    function leaveTournament() {
        console.log("Safely leaving tournament...");
        
        // Call TournamentManager function if available
        if (window.TournamentManager && typeof TournamentManager.leaveTournament === 'function') {
            TournamentManager.leaveTournament();
        }
        
        // Update local state
        inTournament = false;
        
        // Update localStorage
        try {
            localStorage.setItem('inTournament', 'false');
        } catch (e) {
            console.warn("Could not store in localStorage", e);
        }
        
        return true;
    }
    
    /**
     * Create and display tournament warning UI elements
     */
    function createWarningElements() {
        // Create warning banner
        const banner = document.createElement('div');
        banner.id = 'tournament-warning-banner';
        banner.innerHTML = '⚠️ <strong>TOURNAMENT MODE ACTIVE</strong> - Leaving this page will remove you from the tournament';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background-color: rgba(255, 193, 7, 0.9);
            color: #000;
            text-align: center;
            padding: 8px 0;
            font-size: 14px;
            font-weight: bold;
            z-index: 9999;
            display: none;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(banner);
        
        // Create warning message for tournament page
        const warningElement = document.getElementById('tournament-leave-warning');
        if (!warningElement) {
            const newWarningElement = document.createElement('div');
            newWarningElement.id = 'tournament-leave-warning';
            newWarningElement.className = 'exit-warning mt-3';
            newWarningElement.innerHTML = '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' +
                'WARNING: Leaving this page will remove you from the current tournament!';
            newWarningElement.style.cssText = `
                animation: warningPulse 2s infinite;
                background-color: rgba(220, 53, 69, 0.1);
                border: 1px solid rgba(220, 53, 69, 0.3);
                border-radius: 5px;
                padding: 10px;
                margin-bottom: 15px;
                color: #ff6b6b;
                font-weight: bold;
                text-align: center;
                display: none;
            `;
            
            // Add to tournament page if it exists
            const tournamentPage = document.getElementById('tournament-page');
            if (tournamentPage) {
                // Find appropriate insertion point - before back button
                const backButton = document.getElementById('tournament-back-button');
                if (backButton && backButton.parentNode) {
                    backButton.parentNode.insertBefore(newWarningElement, backButton);
                } else {
                    // Fallback - add to end of tournament page
                    tournamentPage.appendChild(newWarningElement);
                }
            }
        }
        
        // Add animation style if not present
        if (!document.getElementById('tournament-warning-styles')) {
            const style = document.createElement('style');
            style.id = 'tournament-warning-styles';
            style.textContent = `
                @keyframes warningPulse {
                    0%, 100% { 
                        background-color: rgba(220, 53, 69, 0.1);
                        border-color: rgba(220, 53, 69, 0.3);
                    }
                    50% { 
                        background-color: rgba(220, 53, 69, 0.2);
                        border-color: rgba(220, 53, 69, 0.5);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    /**
     * Update warning UI based on tournament state
     */
    function updateWarningUI() {
        // Get current tournament state
        const isInTournament = checkTournamentStatus();
        
        // Update banner
        const banner = document.getElementById('tournament-warning-banner');
        if (banner) {
            banner.style.display = isInTournament ? 'block' : 'none';
        }
        
        // Update warning message
        const warning = document.getElementById('tournament-leave-warning');
        if (warning) {
            warning.style.display = isInTournament ? 'block' : 'none';
        }
    }
    
    /**
     * Handle browser back/forward navigation
     */
    function handlePopState(event) {
        // Check if in a tournament
        if (checkTournamentStatus()) {
            // Show confirmation dialog
            const confirmLeave = confirm("WARNING: Going back will remove you from the tournament. Are you sure?");
            
            if (confirmLeave) {
                // User confirmed - leave tournament and allow navigation
                leaveTournament();
                return true;
            } else {
                // User canceled - prevent back navigation
                history.pushState({page: 'tournament'}, "Tournament", window.location.pathname);
                return false;
            }
        }
    }
    
    /**
     * Handle page refresh
     */
    function handleBeforeUnload(event) {
        // Check if in a tournament
        if (checkTournamentStatus()) {
            // Standard browser warning
            const message = "WARNING: Refreshing will disconnect you from the tournament!";
            event.preventDefault();
            event.returnValue = message;
            return message;
        }
    }
    
    /**
     * Handle clicks on navigation elements
     */
    function handleNavigationClick(event) {
        // Skip if not in a tournament
        if (!checkTournamentStatus()) return;
        
        // Find clicked navigation element
        let target = event.target;
        while (target && target !== document) {
            // Check for data-navigate attribute
            if (target.hasAttribute('data-navigate')) {
                const targetPage = target.getAttribute('data-navigate');
                
                // Don't block navigation to pong page
                if (targetPage === 'pong-page') return;
                
                // Block other navigation
                event.preventDefault();
                event.stopPropagation();
                
                // Confirm navigation
                const confirmLeave = confirm("WARNING: Navigating away will remove you from the tournament. Continue?");
                
                if (confirmLeave) {
                    // Leave tournament and navigate
                    leaveTournament();
                    
                    // Wait for tournament exit to complete
                    setTimeout(function() {
                        if (window.UIManager && typeof UIManager.navigateTo === 'function') {
                            UIManager.navigateTo(targetPage);
                        }
                    }, 100);
                }
                
                return false;
            }
            
            // Check for links
            if (target.tagName === 'A' && target.href) {
                // Block link navigation
                event.preventDefault();
                event.stopPropagation();
                
                // Confirm navigation
                const confirmLeave = confirm("WARNING: Navigating away will remove you from the tournament. Continue?");
                
                if (confirmLeave) {
                    // Leave tournament and navigate
                    leaveTournament();
                    
                    // Navigate after leaving tournament
                    setTimeout(function() {
                        window.location.href = target.href;
                    }, 100);
                }
                
                return false;
            }
            
            target = target.parentElement;
        }
    }
    
    /**
     * Block refresh keyboard shortcuts
     */
    function handleKeyDown(event) {
        // Skip if not in a tournament
        if (!checkTournamentStatus()) return;
        
        // Block F5 or Ctrl+R
        if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
            event.preventDefault();
            alert("⚠️ Page refresh is disabled while in tournament mode to prevent disconnection.");
            return false;
        }
    }
    
    /**
     * Hook into Tournament Manager
     */
    function hookTournamentManager() {
        if (!window.TournamentManager) return;
        
        console.log("Tournament manager found - hooking functions");
        
        // Store original functions
        const originalJoined = TournamentManager.handleTournamentJoined;
        const originalUpdate = TournamentManager.handleTournamentUpdate;
        const originalLeft = TournamentManager.handleTournamentLeft;
        
        // Override joined handler
        if (typeof originalJoined === 'function') {
            TournamentManager.handleTournamentJoined = function(tournament) {
                // Call original function
                originalJoined.call(TournamentManager, tournament);
                
                // Update state
                inTournament = true;
                try {
                    localStorage.setItem('inTournament', 'true');
                } catch (e) {}
                
                // Update UI
                updateWarningUI();
            };
        }
        
        // Override update handler
        if (typeof originalUpdate === 'function') {
            TournamentManager.handleTournamentUpdate = function(tournament) {
                // Call original function
                originalUpdate.call(TournamentManager, tournament);
                
                // Update state
                inTournament = true;
                try {
                    localStorage.setItem('inTournament', 'true');
                } catch (e) {}
                
                // Update UI
                updateWarningUI();
            };
        }
        
        // Override left handler
        if (typeof originalLeft === 'function') {
            TournamentManager.handleTournamentLeft = function() {
                // Call original function
                originalLeft.call(TournamentManager);
                
                // Update state
                inTournament = false;
                try {
                    localStorage.setItem('inTournament', 'false');
                } catch (e) {}
                
                // Update UI
                updateWarningUI();
            };
        }
    }
    
    // Set up event listeners
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleNavigationClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Create warning elements
        createWarningElements();
        
        // Hook into TournamentManager (with retry)
        const hookInterval = setInterval(function() {
            if (window.TournamentManager) {
                hookTournamentManager();
                clearInterval(hookInterval);
            }
        }, 200);
        
        // Initial UI update
        updateWarningUI();
    });
    
    // Periodically check tournament status to keep UI in sync
    setInterval(updateWarningUI, 2000);
})();