import API_URL from "./config.js";
let ADMIN_TOKEN = sessionStorage.getItem('tr_admin_token'); 
let currentReportType = 'matches'; // Global variable to track active report type

// --- AUTH CHECK & REDIRECT ---

function logout() {
    sessionStorage.removeItem('tr_admin_token');
    sessionStorage.removeItem('tr_token');
    sessionStorage.removeItem('tr_user');
    window.location.replace("index.html"); 
}

// --- UI UTILITIES ---

function showTab(tabId, buttonElement) {
    // 1. Hide all tab content and remove active state from all buttons
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
    
    // 2. Activate the selected tab and button
    document.getElementById(tabId).classList.add('active');
    if (buttonElement) {
        buttonElement.classList.add('active');
    }

    // 3. Load content based on the tab ID
    if (tabId === 'users') loadUserList();
    if (tabId === 'audit') loadMatchReport(); // This starts the report loading process
}

function displayMessage(message, isError = true) {
    const msgEl = document.getElementById('userMessage') || document.getElementById('matchReportMessage');
    if (msgEl) {
        msgEl.textContent = message;
        msgEl.className = `message ${isError ? 'message-error' : 'message-success'} message-margin`;
        msgEl.classList.remove('hidden');
    }
}

// --- 1. USER MANAGEMENT (VIEW/DELETE) ---

async function loadUserList() {
    const userList = document.getElementById('userList');
    userList.innerHTML = '<tr><td colspan="4" class="table-loading">Loading users...</td></tr>';
    document.getElementById('userMessage').classList.add('hidden');

    try {
        const res = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });
        const data = await res.json();

        if (res.ok) {
            renderUserList(data.users);
        } else {
            displayMessage(data.error, true);
            userList.innerHTML = '<tr><td colspan="4" class="table-loading message-error">Failed to load users.</td></tr>';
        }
    } catch (e) {
        displayMessage("Network Error: Failed to retrieve user list.", true);
        userList.innerHTML = '<tr><td colspan="4" class="table-loading message-error">Network Error.</td></tr>';
    }
}

function renderUserList(users) {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';

    const userSession = sessionStorage.getItem('tr_user');
    const currentUserId = userSession ? JSON.parse(userSession).id : -1;
    
    users.forEach(user => {
        const date = 'N/A';
        const isSelf = user.id === currentUserId;

        const actionButton = isSelf 
            ? '<span class="admin-tag">ADMIN</span>'
            : `<button onclick="deleteUser(${user.id}, '${user.username}')" 
                class="action-button-delete">
                Delete
            </button>`;

        const row = `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
               
                <td>${actionButton}</td>
            </tr>
        `;
        userList.innerHTML += row;
    });
}

async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to permanently delete user: ${username} (ID: ${userId})? This will also delete ALL their scores and history.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });

        const data = await res.json();
        
        displayMessage(res.ok ? data.message : data.error, !res.ok);
        
        loadUserList();

    } catch (e) {
        displayMessage("Network Error: Failed to connect to server.", true);
    }
}


// --- 2. MATCH LOG & REPORTS ---

// Master function to load data based on the type requested
async function loadReportData(reportType, isFiltered = false) {
    currentReportType = reportType; // Update global tracker

    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    
    let queryParams = '';
    const reportTitleEl = document.getElementById('reportTitle');
    
    // 1. Validate and Build Query Params
    if (startDate && endDate) {
        if (new Date(startDate) > new Date(endDate)) {
            document.getElementById('matchReportMessage').textContent = "Error: Start Date cannot be after End Date.";
            document.getElementById('matchReportMessage').classList.remove('hidden');
            return;
        }
        queryParams = `?startDate=${startDate}&endDate=${endDate}`;
        reportTitleEl.textContent = 
            `${reportType === 'matches' ? 'Multiplayer Match Logs' : 'Single Player Match Logs'} (${startDate} to ${endDate})`;
    } else {
        reportTitleEl.textContent = 
            `${reportType === 'matches' ? 'Multiplayer Match Logs' : 'Single Player Match Logs'} (All Time - Max 500 Records)`;
    }


    const listElement = reportType === 'matches' ? document.getElementById('matchReportList') : document.getElementById('pbReportList');
    const msgEl = document.getElementById('matchReportMessage');
    const url = reportType === 'matches' 
        ? `${API_URL}/admin/reports/daily_matches${queryParams}` 
        : `${API_URL}/admin/reports/daily_pbs${queryParams}`;

    const colspan = reportType === 'matches' ? 5 : 4;
    
    listElement.innerHTML = `<tr><td colspan="${colspan}" class="table-loading">Loading ${reportType} data...</td></tr>`;
    if (msgEl) msgEl.classList.add('hidden');

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
        });
        const data = await res.json();

        // 2. Render Data
        if (res.ok && data.success) {
            if (reportType === 'matches') {
                renderMatchReport(data.report, listElement);
            } else {
                renderPBReport(data.report, listElement);
            }
        } else {
            msgEl.textContent = data.error || `Failed to load ${reportType} data.`;
            msgEl.classList.remove('hidden');
            listElement.innerHTML = `<tr><td colspan="${colspan}" class="table-loading message-error">Error fetching data.</td></tr>`;
        }
    } catch (e) {
        msgEl.textContent = "Network Error: Could not reach API for reports.";
        msgEl.classList.remove('hidden');
        listElement.innerHTML = `<tr><td colspan="${colspan}" class="table-loading message-error">Network Error.</td></tr>`;
    }
}

