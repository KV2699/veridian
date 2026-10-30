# Handoff: re-render the demo video properly

The current `auspius-demo.mp4` is soft, artefacted and drifts out of sync.
Do not try to clean it up — it has to be re-rendered by a different method.

## What is wrong, measured

| | value | should be |
|---|---|---|
| Playwright capture (VP8) | **736 kbps** at 1920x1080 | — |
| Final MP4 (H.264) | **1,069 kbps** at 1920x1080 | 8,000–12,000 kbps |
| Frame rate | 25fps source, output forced to 30 | native, no conversion |

Two separate faults:

**1. The capture method.** It was recorded with Playwright's `recordVideo`,
which is a CDP screencast — heavily compressed VP8 at roughly a tenth of the
bitrate 1080p text needs. Re-encoding to H.264 afterwards cannot recover
detail the capture never had, so the output inherits the mush and adds a
generation of loss. Text and thin acid rules are the worst case for it.

**2. Realtime drift.** Recording slows the page, so 169.2s of film took 174.1s
of wall time. That was corrected with a single `setpts=PTS/1.029` ratio — but
the lag is not uniform, so one linear correction cannot fix a non-linear
slowdown. Audio and picture pull apart and come back across the run, and the
25→30fps conversion adds judder on top.

## The fix: render deterministically, do not record

Do not capture in realtime at all. The film's clock is drivable from script,
so render it frame by frame and assemble:

1. Serve the film board locally (see **Assets** below).
2. Open it in Playwright at 1920x1080, `deviceScaleFactor: 1`.
3. Strip the page to the stage — this part of the existing recorder is correct,
   reuse it verbatim:
   ```
   html,body{margin:0!important;padding:0!important;background:#061233!important;overflow:hidden!important}
   header,main,footer,.hint,.controls{display:none!important}
   .wrap,.wrap.player{max-width:none!important;margin:0!important;padding:0!important}
   #stage{position:fixed!important;inset:0!important;width:1920px!important;height:1080px!important;
     aspect-ratio:auto!important;border:0!important;border-radius:0!important}
   #stage .note,#stage .tc{display:none!important}
   ```
   Those last two selectors hide the authoring chips. A judge must never see
   `CAPTURE · 01-SECTOR-CHOOSER` or the timecode.
4. For each frame `n` at 30fps, set the film clock to `n/30` and screenshot
   a PNG. The page exposes `paint(frame)` and the film JSON; pause the audio
   element and drive `aud.currentTime` directly rather than letting it play, so
   the clock is exact and nothing depends on wall time:
   ```js
   await p.evaluate((t) => {
     const aud = document.getElementById('aud');
     aud.pause();
     aud.currentTime = Math.max(0, t - PREROLL);
     cur = -1;              // force a repaint
     render();
   }, n / 30);
   await p.screenshot({ path: `frames/${String(n).padStart(5,'0')}.png` });
   ```
   169.2s x 30fps = **5,076 frames**. Expect 15–25 minutes.
5. Assemble at a bitrate that suits text, and mux the audio with the 1.4s
   brand-flash offset:
   ```
   ffmpeg -y -framerate 30 -i frames/%05d.png \
     -itsoffset 1.4 -i audio/narration-full.mp3 \
     -filter_complex "[1:a]apad[a]" -map 0:v:0 -map "[a]" -t 169.2 \
     -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
     -c:a aac -b:a 192k -movflags +faststart auspius-demo.mp4
   ```
   `-crf 16` on a clean PNG source gives roughly 10–15 Mbps here. Do not use
   `-shortest`: it cuts the 6.2s close off.

Because every frame is rendered at a known timestamp, sync is exact by
construction. There is no drift to correct and no `setpts` needed.

**Two animations will not survive frame-stepping**, because they are CSS
animations driven by wall time rather than by the film clock: the 1.45s orbit
on the first capture, and the light leaks. Either accept them as static in the
render, or drive them explicitly by setting `animation-delay` to a negative
value derived from the frame time and `animation-play-state: paused` — the
same trick `freeze.mjs` in the scratchpad uses. The orbit matters more than
the leaks.

## The other sync problem, which this does not fix

Frame *timings* are a separate issue and are still wrong. They were never
forced-aligned — see `AUDIO-SYNC-HANDOFF.md` in this repo. Frames land slightly
off the words they illustrate, and a perfect render will show that more
clearly, not less. Do `AUDIO-SYNC-HANDOFF.md` first if there is time; the
render is worth doing either way.

## Assets

| What | Where |
|---|---|
| Film board HTML | artifact `https://claude.ai/artifact/UWb4SnL8tuNYQ52eJz4qcZ` |
| Narration | `audio/narration-full.mp3` (2:41) |
| Captures | the artifact's `img/` — also `public/shots/` in this repo |
| Footage clips | the artifact's `footage/` |
| Existing recorder | scratchpad `record.mjs` — reuse the CSS, replace the capture |

The board needs `audio/narration.mp3`, `img/*` and `footage/*` served
alongside `index.html`, or frames silently fall back.

## Verify before shipping

- `ffprobe` the output: 1920x1080, 30fps, video bitrate **above 8,000 kbps**.
- Watch the first 20 seconds full-screen. Type must be crisp, no mosquito
  noise around the acid rules.
- Check the close is present: it must end on the acid **Thank you — Kerrie
  Vincent** card, not mid-sentence.
- Check three sync points by ear: "Disney's environmental sustainability
  co-lead", the word "Tavily", and the word "Nemotron".
- Under 3:00. Current film is 2:49.
