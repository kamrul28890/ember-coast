# Base-game coverage and interaction changes

Ember Coast implements a four-player base-game match with original artwork and names. Outpost means settlement; raider means robber; harvest means Year of Plenty. Expansions, online multiplayer, and a human skill rating are outside this version.

Reference: [official rules and almanac](https://www.catan.com/sites/default/files/2021-06/catan_base_rules_2020_200707.pdf) and [official base-game FAQ](https://www.catan.com/faq/basegame), checked October 30, 2026.

| Area | Implemented behavior |
| --- | --- |
| Opening | Two houses and adjoining roads per player, snake order; starting resources from the second house. Manual placement is the default. |
| Turns | Two independent dice; resolve production or seven before trading/building. Development cards can precede the roll. |
| Construction | Costs, connected roads, blocked enemy intersections, settlement spacing, upgrades, and piece limits. |
| Economy | Finite supply, cities produce twice, ports, bank and current-player trades. A sole recipient takes remaining scarce resources; multiple recipients receive none of that type. |
| Robber | Half discarded above seven; move to another hex and steal a random card from an eligible opponent. |
| Cards | Standard deck, purchase timing, one played action card per turn, both free roads when possible, available supply for harvest, monopoly, hidden victory points. |
| Winning | Ten points on your turn; longest-road and largest-army thresholds, blocking, and incumbent ties. |

Table conventions: the human seat starts rather than holding a separate starting-player roll-off. Trading and building may alternate (the combined phase described in the almanac). The shuffled island avoids adjacent sixes/eights. The quick-opening option delegates legal placement to the bots.

## Controls

- Click the two dice on the right. Animation is cosmetic; only the engine's final roll affects production. Other actions are locked during the animation.
- Floating houses/cities are direct placement or upgrade actions. Only affordable, legal choices appear.
- Click a floating road origin, then a highlighted incident edge. Cancel or choose another origin before committing.
- Four icon-only build buttons stay in one row, with resource costs below. Accessible names and tooltips identify them.
- Opening placement uses a larger map. Expand the map at any time for easier targeting. Reduced-motion preferences suppress floating and tumbling animations.

## Verification

Node tests cover rules, hidden-information boundaries, complete seeded matches, map target legality, and the corrected shortage/card edge cases. Browser checks exercise both manual opening placements, road-origin selection, paired-dice animation, result display, and post-roll road construction with resource deduction.

Earlier self-play reports describe the previous rule version. They are historical bot-only measurements, not a new strength evaluation of version 0.2.
