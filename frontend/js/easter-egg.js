/**
 * Background Pong Easter Egg Collection
 * Multiple easter eggs to discover:
 * - Press 'Z' key to activate ambient fullscreen mode
 * - Type '42' for a special 42 animation
 * - Type 'panic' to get a reassuring message
 * - Type 'team' to show project contributors
 * - Type 'module' to "unlock" a secret module
 */
document.addEventListener("DOMContentLoaded", () => {
    // Initialize ambient mode state
    let isAmbientMode = false;
    let appElement = null;
    let bgCanvas = null;
    let ambientContainer = null;
    let originalOpacity = 0.3;
    
    // For tracking typed Easter egg codes
    let keySequence = [];
    const codeTimeoutMs = 1500; // Time window to complete a code sequence
    let codeTimeout = null;
    
    // Different Easter egg key sequences to trigger
    const EASTER_EGGS = {
      '42': show42EasterEgg,
      'PANIC': showDontPanicEasterEgg,
      'TEAM': showContributorsEasterEgg,
      'MODULE': showSecretModuleEasterEgg
    };
    
    // Create a key listener for the easter eggs
    document.addEventListener('keydown', (event) => {
      // Check for 'Z' key press for ambient mode
      if (event.key.toLowerCase() === 'z') {
        toggleAmbientMode();
        return;
      }
      
      // Allow ESC key to exit ambient mode
      if (event.key === 'Escape' && isAmbientMode) {
        toggleAmbientMode(false);
        return;
      }
      
      // Track key sequences for other easter eggs
      const key = event.key.toUpperCase();
      
      // Only record alphanumeric keys or specific keys we're looking for
      if (/^[A-Z0-9]$/.test(key) || key === 'PANIC' || key === 'TEAM' || key === 'MODULE') {
        // Reset timeout if exists
        if (codeTimeout) {
          clearTimeout(codeTimeout);
        }
        
        // Add key to sequence
        keySequence.push(key);
        
        // Set timeout to clear sequence after delay
        codeTimeout = setTimeout(() => {
          keySequence = [];
        }, codeTimeoutMs);
        
        // Check if we have a valid easter egg sequence
        const sequence = keySequence.join('');
        Object.keys(EASTER_EGGS).forEach(code => {
          if (sequence.includes(code)) {
            EASTER_EGGS[code]();
            keySequence = []; // Reset after triggering
            if (codeTimeout) {
              clearTimeout(codeTimeout);
            }
          }
        });
      }
    });
    
    /**
     * Toggle ambient mode on/off
     * @param {boolean} [forceState] - Force a specific state
     */
    function toggleAmbientMode(forceState) {
      // Use forced state if provided, otherwise toggle
      isAmbientMode = forceState !== undefined ? forceState : !isAmbientMode;
      
      // Find required elements if not already stored
      if (!appElement) appElement = document.getElementById('app');
      if (!bgCanvas) bgCanvas = document.getElementById('background-pong');
      
      if (isAmbientMode) {
        // Enter ambient mode
        console.log("🌟 Ambient Mode Activated 🌟");
        
        // Create ambient container if it doesn't exist
        if (!ambientContainer) {
          ambientContainer = document.createElement('div');
          ambientContainer.id = 'ambient-container';
          ambientContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: black;
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: opacity 1s ease;
            opacity: 0;
          `;
          
          // Create info text that fades out
          const infoText = document.createElement('div');
          infoText.className = 'ambient-info';
          infoText.innerHTML = 'Ambient Mode<br>Press ESC to exit';
          infoText.style.cssText = `
            color: rgba(0, 212, 255, 0.7);
            position: absolute;
            padding: 20px;
            border-radius: 10px;
            font-size: 20px;
            text-align: center;
            opacity: 1;
            transition: opacity 3s ease;
            pointer-events: none;
          `;
          ambientContainer.appendChild(infoText);
          
          // Fade out info text after a few seconds
          setTimeout(() => {
            infoText.style.opacity = 0;
          }, 2000);
          
          document.body.appendChild(ambientContainer);
        } else {
          // Just show the existing container
          ambientContainer.style.display = 'flex';
          ambientContainer.style.opacity = 0;
        }
        
        // Store original opacity and increase it for ambient mode
        if (bgCanvas) {
          originalOpacity = parseFloat(bgCanvas.style.opacity || 0.3);
          
          // Clone the canvas and move it to our ambient container
          const ambientCanvas = bgCanvas.cloneNode(true);
          ambientCanvas.id = 'ambient-pong';
          ambientCanvas.style.opacity = 1; // Full opacity in ambient mode
          ambientCanvas.style.position = 'absolute';
          ambientCanvas.style.zIndex = 0;
          
          // Clear ambient container and add the new canvas
          while (ambientContainer.firstChild) {
            if (!ambientContainer.firstChild.classList.contains('ambient-info')) {
              ambientContainer.removeChild(ambientContainer.firstChild);
            } else {
              // Skip the info text
              break;
            }
          }
          ambientContainer.appendChild(ambientCanvas);
          
          // Create a new background pong instance for the ambient canvas
          // This ensures we have independent animations
          window.ambientPong = initBackgroundPong(ambientCanvas);
        }
        
        // Hide app content
        if (appElement) {
          appElement.style.display = 'none';
        }
        
        // Fade in ambient container
        requestAnimationFrame(() => {
          ambientContainer.style.opacity = 1;
        });
        
        // Request fullscreen if available
        try {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
          } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
          } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
          } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
          }
        } catch (err) {
          console.warn("Couldn't enter fullscreen mode:", err);
        }
        
      } else {
        // Exit ambient mode
        console.log("Ambient Mode Deactivated");
        
        if (ambientContainer) {
          // Fade out
          ambientContainer.style.opacity = 0;
          
          // Wait for fade transition to complete before hiding
          setTimeout(() => {
            ambientContainer.style.display = 'none';
            
            // Stop the ambient pong instance
            if (window.ambientPong && window.ambientPong.pause) {
              window.ambientPong.pause();
            }
          }, 1000);
        }
        
        // Restore app content
        if (appElement) {
          appElement.style.display = 'flex';
        }
        
        // Restore original background opacity
        if (bgCanvas) {
          bgCanvas.style.opacity = originalOpacity;
        }
        
        // Exit fullscreen if we're in it
        try {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        } catch (err) {
          console.warn("Couldn't exit fullscreen mode:", err);
        }
      }
    }
    
    // Add helpful console message for discovering the easter eggs
    console.log("%c🎮 Pong.io Easter Eggs Guide 🎮", "color: #00d4ff; font-size: 16px; font-weight: bold;");
    console.log("%c- Press 'Z' for ambient mode", "color: #87CEEB; font-size: 14px;");
    console.log("%c- Try typing '42'", "color: #87CEEB; font-size: 14px;");
    console.log("%c- Feeling anxious? Type 'panic'", "color: #87CEEB; font-size: 14px;");
    console.log("%c- Want to see the team? Type 'team'", "color: #87CEEB; font-size: 14px;");
    console.log("%c- Unlock a secret module by typing 'module'", "color: #87CEEB; font-size: 14px;");
    
    /**
     * 42 Easter Egg - Hitchhiker's Guide to the Galaxy reference
     */
    function show42EasterEgg() {
      // Create container for the 42 animation
      const container = document.createElement('div');
      container.className = 'easter-egg-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        pointer-events: none;
      `;
      
      // Create the 42 text
      const element = document.createElement('div');
      element.textContent = '42';
      element.className = 'easter-egg-42';
      element.style.cssText = `
        font-size: 200px;
        font-weight: bold;
        color:rgb(255, 255, 255);
        opacity: 0;
        transform: scale(0.5) rotate(-10deg);
        transition: all 0.5s ease-out;
        text-shadow: 0 0 20px rgba(0, 212, 255, 0.8);
        font-family: 'Verdana', sans-serif;
        position: relative;
      `;
      
      // Add to DOM
      container.appendChild(element);
      document.body.appendChild(container);
      
      // Animate in
      setTimeout(() => {
        element.style.opacity = '1';
        element.style.transform = 'scale(1.2) rotate(5deg)';
      }, 10);
      
      // Add additional fun particles
      for (let i = 0; i < 42; i++) {
        createParticle(container, i);
      }
      
      // Animate out and clean up
      setTimeout(() => {
        element.style.opacity = '0';
        element.style.transform = 'scale(2) rotate(0deg)';
        
        setTimeout(() => {
          container.remove();
        }, 1000);
      }, 4200); // 4.2 seconds, because 42!
    }
    
    /**
     * Create a particle for the 42 animation
     */
    function createParticle(container, index) {
      const particle = document.createElement('div');
      particle.className = 'easter-egg-particle';
      
      // Random position around the center
      const angle = Math.random() * Math.PI * 2;
      const distance = 100 + Math.random() * 150;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      
      // Random size
      const size = 5 + Math.random() * 15;
      
      // Position and style
      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: #00d4ff;
        border-radius: 50%;
        left: calc(50% + ${x}px);
        top: calc(50% + ${y}px);
        opacity: 0;
        box-shadow: 0 0 10px rgba(0, 212, 255, 0.8);
      `;
      
      // Add to container
      container.appendChild(particle);
      
      // Animate
      setTimeout(() => {
        particle.style.transition = 'all 3s ease-out';
        particle.style.opacity = Math.random() * 0.5 + 0.3;
        
        // Random movement
        const newAngle = Math.random() * Math.PI * 2;
        const newDistance = 150 + Math.random() * 250;
        const newX = Math.cos(newAngle) * newDistance;
        const newY = Math.sin(newAngle) * newDistance;
        
        particle.style.left = `calc(50% + ${newX}px)`;
        particle.style.top = `calc(50% + ${newY}px)`;
      }, 100 + index * 20);
    }
    
    /**
     * "Don't Panic" Easter Egg - Another Hitchhiker's Guide reference
     */
    function showDontPanicEasterEgg() {
      // Create container
      const container = document.createElement('div');
      container.className = 'easter-egg-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        pointer-events: none;
        background-color: rgba(0, 0, 0, 0.7);
        opacity: 0;
        transition: opacity 0.5s ease;
      `;
      
      // Create the content
      const element = document.createElement('div');
      element.className = 'easter-egg-dont-panic';
      element.style.cssText = `
        background-color: #ff0000;
        color: white;
        font-size: 72px;
        font-weight: bold;
        padding: 40px 60px;
        border-radius: 20px;
        text-align: center;
        box-shadow: 0 0 30px rgba(255, 0, 0, 0.5);
        font-family: 'Impact', sans-serif;
        transform: rotate(-5deg);
        transition: transform 0.5s ease;
      `;
      element.textContent = "DON'T PANIC";
      
      container.appendChild(element);
      document.body.appendChild(container);
      
      // Animate in
      setTimeout(() => {
        container.style.opacity = '1';
      }, 10);
      
      // Add wobble animation
      setTimeout(() => {
        element.style.transform = 'rotate(5deg)';
        
        setTimeout(() => {
          element.style.transform = 'rotate(-3deg)';
          
          setTimeout(() => {
            element.style.transform = 'rotate(0deg)';
          }, 300);
        }, 300);
      }, 500);
      
      // Clean up
      setTimeout(() => {
        container.style.opacity = '0';
        setTimeout(() => {
          container.remove();
        }, 500);
      }, 4000);
    }
    
    /**
     * Contributors Easter Egg - Show the team
     */
    function showContributorsEasterEgg() {
      // Replace with your actual team members
      const contributors = [
        'Gdaryl',
        '42 School',
        'Solocendence Project'
      ];
      
      // Create container
      const container = document.createElement('div');
      container.className = 'easter-egg-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        pointer-events: none;
        background-color: rgba(0, 0, 0, 0.8);
        opacity: 0;
        transition: opacity 1s ease;
        overflow: hidden;
      `;
      
      // Create credits container
      const creditsContainer = document.createElement('div');
      creditsContainer.className = 'easter-egg-credits';
      creditsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translateY(100vh);
        transition: transform 10s linear;
      `;
      
      // Add title
      const title = document.createElement('div');
      title.className = 'credits-title';
      title.textContent = 'SOLOCENDENCE TEAM';
      title.style.cssText = `
        color: #00d4ff;
        font-size: 48px;
        font-weight: bold;
        margin-bottom: 40px;
        text-shadow: 0 0 10px rgba(0, 212, 255, 0.8);
        font-family: 'Arial', sans-serif;
      `;
      creditsContainer.appendChild(title);
      
      // Add contributors
      contributors.forEach(name => {
        const nameElement = document.createElement('div');
        nameElement.textContent = name;
        nameElement.className = 'contributor-name';
        nameElement.style.cssText = `
          color: white;
          font-size: 32px;
          margin-bottom: 30px;
          font-family: 'Arial', sans-serif;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        `;
        creditsContainer.appendChild(nameElement);
      });
      
      // Add thanks message at the end
      const thanks = document.createElement('div');
      thanks.className = 'credits-thanks';
      thanks.textContent = 'Thank you for playing!';
      thanks.style.cssText = `
        color: #00d4ff;
        font-size: 36px;
        font-weight: bold;
        margin-top: 40px;
        margin-bottom: 40px;
        text-shadow: 0 0 10px rgba(0, 212, 255, 0.8);
        font-family: 'Arial', sans-serif;
      `;
      creditsContainer.appendChild(thanks);
      
      // Add to DOM
      container.appendChild(creditsContainer);
      document.body.appendChild(container);
      
      // Animate in
      setTimeout(() => {
        container.style.opacity = '1';
        
        // Start scrolling credits
        setTimeout(() => {
          creditsContainer.style.transform = 'translateY(-100vh)';
        }, 1000);
      }, 10);
      
      // Clean up
      setTimeout(() => {
        container.style.opacity = '0';
        setTimeout(() => {
          container.remove();
        }, 1000);
      }, 12000);
    }
    
    /**
     * Secret Module Easter Egg
     */
    function showSecretModuleEasterEgg() {
      const secretModules = [
        "Time Travel Module",
        "Mind Reading API",
        "Quantum Pong Physics",
        "Bastet Support"
      ];
      
      // Select random module
      const randomModule = secretModules[Math.floor(Math.random() * secretModules.length)];
      
      // Create container
      const container = document.createElement('div');
      container.className = 'easter-egg-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        pointer-events: none;
      `;
      
      // Create notification
      const notification = document.createElement('div');
      notification.className = 'easter-egg-module';
      notification.style.cssText = `
        background-color: rgba(0, 0, 0, 0.8);
        border: 2px solid #00d4ff;
        border-radius: 10px;
        padding: 20px 30px;
        box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
        text-align: center;
        transform: translateY(20px);
        opacity: 0;
        transition: transform 0.5s ease, opacity 0.5s ease;
      `;
      
      // Create content
      notification.innerHTML = `
        <div style="font-size: 36px; margin-bottom: 10px; color: #00d4ff;">🚀</div>
        <div style="font-size: 24px; color: #00d4ff; margin-bottom: 15px; font-weight: bold;">Secret Module Unlocked!</div>
        <div style="font-size: 20px; color: white; margin-bottom: 15px;">${randomModule}</div>
        <div style="font-size: 16px; color: #00ff00;">✓ Installed successfully</div>
        <div style="font-size: 14px; color: #87CEEB; margin-top: 15px; font-style: italic;">This module will self-destruct in 5 seconds</div>
      `;
      
      // Add to DOM
      container.appendChild(notification);
      document.body.appendChild(container);
      
      // Animate in
      setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
      }, 10);
      
      // Add countdown
      let countdown = 5;
      const countdownElement = notification.querySelector('div:last-child');
      
      const interval = setInterval(() => {
        countdown--;
        countdownElement.textContent = `This module will self-destruct in ${countdown} seconds`;
        
        if (countdown <= 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      // Clean up
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        
        setTimeout(() => {
          container.remove();
        }, 500);
      }, 6000);
    }
  });