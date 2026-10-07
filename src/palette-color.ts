function luminance(hex: string) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map(c => c + c).join('') : value;
  const channels = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

/** Keep palette triggers tied to their selected colors, including mixed groups. */
export function setPaletteColor(element: HTMLElement, colors: readonly string[]) {
  const unique = [...new Set(colors.map(color => color.toLowerCase()))];
  element.classList.toggle('palette-color', unique.length > 0);
  element.classList.toggle('palette-mixed', unique.length > 1);
  if (!unique.length) {
    for (const property of ['--palette-background', '--palette-ink', '--palette-icon-bg'])
      element.style.removeProperty(property);
    return;
  }
  const lightness = unique.reduce((total, color) => total + luminance(color), 0) / unique.length;
  const darkInk = (lightness + .05) / .05 >= 1.05 / (lightness + .05);
  const background = unique.length === 1 ? unique[0] : `linear-gradient(135deg, ${unique.map((color, i) =>
    `${color} ${i * 100 / unique.length}% ${(i + 1) * 100 / unique.length}%`).join(', ')})`;
  element.style.setProperty('--palette-background', background);
  element.style.setProperty('--palette-ink', darkInk ? '#000000' : '#ffffff');
  element.style.setProperty('--palette-icon-bg', darkInk ? '#f8f8f8' : '#111111');
}
