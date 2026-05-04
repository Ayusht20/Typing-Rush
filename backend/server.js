import express from "express";
import http from "http";
import { Server } from "socket.io";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
// ---------------- Config ----------------
const JWT_SECRET = process.env.JWT_SECRET;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME; 

// ---------------- Express & Socket.IO Setup ----------------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: "https://typing-rush-mu.vercel.app",
      methods: ["GET", "POST"]
    }
  });
app.use(cors({
    origin: "https://typing-rush-mu.vercel.app",
    credentials: true
  }));

app.use(express.json());

// ---------------- Database ----------------
const db = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  ssl: { rejectUnauthorized: false }
});

  console.log("DB CONFIG:", {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
  });

// ---------------- Helpers & Middleware ----------------
function tokenFromReq(req) {
  const auth = req.headers.authorization || "";
  const parts = auth.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
}

function verifyTokenOrThrow(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Middleware to authenticate general API requests
const authenticateApi = (req, res, next) => {
    const token = tokenFromReq(req);
    const isLeaderboardRoute = req.path.includes('/get_leaderboard');

    if (!token) {
        if (isLeaderboardRoute) {
            req.user = null;
            return next();
        }
        return res.status(401).json({ error: "Unauthorized: Missing token" });
    }
    
    try {
        req.user = verifyTokenOrThrow(token);
        next();
    } catch (err) {
        if (isLeaderboardRoute) {
            req.user = null;
            return next();
        }
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
};

// ADMIN MIDDLEWARE: Checks if the authenticated user is the Admin
const authenticateAdmin = (req, res, next) => {
    authenticateApi(req, res, () => {
        if (!req.user || req.user.username !== ADMIN_USERNAME) {
            return res.status(403).json({ error: "Forbidden: Admin privileges required." });
        }
        next();
    });
};


const topics = [
  "Maurya_Empire", "Gupta_Empire", "Mughal_Empire", "Delhi_Sultanate",
  "Maratha_Empire", "Chola_Dynasty", "Battle_of_Plassey", "Battle_of_Panipat",
  "Quit_India_Movement", "Civil_Disobedience", "Non_Cooperation_Movement",
  "Swadeshi_Movement", "Indian_National_Congress", "Rani_of_Jhansi",
  "Mahatma_Gandhi", "Bhagat_Singh", "Subhas_Chandra_Bose", "Sardar_Patel",
  "Jawaharlal_Nehru",
  "Green_Revolution", "White_Revolution", "Blue_Revolution", "ISRO",
  "Chandrayaan_3", "Mangalyaan", "Digital_India", "Make_in_India",
  "Startup_India", "Goods_and_Services_Tax", "Indian_Railways",
  "LIC_of_India", "Bombay_Stock_Exchange", "RBI",
  "Economic_Liberalization_1991", "Five_Year_Plans",
  "Sachin_Tendulkar", "Virat_Kohli", "Kapil_Dev", "M_S_Dhoni",
  "P_V_Sindhu", "Neeraj_Chopra", "Abhinav_Bindra", "Mary_Kom",
  "Milkha_Singh", "Dipa_Karmakar", "Saina_Nehwal",
  "1983_Cricket_World_Cup", "2011_Cricket_World_Cup",
  "2020_Tokyo_Olympics", "Asian_Games", "Commonwealth_Games",
  "Ramayana", "Mahabharata", "Vedas", "Upanishads",
  "Sanchi_Stupa", "Ajanta_Caves", "Ellora_Caves", "Taj_Mahal",
  "Qutub_Minar", "Sun_Temple_Konark", "Brihadeeswara_Temple",
  "Charminar", "Gateway_of_India", "Red_Fort", "India_Gate",
  "G20_Summit_India", "Bullet_Train_Project", "Atal_Tunnel",
  "Statue_of_Unity", "Smart_Cities_Mission", "Swachh_Bharat",
  "UPI", "Aadhaar", "Startup_Ecosystem"
];

async function fetchWords(mode) {
  let maxLen;
  switch (mode) {
    case "easy": maxLen = 7; break;
    case "medium": maxLen = 9; break;
    case "hard": maxLen = 10; break;
    default: maxLen = 10;
  }
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&explaintext&exsentences=15&titles=${randomTopic}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const pages = data.query.pages;
    const page = Object.values(pages)[0];
    let text = page.extract || "India has a long and diverse history.";
    let words = text.split(/\s+/).map(w => w.replace(/[^a-zA-Z]/g, "")).filter(w => w.length > 2 && w.length <= maxLen);
    return words.slice(0, 50);
  } catch (e) {
    console.error("Wiki fetch failed:", e);
    return ["error", "fetching", "words", "please", "try", "again"];
  }
}

// ---------------- USER AUTH ROUTES ----------------

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.execute("SELECT id FROM users WHERE username = ?", [username]);
    if (rows.length) return res.status(400).json({ error: "User already exists" });
    const hashed = await bcrypt.hash(password, 10);
    await db.execute("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashed]);
    res.json({ message: "Registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});
app.get("/", (req, res) => {
    res.send("🚀 TypingRush API is running");
  });
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username]);
    if (rows.length === 0) return res.status(400).json({ error: "Invalid username or password" });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid username or password" });
    if (users.has(username)) return res.status(400).json({ error: "This user is already logged in on another device" });
    
    const isAdmin = user.username === ADMIN_USERNAME; 
    const token = jwt.sign({ id: user.id, username: user.username, isAdmin }, JWT_SECRET, { expiresIn: "1h" });
    
    res.json({ token, user: { id: user.id, username: user.username, isAdmin } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/logout", (req, res) => {
  const token = tokenFromReq(req);
  
  try {
    if (token) {
      const { username } = verifyTokenOrThrow(token);
      
      // Only process socket logout if token is valid
      const existingUser = users.get(username);
      if (existingUser) {
        for (const sid of existingUser.sockets) {
          const s = io.sockets.sockets.get(sid);
          if (s) s.disconnect(true);
        }
        users.delete(username);
        broadcastOnlineUsers();
      }
    }
  } catch (err) {
    // If verification fails (e.g., token expired), we still confirm logout on the client side
    console.log(`Client requested logout with an expired/invalid token. Clearing session data.`);
  }
  res.json({ message: "Logged out" });
});


app.get("/getWords", async (req, res) => {
  const { mode } = req.query;
  const words = await fetchWords(mode);
  res.json({ words: words });
});

// ---------------- GAME API ENDPOINTS ----------------
app.post("/save_score", authenticateApi, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized: Token required to save score." });

    const { score, level, streak, game_type, wpm } = req.body;
    const { id: user_id, username } = req.user; 

    if (!score || !level || !game_type || !['easy', 'medium', 'hard'].includes(level) || !['single', 'multi'].includes(game_type) || streak === undefined || wpm === undefined) {
        return res.status(400).json({ error: "Invalid score, level, streak, game_type, or wpm provided." });
    }

    try {
        let message = `Score recorded for ${game_type}/${level}.`;
        
        // --- LOG ALL SINGLE PLAYER MATCHES TO HISTORY TABLE ---
        if (game_type === 'single') {
            const historySql = `INSERT INTO single_match_history 
                                (user_id, username, level, score, streak, wpm)
                                VALUES (?, ?, ?, ?, ?, ?)`;
            // NOTE: Assumes single_match_history table exists
            await db.execute(historySql, [user_id, username, level, score, streak, wpm]);
            message = `Match logged and score recorded for ${game_type}/${level}.`;
        }
        

        // HIGH SCORE CHECK (ONLY FOR UPDATING PERSONAL BESTS IN high_scores TABLE)
        const [rows] = await db.query(
            "SELECT score, highest_streak, highest_wpm FROM high_scores WHERE user_id = ? AND level = ? AND game_type = ?",
            [user_id, level, game_type]
        );

        const currentHighScore = rows.length ? rows[0].score : 0;
        const currentHighestStreak = rows.length ? rows[0].highest_streak : 0;
        const currentHighestWPM = rows.length ? rows[0].highest_wpm : 0; 
        
        let newHighScore = score > currentHighScore;
        let newHighestStreak = streak > currentHighestStreak;
        let newHighestWPM = wpm > currentHighestWPM; 
        
        if (newHighScore || newHighestStreak || newHighestWPM || rows.length === 0) {
            
            const sql = `INSERT INTO high_scores (user_id, username, game_type, level, score, highest_streak, highest_wpm)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE 
score = CASE WHEN VALUES(score) > score THEN VALUES(score) ELSE score END,
highest_streak = CASE WHEN VALUES(highest_streak) > highest_streak THEN VALUES(highest_streak) ELSE highest_streak END,
highest_wpm = CASE WHEN VALUES(highest_wpm) > highest_wpm THEN VALUES(highest_wpm) ELSE highest_wpm END,
timestamp = CURRENT_TIMESTAMP()`;
            
            const insertValues = [user_id, username, game_type, level, score, streak, wpm];
            await db.execute(sql, insertValues);

            // Append PB message to the match log message
            if (rows.length === 0) {
                 message += ` First PB recorded.`;
            } else {
                const parts = [];
                if (newHighScore) parts.push(`New Score: ${score}`);
                if (newHighestStreak) parts.push(`New Streak: ${streak}`);
                if (newHighestWPM) parts.push(`New WPM: ${wpm}`);
                message += ` PB Updated: ${parts.join(', ')}.`;
            }
            
            return res.json({ message: message.trim(), scoreUpdated: newHighScore, streakUpdated: false, wpmUpdated: false });
        }
        
        return res.json({ message: message.trim(), scoreUpdated: false, streakUpdated: false, wpmUpdated: false });

    } catch (err) {
        console.error("Database save score error:", err);
        res.status(500).json({ error: "Failed to save score to database." });
    }
});

app.post("/log_match", authenticateApi, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized: Token required to log match." });

    const { 
        roomId, winner, level, 
        player1Id, player1Username, player1Score, player1Wpm, player1Streak,
        player2Id, player2Username, player2Score, player2Wpm, player2Streak 
    } = req.body;
    
    if (!roomId || !player1Username || !player2Username || !player1Id || !player2Id) {
        return res.status(400).json({ error: "Missing required match history fields (room, players, IDs)." });
    }

    try {
        // FIX: Using INSERT IGNORE INTO and unique_room_id index prevents duplicate logs
        const sql = `INSERT IGNORE INTO match_history (room_id, level, winner_username, player1_id, 
    player1_username, player1_score, player1_wpm, player1_streak, player2_id, player2_username, player2_score, player2_wpm, player2_streak)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const values = [
            roomId, level, winner,
            player1Id, player1Username, player1Score, player1Wpm, player1Streak,
            player2Id, player2Username, player2Score, player2Wpm, player2Streak
        ];

        const [result] = await db.execute(sql, values);
        
        if (result.affectedRows === 0) {
            // This means the row was ignored because the room_id was a duplicate
            return res.json({ message: `Match log ignored (already saved for Room ${roomId}).` });
        }

        return res.json({ message: `Match log saved successfully for Room ${roomId}.` });

    } catch (err) {
        console.error("Match history log error:", err);
        res.status(500).json({ error: "Failed to log match history." });
    }
});

app.get("/get_leaderboard", authenticateApi, async (req, res) => {
    // This route is designed to work whether req.user is null (public) or defined (logged in)
    const { type, level, orderBy } = req.query; 
    
    if (!type || !level || !orderBy) {
        return res.status(400).json({ error: "Missing type, level, or orderBy parameter." });
    }
    
    const validOrderBy = ['score', 'highest_wpm', 'highest_streak'];
    const orderField = validOrderBy.includes(orderBy) ? orderBy : 'score';
    
    try {
        let sql;
        let queryParams;
        
        if (type === 'history') {
            sql = `
SELECT room_id, level, winner_username, player1_username, player2_username, player1_score, player1_wpm, player2_score, player2_wpm, timestamp
FROM match_history
WHERE level = ?
ORDER BY timestamp DESC
LIMIT 100
`;
            queryParams = [level];
            
            const [historyResults] = await db.query(sql, queryParams);
            return res.json({ history: historyResults });
        } else {
            sql = `
SELECT username, score, highest_streak, highest_wpm, timestamp
FROM high_scores
WHERE game_type = ? AND level = ?
ORDER BY ${orderField} DESC, timestamp ASC
LIMIT 100
`;
            queryParams = [type, level];

            const [leaderboardResults] = await db.query(sql, queryParams);
            return res.json({ leaderboard: leaderboardResults });
        }

    } catch (err) {
        console.error("Leaderboard query error:", err);
        res.status(500).json({ error: "Failed to retrieve leaderboard data." });
    }
});

// ---------------- ADMIN API: USER MANAGEMENT (PROTECTED) ----------------

// 3. GET User Accounts (View)
app.get("/admin/users", authenticateAdmin, async (req, res) => {
    try {
        
        const [users] = await db.query("SELECT id, username FROM users"); 
        res.json({ users });
    } catch (err) {
        console.error("Admin users GET error:", err);
        res.status(500).json({ error: "Failed to retrieve user list." });
    }
});

// 4. DELETE User Account
app.delete("/admin/users/:id", authenticateAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    
    // Prevent admin from deleting their own account
    if (userId === req.user.id) {
        return res.status(403).json({ error: "Cannot delete your own admin account." });
    }
    try {
        // Deletion cascades to high_scores and match_history due to Foreign Keys
        const [result] = await db.query("DELETE FROM users WHERE id = ?", [userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "User not found." });
        }
        res.json({ message: `User ID ${userId} and associated data deleted successfully.` });
    } catch (err) {
        console.error("Admin user DELETE error:", err);
        res.status(500).json({ error: "Failed to delete user." });
    }
});


// ---------------- ADMIN API: REPORTS (PROTECTED) ----------------

// 5. GET Detailed Match Logs (Multiplayer Report with Date Filter)
app.get("/admin/reports/daily_matches", authenticateAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    
    try {
        let whereClause = ``;
        let queryParams = [];
        
        // Build WHERE clause if dates are provided
        if (startDate && endDate) {
            whereClause = `WHERE DATE(timestamp) BETWEEN ? AND ?`;
            queryParams = [startDate, endDate];
        }
        
        const sql = `
            SELECT 
                DATE(timestamp) AS match_date, 
                TIME(timestamp) AS match_time,level,winner_username, player1_username, player2_username,player1_score,player2_score,player1_wpm,player2_wpm
            FROM match_history
            ${whereClause}
            ORDER BY timestamp DESC
            LIMIT 500;
        `;
        
        const [reportData] = await db.query(sql, queryParams);

        // Map data to clean the date/time objects into simple strings
        const formattedData = reportData.map(row => ({
            date: new Date(row.match_date).toISOString().split('T')[0],
            time: row.match_time, 
            level: row.level,
            winner: row.winner_username,
            players: `${row.player1_username} (${row.player1_score} / ${row.player1_wpm} WPM) vs ${row.player2_username} (${row.player2_score} / ${row.player2_wpm} WPM)`,
            
            p1_username: row.player1_username,
            p2_username: row.player2_username,
        }));

        res.json({ success: true, report: formattedData });

    } catch (err) {
        console.error("Admin detailed match report GET error:", err);
        res.status(500).json({ error: "Failed to retrieve detailed match report." });
    }
});

// 6. GET Daily Single Player PB Submissions (with Date Filter)
app.get("/admin/reports/daily_pbs", authenticateAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        let whereClause = ``; 
        let queryParams = [];
        
        // Build WHERE clause if dates are provided
        if (startDate && endDate) {
            whereClause = `WHERE DATE(timestamp) BETWEEN ? AND ?`;
            queryParams = [startDate, endDate];
        }
        
        const sql = `
            SELECT 
                DATE(timestamp) AS submission_date,
                TIME(timestamp) AS submission_time,
                username,
                level,
                score,
                wpm,
                streak
            FROM single_match_history
            ${whereClause}
            ORDER BY timestamp DESC
            LIMIT 500;
        `;
        
        const [reportData] = await db.query(sql, queryParams);

        const formattedData = reportData.map(row => ({
            date: new Date(row.submission_date).toISOString().split('T')[0],
            time: row.submission_time, // NEW: Include time
            username: row.username,
            level: row.level,
            score: row.score,
            wpm: row.wpm,
        }));

        res.json({ success: true, report: formattedData });

    } catch (err) {
        console.error("Admin daily PB report GET error:", err);
        res.status(500).json({ error: "Failed to retrieve daily PB submission report." });
    }
});


// ---------------- Presence & Matchmaking ----------------
const users = new Map();
const matches = new Map();

function broadcastOnlineUsers() {
  io.emit("onlineUsers", Array.from(users.keys()));
}

// ---------------- Socket.IO Auth Middleware ----------------
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));
    const user = jwt.verify(token, JWT_SECRET);
    socket.user = { username: user.username, id: user.id };
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// ---------------- Socket.IO Event Handlers ----------------
io.on("connection", (socket) => {
  const { username, id: myId } = socket.user;
  const token = socket.handshake.auth?.token;
  const existingUser = users.get(username);
  
  if (existingUser) {
    if (existingUser.token !== token) {
      console.log(`⚠️ Duplicate login for ${username}, replacing old session`);
      for (const sid of existingUser.sockets) {
        const oldSocket = io.sockets.sockets.get(sid);
        if (oldSocket) oldSocket.disconnect(true);
      }
      users.set(username, { token, sockets: new Set([socket.id]) });
    } else {
      console.log(`🔄 Refresh detected for ${username}`);
      existingUser.sockets.add(socket.id);
    }
  } else {
    console.log(`✅ Connected: ${username} (${socket.id})`);
    users.set(username, { token, sockets: new Set([socket.id]) });
  }
  broadcastOnlineUsers();
  
  socket.on("sendInvite", ({ to, mode }) => {
    if (!users.has(to)) return socket.emit("error", { message: "User is not online." });
    console.log(`💌 Invite sent from ${username} to ${to}`);
    for (const sid of users.get(to).sockets) {
      io.to(sid).emit("receiveInvite", { from: username, mode });
    }
  });
  
  socket.on("acceptInvite", async ({ from, mode }) => {
    console.log(`🤝 Invite accepted by ${username} from ${from}`);
    if (!users.has(from)) return;
    
    // --- FIX: Get User IDs for both players ---
    const [rowsFrom] = await db.query("SELECT id FROM users WHERE username = ?", [from]);
    const [rowsTo] = await db.query("SELECT id FROM users WHERE username = ?", [username]);
    
    const fromId = rowsFrom[0]?.id;
    const toId = rowsTo[0]?.id;

    if (!fromId || !toId) {
        return socket.emit("error", { message: "Could not retrieve user IDs for match start." });
    }
    const roomId = `${from}_${username}_${Date.now()}`;
    
    const fromSockets = users.get(from).sockets;
    const toSockets = users.get(username).sockets;
    
    [...fromSockets, ...toSockets].forEach(sid => {
      const s = io.sockets.sockets.get(sid);
      if (s) s.join(roomId);
    });
    
    const initialWords = await fetchWords(mode);
    
    matches.set(roomId, {
      players: [from, username],
      playerIds: { [from]: fromId, [username]: toId }, // NEW: Store IDs
      mode: mode,
      scores: {},
      wordList: initialWords 
    });

    setTimeout(() => {
      io.to(roomId).emit("navigateToGame", {
        roomId: roomId,
        players: [from, username],
        playerIds: { [from]: fromId, [username]: toId }, // NEW: Pass IDs
        mode: mode
      });
      io.to(roomId).emit("matchStart", {
        players: [from, username],
        playerIds: { [from]: fromId, [username]: toId }, // NEW: Pass IDs
        mode: mode
      });
      const match = matches.get(roomId);
      io.to(roomId).emit("addWord", { word: match.wordList.shift() });
    }, 1000);
  });

  socket.on("rejoinMatch", async ({ roomId }) => {
    const match = matches.get(roomId);
    if (match) {
      socket.join(roomId);
      socket.emit("resumeMatch", {
        roomId: roomId,
        mode: match.mode,
        players: match.players,
        playerIds: match.playerIds // Pass stored IDs
      });
      console.log(`Player ${username} rejoined match ${roomId}`);
    } else {
      socket.emit("error", { message: "Match not found." });
    }
  });

  socket.on("rejectInvite", ({ from }) => {
    if (!users.has(from)) return;
    for (const sid of users.get(from).sockets) {
      io.to(sid).emit("inviteRejected", { by: username });
    }
  });

  socket.on("playerFinished", ({ score, wpm, lives }) => {
    const matchId = Array.from(socket.rooms).find(room => matches.has(room));
    if (!matchId) return;
    const match = matches.get(matchId);
    if (!match) return;
    match.scores[username] = { score, wpm, lives };

    const opponent = match.players.find(p => p !== username);
    if (match.scores[opponent]) {
      endMatch(matchId);
    } else {
      io.to(socket.id).emit("waitingForOpponent");
    }
  });

  socket.on("playerUpdate", ({ score, wpm, lives }) => {
    const matchId = Array.from(socket.rooms).find(room => matches.has(room));
    if (!matchId) return;
    const match = matches.get(matchId);
    if (!match) return;
    
    const opponent = match.players.find(p => p !== username);
    io.to(matchId).emit("gameUpdate", {
      player: username,
      score, wpm, lives
    });
  });
  
  socket.on("requestNextWord", async ({ roomId }) => {
    const match = matches.get(roomId);
    if (!match) return;
    
    const nextWord = match.wordList.shift();
    if (nextWord) {
      io.to(roomId).emit("addWord", { word: nextWord });
    } else {
      const newWords = await fetchWords(match.mode);
      match.wordList.push(...newWords);
      const nextWord = match.wordList.shift();
      io.to(roomId).emit("addWord", { word: nextWord });
    }
  });

  function endMatch(matchId) {
    const match = matches.get(matchId);
    if (!match) return;

    const [p1Username, p2Username] = match.players;
    const p1Metrics = match.scores[p1Username];
    const p2Metrics = match.scores[p2Username];

    // --- Determine Winner ---
    let winner = "draw";
    if (p1Metrics && p2Metrics) {
        if (p1Metrics.wpm > p2Metrics.wpm) {
            winner = p1Username;
        } else if (p2Metrics.wpm > p1Metrics.wpm) {
            winner = p2Username;
        } else if (p1Metrics.score > p2Metrics.score) {
            winner = p1Username;
        } else if (p2Metrics.score > p1Metrics.score) {
            winner = p2Username;
        }
    } else if (p1Metrics) {
        winner = p1Username;
    } else if (p2Metrics) {
        winner = p2Username;
    }
    

    io.to(matchId).emit("matchEnd", { scores: match.scores, winner });
    matches.delete(matchId);
  }

  socket.on("disconnect", (reason) => {
    console.log(`❌ Disconnected: ${username} (${socket.id}) reason=${reason}`);
    const existingUser = users.get(username);
    if (!existingUser) return;
    existingUser.sockets.delete(socket.id);
    if (existingUser.sockets.size === 0) {
      users.delete(username);
      broadcastOnlineUsers();
    }
    const matchId = Array.from(socket.rooms).find(room => matches.has(room));
    if (matchId) {
      const match = matches.get(matchId);
      const opponent = match.players.find(p => p !== username);
      io.to(matchId).emit("opponentDisconnected", { username, reason });
      matches.delete(matchId);
    }
  });
});

// ---------------- Start Server ----------------
const PORT=process.env.port;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));