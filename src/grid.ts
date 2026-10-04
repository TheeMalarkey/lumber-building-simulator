// Analytic antialiasing keeps line widths in screen pixels. Fade each axis
// separately when its cells become subpixel, avoiding shimmer at grazing angles.
export const GRID_FRAGMENT = `
varying vec2 vPos;
uniform vec3 uColor;
uniform vec2 uCamera;
uniform float uStep;
uniform float uMajorStep;
uniform float uMajorOffset;
uniform float uPlots[25];

float gridLine(vec2 p, float width) {
  vec2 footprint = max(fwidth(p), vec2(0.00001));
  vec2 distancePx = abs(fract(p - 0.5) - 0.5) / footprint;
  vec2 coverage = 1.0 - smoothstep(vec2(width - 0.5), vec2(width + 0.5), distancePx);
  coverage *= 1.0 - smoothstep(vec2(0.3), vec2(0.85), footprint);
  return max(coverage.x, coverage.y);
}
void main() {
  // Derivatives must be evaluated before the plot-mask branches.
  float fine = gridLine(vPos / uStep, 0.55);
  float major = gridLine((vPos + uMajorOffset) / uMajorStep, 0.95);
  vec2 cell = floor((vec2(vPos.x, -vPos.y) + 100.0) / 40.0);
  if (any(lessThan(cell, vec2(0.0))) || any(greaterThanEqual(cell, vec2(5.0)))) discard;
  if (uPlots[int(cell.y) * 5 + int(cell.x)] < 0.5) discard;
  float fade = 1.0 - smoothstep(60.0, 220.0, length(vPos - uCamera));
  gl_FragColor = vec4(uColor, max(fine * 0.15, major * 0.28) * fade);
}`;
