// Kept out of the client component so the server layout can read it as a plain string.
export const THEME_STORAGE_KEY = "ezassemble.theme";

/**
 * Runs in <head> before the first paint. The theme is light unless this browser has chosen dark with
 * the switch; the system setting is deliberately ignored. Setting it here avoids a flash of the wrong theme.
 */
export const themeBootScript = `(function(){var t="light";try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark"){t="dark"}}catch(e){}document.documentElement.dataset.theme=t})()`;
