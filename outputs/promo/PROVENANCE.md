# TubeShelf 1.18.3 promo exports

## Deliverables

- `TubeShelf-1.18.3-intro.mp4` — 1280×720, 42.000 seconds, H.264 MP4, silent.
- `TubeShelf-1.18.3-preview.gif` — 800×450, 8.740 seconds, looping GIF.
- `TubeShelf-1.18.3-poster.png` — 1280×720 poster frame.
- `manifest.json` — output dimensions, duration, byte size, SHA-256, and exact store URL.

## Content and privacy

All channel names, video titles, group counts, avatars, and thumbnail artwork are fictional mock data. No personal YouTube account or browsing data was recorded. The interface is a deterministic canvas recreation based on TubeShelf 1.18.3's shipped colors, controls, and current feature set.

The end card uses this exact destination:

`https://chromewebstore.google.com/detail/agnnbehkdkdkflknblhkmgciaekngole?utm_source=item-share-cb`

## Reproduction

From the repository root, with the bundled Node modules and Python/Pillow available:

```powershell
$env:NODE_PATH='C:\Users\JSrad\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:CODEX_PYTHON='C:\Users\JSrad\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
node scripts/render-promo.cjs
```

The renderer uses WebCodecs with explicit 30 fps timestamps and a deterministic MP4 container. The GIF is built from 108 deterministic source frames and optimized by Pillow; identical frames may be consolidated in the final GIF.

## Verification performed

- MP4 loaded in Microsoft Edge as a complete in-memory Blob: 1280×720, 42.000 seconds, seekable from 0 to 42 seconds.
- Encoded MP4 frames visually checked at 1, 12, 19, 26, 33, and 40 seconds.
- GIF reopened with Pillow: 800×450, 73 optimized frames, 8.740 seconds, infinite loop.
- GIF beginning, midpoint, and final transition frames visually checked.
