/**
 * CSRF Token and Delete Request Fix
 * 
 * Update the handleConfirmDelete function in your gdpr-manager.js
 * To properly fetch and include the CSRF token
 */

// First add this function to explicitly fetch a CSRF token
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
  
  // Then replace the handleConfirmDelete function with this improved version
  async function handleConfirmDelete() {
    try {
      const nickname = elements.deleteNickname.value.trim();
      const verificationCode = elements.verificationInput.value.trim();
      
      if (!nickname || !verificationCode) {
        showDeleteResult('Please fill in all fields.', 'warning');
        return;
      }
      
      showDeleteResult('Processing your request...', 'info');
      
      // First explicitly fetch a fresh CSRF token
      const csrfToken = await fetchCsrfToken();
      console.log("Fetched CSRF token:", csrfToken ? "Token received (not shown for security)" : "No token received");
      
      if (!csrfToken) {
        throw new Error('Could not get CSRF protection token');
      }
      
      const apiUrl = `${getApiBaseUrl()}/delete_player/`;
      console.log("Sending delete request to:", apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
          nickname: nickname,
          verification_code: verificationCode
        }),
        credentials: 'include'
      });
      
      console.log("Delete response status:", response.status);
      
      if (!response.ok) {
        // Try to get detailed error message
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || `Server error: ${response.status}`;
        } catch (e) {
          errorMessage = `Server responded with ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log("Delete response data:", data);
      
      if (data.success) {
        showDeleteResult(data.message, 'success');
        resetForm();
      } else {
        showDeleteResult(data.message || 'Unknown error occurred', 'danger');
      }
    } catch (error) {
      console.error('Error deleting data:', error);
      showDeleteResult(`Error: ${error.message}`, 'danger');
    }
  }