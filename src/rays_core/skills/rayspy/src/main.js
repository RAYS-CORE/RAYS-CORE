import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { mountBootSequence } from './BootSequence.js';

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

// Pre-warm the 3D application in the background while the boot sequence plays
const startPromise = application.start().catch((error) => {
  console.error("RAYSpy initialization failed:", error);
  const loaderStatus = document.querySelector('#loading-screen .loader-status');
  if (loaderStatus) {
    loaderStatus.textContent = `Error: ${describeError(error)}`;
    loaderStatus.style.color = '#ff4444';
  }
});

// Run the signature RAYSpy boot sequence
mountBootSequence(() => {
  startPromise.then(() => {
    const loader = document.querySelector('#loading-screen');
    if (loader && !loader.classList.contains('hidden')) {
      loader.classList.add('hidden');
    }
  });
});

export { application };
