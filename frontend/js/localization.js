/**
 * Localization Manager Module
 * Handles translations and language switching
 */
const LocalizationManager = (function() {
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
        gameWon: "Félicitations! Vous avez gagné!",
        gameLost: "Partie terminée. Bonne chance pour la prochaine fois!",
        failedToRecord: "Échec de l'enregistrement du résultat!",
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
        controlsDisabled: "Contrôles désactivés en mode minimisé"
      },
      "ms": {
        enterName: "Masukkan Nama Samaran Anda",
        waitingQueue: "Menunggu dalam barisan...",
        waitingOpponent: "Menunggu lawan...",
        aiMode: "Bermain dengan AI",
        minimizedWarning: "Permainan diminimumkan. Klik untuk membesarkan!",
        noPlayersWaiting: "Tiada pemain yang menunggu",
        clickToJoin: "Klik untuk sertai",
        leaderboard: "Papan Pendahulu",
        rounds: "Pusingan",
        nicknameRequired: "Sila masukkan nama samaran!",
        invalidNickname: "Nama samaran ini terlalu hebat untuk digunakan di sini!",
        gameEnded: "Permainan tamat dan keputusan direkodkan!",
        gameWon: "Tahniah! Anda menang!",
        gameLost: "Permainan tamat. Semoga berjaya lain kali!",
        failedToRecord: "Gagal merekod keputusan permainan!",
        connectionError: "Ralat sambungan. Sila semak sambungan internet anda.",
        reconnectFailed: "Tidak dapat menyambung semula ke pelayan. Sila muat semula halaman.",
        opponentLeft: "Lawan anda telah meninggalkan permainan.",
        selectLanguage: "Pilih Bahasa",
        next: "Seterusnya",
        back: "Kembali",
        joinGame: "SERTAI PERMAINAN",
        loading: "Memuatkan...",
        gameMode: "Mod permainan",
        gamePaused: "Permainan Dijeda",
        clickToFullscreen: "Klik untuk skrin penuh dan terus bermain",
        controlsDisabled: "Kawalan dilumpuhkan dalam mod minimum"
      }
  };

  
  /**
   * Initialize the localization manager
   * @param {string} language - Initial language code
   */
  function init(language = "en") {
    currentLanguage = language;
    console.log(`Localization initialized with language: ${language}`);
  }
  
  /**
   * Get translation for a specific key
   * @param {string} key - Translation key
   * @returns {string} - Translated text
   */
  function get(key) {
    // Check if translation exists
    if (translations[currentLanguage] && translations[currentLanguage][key]) {
      return translations[currentLanguage][key];
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
   */
  function setLanguage(language) {
    if (translations[language]) {
      currentLanguage = language;
      console.log(`Language changed to: ${language}`);
    } else {
      console.error(`Language not supported: ${language}`);
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
   * @returns {Array} - Array of supported language codes
   */
  function getSupportedLanguages() {
    return Object.keys(translations);
  }
  
  /**
   * Translate a DOM element and its children
   * @param {HTMLElement} element - Root element to translate
   */
  function translateElement(element) {
    // Find all elements with data-i18n attribute
    const elements = element.querySelectorAll('[data-i18n]');
    
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = get(key);
    });
  }
  
  // Public API
  return {
    init,
    get,
    setLanguage,
    getCurrentLanguage,
    getSupportedLanguages,
    translateElement
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalizationManager;
}

window.LocalizationManager = LocalizationManager;