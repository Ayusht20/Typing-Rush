// // public/script.js

// // Get element by id helper (simple)
// function get(id) {
//   return document.getElementById(id);
// }

// // Get URL param helper
// function getParam(name) {
//   return new URLSearchParams(window.location.search).get(name);
// }

// // ====== AUTH: LOGIN ======
// const loginBtn = document.getElementById("loginBtn");
// if (loginBtn) {
//   loginBtn.addEventListener("click", async () => {
//     const username = document.getElementById("username").value.trim();
//     const password = document.getElementById("password").value;
//     // console.log(username,password);
//     if (!username || !password) {
//       alert("Please fill in all fields.");
//       return;
//     }
//     try {
//       const res = await fetch("/login", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ username, password }),
//       });
//       console.log("Response status:", res.status);
//       const data = await res.json();
//       console.log("Response data:", data);
//       alert(data.message);
//       if (data.success) {
//         localStorage.setItem("tr_username", username);
//         window.location.href = "levels.html";
//       }
//     } catch (e) {
//       console.error("Login error:", e);
//       alert("Network or server error.");
//     }
//   });
// }



// // ====== AUTH: REGISTER ======
// const registerBtn = get("registerBtn");
// if (registerBtn) {
//   registerBtn.addEventListener("click", async () => {
//     const username = get("username").value.trim();
//     const password = get("password").value;
//     if (!username || !password) {
//       alert("Please fill in all fields.");
//       return;
//     }
//     try {
//       const res = await fetch("/register", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ username, password })
//       });
//       const data = await res.json();
//       alert(data.message);
//       if (data.success) {
//         window.location.href = "index.html";
//       }
//     } catch (e) {
//       alert("Network error.");
//       console.error(e);
//     }
//   });
// }

// // ====== GAME SETTINGS ======
// const difficultySettings = {
//   easy:  { speed: 1.5, spawnRate: 2500, words: ["cat","dog","hat","sun","pen","bat","cup","box","run","top"] },
//   medium:{ speed: 2.5, spawnRate: 2000, words: ["apple","house","green","chair","water","plant","light","phone","mouse","train"] },
//   hard:  { speed: 4, spawnRate: 1500, words: ["keyboard","computer","javascript","multiplayer","developer","challenge","difficulty","animation","controller","generation"] }
// };

// // ====== GAME ENGINE ======
// function startGame(options) {
//   const settings = options.settings;
//   const typedInput = get(options.typedInputId || "typed-word");
//   const scoreDisplay = get(options.scoreId || "score");
//   const livesDisplay = get(options.livesId || "lives");
//   const finalScore = get(options.finalScoreId || "final-score");
//   const gameArea = get("game-area");
//   const correctSound = get("correctSound");
//   const wrongSound = get("wrongSound");

//   let activeWords = [];
//   let score = 0;
//   let lives = 5;
//   let isGameOver = false;

//   function spawnWord() {
//     if (isGameOver) return;
//     const wordEl = document.createElement("div");
//     wordEl.className = "word";
//     wordEl.innerText = settings.words[Math.floor(Math.random() * settings.words.length)];
//     wordEl.style.left = `${Math.random() * (gameArea.clientWidth - 100)}px`;
//     wordEl.style.top = "0px";
//     gameArea.appendChild(wordEl);
//     activeWords.push({ el: wordEl, y: 0 });
//   }

//   function updateWords() {
//     if (isGameOver) return;
//     for (let i = activeWords.length - 1; i >= 0; i--) {
//       const w = activeWords[i];
//       w.y += settings.speed;
//       w.el.style.top = `${w.y}px`;
//       if (w.y > gameArea.clientHeight - 40) {
//         if (w.el.parentNode) gameArea.removeChild(w.el);
//         activeWords.splice(i, 1);
//         if (!options.isMultiplayer) {
//           if (wrongSound) {
//             try { wrongSound.currentTime = 0; wrongSound.play(); } catch {}
//           }
//           lives--;
//           if (livesDisplay) livesDisplay.innerText = lives;
//           if (lives <= 0) endGame();
//         }
//       }
//     }
//     requestAnimationFrame(updateWords);
//   }

