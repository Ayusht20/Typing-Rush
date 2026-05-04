import API_URL from "./config.js";
function get(id) {
        return document.getElementById(id);
    }
    
    function getSavedUserTokenString() { 
        return sessionStorage.getItem("tr_token"); 
    }
    
    /**
     * Retrieves the stored user object.
     * @returns {Object|null} The parsed user object.
     */
    function getSavedUser() {
        const userJson = sessionStorage.getItem("tr_user");
        if (userJson) {
            try {
                return JSON.parse(userJson);
            } catch (e) {
                console.error("Corrupted user session data:", e);
                return null;
            }
        }
        return null;
    }
    
    /**
    * Safely clears all client-side and server-side authentication data (soft logout).
    */
   
    async function clearSession() {
        console.log("Forcing client-side session clear and server logout.");
        const token = getSavedUserTokenString(); 
      
        // 1. Tell the server to log out the user
        if (token) {
            try {
        (function() {
            // 1. Check if the authentication token exists in session storage.
            const token = sessionStorage.getItem("tr_token");
            
            // 2. If the token is missing, the user is unauthorized.
            if (token) {
 
              
              // Ensure all client-side session data is wiped clean before redirecting
              // window.location.reload(); 
                  // 2. Clear all client-side session storage (must be done regardless of server response)
              alert("Logging you out!!");
                  sessionStorage.removeItem("tr_token");
                  sessionStorage.removeItem("tr_user");
                  sessionStorage.removeItem("gameRoomId");
                  sessionStorage.removeItem("gameMode");
                  sessionStorage.removeItem("gamePlayers");
              sessionStorage.removeItem("tr_admin_token");
                 
          
                // 3. Immediately redirect the user to the login page.
                // Using replace() is essential to prevent the secure page from being in the browser's history.
                window.location.replace("index.html");
                
                // Stop all further script execution on the secured page.
                return; 
            }
          })();
                await new Promise(resolve => setTimeout(resolve, 300)); 
            } catch (e) {
                console.error("Server logout fetch failed (network issue, ignoring):", e);
            }
        }
    
        // 3. Disconnect any global socket instance
    }
    
    // Attach helpers to the global scope for use by other scripts
    window.getSavedUserTokenString = getSavedUserTokenString;
    window.getSavedUser = getSavedUser;
    window.clearSession = clearSession; 
    
    // -----------------------------------------------------------
    // ⭐ LOGIN/REGISTER PAGE SPECIFIC LOGIC ⭐
    // -----------------------------------------------------------
    
    // Check for BFCache and redirect logic for security on login/register pages
    window.addEventListener('pageshow', function (event) {
        if (event.persisted && getSavedUserTokenString()) {
            console.log("🔄 BFCache hit with active session. Forcing redirect/reload.");
            
            // If loaded from cache AND a token exists, check role and redirect immediately
            clearSession();
         
        }
    });
    
    
    // ===== LOGIN Logic (Handles Unified Redirect) =====
    const loginBtn = get("loginBtn");
    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const usernameInput = get("username");
            const passwordInput = get("password");
    
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
    
            if (!username || !password) {
                alert("Please fill in all fields.");
                return;
            }
    
            await clearSession(); 
    
            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                });
    
                const data = await res.json();
    
                if (res.ok) {
                    // SUCCESS
                    sessionStorage.setItem("tr_token", data.token);
                    sessionStorage.setItem("tr_user", JSON.stringify(data.user));
    
                    alert("Login successful!");
                    usernameInput.value = "";
                    passwordInput.value = "";
    
                    // ⭐ UNIFIED REDIRECT LOGIC ⭐
                    if (data.user.isAdmin) {
                        // Store the admin token separately for Admin Dashboard API calls
                        sessionStorage.setItem('tr_admin_token', data.token); 
                        window.location.href = "admin_dashboard.html";
                    } else {
                        window.location.href = "levels.html";
                    }
                } else {
                    // FAILURE
                    alert(data.error || "Login failed");
                }
            } catch (e) {
                console.error(e);
                alert("Network error");
            }
        });
    }
    
    // ===== REGISTER Logic (Simplified redirect) =====
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
                const res = await fetch(`${API_URL}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                });
    
                const data = await res.json();
    
                if (res.ok) {
                    alert("Registered successfully! Please login.");
                    await clearSession(); 
                    window.location.href = "index.html"; 
                } else {
                    alert(data.error || "Registration failed");
                }
            } catch (e) {
                console.error(e);
                alert("Network error");
            }
        });
    }
    