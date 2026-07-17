function scaleValue(value, min, max, outMin, outMax) {
  if (max === min) return (outMin + outMax) / 2;
  return outMin + ((value - min) / (max - min)) * (outMax - outMin);
}

function formatAxisValue(value) {
  return `${Math.round(value).toLocaleString("fr-FR")}€`;
}

function emptyChart(height) {
  return `<div class="chart-wrap" style="height:${height}px"><div class="chart-empty-msg">Pas encore de données.</div></div>`;
}

function labelEl(text, topPct) {
  return `<span class="chart-axis-label" style="top:${topPct.toFixed(2)}%">${text}</span>`;
}

function hlineEl(topPct) {
  return `<div class="chart-hline" style="top:${topPct.toFixed(2)}%"></div>`;
}

// Plot coordinates are in a local "0..height" space that only spans the plot
// area (left gutter for labels is handled by CSS positioning, not the SVG
// viewBox). This keeps text out of the SVG entirely, so it never gets
// stretched by the non-uniform scaling that `preserveAspectRatio="none"`
// applies when the container width doesn't match the viewBox width.
const PLOT_WIDTH = 600;

export function lineChart(points, { height = 160, color = "var(--agency-color)" } = {}) {
  if (points.length === 0) return emptyChart(height);

  const padding = 12;
  const plotTop = padding;
  const plotBottom = height - padding;

  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const yFor = (value) => plotBottom - scaleValue(value, min, max, 0, plotBottom - plotTop);

  const stepX = points.length > 1 ? PLOT_WIDTH / (points.length - 1) : 0;
  const coords = points.map((p, i) => [i * stepX, yFor(p.value)]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${plotBottom} L${coords[0][0].toFixed(1)},${plotBottom} Z`;
  const gradientId = `lineFill-${Math.round(Math.random() * 1e6)}`;

  const zeroY = yFor(0);
  const labels = [labelEl(formatAxisValue(max), (plotTop / height) * 100)];
  if (min < 0) labels.push(labelEl(formatAxisValue(min), (plotBottom / height) * 100));
  labels.push(labelEl("0€", (zeroY / height) * 100));

  return `
    <div class="chart-wrap" style="height:${height}px">
      <div class="chart-axis-labels">${labels.join("")}</div>
      <div class="chart-plot-area">
        <div class="chart-hlines">${hlineEl((zeroY / height) * 100)}</div>
        <svg viewBox="0 0 ${PLOT_WIDTH} ${height}" preserveAspectRatio="none" class="chart-svg">
          <defs>
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="${color}" stop-opacity="0.35"/>
              <stop offset="1" stop-color="${color}" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="${areaPath}" fill="url(#${gradientId})" stroke="none"/>
          <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        </svg>
      </div>
    </div>`;
}

export function barChart(bars, { height = 160, trend = null, barGapRatio = 0.3 } = {}) {
  if (bars.length === 0) return emptyChart(height);

  const padding = 12;
  const plotTop = padding;
  const plotBottom = height - padding;
  const midY = (plotTop + plotBottom) / 2;
  const halfHeight = midY - plotTop;

  const maxValue = Math.max(1, ...bars.flatMap((b) => [b.income, b.expenses]));
  const groupWidth = PLOT_WIDTH / bars.length;
  const barWidth = Math.max(1, groupWidth * (1 - barGapRatio));

  const rects = bars
    .map((bar, i) => {
      const x = i * groupWidth + (groupWidth - barWidth) / 2;
      const incomeH = scaleValue(bar.income, 0, maxValue, 0, halfHeight);
      const expenseH = scaleValue(bar.expenses, 0, maxValue, 0, halfHeight);
      return `
        <rect x="${x.toFixed(1)}" y="${(midY - incomeH).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${incomeH.toFixed(1)}" fill="var(--good)" rx="2"/>
        <rect x="${x.toFixed(1)}" y="${midY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${expenseH.toFixed(1)}" fill="var(--danger)" rx="2"/>`;
    })
    .join("");

  const hoverZones = bars
    .map((bar, i) => {
      if (!bar.tooltip) return "";
      const leftPct = ((i * groupWidth) / PLOT_WIDTH) * 100;
      const widthPct = (groupWidth / PLOT_WIDTH) * 100;
      return `
        <div class="chart-hover-zone" style="left:${leftPct.toFixed(2)}%; width:${widthPct.toFixed(2)}%">
          <div class="chart-tooltip">${bar.tooltip}</div>
        </div>`;
    })
    .join("");

  let trendSvg = "";
  if (trend && trend.length > 1) {
    const trendMax = Math.max(maxValue, ...trend.map((p) => Math.abs(p.value)));
    const stepX = PLOT_WIDTH / bars.length;
    const trendCoords = trend.map((p, i) => {
      const x = i * stepX + stepX / 2;
      const y = midY - scaleValue(p.value, -trendMax, trendMax, -halfHeight, halfHeight);
      return [x, y];
    });
    const trendPath = trendCoords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    trendSvg = `<path d="${trendPath}" fill="none" stroke="var(--agency-color)" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="round"/>`;
  }

  const labels = [
    labelEl(formatAxisValue(maxValue), (plotTop / height) * 100),
    labelEl("0€", (midY / height) * 100),
    labelEl(`-${formatAxisValue(maxValue)}`, (plotBottom / height) * 100),
  ];

  return `
    <div class="chart-wrap" style="height:${height}px">
      <div class="chart-axis-labels">${labels.join("")}</div>
      <div class="chart-plot-area">
        <div class="chart-hlines">${hlineEl((midY / height) * 100)}</div>
        <svg viewBox="0 0 ${PLOT_WIDTH} ${height}" preserveAspectRatio="none" class="chart-svg">${rects}${trendSvg}</svg>
        <div class="chart-hover-layer">${hoverZones}</div>
      </div>
    </div>`;
}