//   typedInput.addEventListener("input", () => {
//     const typed = typedInput.value.trim();
//     for (let i = 0; i < activeWords.length; i++) {
//       if (typed === activeWords[i].el.innerText) {
//         if (activeWords[i].el.parentNode) gameArea.removeChild(activeWords[i].el);
//         activeWords.splice(i, 1);
//         typedInput.value = "";
//         score++;
//         if (scoreDisplay) scoreDisplay.innerText = score;
//         if (correctSound) {
//           try { correctSound.currentTime = 0; correctSound.play(); } catch {}
//         }
//         break;
//       }
//     }
//   });

//   function endGame() {
//     isGameOver = true;
//     typedInput.disabled = true;
//     if (finalScore) finalScore.innerText = score;
//     const gameOver = get("game-over");
//     if (gameOver) gameOver.classList.remove("hidden");
//     if (options.onMatchEnd) options.onMatchEnd(score);
//   }

//   const spawnHandle = setInterval(spawnWord, settings.spawnRate);
//   requestAnimationFrame(updateWords);

//   if (options.isMultiplayer && options.matchDurationMs) {
//     let timeLeft = Math.ceil(options.matchDurationMs / 1000);
//     const timeElt = get("timeLeft");
//     if (timeElt) timeElt.innerText = timeLeft;
//     const timer = setInterval(() => {
//       timeLeft--;
//       if (timeElt) timeElt.innerText = timeLeft;
//       if (timeLeft <= 0) {
//         clearInterval(timer);
//         clearInterval(spawnHandle);
//         endGame();
//       }
//     }, 1000);
//   }

//   return {
//     stop: () => clearInterval(spawnHandle),
//     getScore: () => score
//   };
// }

// // ====== MULTIPLAYER & LOBBY ======
// if (window.location.pathname.endsWith("wait.html") || window.location.pathname.endsWith("multigame.html") || window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("register.html")) {
//   const socket = io();

//   let username = localStorage.getItem("tr_username");
//   if (!username) {
//     if (!window.location.pathname.endsWith("index.html") && !window.location.pathname.endsWith("register.html")) {
//       username = prompt("Enter a username for this session:");
//       if (!username) {
//         alert("Username required");
//         window.location.href = "index.html";
//       }
//       localStorage.setItem("tr_username", username);
//     }
//   } else {
//     socket.emit("registerUser", username);
//   }

//   socket.on("onlineUsers", (list) => {
//     const playersList = get("playersList");
//     if (!playersList) return;
//     playersList.innerHTML = "";
//     list.forEach(p => {
//       if (p === localStorage.getItem("tr_username")) return;
//       const li = document.createElement("li");
//       li.style.display = "flex";
//       li.style.justifyContent = "space-between";
//       li.style.alignItems = "center";
//       li.style.padding = "8px";
//       li.style.margin = "6px 0";
//       li.style.background = "rgba(0,0,0,0.3)";
//       li.style.borderRadius = "8px";
//       const span = document.createElement("span");
//       span.innerText = p;
//       const btn = document.createElement("button");
//       btn.innerText = "Request";
//       btn.onclick = () => {
//         btn.disabled = true;
//         get("status").innerText = "Request sent...";
//         const level = get("levelSelect") ? get("levelSelect").value : "easy";
//         socket.emit("sendInvite", { toUsername: p, level });
//       };
//       li.appendChild(span);
//       li.appendChild(btn);
//       playersList.appendChild(li);
//     });
//   });

//   socket.on("incomingInvite", ({ from, level }) => {
//     const incomingBlock = get("incomingRequest");
//     if (!incomingBlock) return;
//     incomingBlock.classList.remove("hidden");
//     get("incomingText").innerText = `${from} invited you to play (${level}). Accept?`;
//     get("acceptBtn").onclick = () => {
//       incomingBlock.classList.add("hidden");
//       socket.emit("acceptInvite", { fromUsername: from, level });
//       get("status").innerText = "Accepted. Starting match...";
//     };
//     get("rejectBtn").onclick = () => {
//       incomingBlock.classList.add("hidden");
//       socket.emit("rejectInvite", { fromUsername: from });
//       get("status").innerText = "Request rejected.";
//     };
//   });

