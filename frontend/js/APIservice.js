/**
 * API Service
 * Handles API requests with proper error handling and CSRF protection
 */
const ApiService = (function() {
    // Configuration
    const config = {
        baseUrl: getBaseApiUrl(),
        csrfHeaderName: 'X-CSRFToken',
        contentType: 'application/json',
        retryCount: 3,
        retryDelay: 1000
    };

    // Private state
    let csrfToken = '';
    let isInitialized = false;

    /**
     * Get base API URL based on current location
     * @returns {string} - API base URL
     */
    function getBaseApiUrl() {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        
        // Using the same port as the page ensures we go through the same Nginx proxy
        const port = window.location.port;
        
        return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
    }

    /**
     * Initialize the API service
     * @returns {Promise} - Resolves when initialized
     */
    async function init() {
        if (isInitialized) {
            return Promise.resolve();
        }

        try {
            // Try to fetch CSRF token with a retry mechanism
            csrfToken = await fetchCsrfToken();
            isInitialized = true;
            console.log('API Service initialized successfully');
            return Promise.resolve();
        } catch (error) {
            console.error('Failed to initialize API Service:', error);
            return Promise.reject(error);
        }
    }

    /**
     * Fetch CSRF token with retry logic
     * @param {number} retries - Number of retries left
     * @returns {Promise<string>} - CSRF token
     */
    async function fetchCsrfToken(retries = config.retryCount) {
        try {
            console.log(`Fetching CSRF token from ${config.baseUrl}/csrf/...`);
            
            const response = await fetch(`${config.baseUrl}/csrf/`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.csrfToken) {
                throw new Error('No CSRF token in response');
            }
            
            console.log('CSRF token fetched successfully');
            return data.csrfToken;
            
        } catch (error) {
            console.error('Failed to fetch CSRF token:', error);
            
            // Retry logic
            if (retries > 0) {
                console.log(`Retrying CSRF token fetch (${retries} retries left)...`);
                await new Promise(resolve => setTimeout(resolve, config.retryDelay));
                return fetchCsrfToken(retries - 1);
            }
            
            throw new Error('Failed to fetch CSRF token: ' + error);
        }
    }

    /**
     * Perform a GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} params - URL parameters
     * @returns {Promise<Object>} - Response data
     */
    async function get(endpoint, params = {}) {
        if (!isInitialized) {
            await init();
        }

        // Build query string from params
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            queryParams.append(key, value);
        });

        const url = `${config.baseUrl}/${endpoint.replace(/^\//, '')}${
            queryParams.toString() ? '?' + queryParams.toString() : ''
        }`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    [config.csrfHeaderName]: csrfToken
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            throw error;
        }
    }

    /**
     * Perform a POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body
     * @returns {Promise<Object>} - Response data
     */
    async function post(endpoint, data = {}) {
        if (!isInitialized) {
            await init();
        }

        const url = `${config.baseUrl}/${endpoint.replace(/^\//, '')}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': config.contentType,
                    'Accept': 'application/json',
                    [config.csrfHeaderName]: csrfToken
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error posting to ${url}:`, error);
            throw error;
        }
    }

    /**
     * Get the base API URL
     * @returns {string} - API base URL
     */
    function getBaseUrl() {
        return config.baseUrl;
    }

    /**
     * Get the current CSRF token
     * @returns {string} - CSRF token
     */
    function getCsrfToken() {
        return csrfToken;
    }

    // Public API
    return {
        init,
        get,
        post,
        getBaseUrl,
        getCsrfToken
    };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}

window.ApiService = ApiService;