// Renders the Multiplayer Match Log
function renderMatchReport(reportData, listElement) {
    listElement.innerHTML = '';
    if (reportData.length === 0) {
        listElement.innerHTML = '<tr><td colspan="5" class="table-loading">No multiplayer matches recorded in this range.</td></tr>';
        return;
    }
    
    reportData.forEach(row => {
        const winnerStyle = row.winner === row.p1_username || row.winner === row.p2_username 
                            ? 'style="color: var(--color-winner-green); font-weight: 600;"'
                            : 'style="color: var(--color-warning-yellow);"';

        const rowHtml = `
            <tr>
                <td>${row.date}</td>
                <td>${row.time}</td>
                <td>${row.level.toUpperCase()}</td>
                <td ${winnerStyle}>${row.winner.toUpperCase()}</td>
                <td style="color: var(--color-text-secondary); font-size: 0.8rem;">${row.players}</td>
            </tr>
        `;
        listElement.innerHTML += rowHtml;
    });
}

// Renders the Single Player Match Log (All matches, not just PB)
function renderPBReport(reportData, listElement) {
    listElement.innerHTML = '';
    if (reportData.length === 0) {
        listElement.innerHTML = '<tr><td colspan="4" class="table-loading">No single player matches recorded in this range.</td></tr>';
        return;
    }
    
    reportData.forEach(row => {
        const scoreStyle = 'style="color: var(--color-info-blue); font-weight: 600;"';

        const rowHtml = `
            <tr>
                <td>${row.date}</td>
                <td>${row.username}</td>
                <td>${row.level.toUpperCase()}</td>
                <td ${scoreStyle}>${row.score} / ${row.wpm} WPM</td>
            </tr>
        `;
        listElement.innerHTML += rowHtml;
    });
}

// Master function to switch sub-reports (Match Log vs PB Submissions)
function switchReport(reportType, buttonElement) {
    currentReportType = reportType; 

    // Toggle button active state
    document.querySelectorAll('.subtab-button').forEach(btn => btn.classList.remove('active'));
    if (buttonElement) buttonElement.classList.add('active');

    // Toggle table visibility
    document.getElementById('matchLogTable').classList.add('hidden');
    document.getElementById('pbSubmissionsTable').classList.add('hidden');
    
    if (reportType === 'matches') {
        document.getElementById('matchLogTable').classList.remove('hidden');
    } else {
        document.getElementById('pbSubmissionsTable').classList.remove('hidden');
    }

    // Load data with the currently set filter dates
    loadReportData(reportType, true); 
}

// The entry point for the Reports Panel initialization
function loadMatchReport() {
    // Default to the multiplayer report when this section loads
    switchReport('matches', document.getElementById('matches-report-btn'));
}


// --- INITIALIZATION (Run on load) ---

function initialCheck() {
    const userSession = sessionStorage.getItem('tr_user');
    
    if (ADMIN_TOKEN && userSession) {
        const user = JSON.parse(userSession);
        if (user.isAdmin) {
            document.getElementById('loadingScreen').classList.add('hidden');
            document.getElementById('mainDashboard').classList.remove('hidden');
            
            // Load the default tab content (User Management)
            const defaultButton = document.getElementById('users-tab');
            showTab('users', defaultButton);
            return;
        }
    }
    window.location.replace("index.html"); 
}

window.showTab = showTab;
window.loadReportData = loadReportData;
window.switchReport = switchReport;
document.getElementById('adminLogoutBtn').addEventListener('click', logout);
document.addEventListener('DOMContentLoaded', initialCheck);