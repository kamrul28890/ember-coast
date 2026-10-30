# Strategic instructions embodied in the policy

These are readable design rules for the bots, not a hidden LLM prompt or a claim of perfect play.

## Opening

- Value dice probability, not attractive-looking tiles. Six/eight have five combinations; two/twelve have one.
- Balance resource access and roll numbers. A high total yield concentrated in one resource is brittle.
- Plan complementary second placement. Early grain/ore supports cities; timber/brick supports expansion; wool/grain/ore supports development.
- Look beyond the first outpost: legal expansion space and useful ports matter.

## Economy and development

- Upgrade a productive established site when the cost is justified.
- Expand toward a valuable legal intersection instead of making disconnected or aimless roads.
- Price resources by current scarcity and the next build, not a fixed universal exchange rate.
- Keep a useful reserve, but account for discard exposure above seven cards.
- Development is a flexible alternative when routes are contested or a bonus is within reach.

## Opponents

- Public points, road lengths, and played knights are threat signals.
- Do not gift a near-winner the resource that could finish the match.
- Block strong enemy production without unnecessarily blocking your own.
- Rival hands are uncertain. Propose trades from public evidence; accept rejection gracefully.
- Repeated rejected offers are not a strategy. Change the bundle or partner.

## Tactics and uncertainty

- Take a provable immediate win.
- Protect hard-to-replace resources during discards.
- Use a knight to free an important blocked tile or contest the army bonus.
- Harvest fills build gaps; monopoly uses estimated public resource flow.
- Compare alternatives across possible hidden holdings and dice outcomes.
- Never change the dice, look at actual hidden opponent cards, or use the real deck order.

## What still needs improvement

More robust opponent modeling, strategic trading inside rollout forecasts, better belief tracking, larger diverse self-play populations, authorized human demonstrations, longer search, and human playtesting. The current playbook is a useful prior; it is not a substitute for measured outcomes.
