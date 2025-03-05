/**
 * UI Manager Module
 * Handles UI state management, navigation, and browser history
 */
const UIManager = (function() {
  // Private variables
  let elements = {};
  let callbacks = {};
  
  // Map of page IDs to URL paths for cleaner URLs
  const pageRoutes = {
      'language-page': '/language',
      'game-page': '/menu',
      'pong-page': '/play',
      'leaderboard-page': '/leaderboard',
      'custom-game-page': '/custom',
      'privacy-policy-page': '/privacy'
  };
  
  // Reverse mapping of paths to page IDs
  const routeToPageId = {};
  Object.keys(pageRoutes).forEach(pageId => {
      routeToPageId[pageRoutes[pageId]] = pageId;
  });
  
  /**
   * Initialize the UI Manager
   * @param {Object} config - Configuration object containing elements and callbacks
   */
  function init(config = {}) {
      elements = config.elements || {};
      callbacks = config.callbacks || {};
      
      console.log("UI Manager initialized with browser history support");
      
      // Set up popstate event listener for browser back/forward buttons
      window.addEventListener('popstate', (event) => {
          const state = event.state;
          if (state && state.pageId) {
              navigateToPage(state.pageId, false); // Don't push state again
          } else {
              // Default to language page if no state exists
              navigateToPage('language-page', false);
          }
      });
      
      // Handle initial page load based on URL
      handleInitialNavigation();
  }
  
  /**
   * Handle initial page load based on URL
   */
  function handleInitialNavigation() {
      // Get the current path from the URL
      const path = window.location.pathname;
      
      // Find the corresponding page ID or default to the language page
      let initialPageId = 'language-page'; // Default
      
      // Special case for root path
      if (path === '/' || path === '') {
          initialPageId = 'language-page';
      } else {
          // Check if the path matches any of our defined routes
          const matchedPageId = routeToPageId[path];
          if (matchedPageId) {
              initialPageId = matchedPageId;
          }
      }
      
      // Navigate to the initial page without pushing state
      navigateToPage(initialPageId, false);
  }
  
  /**
   * Navigate to a specific page and update browser history
   * @param {string} pageId - ID of the page to navigate to
   * @param {boolean} pushState - Whether to push a new history state
   */
  function navigateToPage(pageId, pushState = true) {
      // Hide all pages
      document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
      
      // Show the target page
      const targetPage = document.getElementById(pageId);
      if (targetPage) {
          targetPage.classList.add("active");
      } else {
          console.error(`Page with ID "${pageId}" not found`);
          return;
      }
      
      // Update browser history if requested
      if (pushState) {
          const path = pageRoutes[pageId] || '/';
          const title = getPageTitle(pageId);
          
          // Push new state to browser history
          window.history.pushState({ pageId }, title, path);
          
          // Update document title
          document.title = title;
      }
      
      // Trigger callback if provided
      if (callbacks.onPageChange) {
          callbacks.onPageChange(pageId);
      }
      
      console.log(`Navigated to page: ${pageId}`);
  }
  
  /**
   * Public navigation method that handles both browser history and page activation
   * @param {string} pageId - ID of the page to navigate to
   */
  function navigateTo(pageId) {
      navigateToPage(pageId, true);
  }
  
  /**
   * Get the title for a specific page
   * @param {string} pageId - ID of the page
   * @returns {string} - Page title
   */
  function getPageTitle(pageId) {
      const titles = {
          'language-page': 'Pong.io - Language Selection',
          'game-page': 'Pong.io - Menu',
          'pong-page': 'Pong.io - Game',
          'leaderboard-page': 'Pong.io - Leaderboard',
          'custom-game-page': 'Pong.io - Custom Game',
          'privacy-policy-page': 'Pong.io - Privacy Policy'
      };
      
      return titles[pageId] || 'Pong.io';
  }
  
  /**
   * Toggle the visibility of the start button
   * @param {boolean} show - Whether to show the button
   */
  function toggleStartButton(show) {
      const startButton = elements.startGameButton;
      
      if (!startButton) {
          console.error('Start game button element not found');
          return;
      }
      
      if (show) {
          startButton.classList.remove("hidden");
          
          // Use requestAnimationFrame for smooth transitions
          requestAnimationFrame(() => {
              startButton.style.transition = "opacity 0.5s ease-in-out";
              requestAnimationFrame(() => {
                  startButton.style.opacity = "1";
                  startButton.style.pointerEvents = "auto";
              });
          });
      } else {
          startButton.style.transition = "opacity 0.5s ease-in-out";
          startButton.style.opacity = "0";
          startButton.style.pointerEvents = "none";
          
          setTimeout(() => {
              if (!show) {
                  startButton.classList.add("hidden");
              }
          }, 500);
      }
  }
  
  /**
   * Update UI elements with translated text
   */
  function updateTranslations() {
      if (!elements.languageSelector) {
          console.error('Language selector element not found');
          return;
      }
      
      const currentLang = elements.languageSelector.value;
      
      // Update translatable elements
      if (elements.enterName) {
          elements.enterName.innerText = LocalizationManager.get("enterName");
      }
      
      // Trigger callback
      if (callbacks.onLanguageChange) {
          callbacks.onLanguageChange(currentLang);
      }
  }
  
  /**
   * Show a loading spinner in the specified element
   * @param {HTMLElement} element - Element to show loading spinner in
   */
  function showLoading(element) {
      if (!element) {
          console.error('Element not provided for showLoading');
          return;
      }
      
      element.innerHTML = `
          <div class="d-flex justify-content-center my-3">
              <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
              </div>
          </div>
      `;
  }
  
  /**
   * Show an alert message
   * @param {string} message - Message to display
   * @param {string} type - Alert type (success, info, warning, danger)
   */
  function showAlert(message, type = "warning") {
      const alertId = "ui-alert-" + Date.now();
      const alertElement = document.createElement("div");
      
      alertElement.id = alertId;
      alertElement.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
      alertElement.style.zIndex = "9999";
      alertElement.innerHTML = `
          ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      `;
      
      document.body.appendChild(alertElement);
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
          const alert = document.getElementById(alertId);
          if (alert) {
              alert.classList.remove("show");
              setTimeout(() => alert.remove(), 300);
          }
      }, 5000);
  }
  
  /**
   * Create and show a toast notification
   * @param {string} message - Message to display in the toast
   * @param {string} type - Toast type (success, info, warning, error)
   */
  function showToast(message, type = "info") {
      const toastId = "ui-toast-" + Date.now();
      
      // Map type to Bootstrap color classes
      const typeClasses = {
          success: "bg-success text-white",
          info: "bg-info text-white",
          warning: "bg-warning text-dark",
          error: "bg-danger text-white"
      };
      
      const colorClass = typeClasses[type] || typeClasses.info;
      
      // Create toast container if it doesn't exist
      if (!document.getElementById("toast-container")) {
          const container = document.createElement("div");
          container.id = "toast-container";
          container.className = "toast-container position-fixed bottom-0 end-0 p-3";
          container.style.zIndex = "11";
          document.body.appendChild(container);
      }
      
      // Create toast element
      const toastElement = document.createElement("div");
      toastElement.id = toastId;
      toastElement.className = `toast ${colorClass}`;
      toastElement.setAttribute("role", "alert");
      toastElement.setAttribute("aria-live", "assertive");
      toastElement.setAttribute("aria-atomic", "true");
      
      toastElement.innerHTML = `
          <div class="toast-header">
              <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
              <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
          </div>
          <div class="toast-body">
              ${message}
          </div>
      `;
      
      // Add to container
      document.getElementById("toast-container").appendChild(toastElement);
      
      // Initialize and show using Bootstrap
      const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
      toast.show();
      
      // Remove from DOM after hiding
      toastElement.addEventListener('hidden.bs.toast', () => {
          toastElement.remove();
      });
  }
  
  /**
   * Apply pulse animation to an element
   * @param {HTMLElement} element - Element to animate
   */
  function pulse(element) {
      if (!element) {
          console.error('Element not provided for pulse animation');
          return;
      }
      
      element.classList.add("pulse");
      setTimeout(() => element.classList.remove("pulse"), 1000);
  }
  
  // Public API
  return {
      init,
      navigateTo,
      toggleStartButton,
      updateTranslations,
      showLoading,
      showAlert,
      showToast,
      pulse
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIManager;
}