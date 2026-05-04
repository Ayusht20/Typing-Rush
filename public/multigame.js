import API_URL from "./config.js";

let socket = null;
let activeWords = [];
let score = 0;
let lives = 3;
let streak = 0;
let maxStreak = 0; 
let startTime = Date.now();
let totalTypedCharacters = 0;
let timerInterval;
let spawnInterval; 
let fallSpeed;
let matchRoomId = null;
let gameMode = null;
let players = []; // Stores the usernames of both players
// FIX 1: Add playerIds state variable
let playerIds = {}; // Stores { username: id, opponent_username: opponent_id }
// ------------------------------------------

let isGameActive = false; // Initial state: Game is NOT active

// ===== DOM Elements (assuming these IDs exist in the HTML) =====
const typedWordInput = document.getElementById("typed-word");
const myScoreDisplay = document.getElementById("myScoreDisplay");
const opponentScoreDisplay = document.getElementById("player2ScoreDisplay");
const myWpmDisplay = document.getElementById("player1WpmDisplay"); // Reused for WPM
const opponentWpmDisplay = document.getElementById("player2WpmDisplay");
const timeLeftDisplay = document.getElementById("timeLeftDisplay");
const gameArea = document.getElementById("game-area");
const gameOverScreen = document.getElementById("game-over");
const matchResultText = document.getElementById("matchResultText");
const myLivesDisplay = document.getElementById("myLivesDisplay");
const opponentLivesDisplay = document.getElementById("player2LivesDisplay");
const streakDisplay = document.getElementById("streakDisplay");
const gameTitle = document.getElementById("game-title");
const correctSound = document.getElementById("correctSound");
const wrongSound = document.getElementById("wrongSound");
const player1NameEl = document.getElementById("player1Name");
const player2NameEl = document.getElementById("player2Name");
const player1ScoreEl = document.getElementById("player1ScoreDisplay");
const player1WpmEl = document.getElementById("player1WpmDisplay");
const player1LivesEl = document.getElementById("player1LivesDisplay");


// ===== Helpers & Visual Effects =====
function getSavedUser() {
    const token = sessionStorage.getItem("tr_token");
    const user = sessionStorage.getItem("tr_user");
    return token && user ? { token, user: JSON.parse(user) } : null;
}

