// Solar Lab simulator: one panel on its own, or two panels side by side, with one shared sun.
// The maths, weather table and charts are in core.js.
//
// Each panel has its own scene (canvas), tilt slider, weather menu and shade slider.
// Ids end in -a or -b: canvas-a, tilt-a, tilt-out-a, weather-a, shade-a, shade-out-a, theta-a, factor-a, power-a
//
// Power = Pmax x weather x intensity x (1 - shade) x cos(theta)

const W = 480;              // size of each scene
const H = 360;
const GROUND_H = 45;
const STAND_H = 60;
const PIVOT_X = W / 2;
const PIVOT_Y = H - GROUND_H - STAND_H;
const SUN_DISTANCE = 190;   // how far the sun is drawn from the panel

const LIVE_POINTS = 40;     // the live graph keeps the latest 40 readings...
const LIVE_EVERY_MS = 500;  // ...one every half a second, so it shows the last 20 seconds

let canvas, ctx;            // the scene being drawn right now
let C = readColors();       // scene colours from the current colour style
let intensity = 1;          // sunlight strength from the slider, 0 to 1 (shared by both panels)

// ---------- Drawing one scene ----------

// helper: filled circle in the current fillStyle
function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
}

function sky() {
    const g = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
    g.addColorStop(0, C.sky1);
    g.addColorStop(1, C.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
}

function sun(x, y) {
    const k = 0.8;   // sun size

    // soft glow
    const glow = ctx.createRadialGradient(x, y, 16, x, y, 105);
    glow.addColorStop(0, "rgba(255, 214, 90, 0.55)");
    glow.addColorStop(1, "rgba(255, 214, 90, 0)");
    ctx.fillStyle = glow;
    circle(x, y, 105);

    // 12 rays, one every 30 degrees
    ctx.strokeStyle = "rgba(255, 205, 70, 0.9)";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    for (let i = 0; i < 12; i++) {
        const a = degToRad(i * 30);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 52 * k, y + Math.sin(a) * 52 * k);
        ctx.lineTo(x + Math.cos(a) * 70 * k, y + Math.sin(a) * 70 * k);
        ctx.stroke();
    }

    // bright core
    const core = ctx.createRadialGradient(x - 8, y - 8, 4, x, y, 42 * k);
    core.addColorStop(0, "#fff6b8");
    core.addColorStop(1, "#ffa81f");
    ctx.fillStyle = core;
    circle(x, y, 42 * k);
}

function cloud(x, y, s, tone) {
    ctx.fillStyle = tone;
    circle(x, y, 22 * s);
    circle(x + 25 * s, y - 12 * s, 28 * s);
    circle(x + 55 * s, y, 22 * s);
}

// Clouds, plus a grey wash that makes the sky duller when the weather is poor
function weatherLayer(weather, sunX, sunY) {
    ctx.fillStyle = "rgba(70, 82, 98, " + (weather.dim * 0.6) + ")";
    ctx.fillRect(0, 0, W, H - GROUND_H);

    const tone = weather.dim > 0.3 ? "rgba(226, 232, 240, 0.94)" : "rgba(255, 255, 255, 0.88)";
    weather.clouds.forEach(([x, y, s]) => cloud(x, y, s, tone));
    if (weather.cover > 0) {
        cloud(sunX - 27 * weather.cover, sunY + 5, weather.cover, tone);   // cloud in front of the sun
    }
}

function ground() {
    const y = H - GROUND_H;
    const g = ctx.createLinearGradient(0, y, 0, H);
    g.addColorStop(0, C.ground1);
    g.addColorStop(1, C.ground2);
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, GROUND_H);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";   // bright edge on top of the ground
    ctx.fillRect(0, y, W, 4);
}

function shadow() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.beginPath();
    ctx.ellipse(PIVOT_X, H - GROUND_H + 12, 70, 7, 0, 0, 2 * Math.PI);
    ctx.fill();
}

function lightRay(sunX, sunY) {
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = "rgba(255, 190, 40, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(PIVOT_X, PIVOT_Y);
    ctx.stroke();
    ctx.restore();                      // puts the dashes back to solid lines
}

