---
name: food-birdcall
description: "Conversational Birdcall ordering via browser automation. Browse the Evans (Denver) menu, customize items, review the bag, and checkout safely. Never place an order without explicit user confirmation. Triggers: order birdcall, birdcall order, get chicken."
---

# Birdcall ordering (Poncho web UI)

Goal: help the user order Birdcall food at https://order.eatbirdcall.com by driving the browser and confirming every step for the Evans menu. Default to Evans, guide customization, and never place an order without explicit user confirmation.

Hard safety rules

- Never click "Place Order" without explicit user confirmation.
- Always show a full order summary (items + prices + total) before checkout.
- Always confirm the final payment amount before placing the order.
- If the order looks unusual (total > $100 or > 10 items), double-confirm before proceeding.

Browser setup

- Always use the OpenClaw browser tool with `profile=openclaw`.
- Prefer `snapshot` with `refs=aria` for element discovery.
- Use `data-cy` selectors when available for stable automation.
- The site is a hash-routed SPA (e.g., `/#/menu/birdcall%20-%20evans/1`, `/#/bag`).

Suggested session lifecycle

1. `browser action=start profile=openclaw`
2. `browser action=open targetUrl=https://order.eatbirdcall.com/#/menu/birdcall%20-%20evans/1`
3. Complete ordering flow.
4. `browser action=stop profile=openclaw` when done.

## Location selection

Default to the Evans location only.

Navigate

- Open `https://order.eatbirdcall.com/#/menu/birdcall%20-%20evans/1`.
- Confirm the menu page by finding the category tab row or a visible menu heading.
- If redirected to a location chooser, select the Evans location card and click `button "Order Now"`.

Location details

- Evans — 1535 E. Evans Ave., Denver, CO 80210 (720-242-8106)

Location closed handling

- If the Evans location appears closed, tell the user and stop, or ask whether they want to retry later.

## Menu navigation & categories

Use category tabs to navigate. Confirm the menu page by finding the category tab row.

Categories to cover

- Chicken Sandwiches
- Tenders
- Nuggets
- Sliders
- Bundles
- Salads
- Wraps
- Drinks
- Dirty Soda
- Shakes
- Sauces & Dressings
- Don’t Touch Here (secret menu)

Item selection

- Click the item card or its add button.
- If a Modify/customization view appears, complete it before adding to the bag.
- If the item adds directly, verify the bag count increases.

## Item customization workflow

Common customization groups

- Protein selection (crispy / grilled chicken / tofu). Grilled/tofu often add a price modifier.
- Bun selection (regular, gluten-free +$2.50, lettuce wrap +$0.25).
- Sauces (multi-select with limits, e.g., pick 2 free sauces for 5-piece tenders).
- Ingredient toggles (remove/add toppings).
- Size selection (e.g., 3/5/8 piece tenders).

Automation steps

1. Take a snapshot of the Modify view and enumerate groups.
2. Apply user-requested selections (respect max selections).
3. Click `button "ADD TO BAG"` or `[data-cy="add-to-bag-btn"]`.
4. If a discard dialog appears when navigating away, click `button "Yes, Discard Changes"` before retrying.

Selectors to prefer

- `[data-cy="add-to-bag-btn"]`
- `[data-cy^="menu-item"]`
- `[data-cy^="modifier-option"]`
- `button "ADD TO BAG"`

## Conversational order building

After each item, confirm what was added in this exact format:

```
✅ Added: [Item Name] — $[price]
• Customization 1: [value]
• Customization 2: [value]
What else?
```

Continue until the user says done/checkout.

## Cart management & checkout

- View bag at `/#/bag`.
- Present a complete order summary with itemized prices before checkout.
- Only proceed to checkout after the user confirms the summary.

Order summary template

```
🛒 Your Birdcall Order (Evans)
1. [Item] — $[price]
   • [customization]
2. [Item] — $[price]
Subtotal: $[subtotal]
Tax (est.): $[tax]
Total (est.): $[total]
Ready to checkout?
```

Checkout form fields (pickup or delivery)

- Order type: pickup/delivery
- Name
- Phone
- Email
- Pickup time (ASAP or scheduled)
- Delivery address (if delivery)

Never place an order without explicit user confirmation.

## Payment workflow

Map and fill payment fields:

- Card number
- Expiration date (MM/YY)
- CVV/CVC
- Cardholder name
- Billing ZIP
- Tip selection (preset percentages or custom)

Stripe Elements handling

- If payment fields are inside iframes, switch into the iframe context before typing.
- If iframe access is blocked, ask the user to enter payment manually while you handle the rest.

Payment prompt template

```
💳 Payment needed. Please provide:
1) Card number
2) Expiration (MM/YY)
3) CVV
4) Name on card
5) Billing ZIP
6) Tip preference (No tip / 15% / 20% / 25% / Custom)
```

Confirm the total after tip and ask before placing the order.

## Error handling & recovery

- Location not found: confirm the Evans menu URL and retry.
- Item not found: offer closest match or list items in the current category.
- Discard Changes dialog: click "Yes, Discard Changes" and retry.
- Session timeout: reopen the Evans menu URL and rebuild the order.
- Payment failure: report decline and ask for a new card.

Retry policy

- Wait 2 seconds, retry once.
- If still failing, report to the user and ask for guidance.

## Examples

User: "Order Birdcall"
Assistant:
"🐔 Opening Birdcall Evans menu now. What would you like to order?"

User: "5 piece tenders with ranch and birdcall sauce"
Assistant:
"✅ Added: 5-Piece Chicken Tenders — $[price]
• Sauce 1: Birdcall Sauce
• Sauce 2: Buttermilk Ranch
What else?"

User: "That’s it"
Assistant:
"🛒 Your Birdcall Order (Evans)

1. 5-Piece Chicken Tenders — $[price]
   Subtotal: $[subtotal]
   Tax (est.): $[tax]
   Total (est.): $[total]
   Ready to checkout?"
