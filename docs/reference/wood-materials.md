# Classic wood material references

Updated 2026-10-03. The scene uses authentic, unmodified **pre-2022 Roblox base-material texture PNGs**, with the existing Lumber Tycoon 2 wood colors. These replace the former generated stripe texture. This is a Three.js approximation of the classic appearance, not a pixel-identical reproduction of Roblox's material shader or a live LT2 client capture.

## Sources

- [Roblox Creator Hub: Materials, pre-2022 base-material asset table](https://create.roblox.com/docs/parts/materials#base-materials), also available as [complete Markdown](https://create.roblox.com/docs/en-us/parts/materials.md). Roblox explicitly notes that its base-material shader differs from the material-variant shader even when sharing textures.
- [Roblox texture specifications](https://create.roblox.com/docs/art/modeling/texture-specifications) identify the normals as OpenGL tangent-space data. They are used with Three.js's positive normal scale without inverting the green channel.
- [LT2 wood category and material/color table](https://lumber-tycoon-2.fandom.com/wiki/Category%3AWood); individual references: [Oak](https://lumber-tycoon-2.fandom.com/wiki/Oak_Wood), [Frost](https://lumber-tycoon-2.fandom.com/wiki/Frost_Wood), [Phantom](https://lumber-tycoon-2.fandom.com/wiki/Phantom_Wood). These describe game material assignments; they are community reference data, not a claim of direct access to LT2 source.

The source assets belong to Roblox and retain their original provenance; this project does not claim authorship or a new license for them. `public/textures/manifest.json` records exact asset IDs, dimensions, byte sizes, SHA-256 checksums, and download URLs. All five PNGs are copied unchanged from those URLs.

| Local texture | Roblox asset ID | Dimensions | Use |
| --- | --- | --- | --- |
| classic-wood-color.png | 7547190453 | 1024 × 1024 | Shared color map for Wood species |
| classic-wood-normal.png | 7547190548 | 512 × 512 | Shared surface relief for Wood species |
| classic-granite-color.png | 7547164400 | 1024 × 1024 | Spooky / Granite |
| classic-ice-normal.png | 7547171198 | 512 × 512 | Frost / Ice |
| classic-foil-normal.png | 7546644903 | 512 × 512 | Phantom / Foil |

Granite's published normal map `7546654648` is a flat 4 × 4 normal. Ice and Foil's shared color map `7546644642` is plain white at 4 × 4. Those constant maps are omitted from GPU sampling. Scalar roughness and metalness replace additional maps to keep the shader and texture budget small.

## Species mapping and color

Oak, Elm, Birch, Walnut, Cherry, Koa, Fir, Pine, Palm, Volcano, Gold, Zombie, Blue Spruce, and Sign use the same classic Wood maps tinted by their individual catalog colors. Spooky uses Granite. Frost uses Ice. Phantom uses Foil. Cavecrawler and Sinister remain smooth and emissive; Snowglow remains smooth yellow without emission.

Catalog hexadecimal colors are interpreted as sRGB by Three.js and converted to linear working color. Color textures are explicitly tagged sRGB; normal maps remain untagged linear data. The source wood texture is neutral gray, so it modulates each species' color without adding a second brown tint. Display lighting and tone mapping still affect the final on-screen color.

## Mapping and rendering choices

- UVs are baked once per component into shared catalog geometry, before components merge. Instances do not clone textures or update UVs every frame.
- One source tile spans **eight studs**, an approximation chosen for readable classic grain. Every face, including wedge slopes and angled cabinet faces, uses an orthonormal surface projection with consistent texel density instead of stretching one image over the entire shape.
- The source wood grain runs along U. U follows each component's longest axis projected onto its surface. Rail grain runs along rails and post grain along posts; end faces use the next available axis. Separate botanical end-grain artwork is not fabricated.
- Mipmaps and up to 4× anisotropy reduce shimmer at oblique angles. Color textures stay at 1024² and normals at 512². The five shared images total about 1.90 MiB compressed and approximately 14.7 MiB of RGBA GPU storage including mipmaps per WebGL renderer, independent of piece count.
- Roughness is 0.78 for Wood/Granite/smooth materials, 0.22 for Ice, and 0.32 for Foil. Foil metalness is 0.35; other kinds use zero. Smooth glowing kinds have emission intensity 0.4. These are lighting approximations, not extracted LT2 shader parameters. There is no extra bloom pass.
- Startup awaits the shared image pool before constructing the scene and its thumbnail renderer, so thumbnails and the viewport use the same fully loaded Oak maps. Assets are bundled locally; running the app requires no Roblox request.

`tests/texture-core.test.ts` checks finite, nondegenerate UVs, equal per-stud density across every catalog triangle, grain orientation, and cache reuse. `tests/materials.spec.ts` checks loaded/shared maps, material assignments, color-space settings, smooth/emissive exceptions, five image requests, and error-free rendering of all species. These checks do not constitute visual acceptance inside the actual Roblox client.