// shade is the fraction of the panel that is covered, from 0 to 1
function panel(tiltDeg, shade) {
    const w = 120;
    const h = 14;

    // stand with a little shading
    const post = ctx.createLinearGradient(PIVOT_X - 5, 0, PIVOT_X + 5, 0);
    post.addColorStop(0, "#8a97a8");
    post.addColorStop(1, "#4f5b6b");
    ctx.fillStyle = post;
    ctx.fillRect(PIVOT_X - 5, PIVOT_Y, 10, STAND_H);

    ctx.save();
    ctx.translate(PIVOT_X, PIVOT_Y);
    ctx.rotate(-degToRad(tiltDeg));

    // body
    const body = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    body.addColorStop(0, C.panel1);
    body.addColorStop(1, C.panel2);
    ctx.fillStyle = body;
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // lines between the solar cells
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1;
    for (let x = -w / 2 + 20; x < w / 2; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, -h / 2);
        ctx.lineTo(x, h / 2);
        ctx.stroke();
    }

    // shade: a dark cover that grows from the left end of the panel
    if (shade > 0) {
        ctx.fillStyle = "rgba(10, 18, 30, 0.7)";
        ctx.fillRect(-w / 2, -h / 2, w * shade, h);
    }

    // glossy top edge and a silver frame
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.fillRect(-w / 2, -h / 2, w, 3);
    ctx.strokeStyle = "#c9d3df";
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();

    // pivot bolt
    ctx.fillStyle = "#c9d3df";
    circle(PIVOT_X, PIVOT_Y, 5);
}

// Draw one whole scene on the given canvas, back to front like layers of paper.
// The sun sits on a circle around the panel, at the height the slider says.
function drawScene(el, tilt, sunHeight, weather, shade, sunStrength) {
    canvas = el;
    ctx = el.getContext("2d");

    const sunX = PIVOT_X - SUN_DISTANCE * Math.cos(degToRad(sunHeight));
    const sunY = PIVOT_Y - SUN_DISTANCE * Math.sin(degToRad(sunHeight));

    // dimmer when cloudy, and dimmer again when the intensity slider is low
    const brightness = (1 - weather.dim) * (0.25 + 0.75 * sunStrength);

    ctx.clearRect(0, 0, W, H);
    sky();

    ctx.globalAlpha = brightness;
    sun(sunX, sunY);
    ctx.globalAlpha = 1;

    weatherLayer(weather, sunX, sunY);
    ground();
    shadow();

    ctx.globalAlpha = brightness;           // a weaker light ray too
    lightRay(sunX, sunY);
    ctx.globalAlpha = 1;

    panel(tilt, shade);
}

// ---------- Controls ----------

const sunSlider = document.getElementById("sun");
const sunOut = document.getElementById("sun-out");
const intensitySlider = document.getElementById("intensity");
const intensityOut = document.getElementById("intensity-out");

// Everything that belongs to one panel (the suffix is "a" or "b")
function getPanel(suffix) {
    const id = (name) => document.getElementById(name + "-" + suffix);
    return {
        canvas: id("canvas"), tilt: id("tilt"), tiltOut: id("tilt-out"), weather: id("weather"),
        shade: id("shade"), shadeOut: id("shade-out"),
        thetaOut: id("theta"), factorOut: id("factor"), powerOut: id("power"),
    };
}
const panelA = getPanel("a");
const panelB = getPanel("b");

// Read one panel's controls, calculate, show its numbers and draw its scene
function updatePanel(p, sunHeight) {
    const tilt = Number(p.tilt.value);              // slider values are text, so convert
    const shade = shadeOn() ? Number(p.shade.value) / 100 : 0;      // 0 to 1, and always 0 unless shade is included
    const weather = WEATHER[p.weather.value];
    const theta = calcTheta(tilt, sunHeight);
    const power = calcPower(tilt, sunHeight, weather.factor, intensity, shade);

    p.tiltOut.textContent = tilt;
    p.shadeOut.textContent = p.shade.value;
    p.thetaOut.textContent = theta.toFixed(1);
    p.factorOut.textContent = weather.factor.toFixed(2);
    p.powerOut.textContent = power.toFixed(1);

    drawScene(p.canvas, tilt, sunHeight, weather, shade, intensity);
    return { tilt, theta, power, factor: weather.factor, shade };
}

// ---------- One panel or two ----------
// The page keeps the choice in <html data-mode="one"|"two">. The CSS hides everything
// marked class="only-two" when the mode is "one".

