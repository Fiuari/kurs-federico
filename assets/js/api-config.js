// After deploying Render, paste its HTTPS origin here (no /api and no trailing slash).
// This URL is public configuration, not a secret.
const HOTEL_API_URL = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:3000'
  : ''; // Example: https://your-service.onrender.com
