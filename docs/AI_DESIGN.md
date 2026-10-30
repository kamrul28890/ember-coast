# How a bot chooses

## Information boundary

`observe(state, player)` whitelists public fields and the viewing player's private cards. It deliberately does not spread/copy arbitrary state fields. In particular, it removes actual opponent hands, deck order, chance-generator state, and raw replay history.

The planner draws hypothetical hands consistent with public counts and the aggregate remaining resource pool. Public production evidence biases these samples; it does not reveal the actual allocation. Development cards are drawn from the remaining possible composition after accounting for played cards and the bot's own holdings.

This is an approximate belief model, not exact Bayesian inference. It does not currently replay every historical constraint. Hidden-state sampling can be strategically biased; sampling is not proof that inferred cards are present.

## Strategic prior and value function

The value function combines own victory points, expected production, resource diversity, reachable expansion value, diminishing hand value, next-build completion, military pressure, and the strongest public opponent's points. City upgrades and outpost placements are scored using their actual resulting board positions.

The goal selector compares feasible city, outpost, road, and development plans. Scarce resources and missing pieces of the selected build carry higher shadow prices. Expected acquisition time uses production rates plus a modest fallback allowance for trading; it is a planning heuristic, not a calibrated duration prediction.

Shortest connected paths use only free/own roads. Enemy buildings block traversal. The outpost distance rule filters destinations. A road receives credit for advancing a valuable reachable site, not simply for increasing road count.

## Search

At a build decision, candidate actions are ranked by the value function and pruned to six (expert) or four (clever). A fixed budget of paired sampled scenarios compares candidates against the heuristic choice. The final score shrinks noisy rollout advantages toward that prior and penalizes uncertainty. Each rollout samples hidden holdings and a possible development deck, applies the candidate, and runs bounded heuristic policies through future table turns. Scores combine points/economy with opponent threat; terminal wins/losses dominate. Known immediate wins are checked directly.

The search uses a fresh simulation RNG, not the game's actual future random state. Common seed groups reduce some comparison noise, but different action paths can consume different random sequences. The resulting futures are sampled scenarios, not forecasts of the actual dice.

This is **not a full ISMCTS implementation**: no deep information-set tree is retained, future trade negotiation is omitted from the rollouts, and candidate pruning can discard a good move. These are meaningful limits to strength.

## Personalities and bargaining

- Mira modestly favors production, cities, and expansion.
- Theo favors flexible holdings and accepts a slightly smaller trade margin.
- Jun values military pressure and is more reluctant to strengthen leaders.

Trade acceptance checks actual availability only in the responding bot's own observation. Utility compares incoming/outgoing shadow prices, build progress, and the initiator's public threat. Near-winners are refused. Counteroffers request a more useful bundle. Recent declined offers are remembered; identical offers are not immediately repeated to the same partner.

The initiating bot cannot inspect the recipient's hand. It may make an impossible request, which the recipient rejects. UI behavior explicitly communicates this instead of pretending the bot knew the cards.

## Tuning and honesty

A fixed prior is retained separately from generated weights. A deterministic bounded parameter search evaluates six configurations across training seeds and all four seats. Selection uses wins, then mean score margin. Held-out seeds are not used by that selection.

Small evaluations have wide uncertainty. The included parameter-search candidate did not establish a clear held-out gain over the original prior. Search is evaluated separately. This version is a tested starting point for stronger AI, not evidence of human parity or optimal strategy.

All implementation is original. Research references describe related concepts; third-party model weights/code were not imported.