function flashGameArea(cls) {
    const GA = document.getElementById('game-area');
    GA.classList.remove(cls);
    void GA.offsetWidth;
    GA.classList.add(cls);
    const off = (e) => {
        const n = e.animationName;
        if ((cls === 'shake' && n === 'screenShake') ||
            (cls === 'flash-life' && n === 'flashRed') ||
            (cls === 'ripple' && n === 'rippleBurst')) {
            GA.classList.remove(cls);
            GA.removeEventListener('animationend', off);
        }
    };
    GA.addEventListener('animationend', off);
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

function handleWrongWord(wordEl) {
    if (!wordEl || wordEl.dataset.solved === "true") return;

    // Stop the word's fall and snap to the bottom
    const freezeTop = gameArea.clientHeight - wordEl.offsetHeight;
    wordEl.style.top = freezeTop + "px";
    wordEl.style.transition = "none";
    
    // Add cracked visual effect
    const originalText = wordEl.textContent;
    const mid = Math.floor(originalText.length / 2);
    const left = originalText.slice(0, mid);
    const right = originalText.slice(mid);
    wordEl.innerHTML = `<span class="left">${left}</span><span class="right">${right}</span>`;
    wordEl.classList.add("cracked");
    
    // Remove the word after the animation
    setTimeout(() => {
        if (gameArea.contains(wordEl)) {
            gameArea.removeChild(wordEl);
        }
        // Ensure activeWords is updated when word falls off or is missed
        activeWords = activeWords.filter((w) => w !== wordEl);
    }, 1000);
}

// --- LOG FULL MATCH DETAILS (TO HISTORY TABLE) ---
async function logMatchDetails(data, myMaxStreak) {
    const authData = getSavedUser();
    if (!authData || !data.scores) return { success: true, message: "No match log sent." };

    const myUsername = authData.user.username;
    const myId = authData.user.id; 
    const opponentUsername = players.find(p => p !== myUsername);
    
    // FIX: Use the stored playerIds for the opponent's ID
    const opponentId = playerIds[opponentUsername] || 0; 
    
    // Safely retrieve final metrics
    const myMetrics = data.scores[myUsername] || { score: 0, wpm: 0, lives: 0 };
    const opponentMetrics = data.scores[opponentUsername] || { score: 0, wpm: 0, lives: 0 };
    
    // Determine player order consistently based on username for database columns (p1 vs p2)
    const [p1, p2] = myUsername < opponentUsername 
        ? [ { name: myUsername, id: myId, metrics: myMetrics, streak: myMaxStreak }, 
            { name: opponentUsername, id: opponentId, metrics: opponentMetrics, streak: 0 } ]
        : [ { name: opponentUsername, id: opponentId, metrics: opponentMetrics, streak: 0 },
            { name: myUsername, id: myId, metrics: myMetrics, streak: myMaxStreak } ];

    const payload = {
        roomId: matchRoomId,
        winner: data.winner,
        level: gameMode,
        
        player1Id: p1.id, 
        player1Username: p1.name,
        player1Score: p1.metrics.score,
        player1Wpm: p1.metrics.wpm,
        player1Streak: p1.streak,

        player2Id: p2.id,
        player2Username: p2.name,
        player2Score: p2.metrics.score,
        player2Wpm: p2.metrics.wpm,
        player2Streak: p2.streak,
    };

    try {
        const response = await fetch(`${API_URL}/log_match`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authData.token}`
            },
            body: JSON.stringify(payload)
        });

        const resultData = await response.json();
        if (response.ok) {
            console.log("Match History Logged:", resultData);
        } else {
            console.error("Failed to log match history:", resultData.error || response.statusText);
        }
        return { success: response.ok, message: resultData.message || "Match logged successfully." };
    } catch (e) {
        console.error("Network error logging match:", e);
        return { success: false, message: "Network error during match log." };
    }
}

// --- SAVE PERSONAL BEST SCORE (Multiplayer PB only) ---
async function savePersonalBest(finalScore, finalStreak) {
    const authData = getSavedUser();
    if (!authData || finalScore <= 0) return { success: true, message: "PB Update: Skipped (Score <= 0)." };

    // Calculate WPM based on elapsed time up to the end of the game (60 seconds or life loss)
    const endTime = Date.now();
    const elapsedTimeMinutes = (endTime - startTime) / 60000;
    const wpm = Math.round((totalTypedCharacters / 5) / elapsedTimeMinutes) || 0; 

    const payload = {
        score: finalScore,
        level: gameMode,
        streak: finalStreak,
        wpm: wpm,
        game_type: 'multi', // KEY: Mark as multiplayer PB
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
        
        const resultData = await response.json();
        const msg = resultData.message || (response.ok ? "New Personal Best Saved!" : "PB save failed.");
        return { success: response.ok, message: msg };
    } catch (e) {
        console.error("Network error saving PB:", e);
        return { success: false, message: "Network error saving personal best." };
    }
}


// ===== Game Logic (UPDATED) =====
function setGameDifficulty(mode) {
    let spawnDelay, maxActiveWords;

    switch (mode) {
        case "easy": 
            fallSpeed = 1; spawnDelay = 3000; maxActiveWords = 3; break;
        case "medium": 
            fallSpeed = 1.5; spawnDelay = 2500; maxActiveWords = 4; break;
        case "hard": 
            fallSpeed = 1.8; spawnDelay = 2400; maxActiveWords = 5; break;
        default: 
            fallSpeed = 1; spawnDelay = 3000; maxActiveWords = 3;
    }
    
    gameTitle.textContent = `Typing Rush — ${mode.charAt(0).toUpperCase() + mode.slice(1)} Level`;
    return { spawnDelay, maxActiveWords };
}

function startGame(mode, roomId, gamePlayers, ids) {
    const difficulty = setGameDifficulty(mode);
    const { spawnDelay, maxActiveWords } = difficulty;
    
    matchRoomId = roomId;
    gameMode = mode;
    players = gamePlayers;
    playerIds = ids; // Store the received player IDs

    score = 0;
    lives = 3;
    streak = 0;
    maxStreak = 0; 
    totalTypedCharacters = 0;
    startTime = Date.now();
    activeWords.forEach(w => w.remove());
    activeWords = [];
    isGameActive = true; // Mark game as active
    
    // --- ATTACH BEFOREUNLOAD WARNING ---
    window.addEventListener('beforeunload', preventRefreshExit);

    // ... (DOM setup remains the same) ...
    myScoreDisplay.textContent = "0";
    opponentScoreDisplay.textContent = "0";
    myWpmDisplay.textContent = "0";
    opponentWpmDisplay.textContent = "0";
    myLivesDisplay.textContent = "❤️❤️❤️";
    opponentLivesDisplay.textContent = "❤️❤️❤️";
    streakDisplay.textContent = "0";
    timeLeftDisplay.textContent = "60";
    gameOverScreen.classList.add("hidden");
    typedWordInput.value = "";
    typedWordInput.disabled = false;
    typedWordInput.focus();
    
    const myUsername = getSavedUser().user.username;
    player1NameEl.textContent = myUsername;
    player2NameEl.textContent = players.find(p => p !== myUsername);
    player1ScoreEl.textContent = "0";
    player1WpmEl.textContent = "0";
    player1LivesEl.textContent = "❤️❤️❤️";
    
    // Clear all previous intervals
    clearInterval(timerInterval);
    clearInterval(spawnInterval); 
    
    // Timer to track WPM and time limit
    timerInterval = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        const timeLeft = Math.max(0, 60 - Math.floor(elapsedTime));
        timeLeftDisplay.textContent = timeLeft;
        
        // Calculate WPM every second
        const wpm = Math.round((totalTypedCharacters / 5) / (elapsedTime / 60)) || 0;
        myWpmDisplay.textContent = wpm;
        player1WpmEl.textContent = wpm;
        
        if (socket) {
            socket.emit("playerUpdate", { score: score, wpm: wpm, lives: lives });
        }
        
        if (timeLeft <= 0 || lives <= 0) {
            typedWordInput.disabled = true;
            clearInterval(timerInterval);
            clearInterval(spawnInterval); // Stop spawning when game ends
            // Calculate final WPM
            const finalWpm = timeLeft <= 0 
                ? Math.round((totalTypedCharacters / 5) / 1) 
                : wpm; 
            
            if (socket) {
                socket.emit("playerFinished", { score, wpm: finalWpm, lives });
            }
        }
    }, 1000);
    
    // Continuous Word Spawning Loop
    spawnInterval = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        // Only request a new word if we are below the max active limit and the game is running
        if (elapsedTime < 60 && lives > 0 && activeWords.length < maxActiveWords && socket) {
            socket.emit("requestNextWord", { roomId: matchRoomId });
        }
    }, spawnDelay);

    // Initial word request
    if (socket) {
        socket.emit("requestNextWord", { roomId: matchRoomId });
    }
}

function spawnWord(wordText) {
    if (!wordText) return;
    
    const wordEl = document.createElement("div");
    wordEl.classList.add("word");
    wordEl.textContent = wordText;
    gameArea.appendChild(wordEl);
    activeWords.push(wordEl);
    
    const wordWidth = wordEl.offsetWidth;
    const margin = 50;
    const maxLeft = gameArea.offsetWidth - wordWidth - margin;
    const left = margin + Math.random() * (maxLeft - margin);
    wordEl.style.left = left + "px";
    wordEl.style.top = "0px";
    
    let velocity = fallSpeed;
    let sway = (Math.random() * 2 - 1) * 0.5;
    let swayDirection = Math.random() > 0.5 ? 1 : -1;

    function fall() {
        if (!isGameActive) return; // Stop falling if game is inactive
        
        const gameAreaHeight = gameArea.offsetHeight;
        let top = parseFloat(wordEl.style.top) || 0;
        let left = parseFloat(wordEl.style.left) || 0;
        
        if (gameMode === "hard") {
            velocity = Math.min(velocity + 0.01, 2.5);
            left += sway * swayDirection;
            if (Math.random() < 0.02) swayDirection *= -1;
        }
        
        if (top + wordEl.offsetHeight > gameAreaHeight) {
            if (gameArea.contains(wordEl)) {
                // *** THE NEW FIX IS HERE ***
                if (wordEl.dataset.solved === "true") {
                    // If solved, just remove it without penalty or wrong word animation
                    gameArea.removeChild(wordEl);
                    activeWords = activeWords.filter((w) => w !== wordEl);
                    return; // Stop the animation frame 
                }
                // *** END NEW FIX ***

                handleWrongWord(wordEl);
                loseLife();
            }
        } else {
            wordEl.style.top = top + velocity + "px";
            wordEl.style.left = left + "px";
            requestAnimationFrame(fall);
        }
    }
    requestAnimationFrame(fall);
}

typedWordInput.addEventListener("input", () => {
    if (!isGameActive) return;

    const inputVal = typedWordInput.value.trim();
    // Use findIndex for faster lookup if the array is large, or just find
    const matchedWordEl = activeWords.find(w => w.textContent === inputVal);

    if (matchedWordEl) {
        matchedWordEl.classList.add("correct");
        matchedWordEl.dataset.solved = "true"; // Mark word as solved
        totalTypedCharacters += inputVal.length;
        if (correctSound) {
            correctSound.currentTime = 0;
            correctSound.play();
        }
        score += 10;
        streak++;
        maxStreak = Math.max(maxStreak, streak); // Track max streak
        streakDisplay.textContent = streak;
        myScoreDisplay.textContent = score;
        player1ScoreEl.textContent = score;
        
        // Visual feedback
        streakDisplay.parentElement.classList.add('hud-pop');
        setTimeout(() => {
            streakDisplay.parentElement.classList.remove('hud-pop');
        }, 350);
        
        // Bonus Logic
        if (streak > 0 && streak % 5 === 0) {
            if (lives < 5) {
                showRewardMessage("❤️ Life Increased!");
                lives++;
                myLivesDisplay.textContent = "❤️".repeat(lives);
                player1LivesEl.textContent = "❤️".repeat(lives);
            } else {
                score += 30;
                myScoreDisplay.textContent = score;
                player1ScoreEl.textContent = score;
                showRewardMessage("⭐ Bonus +30!");
            }
        }

        // Remove word from activeWords array immediately to free up a spawn slot
        activeWords = activeWords.filter(el => el !== matchedWordEl);

        // Delay only the visual removal to allow the animation to be seen
        // NOTE: The `fall` loop will now handle removal when it hits the bottom
        // due to the `wordEl.dataset.solved === "true"` check. 
        // We can safely remove the delayed `setTimeout` here.
        
        typedWordInput.value = "";
    }
});

function loseLife() {
    if (!isGameActive) return;
    
    lives--;
    if (wrongSound) {
        wrongSound.currentTime = 0;
        wrongSound.play();
    }
    if (lives >= 0) {
        myLivesDisplay.textContent = "❤️".repeat(lives);
        player1LivesEl.textContent = "❤️".repeat(lives);
    }
    streak = 0;
    streakDisplay.textContent = streak;
    flashGameArea('flash-life');
    flashGameArea('shake');
    
    if (lives <= 0) {
        typedWordInput.disabled = true;
        
        // Calculate final WPM based on actual elapsed time
        const elapsedTimeMinutes = (Date.now() - startTime) / 60000;
        const finalWpm = Math.round((totalTypedCharacters / 5) / elapsedTimeMinutes) || 0;
        
        if (socket) {
            socket.emit("playerFinished", { score, wpm: finalWpm, lives });
        }
    }
}

function endGame(data) {
    // 1. Core Cleanup & UI updates 
    clearInterval(timerInterval);
    clearInterval(spawnInterval); 
    activeWords.forEach((w) => w.remove());
    activeWords = [];
    typedWordInput.disabled = true;
    isGameActive = false; // Mark game as inactive

    // 2. Extract Metrics and Save My PB & Log Match History
    const authUser = getSavedUser();
    const myUsername = authUser ? authUser.user.username : "Player1";
    const myMetrics = data.scores[myUsername];

    // --- Start ASYNC Block to Wait for Saves/Logs ---
    (async () => {
        const savePromises = [];
        let finalAlert = matchResultText.textContent; 

        if (myMetrics) {
            // 2a. Save personal best (PB)
            savePromises.push(savePersonalBest(myMetrics.score, maxStreak));
            
            // 2b. Log the entire match history
            savePromises.push(logMatchDetails(data, maxStreak));
        }

        const results = await Promise.all(savePromises);
        
        // 3. Construct Alert Message from Results
        let pbMessage = "PB Status: Not attempted or score was zero.";
        let historyMessage = "";
        
        if (results.length > 0) {
            const pbResult = results.find(r => r && r.message && (r.message.includes("best") || r.message.includes("Skipped")));
            const logResult = results.find(r => r && r.message && r.message.includes("Match"));

            pbMessage = pbResult ? pbResult.message : "PB save status unknown.";
            historyMessage = logResult ? logResult.message : "Match log failed.";
        }
        
        // 4. Show the comprehensive final alert
        const comprehensiveAlert = `${finalAlert}\n\n--- SCORE STATUS ---\n${pbMessage}\nMatch Log: ${historyMessage}`;
        alert(comprehensiveAlert);
        
    })();
    // --- END ASYNC BLOCK ---

    // 5. Update Display (Runs immediately after async block starts)
    const opponentUsername = Object.keys(data.scores).find(key => key !== myUsername);
    const opponentMetrics = data.scores[opponentUsername];
    
    myWpmDisplay.textContent = myMetrics?.wpm || 0;
    player1LivesEl.textContent = "❤️".repeat(myMetrics?.lives || 0);

    opponentWpmDisplay.textContent = opponentMetrics?.wpm || 0;
    opponentLivesDisplay.textContent = "❤️".repeat(opponentMetrics?.lives || 0);

    // Set Final Result Text
    if (data.winner === "draw") {
        matchResultText.textContent = "It's a tie!";
    } else if (data.winner === myUsername) {
        matchResultText.textContent = "You win! Congratulations!";
    } else {
        matchResultText.textContent = "You lose. Better luck next time!";
    }

    // --- REMOVE BEFOREUNLOAD WARNING ---
    window.removeEventListener('beforeunload', preventRefreshExit);

    gameOverScreen.classList.remove("hidden");
    
    // Clean up session storage after the match is fully resolved
    sessionStorage.removeItem('gameRoomId');
    sessionStorage.removeItem('gameMode');
    sessionStorage.removeItem('gamePlayers');
}

// --- HANDLE BEFOREUNLOAD WARNING ---
function preventRefreshExit(e) {
    if (isGameActive) {
        e.preventDefault(); 
        e.returnValue = 'Your current score will not be saved if you leave now. Are you sure?'; 
    }
}


function connectSocket() {
    const saved = getSavedUser();
    if (!saved) {
        alert("You are not logged in!");
        window.location.href = "index.html";
        return;
    }
    
    const savedState = {
        roomId: sessionStorage.getItem('gameRoomId'),
        mode: sessionStorage.getItem('gameMode'),
        players: JSON.parse(sessionStorage.getItem('gamePlayers')),
    };

    if (!savedState.roomId) {
        alert("No active game found. Returning to lobby.");
        window.location.href = "wait.html";
        return;
    }

    socket = io(API_URL, {
        auth: { token: saved.token },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 500,
    });
    
    socket.on("connect", () => {
        console.log("✅ Socket connected for multiplayer game.");
        socket.emit("rejoinMatch", { roomId: savedState.roomId });
    });
    
    socket.on("connect_error", (err) => {
        console.error("❌ Socket auth failed:", err.message);
        sessionStorage.removeItem("tr_token");
        sessionStorage.removeItem("tr_user");
        alert("Session expired. Please login again.");
        window.location.href = "index.html";
    });
    
    socket.on("resumeMatch", (data) => {
        console.log("✅ Match resumed!");
        startGame(data.mode, data.roomId, data.players, data.playerIds);
    });

    socket.on("matchStart", (data) => {
        console.log("✅ Match started!");
        startGame(data.mode, data.roomId, data.players, data.playerIds);
    });

    socket.on("addWord", (data) => {
        spawnWord(data.word);
    });
    
    socket.on("matchEnd", (data) => {
        console.log("Match ended:", data);
        endGame(data);
    });
    
    socket.on("gameUpdate", (data) => {
        const myUsername = getSavedUser().user.username;
        if (data.player !== myUsername) {
            opponentScoreDisplay.textContent = data.score;
            opponentWpmDisplay.textContent = data.wpm;
            opponentLivesDisplay.textContent = "❤️".repeat(data.lives);
        }
    });
    
    socket.on("waitingForOpponent", () => {
        if (isGameActive) {
            matchResultText.textContent = "Waiting for your opponent to finish...";
            gameOverScreen.classList.remove("hidden");
        }
    });
    
    socket.on("opponentDisconnected", (data) => {
        alert(`${data.username} has disconnected. You win by default.`); 
        
        if (matchRoomId) {
            clearInterval(timerInterval);
            clearInterval(spawnInterval);
            typedWordInput.disabled = true;
            
            const elapsedTimeMinutes = (Date.now() - startTime) / 60000;
            const finalWpm = Math.round((totalTypedCharacters / 5) / elapsedTimeMinutes) || 0;
            
            endGame({
                scores: {
                    [getSavedUser().user.username]: { score, wpm: finalWpm, lives },
                    [data.username]: { score: 0, wpm: 0, lives: 0 }
                },
                winner: getSavedUser().user.username 
            });
            matchRoomId = null;
        }
    });
}

// Kick off the connection process
connectSocket();