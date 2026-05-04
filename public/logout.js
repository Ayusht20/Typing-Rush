import API_URL from "./config.js";
const keypointsBtn = document.getElementById("keypointsBtn");
const keypointsModal = document.getElementById("keypointsModal");

keypointsBtn.addEventListener("click", (e) => {
  e.preventDefault();
  keypointsModal.style.display = "flex";
});

function closeModal() {
  keypointsModal.style.display = "none";
}
// Assuming you have already created the socket connection somewhere like:
// const socket = io("http://localhost:3000", { withCredentials: true });

// document.getElementById("logoutBtn").addEventListener("click", async () => {
//   try {
//     // 1. Tell backend to logout (this clears JWT cookie & removes user)
//     await fetch("http://localhost:3000/logout", {
//       method: "POST",
//       credentials: "include"
//     });

//     // 2. Disconnect the socket (so no ghost connections)
//     if (typeof socket !== "undefined") {
//       socket.disconnect();
//     }

//     // 3. Redirect back to login page
//     window.location.href = "index.html";
//   } catch (err) {
//     console.error("Logout failed:", err);
//   }
// });
// logout.js

document.getElementById("logoutBtn").addEventListener("click", async () => {
  const token = sessionStorage.getItem("tr_token");
  
  try {
    if (token) {
        await fetch(`${API_URL}/logout`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
    }

    // 2. Disconnect the socket (now accessible via window)
    if (window.socket) {
      window.socket.disconnect();
    }
    
    // 3. Clear session storage
    sessionStorage.removeItem("tr_token");
    sessionStorage.removeItem("tr_user");

    // 4. Redirect back to login page
    window.location.href = "index.html";
  } catch (err) {
    console.error("Logout failed:", err);
    sessionStorage.removeItem("tr_token");
    sessionStorage.removeItem("tr_user");
    window.location.href = "index.html";
  }
});