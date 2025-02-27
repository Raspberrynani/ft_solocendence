/**
 * Utilities Module
 * Collection of helper functions used across the application
 */
const Utils = (function() {
  /**
   * Generate a random token
   * @returns {string} - Random token
   */
  function generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  
  /**
   * Debounce a function call
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} - Debounced function
   */
  function debounce(func, wait = 100) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  /**
   * Throttle a function call
   * @param {Function} func - Function to throttle
   * @param {number} limit - Throttle limit in milliseconds
   * @returns {Function} - Throttled function
   */
  function throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
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
    alert(message); // Basic implementation using native alert
    
    // In a real implementation, we would use a more sophisticated alert:
    /*
    const alertId = "ui-alert-" + Date.now();
    const alertElement = document.createElement("div");
    
    alertElement.id = alertId;
    alertElement.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertElement.style.zIndex = "9999";
    alertElement.innerHTML = `
      ${sanitizeHTML(message)}
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
    */
  }
  
  /**
   * Show a toast notification
   * @param {string} message - Message to display in the toast
   * @param {string} type - Toast type (success, info, warning, error)
   */
  function showToast(message, type = "info") {
    console.log(`[${type.toUpperCase()}]: ${message}`);
    
    // In a real implementation, we would create a visual toast notification:
    /*
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
        ${sanitizeHTML(message)}
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
    */
  }
  
  /**
   * Check if the window size is appropriate for gameplay
   * @returns {boolean} - True if window size is valid
   */
  function isWindowSizeValid() {
    const minWidth = 500;
    const minHeight = 300;
    const aspectRatioMin = 1.2; // Minimum width/height ratio
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    
    return width >= minWidth && height >= minHeight && aspectRatio >= aspectRatioMin;
  }
  
  /**
   * Format a date for display
   * @param {Date|string} date - Date to format
   * @returns {string} - Formatted date string
   */
  function formatDate(date) {
    date = date instanceof Date ? date : new Date(date);
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  /**
   * Validate a nickname
   * @param {string} nickname - Nickname to validate
   * @returns {boolean} - True if nickname is valid
   */
  function isValidNickname(nickname) {
    const validNickname = /^[A-Za-z0-9_-]{1,16}$/;
    return validNickname.test(nickname);
  }
  
  /**
   * Detect browser type
   * @returns {string} - Browser name
   */
  function detectBrowser() {
    const userAgent = navigator.userAgent;
    
    if (userAgent.indexOf("Chrome") > -1) {
      return "Chrome";
    } else if (userAgent.indexOf("Safari") > -1) {
      return "Safari";
    } else if (userAgent.indexOf("Firefox") > -1) {
      return "Firefox";
    } else if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) {
      return "IE";
    } else if (userAgent.indexOf("Edge") > -1) {
      return "Edge";
    } else {
      return "Unknown";
    }
  }
  
  /**
   * Check if device is mobile
   * @returns {boolean} - True if device is mobile
   */
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  /**
   * Linear interpolation between two values
   * @param {number} a - Start value
   * @param {number} b - End value
   * @param {number} t - Interpolation factor (0-1)
   * @returns {number} - Interpolated value
   */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  
  /**
   * Clamp a value between min and max
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} - Clamped value
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  
  /**
   * Check if fullscreen is supported
   * @returns {boolean} - True if fullscreen is supported
   */
  function isFullscreenSupported() {
    return document.fullscreenEnabled || 
           document.webkitFullscreenEnabled || 
           document.mozFullScreenEnabled ||
           document.msFullscreenEnabled;
  }
  
  /**
   * Get a random item from an array
   * @param {Array} array - Source array
   * @returns {*} - Random item from array
   */
  function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
  
  /**
   * Sanitize string to prevent XSS
   * @param {string} str - String to sanitize
   * @returns {string} - Sanitized string
   */
  function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  }
  
  /**
   * Get CSRF token from cookies
   * @returns {string} - CSRF token
   */
  function getCsrfToken() {
    return document.cookie.split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1] || '';
  }
  
  // Public API
  return {
    generateToken,
    debounce,
    throttle,
    showLoading,
    showAlert,
    showToast,
    isWindowSizeValid,
    formatDate,
    isValidNickname,
    detectBrowser,
    isMobileDevice,
    lerp,
    clamp,
    isFullscreenSupported,
    randomItem,
    sanitizeHTML,
    getCsrfToken
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}