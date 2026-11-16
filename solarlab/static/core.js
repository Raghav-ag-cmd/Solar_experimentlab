// Shared code used by the simulator page and the home page:
// the maths, the weather table, colour reading and the chart drawing.

const P_MAX = 100;          // rated power of the panel in watts

// Weather: factor = how much of the sunlight gets through (assumed values for the demo).
// dim, clouds and cover only change how the scene is drawn.
const WEATHER = {
    sunny: { label: "Sunny", factor: 1.0, dim: 0, cover: 0, clouds: [] },
    partly: { label: "Partly cloudy", factor: 0.6, dim: 0.15, cover: 0.7, clouds: [[300, 70, 0.9], [400, 120, 0.6]] },
    cloudy: { label: "Cloudy", factor: 0.25, dim: 0.45, cover: 1.3, clouds: [[280, 55, 1.1], [100, 50, 0.9], [390, 110, 0.9], [190, 105, 0.8]] },
};

// ---------- Maths ----------

function degToRad(deg) {
    return deg * Math.PI / 180;
}

// Angle between the sunlight and the line pointing straight out of the panel
function calcTheta(tilt, sunHeight) {
    return Math.abs((90 - tilt) - sunHeight);
}

// Lambert's cosine law with a weather factor, a sunlight intensity and shading:
// P = Pmax x weather x intensity x (1 - shade) x cos(theta), and 0 if the light misses the front of the panel.
// intensity goes from 0 to 1 and shade from 0 (none) to 1 (fully covered).
// The last two have defaults, so calcPower(tilt, sun, weather) still works on the home page.
function calcPower(tilt, sunHeight, weatherFactor = 1, intensity = 1, shade = 0) {
    const theta = calcTheta(tilt, sunHeight);
    if (theta >= 90) {
        return 0;
    }
    return P_MAX * weatherFactor * intensity * (1 - shade) * Math.cos(degToRad(theta));
}

// ---------- Colours (read from the CSS so every colour style works) ----------

function readColors() {
    const style = getComputedStyle(document.documentElement);
    const v = (name) => style.getPropertyValue(name).trim();
    return {
        sky1: v("--sky-1"), sky2: v("--sky-2"),
        ground1: v("--ground-1"), ground2: v("--ground-2"),
        panel1: v("--panel-1"), panel2: v("--panel-2"),
        accent: v("--accent"), accent2: v("--accent-2"),
        text: v("--text"), muted: v("--muted"), line: v("--line"),
    };
}

// ---------- Bar chart ----------
// Each bar's height = (value / maxValue) x height of the plot area.
// "highlight" is the index of the bar drawn in the second accent colour (-1 for none).

function barChart(id, labels, values, highlight, maxValue = P_MAX) {
    const cv = document.getElementById(id);
    if (!cv) return;
    const c = readColors();
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return;

    cv.width = Math.round(w * dpr);     // sharper on phones and high-resolution screens
    cv.height = Math.round(h * dpr);
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const left = 38, right = 8, top = 22, bottom = 30;
    const plotW = w - left - right;
    const plotH = h - top - bottom;
    const slot = plotW / values.length;
    const barW = slot * 0.62;

    g.font = '12px "Segoe UI", system-ui, sans-serif';

    // grid lines and axis numbers at 0, half and the maximum
    g.textAlign = "right";
    g.textBaseline = "middle";
    for (const level of [0, maxValue / 2, maxValue]) {
        const y = top + plotH - (level / maxValue) * plotH;
        g.strokeStyle = c.line;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(left, y);
        g.lineTo(w - right, y);
        g.stroke();
        g.fillStyle = c.muted;
        g.fillText(Math.round(level), left - 6, y);
    }

    // bars, value labels and x labels
    values.forEach((value, i) => {
        const x = left + i * slot + (slot - barW) / 2;
        const barH = (value / maxValue) * plotH;
        const y = top + plotH - barH;

        g.fillStyle = i === highlight ? c.accent2 : c.accent;
        g.beginPath();
        if (g.roundRect) {
            g.roundRect(x, y, barW, barH, [6, 6, 0, 0]);
        } else {
            g.rect(x, y, barW, barH);
        }
        g.fill();

        g.textAlign = "center";
        g.textBaseline = "bottom";
        g.fillStyle = c.text;
        g.fillText(Math.round(value), x + barW / 2, y - 3);

        g.textBaseline = "top";
        g.fillStyle = c.muted;
        g.fillText(labels[i], x + barW / 2, top + plotH + 8);
    });
}

// ---------- Grouped bar chart (two series side by side) ----------
// Series A uses the first accent colour and series B the second, like the Panel A / Panel B cards.

