// Applies the dark class before first paint so dark-by-default doesn't
// flash light for a frame while React mounts and useSettings/the
// landing ThemeToggle catch up. Mirrors the same stored-key/fallback
// logic those two use, so all three stay in agreement.
// Kept in its own file so the Content-Security-Policy can forbid inline scripts.
(function () {
  try {
    var stored = localStorage.getItem('monotask-landing-theme');
    var dark = stored ? stored === 'dark' : true;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
