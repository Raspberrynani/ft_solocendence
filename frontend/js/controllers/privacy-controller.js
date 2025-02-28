/**
 * Privacy Controller Module
 * Handles GDPR compliance and data deletion functionality
 */
const PrivacyController = (function() {
    // Private variables
    let elements = {};
    let verificationCode = null;
    
    /**
     * Initialize the privacy controller
     * @param {Object} config - Configuration object
     * @returns {Object} - Public API
     */
    function init(config = {}) {
      elements = config.elements || {};
      
      // Validate required elements
      const requiredElements = [
        'deleteNickname',
        'verificationInput',
        'generateVerification',
        'confirmDelete',
        'deleteResult',
        'verificationSection'
      ];
      
      for (const elementName of requiredElements) {
        if (!elements[elementName]) {
          console.warn(`Missing element: ${elementName} in privacy controller`);
        }
      }
      
      // Set up event listeners
      setupEventListeners();
      
      console.log("Privacy controller initialized");
      
      return publicAPI;
    }
    
    /**
     * Set up event listeners for privacy-related elements
     */
    function setupEventListeners() {
      // Generate verification code button
      if (elements.generateVerification) {
        elements.generateVerification.addEventListener('click', handleGenerateVerification);
      }
      
      // Confirm delete button
      if (elements.confirmDelete) {
        elements.confirmDelete.addEventListener('click', handleConfirmDelete);
      }
      
      // Input validation for nickname field
      if (elements.deleteNickname) {
        elements.deleteNickname.addEventListener('input', validateNickname);
      }
    }
    
    /**
     * Validate nickname input format
     */
    function validateNickname() {
      const nickname = elements.deleteNickname.value.trim();
      
      // Simple validation for now
      if (nickname.length === 0) {
        elements.generateVerification.disabled = true;
      } else {
        elements.generateVerification.disabled = false;
      }
    }
    
    /**
     * Handle click on generate verification button
     */
    async function handleGenerateVerification() {
      try {
        const nickname = elements.deleteNickname.value.trim();
        
        if (!nickname) {
          showDeleteResult('Please enter your nickname', 'warning');
          return;
        }
        
        // Show loading state
        elements.generateVerification.disabled = true;
        elements.generateVerification.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
        
        // Generate verification code
        verificationCode = await ApiService.generateVerificationCode(nickname);
        
        // Display the verification code and section
        if (elements.verificationCode) {
          elements.verificationCode.textContent = verificationCode;
        }
        
        if (elements.verificationSection) {
          elements.verificationSection.style.display = 'block';
        }
        
        // Reset button
        elements.generateVerification.disabled = false;
        elements.generateVerification.textContent = 'Regenerate Verification Code';
        
        // Focus on verification input
        if (elements.verificationInput) {
          elements.verificationInput.focus();
        }
        
        // Show instructions
        showDeleteResult('Enter the verification code to confirm deletion', 'info');
      } catch (error) {
        console.error('Error generating verification code:', error);
        showDeleteResult('Error generating verification code. Please try again.', 'danger');
        
        // Reset button
        elements.generateVerification.disabled = false;
        elements.generateVerification.textContent = 'Generate Verification Code';
      }
    }
    
    /**
     * Handle click on confirm delete button
     */
    async function handleConfirmDelete() {
      try {
        const nickname = elements.deleteNickname.value.trim();
        const inputCode = elements.verificationInput.value.trim();
        
        if (!nickname || !inputCode) {
          showDeleteResult('Please fill in all fields', 'warning');
          return;
        }
        
        // Validate verification code matches
        if (inputCode !== verificationCode) {
          showDeleteResult('Verification code does not match', 'danger');
          return;
        }
        
        // Show loading state
        elements.confirmDelete.disabled = true;
        elements.confirmDelete.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
        showDeleteResult('Processing your request...', 'info');
        
        // Submit deletion request
        const response = await ApiService.deletePlayerData({
          nickname: nickname,
          verification_code: inputCode
        });
        
        // Handle response
        if (response.success) {
          showDeleteResult(response.message || 'Your data has been successfully deleted', 'success');
          resetForm();
        } else {
          showDeleteResult(response.message || 'Failed to delete data', 'danger');
        }
      } catch (error) {
        console.error('Error deleting data:', error);
        showDeleteResult(`Error: ${error.message}`, 'danger');
      } finally {
        // Reset button
        if (elements.confirmDelete) {
          elements.confirmDelete.disabled = false;
          elements.confirmDelete.textContent = 'Delete My Data';
        }
      }
    }
    
    /**
     * Reset the deletion form
     */
    function resetForm() {
      if (elements.deleteNickname) {
        elements.deleteNickname.value = '';
      }
      
      if (elements.verificationInput) {
        elements.verificationInput.value = '';
      }
      
      if (elements.verificationSection) {
        elements.verificationSection.style.display = 'none';
      }
      
      if (elements.generateVerification) {
        elements.generateVerification.textContent = 'Generate Verification Code';
      }
      
      verificationCode = null;
    }
    
    /**
     * Show a result message in the deletion form
     * @param {string} message - Message to display
     * @param {string} type - Bootstrap alert type (success, info, warning, danger)
     */
    function showDeleteResult(message, type = 'info') {
      if (!elements.deleteResult) return;
      
      elements.deleteResult.className = `alert alert-${type}`;
      elements.deleteResult.textContent = message;
      elements.deleteResult.style.display = 'block';
      
      // Automatically hide success messages after 5 seconds
      if (type === 'success') {
        setTimeout(() => {
          elements.deleteResult.style.display = 'none';
        }, 5000);
      }
    }
    
    // Public API
    const publicAPI = {
      init,
      resetForm
    };
    
    return publicAPI;
  })();