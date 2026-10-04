# Lighting reference and reconstruction

Five fixtures extend the catalog to 88 pieces. Inspected the unboxed images on the community pages below; these are reconstructions, not extracted game models or live-game measurements.

| Item and source | Estimated bounds (studs X/Y/Z) | Visible design |
| --- | --- | --- |
| [Lamp](https://lumber-tycoon-2.fandom.com/wiki/Lamp) | 2 / 3 / 2 | Blue tapered fabric shade, short pale pole, circular base, bulb and switch |
| [Floor Lamp](https://lumber-tycoon-2.fandom.com/wiki/Floor_Lamp) | 2.4 / 6 / 2.4 | Red tapered fabric shade, tall pole, stepped circular base |
| [Wall Light](https://lumber-tycoon-2.fandom.com/wiki/Wall_Light) | 1.5 / 2 / 2 | Vertical gray cylinder, rear mounting plate, dark underside and downward bulb |
| [Floodlight](https://lumber-tycoon-2.fandom.com/wiki/Floodlight) | 3.4 / 2.8 / 2.6 | Paired downward/outward cylindrical heads and rear mount |
| [Worklight](https://lumber-tycoon-2.fandom.com/wiki/Worklight) | 3 / 3 / 2.4 | Yellow tubular U stand with curved elbows, side pivots, tilted black bezel, recessed white reflector, separate horizontal tube and sockets, top grip |

All dimensions carry the approximate marker in the UI. Shade weave is an authored repeating texture. Colors, switch details, light intensity/range and reflector geometry are estimates. The Wall Light page describes a reversed indicator convention; that detail is not live-verified, and this simulator consistently uses green for enabled and red for disabled fixtures. The Worklight remains an anchored editable object rather than a loose physics object. Logic wiring is not implemented.

## Editing and illumination

Fixed finishes ignore wood edits. Light on/off state survives single/group copies, straight drag, undo/redo, export/import and browser saves. Older records without a state default to on. Select placed lights to change Light on; mixed selections affect only lights. Night preview is a session setting.

All enabled bulbs remain emissive. Real illumination is limited to two nearby point emitters and four nearby spot emitters, selected from indexed lighting chunks within 64 studs and faded from 48 to 64 studs. A Floodlight uses two spot slots. This bounds renderer light count regardless of stored fixtures; it does not guarantee illumination from every fixture simultaneously. Shadow maps are cached at 256 pixels, refreshed for scene/light changes, and disabled in Performance quality. No new large-scene FPS claim is made.

The Worklight reflector is recessed in front of its rear housing so the yellow housing cannot cover the reflector. Curved stand elbows use convex collision proxies; open shade/reflector surfaces use thin shell collision. Fine visual and collision matching to live LT2 remains unverified.