//   socket.on("inviteRejected", ({ by }) => {
//     get("status").innerText = `${by} rejected your invite.`;
//   });

//   socket.on("inviteExpired", ({ toUsername }) => {
//     get("status").innerText = `Invite to ${toUsername} expired.`;
//   });

//   const autoMatchBtn = get("autoMatchBtn");
//   if (autoMatchBtn) {
//     autoMatchBtn.addEventListener("click", () => {
//       get("status").innerText = "Auto-matching... waiting for 10s.";
//       const level = get("levelSelect") ? get("levelSelect").value : "easy";
//       socket.emit("autoMatch", { level });
//     });
//   }

//   socket.on("autoNoMatch", () => {
//     alert("No active players found. Starting single-player.");
//     window.location.href = "game.html?level=" + (get("levelSelect") ? get("levelSelect").value : "easy");
//   });

//   socket.on("startMatch", ({ roomId, opponent, level, matchDurationMs }) => {
//     sessionStorage.setItem("tr_roomId", roomId);
//     sessionStorage.setItem("tr_level", level);
//     sessionStorage.setItem("tr_opponent", opponent);
//     sessionStorage.setItem("tr_matchDurationMs", matchDurationMs);
//     window.location.href = "multigame.html";
//   });

//   if (window.location.pathname.endsWith("multigame.html")) {
//     const roomId = sessionStorage.getItem("tr_roomId");
//     const level = sessionStorage.getItem("tr_level") || "easy";
//     const matchDurationMs = parseInt(sessionStorage.getItem("tr_matchDurationMs") || "60000", 10);
//     const settings = difficultySettings[level] || difficultySettings.easy;

//     get("opponentScore").innerText = "0";

//     const game = startGame({
//       settings,
//       isMultiplayer: true,
//       matchDurationMs,
//       onMatchEnd: (score) => {
//         socket.emit("matchResult", { roomId: roomId || ("room_" + Date.now()), score });
//       }
//     });

//     socket.on("opponentInterimScore", ({ score }) => {
//       get("opponentScore").innerText = score;
//     });

//     socket.on("matchEnded", ({ result, yourScore, opponentScore, opponent }) => {
//       get("matchResultText").innerText = `You ${result}! Your score: ${yourScore}, ${opponent}'s score: ${opponentScore}`;
//       get("game-over").classList.remove("hidden");
//     });
//   }
// }

// // ====== SINGLE PLAYER PAGE ======
// if (window.location.pathname.endsWith("game.html")) {
//   const level = getParam("level") || "easy";
//   const settings = difficultySettings[level];
//   startGame({ settings, isMultiplayer: false });
// }
// public/script.js

// ===== HELPERS =====
function get(id) {
  return document.getElementById(id);
}
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ====== AUTH: LOGIN ======
const loginBtn = get("loginBtn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const username = get("username").value.trim();
    const password = get("password").value;
    if (!username || !password) {
      alert("Please fill in all fields.");
      return;
    }
    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) {
        localStorage.setItem("tr_username", username);
        window.location.href = "levels.html";
      }
    } catch (e) {
      console.error("Login error:", e);
      alert("Network or server error.");
    }
  });
}

// ====== AUTH: REGISTER ======
const registerBtn = get("registerBtn");
if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    const username = get("username").value.trim();
    const password = get("password").value;
    if (!username || !password) {
      alert("Please fill in all fields.");
      return;
    }
    try {
      const res = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) {
        window.location.href = "index.html";
      }
    } catch (e) {
      alert("Network error.");
      console.error(e);
    }
  });
}

// ====== GAME SETTINGS ======
const difficultySettings = {
  easy: { speed: 1.5, spawnRate: 2500, words: ["cat","dog","hat","sun","pen","bat","cup","box","run","top"] },
  medium: { speed: 2.5, spawnRate: 2000, words: ["apple","house","green","chair","water","plant","light","phone","mouse","train"] },
  hard: { speed: 4, spawnRate: 1500, words: ["keyboard","computer","javascript","multiplayer","developer","challenge","difficulty","animation","controller","generation"] }
};

