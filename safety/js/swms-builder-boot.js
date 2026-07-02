/* SWMS Builder boot — V1.01
   Waits for Supabase client + tab modules to load before rendering.
*/
(function () {
  async function waitFor(fn, timeoutMs = 5000, stepMs = 50) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (fn()) return true;
      await new Promise(r => setTimeout(r, stepMs));
    }
    return false;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const SB = window.SwmsBuilder;
    if (!SB) { console.error('[boot] SwmsBuilder core missing'); return; }

    // 1) Wait for Supabase client (auth.js)
    const sbReady = await waitFor(() => !!window.sb, 5000);
    if (!sbReady) { console.error('[boot] Supabase client (window.sb) not available'); return; }

    // 2) Wait for at least one tab to register (templates + swms)
    await waitFor(() => Object.keys(SB.getTabs()).length >= 2, 3000);

    // 3) Wire tab clicks + load data
    SB.buildTabBar();
    await SB.reloadTemplates();
    SB.markBooted();
    SB.renderActiveTab();
  });
})();
