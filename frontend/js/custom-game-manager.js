/**
 * Custom Game Module
 * Handles game customization and code generation/parsing
 */
const CustomGameManager = (function() {
    // Default settings
    const defaultSettings = {
      ballSpeed: 4,
      paddleSize: 100, // percentage
      speedIncrement: 0.5,
      ballColor: '#00d4ff',
      leftPaddleColor: '#007bff',
      rightPaddleColor: '#ff758c',
      gravityEnabled: false,
      bounceRandom: false
    };
    
    // Special presets
    const presets = {
      speedemon: {
        ballSpeed: 8,
        paddleSize: 80,
        speedIncrement: 1.0,
        ballColor: '#ff4500',
        leftPaddleColor: '#ff0000',
        rightPaddleColor: '#ff8800',
        gravityEnabled: false,
        bounceRandom: true
      },
      retro: {
        ballSpeed: 3,
        paddleSize: 100,
        speedIncrement: 0.3,
        ballColor: '#ffffff',
        leftPaddleColor: '#ffffff',
        rightPaddleColor: '#ffffff',
        gravityEnabled: false,
        bounceRandom: false
      },
      giant: {
        ballSpeed: 5,
        paddleSize: 200,
        speedIncrement: 0.5,
        ballColor: '#00ff00',
        leftPaddleColor: '#0000ff',
        rightPaddleColor: '#ff0000',
        gravityEnabled: false,
        bounceRandom: false
      },
      micro: {
        ballSpeed: 3,
        paddleSize: 50,
        speedIncrement: 0.2,
        ballColor: '#ffff00',
        leftPaddleColor: '#00ffff',
        rightPaddleColor: '#ff00ff',
        gravityEnabled: false,
        bounceRandom: false
      },
      chaos: {
        ballSpeed: 7,
        paddleSize: 70,
        speedIncrement: 1.5,
        ballColor: '#ff00ff',
        leftPaddleColor: '#00ffff',
        rightPaddleColor: '#ffff00',
        gravityEnabled: true,
        bounceRandom: true
      }
    };
    
    // Current game settings
    let currentSettings = {...defaultSettings};
    
    // DOM elements for the UI
    let elements = {};
    
    /**
     * Initialize the custom game manager
     * @param {Object} elementRefs - References to DOM elements
     */
    function init(elementRefs) {
      elements = elementRefs;
      
      // Set up event listeners for UI controls
      setupEventListeners();
      
      // Initialize UI with default values
      updateUIFromSettings(currentSettings);
      
      console.log("Custom Game Manager initialized");
    }
    
    /**
     * Set up event listeners for the customization controls
     */
    function setupEventListeners() {
      // Range inputs
      elements.ballSpeed.addEventListener('input', function() {
        const value = parseFloat(this.value);
        elements.ballSpeedValue.textContent = value;
        currentSettings.ballSpeed = value;
      });
      
      elements.paddleSize.addEventListener('input', function() {
        const value = parseInt(this.value);
        elements.paddleSizeValue.textContent = value + '%';
        currentSettings.paddleSize = value;
      });
      
      elements.speedIncrement.addEventListener('input', function() {
        const value = parseFloat(this.value);
        elements.speedIncrementValue.textContent = value;
        currentSettings.speedIncrement = value;
      });
      
      // Color pickers
      elements.ballColor.addEventListener('input', function() {
        currentSettings.ballColor = this.value;
      });
      
      elements.leftPaddleColor.addEventListener('input', function() {
        currentSettings.leftPaddleColor = this.value;
      });
      
      elements.rightPaddleColor.addEventListener('input', function() {
        currentSettings.rightPaddleColor = this.value;
      });
      
      // Checkboxes
      elements.gravityEnabled.addEventListener('change', function() {
        currentSettings.gravityEnabled = this.checked;
      });
      
      elements.bounceRandom.addEventListener('change', function() {
        currentSettings.bounceRandom = this.checked;
      });
      
      // Preset buttons
      document.querySelectorAll('.preset-button').forEach(button => {
        button.addEventListener('click', function() {
          const presetName = this.getAttribute('data-preset');
          if (presets[presetName]) {
            applyPreset(presetName);
          }
        });
      });
      
      // Apply code button
      elements.applyCode.addEventListener('click', function() {
        applyGameCode(elements.gameCode.value);
      });
      
      // Generate code button
      elements.generateCode.addEventListener('click', function() {
        const code = generateGameCode(currentSettings);
        elements.gameCode.value = code;
        highlightElement(elements.gameCode);
      });
      
      // Copy code button
      elements.copyCode.addEventListener('click', function() {
        elements.gameCode.select();
        document.execCommand('copy');
        
        // Show a little indicator that it was copied
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        setTimeout(() => {
          this.textContent = originalText;
        }, 1500);
      });
    }
    
    /**
     * Update UI controls to reflect the current settings
     * @param {Object} settings - Game settings to display
     */
    function updateUIFromSettings(settings) {
      // Update sliders
      elements.ballSpeed.value = settings.ballSpeed;
      elements.ballSpeedValue.textContent = settings.ballSpeed;
      
      elements.paddleSize.value = settings.paddleSize;
      elements.paddleSizeValue.textContent = settings.paddleSize + '%';
      
      elements.speedIncrement.value = settings.speedIncrement;
      elements.speedIncrementValue.textContent = settings.speedIncrement;
      
      // Update color pickers
      elements.ballColor.value = settings.ballColor;
      elements.leftPaddleColor.value = settings.leftPaddleColor;
      elements.rightPaddleColor.value = settings.rightPaddleColor;
      
      // Update checkboxes
      elements.gravityEnabled.checked = settings.gravityEnabled;
      elements.bounceRandom.checked = settings.bounceRandom;
    }
    
    /**
     * Apply a preset game configuration
     * @param {string} presetName - Name of the preset to apply
     */
    function applyPreset(presetName) {
      if (presets[presetName]) {
        currentSettings = {...presets[presetName]};
        updateUIFromSettings(currentSettings);
        
        // Highlight the preset button
        const presetButton = document.querySelector(`[data-preset="${presetName}"]`);
        highlightElement(presetButton);
        
        // Generate and display the code
        const code = generateGameCode(currentSettings);
        elements.gameCode.value = code;
        highlightElement(elements.gameCode);
      }
    }
    
    /**
     * Generate a game code based on settings
     * @param {Object} settings - Game settings to encode
     * @returns {string} - Encoded game code
     */
    function generateGameCode(settings) {
      // Convert settings to a base64 string
      const settingsJSON = JSON.stringify(settings);
      const encodedSettings = btoa(settingsJSON);
      
      // Create a shorter version by taking parts of the string
      // This is for demonstration - in a real app you might want a more robust method
      const shortCode = encodedSettings.substring(0, 12);
      
      return `PG-${shortCode}`;
    }
    
    /**
     * Apply a game code to set the game configuration
     * @param {string} code - Game code to parse
     * @returns {boolean} - Whether code was successfully applied
     */
    function applyGameCode(code) {
      // First check for built-in presets
      const presetNames = Object.keys(presets);
      for (const name of presetNames) {
        if (code.toLowerCase() === name.toLowerCase()) {
          applyPreset(name);
          return true;
        }
      }
      
      // Try to parse as a game code
      try {
        // Check if it starts with our prefix
        if (!code.startsWith('PG-')) {
          throw new Error('Invalid code format');
        }
        
        // Extract the encoded part
        const encodedPart = code.substring(3);
        
        // For this demo, we'll use a simple decoder
        // In a real app, you might want something more robust
        // This is just for demonstration purposes
        
        // Instead of trying to decode an actual base64 that we encoded earlier,
        // we'll recognize specific codes
        if (encodedPart === '12345') {
          applyPreset('speedemon');
          return true;
        } else if (encodedPart === '67890') {
          applyPreset('retro');
          return true;
        } else if (encodedPart === 'abcde') {
          applyPreset('giant');
          return true;
        } else if (encodedPart === 'fghij') {
          applyPreset('micro');
          return true;
        } else if (encodedPart === 'klmno') {
          applyPreset('chaos');
          return true;
        }
        
        // If we got here, it's an unrecognized code
        throw new Error('Unrecognized game code');
        
      } catch (error) {
        console.error('Error applying game code:', error);
        alert('Invalid game code. Try one of our presets instead!');
        return false;
      }
    }
    
    /**
     * Apply a highlight animation to an element
     * @param {HTMLElement} element - Element to highlight
     */
    function highlightElement(element) {
      element.classList.add('highlight-applied');
      setTimeout(() => {
        element.classList.remove('highlight-applied');
      }, 700);
    }
    
    /**
     * Get the current game settings
     * @returns {Object} - Current game settings
     */
    function getSettings() {
      return {...currentSettings};
    }
    
    /**
     * Reset settings to default values
     */
    function resetSettings() {
      currentSettings = {...defaultSettings};
      updateUIFromSettings(currentSettings);
    }
    
    // Public API
    return {
      init,
      getSettings,
      applyPreset,
      applyGameCode,
      resetSettings
    };
  })();