/**
 * Page Manager Module
 * Handles page navigation and UI state
 */
const PageManager = (function() {
    // Private variables
    let currentPage = null;
    let callbacks = {};
    let pages = {};
    let translatable = [];
    
    /**
     * Initialize the page manager
     * @param {Object} config - Configuration object
     * @returns {Object} - Public API
     */
    function init(config = {}) {
      callbacks = config.callbacks || {};
      
      // Cache page elements
      cachePages();
      
      // Cache translatable elements
      cacheTranslatableElements();
      
      console.log("Page manager initialized");
      
      return publicAPI;
    }
    
    /**
     * Cache all page elements
     */
    function cachePages() {
      // Get all elements with class "page"
      const pageElements = document.querySelectorAll(".page");
      
      if (pageElements.length === 0) {
        console.error("No page elements found");
        return;
      }
      
      // Store pages by ID
      pageElements.forEach(page => {
        const id = page.id;
        
        if (!id) {
          console.warn("Page element without ID:", page);
          return;
        }
        
        pages[id] = page;
      });
      
      console.log(`Cached ${Object.keys(pages).length} pages`);
    }
    
    /**
     * Cache elements with data-i18n attribute for translation
     */
    function cacheTranslatableElements() {
      translatable = document.querySelectorAll('[data-i18n]');
      console.log(`Found ${translatable.length} translatable elements`);
    }
    
    /**
     * Navigate to a specific page
     * @param {string} pageId - ID of the page to navigate to
     * @returns {boolean} - Whether navigation was successful
     */
    function navigateTo(pageId) {
      if (!pages[pageId]) {
        console.error(`Page not found: ${pageId}`);
        return false;
      }
      
      // Hide all pages
      Object.values(pages).forEach(page => {
        page.classList.remove("active");
      });
      
      // Show the target page
      pages[pageId].classList.add("active");
      
      // Update current page reference
      currentPage = pageId;
      
      // Call the onPageChange callback if provided
      if (callbacks.onPageChange) {
        try {
          callbacks.onPageChange(pageId);
        } catch (error) {
          console.error("Error in onPageChange callback:", error);
        }
      }
      
      console.log(`Navigated to page: ${pageId}`);
      return true;
    }
    
    /**
     * Get the current page ID
     * @returns {string|null} - Current page ID
     */
    function getCurrentPage() {
      return currentPage;
    }
    
    /**
     * Update translations for all translatable elements
     */
    function updateTranslations() {
      if (!translatable.length) {
        cacheTranslatableElements();
      }
      
      translatable.forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) {
          element.textContent = I18nManager.get(key);
        }
      });
      
      console.log("Updated translations for all elements");
    }
    
    /**
     * Show a loading spinner in a container
     * @param {HTMLElement} container - Container element
     * @param {string} size - Size of the spinner (sm, md, lg)
     */
    function showLoading(container, size = "md") {
      if (!container) return;
      
      // Create loading spinner HTML
      const spinnerSize = size === "sm" ? "spinner-border-sm" : "";
      const html = `
        <div class="d-flex justify-content-center my-3">
          <div class="spinner-border text-primary ${spinnerSize}" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      `;
      
      // Add to container
      container.innerHTML = html;
    }
    
    /**
     * Show an alert to the user
     * @param {string} message - Alert message
     * @param {string} type - Alert type (success, info, warning, danger)
     * @param {number} timeout - Auto-dismiss timeout in ms (0 for no auto-dismiss)
     */
    function showAlert(message, type = "warning", timeout = 5000) {
      // Create alert element
      const alertId = "ui-alert-" + Date.now();
      const alertElement = document.createElement("div");
      
      alertElement.id = alertId;
      alertElement.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
      alertElement.style.zIndex = "9999";
      alertElement.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      `;
      
      // Add to body
      document.body.appendChild(alertElement);
      
      // Initialize Bootstrap alert
      const bsAlert = new bootstrap.Alert(alertElement);
      
      // Auto-dismiss after timeout
      if (timeout > 0) {
        setTimeout(() => {
          try {
            bsAlert.close();
          } catch (error) {
            // Fallback if Bootstrap alert fails
            alertElement.remove();
          }
        }, timeout);
      }
      
      // Add event listener to remove from DOM after hidden
      alertElement.addEventListener('closed.bs.alert', () => {
        alertElement.remove();
      });
    }
    
    /**
     * Show a toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, info, warning, error)
     * @param {number} timeout - Auto-dismiss timeout in ms
     */
    function showToast(message, type = "info", timeout = 5000) {
      // Create toast ID
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
      const toast = new bootstrap.Toast(toastElement, { 
        autohide: true, 
        delay: timeout 
      });
      
      toast.show();
      
      // Remove from DOM after hiding
      toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
      });
    }
    
    // Public API
    const publicAPI = {
      init,
      navigateTo,
      getCurrentPage,
      updateTranslations,
      showLoading,
      showAlert,
      showToast
    };
    
    return publicAPI;
  })();