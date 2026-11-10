# Ember Coast

A playable, original island-economy game for **one human and three planning bots**, with an illustrated hex board, bargaining, development cards, and a ten-point victory condition.

The first version is local/browser-only. It is separate from BatteryScope and does not change or publish that project.

The ocean-blue table interface uses brighter original terrain, compact player panels, animated dice, production highlights, and resource-gain feedback. See [REA visual reference notes](docs/reference/README.md) for the inspected reference and limits.

## Play

Open **http://localhost:4173** while the local server is running.

On this Mac, double-click `start.command` to start it again. On any machine with Node.js 22+:

```sh
npm start
# or: node scripts/server.mjs
```

No dependency installation, API key, account, or backend service is needed. The game code and art are local; optional Google Fonts fall back to system fonts when unavailable.

### At the table

- Roll, collect resources, then build or trade. First to ten points on your own turn wins.
- Choose a build card, then click a highlighted road edge or intersection.
- Use the board’s expand control for larger map targets. Click a terrain for its dice probability. More dots mean more likely production.
- Use coastal ports to improve the standard 4:1 bank exchange rate.
- Respond to rival offers, make your own bundles, and consider their counteroffers.
- Play development cards from your hand once eligible. New cards cannot be played on their purchase turn.
- Use **Ask advisor** for a recommendation, and **Bot minds** for disclosed strategic explanations.
- **New island** offers seed selection, three thinking budgets, manual opening placement by default, or a four-bot demonstration.
- Matches save in your browser's local storage. **Export match** downloads the full local save and action history. It explicitly includes hidden hands/deck; it is not uploaded anywhere.

Click the paired dice on the right to animate a roll. On your turn, floating map icons show affordable legal builds: choose a road origin, then an edge, or click a house/city directly. The four icon-only build controls show their resource costs in one row.

See [base-game rule coverage](docs/RULES.md) for the scope and official references. The in-game **How to play** explains production, discards, raider movement, development cards, supply shortages, piece limits, and award ties. This is an independent game with documented rules, not an official CATAN or Colonist client.

## The intelligence

The bots combine:

1. Probability-weighted opening placement and resource diversification.
2. Goal selection: expansion, high-yield cities, development, or military pressure.
3. Graph search toward valuable, legal, reachable outposts.
4. Resource shadow prices based on scarcity, current holdings, and build goals.
5. Threat-aware raider targeting and leader-sensitive trading.
6. Trade counteroffers and memory of recent declined offers.
7. A sampled-hidden-state Monte Carlo action search with paired-scenario comparisons.
8. A measured, seat-rotated self-play search over evaluation weights.

**Deep thinker** compares up to 54 simulated futures, normally five table turns into each future, among a pruned set of candidate actions. **Clever** uses 20 futures; **Casual** uses the heuristic directly. Forced actions and several phases use direct strategic choice rather than wasting rollouts. Simulation runs in a Web Worker so the board stays responsive.

The search is a bounded root-action Monte Carlo comparison with heuristic rollout policies, not a full neural MCTS system. Future negotiation is approximated rather than fully simulated. See [AI design](docs/AI_DESIGN.md) and the [bot playbook](docs/BOT_PLAYBOOK.md).

### Fair information

Bots receive a **whitelisted observation**: their own hand/cards, public buildings, public card counts, resource supply, and public action evidence. Actual opponent hands, remaining deck order, dice RNG state, raw replay history, and arbitrary private fields are not included.

Possible opponent hands are sampled without replacement from the unknown resource pool. Development holdings and the future deck are also sampled. Tests verify that changing hidden actual hands/deck/RNG while preserving public information does not change the bot's observation.

The local game is inspectable software, not an anti-cheat boundary against a human opening developer tools. It is the **bots' decision inputs** that are restricted.

### Evidence, not a skill-rating claim

`training/tuning.json` records the real parameter-search matches and selected configuration. `training/benchmark.json` uses unused seeds against fixed prior policies. `training/search-evaluation.json` records the full-match search evaluation, its exact budget, wins, draws, and comparison policy.

No human gameplay archive or imitation-learning model has been used. Self-play tuning does not prove improvement; consult the held-out results. No human-level, expert-player, Elo, or superhuman rating is claimed. Human playtesting and substantially larger evaluations are needed.

## Test and improve

```sh
npm test
npm run tune -- 12        # 6 candidates × 12 training islands × 4 seats = 288 matches
npm run benchmark -- 48   # held-out islands, 4-seat rotation, fixed prior opponents
node scripts/search-evaluation.mjs 16 54 5
```

All tests use Node's built-in test runner. No packages are downloaded. The suite checks topology, dice-number spacing, opening order, connectivity/distance constraints, payouts, shortages, trades, development timing, discards, path blocking, award ties, observation redaction, search legality, and complete seeded matches with resource conservation.

`src/prior.mjs` is the fixed hand-authored prior. `src/policy.mjs` is generated by tuning; keep training and held-out seeds separate. Evaluation reports describe exactly which policy and search budget were run. See [evaluation notes](docs/EVALUATION.md).

```text
index.html / styles.css    Responsive table interface
src/engine.mjs            Authoritative rules, chance, and public observations
src/ai.mjs                Goals, value function, hidden-state sampling, search, negotiation
src/worker.mjs            Browser background planning
src/art.mjs               Original SVG terrain, board, icons, and portraits
src/app.mjs               UI orchestration and local saves
scripts/                  Local server, arena, tuning, and evaluations
training/                 Reproducible generated reports; no human data
```

## Research and future data

[Research notes](docs/RESEARCH.md) link the primary references and distinguish inspiration from imported material. No third-party engine code, artwork, or dataset is bundled.

Future work includes authorized human demonstrations, replay reconstruction/inspection, stronger belief updates, broader opponent-policy populations, longer tree search, and human evaluation. Historical-game ingestion needs a verified schema, license/provenance, privacy review, and train/validation/test separation; a public link alone is not enough.

## Scope

Included: four seats, 19 hexes, five resources, harbors, roads/outposts/cities, finite supply, raider/discards, player/bank trading, all five development-card categories, longest road, largest army, and private victory cards. The shortfall rule is documented in-game: if supply cannot cover a resource's full payout, none of that resource is distributed.

Not included: online multiplayer, authentication, timers, ranked play, expansions, voice/free-form dialogue, or neural-network training. Private plans are disclosed in the optional learning panel, while private card identities remain hidden until an explicit full-save export.

MIT license. Original implementation and code-generated art.

## License

MIT — see [LICENSE](LICENSE).
