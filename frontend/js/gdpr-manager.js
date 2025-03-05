/**
 * GDPR Data Deletion Manager
 * Handles secure player data deletion process with proper hash verification
 */

// Global for accessing outside module
window.GDPRManager = (function() {
  // Store secure data that shouldn't be directly accessible
  let secureData = {
    currentHash: null,
    timestamp: null
  };
  
  function getApiBaseUrl() {
    // Use the same protocol and host as the current page
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
  }
  
  async function fetchCsrfToken() {
    try {
      const response = await fetch('/api/csrf/');
      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
      throw new Error('Could not get CSRF protection token. Please try again.');
    }
  }
  
  /**
   * Generate a secure verification hash matching the backend
   * @param {string} nickname - User's nickname
   * @param {number} hourTimestamp - Current hour timestamp
   * @returns {string} - Generated hash
   */
  function generateVerificationHash(nickname, hourTimestamp) {
    // This must match the backend hash generation algorithm
    const verificationString = `${nickname}-${hourTimestamp}-pong-gdpr`;
    
    // Generate hash using SHA-256
    return sha256(verificationString);
  }
  
  /**
   * Simple SHA-256 implementation (should match backend's hashlib.sha256)
   * In a real-world app, you'd use a proper crypto library
   */
  async function sha256(message) {
    // Use the built-in SubtleCrypto API
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
  
  // Utility function to show result
  function showDeleteResult(message, type = 'warning') {
    const resultElement = document.getElementById('delete-result');
    if (!resultElement) {
      console.error('Delete result element not found');
      return;
    }
    
    resultElement.innerHTML = message;
    resultElement.className = `alert alert-${type}`;
    resultElement.style.display = 'block';
  }
  
  // Reset form to initial state
  function resetForm() {
    const elements = {
      deleteNickname: document.getElementById('delete-nickname'),
      verificationSection: document.getElementById('verification-section'),
      deleteResult: document.getElementById('delete-result'),
      verificationInput: document.getElementById('verification-input')
    };
    
    if (elements.deleteNickname) elements.deleteNickname.value = '';
    if (elements.verificationInput) elements.verificationInput.value = '';
    if (elements.verificationSection) elements.verificationSection.style.display = 'none';
    if (elements.deleteResult) elements.deleteResult.style.display = 'none';
    
    // Clear secure data
    secureData.currentHash = null;
    secureData.timestamp = null;
  }
  
  // Generate and show verification process
  async function generateVerification() {
    console.log("Generate verification called");
    
    const deleteNickname = document.getElementById('delete-nickname');
    const verificationSection = document.getElementById('verification-section');
    const verificationCode = document.getElementById('verification-code');
    
    if (!deleteNickname) {
      console.error('Delete nickname input not found');
      return;
    }
    
    const nickname = deleteNickname.value.trim();
    
    if (!nickname) {
      showDeleteResult('Please enter a nickname.', 'warning');
      return;
    }
    
    try {
      showDeleteResult('Checking player data...', 'info');
      
      const csrfToken = await fetchCsrfToken();
      const apiUrl = `${getApiBaseUrl()}/check_player/`;
      
      console.log("Sending request to:", apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ nickname }),
        credentials: 'include'
      });
      
      const data = await response.json();
      console.log("Player check response:", data);
      
      if (data.exists) {
        // Show verification section
        if (verificationSection) {
          verificationSection.style.display = 'block';
          
          // Display verification prefix
          if (verificationCode) {
            verificationCode.textContent = data.verification_prefix || '123456';
          }
          
          // Store the timestamp for hash generation
          secureData.timestamp = data.timestamp;
          
          // Generate our own hash that matches what the backend will generate
          const fullHash = await generateVerificationHash(nickname, data.timestamp);
          secureData.currentHash = fullHash;
          
          console.log("Frontend generated hash:", {
            prefix: fullHash.substring(0, 6),
            fullHash: fullHash
          });
          
          showDeleteResult('To confirm deletion, please enter the verification code shown above.', 'info');
        } else {
          console.error('Verification section not found');
        }
      } else {
        showDeleteResult(data.message || 'Player not found', 'warning');
      }
    } catch (error) {
      console.error('Error checking player:', error);
      showDeleteResult('Error checking player. Please try again.', 'danger');
    }
  }
  
  // Confirm and delete player data
  async function handleConfirmDelete() {
    const deleteNickname = document.getElementById('delete-nickname');
    const verificationInput = document.getElementById('verification-input');
    const verificationCode = document.getElementById('verification-code');
    
    if (!deleteNickname || !verificationInput || !verificationCode) {
      console.error('Required elements not found');
      return;
    }
    
    const nickname = deleteNickname.value.trim();
    const userInput = verificationInput.value.trim();
    const expectedCode = verificationCode.textContent.trim();
    
    console.log("Verifying input:", {
      nickname,
      userInput,
      expectedCode
    });
    
    if (!nickname || !userInput) {
      showDeleteResult('Please fill in all fields.', 'warning');
      return;
    }
    
    // First verify that user entered the correct code
    if (userInput !== expectedCode) {
      showDeleteResult('Verification code does not match. Please enter the exact code shown above.', 'warning');
      return;
    }
    
    // Verify we have the necessary secure data
    if (!secureData.currentHash || !secureData.timestamp) {
      showDeleteResult('Security verification failed. Please generate a new code.', 'warning');
      return;
    }
    
    try {
      showDeleteResult('Processing deletion request...', 'info');
      
      const csrfToken = await fetchCsrfToken();
      const apiUrl = `${getApiBaseUrl()}/delete_player/`;
      
      // Send both the user input AND our generated hash for double verification
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
          nickname,
          user_input: userInput,
          frontend_hash: secureData.currentHash
        }),
        credentials: 'include'
      });
      
      const data = await response.json();
      console.log("Delete response:", data);
      
      if (data.success) {
        showDeleteResult(data.message, 'success');
        resetForm();
        
        // Optional: Redirect or show additional information
        setTimeout(() => {
          // Navigate back to the main page after successful deletion
          if (window.UIManager) {
            window.UIManager.navigateTo('game-page');
          }
        }, 3000);
      } else {
        showDeleteResult(data.message || 'Failed to delete player data.', 'danger');
      }
    } catch (error) {
      console.error('Error deleting player data:', error);
      showDeleteResult('Error deleting data. Please try again.', 'danger');
    }
  }
  
  // Bind events manually
  function bindEvents() {
    console.log("Binding GDPR manager events");
    
    const generateVerificationButton = document.getElementById('generate-verification');
    const confirmDeleteButton = document.getElementById('confirm-delete');
    
    if (generateVerificationButton) {
      // Remove any existing listeners to prevent duplicates
      const newButton = generateVerificationButton.cloneNode(true);
      generateVerificationButton.parentNode.replaceChild(newButton, generateVerificationButton);
      
      // Add new listener
      newButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log("Generate verification button clicked");
        generateVerification();
      });
      
      console.log("Generate verification button listener attached");
    } else {
      console.error("Generate verification button not found");
    }
    
    if (confirmDeleteButton) {
      // Remove any existing listeners to prevent duplicates
      const newButton = confirmDeleteButton.cloneNode(true);
      confirmDeleteButton.parentNode.replaceChild(newButton, confirmDeleteButton);
      
      // Add new listener
      newButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log("Confirm delete button clicked");
        handleConfirmDelete();
      });
      
      console.log("Confirm delete button listener attached");
    } else {
      console.error("Confirm delete button not found");
    }
  }
  
  // Initialize after page navigation
  function init() {
    console.log("Initializing GDPR Manager");
    resetForm();
    bindEvents();
  }
  
  // Return public methods
  return {
    init,
    generateVerification,
    handleConfirmDelete,
    showDeleteResult,
    resetForm,
    bindEvents
  };
})();

// Bind to page changes to ensure we reinitialize after navigation
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded - initial GDPR Manager setup");
  
  // Initial binding
  if (document.getElementById('privacy-policy-page')) {
    window.GDPRManager.bindEvents();
  }
  
  // Listen for page navigation
  document.querySelectorAll('[data-navigate="privacy-policy-page"]').forEach(button => {
    button.addEventListener('click', function() {
      console.log("Navigation to privacy policy detected");
      // Use setTimeout to ensure the DOM is updated after navigation
      setTimeout(() => {
        window.GDPRManager.bindEvents();
      }, 100);
    });
  });
});

window.GDPRManager = GDPRManager;