/**
 * UI Manager Module
 * Handles UI state management and navigation
 */
const UIManager = (function() {
    // Private variables
    let elements = {};
    let callbacks = {};
    
    /**
     * Initialize the UI Manager
     * @param {Object} config - Configuration object containing elements and callbacks
     */
    function init(config = {}) {
      elements = config.elements || {};
      callbacks = config.callbacks || {};
      
      console.log("UI Manager initialized");
    }
    
    /**
     * Navigate to a specific page
     * @param {string} pageId - ID of the page to navigate to
     */
    function navigateTo(pageId) {
      document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
      document.getElementById(pageId).classList.add("active");
      
      // Trigger callback if provided
      if (callbacks.onPageChange) {
        callbacks.onPageChange(pageId);
      }
      
      console.log(`Navigated to page: ${pageId}`);
    }
    
    /**
     * Toggle the visibility of the start button
     * @param {boolean} show - Whether to show the button
     */
    function toggleStartButton(show) {
      const startButton = elements.startGameButton;
      
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
      const currentLang = elements.languageSelector.value;
      
      // Update translatable elements
      elements.enterName.innerText = LocalizationManager.get("enterName");
      
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