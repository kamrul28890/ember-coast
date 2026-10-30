# Evaluation record

These are actual local runs, not estimates or human-game results. Full per-game records and model configurations are in `training/`.

| Run | Configuration | Observed result |
| --- | --- | --- |
| Parameter search | 6 heuristic-weight candidates × 12 training islands × 4 seats | **288 matches**; candidate 5 selected by training wins, then score margin |
| Held-out heuristic test | 12 unused islands × 4 seats; tuned candidate vs 3 fixed prior policies; no rollout search | **12/48 wins (25.0%)**, 0 draws |
| Full-budget search test | 4 separate islands × 4 seats; one search policy vs 3 tuned heuristic policies | **6/16 wins (37.5%)**, 0 draws; **54 rollouts / 5 table turns**, matching browser Deep thinker |
| Automated regressions | Deterministic engine, observations, planning, trading, and full matches | **13 tests passed** |

An equal-strength four-player seat has a 25% reference win share. The tuned heuristic's held-out result does **not** establish an advantage over the fixed prior. The search result is encouraging but small, and it is not a human skill rating. Repeated boards across seats create correlated observations; simple binomial intervals in the JSON are descriptive and do not establish statistical significance.

The full-budget search evaluation took approximately **96 seconds** in aggregate on this development machine. The heuristic hold-out took approximately **5 seconds**. These are whole local-run times, not guarantees for every browser or position.

## What the experiments changed

The first rollout experiment allowed noisy short futures to override useful immediate moves. The initial action ranking also valued an unknown development-card purchase using one sampled card. The final version:

- Ranks purchases by expected card value, independently of a particular next-card order.
- Compares candidates under paired sampled scenarios.
- Shrinks uncertain forecast gains toward the strategic prior rather than treating every lucky rollout as decisive.
- Gives terminal results explicit precedence in scenario scoring, and checks provable immediate wins separately.
- Retains regression coverage for card-order independence, legal search output, hidden-field redaction, and private discard beliefs.

Earlier experiment records are retained as `*-before-calibration.json` and `search-pilot.json`. They use different seeds/configurations and must not be presented as a controlled causal before/after strength gain.

## Browser verification

Verified in Chrome at the normal laptop viewport:

- Rendering, two-dice roll, phase changes, and local reload/resume.
- Legal road markers and the corresponding timber/brick cost deduction.
- Background-worker advisor with 54 simulated futures.
- A bot-initiated offer, acceptance, and exchange of the visible bundles.
- A human offer, utility-based rejection, and memory of the repeated declined bundle.
- Bot turns returning play to the human.
- Manual setup with 54 first-outpost choices, then legal adjacent-road choices.

Visual review found and corrected harbor path fills, a dice-display conflict, and excessive laptop table height. Small-screen CSS is supplied; a separate mobile-device interaction pass has not been completed. Every development-card UI combination and long-duration browser session have not been manually exercised.

## Reproduce

```sh
npm test
npm run tune -- 12
npm run benchmark -- 48
node scripts/search-evaluation.mjs 16 54 5
```

Tuning and benchmark seed prefixes are separate. Model selection uses training results, not the held-out score. Search uses its own distinct seed prefix. No human dataset was used, no externally trained model was imported, and no cloud AI API is called.
