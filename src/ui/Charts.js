/** Tiny dependency-free line chart for analytics time-series. */
export function drawLineChart(canvas, series, { color = '#5ec8f2', min = null, max = null, fill = true } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 280, h = canvas.clientHeight || 110;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!series.length) {
    ctx.fillStyle = 'rgba(130,150,171,.5)';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('collecting data…', w / 2, h / 2);
    return;
  }
  let lo = min ?? Math.min(...series), hi = max ?? Math.max(...series);
  if (hi - lo < 1e-6) { hi = lo + 1; lo = Math.max(0, lo - 1); }
  const pad = 6;
  const px = i => pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2);
  const py = v => h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2);

  // grid lines
  ctx.strokeStyle = 'rgba(140,170,200,.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let g = 0; g <= 3; g++) { const y = pad + (g / 3) * (h - pad * 2); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); }
  ctx.stroke();

  // area fill
  if (fill) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '44');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px(0), h - pad);
    series.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(series.length - 1), h - pad);
    ctx.closePath(); ctx.fill();
  }
  // line
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  series.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
  ctx.stroke();
  // min/max labels
  ctx.fillStyle = 'rgba(130,150,171,.7)';
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(hi.toFixed(hi >= 100 ? 0 : 1), pad + 1, pad + 8);
  ctx.fillText(lo.toFixed(lo >= 100 ? 0 : 1), pad + 1, h - pad - 2);
}