// ====== GAME ENGINE ======
function startGame(options) {
  const settings = options.settings;
  const typedInput = get(options.typedInputId || "typed-word");
  const scoreDisplay = get(options.scoreId || "score");
  const livesDisplay = get(options.livesId || "lives");
  const finalScore = get(options.finalScoreId || "final-score");
  const gameArea = get("game-area");
  const correctSound = get("correctSound");
  const wrongSound = get("wrongSound");

  let activeWords = [];
  let score = 0;
  let lives = 5;
  let isGameOver = false;

  function spawnWord() {
    if (isGameOver) return;
    const wordEl = document.createElement("div");
    wordEl.className = "word";
    wordEl.innerText = settings.words[Math.floor(Math.random() * settings.words.length)];
    wordEl.style.left = `${Math.random() * (gameArea.clientWidth - 100)}px`;
    wordEl.style.top = "0px";
    gameArea.appendChild(wordEl);
    activeWords.push({ el: wordEl, y: 0 });
  }

  function updateWords() {
    if (isGameOver) return;
    for (let i = activeWords.length - 1; i >= 0; i--) {
      const w = activeWords[i];
      w.y += settings.speed;
      w.el.style.top = `${w.y}px`;
      if (w.y > gameArea.clientHeight - 40) {
        if (w.el.parentNode) gameArea.removeChild(w.el);
        activeWords.splice(i, 1);
        if (!options.isMultiplayer) {
          if (wrongSound) {
            try { wrongSound.currentTime = 0; wrongSound.play(); } catch {}
          }
          lives--;
          if (livesDisplay) livesDisplay.innerText = lives;
          if (lives <= 0) endGame();
        }
      }
    }
    requestAnimationFrame(updateWords);
  }

  typedInput.addEventListener("input", () => {
    const typed = typedInput.value.trim();
    for (let i = 0; i < activeWords.length; i++) {
      if (typed === activeWords[i].el.innerText) {
        if (activeWords[i].el.parentNode) gameArea.removeChild(activeWords[i].el);
        activeWords.splice(i, 1);
        typedInput.value = "";
        score++;
        if (scoreDisplay) scoreDisplay.innerText = score;
        if (correctSound) {
          try { correctSound.currentTime = 0; correctSound.play(); } catch {}
        }
        break;
      }
    }
  });

  function endGame() {
    isGameOver = true;
    typedInput.disabled = true;
    if (finalScore) finalScore.innerText = score;
    const gameOver = get("game-over");
    if (gameOver) gameOver.classList.remove("hidden");
    if (options.onMatchEnd) options.onMatchEnd(score);
  }

  const spawnHandle = setInterval(spawnWord, settings.spawnRate);
  requestAnimationFrame(updateWords);

  if (options.isMultiplayer && options.matchDurationMs) {
    let timeLeft = Math.ceil(options.matchDurationMs / 1000);
    const timeElt = get("timeLeft");
    if (timeElt) timeElt.innerText = timeLeft;
    const timer = setInterval(() => {
      timeLeft--;
      if (timeElt) timeElt.innerText = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timer);
        clearInterval(spawnHandle);
        endGame();
      }
    }, 1000);
  }

  return {
    stop: () => clearInterval(spawnHandle),
    getScore: () => score
  };
}