const modeButtons = document.querySelectorAll(".segmented button");
const titleA = document.getElementById("title-a");

function isOnePanel() {
    return document.documentElement.getAttribute("data-mode") === "one";
}

function setMode(mode) {
    document.documentElement.setAttribute("data-mode", mode);
    modeButtons.forEach((btn) => btn.setAttribute("aria-checked", btn.dataset.panels === mode));
    titleA.textContent = mode === "one" ? "Your panel" : "Panel A";
    try { localStorage.setItem("solarlab-panels", mode); } catch (e) { }
    live.a = [];                // the live graph starts again so both lines line up
    live.b = [];
    update();                   // the charts were hidden (zero width), so draw them again now
}

modeButtons.forEach((btn) => btn.addEventListener("click", () => setMode(btn.dataset.panels)));

// ---------- Include shade? ----------
// Shade is off until the person asks for it. The page keeps the choice in <html data-shade="on">.
// While it is off the shade sliders are hidden (class="only-shade") and every panel uses a shade of 0,
// so the formula is just Pmax x weather x intensity x cos(theta).

const shadeButton = document.getElementById("shade-toggle");

function shadeOn() {
    return document.documentElement.getAttribute("data-shade") === "on";
}

function setShade(on) {
    if (on) document.documentElement.setAttribute("data-shade", "on");
    else document.documentElement.removeAttribute("data-shade");
    shadeButton.setAttribute("aria-pressed", on);
    shadeButton.textContent = on ? "Shade included ✓" : "Include shade?";
    update();
}

shadeButton.addEventListener("click", () => {
    activeExp = null;           // an experiment that was set up no longer matches
    markActive();
    setShade(!shadeOn());
});

// ---------- Comparison text ----------

function compareText(a, b) {
    if (Math.abs(a.power - b.power) < 0.05) {
        return "Both panels produce the same output (" + a.power.toFixed(1) + " W).";
    }
    const aWins = a.power > b.power;
    const hi = aWins ? a : b;
    const lo = aWins ? b : a;
    const hiName = aWins ? "A" : "B";
    const loName = aWins ? "B" : "A";

    if (lo.power === 0) {
        return "Panel " + hiName + " produces " + hi.power.toFixed(1) + " W, but Panel " + loName + " produces nothing.";
    }
    const ratio = hi.power / lo.power;
    const percent = (hi.power - lo.power) / lo.power * 100;
    return "Panel " + hiName + " produces " + ratio.toFixed(2) + "\u00D7 the output of Panel " + loName +
        " (" + percent.toFixed(0) + "% more).";
}

// Why do they differ? Only one thing changing makes a fair test.
function reasonText(a, b) {
    const different = [];
    if (Math.abs(a.theta - b.theta) >= 0.05) different.push("angle \u03B8");
    if (a.factor !== b.factor) different.push("weather");
    if (a.shade !== b.shade) different.push("shade");

    if (different.length === 0) {
        return "The angle, the weather" + (shadeOn() ? " and the shade are" : " are") + " all the same, so the outputs match.";
    }
    if (different.length === 1) return "Only the " + different[0] + " is different, so the difference comes only from that.";
    return "The " + different.join(" and the ") + " are different, so each one changes the result. Change only one to see its effect.";
}

// ---------- Bar graphs ----------

const sweepCaption = document.getElementById("sweep-caption");
const ANGLES = [0, 15, 30, 45, 60, 75, 90];

function drawCharts(sunHeight, a, b) {
    const labels = ANGLES.map((t) => t + "\u00B0");
    const at = (t, p) => calcPower(t, sunHeight, p.factor, intensity, p.shade);

    if (!b) {
        // One panel: output at every tilt, with the bar nearest to the current tilt highlighted
        const nearest = Math.min(ANGLES.length - 1, Math.round(a.tilt / 15));
        barChart("chart-sweep", labels, ANGLES.map((t) => at(t, a)), nearest);
        sweepCaption.textContent = "Output (W) of your panel at every tilt, with your weather and intensity" +
            (shadeOn() ? " and shade" : "") + ". The highlighted bar is the tilt closest to where your slider is now.";
        return;
    }

    // 1. the two outputs side by side
    barChart("chart-ab", ["Panel A", "Panel B"], [a.power, b.power], 1);

    // 2. output of each panel at every tilt (each keeps its own weather and shade)
    groupedBarChart("chart-sweep", labels, ANGLES.map((t) => at(t, a)), ANGLES.map((t) => at(t, b)));
    sweepCaption.textContent = shadeOn()
        ? "Output (W) of each panel at every tilt, keeping its own weather and shade. The weather and shade scale every bar by the same factor."
        : "Output (W) of each panel at every tilt, keeping its own weather. The weather scales every bar by the same factor.";
}

