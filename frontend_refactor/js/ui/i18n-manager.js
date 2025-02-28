/**
 * Internationalization (I18n) Manager Module
 * Handles translations and language switching
 */
const I18nManager = (function() {
    // Private variables
    let currentLanguage = "en";
    
    // Translations for all user-visible strings
    const translations = {
      "en": {
        enterName: "Enter Your Nickname",
        waitingQueue: "Waiting in queue...",
        waitingOpponent: "Waiting for an opponent...",
        aiMode: "Playing with AI",
        minimizedWarning: "Game is minimized. Click to enlarge!",
        noPlayersWaiting: "No players waiting",
        clickToJoin: "Click to join",
        leaderboard: "Leaderboard",
        rounds: "Rounds",
        nicknameRequired: "Please enter a nickname!",
        invalidNickname: "This nickname is too cool to be used here!",
        gameEnded: "Game ended and result recorded!",
        gameWon: "Congratulations! You won the game!",
        gameLost: "Game over. Better luck next time!",
        failedToRecord: "Failed to record game result!",
        connectionError: "Connection error. Please check your internet connection.",
        reconnectFailed: "Could not reconnect to server. Please refresh the page.",
        opponentLeft: "Your opponent has left the game.",
        selectLanguage: "Select Language",
        next: "Next",
        back: "Back",
        joinGame: "JOIN GAME",
        loading: "Loading...",
        gameMode: "Game mode",
        gamePaused: "Game Paused",
        clickToFullscreen: "Click to enter fullscreen and continue playing",
        controlsDisabled: "Controls disabled in minimized mode",
        privacyPolicy: "Privacy Policy",
        deleteData: "Delete My Data",
        verificationRequired: "Verification Required",
        dataDeleted: "Your data has been successfully deleted",
        verificationFailed: "Verification failed. Please check your code.",
        errorOccurred: "An error occurred. Please try again later."
      },
      "es": {
        enterName: "Ingrese su Apodo",
        waitingQueue: "Esperando en cola...",
        waitingOpponent: "Esperando a un oponente...",
        aiMode: "Jugando con IA",
        minimizedWarning: "Juego minimizado. ¡Haz clic para agrandar!",
        noPlayersWaiting: "No hay jugadores esperando",
        clickToJoin: "Haga clic para unirse",
        leaderboard: "Tabla de clasificación",
        rounds: "Rondas",
        nicknameRequired: "¡Por favor ingrese un apodo!",
        invalidNickname: "¡Este apodo es demasiado genial para usarse aquí!",
        gameEnded: "¡Juego terminado y victoria registrada!",
        gameWon: "¡Felicidades! ¡Ganaste el juego!",
        gameLost: "Fin del juego. ¡Mejor suerte la próxima vez!",
        failedToRecord: "¡No se pudo registrar la victoria!",
        connectionError: "Error de conexión. Por favor, compruebe su conexión a internet.",
        reconnectFailed: "No se pudo volver a conectar al servidor. Por favor, actualice la página.",
        opponentLeft: "Tu oponente ha abandonado el juego.",
        selectLanguage: "Seleccionar Idioma",
        next: "Siguiente",
        back: "Atrás",
        joinGame: "UNIRSE AL JUEGO",
        loading: "Cargando...",
        gameMode: "Modo de juego",
        gamePaused: "Juego en Pausa",
        clickToFullscreen: "Haga clic para entrar en pantalla completa y continuar jugando",
        controlsDisabled: "Controles desactivados en modo minimizado",
        privacyPolicy: "Política de Privacidad",
        deleteData: "Eliminar Mis Datos",
        verificationRequired: "Verificación Requerida",
        dataDeleted: "Tus datos han sido eliminados exitosamente",
        verificationFailed: "Verificación fallida. Por favor, verifica tu código.",
        errorOccurred: "Ha ocurrido un error. Por favor, inténtalo de nuevo más tarde."
      },
      "fr": {
        enterName: "Entrez votre pseudo",
        waitingQueue: "En attente dans la file...",
        waitingOpponent: "En attente d'un adversaire...",
        aiMode: "Jouer contre IA",
        minimizedWarning: "Jeu minimisé. Cliquez pour agrandir!",
        noPlayersWaiting: "Aucun joueur en attente",
        clickToJoin: "Cliquez pour rejoindre",
        leaderboard: "Classement",
        rounds: "Manches",
        nicknameRequired: "Veuillez entrer un pseudo!",
        invalidNickname: "Ce pseudo est trop cool pour être utilisé ici!",
        gameEnded: "Partie terminée et victoire enregistrée!",
        gameWon: "Félicitations! Vous avez gagné la partie!",
        gameLost: "Partie terminée. Meilleure chance la prochaine fois!",
        failedToRecord: "Échec de l'enregistrement de la victoire!",
        connectionError: "Erreur de connexion. Veuillez vérifier votre connexion internet.",
        reconnectFailed: "Impossible de se reconnecter au serveur. Veuillez actualiser la page.",
        opponentLeft: "Votre adversaire a quitté la partie.",
        selectLanguage: "Choisir la langue",
        next: "Suivant",
        back: "Retour",
        joinGame: "REJOINDRE LA PARTIE",
        loading: "Chargement...",
        gameMode: "Mode de jeu",
        gamePaused: "Jeu en Pause",
        clickToFullscreen: "Cliquez pour passer en plein écran et continuer à jouer",
        controlsDisabled: "Contrôles désactivés en mode minimisé",
        privacyPolicy: "Politique de Confidentialité",
        deleteData: "Supprimer Mes Données",
        verificationRequired: "Vérification Requise",
        dataDeleted: "Vos données ont été supprimées avec succès",
        verificationFailed: "Échec de la vérification. Veuillez vérifier votre code.",
        errorOccurred: "Une erreur s'est produite. Veuillez réessayer plus tard."
      }
    };
    
    /**
     * Initialize the I18n manager
     * @param {string} language - Initial language code
     * @returns {Object} - Public API
     */
    function init(language = "en") {
      // Validate language
      if (translations[language]) {
        currentLanguage = language;
      } else {
        console.warn(`Language not supported: ${language}, falling back to English`);
      }
      
      console.log(`I18n initialized with language: ${currentLanguage}`);
      
      return publicAPI;
    }
    
    /**
     * Get translation for a specific key
     * @param {string} key - Translation key
     * @param {Object} params - Parameters to replace in the translation
     * @returns {string} - Translated text
     */
    function get(key, params = {}) {
      // Check if translation exists
      if (translations[currentLanguage] && translations[currentLanguage][key]) {
        let text = translations[currentLanguage][key];
        
        // Replace parameters if any
        if (params && Object.keys(params).length > 0) {
          Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
          });
        }
        
        return text;
      }
      
      // Fallback to English
      if (translations["en"] && translations["en"][key]) {
        console.warn(`Translation missing for key: ${key} in language: ${currentLanguage}`);
        return translations["en"][key];
      }
      
      // Last resort: return the key itself
      console.error(`Translation key not found: ${key}`);
      return key;
    }
    
    /**
     * Set the current language
     * @param {string} language - Language code
     * @returns {boolean} - Whether language was changed
     */
    function setLanguage(language) {
      if (translations[language]) {
        currentLanguage = language;
        console.log(`Language changed to: ${language}`);
        return true;
      } else {
        console.error(`Language not supported: ${language}`);
        return false;
      }
    }
    
    /**
     * Get the current language code
     * @returns {string} - Current language code
     */
    function getCurrentLanguage() {
      return currentLanguage;
    }
    
    /**
     * Get all supported languages
     * @returns {Object} - Object with language codes as keys and names as values
     */
    function getSupportedLanguages() {
      return {
        en: "English",
        es: "Español",
        fr: "Français"
      };
    }
    
    /**
     * Add or update translations for a specific language
     * @param {string} language - Language code
     * @param {Object} newTranslations - Object with new translations
     * @returns {boolean} - Whether translations were added/updated
     */
    function addTranslations(language, newTranslations) {
      if (!language || typeof newTranslations !== 'object') {
        console.error('Invalid parameters for addTranslations');
        return false;
      }
      
      // Create language entry if it doesn't exist
      if (!translations[language]) {
        translations[language] = {};
      }
      
      // Add/update translations
      Object.assign(translations[language], newTranslations);
      
      console.log(`Added/updated translations for language: ${language}`);
      return true;
    }
    
    // Public API
    const publicAPI = {
      init,
      get,
      setLanguage,
      getCurrentLanguage,
      getSupportedLanguages,
      addTranslations
    };
    
    return publicAPI;
  })();