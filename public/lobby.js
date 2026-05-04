
import API_URL from "./config.js";
function get(id) {
        return document.getElementById(id);
    }
      
    // Declare socket in the global scope
    window.socket = null;
      
    // ✅ Helper: Get stored token + user
    function getSavedUser() {
        const token = sessionStorage.getItem("tr_token");
        const user = sessionStorage.getItem("tr_user");
        return token && user ? { token, user: JSON.parse(user) } : null;
    }
      
    async function connectSocket() {
        const saved = getSavedUser();
      
        if (!saved) {
            alert("You are not logged in!");
            window.location.href = "index.html";
            return;
        }
      
        console.log("Authenticated user:", saved.user);
      
        // ✅ Connect Socket.IO with token
        window.socket = io(API_URL, {
            auth: { token: saved.token },
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 500,
        });
      
        window.socket.on("connect", () => {
            console.log("✅ Socket connected as", saved.user.username);
            const statusEl = get("status");
            if (statusEl) statusEl.textContent = `Logged in as ${saved.user.username}`;
        });
      
        window.socket.on("connect_error", (err) => {
            console.error("❌ Socket auth failed:", err.message);
            sessionStorage.removeItem("tr_token");
            sessionStorage.removeItem("tr_user");
            alert("Session expired. Please login again.");
            window.location.href = "index.html";
        });
      
        // ---------------- Online Users ----------------
        window.socket.on("onlineUsers", (list) => {
            const ul = get("playersList");
            if (!ul) return;
            ul.innerHTML = "";
      
            list.forEach((u) => {
                if (u === saved.user.username) return;
      
                const li = document.createElement("li");
                li.style.marginBottom = "6px";
      
                const nameSpan = document.createElement("span");
                nameSpan.textContent = u + " ";
                li.appendChild(nameSpan);
      
                const btn = document.createElement("button");
                btn.textContent = "Challenge";
                btn.onclick = () => {
                    const mode = get("levelSelect").value;
                    window.socket.emit("sendInvite", { to: u, mode });
                    const statusEl = get("status");
                    if (statusEl) {
                        statusEl.textContent = `Invite sent to ${u} (${mode})`;
                    }
                };
      
                li.appendChild(btn);
                ul.appendChild(li);
            });
        });
      
        // ---------------- Receive Invite ----------------
        window.socket.on("receiveInvite", ({ from, mode }) => {
            const box = get("incomingRequest");
            const text = get("incomingText");
            if (!box || !text) return;
      
            box.style.display = "block";
            text.textContent = `${from} challenged you to a ${mode} game!`;
      
            get("acceptBtn").onclick = () => {
                window.socket.emit("acceptInvite", { from, mode });
                box.style.display = "none";
                get("status").textContent = `Accepted invite from ${from}`;
            };
      
            get("rejectBtn").onclick = () => {
                window.socket.emit("rejectInvite", { from });
                box.style.display = "none";
                get("status").textContent = `Rejected invite from ${from}`;
            };
        });
      
        // ---------------- Invite Rejected ----------------
        window.socket.on("inviteRejected", ({ by }) => {
            const statusEl = get("status");
            if (statusEl) statusEl.textContent = `${by} rejected your invite.`;
        });
    
        // NEW: Handle server-initiated navigation
        window.socket.on("navigateToGame", ({ roomId, players, mode }) => {
            sessionStorage.setItem('gameRoomId', roomId);
            sessionStorage.setItem('gamePlayers', JSON.stringify(players));
            sessionStorage.setItem('gameMode', mode);
            window.location.href = "multigame.html";
        });
    }
      
    // ✅ Auto-connect on page load
    window.addEventListener("DOMContentLoaded", connectSocket);