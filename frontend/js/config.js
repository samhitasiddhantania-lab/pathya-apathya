// Point this at your deployed backend URL (Render, etc.).
// For local testing with the backend running on port 5000, keep as-is.
const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:5000/api"
  : "https://YOUR-RENDER-BACKEND-URL.onrender.com/api"; // <-- change this after deploying backend
