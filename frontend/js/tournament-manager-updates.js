/**
 * TournamentManager extension to add tournament completion check 
 * and improve state management on exit
 */

// Store original methods before overriding them
let originalResetTournamentState;
let originalHandleTournamentUpdate;
let originalHandleTournamentLeft;

// Wait for TournamentManager to be available
document.addEventListener('DOMContentLoaded', function() {
  if (window.TournamentManager) {
    console.log("Applying TournamentManager extensions");
    
    // Store original methods
    originalResetTournamentState = TournamentManager.resetTournamentState;
    originalHandleTournamentUpdate = TournamentManager.handleTournamentUpdate;
    originalHandleTournamentLeft = TournamentManager.handleTournamentLeft;
    
    // Add custom state cache
    TournamentManager._currentTournamentState = null;
    
    // Add tournament completion check function
    TournamentManager.isTournamentComplete = function() {
      // We can only check if we're in a tournament
      if (!this.isInTournament() || !this.getCurrentTournamentId()) {
        return false;
      }
      
      // Check cache for current tournament state
      const tournamentState = this._currentTournamentState;
      
      // A tournament is complete when there are no upcoming matches and no current match
      return (
        tournamentState && 
        (!tournamentState.upcoming_matches || tournamentState.upcoming_matches.length === 0) &&
        !tournamentState.current_match
      );
    };
    
    // Add get state function
    TournamentManager.getState = function() {
      return this._currentTournamentState || null;
    };
    
    // Override resetTournamentState
    TournamentManager.resetTournamentState = function() {
      console.log("Enhanced resetTournamentState called");
      
      // Clear tournament state
      this._currentTournamentState = null;
      
      // Clear tournament ID
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem('currentTournament');
          localStorage.removeItem('inTournament');
        } catch (e) {
          console.warn("Could not access localStorage", e);
        }
      }
      
      // Hide UI elements
      const activeTournament = document.getElementById('active-tournament');
      if (activeTournament) {
        activeTournament.style.display = 'none';
      }
      
      // Hide start tournament button
      const startTournament = document.getElementById('start-tournament');
      if (startTournament) {
        startTournament.style.display = 'none';
      }
      
      // Show available tournaments
      const availableTournaments = document.getElementById('available-tournaments');
      if (availableTournaments) {
        availableTournaments.style.display = 'block';
      }
      
      // Hide any warnings
      const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
      if (tournamentLeaveWarning) {
        tournamentLeaveWarning.style.display = 'none';
      }
      
      const tournamentWarningBanner = document.getElementById('tournament-warning-banner');
      if (tournamentWarningBanner) {
        tournamentWarningBanner.style.display = 'none';
      }
      
      // Call original function if available (avoiding recursion)
      if (typeof originalResetTournamentState === 'function') {
        originalResetTournamentState.call(this);
      }
      
      console.log("Tournament state reset complete");
    };
    
    // Override handleTournamentUpdate
    TournamentManager.handleTournamentUpdate = function(tournament) {
      console.log("Enhanced tournament update handler called");
      
      // Cache tournament state for later use
      this._currentTournamentState = tournament;
      
      // Update localStorage flag
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('inTournament', 'true');
          localStorage.setItem('currentTournament', tournament.id);
        } catch (e) {
          console.warn("Could not access localStorage", e);
        }
      }

      // Show leave warning when in a tournament
      const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
      if (tournamentLeaveWarning) {
          tournamentLeaveWarning.style.display = 'block';
      }
      
      // Call original function if available
      if (typeof originalHandleTournamentUpdate === 'function') {
        originalHandleTournamentUpdate.call(this, tournament);
      }
    };
    
    // Override handleTournamentLeft 
    TournamentManager.handleTournamentLeft = function() {
      console.log("Enhanced tournament left handler called");
      
      // Clear cached state
      this._currentTournamentState = null;
      
      // Update localStorage flag
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem('inTournament');
          localStorage.removeItem('currentTournament');
        } catch (e) {
          console.warn("Could not access localStorage", e);
        }
      }
      
      // Hide leave warning
      const tournamentLeaveWarning = document.getElementById('tournament-leave-warning');
      if (tournamentLeaveWarning) {
        tournamentLeaveWarning.style.display = 'none';
      }
      
      // Hide any banner warnings
      const tournamentWarningBanner = document.getElementById('tournament-warning-banner');
      if (tournamentWarningBanner) {
        tournamentWarningBanner.style.display = 'none';
      }
      
      // Call original function if available
      if (typeof originalHandleTournamentLeft === 'function') {
        originalHandleTournamentLeft.call(this);
      }
    };
    
    console.log("TournamentManager extensions applied successfully");
  }
});