// leaderboard.js - Client-side logic for fetching and rendering categorized scores.
import API_URL from "./config.js";
const leaderboardBody = document.getElementById('leaderboardBody');
const loadingMessage = document.getElementById('loadingMessage');
const gameTypeFilter = document.getElementById('gameTypeFilter');
const levelFilter = document.getElementById('levelFilter');
const orderByFilter = document.getElementById('orderByFilter');
const leaderboardTitle = document.getElementById('leaderboardTitle');
const metricHeader = document.getElementById('metricHeader');
const detailHeader = document.getElementById('detailHeader');

// Helper to get authentication token
function getAuthToken() {
    return sessionStorage.getItem("tr_token") || null;
}

/**
 * Updates the table headers based on the selected game type and order-by value.
 */
function updateHeaders(gameType) {
    if (gameType === 'history') {
        metricHeader.textContent = 'Winner';
        detailHeader.textContent = 'Scores (P1 vs P2)';
    } else {
        // For PB modes (single/multi)
        const orderByText = orderByFilter.value.replace('highest_', '').toUpperCase();
        metricHeader.textContent = orderByText === 'SCORE' ? 'SCORE' : orderByText;
        detailHeader.textContent = 'WPM / STREAK';
    }
    
    let typeDisplay = gameType.charAt(0).toUpperCase() + gameType.slice(1).replace('ulti', 'ultiplayer');
    if (gameType === 'history') typeDisplay = 'Match History';
    
    leaderboardTitle.textContent = `${typeDisplay} - ${levelFilter.value.charAt(0).toUpperCase() + levelFilter.value.slice(1)}`;
}

/**
 * Renders the data (PB or History) into the leaderboard table.
 */
function renderLeaderboard(data, gameType) {
    leaderboardBody.innerHTML = '';
    
    const token = getAuthToken();
    
    if (data.length === 0) {
         loadingMessage.textContent = `No scores recorded for this mode/level yet.`;
        loadingMessage.classList.remove('hidden');
    } else {
        loadingMessage.classList.add('hidden');
    }

    // Display welcome/login message below the table if not logged in
    if (!token) {
        // If data was loaded, update the message to be encouraging
        const finalMessage = data.length > 0 
            ? "Global stats displayed. Log in to view your personal bests and save new scores!"
            : "No scores yet. Log in and be the first to post a score!";
        loadingMessage.textContent = finalMessage;
        loadingMessage.classList.remove('hidden');
    }


    updateHeaders(gameType);

    data.forEach((entry, index) => {
        const rank = index + 1;
        const row = leaderboardBody.insertRow();
        
        row.classList.add("row-fade-in");
        row.style.animationDelay = `${index * 0.05}s`;
        
        // Determine styling for top ranks
        let rankClass = "text-gray-200";
        let usernameClass = "font-medium";
        
        if (rank === 1) {
            rankClass = "text-yellow-400 text-lg font-bold";
            usernameClass = "text-yellow-300 font-extrabold";
        } else if (rank === 2) {
            rankClass = "text-gray-300 text-base font-semibold";
            usernameClass = "text-gray-300 font-semibold";
        } else if (rank === 3) {
            rankClass = "text-amber-500 text-sm font-semibold";
            usernameClass = "text-amber-400";
        }

        // Rank Cell
        row.insertCell().className = `py-3 px-3 sm:px-6 text-left ${rankClass}`;
        row.cells[0].textContent = rank;

        // Metric Cell
        const metricCell = row.insertCell();
        metricCell.className = `py-3 px-3 sm:px-6 text-left text-blue-300 font-bold`;
        
        // Detail Cell 
        const detailCell = row.insertCell();
        detailCell.className = `py-3 px-3 text-xs text-left text-gray-400`;
        
        const userCell = row.insertCell(1); // Insert player cell at index 1

        if (gameType === 'history') {
            // --- MATCH HISTORY LOGIC ---
            userCell.className = `py-3 px-3 sm:px-6 text-left ${usernameClass}`;
            
            const p1 = entry.player1_username;
            const p2 = entry.player2_username;
            
            userCell.textContent = `${p1} vs ${p2}`;
            metricCell.textContent = entry.winner_username === 'draw' ? 'DRAW' : entry.winner_username;
            detailCell.innerHTML = `P1: ${entry.player1_score} (${entry.player1_wpm} WPM) | P2: ${entry.player2_score} (${entry.player2_wpm} WPM)`;
            
        } else {
            // --- PERSONAL BEST (SINGLE/MULTI) LOGIC ---
            userCell.className = `py-3 px-3 sm:px-6 text-left ${usernameClass}`;
            userCell.textContent = entry.username;
            
            // Display the selected metric (score, highest_wpm, or highest_streak)
            metricCell.textContent = entry[orderByFilter.value].toLocaleString();
            
            detailCell.textContent = `WPM: ${entry.highest_wpm} | Streak: ${entry.highest_streak}`;
        }
        
        row.classList.add("hover:bg-white/10", "transition", "duration-150");
    });
}

/**
 * Fetches data from the server based on current filter selections.
 */
async function loadLeaderboard() {
    const token = getAuthToken();
    
    // Set loading state
    loadingMessage.textContent = "Loading global scores...";
    loadingMessage.classList.remove('hidden');
    leaderboardBody.innerHTML = '';
    
    const selectedType = gameTypeFilter.value;
    const type = selectedType === 'history' ? 'multi' : selectedType; 
    const level = levelFilter.value;
    const orderBy = orderByFilter.value;
    
    updateHeaders(selectedType);

    try {
        let endpoint = "get_leaderboard";
        let url;
        
        if (selectedType === 'history') {
            // History route: no orderBy is needed other than timestamp
            url = `${API_URL}/${endpoint}?type=history&level=${level}&orderBy=timestamp`; 
        } else {
            // PB route: order by user selection
            url = `${API_URL}/${endpoint}?type=${type}&level=${level}&orderBy=${orderBy}`;
        }
        
        const headers = { "Content-Type": "application/json" };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`; // Only send token if it exists
        }
        
        const response = await fetch(url, {
            method: 'GET',
            headers: headers
        });

        const result = await response.json();
        
        if (response.ok) {
            const dataToRender = result.history || result.leaderboard || [];
            renderLeaderboard(dataToRender, selectedType);
        } else {
            console.error("API Error:", result.error);
            loadingMessage.textContent = `Error fetching data: ${result.error || 'Server error.'}`;
        }
    } catch (e) {
        console.error("Network Fetch Error:", e);
        loadingMessage.textContent = "Network error: Could not connect to server.";
    }
}

// Initial event listeners and load call
document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    loadLeaderboard();
});