// ---------- Best-angle curve ----------
// Output at every tilt from 0 to 90 degrees. The peak is where theta = 0, so the best tilt is 90 - sun height.

const curveCaption = document.getElementById("curve-caption");

function drawCurve(sunHeight, a, b) {
    const tilts = Array.from({ length: 91 }, (_, i) => i);
    const curve = (p) => tilts.map((t) => calcPower(t, sunHeight, p.factor, intensity, p.shade));

    const series = [{ name: b ? "Panel A" : "Your panel", color: "accent", values: curve(a) }];
    const markers = [{ index: a.tilt, color: "accent" }];
    if (b) {
        series.push({ name: "Panel B", color: "accent2", values: curve(b) });
        markers.push({ index: b.tilt, color: "accent2" });
    }

    lineChart("chart-curve", series, {
        xTicks: [0, 15, 30, 45, 60, 75, 90].map((t) => [t, t + "\u00B0"]),
        markers: markers,
        peaks: true,
    });

    const best = 90 - sunHeight;
    curveCaption.textContent = "Output (W) against tilt for a sun height of " + sunHeight + "\u00B0. " +
        "The curve peaks where \u03B8 = 0\u00B0, which is a tilt of 90\u00B0 \u2212 " + sunHeight + "\u00B0 = " + best + "\u00B0. " +
        "The dashed line marks " + (b ? "each panel's tilt." : "your tilt.");
}

// ---------- Live graph ----------
// Every half second the current output is added to a list. The graph draws the latest 40 readings,
// so it shows the last 20 seconds and moves as you change the settings.

const live = { a: [], b: [], paused: false };
let latest = { a: null, b: null };      // the newest readings, set by update()

const livePauseBtn = document.getElementById("live-pause");
const liveClearBtn = document.getElementById("live-clear");

function drawLive() {
    const one = isOnePanel();
    const series = [{ name: one ? "Your panel" : "Panel A", color: "accent", values: live.a }];
    if (!one) series.push({ name: "Panel B", color: "accent2", values: live.b });
    lineChart("chart-live", series, {
        count: LIVE_POINTS,
        xTicks: [[0, "20 s ago"], [LIVE_POINTS - 1, "now"]],
    });
}

function liveTick() {
    if (live.paused || !latest.a) return;
    live.a.push(latest.a.power);
    if (live.a.length > LIVE_POINTS) live.a.shift();
    if (latest.b) {
        live.b.push(latest.b.power);
        if (live.b.length > LIVE_POINTS) live.b.shift();
    }
    drawLive();
}

livePauseBtn.addEventListener("click", () => {
    live.paused = !live.paused;
    livePauseBtn.textContent = live.paused ? "Resume" : "Pause";
    livePauseBtn.setAttribute("aria-pressed", live.paused);
});

liveClearBtn.addEventListener("click", () => {
    live.a = [];
    live.b = [];
    drawLive();
});

setInterval(liveTick, LIVE_EVERY_MS);

// ---------- Experiment mode ----------
// Each experiment sets the sun to 30 degrees and uses one panel. At that sun height a tilt of 60 faces
// the sun (theta = 0) and a tilt of 0 gives theta = 60, which matches the Experiments page.

const EXPERIMENTS = {
    A: { title: "Direct sunlight", sun: 30, tilt: 60, weather: "sunny" },
    B: { title: "Oblique sunlight", sun: 30, tilt: 0, weather: "sunny" },
    C: { title: "Cloudy conditions", sun: 30, tilt: 60, weather: "cloudy" },
};
const RESULTS_KEY = "solarlab-results";

const expStatus = document.getElementById("exp-status");
const resultsBody = document.getElementById("results-body");
const resultsText = document.getElementById("results-text");
let activeExp = null;       // the experiment that was set up and not changed since

