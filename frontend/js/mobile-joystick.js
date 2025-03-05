/**
 * Mobile Joystick Module - Optimized
 * Provides touch controls for mobile devices
 * Uses pointer events for better cross-platform support
 */
const MobileJoystick = (function() {
    // Private variables
    let joystickContainer = null;
    let joystickHandle = null;
    let isDragging = false;
    let paddleCallback = null;
    let canvasElement = null;
    let currentPointerId = null;
    let lastMove = 0; // Timestamp of last move event (for throttling)
    
    // Constants
    const THROTTLE_MS = 16; // ~60fps throttle for move events
    
    /**
     * Create the joystick UI
     * @returns {HTMLElement|null} - The joystick container or null if not on mobile
     */
    function createJoystick() {
      // Only create on mobile devices
      if (!Utils.isMobileDevice()) return null;
      
      // Clean up any existing joystick
      destroy();
      
      // Create container
      joystickContainer = document.createElement('div');
      joystickContainer.id = 'mobile-joystick';
      joystickContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 100px;
        height: 100px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 50%;
        border: 2px solid rgba(0, 212, 255, 0.5);
        z-index: 1000;
        touch-action: none;
      `;
      
      // Create handle
      joystickHandle = document.createElement('div');
      joystickHandle.style.cssText = `
        position: absolute;
        width: 40px;
        height: 40px;
        background: rgba(0, 212, 255, 0.7);
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        touch-action: none;
      `;
      
      // Add handle to container
      joystickContainer.appendChild(joystickHandle);
      
      // Add to body
      document.body.appendChild(joystickContainer);
      
      // Setup event listeners
      setupJoystickListeners();
      
      return joystickContainer;
    }
    
    /**
     * Set up event listeners for the joystick
     */
    function setupJoystickListeners() {
      // Common function to update paddle position
      function updatePaddlePosition(clientY) {
        if (!canvasElement) return;
        
        const now = Date.now();
        if (now - lastMove < THROTTLE_MS) return; // Throttle updates
        lastMove = now;
        
        const rect = canvasElement.getBoundingClientRect();
        const relativeY = clientY - rect.top;
        
        // Convert to paddle Y position
        const paddleHeight = canvasElement.height * 0.2; // Assuming paddle height is 20% of canvas
        const clampedY = Math.max(0, Math.min(relativeY - paddleHeight / 2, canvasElement.height - paddleHeight));
        
        // Call paddle move callback
        if (paddleCallback) {
          paddleCallback(clampedY);
        }
      }
      
      // Pointer events for better cross-device support
      joystickHandle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        isDragging = true;
        currentPointerId = e.pointerId;
        joystickHandle.setPointerCapture(e.pointerId);
        joystickHandle.style.background = 'rgba(0, 212, 255, 1)';
      });
      
      document.addEventListener('pointermove', (e) => {
        if (!isDragging || e.pointerId !== currentPointerId) return;
        
        const containerRect = joystickContainer.getBoundingClientRect();
        
        // Calculate relative position within joystick
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        const deltaX = e.clientX - centerX;
        const deltaY = e.clientY - centerY;
        
        // Update joystick handle position
        const maxDistance = containerRect.width / 2 - 20; // 20 is handle radius
        const distance = Math.min(Math.sqrt(deltaX*deltaX + deltaY*deltaY), maxDistance);
        const angle = Math.atan2(deltaY, deltaX);
        
        joystickHandle.style.transform = `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px))`;
        
        // Update paddle position based on vertical movement
        updatePaddlePosition(e.clientY);
      });
      
      document.addEventListener('pointerup', (e) => {
        if (!isDragging || e.pointerId !== currentPointerId) return;
        
        if (joystickHandle.hasPointerCapture(e.pointerId)) {
          joystickHandle.releasePointerCapture(e.pointerId);
        }
        
        isDragging = false;
        currentPointerId = null;
        joystickHandle.style.transform = 'translate(-50%, -50%)';
        joystickHandle.style.background = 'rgba(0, 212, 255, 0.7)';
      });
      
      // Handle pointer cancel
      document.addEventListener('pointercancel', (e) => {
        if (!isDragging || e.pointerId !== currentPointerId) return;
        
        if (joystickHandle.hasPointerCapture(e.pointerId)) {
          joystickHandle.releasePointerCapture(e.pointerId);
        }
        
        isDragging = false;
        currentPointerId = null;
        joystickHandle.style.transform = 'translate(-50%, -50%)';
        joystickHandle.style.background = 'rgba(0, 212, 255, 0.7)';
      });
      
      // Handle blur and visibility change
      window.addEventListener('blur', resetJoystickState);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          resetJoystickState();
        }
      });
    }
    
    /**
     * Reset joystick to centered state
     */
    function resetJoystickState() {
      isDragging = false;
      currentPointerId = null;
      if (joystickHandle) {
        joystickHandle.style.transform = 'translate(-50%, -50%)';
        joystickHandle.style.background = 'rgba(0, 212, 255, 0.7)';
      }
    }
    
    /**
     * Initialize the joystick
     * @param {HTMLCanvasElement} canvas - Game canvas
     * @param {Function} onPaddleMove - Callback for paddle movement
     * @returns {HTMLElement|null} - Joystick element or null
     */
    function init(canvas, onPaddleMove) {
      // Validate parameters
      if (!canvas || !(canvas instanceof HTMLElement)) {
        console.error("Invalid canvas element");
        return null;
      }
      
      if (typeof onPaddleMove !== 'function') {
        console.error("Paddle move callback must be a function");
        return null;
      }
      
      canvasElement = canvas;
      paddleCallback = onPaddleMove;
      
      // Determine if this is a mobile device first
      if (!Utils.isMobileDevice()) {
        console.log("Not a mobile device, joystick not created");
        return null;
      }
      
      // Create joystick UI
      return createJoystick();
    }
    
    /**
     * Remove the joystick from the DOM
     */
    function destroy() {
      // Clean up event listeners
      if (joystickHandle) {
        joystickHandle.removeEventListener('pointerdown', null);
      }
      
      // Remove joystick from DOM
      const existingJoystick = document.getElementById('mobile-joystick');
      if (existingJoystick) {
        existingJoystick.remove();
      }
      
      // Reset state
      joystickContainer = null;
      joystickHandle = null;
      isDragging = false;
      currentPointerId = null;
    }
    
    /**
     * Disable joystick temporarily
     */
    function disable() {
      if (joystickContainer) {
        joystickContainer.style.opacity = '0.3';
        joystickContainer.style.pointerEvents = 'none';
      }
    }
    
    /**
     * Enable joystick after being disabled
     */
    function enable() {
      if (joystickContainer) {
        joystickContainer.style.opacity = '1';
        joystickContainer.style.pointerEvents = 'auto';
      }
    }
    
    /**
     * Reposition joystick container
     * @param {string} position - Position ('left', 'right', 'center')
     */
    function setPosition(position) {
      if (!joystickContainer) return;
      
      const positions = {
        left: { bottom: '20px', left: '20px', right: 'auto' },
        right: { bottom: '20px', left: 'auto', right: '20px' },
        center: { bottom: '20px', left: '50%', right: 'auto', transform: 'translateX(-50%)' }
      };
      
      const pos = positions[position] || positions.left;
      
      Object.assign(joystickContainer.style, pos);
    }
    
    // Public API
    return {
      init,
      destroy,
      disable,
      enable,
      setPosition
    };
  })();
  
  // Export for ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileJoystick;
  }

  window.MobileJoystick = MobileJoystick;