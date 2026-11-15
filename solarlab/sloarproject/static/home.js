// Graphs on the home page. They use the same formula as the simulator
// (a 100 W panel in full sunlight) and need no sliders.

function drawHomeCharts() {
    const angles = [0, 15, 30, 45, 60, 75, 90];
    const angleLabels = angles.map((a) => a + "\u00B0");
    const weatherKeys = Object.keys(WEATHER);

    // 1. Lambert's cosine law: percent of full power at each angle theta
    barChart("home-cos", angleLabels,
        angles.map((a) => P_MAX * Math.cos(degToRad(a))), -1);

    // 2. weather: a panel aimed straight at the sun (theta = 0)
    barChart("home-weather", weatherKeys.map((k) => WEATHER[k].label),
        weatherKeys.map((k) => calcPower(45, 45, WEATHER[k].factor)), -1);
}

window.addEventListener("resize", drawHomeCharts);
new MutationObserver(drawHomeCharts).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-palette"],
});

drawHomeCharts();