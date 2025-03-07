/**
 * ErrorHandler Service
 * Centralizes error handling across the application
 */
const ErrorHandler = (function() {
    // Private variables
    const ERROR_DISPLAY_DURATION = 5000; // 5 seconds
  
    /**
     * Show an error message to the user
     * @param {string} message - Error message to display
     * @param {string} type - Error type (error, warning, info)
     * @param {boolean} log - Whether to log to console
     */
    function showError(message, type = "error", log = true) {
      // Use the utils toast if available, otherwise fallback to alert
      if (typeof Utils !== 'undefined' && Utils.showToast) {
        Utils.showToast(message, type);
      } else {
        alert(`[${type.toUpperCase()}]: ${message}`);
      }
      
      // Log to console if requested
      if (log) {
        if (type === "error") {
          console.error(message);
        } else if (type === "warning") {
          console.warn(message);
        } else {
          console.info(message);
        }
      }
    }
    
    /**
     * Handle network-related errors
     * @param {Error|string} error - Error object or message
     */
    function handleNetworkError(error) {
      const message = error instanceof Error ? 
        `Network error: ${error.message}` : 
        `Network error: ${error}`;
      
      showError(message, "warning");
    }
    
    /**
     * Handle game-related errors
     * @param {Error|string} error - Error object or message
     */
    function handleGameError(error) {
      const message = error instanceof Error ? 
        `Game error: ${error.message}` : 
        `Game error: ${error}`;
      
      showError(message, "error");
    }
    
    /**
     * Handle validation errors
     * @param {string} message - Validation error message
     */
    function handleValidationError(message) {
      showError(message, "warning", false); // Don't log validation errors to console
    }
    
    // Public API
    return {
      showError,
      handleNetworkError,
      handleGameError,
      handleValidationError
    };
  })();
  
  /**
   * ApiService
   * Centralizes API calls and authentication
   */
  const ApiService = (function() {
    // Private variables
    let baseUrl = null;
    let csrfToken = null;
    
    /**
     * Initialize the API service
     */
    function init() {
      baseUrl = getApiBaseUrl();
      fetchCsrfToken().then(token => {
        csrfToken = token;
      }).catch(error => {
        ErrorHandler.handleNetworkError("Failed to fetch CSRF token");
      });
    }
    
    /**
     * Get the API base URL
     * @returns {string} - API base URL
     */
    function getApiBaseUrl() {
      // Use the same protocol and host as the current page
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port;
      
      return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
    }
    
    /**
     * Fetch CSRF token
     * @returns {Promise<string>} - CSRF token
     */
    async function fetchCsrfToken() {
      try {
        const response = await fetch(`${baseUrl}/csrf/`);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        document.cookie = `csrftoken=${data.csrfToken}; path=/; SameSite=Lax`;
        return data.csrfToken;
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        throw error;
      }
    }
    
    /**
     * Perform authenticated API request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} - Fetch response
     */
    async function fetchWithAuth(endpoint, options = {}) {
      // If we don't have a CSRF token yet, try to get one
      if (!csrfToken) {
        try {
          csrfToken = await fetchCsrfToken();
        } catch (error) {
          throw new Error("Authentication failed: CSRF token unavailable");
        }
      }
      
      const defaultOptions = {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        credentials: 'include'
      };
      
      const fullUrl = endpoint.startsWith('/') 
        ? `${baseUrl}${endpoint}` 
        : `${baseUrl}/${endpoint}`;
      
      try {
        const response = await fetch(fullUrl, {
          ...defaultOptions,
          ...options
        });
        
        // If we get a 403, try refreshing the CSRF token and retry once
        if (response.status === 403) {
          csrfToken = await fetchCsrfToken();
          const retryOptions = {
            ...defaultOptions,
            ...options,
            headers: {
              ...defaultOptions.headers,
              ...options.headers,
              'X-CSRFToken': csrfToken
            }
          };
          
          return fetch(fullUrl, retryOptions);
        }
        
        return response;
      } catch (error) {
        ErrorHandler.handleNetworkError(error);
        throw error;
      }
    }
    
    /**
     * Parse API response
     * @param {Response} response - Fetch response
     * @returns {Promise<Object>} - Parsed response data
     */
    async function parseResponse(response) {
      if (!response.ok) {
        // Try to get error details from response
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error ${response.status}`);
        } catch (e) {
          // If we can't parse JSON, use status text
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
      }
      
      // For 204 No Content, return empty object
      if (response.status === 204) {
        return {};
      }
      
      // Parse JSON response
      try {
        return await response.json();
      } catch (error) {
        throw new Error("Invalid JSON response from server");
      }
    }
    
    // Public API
    return {
      init,
      getBaseUrl: () => baseUrl,
      
      // GET request
      async get(endpoint) {
        const response = await fetchWithAuth(endpoint);
        return parseResponse(response);
      },
      
      // POST request
      async post(endpoint, data) {
        const response = await fetchWithAuth(endpoint, {
          method: 'POST',
          body: JSON.stringify(data)
        });
        return parseResponse(response);
      },
      
      // PUT request
      async put(endpoint, data) {
        const response = await fetchWithAuth(endpoint, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
        return parseResponse(response);
      },
      
      // DELETE request
      async delete(endpoint) {
        const response = await fetchWithAuth(endpoint, {
          method: 'DELETE'
        });
        return parseResponse(response);
      },
      
      // Expose raw fetch for advanced usage
      fetchWithAuth
    };
  })();
  
    /**
   * Enhanced DevToolsDetector Service
   * Combines multiple techniques to detect if DevTools is open.
   */
  const DevToolsDetector = (function() {
    // Private variables
    let isDevToolsOpen = false;
    let lastCheck = Date.now();
    let warningDisplayed = false;
    let checkInterval = null;

    /**
     * Combines multiple detection methods:
     * 1. Window size difference check.
     * 2. Debugger timing check.
     * 3. toString override check.
     * @returns {boolean} - Whether DevTools appear to be open.
     */
    function checkDevTools() {
      // Method 1: Window dimensions difference
      // const threshold = 100; // pixels difference threshold
      // const widthDiff = window.outerWidth - window.innerWidth;
      // const heightDiff = window.outerHeight - window.innerHeight;
      // const sizeDetected = (widthDiff > threshold || heightDiff > threshold);

      // Method 2: Debugger timing check
      let debuggerDetected = false;
      const now = Date.now();
      if (now - lastCheck > 1000) { // check at most once every second
        lastCheck = now;
        const start = performance.now();
        debugger; // This statement may slow down execution if DevTools are open
        const end = performance.now();
        debuggerDetected = (end - start > 50); // if delay exceeds 50ms, flag it
      }

      // Method 3: toString override trick
      let toStringDetected = false;
      const dummy = {
        toString: function() {
          toStringDetected = true;
          return '';
        }
      };
      // Force stringification by logging dummy object.
      console.log(dummy);

      // Combine results from all methods.
      const detected = sizeDetected || debuggerDetected || toStringDetected;
      isDevToolsOpen = detected;
      return detected;
    }

    /**
     * Creates and shows a full-screen warning overlay if DevTools are detected.
     */
    function showWarning() {
      if (warningDisplayed) return;
      warningDisplayed = true;

      // If a warning overlay is already in the DOM, don't add another.
      const existingWarning = document.querySelector('.fair-play-warning');
      if (existingWarning) return;

      const warning = document.createElement('div');
      warning.className = 'fair-play-warning';
      warning.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(220, 53, 69, 0.9);
        color: white;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 20px;
        text-align: center;
        animation: fadeIn 0.5s ease-in-out;
      `;
      warning.innerHTML = `
        <div class="warning-content">
          <h3 class="mb-3">Fair Play Notice</h3>
          <p class="mb-4">We've detected that developer tools might be open. For fair gameplay and an optimal experience, please close them before continuing.</p>
          <button class="btn btn-light px-4 py-2">Continue Playing</button>
        </div>
      `;
      warning.querySelector('button').addEventListener('click', () => {
        warning.remove();
        warningDisplayed = false;
      });
      document.body.appendChild(warning);

      // Auto-dismiss the warning after 8 seconds
      setTimeout(() => {
        if (document.body.contains(warning)) {
          warning.remove();
          warningDisplayed = false;
        }
      }, 8000);
    }

    /**
     * Global event handler that checks for DevTools on every user action.
     */
    function globalEventHandler() {
      if (checkDevTools()) {
        showWarning();
      }
    }

    /**
     * Attach global event listeners so that every click, keydown, mousemove, or touchstart triggers a check.
     */
    function attachGlobalListeners() {
      const events = ['click', 'keydown', 'mousemove', 'touchstart'];
      events.forEach(eventName => {
        document.addEventListener(eventName, globalEventHandler, false);
      });
    }

    /**
     * Remove the global event listeners.
     */
    function removeGlobalListeners() {
      const events = ['click', 'keydown', 'mousemove', 'touchstart'];
      events.forEach(eventName => {
        document.removeEventListener(eventName, globalEventHandler, false);
      });
    }

    /**
     * Start monitoring for DevTools by using both an interval check and global event listeners.
     * @param {number} interval - The interval (in milliseconds) between interval checks.
     */
    function startMonitoring(interval = 1000) {
      attachGlobalListeners();
      checkInterval = setInterval(() => {
        if (checkDevTools()) {
          showWarning();
        }
      }, interval);
      console.log("DevTools detection monitoring started");
    }

    /**
     * Stop monitoring for DevTools.
     */
    function stopMonitoring() {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      removeGlobalListeners();
    }

    // Public API
    return {
      startMonitoring,
      stopMonitoring,
      check: checkDevTools,
      isDevToolsOpen: () => isDevToolsOpen
    };
  })();

  /**
   * LocalStorageService
   * Provides a wrapper for localStorage with error handling and type conversion
   */
  const LocalStorageService = (function() {
    /**
     * Set an item in localStorage with JSON stringification
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} - Success status
     */
    function setItem(key, value) {
      try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
        return true;
      } catch (error) {
        console.warn(`Failed to store ${key} in localStorage:`, error);
        return false;
      }
    }
    
    /**
     * Get an item from localStorage with JSON parsing
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} - Retrieved value or default
     */
    function getItem(key, defaultValue = null) {
      try {
        const serialized = localStorage.getItem(key);
        if (serialized === null) return defaultValue;
        return JSON.parse(serialized);
      } catch (error) {
        console.warn(`Failed to retrieve ${key} from localStorage:`, error);
        return defaultValue;
      }
    }
    
    /**
     * Remove an item from localStorage
     * @param {string} key - Storage key
     * @returns {boolean} - Success status
     */
    function removeItem(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.warn(`Failed to remove ${key} from localStorage:`, error);
        return false;
      }
    }
    
    /**
     * Clear all items from localStorage
     * @returns {boolean} - Success status
     */
    function clear() {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        console.warn('Failed to clear localStorage:', error);
        return false;
      }
    }
    
    /**
     * Check if a key exists in localStorage
     * @param {string} key - Storage key
     * @returns {boolean} - Whether key exists
     */
    function hasItem(key) {
      return localStorage.getItem(key) !== null;
    }
    
    // Public API
    return {
      setItem,
      getItem,
      removeItem,
      clear,
      hasItem
    };
  })();
  
  // Initialize services that need initialization when the script loads
  document.addEventListener('DOMContentLoaded', function() {
    if (ApiService.init) {
      ApiService.init();
    }
  });

  window.ErrorHandler = ErrorHandler;
  window.ApiService = ApiService;
  window.DevToolsDetector = DevToolsDetector;
  window.LocalStorageService = LocalStorageService;
