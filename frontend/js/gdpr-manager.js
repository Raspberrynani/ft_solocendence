/**
 * GDPR Data Deletion Manager
 * Handles secure player data deletion process
 */

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

// Reference to existing elements in the HTML
const elements = {
  deleteNickname: document.getElementById('delete-nickname'),
  generateVerificationButton: document.getElementById('generate-verification'),
  verificationSection: document.getElementById('verification-section'),
  verificationCode: document.getElementById('verification-code'),
  verificationInput: document.getElementById('verification-input'),
  confirmDeleteButton: document.getElementById('confirm-delete'),
  deleteResult: document.getElementById('delete-result')
};

// Utility function to show result
function showDeleteResult(message, type = 'warning') {
  const resultElement = elements.deleteResult;
  resultElement.innerHTML = message;
  resultElement.className = `alert alert-${type}`;
  resultElement.style.display = 'block';
}

// Reset form to initial state
function resetForm() {
  elements.deleteNickname.value = '';
  elements.verificationSection.style.display = 'none';
  elements.deleteResult.style.display = 'none';
}

// Generate and show verification process
async function generateVerification() {
  const nickname = elements.deleteNickname.value.trim();
  
  if (!nickname) {
      showDeleteResult('Please enter a nickname.', 'warning');
      return;
  }
  
  try {
      const csrfToken = await fetchCsrfToken();
      const apiUrl = `${getApiBaseUrl()}/check_player/`;
      
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
      
      if (data.exists) {
          // Show verification section
          elements.verificationSection.style.display = 'block';
          
          // Display verification prefix
          elements.verificationCode.textContent = data.verification_prefix;
          
          showDeleteResult('Enter the verification code to confirm deletion.', 'info');
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
  const nickname = elements.deleteNickname.value.trim();
  const verificationCode = elements.verificationInput.value.trim();
  const verificationPrefix = elements.verificationCode.textContent;
  
  if (!nickname || !verificationCode) {
      showDeleteResult('Please fill in all fields.', 'warning');
      return;
  }
  
  // Validate verification input
  if (!verificationCode.startsWith(verificationPrefix)) {
      showDeleteResult('Verification code does not match.', 'warning');
      return;
  }
  
  try {
      const csrfToken = await fetchCsrfToken();
      const apiUrl = `${getApiBaseUrl()}/delete_player/`;
      
      const fullVerificationCode = verificationPrefix + verificationCode.slice(verificationPrefix.length);
      
      const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': csrfToken
          },
          body: JSON.stringify({
              nickname,
              verification_code: fullVerificationCode
          }),
          credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
          showDeleteResult(data.message, 'success');
          resetForm();
          
          // Optional: Redirect or show additional information
          setTimeout(() => {
              // Perhaps navigate back to the main page or show a final message
              UIManager.navigateTo('game-page');
          }, 3000);
      } else {
          showDeleteResult(data.message || 'Failed to delete player data.', 'danger');
      }
  } catch (error) {
      console.error('Error deleting player data:', error);
      showDeleteResult('Error deleting data. Please try again.', 'danger');
  }
}

// Set up event listeners
function initGDPRManager() {
  if (elements.generateVerificationButton) {
      elements.generateVerificationButton.addEventListener('click', generateVerification);
  }
  
  if (elements.confirmDeleteButton) {
      elements.confirmDeleteButton.addEventListener('click', handleConfirmDelete);
  }
}

// Ensure the script runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initGDPRManager);

// Export functions for potential testing or external use
export {
  generateVerification,
  handleConfirmDelete,
  showDeleteResult
};