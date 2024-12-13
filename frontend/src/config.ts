// Determine if we're running in development or production
const isDevelopment = process.env.NODE_ENV === 'development';

// In development, use localhost:8090
// In production, use relative path since PocketBase is serving our app
export const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8090' 
  : window.location.origin;
