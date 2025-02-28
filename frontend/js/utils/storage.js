/**
 * Storage Module
 * Handles local storage operations with fallbacks and error handling
 */
const Storage = (function() {
    // Check if localStorage is available
    let storageAvailable = false;
    
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      storageAvailable = true;
    } catch (e) {
      console.warn('localStorage not available, using memory fallback');
      storageAvailable = false;
    }
    
    // Memory fallback when localStorage isn't available
    const memoryStorage = {};
    
    /**
     * Set an item in storage
     * @param {string} key - Storage key
     * @param {*} value - Value to store (will be JSON stringified)
     * @returns {boolean} - Whether operation was successful
     */
    function setItem(key, value) {
      if (!key) return false;
      
      try {
        const serializedValue = JSON.stringify(value);
        
        if (storageAvailable) {
          localStorage.setItem(key, serializedValue);
        } else {
          memoryStorage[key] = serializedValue;
        }
        
        return true;
      } catch (e) {
        console.error('Error saving to storage:', e);
        return false;
      }
    }
    
    /**
     * Get an item from storage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} - Retrieved value (JSON parsed) or defaultValue
     */
    function getItem(key, defaultValue = null) {
      if (!key) return defaultValue;
      
      try {
        let serializedValue;
        
        if (storageAvailable) {
          serializedValue = localStorage.getItem(key);
        } else {
          serializedValue = memoryStorage[key] || null;
        }
        
        if (serializedValue === null) {
          return defaultValue;
        }
        
        return JSON.parse(serializedValue);
      } catch (e) {
        console.error('Error retrieving from storage:', e);
        return defaultValue;
      }
    }
    
    /**
     * Remove an item from storage
     * @param {string} key - Storage key to remove
     * @returns {boolean} - Whether operation was successful
     */
    function removeItem(key) {
      if (!key) return false;
      
      try {
        if (storageAvailable) {
          localStorage.removeItem(key);
        } else {
          delete memoryStorage[key];
        }
        
        return true;
      } catch (e) {
        console.error('Error removing from storage:', e);
        return false;
      }
    }
    
    /**
     * Clear all items from storage
     * @returns {boolean} - Whether operation was successful
     */
    function clear() {
      try {
        if (storageAvailable) {
          localStorage.clear();
        } else {
          for (const key in memoryStorage) {
            delete memoryStorage[key];
          }
        }
        
        return true;
      } catch (e) {
        console.error('Error clearing storage:', e);
        return false;
      }
    }
    
    /**
     * Get all keys in storage
     * @returns {Array<string>} - Array of keys
     */
    function getKeys() {
      try {
        if (storageAvailable) {
          return Object.keys(localStorage);
        } else {
          return Object.keys(memoryStorage);
        }
      } catch (e) {
        console.error('Error getting storage keys:', e);
        return [];
      }
    }
    
    /**
     * Check if a key exists in storage
     * @param {string} key - Key to check
     * @returns {boolean} - Whether key exists
     */
    function hasKey(key) {
      if (!key) return false;
      
      try {
        if (storageAvailable) {
          return localStorage.getItem(key) !== null;
        } else {
          return memoryStorage.hasOwnProperty(key);
        }
      } catch (e) {
        console.error('Error checking storage key:', e);
        return false;
      }
    }
    
    /**
     * Save game settings to storage
     * @param {Object} settings - Game settings object
     * @returns {boolean} - Whether operation was successful
     */
    function saveGameSettings(settings) {
      return setItem('pong_game_settings', settings);
    }
    
    /**
     * Load game settings from storage
     * @param {Object} defaultSettings - Default settings to use if not found
     * @returns {Object} - Game settings
     */
    function loadGameSettings(defaultSettings = {}) {
      return getItem('pong_game_settings', defaultSettings);
    }
    
    /**
     * Save player nickname to storage
     * @param {string} nickname - Player nickname
     * @returns {boolean} - Whether operation was successful
     */
    function savePlayerNickname(nickname) {
      return setItem('pong_player_nickname', nickname);
    }
    
    /**
     * Load player nickname from storage
     * @returns {string|null} - Player nickname or null if not found
     */
    function loadPlayerNickname() {
      return getItem('pong_player_nickname', null);
    }
    
    /**
     * Save preferred language to storage
     * @param {string} language - Language code
     * @returns {boolean} - Whether operation was successful
     */
    function saveLanguagePreference(language) {
      return setItem('pong_language', language);
    }
    
    /**
     * Load preferred language from storage
     * @param {string} defaultLanguage - Default language if not found
     * @returns {string} - Language code
     */
    function loadLanguagePreference(defaultLanguage = 'en') {
      return getItem('pong_language', defaultLanguage);
    }
    
    /**
     * Support GDPR compliance by providing data export
     * @returns {Object} - All stored data for the user
     */
    function exportUserData() {
      const userData = {};
      
      // Collect all relevant user data
      userData.nickname = loadPlayerNickname();
      userData.settings = loadGameSettings();
      userData.language = loadLanguagePreference();
      
      return userData;
    }
    
    /**
     * Clear all user data (GDPR compliance)
     * @returns {boolean} - Whether operation was successful
     */
    function clearUserData() {
      try {
        removeItem('pong_player_nickname');
        removeItem('pong_game_settings');
        // Don't clear language preference as it's a UI setting
        
        return true;
      } catch (e) {
        console.error('Error clearing user data:', e);
        return false;
      }
    }
    
    // Public API
    return {
      setItem,
      getItem,
      removeItem,
      clear,
      getKeys,
      hasKey,
      saveGameSettings,
      loadGameSettings,
      savePlayerNickname,
      loadPlayerNickname,
      saveLanguagePreference,
      loadLanguagePreference,
      exportUserData,
      clearUserData,
      isAvailable: storageAvailable
    };
  })();
  
  // Support both module.exports and direct browser usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
  }