# Handoff: the film's frame timings are approximated, not aligned

## What you are being asked to fix

The narration and the on-screen frames are out of sync. Frames land late
against the words they illustrate. You are being asked to replace an
approximation with a real forced alignment, and to rebuild the frame list from
it.

**Do not re-record anything and do not re-edit the script.** The audio is
final and correct. Only the *timings* are wrong.

---

## Why it is wrong — read this before touching anything

The frame start times were **not** produced by a forced aligner. The cloud
session that built them could not reach HuggingFace (blocked by the
environment's network policy), so it could not run WhisperX, stable-ts, or any
model that emits word-level timestamps. It used Whisper via sherpa-onnx with a
model pulled from GitHub releases, and that build returns **segment-level
timestamps only** — in practice the chunk boundary, not the word time.

So the timings came from this substitute:

1. `ffmpeg silencedetect` found the 93 places the speaker actually pauses,
   giving a list of speech regions with real start/end times.
2. The 450 known script words were then **poured into those regions in order**,
   each word given a share of time proportional to its character count plus a
   bonus for the punctuation after it.

That guarantees two things — no word is ever placed inside a real silence, and
the last word ends at the right time — but it does **not** guarantee that any
individual word lands where it is actually spoken. Inside a long speech region
the error is unbounded, because the model assumes every character takes equal
time, and real speech does not work that way.

**A note on a measurement that looks tempting.** Comparing the alignment
against sherpa-onnx segment starts appears to show a consistent ~1s late bias.
That comparison is confounded: those "segment starts" are 8-second chunk
boundaries, and the first word transcribed in a chunk naturally begins somewhat
after the boundary. Do not use that method to measure your improvement, and do
not trust the ~1s figure. Measure against real word timestamps once you have
them.

Also worth knowing: weighting the punctuation more or less does not fix it.
Values of 3.5 / 2.0 / 1.0 / 0.0 were tried and the error got *worse* as the
bonus was removed. The weighting is not the problem; the absence of real
alignment is.

---

## What to do

### 1. Produce real word timestamps

Run a forced aligner over `audio/narration-full.mp3` using
`audio/SCRIPT-TO-RECORD.txt` as the known transcript. Forced alignment against
a known transcript is much more accurate than open transcription — use it.

Any of these is fine:

- **WhisperX** (`whisperx --align_model WAV2VEC2_ASR_LARGE_LV60K_960H`) — the
  usual choice, gives word-level start/end.
- **stable-ts** (`stable_whisper`) with `regroup=False`.
- **Montreal Forced Aligner** — the most accurate, the most setup.
- Kerrie has a working Whisper environment at `~/Downloads/scribelab` on her
  own machine. That is the fastest route and it is already set up.

Write the result to `audio/word-timings.json` in exactly this shape, one entry
per word, in script order, times in seconds from the start of the audio:

```json
[{"w": "It's", "s": 0.10, "e": 0.32, "p": 0},
 {"w": "Monday", "s": 0.32, "e": 0.61, "p": 0}]
```

`p` is the index of the blank-line-separated paragraph in
`audio/SCRIPT-TO-RECORD.txt` that the word belongs to, counting from 0. The
frame builder uses it to know where one beat ends and the next begins, so it
has to be right. The existing (approximated) `audio/word-timings.json` already
has correct `p` values for all 450 words — if your aligner returns words in
script order, copy `p` across positionally rather than recomputing it.

**Check the word count is still 450** and that the words match the script in
order. If the aligner drops or merges words, fix that before continuing —
a missing word shifts every `p` after it.

### 2. Rebuild the frame list

The builder is `build.py` (reproduced in full at the end of this file). It
reads `words.json`, groups words into frames at sentence ends, and attaches the
mode / capture / spotlight for each beat. Run it against your new timings and
it will emit `film-new.json`.

Two constants matter: `MAXF = 3.4` is the longest a frame may hold, `MINF =
0.85` merges a short trailing fragment back into the line it fell off. Leave
them unless you have a reason.

### 3. Put the frames back in the film

The film is a single published artifact:
**https://claude.ai/artifact/UWb4SnL8tuNYQ52eJz4qcZ**

Inside its HTML there is one line that begins:

```
<script id="film" type="application/json">[ ... ]</script>
```

Replace the JSON array on that line with the contents of `film-new.json`.
Change nothing else on that line and nothing around it.

### 4. Verify

`audit.mjs` in the scratchpad checks frame geometry at six viewport widths
(spotlight inside the picture, label not clipped, capture not cropped,
spotlight not painted under the capture). Run it and expect `clean` at every
width. It has been validated — back a fix out and it correctly fails.

Then watch it with sound and check these five moments specifically. These are
the ones that have to be exact, because the frame *is* the line:

| The words | What must be on screen as they are said |
|---|---|
| "Disney's environmental sustainability co-lead leaves the company" | the aha panel, both verdicts up |
| "To a company selling AI infrastructure, that is bad news" | the NVIDIA verdict lit |
| "To an executive search firm…" | the search verdict lit |
| "Every week, **Tavily** searches the live web" | the Tavily scene, on the word |
| "NVIDIA **Nemotron**, running on Nebius Token Factory" | the two-tier scene, on the word |

The Tavily one matters most. It carries a separate $3,000 prize and the scene
arriving after the name has gone past is the whole point missed.

---

## Things not to change

These were each fixed for a reason and a regression is easy:

- **No wall of cards at the end.** An earlier close showed every capture at
  once in a grid. It was rejected as overbearing and unreadable. The close is
  two frames: the wordmark, then the thank-you card.
- **The first capture arrives on a 1.45s orbit** with the wordmark on its
  reverse. `backface-visibility` does not work on it — `.brw` has
  `overflow:hidden`, which Chromium flattens into a 2D layer inside a
  `preserve-3d` parent, so the front face stays painted and the interface reads
  backwards. The face swap is driven by explicit opacity keyframes instead.
  Leave that alone.
- **`.spot` needs `z-index: 2`.** Without it the dissolve layers (z-index 0 and
  1) paint over every spotlight, and 11 of 18 capture frames silently lose
  their emphasis. The audit catches this.
- **The stack scenes' figures are real** and were read from live accounts. The
  grounding scene shows the actual code from
  `server/agents/collector-base.js` and names `test/grounding.test.mjs`. An
  earlier draft carried an invented snippet; do not reintroduce it. Judges can
  open the file.
- **No region claim on the Token Factory scene.** The console shows
  us-north1 / us-central1; an earlier draft said eu-north1. It is off rather
  than wrong.

---

## Files

| File | What it is |
|---|---|
| `audio/narration-full.mp3` | the finished narration, 2:41, two takes stitched with a 0.42s breath at 110.62s |
| `audio/SCRIPT-TO-RECORD.txt` | the exact 450 words, blank-line separated into 22 beats |
| `audio/word-timings.json` | the current approximated timings — **replace this** |
| `AUDIO-SYNC-HANDOFF.md` | this file |

The film artifact also holds `audio/narration.mp3` (the same audio) and the ten
captures under `img/`.

---

## build.py, in full

```python
import json
W = json.load(open('words.json'))
FO = json.load(open('focus.json'))

# Each paragraph of the script is a beat; a beat says what it is on screen for.
# (mode, asset, focus-key, label) — a list means the beat changes picture partway.
BEAT = {
 0:[('footage','desk-typing-web.mp4',None,None)],
 1:[('footage','busy-office-web.mp4',None,None),('grad',None,None,None)],
 2:[('acid',None,None,None)],
 3:[('footage','commuters-web.mp4',None,None)],
 4:[('acid',None,None,None)],
 5:[('screen','01-sector-chooser.png','sector','Your configuration')],
 6:[('screen','02-monday-three.png','who','Who to call'),
    ('screen','02-monday-three.png','why','Why now'),
    ('screen','02-monday-three.png','next','The next step')],
 7:[('grad',None,None,None)],
 8:[('screen','03-aha-two-configs.png','headline','One headline')],
 9:[('screen','04-aha-nvidia.png','verdict','The vendor reads it')],
 10:[('screen','05-aha-execsearch.png','verdict','The searcher reads it')],
 11:[('acid',None,None,None)],
 12:[('screen','07-netflix-signal.png','lead','From a real run')],
 13:[('screen','09-counter-reading.png','counter','It argues against itself')],
 14:[('grad',None,None,None),('tavily',None,None,None),('ground',None,None,None)],   # see CUE
 15:[('tiers',None,None,None),('bill',None,None,None)],
 16:[('screen','06-why-this-scored.png','factors','Four factors'),
     ('screen','06-why-this-scored.png','total','Priority score')],
 17:[('screen','10-rejections.png','first','Kept, with its reason')],
 18:[('screen','01-sector-chooser.png','sector','Seven configurations')],
 19:[('screen','01-sector-chooser.png','deal','What starts a deal')],
 20:[('acid',None,None,None)],
 21:[('acid',None,None,None)],
}
MAXF = 3.4      # a frame holding longer than this stops feeling cut to the voice
MINF = 0.85     # a fragment shorter than this is a tail, not a frame

# Where a beat changes picture on a particular word rather than at an even
# share of its length. The scene has to be up when the word is said — the
# Tavily frame arriving after the name has gone past is the whole point missed.
CUE = {
 14: [('Tavily', 'tavily'), ('Filings', 'tavily'), ('reads only those', 'ground')],
 15: [('Nemotron', 'tiers'), ('wrote the briefing', 'bill')],
}

frames, i, n = [], 0, 1
while i < len(W):
    p = W[i]['p']
    chunk = []
    while i < len(W) and W[i]['p'] == p:
        chunk.append(W[i]); i += 1
    # split the beat at sentence ends so no frame outstays the line it carries
    parts, cur = [], []
    for w in chunk:
        cur.append(w)
        ends = w['w'].endswith(('.', '?', '!'))
        long = cur[-1]['e'] - cur[0]['s'] >= MAXF
        if ends or long:
            parts.append(cur); cur = []
    if cur: parts.append(cur)
    # A one- or two-word tail belongs to the line it fell off, not to a frame.
    merged = []
    for part in parts:
        if merged and part[-1]['e'] - part[0]['s'] < MINF and len(part) <= 3:
            merged[-1].extend(part)
        else:
            merged.append(part)
    parts = merged
    look = BEAT.get(p, [('grad', None, None, None)])
    cues = CUE.get(p)
    held = None
    for k, part in enumerate(parts):
        text = ' '.join(x['w'] for x in part)
        if cues:
            for trig, want in cues:
                if trig.lower() in text.lower():
                    held = next(l for l in look if l[0] == want)
            mode, asset, fk, lbl = held or look[0]
        else:
            mode, asset, fk, lbl = look[min(k * len(look) // max(len(parts), 1), len(look) - 1)]
        f = {'i': n, 'start': part[0]['s'], 'end': part[-1]['e'],
             'dur': round(part[-1]['e'] - part[0]['s'], 2),
             'text': ' '.join(x['w'] for x in part), 'mode': mode, 'asset': asset,
             'words': [{'w': x['w'], 's': x['s'], 'e': x['e']} for x in part], 'icon': None}
        if fk and asset in FO and fk in FO[asset]:
            f['focus'] = FO[asset][fk]; f['focusLabel'] = lbl
        frames.append(f); n += 1
json.dump(frames, open('film-new.json', 'w'), ensure_ascii=False)
from collections import Counter
print('frames:', len(frames), '| last ends', frames[-1]['end'])
print('modes:', dict(Counter(f['mode'] for f in frames)))
over = [f['i'] for f in frames if f['dur'] > 4.2]
print('frames over 4.2s:', over or 'none')
```
