# Research and provenance

Primary references consulted during development:

- [Official CATAN rules and FAQ](https://www.catan.com/understand-catan/game-rules), [base-game FAQ](https://www.catan.com/faq/basegame): reference for familiar settlement-economy mechanics. Ember Coast has its own implementation, art, names, and documented rules. It is not an official client.
- [Catanatron documentation](https://docs.catanatron.com/) and [making Catanatron stronger](https://docs.catanatron.com/advanced/making-catanatron-stronger): reference for simulator-based benchmarking and hand-crafted value functions. No Catanatron code or weights were copied or bundled.
- [Cowling, Powley & Whitehouse (2012), Information Set Monte Carlo Tree Search](https://eprints.whiterose.ac.uk/id/eprint/75048/): reference for planning under hidden information. Our implementation is a simpler root-action sampled-world search, not a reproduction of their complete algorithms.
- [The public Catan-game archive](https://github.com/theocaplan-del/Catan-dataset): evaluated as a potential human-data source. Its README specifies research/educational use, and underlying records/provenance were not validated here. It was not downloaded, redistributed, used for training, or used to claim human-level strength.

The included empirical data was generated locally by Ember Coast's own simulator. Training/held-out seed names, configurations, outcomes, and time measurements are retained in `training/`.

A future historical-data pipeline should record permission/license, schema/version, event visibility, action legality, duplicate IDs, board distribution, and outcome validity. Split by complete game and ideally player/time; never leak hidden future state into an observed decision. Fit on training games, choose on validation games, and report untouched test games with seat-balanced baselines and confidence intervals.
