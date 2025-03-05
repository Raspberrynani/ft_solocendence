// Mobile Joystick Module
const MobileJoystick = (function() {
    let joystickContainer;
    let joystickHandle;
    let isDragging = false;
    let paddleCallback = null;
    let canvasElement = null;
  
    function createJoystick() {
      // Only create on mobile devices
      if (!Utils.isMobileDevice()) return null;
  
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
      `;
  
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
  
      joystickContainer.appendChild(joystickHandle);
      document.body.appendChild(joystickContainer);
  
      setupJoystickListeners();
      return joystickContainer;
    }
  
    function setupJoystickListeners() {
      function updatePaddlePosition(clientY) {
        if (!canvasElement) return;
  
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
  
      joystickHandle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDragging = true;
        joystickHandle.style.background = 'rgba(0, 212, 255, 1)';
      }, { passive: false });
  
      document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        const touch = e.touches[0];
        const containerRect = joystickContainer.getBoundingClientRect();
        
        // Calculate relative position within joystick
        const deltaX = touch.clientX - containerRect.left - containerRect.width / 2;
        const deltaY = touch.clientY - containerRect.top - containerRect.height / 2;
        
        // Update joystick handle position
        const maxDistance = containerRect.width / 2 - 20; // 20 is handle radius
        const distance = Math.min(Math.sqrt(deltaX*deltaX + deltaY*deltaY), maxDistance);
        const angle = Math.atan2(deltaY, deltaX);
        
        joystickHandle.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
        
        // Update paddle position based on vertical movement
        updatePaddlePosition(touch.clientY);
      });
  
      document.addEventListener('touchend', () => {
        if (!isDragging) return;
        
        isDragging = false;
        joystickHandle.style.transform = 'translate(-50%, -50%)';
        joystickHandle.style.background = 'rgba(0, 212, 255, 0.7)';
      });
    }
  
    function init(canvas, onPaddleMove) {
      // Destroy existing joystick if any
      const existingJoystick = document.getElementById('mobile-joystick');
      if (existingJoystick) {
        existingJoystick.remove();
      }
  
      canvasElement = canvas;
      paddleCallback = onPaddleMove;
      return createJoystick();
    }
  
    function destroy() {
      const joystick = document.getElementById('mobile-joystick');
      if (joystick) {
        joystick.remove();
      }
    }
  
    return {
      init,
      destroy
    };
  })();