// Saved results are read back from the browser and checked, because anything in storage could be wrong
function loadResults() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(RESULTS_KEY)) || {}; } catch (e) { saved = {}; }
    const out = {};
    Object.keys(EXPERIMENTS).forEach((key) => {
        const r = saved[key];
        if (r && Number.isFinite(r.theta) && Number.isFinite(r.power) &&
            Object.prototype.hasOwnProperty.call(WEATHER, r.weather)) {
            out[key] = { theta: r.theta, power: r.power, weather: r.weather };
        }
    });
    return out;
}

function storeResults(results) {
    try { localStorage.setItem(RESULTS_KEY, JSON.stringify(results)); } catch (e) { }
}

function markActive() {
    document.querySelectorAll(".exp-card").forEach((card) => {
        card.classList.toggle("active", card.dataset.exp === activeExp);
    });
}

function runExperiment(key) {
    const e = EXPERIMENTS[key];
    if (!isOnePanel()) setMode("one");
    if (shadeOn()) setShade(false);                 // the experiments are fair tests without shade
    sunSlider.value = e.sun;
    intensitySlider.value = 100;
    panelA.tilt.value = e.tilt;
    panelA.weather.value = e.weather;
    panelA.shade.value = 0;
    activeExp = key;
    update();
    markActive();
    expStatus.textContent = "Experiment " + key + " is set up (" + e.title + "). Look at the output, then press Save result.";
}

function saveExperiment(key) {
    if (activeExp !== key) runExperiment(key);      // make sure the settings match the experiment
    const a = latest.a;
    const results = loadResults();
    results[key] = { theta: a.theta, power: a.power, weather: panelA.weather.value };
    storeResults(results);
    renderResults();
    expStatus.textContent = "Saved Experiment " + key + ": " + a.power.toFixed(1) + " W.";
}

// "Experiment A produced 2.00x the output of Experiment B."
function compareSaved(nameX, x, nameY, y) {
    if (x.power === 0 && y.power === 0) return "Experiments " + nameX + " and " + nameY + " both produced nothing.";
    if (y.power === 0) {
        return "Experiment " + nameX + " produced " + x.power.toFixed(1) + " W, but Experiment " + nameY + " produced nothing.";
    }
    const ratio = x.power / y.power;
    if (Math.abs(ratio - 1) < 0.05) return "Experiment " + nameX + " and Experiment " + nameY + " produced about the same output.";
    if (ratio > 1) return "Experiment " + nameX + " produced " + ratio.toFixed(2) + "\u00D7 the output of Experiment " + nameY + ".";
    return "Experiment " + nameX + " produced only " + (ratio * 100).toFixed(0) + "% of the output of Experiment " + nameY + ".";
}

function renderResults() {
    const results = loadResults();

    resultsBody.replaceChildren();
    Object.keys(EXPERIMENTS).forEach((key) => {
        const r = results[key];
        const row = document.createElement("tr");
        const head = document.createElement("th");
        head.scope = "row";
        head.textContent = key;
        row.append(head);
        [r ? r.theta.toFixed(0) + "\u00B0" : "\u2014",
        r ? WEATHER[r.weather].label : "\u2014",
        r ? r.power.toFixed(1) : "\u2014"].forEach((text) => {
            const cell = document.createElement("td");
            cell.textContent = text;
            row.append(cell);
        });
        resultsBody.append(row);
    });

    const lines = [];
    if (results.A && results.B) lines.push(compareSaved("A", results.A, "B", results.B) + " Only the angle changed.");
    if (results.A && results.C) lines.push(compareSaved("A", results.A, "C", results.C) + " Only the weather changed.");
    if (!lines.length) lines.push("Save Experiment A and one of the others to see how they compare.");

    resultsText.replaceChildren();
    lines.forEach((text) => {
        const p = document.createElement("p");
        p.textContent = text;
        resultsText.append(p);
    });
}

document.querySelectorAll("[data-run]").forEach((btn) => {
    btn.addEventListener("click", () => runExperiment(btn.dataset.run));
});
document.querySelectorAll("[data-save]").forEach((btn) => {
    btn.addEventListener("click", () => saveExperiment(btn.dataset.save));
});
document.getElementById("exp-clear").addEventListener("click", () => {
    try { localStorage.removeItem(RESULTS_KEY); } catch (e) { }
    renderResults();
    expStatus.textContent = "Saved results cleared.";
});

// ---------- Update everything ----------