function groupedBarChart(id, labels, seriesA, seriesB, maxValue = P_MAX) {
    const cv = document.getElementById(id);
    if (!cv) return;
    const c = readColors();
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return;

    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const left = 38, right = 8, top = 26, bottom = 30;
    const plotW = w - left - right;
    const plotH = h - top - bottom;
    const slot = plotW / labels.length;
    const barW = slot * 0.34;

    g.font = '12px "Segoe UI", system-ui, sans-serif';

    // grid lines and axis numbers
    g.textAlign = "right";
    g.textBaseline = "middle";
    for (const level of [0, maxValue / 2, maxValue]) {
        const y = top + plotH - (level / maxValue) * plotH;
        g.strokeStyle = c.line;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(left, y);
        g.lineTo(w - right, y);
        g.stroke();
        g.fillStyle = c.muted;
        g.fillText(Math.round(level), left - 6, y);
    }

    // two bars per label
    labels.forEach((label, i) => {
        const groupX = left + i * slot + (slot - 2 * barW - 2) / 2;
        [[seriesA[i], c.accent, 0], [seriesB[i], c.accent2, barW + 2]].forEach(([value, colour, shift]) => {
            const barH = (value / maxValue) * plotH;
            g.fillStyle = colour;
            g.beginPath();
            if (g.roundRect) {
                g.roundRect(groupX + shift, top + plotH - barH, barW, barH, [4, 4, 0, 0]);
            } else {
                g.rect(groupX + shift, top + plotH - barH, barW, barH);
            }
            g.fill();
        });
        g.textAlign = "center";
        g.textBaseline = "top";
        g.fillStyle = c.muted;
        g.fillText(label, left + i * slot + slot / 2, top + plotH + 8);
    });

    // legend
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillStyle = c.accent;
    g.fillRect(left, 6, 10, 10);
    g.fillStyle = c.text;
    g.fillText("Panel A", left + 15, 11);
    g.fillStyle = c.accent2;
    g.fillRect(left + 75, 6, 10, 10);
    g.fillStyle = c.text;
    g.fillText("Panel B", left + 90, 11);
}

// ---------- Line chart (the live graph and the best-angle curve) ----------
// series: a list of { name, color, values } where color is "accent" or "accent2".
// opts:
//   count   - how many x positions the chart has room for (default: the longest series).
//             A shorter series is drawn against the right-hand edge, so new points slide in from the right.
//   xTicks  - a list of [index, label] pairs written under the x axis.
//   markers - a list of { index, color } drawn as dashed vertical lines (index may be a decimal).
//   peaks   - true to put a dot and the value on the highest point of each series.
// A point's x position = left edge + (index / (count - 1)) x width of the plot area.
// A point's y position = bottom edge - (value / maxValue) x height of the plot area.

function lineChart(id, series, opts = {}) {
    const cv = document.getElementById(id);
    if (!cv) return;
    const c = readColors();
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return;

    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const maxValue = opts.maxValue || P_MAX;
    const count = opts.count || Math.max(1, ...series.map((s) => s.values.length));
    // room above the plot for the legend and the peak labels so they never overlap
    const crowded = series.length > 1 || opts.peaks;
    const left = 38, right = 14, top = crowded ? 46 : 26, bottom = 30;
    const plotW = w - left - right;
    const plotH = h - top - bottom;
    const xAt = (i) => left + (count > 1 ? i / (count - 1) : 0.5) * plotW;
    const yAt = (v) => top + plotH - (Math.min(Math.max(v, 0), maxValue) / maxValue) * plotH;

    g.font = '12px "Segoe UI", system-ui, sans-serif';

    // grid lines and axis numbers at 0, half and the maximum
    g.textAlign = "right";
    g.textBaseline = "middle";
    for (const level of [0, maxValue / 2, maxValue]) {
        const y = yAt(level);
        g.strokeStyle = c.line;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(left, y);
        g.lineTo(w - right, y);
        g.stroke();
        g.fillStyle = c.muted;
        g.fillText(Math.round(level), left - 6, y);
    }

    // x axis labels
    g.textBaseline = "top";
    g.fillStyle = c.muted;
    (opts.xTicks || []).forEach(([index, label]) => {
        g.textAlign = index <= 0 ? "left" : (index >= count - 1 ? "right" : "center");
        g.fillText(label, xAt(index), top + plotH + 8);
    });

    // dashed marker lines (for example "your tilt")
    (opts.markers || []).forEach((m) => {
        g.save();
        g.setLineDash([5, 5]);
        g.strokeStyle = c[m.color];
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(xAt(m.index), top);
        g.lineTo(xAt(m.index), top + plotH);
        g.stroke();
        g.restore();
    });

    // the lines
    series.forEach((s) => {
        const n = s.values.length;
        if (!n) return;
        const offset = count - n;
        g.strokeStyle = c[s.color];
        g.fillStyle = c[s.color];
        g.lineWidth = 2.5;
        g.lineJoin = "round";
        g.lineCap = "round";
        g.beginPath();
        s.values.forEach((v, i) => {
            if (i === 0) g.moveTo(xAt(offset + i), yAt(v));
            else g.lineTo(xAt(offset + i), yAt(v));
        });
        g.stroke();

        // a single point has no line, so draw a dot
        if (n === 1) {
            g.beginPath();
            g.arc(xAt(offset), yAt(s.values[0]), 3.5, 0, 2 * Math.PI);
            g.fill();
        }

        // the highest point, with its value
        if (opts.peaks) {
            const best = Math.max(...s.values);
            if (best > 0) {
                const at = s.values.indexOf(best);
                g.beginPath();
                g.arc(xAt(offset + at), yAt(best), 5, 0, 2 * Math.PI);
                g.fill();
                g.textAlign = "center";
                g.textBaseline = "bottom";
                g.fillStyle = c.text;
                g.fillText(best.toFixed(1), xAt(offset + at), Math.max(yAt(best) - 8, 34));
            }
        }
    });

    // legend (top right, only when there is more than one line)
    if (series.length > 1) {
        g.textAlign = "left";
        g.textBaseline = "middle";
        series.forEach((s, i) => {
            const x = left + i * 80;
            g.fillStyle = c[s.color];
            g.fillRect(x, 6, 10, 10);
            g.fillStyle = c.text;
            g.fillText(s.name, x + 15, 11);
        });
    }
}