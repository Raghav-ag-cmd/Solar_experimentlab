// ---------- Theme (light/dark) and colour style ----------
const root = document.documentElement;
const themeButton = document.getElementById("theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');
const paletteSelect = document.getElementById("palette");   // only on the simulator page

// Make the browser bar match the page background
function updateThemeColor() {
  if (!themeColor) return;
  themeColor.setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim());
}

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  themeButton.setAttribute("aria-pressed", theme === "dark");
  updateThemeColor();
  try { localStorage.setItem("solarlab-theme", theme); } catch (e) { }
}

function applyPalette(name) {
  root.setAttribute("data-palette", name);
  if (paletteSelect) paletteSelect.value = name;
  updateThemeColor();
  try { localStorage.setItem("solarlab-palette", name); } catch (e) { }
}

themeButton.addEventListener("click", () => {
  applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
});

if (paletteSelect) {
  paletteSelect.addEventListener("change", () => applyPalette(paletteSelect.value));
}

// Sync buttons and browser colour with the values set in <head>
applyTheme(root.getAttribute("data-theme"));
applyPalette(root.getAttribute("data-palette") || "solar");

// ---------- Mobile menu ----------
const drawer = document.getElementById("drawer");
const openBtn = document.getElementById("menu-open");
const closeBtn = document.getElementById("menu-close");

function setMenu(isOpen) {
  drawer.classList.toggle("open", isOpen);
  openBtn.setAttribute("aria-expanded", isOpen);
}

openBtn.addEventListener("click", () => setMenu(true));
closeBtn.addEventListener("click", () => setMenu(false));
drawer.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMenu(false);
});