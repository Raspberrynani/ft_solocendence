/**
 * UI Manager Module - Optimized
 * Handles UI state management, navigation, and browser history
 */
const UIManager = (function() {
    // Private variables
    let elements = {};
    let callbacks = {};
    let currentPage = null;
    let isTransitioning = false;
    
    // Map of page IDs to URL paths for cleaner URLs
    const pageRoutes = {
    'language-page': '/language',
    'game-page': '/menu',
    'pong-page': '/play',
    'leaderboard-page': '/leaderboard',
    'custom-game-page': '/custom',
    'tournament-page': '/tournament',
    'privacy-policy-page': '/privacy',
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
      
      // Set up window resize handler
      window.addEventListener('resize', Utils.debounce(() => {
        checkWindowSize();
      }, 250));
      
      // Initial window size check
      checkWindowSize();
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
      // Prevent navigation during transitions
      if (isTransitioning) {
        console.warn("Navigation blocked: transition in progress");
        return;
      }
      
      // Skip if already on the requested page
      if (currentPage === pageId) {
        console.log(`Already on page: ${pageId}`);
        return;
      }
      
      isTransitioning = true;
      
      // Hide all pages
      document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
        // This ensures we don't have weird transitions when page is not visible
        page.style.display = "none";
      });
      
      // Show the target page
      const targetPage = document.getElementById(pageId);
      if (targetPage) {
        // Set display before adding active class to ensure smooth transition
        targetPage.style.display = "block";
        
        // Wait for next frame to add active class for animation
        requestAnimationFrame(() => {
          targetPage.classList.add("active");
          isTransitioning = false;
          currentPage = pageId;
        });
      } else {
        console.error(`Page with ID "${pageId}" not found`);
        isTransitioning = false;
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
        'language-page': 'Solocendence - Language Selection',
        'game-page': 'Solocendence - Menu',
        'pong-page': 'Solocendence - Game',
        'leaderboard-page': 'Solocendence - Leaderboard',
        'custom-game-page': 'Solocendence - Custom Game',
        'privacy-policy-page': 'Solocendence - Privacy Policy'
      };
      
      return titles[pageId] || 'Solocendence';
    }
    
    /**
     * Toggle the visibility of an element with smooth transition
     * @param {HTMLElement|string} element - Element or element ID to toggle
     * @param {boolean} show - Whether to show the element
     * @param {number} duration - Transition duration in ms
     * @returns {Promise} - Promise that resolves when transition is complete
     */
    function toggleElement(element, show, duration = 500) {
      // Get element by ID if string is provided
      if (typeof element === 'string') {
        element = document.getElementById(element);
      }
      
      if (!element) {
        console.error('Element not found');
        return Promise.reject(new Error('Element not found'));
      }
      
      return new Promise(resolve => {
        if (show) {
          // Show element
          element.classList.remove("hidden");
          
          // Use requestAnimationFrame for smooth transitions
          requestAnimationFrame(() => {
            element.style.transition = `opacity ${duration}ms ease-in-out`;
            requestAnimationFrame(() => {
              element.style.opacity = "1";
              element.style.pointerEvents = "auto";
              
              // Resolve promise after transition completes
              setTimeout(resolve, duration);
            });
          });
        } else {
          // Hide element
          element.style.transition = `opacity ${duration}ms ease-in-out`;
          element.style.opacity = "0";
          element.style.pointerEvents = "none";
          
          // Add hidden class after transition completes
          setTimeout(() => {
            element.classList.add("hidden");
            resolve();
          }, duration);
        }
      });
    }
    
    /**
     * Toggle the visibility of the start button
     * @param {boolean} show - Whether to show the button
     */
    function toggleStartButton(show) {
      if (!elements.startGame) {
        console.error('Start game button element not found');
        return;
      }
      
      toggleElement(elements.startGame, show);
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
      
      // Find all elements with data-i18n attribute
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        
        // Use LocalizationManager if available
        if (typeof LocalizationManager !== 'undefined' && LocalizationManager.get) {
          el.textContent = LocalizationManager.get(key);
        }
      });
      
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
     * @param {number} duration - Auto-dismiss duration in ms (0 for no auto-dismiss)
     */
    function showAlert(message, type = "warning", duration = 5000) {
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
      
      // Auto-dismiss after specified duration (if not 0)
      if (duration > 0) {
        setTimeout(() => {
          const alert = document.getElementById(alertId);
          if (alert) {
            alert.classList.remove("show");
            setTimeout(() => alert.remove(), 300);
          }
        }, duration);
      }
      
      // Return the alert element for direct manipulation
      return alertElement;
    }
    
    /**
     * Create and show a toast notification
     * @param {string} message - Message to display in the toast
     * @param {string} type - Toast type (success, info, warning, error)
     * @param {number} duration - Duration in ms (0 for no auto-dismiss)
     */
    function showToast(message, type = "info", duration = 5000) {
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
      if (typeof bootstrap !== 'undefined') {
        const toastOptions = {
          autohide: duration > 0,
          delay: duration
        };
        const toast = new bootstrap.Toast(toastElement, toastOptions);
        toast.show();
      } else {
        // Fallback for when Bootstrap JS is not available
        toastElement.classList.add('show');
        
        if (duration > 0) {
          setTimeout(() => {
            toastElement.classList.remove('show');
            setTimeout(() => toastElement.remove(), 300);
          }, duration);
        }
      }
      
      // Remove from DOM after hiding
      toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
      });
      
      // Return the toast element for direct manipulation
      return toastElement;
    }
    
    /**
     * Check window size and show warning if too small
     */
    function checkWindowSize() {
      const minWidth = 500;
      const minHeight = 300;
      
      if (window.innerWidth < minWidth || window.innerHeight < minHeight) {
        showWindowSizeWarning(true);
      } else {
        showWindowSizeWarning(false);
      }
    }
    
    /**
     * Show/hide window size warning
     * @param {boolean} show - Whether to show the warning
     */
    function showWindowSizeWarning(show) {
      let warningElement = document.querySelector('.window-size-warning');
      
      if (show) {
        if (!warningElement) {
          warningElement = document.createElement('div');
          warningElement.className = 'window-size-warning';
          warningElement.innerHTML = 'Window size too small for optimal gameplay!';
          document.body.appendChild(warningElement);
          
          // Force reflow before adding active class for transition
          void warningElement.offsetWidth;
        }
        warningElement.classList.add('active');
      } else if (warningElement) {
        warningElement.classList.remove('active');
      }
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
      
      element.classList.remove("pulse");
      
      // Force reflow to restart animation
      void element.offsetWidth;
      
      element.classList.add("pulse");
      setTimeout(() => element.classList.remove("pulse"), 1000);
    }
    
    /**
     * Create a modal dialog
     * @param {Object} options - Modal options
     * @returns {HTMLElement} - Modal element
     */
    function createModal(options = {}) {
      const {
        title = "",
        content = "",
        onClose = null,
        showCloseButton = true,
        backdrop = true,
        size = "medium" // small, medium, large
      } = options;
      
      // Create modal container
      const modalContainer = document.createElement('div');
      modalContainer.className = 'custom-modal-container';
      modalContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1050;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      `;
      
      // Create backdrop if enabled
      if (backdrop) {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'custom-modal-backdrop';
        modalBackdrop.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
        `;
        modalContainer.appendChild(modalBackdrop);
        
        // Close on backdrop click if close button is shown
        if (showCloseButton) {
          modalBackdrop.addEventListener('click', () => {
            closeModal(modalContainer);
            if (typeof onClose === 'function') {
              onClose();
            }
          });
        }
      }
      
      // Set modal size
      let modalWidth = "400px";
      if (size === "small") modalWidth = "300px";
      if (size === "large") modalWidth = "600px";
      
      // Create modal dialog
      const modalDialog = document.createElement('div');
      modalDialog.className = 'custom-modal-dialog';
      modalDialog.style.cssText = `
        position: relative;
        width: 100%;
        max-width: ${modalWidth};
        background: rgba(0, 0, 0, 0.8);
        border-radius: 10px;
        padding: 20px;
        box-shadow: 0 4px 20px rgba(0, 212, 255, 0.5);
        z-index: 1051;
        overflow: hidden;
      `;
      
      // Create modal content
      let modalHTML = '';
      
      // Add title if provided
      if (title) {
        modalHTML += `<div class="custom-modal-header">
          <h4 class="custom-modal-title">${title}</h4>
          ${showCloseButton ? '<button type="button" class="btn-close btn-close-white custom-modal-close" aria-label="Close"></button>' : ''}
        </div>`;
      }
      
      // Add content
      modalHTML += `<div class="custom-modal-body">${content}</div>`;
      
      // Set dialog content
      modalDialog.innerHTML = modalHTML;
      
      // Add close button functionality
      if (showCloseButton) {
        const closeButton = modalDialog.querySelector('.custom-modal-close');
        if (closeButton) {
          closeButton.addEventListener('click', () => {
            closeModal(modalContainer);
            if (typeof onClose === 'function') {
              onClose();
            }
          });
        }
      }
      
      // Add dialog to container
      modalContainer.appendChild(modalDialog);
      
      // Add to body
      document.body.appendChild(modalContainer);
      
      // Show modal with animation
      setTimeout(() => {
        modalContainer.style.opacity = '1';
        modalContainer.style.pointerEvents = 'auto';
      }, 50);
      
      return modalContainer;
    }
    
    /**
     * Close a modal dialog
     * @param {HTMLElement} modal - Modal element to close
     */
    function closeModal(modal) {
      if (!modal) return;
      
      // Animate out
      modal.style.opacity = '0';
      modal.style.pointerEvents = 'none';
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 300);
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
      pulse,
      checkWindowSize,
      toggleElement,
      createModal,
      closeModal,
      getPageTitle,
      getCurrentPage: () => currentPage
    };
  })();
  
  // Export for ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
  }

  window.UIManager = UIManager;