const diffOut = document.getElementById("diff-out");
const compareOut = document.getElementById("compare-text");
const reasonOut = document.getElementById("reason-text");

function update() {
    const sunHeight = Number(sunSlider.value);
    sunOut.textContent = sunHeight;
    intensity = Number(intensitySlider.value) / 100;
    intensityOut.textContent = intensitySlider.value;

    C = readColors();                               // pick up the current colour style
    const a = updatePanel(panelA, sunHeight);
    let b = null;

    if (!isOnePanel()) {                            // Panel B and the comparison are hidden in one-panel mode
        b = updatePanel(panelB, sunHeight);
        diffOut.textContent = (a.power - b.power).toFixed(1);
        compareOut.textContent = compareText(a, b);
        reasonOut.textContent = reasonText(a, b);
    }

    latest = { a, b };
    drawCharts(sunHeight, a, b);
    drawCurve(sunHeight, a, b);
    drawLive();
}

// When the person changes a control, any experiment that was set up no longer matches it
function onControl() {
    activeExp = null;
    markActive();
    update();
}

[sunSlider, intensitySlider, panelA.tilt, panelB.tilt, panelA.shade, panelB.shade]
    .forEach((el) => el.addEventListener("input", onControl));
[panelA.weather, panelB.weather].forEach((el) => el.addEventListener("change", onControl));
window.addEventListener("resize", update);

// Redraw when the light/dark mode or the colour style changes
new MutationObserver(update).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-palette"],
});

// ---------- Opening a feature from the Features page ----------
// A link such as /simulator?feature=shading scrolls to that control, highlights it and shows a hint.

const FEATURES = {
    "angle": { target: "tilt-a", hint: "Panel angle: drag the tilt slider and watch the panel and the output change." },
    "intensity": { target: "intensity", hint: "Sunlight intensity: lower the slider to see a dimmer sun give less power." },
    "weather": { target: "weather-a", hint: "Weather: choose sunny, partly cloudy or cloudy and watch the weather factor change the output." },
    "shading": { target: "shade-a", shade: true, hint: "Shading: shade is now included. Drag the shade slider and see a dark cover grow over the panel while the output falls. Use the Shade button at the top to remove it again." },
    "comparison": { target: "compare-section", mode: "two", hint: "Two-panel comparison: change Panel A and Panel B differently and read the comparison below." },
    "live-graph": { target: "live-section", hint: "Live graph: move any slider and watch the line follow the output. Use Pause to freeze it." },
    "best-angle": { target: "curve-section", hint: "Best-angle curve: the highest point is the best tilt for the sun height you chose." },
    "experiments": { target: "experiment-section", hint: "Experiment mode: press Run on an experiment, then Save result, and Solar Lab writes the comparison." },
    "lambert": { target: "formula-note", hint: "Lambert's cosine law: every output on this page comes from this formula. Look at the angle \u03B8 readout as you tilt a panel." },
    "bar-graphs": { target: "graphs-section", hint: "Bar graphs: they redraw whenever you change a setting." },
    "colour-styles": { target: "palette", hint: "Colour styles: open the menu and pick one. The whole site and the scene change together." },
    "light-dark": { target: "theme-toggle", hint: "Light and dark themes: the theme was just switched. Press the button to switch back." },
};

const featureHint = document.getElementById("feature-hint");
document.getElementById("feature-hint-close").addEventListener("click", () => { featureHint.hidden = true; });

function openFeature(name) {
    if (!Object.prototype.hasOwnProperty.call(FEATURES, name)) return;
    const f = FEATURES[name];

    if (f.mode) setMode(f.mode);
    if (f.shade) setShade(true);                    // the shade slider is hidden until shade is included
    if (name === "light-dark") document.getElementById("theme-toggle").click();

    const el = document.getElementById(f.target);
    if (!el) return;
    const box = el.closest(".control") || el;

    featureHint.querySelector("p").textContent = f.hint;
    featureHint.hidden = false;

    box.scrollIntoView({ behavior: "smooth", block: "center" });
    box.classList.add("spotlight");
    setTimeout(() => box.classList.remove("spotlight"), 3500);
}

// ---------- Start ----------

renderResults();
setMode(isOnePanel() ? "one" : "two");      // match the buttons to the saved choice and draw once
openFeature(new URLSearchParams(window.location.search).get("feature"));