// single_player_game.js - Handles the game logic and saves scores to the server.

// ===== API URL =====
import API_URL from "./config.js";

// ===== Game Data and Topics (for word generation) =====
const topics = [
      "Maurya_Empire", "Gupta_Empire", "Mughal_Empire", "Delhi_Sultanate",
      "Maratha_Empire", "Chola_Dynasty", "Battle_of_Plassey", "Battle_of_Panipat",
      "Quit_India_Movement", "Civil_Disobedience", "Non_Cooperation_Movement",
      "Swadeshi_Movement", "Indian_National_Congress", "Rani_of_Jhansi",
      "Mahatma_Gandhi", "Bhagat_Singh", "Subhas_Chandra_Bose", "Sardar_Patel",
      "Jawaharlal_Nehru", "Green_Revolution", "White_Revolution", "Blue_Revolution",
      "ISRO", "Chandrayaan_3", "Mangalyaan", "Digital_India", "Make_in_India",
      "Startup_India", "Goods_and_Services_Tax", "Indian_Railways",
      "LIC_of_India", "Bombay_Stock_Exchange", "RBI",
      "Economic_Liberalization_1991", "Five_Year_Plans", "Sachin_Tendulkar", 
      "Virat_Kohli", "Kapil_Dev", "M_S_Dhoni", "P_V_Sindhu", "Neeraj_Chopra",
      "Abhinav_Bindra", "Mary_Kom", "Milkha_Singh", "Dipa_Karmakar", "Saina_Nehwal",
      "1983_Cricket_World_Cup", "2011_Cricket_World_Cup", "2020_Tokyo_Olympics",
      "Asian_Games", "Commonwealth_Games", "Ramayana", "Mahabharata", "Vedas",
      "Upanishads", "Sanchi_Stupa", "Ajanta_Caves", "Ellora_Caves", "Taj_Mahal",
      "Qutub_Minar", "Sun_Temple_Konark", "Brihadeeswara_Temple", "Charminar",
      "Gateway_of_India", "Red_Fort", "India_Gate", "G20_Summit_India",
      "Bullet_Train_Project", "Atal_Tunnel", "Statue_of_Unity", "Smart_Cities_Mission",
      "Swachh_Bharat", "UPI", "Aadhaar", "Startup_Ecosystem"
    ];
    
    // ===== DOM Elements (Must match HTML IDs) =====

    const gameArea = document.getElementById("game-area");
    const typedWordInput = document.getElementById("typed-word");
    const scoreDisplay = document.getElementById("score");
    const streakDisplay = document.getElementById("streak");
    const livesDisplay = document.getElementById("lives");
    const gameOverScreen = document.getElementById("game-over");
    const finalScore = document.getElementById("final-score");
    const playAgainBtn = document.getElementById("play-again");
    const gameTitle = document.getElementById("game-title");
    
    // Pause/Menu Elements
    const pauseModal = document.getElementById("pause-modal");
    const resumeBtn = document.getElementById("resume-btn");
    const quitToLevelsBtn = document.getElementById("quit-to-levels-btn");
    const menuButton = document.getElementById("menu-button"); // The main menu/pause button
    
    // ===== Game State Variables =====
    let words = [];
    let score = 0;
    let streak = 0;
    let lives = 3;
    let gameInterval;
    let activeWords = [];
    let maxStreak = 0; 
    let totalTypedCharacters = 0; 
    let startTime = Date.now(); 
    let isGameActive = false; // Controlled by startGame/openPauseModal
    
    let correctSound = document.getElementById("correct-sound");
    let wrongSound = document.getElementById("wrong-sound");
    
    const params = new URLSearchParams(window.location.search);
    const level = params.get("level") || "easy";
    
    // ✅ Difficulty settings (Hardcoded fallback for now)
    let spawnDelay, fallSpeed, maxLen;
    switch (level) {
      case "easy":
        spawnDelay = 3000; fallSpeed = .8; maxLen = 7; break;
      case "medium":
        spawnDelay = 2500; fallSpeed = 1.3; maxLen = 9; break;
      case "hard":
        spawnDelay = 2500; fallSpeed = 1.5; maxLen = 10; break; 
      default:
        spawnDelay = 2500; fallSpeed = 1.5; maxLen = 9;
    }
    gameTitle.textContent = "Typing Rush — " + level.charAt(0).toUpperCase() + level.slice(1) + " Level";
    
    // Function to get the saved user token and username
    function getAuthData() {
        const token = sessionStorage.getItem("tr_token");
        const userJson = sessionStorage.getItem("tr_user");
        if (token && userJson) {
            try {
                return { token, user: JSON.parse(userJson) };
            } catch (e) {
                console.error("Failed to parse user session data:", e);
            }
        }
        return null;
    }
    
    // --- FUNCTION: SAVE SCORE TO SERVER (Logs all matches and updates PB) ---
    async function saveScoreToServer(finalScore, finalStreak) {
        if (finalScore <= 0) {
            console.warn("Score is zero or negative. Not saving to database.");
            return;
        }
    
        const authData = getAuthData();
        if (!authData) {
            console.warn("User not authenticated. Score not saved.");
            alert("Authentication required to save score.");
            return;
        }
    
        const elapsedTimeMinutes = (Date.now() - startTime) / 60000;
        const wpm = Math.round((totalTypedCharacters / 5) / elapsedTimeMinutes) || 0; 
    
        const payload = {
            score: finalScore,
            level: level,
            streak: finalStreak,
            wpm: wpm,
            game_type: 'single'
        };
    
        try {
            const response = await fetch(`${API_URL}/save_score`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${authData.token}`
                },
                body: JSON.stringify(payload)
            });
    
            const result = await response.json();
    
            if (response.ok) {
                alert(`Score saved! ${result.message}`);
                console.log("Save Score Success:", result);
            } else {
                console.error("Failed to save score:", result.error || response.statusText);
                alert(`Error saving score: ${result.error || response.statusText}`);
            }
        } catch (e) {
            console.error("Network error during score save:", e);
            alert("Network error: Could not connect to score server.");
        }
    }
    
    
    // --- UTILITIES (markWordAsCracked, handleWrongWord, flashGameArea, fetchWords) ---

    // ✅ Crack animation for wrong words
// ===========================
// ⚡ IMPROVED CRACK ANIMATION
// ===========================
function markWordAsCracked(wordElement) {
    if (!wordElement || !gameArea.contains(wordElement)) return;

    // Prevent multiple cracks on same element
    if (wordElement.dataset.cracked === "true") return;
    wordElement.dataset.cracked = "true";

    // Freeze its position (so it doesn't keep falling)
    const currentTop = wordElement.style.top;
    wordElement.style.transition = "none";
    wordElement.style.top = currentTop;

    // Split text into two halves
    const originalText = wordElement.dataset.word || wordElement.textContent;
    const mid = Math.floor(originalText.length / 2);
    const left = originalText.slice(0, mid);
    const right = originalText.slice(mid);

    // Apply cracked HTML
    wordElement.innerHTML = `
        <span class="left-crack">${left}</span>
        <span class="right-crack">${right}</span>
        <div class="crack-flash"></div>
    `;
    wordElement.classList.add("cracked");

    // Remove after animation completes
    setTimeout(() => {
        if (gameArea.contains(wordElement)) {
            gameArea.removeChild(wordElement);
        }
        activeWords = activeWords.filter(w => w !== wordElement);
    }, 1000);
}

function handleWrongWord(wordElement) {
    if (!wordElement || !gameArea.contains(wordElement)) return;

    // Add shake first for impact
    wordElement.classList.add("wrong");
    setTimeout(() => {
        wordElement.classList.remove("wrong");
        markWordAsCracked(wordElement);
    }, 300);
}


    
    const GA = document.getElementById('game-area');
    
    function flashGameArea(cls) {
      if (!GA) return;
      GA.classList.remove(cls);
      void GA.offsetWidth;
      GA.classList.add(cls);
      const off = (e) => {
        const n = e.animationName;
        if (
          (cls === 'shake' && n === 'screenShake') ||
          (cls === 'flash-life' && n === 'flashRed') ||
          (cls === 'flash-streak' && n === 'flashGold') ||
          (cls === 'ripple' && n === 'rippleBurst')
        ) {
          GA.classList.remove(cls);
          GA.removeEventListener('animationend', off);
        }
      };
      GA.addEventListener('animationend', off);
    }
    
    async function fetchWords() {
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&explaintext&exsentences=15&titles=${randomTopic}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        const pages = data.query.pages;
        const page = Object.values(pages)[0];
        let text =
          page.extract ||
          "India has a long and diverse history, with kingdoms, empires, and cultural achievements.";
    
        let newWords = text
          .split(/\s+/)
          .map((w) => {
            if (level === "hard") return w.replace(/[^a-zA-Z,]/g, "");
            else return w.replace(/[^a-zA-Z]/g, "");
          })
          .filter((w) => w.length > 3 && w.length <= maxLen);
    
        newWords = [...new Set(newWords)];
        words.push(...newWords);
    
      } catch (e) {
        console.error("Wiki fetch failed", e);
      }
    }
    
    // --- PAUSE/RESUME/QUIT LOGIC (Core Implementation) ---
    
    function openPauseModal() {
        if (!isGameActive) return; // Prevent double pause
        
        isGameActive = false; // Pauses all motion, prevents input
        
        // Stop time-based intervals (spawning)
        clearInterval(gameInterval); 
        
        if (pauseModal) {
            pauseModal.style.display = 'flex';
            if (typedWordInput) typedWordInput.disabled = true;
        }
    }
    
    function resumeGame() {
        // We rely on isGameActive being false to determine if we were paused
        if (isGameActive) return; 

        isGameActive = true; 
        
        if (pauseModal) {
            pauseModal.style.display = 'none';
        }
        
        // Restart the game interval to resume spawning
        clearInterval(gameInterval);
        gameInterval = setInterval(() => {
            if (activeWords.length < 3) spawnWord();
        }, spawnDelay);
        
        if (typedWordInput) {
            typedWordInput.disabled = false;
            typedWordInput.focus();
        }
    }
    
    function quitGame() {
        // 1. End the game (log score and clean up)
        endGame(); 
        
        // 2. Redirect the user
        setTimeout(() => {
            window.location.replace("levels.html"); 
        }, 500); 
    }
    
    // --- CORE GAME START/END ---
    
    function startGame() {
      // Authentication check
      const auth = getAuthData();
      if (!auth) {
          alert("You must be logged in to play the game.");
          window.location.replace("index.html"); 
          return;
      }
        
      score = 0;
      streak = 0;
      lives = 3; // Reset lives to 3 at the start
      maxStreak = 0; 
        totalTypedCharacters = 0; 
        startTime = Date.now(); 
        isGameActive = true; 
        activeWords.forEach((w) => w.remove()); // Clear any old words from a previous game
        activeWords = [];
        scoreDisplay.textContent = "Score: " + score;
        streakDisplay.textContent = "Streak: " + streak;
        livesDisplay.textContent = "❤️".repeat(lives);
        gameOverScreen.classList.add("hidden");
        if (typedWordInput) {
          typedWordInput.disabled = false;
          typedWordInput.focus();
      }
        
        fetchWords();
    
        // Restart game interval
        clearInterval(gameInterval);
        gameInterval = setInterval(() => {
          if (activeWords.length < 3) spawnWord();
        }, spawnDelay);
        
        // Set up beforeunload warning
        window.addEventListener('beforeunload', preventRefreshExit);
    }
    
    function endGame() {
        if (!isGameActive) return; // Prevent double execution
        
        isGameActive = false; 
        
      clearInterval(gameInterval); // Clears spawning interval
      activeWords.forEach((w) => w.remove());
      activeWords = [];
      if (typedWordInput) typedWordInput.disabled = true;
      
      const finalScoreValue = score;

      if (finalScore) finalScore.textContent = finalScoreValue;
      if (gameOverScreen) gameOverScreen.classList.remove("hidden");
        
      if (finalScoreValue > 0) { 
          saveScoreToServer(finalScoreValue, maxStreak);
      } else {
          console.log("Game ended with zero score. Not saving.");
      }
      
      // Clean up beforeunload warning
      window.removeEventListener('beforeunload', preventRefreshExit);
    }
    
    // --- VISUAL & GAME LOGIC ---
    
    function showStreakPopup(msg) {
      const popup = document.createElement("div");
      popup.classList.add("streak-popup");
      popup.textContent = msg;
      document.body.appendChild(popup);
      setTimeout(() => popup.remove(), 2000);
    }
    
    function showRewardMessage(msg) {
      const msgEl = document.createElement("div");
      msgEl.classList.add("reward-message");
      msgEl.textContent = msg;
      gameArea.appendChild(msgEl);
      msgEl.style.left = "50%";
      msgEl.style.top = "20px";
      setTimeout(() => msgEl.remove(), 2000);
    }
    
    function spawnWord() {
      if (words.length === 0) return; 
        
        if (words.length < 10) {
            console.log("Word buffer low. Fetching more words.");
            fetchWords();
        }
    
      const wordText = words.shift();
      const wordEl = document.createElement("div");
      wordEl.classList.add("word");
      wordEl.textContent = wordText;
      wordEl.style.visibility = "hidden";
      gameArea.appendChild(wordEl);
      const wordWidth = wordEl.offsetWidth;
      const margin = 50;
      const maxLeft = gameArea.offsetWidth - wordWidth - margin;
      const left = margin + Math.random() * maxLeft;
      wordEl.style.left = left + "px";
      wordEl.style.top = "0px";
      wordEl.style.visibility = "visible";
      activeWords.push(wordEl);
      let velocity = fallSpeed;
      let sway = (Math.random() * 2 - 1) * 0.5;
      let swayDirection = Math.random() > 0.5 ? 1 : -1;
    
      function fall() {
          
          requestAnimationFrame(fall); 
          
          if (!isGameActive) return; // Only skip the movement steps if paused.
          
          let top = parseFloat(wordEl.style.top || 0);
          let left = parseFloat(wordEl.style.left || 0);
    
          if (level === "hard") {
            velocity = Math.min(velocity + 0.01, 2.5);
            left += sway * swayDirection;
            if (Math.random() < 0.02) swayDirection *= -1;
          }
    
          wordEl.style.top = top + velocity + "px"; // Update position
          wordEl.style.left = left + "px";
    
          if (top > gameArea.offsetHeight - 40) {
            if (gameArea.contains(wordEl)) {
              
              // ⭐️ FIX: Check if the word is already solved OR penalized
              if (wordEl.dataset.solved === "true" || wordEl.dataset.penalized === "true") {
                if (gameArea.contains(wordEl)) gameArea.removeChild(wordEl);
                activeWords = activeWords.filter((w) => w !== wordEl);
                return; 
              }
              
              // 1. Mark as penalized immediately to prevent subsequent calls in the next frame.
              wordEl.dataset.penalized = "true";
                
              // 2. Start the visual process and deduct ONE life
              handleWrongWord(wordEl);
              loseLife();
              
              // 3. CRITICAL: Remove the word from the active list and stop its loop immediately.
              activeWords = activeWords.filter((w) => w !== wordEl);
              return; // Terminate this requestAnimationFrame loop for the fallen word.
            }
          }
      }
      requestAnimationFrame(fall); // Initial call
    }
    
    
    // ✅ Typing input (updated maxStreak tracking)
    typedWordInput.addEventListener("input", () => {
      if (!isGameActive) return; // Prevent input while paused
      
      const inputVal = typedWordInput.value.trim();
      const matchedWord = activeWords.find((w) => w.textContent === inputVal);
    
      if (matchedWord) {
        matchedWord.classList.add("correct");
        matchedWord.dataset.solved = "true";
        totalTypedCharacters += inputVal.length; // NEW: Track characters
        correctSound.currentTime = 0;
        correctSound.play();
        score += 10;
        streak++;
        maxStreak = Math.max(maxStreak, streak); // NEW: Update max streak
        scoreDisplay.textContent = "Score: " + score;
    
        if (streak > 0 && streak % 5 === 0) {
          showStreakPopup(`🔥 Streak ${streak}! 🔥`);
          flashGameArea('flash-streak');
          flashGameArea('ripple');
    
          streakDisplay.textContent = "Streak: " + streak;
          if (lives < 5) {
            lives++;
            livesDisplay.textContent = "❤️".repeat(lives);
            showRewardMessage("❤️ Life Increased!");
          } else {
            score += 30;
            scoreDisplay.textContent = "Score: " + score;
            showRewardMessage("⭐ Bonus +30!");
          }
        } else {
          streakDisplay.textContent = "Streak: " + streak;
        }
    
        // Word removal after typing.
        setTimeout(() => {
          if (gameArea.contains(matchedWord)) gameArea.removeChild(matchedWord);
          activeWords = activeWords.filter((w) => w !== matchedWord);
        }, 500);
    
        typedWordInput.value = "";
      }
    });
    
    // ✅ Lose Life (remains correct: checks if lives are depleted before calling endGame)
    function loseLife() {
      lives--;
      wrongSound.currentTime = 0;
      wrongSound.play();
      livesDisplay.textContent = "❤️".repeat(lives);
      streak = 0;
      streakDisplay.textContent = "Streak: 0";
      flashGameArea('flash-life');
      flashGameArea('shake');
    
      if (lives <= 0) endGame();
    }
    
    // --- EVENT LISTENERS (HTML Button Links) ---
    
    playAgainBtn.addEventListener("click", () => {
        if (getAuthData()) {
            startGame();
        } else {
            alert("Authentication required to play.");
            window.location.replace("index.html");
        }
    });
    
    if (resumeBtn) resumeBtn.addEventListener('click', resumeGame); 
    if (quitToLevelsBtn) quitToLevelsBtn.addEventListener('click', quitGame); 
    if (menuButton) menuButton.addEventListener('click', openPauseModal);
    
    // --- ESC Key Pause/Resume ---
    function handleEscKey(e) {
        if (e.key === "Escape") {
            if (isGameActive) {
                openPauseModal();
            } else { // isGameActive is false, check if we are in the pause modal
                // We rely on the pauseModal being visible to determine the "paused" state
                if (pauseModal && pauseModal.style.display !== 'none') {
                    resumeGame();
                }
            }
        }
    }
    window.addEventListener('keydown', handleEscKey);
    
    // --- Handle Page Exit/Refresh Warning ---
    function preventRefreshExit(e) {
        if (isGameActive) { // Only check if game is active/paused
            e.preventDefault(); 
            e.returnValue = 'Your current score will not be saved if you leave now. Are you sure?'; 
        }
    }
    
    // --- INITIAL START ---
    startGame();