/**
 * Utils Module
 * Collection of general utility functions used across the application
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
     * Validate if a nickname meets requirements
     * @param {string} nickname - Nickname to validate
     * @returns {boolean} - Whether nickname is valid
     */
    function isValidNickname(nickname) {
      const validNickname = /^[A-Za-z0-9_-]{1,16}$/;
      return validNickname.test(nickname);
    }
    
    /**
     * Check if window size is appropriate for gameplay
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
     * Sanitize HTML string to prevent XSS
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
     * Sleep/delay execution
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after delay
     */
    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Detect if DevTools is open
     * @returns {boolean} - True if DevTools is likely open
     */
    function isDevToolsOpen() {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      return widthThreshold || heightThreshold;
    }
    
    /**
     * Flash or highlight an element briefly
     * @param {HTMLElement} element - Element to highlight
     * @param {string} className - Class to apply for the flash effect
     * @param {number} duration - Duration in ms
     */
    function flashElement(element, className = 'highlight-flash', duration = 1000) {
      if (!element) return;
      
      element.classList.add(className);
      setTimeout(() => {
        element.classList.remove(className);
      }, duration);
    }
    
    // Public API
    return {
      generateToken,
      debounce,
      throttle,
      isValidNickname,
      isWindowSizeValid,
      formatDate,
      detectBrowser,
      isMobileDevice,
      lerp,
      clamp,
      isFullscreenSupported,
      randomItem,
      sanitizeHTML,
      getCsrfToken,
      sleep,
      isDevToolsOpen,
      flashElement
    };
  })();
  
  // Support both module.exports and direct browser usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
  }