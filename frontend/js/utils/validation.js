/**
 * Validation Module
 * Provides input validation functions for the application
 */
const Validation = (function() {
    /**
     * Validate a nickname
     * @param {string} nickname - Nickname to validate
     * @returns {Object} - Validation result {isValid, message}
     */
    function validateNickname(nickname) {
      // Check if nickname is provided
      if (!nickname || nickname.trim() === '') {
        return {
          isValid: false,
          message: 'Nickname is required'
        };
      }
      
      // Check length
      if (nickname.length < 1 || nickname.length > 16) {
        return {
          isValid: false,
          message: 'Nickname must be between 1 and 16 characters'
        };
      }
      
      // Check allowed characters
      const validNickname = /^[A-Za-z0-9_-]+$/;
      if (!validNickname.test(nickname)) {
        return {
          isValid: false,
          message: 'Nickname can only contain letters, numbers, underscores, and hyphens'
        };
      }
      
      return {
        isValid: true,
        message: 'Valid nickname'
      };
    }
    
    /**
     * Validate number of rounds
     * @param {number|string} rounds - Number of rounds to validate
     * @returns {Object} - Validation result {isValid, message, value}
     */
    function validateRounds(rounds) {
      // Convert to number if string
      const roundsNum = typeof rounds === 'string' ? parseInt(rounds, 10) : rounds;
      
      // Check if it's a valid number
      if (isNaN(roundsNum)) {
        return {
          isValid: false,
          message: 'Number of rounds must be a valid number',
          value: null
        };
      }
      
      // Check range
      if (roundsNum < 1 || roundsNum > 20) {
        return {
          isValid: false,
          message: 'Number of rounds must be between 1 and 20',
          value: roundsNum
        };
      }
      
      return {
        isValid: true,
        message: 'Valid number of rounds',
        value: roundsNum
      };
    }
    
    /**
     * Validate a game code format
     * @param {string} code - Game code to validate
     * @returns {Object} - Validation result {isValid, message}
     */
    function validateGameCode(code) {
      // Check if code is provided
      if (!code || code.trim() === '') {
        return {
          isValid: false,
          message: 'Game code is required'
        };
      }
      
      // Game code format is 5 characters
      if (code.length !== 5) {
        return {
          isValid: false,
          message: 'Game code must be 5 characters'
        };
      }
      
      // First character should be a letter or number (for preset or speed)
      if (!/^[A-Za-z0-9]/.test(code)) {
        return {
          isValid: false,
          message: 'Invalid game code format'
        };
      }
      
      return {
        isValid: true,
        message: 'Valid game code'
      };
    }
    
    /**
     * Validate a verification code format
     * @param {string} code - Verification code to validate
     * @returns {Object} - Validation result {isValid, message}
     */
    function validateVerificationCode(code) {
      // Check if code is provided
      if (!code || code.trim() === '') {
        return {
          isValid: false,
          message: 'Verification code is required'
        };
      }
      
      // Verification code is 12 characters (hex)
      if (code.length !== 12) {
        return {
          isValid: false,
          message: 'Verification code must be 12 characters'
        };
      }
      
      // Should be a valid hex string
      if (!/^[0-9a-fA-F]+$/.test(code)) {
        return {
          isValid: false,
          message: 'Verification code must contain only hexadecimal characters'
        };
      }
      
      return {
        isValid: true,
        message: 'Valid verification code'
      };
    }
    
    /**
     * Validate a language code
     * @param {string} language - Language code to validate
     * @param {Array<string>} supportedLanguages - List of supported language codes
     * @returns {Object} - Validation result {isValid, message}
     */
    function validateLanguage(language, supportedLanguages = ['en', 'es', 'fr']) {
      // Check if language is provided
      if (!language || language.trim() === '') {
        return {
          isValid: false,
          message: 'Language code is required'
        };
      }
      
      // Check if language is supported
      if (!supportedLanguages.includes(language)) {
        return {
          isValid: false,
          message: `Language code must be one of: ${supportedLanguages.join(', ')}`
        };
      }
      
      return {
        isValid: true,
        message: 'Valid language code'
      };
    }
    
    /**
     * Validate game customization settings
     * @param {Object} settings - Game settings to validate
     * @returns {Object} - Validation result {isValid, message, errors}
     */
    function validateGameSettings(settings) {
      const errors = {};
      
      // Validate ball speed
      if (settings.ballSpeed !== undefined) {
        if (isNaN(settings.ballSpeed) || settings.ballSpeed < 2 || settings.ballSpeed > 10) {
          errors.ballSpeed = 'Ball speed must be between 2 and 10';
        }
      }
      
      // Validate paddle size
      if (settings.paddleSize !== undefined) {
        if (isNaN(settings.paddleSize) || settings.paddleSize < 50 || settings.paddleSize > 200) {
          errors.paddleSize = 'Paddle size must be between 50% and 200%';
        }
      }
      
      // Validate speed increment
      if (settings.speedIncrement !== undefined) {
        if (isNaN(settings.speedIncrement) || settings.speedIncrement < 0 || settings.speedIncrement > 2) {
          errors.speedIncrement = 'Speed increment must be between 0 and 2';
        }
      }
      
      // Validate colors (simple format check)
      const colorProps = ['ballColor', 'leftPaddleColor', 'rightPaddleColor'];
      for (const prop of colorProps) {
        if (settings[prop] && !/^#[0-9A-Fa-f]{6}$/.test(settings[prop])) {
          errors[prop] = 'Color must be a valid hex code (e.g., #00ff00)';
        }
      }
      
      return {
        isValid: Object.keys(errors).length === 0,
        message: Object.keys(errors).length > 0 ? 'Game settings contain errors' : 'Valid game settings',
        errors
      };
    }
    
    /**
     * Validate window size for gameplay
     * @param {number} width - Window width
     * @param {number} height - Window height
     * @returns {Object} - Validation result {isValid, message}
     */
    function validateWindowSize(width, height) {
      const minWidth = 500;
      const minHeight = 300;
      const minAspectRatio = 1.2; // width/height
      
      // Check minimum dimensions
      if (width < minWidth || height < minHeight) {
        return {
          isValid: false,
          message: `Window size is too small. Minimum size is ${minWidth}x${minHeight} pixels.`
        };
      }
      
      // Check aspect ratio
      const aspectRatio = width / height;
      if (aspectRatio < minAspectRatio) {
        return {
          isValid: false,
          message: 'Window aspect ratio is too narrow. Please make the window wider.'
        };
      }
      
      return {
        isValid: true,
        message: 'Window size is suitable for gameplay'
      };
    }
    
    // Public API
    return {
      validateNickname,
      validateRounds,
      validateGameCode,
      validateVerificationCode,
      validateLanguage,
      validateGameSettings,
      validateWindowSize
    };
  })();
  
  // Support both module.exports and direct browser usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validation;
  }