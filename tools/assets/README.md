# Player assets (realistic head and body)

Run from the repository root after downloading the sources into `tools/assets/src/` (not committed):

| File | Source | Licence |
|---|---|---|
| `lps.glb`, `Map-COL.jpg`, `Map-SPEC.jpg`, `Infinite-Level_02_Tangent_SmoothUV.jpg` | three.js r160 `examples/models/gltf/LeePerrySmith/` — head scan "Lee Perry-Smith" by Infinite-Realities | Creative Commons Attribution 3.0 |
| `base.obj`, `*.target` (macrodetails) | MakeHuman `makehuman/data/3dobjs/base.obj` and `makehuman/data/targets/macrodetails/` | CC0 1.0 |

```
node tools/assets/prep_head.mjs   # -> web/assets/head/head.bin (cropped under the cap, metres, head-bone space)
node tools/assets/prep_body.mjs   # -> web/assets/body/body.json + body.bin (3 builds, joints, 4-bone skin weights, suit mask)
```

Textures (`web/assets/head/skin_*.jpg`) are the scan maps: colour (lip redness reduced), tangent normal map,
roughness derived from the specular map (512 px).
