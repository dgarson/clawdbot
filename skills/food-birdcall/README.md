# FOOD-BIRDCALL Skill (Developer Notes)

This skill automates Birdcall ordering on the Poncho platform via the OpenClaw browser tool. It is documentation-only (no code) and intended to drive the UI safely for conversational ordering.

## Files

- `SKILL.md` — Main instructions and conversation flow.
- `menu-reference.md` — Human-readable category guide.

## Platform notes

- Site: https://order.eatbirdcall.com (Poncho SPA with hash routing).
- Primary routes: `/#/locations`, `/#/menu/<category>`, `/#/bag`, `/#/checkout`.
- Use `profile=openclaw` for the browser tool.
- Prefer `snapshot` with `refs=aria` for stable refs.
- Use `data-cy` selectors when available for stability.

## Selector strategy

1. `data-cy` attributes (best).
2. ARIA labels from snapshots (buttons/headers).
3. CSS selectors via evaluate as a fallback.

## Known stable elements

- `heading "Select a Location"`
- `button "Order Now"` on location cards
- `button "ADD TO BAG"` or `[data-cy="add-to-bag-btn"]`
- `/#/bag` for cart, `/#/checkout` for checkout

## Safety rules

- Never click "Place Order" without explicit user confirmation.
- Always show a full summary with totals before checkout.
- Confirm total + tip before placing.
- Double-confirm unusual orders (>$100 or >10 items).

## Recovery tips

- If the menu seems empty after location selection, retry the location selection and confirm the category tabs are visible.
- If a Modify view hangs or navigation triggers a dialog, click "Yes, Discard Changes" then retry.
- If Stripe iframes block entry, ask the user to type payment details manually while you complete the rest of checkout.

## Manual smoke checklist

- Can navigate to `/#/locations` and select a Colorado location.
- Menu categories appear and items can be added.
- Customization view supports sauces and bun/protein selection.
- Bag view shows items and subtotal.
- Checkout form fields are visible.
