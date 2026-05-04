// authCheck.js - The Authentication Gate for secured pages (e.g., levels.html, index.html)

(function() {
  // 1. Check if the authentication token exists in session storage.
  const token = sessionStorage.getItem("tr_token");
  
  // 2. If the token is missing, the user is unauthorized.
  if (!token) {
    alert("SECURITY ALERT: Token missing. Unauthorized access attempt detected.");
    
    // Ensure all client-side session data is wiped clean before redirecting
    // window.location.reload(); 
    sessionStorage.removeItem("tr_user");
      sessionStorage.removeItem("tr_token");

      // 3. Immediately redirect the user to the login page.
      // Using replace() is essential to prevent the secure page from being in the browser's history.
      window.location.replace("login.html");
      
      // Stop all further script execution on the secured page.
      return; 
  }
  
  // If the token exists, access is granted.
  console.log("Authentication successful. Access granted to secure page.");
})();