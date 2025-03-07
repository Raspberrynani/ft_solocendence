/**
 * Tournament Protection System
 * Prevents users from accidentally leaving tournaments
 */
(function() {
    // Run this code immediately, don't wait for DOMContentLoaded
    console.log("Tournament protection initializing...");
    
    // Store state to survive page refreshes
    let inTournament = false;
    
    // Try to load from localStorage
    try {
        inTournament = localStorage.getItem('inTournament') === 'true';
    } catch (e) {
        console.warn("Could not access localStorage");
    }
    
    // ----- HISTORY CONTROL -----
    
    // Create a history entry stack to prevent back navigation
    let pageStack = ['tournament'];
    
    // Push initial state to set up history control
    history.pushState({page: 'tournament'}, "Tournament", window.location.pathname);
    
    // When back/forward buttons are clicked
    window.addEventListener('popstate', function(event) {
        console.log("Navigation detected");
        
        // Check if we're in tournament mode
        checkTournamentStatus();
        
        if (inTournament) {
            // Show warning
            const wantToLeave = confirm("WARNING: Going back will remove you from the tournament. Are you sure?");
            
            if (wantToLeave) {
                // User confirmed - allow leaving but exit tournament
                leaveTournament();
                return true;
            } else {
                // User cancelled - prevent back navigation by pushing a new state
                console.log("Navigation cancelled - staying in tournament");
                history.pushState({page: 'tournament'}, "Tournament", window.location.pathname);
                return false;
            }
        }
    });
    
    // ----- REFRESH PROTECTION -----
    
    // Stop page refresh
    window.addEventListener('beforeunload', function(event) {
        // Check tournament status
        checkTournamentStatus();
        
        if (inTournament) {
            // Standard way of showing a confirmation dialog
            const message = "WARNING: Refreshing will disconnect you from the tournament!";
            event.preventDefault(); // Cancel the event
            event.returnValue = message; // Chrome requires returnValue to be set
            return message; // For older browsers
        }
    });
    
    // ----- CLICK INTERCEPTION -----
    
    // Global click handler
    document.addEventListener('click', function(event) {
        // Check tournament status
        checkTournamentStatus();
        
        if (!inTournament) return; // Only intercept if in tournament
        
        // Find any navigation elements that were clicked
        let target = event.target;
        while (target && target !== document) {
            // Check for data-navigate attribute (your navigation system)
            if (target.hasAttribute('data-navigate')) {
                const targetPage = target.getAttribute('data-navigate');
                
                // Don't block navigation to pong page
                if (targetPage === 'pong-page') return;
                
                // Block other navigation while in tournament
                event.preventDefault();
                event.stopPropagation();
                
                const wantToLeave = confirm("WARNING: Navigating away will remove you from the tournament. Continue?");
                
                if (wantToLeave) {
                    // User confirmed - leave tournament then navigate
                    leaveTournament();
                    
                    // Delayed navigation to ensure tournament is left first
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
                // Block all link navigation while in tournament
                event.preventDefault();
                event.stopPropagation();
                
                const wantToLeave = confirm("WARNING: Navigating away will remove you from the tournament. Continue?");
                
                if (wantToLeave) {
                    // User confirmed - leave tournament then navigate
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
    }, true); // Use capture phase to intercept events before they reach targets
    
    // ----- KEYBOARD INTERCEPTION -----
    
    // Block refresh shortcuts (F5, Ctrl+R)
    document.addEventListener('keydown', function(event) {
        checkTournamentStatus();
        
        if (!inTournament) return; // Only intercept if in tournament
        
        // F5 key or Ctrl+R
        if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
            event.preventDefault();
            alert("⚠️ Page refresh is disabled while in tournament mode to prevent disconnection.");
            return false;
        }
    }, true);
    
    // ----- TOURNAMENT STATE MANAGEMENT -----
    
    // Check if user is in a tournament
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
                localStorage.setItem('inTournament', inTournament);
            } catch (e) {
                console.warn("Could not store in localStorage", e);
            }
        }
        
        return inTournament;
    }
    
    // Helper function to leave tournament
    function leaveTournament() {
        console.log("Leaving tournament...");
        
        // Try to call actual TournamentManager function
        if (window.TournamentManager && typeof TournamentManager.leaveTournament === 'function') {
            TournamentManager.leaveTournament();
        }
        
        // Update our state
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
     * Clear all tournament warnings and banners
     */
    function clearAllTournamentWarnings() {
        // Clear warning banner
        const banner = document.getElementById('tournament-warning-banner');
        if (banner) {
        banner.style.display = 'none';
        }
        
        // Clear warning message
        const warningElement = document.getElementById('tournament-leave-warning');
        if (warningElement) {
        warningElement.style.display = 'none';
        }
    }
    

    // ----- UI ELEMENTS -----
    
    // We'll add UI elements after the DOM is ready
    window.addEventListener('DOMContentLoaded', function() {
        // Create warning elements
        createWarningElements();
        
        // Hook into TournamentManager
        hookTournamentManager();
    });
    
    // Create warning elements
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
        const warningElement = document.createElement('div');
        warningElement.id = 'tournament-leave-warning';
        warningElement.className = 'exit-warning mt-3';
        warningElement.innerHTML = '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' +
            'WARNING: Leaving this page will remove you from the current tournament!';
        warningElement.style.cssText = `
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
        
        // Add animation style
        const style = document.createElement('style');
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
        
        // Insert warning element before back button
        const backButton = document.getElementById('tournament-back-button');
        if (backButton && backButton.parentNode) {
            backButton.parentNode.insertBefore(warningElement, backButton);
        } else {
            // Fallback - add to tournament page if it exists
            const tournamentPage = document.getElementById('tournament-page');
            if (tournamentPage) {
                tournamentPage.appendChild(warningElement);
            }
        }
        
        // Update UI based on current state
        updateWarningUI();
    }
    
    // Update the UI based on tournament state
    function updateWarningUI() {
        // Get the current state
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
    
    // Hook into TournamentManager to update UI automatically
    function hookTournamentManager() {
        // Wait for TournamentManager to be loaded
        const checkInterval = setInterval(function() {
            if (!window.TournamentManager) return;
            
            clearInterval(checkInterval);
            console.log("Tournament manager found - hooking functions");
            
            // Store original functions if they exist
            const originalJoined = TournamentManager.handleTournamentJoined;
            const originalUpdate = TournamentManager.handleTournamentUpdate;
            const originalLeft = TournamentManager.handleTournamentLeft;
            
            // Override joined handler
            if (typeof originalJoined === 'function') {
                TournamentManager.handleTournamentJoined = function(tournament) {
                    // Call original function
                    originalJoined.call(TournamentManager, tournament);
                    
                    // Update our state
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
                    
                    // Update our state
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
                    
                    // Update our state
                    inTournament = false;
                    try {
                        localStorage.setItem('inTournament', 'false');
                    } catch (e) {}
                    
                    // Update UI
                    updateWarningUI();
                };
            }
            
            // Initial UI update
            updateWarningUI();
        }, 100);
    }
    
    // Check tournament status periodically to keep UI in sync
    setInterval(function() {
        updateWarningUI();
    }, 2000);
})();