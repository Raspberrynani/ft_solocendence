/**
 * Utilities Module - Optimized Version
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
      let lastFunc;
      let lastRan;
      
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          lastRan = Date.now();
          inThrottle = true;
        } else {
          clearTimeout(lastFunc);
          lastFunc = setTimeout(() => {
            if (Date.now() - lastRan >= limit) {
              func.apply(this, args);
              lastRan = Date.now();
            }
          }, limit - (Date.now() - lastRan));
        }
      };
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
    }
    
    /**
     * Show a toast notification
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
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${sanitizeHTML(message)}
        </div>
      `;
      
      // Add to container
      document.getElementById("toast-container").appendChild(toastElement);
      
      // Initialize and show using Bootstrap
      if (typeof bootstrap !== 'undefined') {
        const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
        toast.show();
      } else {
        // Fallback if Bootstrap JS is not loaded
        toastElement.classList.add('show');
        setTimeout(() => {
          toastElement.classList.remove('show');
          setTimeout(() => toastElement.remove(), 300);
        }, 5000);
      }
      
      // Remove from DOM after hiding
      toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
      });
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
     * @param {Object} options - Formatting options
     * @returns {string} - Formatted date string
     */
    function formatDate(date, options = {}) {
      date = date instanceof Date ? date : new Date(date);
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      
      const formatOptions = { ...defaultOptions, ...options };
      
      return date.toLocaleDateString(undefined, formatOptions);
    }
    
    /**
     * Validate a nickname
     * @param {string} nickname - Nickname to validate
     * @returns {boolean} - True if nickname is valid
     */
    function isValidNickname(nickname) {
      if (!nickname || typeof nickname !== 'string') return false;
      
      // Nicknames must be 1-16 characters with only alphanumeric, underscore, or hyphen
      const validNickname = /^[A-Za-z0-9_-]{1,16}$/;
      return validNickname.test(nickname);
    }
    
    /**
     * Detect browser type and version
     * @returns {Object} - Browser information
     */
    function detectBrowser() {
      const userAgent = navigator.userAgent;
      let browserName = "Unknown";
      let browserVersion = "Unknown";
      
      // Detect Edge first (as it also contains Chrome)
      if (userAgent.indexOf("Edg") > -1) {
        browserName = "Edge";
        browserVersion = userAgent.match(/Edg\/([0-9]+\.[0-9]+)/)?.[1] || "Unknown";
      }
      // Chrome
      else if (userAgent.indexOf("Chrome") > -1) {
        browserName = "Chrome";
        browserVersion = userAgent.match(/Chrome\/([0-9]+\.[0-9]+)/)?.[1] || "Unknown";
      }
      // Safari
      else if (userAgent.indexOf("Safari") > -1) {
        browserName = "Safari";
        browserVersion = userAgent.match(/Version\/([0-9]+\.[0-9]+)/)?.[1] || "Unknown";
      }
      // Firefox
      else if (userAgent.indexOf("Firefox") > -1) {
        browserName = "Firefox";
        browserVersion = userAgent.match(/Firefox\/([0-9]+\.[0-9]+)/)?.[1] || "Unknown";
      }
      // IE / Trident
      else if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) {
        browserName = "IE";
        browserVersion = userAgent.match(/(?:MSIE |rv:)([0-9]+\.[0-9]+)/)?.[1] || "Unknown";
      }
      
      return {
        name: browserName,
        version: browserVersion,
        userAgent
      };
    }
    
    /**
     * Check if device is mobile
     * @returns {boolean} - True if device is mobile
     */
    function isMobileDevice() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (window.innerWidth <= 768);
    }
    
    /**
     * Linear interpolation between two values
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} - Interpolated value
     */
    function lerp(a, b, t) {
      // Ensure t is between 0 and 1
      t = Math.max(0, Math.min(1, t));
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
     * Determine if the browser supports fullscreen mode
     * @returns {boolean} - True if fullscreen is supported
     */
    function isFullscreenSupported() {
      return document.fullscreenEnabled || 
             document.webkitFullscreenEnabled || 
             document.mozFullScreenEnabled ||
             document.msFullscreenEnabled;
    }
    
    /**
     * Enter fullscreen mode for an element
     * @param {HTMLElement} element - Element to display in fullscreen
     * @returns {Promise} - Promise that resolves when fullscreen is entered
     */
    function enterFullscreen(element) {
      if (!element) {
        return Promise.reject(new Error("No element provided for fullscreen"));
      }
      
      try {
        if (element.requestFullscreen) {
          return element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          return element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          return element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
          return element.msRequestFullscreen();
        }
      } catch (error) {
        console.error("Error entering fullscreen:", error);
        return Promise.reject(error);
      }
      
      return Promise.reject(new Error("Fullscreen not supported"));
    }
    
    /**
     * Exit fullscreen mode
     * @returns {Promise} - Promise that resolves when fullscreen is exited
     */
    function exitFullscreen() {
      try {
        if (document.exitFullscreen) {
          return document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          return document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          return document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          return document.msExitFullscreen();
        }
      } catch (error) {
        console.error("Error exiting fullscreen:", error);
        return Promise.reject(error);
      }
      
      return Promise.reject(new Error("Fullscreen not supported"));
    }
    
    /**
     * Get a random item from an array
     * @param {Array} array - Source array
     * @returns {*} - Random item from array
     */
    function randomItem(array) {
      if (!Array.isArray(array) || array.length === 0) {
        return undefined;
      }
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
    
    /**
     * Generate a random color
     * @param {number} opacity - Color opacity (0-1)
     * @returns {string} - CSS color string
     */
    function randomColor(opacity = 1) {
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    /**
     * Get the percentage of screen width or height
     * @param {number} percent - Percentage (0-100)
     * @param {string} dimension - 'width' or 'height'
     * @returns {number} - Calculated pixel value
     */
    function screenPercent(percent, dimension = 'width') {
      if (dimension === 'width') {
        return (window.innerWidth * percent) / 100;
      } else {
        return (window.innerHeight * percent) / 100;
      }
    }
    
    /**
     * Convert pixels to viewport units
     * @param {number} px - Pixel value
     * @param {string} unit - 'vw' or 'vh'
     * @returns {number} - Viewport unit value
     */
    function pxToViewport(px, unit = 'vw') {
      if (unit === 'vw') {
        return (px / window.innerWidth) * 100;
      } else {
        return (px / window.innerHeight) * 100;
      }
    }
    
    /**
     * Apply a CSS animation to an element
     * @param {HTMLElement} element - Target element
     * @param {string} animationName - CSS animation name
     * @param {number} duration - Animation duration in ms
     * @returns {Promise} - Promise that resolves when animation ends
     */
    function animateElement(element, animationName, duration = 1000) {
      return new Promise(resolve => {
        if (!element) {
          resolve();
          return;
        }
        
        element.style.animation = `${animationName} ${duration}ms`;
        
        const handleAnimationEnd = () => {
          element.style.animation = '';
          element.removeEventListener('animationend', handleAnimationEnd);
          resolve();
        };
        
        element.addEventListener('animationend', handleAnimationEnd);
      });
    }
    
    /**
     * Check if an element is visible in the viewport
     * @param {HTMLElement} element - Element to check
     * @param {number} threshold - Visibility threshold (0-1)
     * @returns {boolean} - Whether element is visible
     */
    function isElementVisible(element, threshold = 0.5) {
      if (!element) return false;
      
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const windowWidth = window.innerWidth || document.documentElement.clientWidth;
      
      // Check if element is mostly visible
      const verticalVisible = (
        rect.top <= windowHeight * (1 - threshold) &&
        rect.bottom >= windowHeight * threshold
      );
      
      const horizontalVisible = (
        rect.left <= windowWidth * (1 - threshold) &&
        rect.right >= windowWidth * threshold
      );
      
      return verticalVisible && horizontalVisible;
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
      enterFullscreen,
      exitFullscreen,
      randomItem,
      sanitizeHTML,
      getCsrfToken,
      randomColor,
      screenPercent,
      pxToViewport,
      animateElement,
      isElementVisible
    };
  })();
  
  // Export for ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
  }

  window.Utils = Utils;