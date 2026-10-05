# Public HTML fixture provenance

`scheduled.html` is the semantic main content captured anonymously from
https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu on
2026-10-02T18:32:33.561Z (HTTP 200, text/html). The original response was
145,419 bytes. Scripts/RSC, navigation, forms/dialogs, SVG and artwork URLs,
styling and presentation attributes were removed; section IDs, labels, links,
datetime values and public text were preserved. This is captured Scheduled HTML,
not an invented completed-match fixture. See the evidence manifest for hashes.

Tests mutate this capture to remove/reorder sections, duplicate cards, change
times or substitute an unsupported Completed label. Those are **synthetic
regressions**, not evidence of a real completed, live, canceled or no-show page.

## Capture still needed for League results

The WD League table and recent results are computed from League placements,
which `../parse-results.ts` cannot read yet: no finished match page has been
captured and wardogsleague.net is not reachable from the development sandbox.
To add the parser (a change to `parse-results.ts` and its test only), capture
anonymously, in the same reduced semantic form and with the same provenance
notes:

1. `completed.html`: a match whose header status reads "Completed" (or
   "Confirmed") and whose "Match progress" shows "Placements 3/3" and
   "Confirmed (done)". The page must show which team finished first, second
   and third.
2. If possible also a page after placements were entered but before the
   "Confirmed" step, and one with a no-show, a tie or a dispute.
3. `index-results.html`: the `?tab=results` index with at least one finished
   match, to confirm the results tab lists match links like the fixtures tab.

Record the URL, capture time, HTTP status, content type and original byte
size here, as for `scheduled.html`.
