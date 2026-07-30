// Preload script for PPTX export browser window
// This script runs before the page loads and injects environment variables

// Expose environment variables to the window
(window as any).env = {
  NEXT_PUBLIC_FAST_API: process.env.NEXT_PUBLIC_FAST_API || '',
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL || '',
  TEMP_DIRECTORY: process.env.TEMP_DIRECTORY || '',
  NEXT_PUBLIC_USER_CONFIG_PATH: process.env.NEXT_PUBLIC_USER_CONFIG_PATH || '',
};

console.log('[PPTX Export Preload] Environment variables set:', (window as any).env);
