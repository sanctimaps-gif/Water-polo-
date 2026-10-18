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

## Sculpted body (current)

`tools/assets/sculpt/` builds `web/assets/body/body.{json,bin}` from the sculpted model "Male body" by Chin Eeyang
(Sketchfab, CC BY 4.0; credit in the game's settings and in `web/assets/body/LICENSE.txt`), supplied by the
project owner. Put `scene.gltf` + `scene.bin` in `tools/assets/src/male_body/` and the previous MakeHuman build
(`body_mh.json` / `body_mh.bin`, output of `prep_body.mjs`) next to the scripts, then run in order:
`python3 dec.py` (decimate) → `align.py` → `joints.py` → `brief.py` (smooth pelvis under the suit) → `build.py`.
