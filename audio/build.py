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
