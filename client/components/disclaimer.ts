import '../styles/disclaimer.css'

export function initDisclaimer() {
  const disclaimer = `
    <section class="disclaimer">
      <span>This tool is not affiliated with Spotify.</span>
    </section>
    <section class="region" hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span>served from <span id="region-label"></span></span>
    </section>
  `;
  const disclaimerContainer = document.getElementById('disclaimer-container');
  if (disclaimerContainer) {
      disclaimerContainer.innerHTML = disclaimer;
  }

  fetch('/api/region')
    .then(res => res.json())
    .then((region: { label: string }) => {
      const el = document.getElementById('region-label');
      if (!el) return;
      el.textContent = region.label;
      el.closest('.region')?.removeAttribute('hidden');
    })
    .catch(() => {});
}
initDisclaimer();