// ====== MULTIPLAYER & LOBBY ======
if (["wait.html", "multigame.html", "index.html", "register.html"].some(p => window.location.pathname.endsWith(p))) {
  const socket = io();

  let username = localStorage.getItem("tr_username");
  if (!username) {
    if (!window.location.pathname.endsWith("index.html") && !window.location.pathname.endsWith("register.html")) {
      username = prompt("Enter a username for this session:");
      if (!username) {
        alert("Username required");
        window.location.href = "index.html";
      }
      localStorage.setItem("tr_username", username);
    }
  } else {
    socket.emit("registerUser", username);
  }

  socket.on("onlineUsers", (list) => {
    const playersList = get("playersList");
    if (!playersList) return;
    playersList.innerHTML = "";
    list.forEach(p => {
      if (p === localStorage.getItem("tr_username")) return;
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.justifyContent = "space-between";
      li.style.alignItems = "center";
      li.style.padding = "8px";
      li.style.margin = "6px 0";
      li.style.background = "rgba(0,0,0,0.3)";
      li.style.borderRadius = "8px";
      const span = document.createElement("span");
      span.innerText = p;
      const btn = document.createElement("button");
      btn.innerText = "Request";
      btn.onclick = () => {
        btn.disabled = true;
        get("status").innerText = "Request sent...";
        const level = get("levelSelect") ? get("levelSelect").value : "easy";
        socket.emit("sendInvite", { toUsername: p, level });
      };
      li.appendChild(span);
      li.appendChild(btn);
      playersList.appendChild(li);
    });
  });

  socket.on("incomingInvite", ({ from, level }) => {
    const incomingBlock = get("incomingRequest");
    if (!incomingBlock) return;
    incomingBlock.classList.remove("hidden");
    get("incomingText").innerText = `${from} invited you to play (${level}). Accept?`;
    get("acceptBtn").onclick = () => {
      incomingBlock.classList.add("hidden");
      socket.emit("acceptInvite", { fromUsername: from, level });
      get("status").innerText = "Accepted. Starting match...";
    };
    get("rejectBtn").onclick = () => {
      incomingBlock.classList.add("hidden");
      socket.emit("rejectInvite", { fromUsername: from });
      get("status").innerText = "Request rejected.";
    };
  });

  socket.on("inviteRejected", ({ by }) => {
    get("status").innerText = `${by} rejected your invite.`;
  });

  socket.on("inviteExpired", ({ toUsername }) => {
    get("status").innerText = `Invite to ${toUsername} expired.`;
  });

  const autoMatchBtn = get("autoMatchBtn");
  if (autoMatchBtn) {
    autoMatchBtn.addEventListener("click", () => {
      get("status").innerText = "Auto-matching... waiting for 10s.";
      const level = get("levelSelect") ? get("levelSelect").value : "easy";
      socket.emit("autoMatch", { level });
    });
  }

  socket.on("autoNoMatch", () => {
    alert("No active players found. Starting single-player.");
    window.location.href = "game.html?level=" + (get("levelSelect") ? get("levelSelect").value : "easy");
  });

  socket.on("startMatch", ({ roomId, opponent, level, matchDurationMs }) => {
    sessionStorage.setItem("tr_roomId", roomId);
    sessionStorage.setItem("tr_level", level);
    sessionStorage.setItem("tr_opponent", opponent);
    sessionStorage.setItem("tr_matchDurationMs", matchDurationMs);
    window.location.href = "multigame.html";
  });

  if (window.location.pathname.endsWith("multigame.html")) {
    const roomId = sessionStorage.getItem("tr_roomId");
    const level = sessionStorage.getItem("tr_level") || "easy";
    const matchDurationMs = parseInt(sessionStorage.getItem("tr_matchDurationMs") || "60000", 10);
    const settings = difficultySettings[level] || difficultySettings.easy;

    get("opponentScore").innerText = "0";

    const game = startGame({
      settings,
      isMultiplayer: true,
      matchDurationMs,
      onMatchEnd: (score) => {
        socket.emit("matchResult", { roomId: roomId || ("room_" + Date.now()), score });
      }
    });

    socket.on("opponentInterimScore", ({ score }) => {
      get("opponentScore").innerText = score;
    });

    socket.on("matchEnded", ({ result, yourScore, opponentScore, opponent }) => {
      get("matchResultText").innerText = `You ${result}! Your score: ${yourScore}, ${opponent}'s score: ${opponentScore}`;
      get("game-over").classList.remove("hidden");
    });
  }
}

// ====== SINGLE PLAYER PAGE ======
if (window.location.pathname.endsWith("game.html")) {
  const level = getParam("level") || "easy";
  const settings = difficultySettings[level];
  startGame({ settings, isMultiplayer: false });
}

