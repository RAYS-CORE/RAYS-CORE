window.addEventListener("DOMContentLoaded", () => {
  const subtitleEl = document.querySelector("[data-startup-subtitle]");
  const hintEl = document.querySelector("[data-startup-hint]");
  const progressEl = document.querySelector("[data-startup-progress]");
  const meterEl = document.querySelector("[data-startup-meter]");

  const currentStatus = {
    libreoffice: "checking",
    puppeteer: "checking",
    imagemagick: "checking",
  };

  const completeStates = new Set(["installed", "downloaded", "skipped"]);
  const errorStates = new Set(["missing", "failed"]);

  let visualProgress = 0.24;
  let targetProgress = 0.58;

  function applyProgress(value) {
    const clampedValue = Math.max(0.18, Math.min(value, 1));
    if (progressEl) {
      progressEl.style.setProperty("--progress", String(clampedValue));
      progressEl.style.transform = `scaleX(${clampedValue})`;
    }
    if (meterEl) {
      meterEl.setAttribute("aria-valuenow", String(Math.round(clampedValue * 100)));
    }
  }

  function updateStateCopy() {
    const statuses = Object.values(currentStatus);
    const hasError = statuses.some((status) => errorStates.has(status));
    const isInstalling = statuses.some(
      (status) => status === "installing" || status === "downloading"
    );
    const isChecking = statuses.some((status) => status === "checking");
    const isReady =
      statuses.length > 0 &&
      statuses.every((status) => completeStates.has(status));

    if (hasError) {
      targetProgress = Math.max(targetProgress, 0.54);
      if (subtitleEl) subtitleEl.textContent = "Please wait a moment";
      if (hintEl) hintEl.textContent = "Setup required before launch";
      return;
    }

    if (isInstalling) {
      targetProgress = Math.max(targetProgress, 0.72);
      if (subtitleEl) subtitleEl.textContent = "Please wait a moment";
      if (hintEl) hintEl.textContent = "Installing required components";
      return;
    }

    if (isChecking) {
      targetProgress = Math.max(targetProgress, 0.58);
      if (subtitleEl) subtitleEl.textContent = "Please wait a moment";
      if (hintEl) hintEl.textContent = "Checking required components";
      return;
    }

    if (isReady) {
      targetProgress = 0.88;
      if (subtitleEl) subtitleEl.textContent = "Please wait a moment";
      if (hintEl) hintEl.textContent = "Opening your workspace";
      return;
    }

    targetProgress = Math.max(targetProgress, 0.68);
    if (subtitleEl) subtitleEl.textContent = "Please wait a moment";
    if (hintEl) hintEl.textContent = "Preparing your workspace";
  }

  function setStatus(name, status) {
    if (!(name in currentStatus)) {
      return;
    }

    currentStatus[name] = status;
    updateStateCopy();
  }

  function animateProgress() {
    visualProgress += (targetProgress - visualProgress) * 0.08;
    applyProgress(visualProgress);
    window.requestAnimationFrame(animateProgress);
  }

  updateStateCopy();
  applyProgress(visualProgress);
  animateProgress();

  window.setInterval(() => {
    if (targetProgress < 0.82) {
      targetProgress = Math.min(0.82, targetProgress + 0.03);
    }
  }, 1200);

  if (window.electron?.onStartupStatus) {
    window.electron.onStartupStatus((payload) => {
      if (!payload) return;
      setStatus(payload.name, payload.status);
    });
  }

  if (window.electron?.getStartupStatus) {
    window.electron.getStartupStatus().then((statusMap) => {
      if (!statusMap) return;
      if (statusMap.libreoffice) setStatus("libreoffice", statusMap.libreoffice);
      if (statusMap.puppeteer) setStatus("puppeteer", statusMap.puppeteer);
      if (statusMap.imagemagick) {
        setStatus("imagemagick", statusMap.imagemagick);
      }
    });
  }

  window.addEventListener("beforeunload", () => {
    targetProgress = 1;
    applyProgress(1);
  });
});
