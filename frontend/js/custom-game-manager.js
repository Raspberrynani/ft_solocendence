/**
 * Custom Game Manager - Optimized
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
      speed: {
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
      if (!validateElements()) {
        console.error("Required elements not found for Custom Game Manager");
        return;
      }
      
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
      if (elements.applyCode) {
        elements.applyCode.addEventListener('click', function() {
          applyGameCode(elements.gameCode.value.trim());
        });
      }
      
      // Generate code button
      if (elements.generateCode) {
        elements.generateCode.addEventListener('click', function() {
          const code = generateGameCode(currentSettings);
          elements.gameCode.value = code;
          highlightElement(elements.gameCode);
        });
      }
      
      // Copy code button
      if (elements.copyCode) {
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
    }
    
    /**
     * Validate that all required elements exist
     * @returns {boolean} - Whether all elements exist
     */
    function validateElements() {
      const requiredElements = [
        'ballSpeed', 'ballSpeedValue', 
        'paddleSize', 'paddleSizeValue', 
        'speedIncrement', 'speedIncrementValue',
        'ballColor', 'leftPaddleColor', 'rightPaddleColor',
        'gravityEnabled', 'bounceRandom'
      ];
      
      // Optional elements that may not be present
      const optionalElements = ['gameCode', 'applyCode', 'generateCode', 'copyCode'];
      
      // Check each required element
      for (const elementId of requiredElements) {
        if (!elements[elementId]) {
          console.error(`Required element not found: ${elementId}`);
          return false;
        }
      }
      
      return true;
    }
    
    /**
     * Update UI controls to reflect the current settings
     * @param {Object} settings - Game settings to display
     */
    function updateUIFromSettings(settings) {
      if (!validateElements()) return;
      
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
        // Use a deep copy to avoid reference issues
        currentSettings = JSON.parse(JSON.stringify(presets[presetName]));
        updateUIFromSettings(currentSettings);
        
        // Highlight the preset button
        const presetButton = document.querySelector(`[data-preset="${presetName}"]`);
        highlightElement(presetButton);
        
        // Generate and display the code
        if (elements.gameCode) {
          const code = generateGameCode(currentSettings);
          elements.gameCode.value = code;
          highlightElement(elements.gameCode);
        }
        
        console.log(`Applied preset: ${presetName}`);
        return true;
      }
      
      console.error(`Preset not found: ${presetName}`);
      return false;
    }
    
    /**
     * Generate a concise game code based on settings
     * @param {Object} settings - Game settings to encode
     * @returns {string} - Encoded game code
     */
    function generateGameCode(settings) {
      // Create a simple encoding using first letters of key settings
      const code = [
        // Speed - first character of preset or number
        Object.keys(presets).find(key => 
          presets[key].ballSpeed === settings.ballSpeed
        )?.charAt(0) || Math.round(settings.ballSpeed).toString(),
        
        // Paddle size 
        Math.round(settings.paddleSize / 50).toString(),
        
        // Gravity (G) or Normal (N)
        settings.gravityEnabled ? 'G' : 'N',
        
        // Random bounce (R) or Normal (N)
        settings.bounceRandom ? 'R' : 'N',
        
        // Color first letter of main color
        settings.ballColor.replace('#', '').substr(0, 1).toUpperCase()
      ].join('');
      
      return code.toUpperCase();
    }
    
    /**
     * Apply a game code to set the game configuration
     * @param {string} code - Game code to parse
     * @returns {boolean} - Whether code was successfully applied
     */
    function applyGameCode(code) {
      if (!code) return false;
      
      code = code.toUpperCase();
      
      // First, check predefined presets by name
      const presetKeys = Object.keys(presets);
      for (const preset of presetKeys) {
        if (code === preset.toUpperCase() || code === preset.charAt(0).toUpperCase()) {
          applyPreset(preset);
          return true;
        }
      }
      
      // If not a preset, try parsing the detailed code
      try {
        if (code.length < 4) {
          throw new Error("Code too short");
        }
        
        const [speed, paddleSize, gravity, bounce, color] = code.split('');
        
        // Speed mapping
        const speedMap = {
          'S': 8,   // Speed preset
          'R': 3,   // Retro preset
          'G': 5,   // Giant preset
          'M': 3,   // Micro preset
          'C': 7,   // Chaos preset
          '3': 3,
          '4': 4,
          '5': 5,
          '6': 6,
          '7': 7,
          '8': 8
        };
        currentSettings.ballSpeed = speedMap[speed] || 4;
        
        // Paddle size mapping
        const paddleSizeMap = {
          '1': 50,
          '2': 100,
          '3': 150,
          '4': 200
        };
        currentSettings.paddleSize = paddleSizeMap[paddleSize] || 100;
        
        // Gravity mapping
        currentSettings.gravityEnabled = gravity === 'G';
        
        // Bounce mapping
        currentSettings.bounceRandom = bounce === 'R';
        
        // Color mapping (very basic - just changes to a preset color)
        const colorMap = {
          'F': '#ff4500',  // Fire Red
          'B': '#0000ff',  // Blue
          'G': '#00ff00',  // Green
          'W': '#ffffff',  // White
          'Y': '#ffff00'   // Yellow
        };
        currentSettings.ballColor = colorMap[color] || '#00d4ff';
        
        // Update UI to reflect new settings
        updateUIFromSettings(currentSettings);
        
        // Highlight the code input
        if (elements.gameCode) {
          highlightElement(elements.gameCode);
        }
        
        console.log("Successfully applied game code:", code);
        return true;
      } catch (error) {
        console.error("Error parsing game code:", error);
        
        if (typeof Utils !== 'undefined' && Utils.showAlert) {
          Utils.showAlert("Invalid game code. Try a preset or check the format.");
        } else {
          alert("Invalid game code. Try a preset or check the format.");
        }
        
        return false;
      }
    }
    
    /**
     * Apply a highlight animation to an element
     * @param {HTMLElement} element - Element to highlight
     */
    function highlightElement(element) {
      if (!element) return;
      
      element.classList.remove("highlight-applied");
      
      // Force reflow to restart animation
      void element.offsetWidth;
      
      element.classList.add("highlight-applied");
      setTimeout(() => element.classList.remove("highlight-applied"), 700);
    }
    
    /**
     * Get the current game settings
     * @returns {Object} - Current game settings
     */
    function getSettings() {
      return {...currentSettings};
    }
    
    /**
     * Set game settings directly
     * @param {Object} settings - New settings to apply
     * @param {boolean} updateUI - Whether to update the UI
     * @returns {boolean} - Success status
     */
    function setSettings(settings, updateUI = true) {
      // Validate essential settings
      if (typeof settings !== 'object') {
        console.error("Invalid settings object");
        return false;
      }
      
      // Create a merged settings object with defaults for missing properties
      const mergedSettings = {...defaultSettings, ...settings};
      
      // Apply the settings
      currentSettings = mergedSettings;
      
      // Update UI if requested
      if (updateUI) {
        updateUIFromSettings(currentSettings);
      }
      
      return true;
    }
    
    /**
     * Reset settings to default values
     */
    function resetSettings() {
      currentSettings = {...defaultSettings};
      updateUIFromSettings(currentSettings);
      
      console.log("Settings reset to defaults");
      return true;
    }
    
    /**
     * Get a list of available presets
     * @returns {Object} - Available presets
     */
    function getPresets() {
      return {...presets};
    }
    
    // Public API
    return {
      init,
      getSettings,
      setSettings,
      applyPreset,
      applyGameCode,
      generateGameCode,
      resetSettings,
      getPresets,
      getDefaultSettings: () => ({...defaultSettings})
    };
  })();
  
  // Export for ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomGameManager;
  }