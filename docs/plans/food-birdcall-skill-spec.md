# FOOD-BIRDCALL Skill — Comprehensive Implementation Specification

**Version:** 1.0.0  
**Date:** 2026-02-08  
**Author:** ClawdBot (automated specification)  
**Target:** OpenClaw Skill (`skills/food-birdcall/SKILL.md`)  
**Platform:** Birdcall Online Ordering (https://order.eatbirdcall.com)  
**Powered By:** Poncho ordering platform

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Platform Analysis](#3-platform-analysis)
4. [Location Selection System](#4-location-selection-system)
5. [Menu Structure & Data Model](#5-menu-structure--data-model)
6. [Item Customization System](#6-item-customization-system)
7. [Cart Management](#7-cart-management)
8. [Checkout Workflow](#8-checkout-workflow)
9. [Payment System](#9-payment-system)
10. [Conversational UX Design](#10-conversational-ux-design)
11. [Browser Automation Procedures](#11-browser-automation-procedures)
12. [Error Handling & Recovery](#12-error-handling--recovery)
13. [File Structure & Deliverables](#13-file-structure--deliverables)
14. [Testing Strategy](#14-testing-strategy)
15. [Appendix: Known UI Elements](#appendix-known-ui-elements)

---

## 1. Executive Summary

### 1.1 Purpose

Build an OpenClaw skill that enables **conversational food ordering** from Birdcall restaurants via browser automation of their online ordering platform at `order.eatbirdcall.com`. The skill operates as an interactive assistant: the user tells the agent what they want to eat, the agent navigates the Birdcall web UI to build the order, reports back on each item added (with full customization details), and guides the user through checkout and payment.

### 1.2 Key Requirements

1. **Menu Discovery & Mapping** — Programmatically explore and categorize the full Birdcall menu (Chicken sandwiches, Tenders, Nuggets, Sliders, Bundles, Salads, Wraps, Drinks, Dirty Soda, Shakes, Sauces & Dressings, "Don't Touch Here" secret menu)
2. **Item Customization Automation** — Navigate the "Modify" workflow for each menu item to understand and automate all customization options (sauce selection, ingredient removal/addition, protein swaps, bun swaps, etc.)
3. **Conversational Order Building** — After each item is added to the bag, report back exactly what was added with full customization breakdown. Prompt user for the next item. Continue until user confirms they're done.
4. **Checkout Orchestration** — Navigate from bag to checkout, present final order summary with prices, prompt user for confirmation before proceeding.
5. **Payment Workflow Mapping** — Fully map and automate all payment form fields (card number, expiration, CVV, billing address, tip, etc.) based on information the user provides when prompted.

### 1.3 Constraints

- **Browser automation only** — No Birdcall API exists; all interaction is via the Poncho-powered web ordering UI
- **OpenClaw browser tool** — Uses `profile=openclaw` (CDP-based, Playwright-compatible)
- **No stored payment data** — User must provide payment info each session (or the skill must support saved payment methods if the platform offers them)
- **Never place an order without explicit user confirmation** — Hard safety rule

---

## 2. Architecture Overview

### 2.1 Skill Structure

```
skills/food-birdcall/
├── SKILL.md              # Main skill definition (frontmatter + instructions)
├── menu-data.json        # Cached menu structure (optional, for reference)
└── README.md             # Developer documentation
```

### 2.2 Technology Stack

| Component         | Technology                                                               |
| ----------------- | ------------------------------------------------------------------------ |
| Browser Control   | OpenClaw `browser` tool with `profile=openclaw`                          |
| Element Targeting | ARIA refs from snapshot (primary), CSS selectors via evaluate (fallback) |
| Platform          | Poncho ordering platform (React SPA, client-side routing)                |
| URL Scheme        | `order.eatbirdcall.com/#/locations`, `/#/menu/<category>`, `/#/checkout` |

### 2.3 State Machine

```
[IDLE] → selectLocation → [LOCATION_SELECTED]
  → browseMenu → [MENU_BROWSING]
    → selectItem → [ITEM_SELECTED]
      → customizeItem → [ITEM_CUSTOMIZED]
        → addToBag → [ITEM_ADDED] → (report to user) → [MENU_BROWSING]
  → viewBag → [BAG_REVIEW]
    → proceedToCheckout → [CHECKOUT]
      → fillDetails → [DETAILS_FILLED]
        → fillPayment → [PAYMENT_FILLED]
          → confirmOrder → [ORDER_PLACED]
```

---

## 3. Platform Analysis

### 3.1 Technology Identification

The Birdcall ordering site (`order.eatbirdcall.com`) is powered by **Poncho** (poncho.is), a white-label restaurant ordering platform. Key characteristics:

- **SPA (Single Page Application)** with hash-based routing (`/#/locations`, `/#/menu/...`)
- **React-based** frontend with dynamic rendering
- **Lazy-loaded sections** — Menu categories may load content dynamically when tabs are clicked/scrolled to
- **Google Maps integration** for location selection
- **`data-cy` attributes** present on many interactive elements (Cypress test selectors — very useful for automation)

### 3.2 URL Structure

| Route                | Purpose                                 |
| -------------------- | --------------------------------------- |
| `/#/locations`       | Location selector (landing page)        |
| `/#/menu/<category>` | Menu category view                      |
| `/#/item/<itemId>`   | Item detail/customization (Modify) view |
| `/#/bag`             | Shopping bag / cart                     |
| `/#/checkout`        | Checkout flow                           |
| `/#/confirmation`    | Order confirmation                      |

### 3.3 Authentication

- **Optional sign-in** — Users can order as guest or sign in
- **Sign In / Join** button in the header banner
- Guest checkout should be supported as the primary flow
- If David has an account, the openclaw browser profile may retain session cookies

---

## 4. Location Selection System

### 4.1 Location Data

Birdcall operates in 3 states with 14 locations:

#### Arizona (2 locations)

| Name           | Address                                       | Phone        | Hours             |
| -------------- | --------------------------------------------- | ------------ | ----------------- |
| 7th & Glendale | 7025 N 7th St, PHOENIX, AZ 85020              | 602-847-9777 | L/D: 10:30am-10pm |
| SanTan Village | 2220 S Santan Village Pkwy, Gilbert, AZ 85295 | 602-847-9766 | L/D: 10:30am-10pm |

#### Colorado (10 locations)

| Name                 | Address                                           | Phone        | Hours                           |
| -------------------- | ------------------------------------------------- | ------------ | ------------------------------- |
| Evans                | 1535 E. Evans Ave., Denver, CO 80210              | 720-242-8106 | L/D: 10:30am-10pm               |
| Cherry Hills Village | 4996 East Hampden Ave, Denver, CO 80222           | 720-799-8911 | L/D: 10:30am-10pm               |
| Five Points          | 800 E. 26th Ave, Denver, CO 80205                 | 720-361-2976 | L/D: 10:30am-10pm               |
| Union Station        | 1701 Wewatta St, Denver, CO 80202                 | 720-572-8799 | B: 7-10:45am, L/D: 10:45am-9pm  |
| Belmar Whole Foods   | 444 S Wadsworth Blvd., Lakewood, CO 80266         | 720-823-7444 | L/D: 10am-9pm                   |
| Cherrywood Square    | 7503 South University Blvd., Centennial, CO 80122 | 720-794-0007 | B: 7-10:30am, L/D: 10:30am-10pm |
| Boulder 29th Street  | 1675 29th St, Suite #1284, Boulder, CO 80301      | 303-268-1680 | L/D: 10:30am-10pm               |
| Boulder Whole Foods  | 2905 Pearl Street, Boulder, CO 80305              | 303-268-1730 | L/D: 10:30am-8:30pm             |
| Colorado Springs     | 6510 Tutt Blvd, Colorado Springs, CO 80923        | 719-259-6290 | B: 7-10:30am, L/D: 10:30am-10pm |
| Fort Collins         | 3300 S College Ave., Fort Collins, CO 80525       | 970-973-0222 | L/D: 10:30am-10pm               |

#### Texas (2 locations)

| Name       | Address                                   | Phone        | Hours                              |
| ---------- | ----------------------------------------- | ------------ | ---------------------------------- |
| McKinney   | 4702 W University Dr., McKinney, TX 75071 | 469-307-5770 | B: 7-10:30am, L/D: 10:30am-10pm    |
| Richardson | 507 W Belt Line Rd, Richardson, TX 75080  | 469-903-0007 | B: 6:30-10:30am, L/D: 10:30am-10pm |

### 4.2 Default Location

David is in Denver, CO. The skill should default to asking which Denver-area location, or support a user preference for a default location (e.g., "Cherry Hills Village" or "Five Points").

### 4.3 Location Selection Automation

```
STEP 1: Navigate to https://order.eatbirdcall.com/#/locations
STEP 2: Take snapshot → find heading "Select a Location"
STEP 3: If user specified a location:
  a) Find the state filter button (e.g., button "colorado")
  b) Click it to scroll to that state section
  c) Find the location card with matching heading text
  d) Click the "Order Now" button on that card
STEP 4: If user didn't specify:
  a) Ask user which location
  b) Present list of nearby Denver-area locations
  c) Wait for user response, then select
STEP 5: Verify menu page loaded (look for menu category tabs)
```

**Key UI Elements:**

- `button "SIGN IN / JOIN"` — Header sign-in
- `heading "Select a Location"` — Page title
- `button "Find the nearest location"` — Geolocation-based selection
- State filter buttons: `button "arizona"`, `button "colorado"`, `button "texas"`
- Location cards: Each has `img "<LocationName>"`, `button "Order Now"`, `heading "<LocationName>"`

---

## 5. Menu Structure & Data Model

### 5.1 Menu Categories

Based on the previous exploration session data, the menu is organized into these tab/category sections:

#### 🍗 Chicken (Sandwiches)

Signature chicken sandwiches on Aspen Baking Co buns. All-natural Colorado Native chicken.

| Item               | Description                           | Customizable                         |
| ------------------ | ------------------------------------- | ------------------------------------ |
| The Bee's Knees    | Signature sandwich with honey drizzle | Yes — protein, bun, toppings, sauces |
| Original           | Classic chicken sandwich              | Yes                                  |
| Nashville Hot      | Nashville-style hot chicken           | Yes                                  |
| Buffalo            | Buffalo sauce chicken                 | Yes                                  |
| Birdcall Club      | Club-style with extra toppings        | Yes                                  |
| Crispy Chicken BLT | BLT with crispy chicken               | Yes                                  |

**Customization options (sandwiches):**

- Protein: Crispy chicken (default), Grilled chicken (+$3.50), Crispy tofu (+$3.50)
- Bun: Regular Aspen Baking Co bun (default), Gluten-free bun (+$2.50), Lettuce wrap (+$0.25)
- Toppings: Varies by sandwich — lettuce, tomato, pickles, onions, etc.
- Sauces: Multiple sauce options
- Ingredients section: Add/remove individual components

#### 🍗 Tenders

| Item            | Sizes                     | Customizable                                |
| --------------- | ------------------------- | ------------------------------------------- |
| Chicken Tenders | 3-piece, 5-piece, 8-piece | Yes — Free sauces (x2 for 5pc), ingredients |

**Tender Customization:**

- Free Sauces: Select 2 (for 5-piece; number varies by size)
- Sauce options: Birdcall Sauce, Bird-B-Q Sauce, Buttermilk Ranch, Chipotle BBQ Sauce, Herb Mayo, Sriracha Aioli, and more
- Ingredients section

#### 🍗 Nuggets

| Item            | Sizes          | Customizable |
| --------------- | -------------- | ------------ |
| Chicken Nuggets | Various counts | Yes — sauces |

#### 🍗 Sliders

| Item             | Description                      | Customizable |
| ---------------- | -------------------------------- | ------------ |
| Slider varieties | Mini versions of main sandwiches | Yes          |

#### 📦 Bundles

| Item          | Description            | Customizable                       |
| ------------- | ---------------------- | ---------------------------------- |
| Family Bundle | Combo deals for groups | Yes — modify individual components |
| Tender Bundle | Tenders combo          | Yes                                |

#### 🥗 Salads

| Item           | Description            | Customizable                      |
| -------------- | ---------------------- | --------------------------------- |
| Various salads | Grilled chicken salads | Yes — protein, dressing, toppings |

#### 🌯 Wraps

| Item           | Description   | Customizable                    |
| -------------- | ------------- | ------------------------------- |
| Wrap varieties | Chicken wraps | Yes — protein, fillings, sauces |

#### 🥤 Drinks

| Category        | Items             |
| --------------- | ----------------- |
| Fountain Drinks | Various sodas     |
| Lemonade        | Regular, flavored |
| Iced Tea        | Sweet, unsweet    |
| Water           | Bottled water     |

#### 🥤 Shakes

| Item                 | Description        |
| -------------------- | ------------------ |
| Vanilla Shake        | Classic vanilla    |
| Chocolate Shake      | Classic chocolate  |
| Strawberry Shake     | Classic strawberry |
| Cookies and Cream    | Oreo-style shake   |
| (additional flavors) | Seasonal/rotating  |

#### 🧊 Dirty Soda

| Item                | Description                 |
| ------------------- | --------------------------- |
| Coconut Cherry Bomb | Coconut + cherry soda combo |
| Coconut Crush       | Coconut soda blend          |
| Strawberry Daydream | Strawberry soda creation    |
| Big Island Breeze   | Tropical soda blend         |

#### 🫙 Sauces & Dressings

| Item                | Type              |
| ------------------- | ----------------- |
| Birdcall Sauce      | Signature sauce   |
| Bird-B-Q Sauce      | BBQ variant       |
| Buttermilk Ranch    | Ranch dressing    |
| Chipotle BBQ Sauce  | Spicy BBQ         |
| Herb Mayo           | Herbed mayonnaise |
| Sriracha Aioli      | Spicy aioli       |
| (additional sauces) | Various options   |

#### 🤫 Don't Touch Here (Secret Menu)

| Item          | Description                    |
| ------------- | ------------------------------ |
| Secret combos | Hidden menu items/combinations |

### 5.2 Data Model

```typescript
interface MenuItem {
  name: string;
  category: MenuCategory;
  description?: string;
  basePrice: number;
  sizes?: { name: string; price: number }[];
  customizationGroups: CustomizationGroup[];
  isAvailable: boolean;
}

type MenuCategory =
  | "chicken"
  | "tenders"
  | "nuggets"
  | "sliders"
  | "bundles"
  | "salads"
  | "wraps"
  | "drinks"
  | "shakes"
  | "dirty-soda"
  | "sauces-dressings"
  | "secret-menu";

interface CustomizationGroup {
  name: string; // e.g., "Free Sauces x2"
  type: "single" | "multi" | "quantity";
  required: boolean;
  maxSelections?: number; // e.g., 2 for "select 2 sauces"
  options: CustomizationOption[];
}

interface CustomizationOption {
  name: string;
  priceModifier: number; // 0 for free, positive for upcharge
  isDefault: boolean;
  dataCy?: string; // Cypress test selector if available
}

interface BagItem {
  menuItem: MenuItem;
  quantity: number;
  selectedCustomizations: Record<string, string[]>;
  itemTotal: number;
}

interface Order {
  location: Location;
  items: BagItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}
```

---

## 6. Item Customization System

### 6.1 Modify Workflow

When a user adds an item that has customization options, the platform shows a "Modify" view. The automation sequence:

```
STEP 1: On the menu page, find the target menu item card
STEP 2: Click the item card or its "Add" / "+" button
STEP 3: If a Modify/customization modal/page appears:
  a) Take snapshot to discover all customization groups
  b) Parse each group: name, type (single/multi), current selections
  c) Apply user's requested customizations:
     - For sauce selections: click desired sauce options
     - For ingredient removals: uncheck/remove unwanted ingredients
     - For protein swaps: select alternative protein radio button
     - For bun swaps: select alternative bun option
  d) After all customizations: click "ADD TO BAG" button
STEP 4: If no customization view (simple item):
  a) Item goes directly to bag
  b) Verify bag count incremented
STEP 5: Take snapshot of updated bag state
STEP 6: Report to user exactly what was added
```

### 6.2 Customization Categories

| Category              | Behavior                | Example                              |
| --------------------- | ----------------------- | ------------------------------------ |
| **Protein Selection** | Radio buttons (pick 1)  | Crispy chicken / Grilled / Tofu      |
| **Bun Selection**     | Radio buttons (pick 1)  | Regular / Gluten-free / Lettuce wrap |
| **Free Sauces**       | Multi-select with limit | Pick 2 of 6+ sauce options           |
| **Paid Add-ons**      | Checkboxes with price   | Extra sauce (+$0.75)                 |
| **Ingredients**       | Toggle on/off           | Remove pickles, add extra lettuce    |
| **Size Selection**    | Radio or dropdown       | 3pc / 5pc / 8pc tenders              |

### 6.3 Reporting Format

After each item is added, report to the user in this format:

```
✅ Added to bag: **5-Piece Chicken Tenders** — $9.49
  📋 Customizations:
  • Free Sauce 1: Birdcall Sauce
  • Free Sauce 2: Buttermilk Ranch
  • Ingredients: No modifications

What would you like to add next? (or say "that's it" to proceed to checkout)
```

---

## 7. Cart Management

### 7.1 Bag View

The bag/cart shows:

- List of all added items with quantities
- Per-item customization summary
- Per-item price
- Subtotal
- Option to modify or remove items
- "Checkout" button

### 7.2 Cart Operations

| Operation         | Method                                              |
| ----------------- | --------------------------------------------------- |
| View bag          | Navigate to `/#/bag` or click bag icon              |
| Increase quantity | Click "+" on item row                               |
| Decrease quantity | Click "-" on item row                               |
| Remove item       | Click remove/trash icon or decrease to 0            |
| Modify item       | Click "Modify" on item row (re-opens customization) |
| Clear bag         | Remove all items individually                       |

### 7.3 Bag Summary

Before proceeding to checkout, present the user with a formatted summary:

```
🛒 **Your Birdcall Order** (Cherry Hills Village)

1. 5-Piece Chicken Tenders — $9.49
   • Birdcall Sauce, Buttermilk Ranch
2. The Bee's Knees Sandwich — $11.49
   • Grilled chicken (+$3.50), no pickles
3. Coconut Cherry Bomb (Dirty Soda) — $4.99

Subtotal: $25.97
Tax (est.): $2.08
─────────────
Estimated Total: $28.05

Ready to checkout? (confirm / modify / add more)
```

---

## 8. Checkout Workflow

### 8.1 Checkout Steps

```
STEP 1: Click "Checkout" button from bag view
STEP 2: Select order type:
  a) Pickup (default)
  b) Delivery (if available at this location)
STEP 3: If pickup:
  a) Confirm pickup time (ASAP or scheduled)
  b) Enter name for the order (if not signed in)
  c) Enter phone number
  d) Enter email (for receipt)
STEP 4: If delivery:
  a) Enter delivery address
  b) Confirm delivery time
  c) Enter name, phone, email
STEP 5: Review order summary
STEP 6: Proceed to payment
```

### 8.2 Checkout Form Fields

| Field                | Type                      | Required    | Notes                         |
| -------------------- | ------------------------- | ----------- | ----------------------------- |
| Order Type           | Radio: Pickup / Delivery  | Yes         |                               |
| Pickup Time          | Dropdown or time selector | Yes         | ASAP or scheduled             |
| First Name           | Text input                | Yes         |                               |
| Last Name            | Text input                | Yes         |                               |
| Phone Number         | Tel input                 | Yes         | For order updates             |
| Email                | Email input               | Yes         | For receipt                   |
| Delivery Address     | Text input(s)             | If delivery | Street, Apt, City, State, ZIP |
| Special Instructions | Textarea                  | No          | Order-level notes             |

---

## 9. Payment System

### 9.1 Payment Methods

The Poncho platform typically supports:

- **Credit/Debit Card** (primary)
- **Saved payment methods** (if signed in)
- **Gift cards** (if available)
- **Apple Pay / Google Pay** (potentially, if on compatible browser)

### 9.2 Payment Form Fields

| Field           | Type                               | Required | Automation Notes                                             |
| --------------- | ---------------------------------- | -------- | ------------------------------------------------------------ |
| Card Number     | Text input (may use iframe/Stripe) | Yes      | May be in Stripe Elements iframe — requires special handling |
| Expiration Date | Text input (MM/YY)                 | Yes      | May be separate month/year dropdowns                         |
| CVV/CVC         | Text input (3-4 digits)            | Yes      | May be in iframe                                             |
| Cardholder Name | Text input                         | Yes      |                                                              |
| Billing ZIP     | Text input (5 digits)              | Yes      |                                                              |
| Tip Amount      | Radio buttons or custom input      | No       | Preset percentages (15%, 20%, 25%) or custom                 |

### 9.3 Payment Automation Strategy

⚠️ **CRITICAL: Payment fields may be in Stripe/Square iframes which require special handling.**

```
APPROACH 1: Standard Input Fields
  - If payment fields are regular HTML inputs:
    - Take snapshot, find each field by label/placeholder
    - Use act kind=type to fill each field

APPROACH 2: Stripe Elements (iframe)
  - If card input is inside a Stripe iframe:
    - Use browser evaluate to find the iframe
    - Switch to iframe context
    - Fill fields within the iframe
    - Switch back to parent frame

APPROACH 3: User-Directed Handoff
  - Present all payment fields to user
  - Ask user to fill in payment info manually
  - Agent handles everything except the actual card entry
  - Agent clicks "Place Order" after user fills payment
```

### 9.4 Tip Selection

```
STEP 1: On the payment page, find tip selection area
STEP 2: Present options to user:
  - No tip
  - 15% ($X.XX)
  - 20% ($X.XX)
  - 25% ($X.XX)
  - Custom amount
STEP 3: Select user's choice
STEP 4: Verify total updated correctly
```

### 9.5 Payment Information Collection

When the agent needs payment info, prompt the user:

```
💳 **Payment Information Needed**

Please provide the following (I'll fill in the form for you):
1. Card number
2. Expiration date (MM/YY)
3. CVV (3 or 4 digits on back of card)
4. Cardholder name
5. Billing ZIP code
6. Tip preference: No tip / 15% / 20% / 25% / Custom amount

⚠️ Your card details will only be entered into the Birdcall checkout form and not stored anywhere.
```

---

## 10. Conversational UX Design

### 10.1 Interaction Flow

```
USER: "Let's order from Birdcall"
AGENT: "🐔 Birdcall! Which location? Your Denver-area options:
  1. Cherry Hills Village (4996 East Hampden Ave)
  2. Five Points (800 E. 26th Ave)
  3. Evans (1535 E. Evans Ave)
  4. Union Station (1701 Wewatta St)
  Or tell me another location name."

USER: "Cherry Hills"
AGENT: "📍 Cherry Hills Village selected. Opening the menu...
  Here are the categories:
  🍗 Chicken Sandwiches | 🍗 Tenders | 🍗 Nuggets | 🍗 Sliders
  📦 Bundles | 🥗 Salads | 🌯 Wraps
  🥤 Drinks | 🧊 Dirty Soda | 🥤 Shakes
  🫙 Sauces & Dressings

  What would you like to order?"

USER: "5 piece tenders with birdcall sauce and ranch"
AGENT: [automates: navigate to tenders → click 5-piece →
        Modify → select Birdcall Sauce → select Buttermilk Ranch →
        ADD TO BAG]
       "✅ Added: **5-Piece Chicken Tenders** — $9.49
        • Sauce 1: Birdcall Sauce
        • Sauce 2: Buttermilk Ranch
        What else?"

USER: "Bee's Knees with grilled chicken, no pickles"
AGENT: [automates: navigate to chicken → click Bee's Knees →
        Modify → select Grilled Chicken → remove Pickles →
        ADD TO BAG]
       "✅ Added: **The Bee's Knees** — $14.99
        • Protein: Grilled Chicken (+$3.50)
        • Removed: Pickles
        • All other toppings: default
        What else?"

USER: "That's it"
AGENT: "🛒 **Order Summary** (Cherry Hills Village):
        1. 5-Piece Chicken Tenders — $9.49
        2. The Bee's Knees (Grilled) — $14.99
        Subtotal: $24.48
        Ready to checkout?"

USER: "Yes"
AGENT: [navigates to checkout, fills required fields]
       "💳 I need your payment info to complete the order.
        Please provide: card number, exp date, CVV, name, ZIP, and tip preference."

USER: [provides payment info]
AGENT: [fills payment form]
       "💰 Order total with 20% tip: $31.22
        Shall I place the order?"

USER: "Place it"
AGENT: [clicks Place Order]
       "✅ Order placed! Pickup at Cherry Hills Village.
        Estimated ready time: 15 minutes."
```

### 10.2 Natural Language Understanding

The skill should handle these types of user requests:

| Request Pattern                     | Action                                       |
| ----------------------------------- | -------------------------------------------- |
| "5 piece tenders"                   | Navigate to tenders → select 5-piece size    |
| "tenders with ranch and bbq sauce"  | Select tenders → Modify → pick 2 sauces      |
| "bee's knees no pickles"            | Select Bee's Knees → Modify → remove pickles |
| "grilled chicken on the [sandwich]" | Swap protein to grilled                      |
| "gluten free bun"                   | Swap bun to GF                               |
| "lettuce wrap instead of bun"       | Swap bun to lettuce wrap                     |
| "a coconut cherry bomb"             | Navigate to Dirty Soda → select item         |
| "add a side of ranch"               | Navigate to Sauces → add Buttermilk Ranch    |
| "that's it" / "done" / "checkout"   | Proceed to checkout                          |
| "remove the tenders"                | Remove item from bag                         |
| "make that 2 of those"              | Increase quantity of last item               |
| "what sauces do you have?"          | List available sauces                        |
| "what's on the secret menu?"        | Show Don't Touch Here items                  |

### 10.3 Error Messages

| Situation                   | Response                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Item not found              | "I don't see that on the menu. Did you mean [closest match]?"                                              |
| Location closed             | "Cherry Hills Village is currently closed. Hours: 10:30am-10pm. Would you like to check another location?" |
| Customization not available | "That option isn't available for this item. Available options are: [list]"                                 |
| Payment failed              | "The payment was declined. Would you like to try a different card?"                                        |

---

## 11. Browser Automation Procedures

### 11.1 Session Lifecycle

```
1. browser action=start profile=openclaw
2. browser action=open targetUrl=https://order.eatbirdcall.com/
3. [... ordering workflow ...]
4. browser action=stop profile=openclaw  (after order placed or session ends)
```

### 11.2 Element Discovery Strategy

**Priority order for finding elements:**

1. **`data-cy` attributes** — Poncho uses Cypress test selectors extensively. Use `evaluate` to query:

   ```javascript
   document.querySelector('[data-cy="menu-item-add-btn"]');
   ```

2. **ARIA names from snapshot** — Use the accessibility tree:

   ```
   button "Order Now"
   button "ADD TO BAG"
   heading "Chicken Tenders"
   ```

3. **Structural patterns** — Find elements by their position/context:
   - Item cards typically have: image, name heading, price, add button
   - Customization groups have: group heading, radio/checkbox options

4. **CSS selectors via evaluate** — Last resort:
   ```javascript
   document.querySelectorAll(".menu-item-card");
   ```

### 11.3 Menu Navigation

```
TO NAVIGATE TO A CATEGORY:
  1. Take snapshot of menu page
  2. Find the category tab button (e.g., button "Chicken", button "Tenders")
  3. Click the tab
  4. Wait for content to load (may be lazy)
  5. Take new snapshot to see items

TO SELECT AN ITEM:
  1. Find the item card by heading text or image alt text
  2. Click the item card or its "Add" button
  3. If Modify view appears → handle customization
  4. If item added directly → verify bag count

TO HANDLE MODIFY VIEW:
  1. Take snapshot of Modify page
  2. Parse all customization groups
  3. For each requested customization:
     a. Find the group section
     b. Find the target option
     c. Click to select/deselect
  4. Verify selections are reflected
  5. Click "ADD TO BAG"
  6. Verify return to menu and bag count updated
```

### 11.4 Key DOM Patterns

```javascript
// Poncho platform common patterns:

// Menu item cards
document.querySelectorAll('[data-cy^="menu-item"]');

// Add to bag button
document.querySelector('[data-cy="add-to-bag-btn"]');
// Or fallback: button with text "ADD TO BAG"

// Customization option
document.querySelectorAll('[data-cy^="modifier-option"]');

// Bag/cart count badge
document.querySelector('[data-cy="bag-count"]');

// Checkout button
document.querySelector('[data-cy="checkout-btn"]');

// Discard changes dialog
// "Yes, Discard Changes" button appears when navigating away from unsaved modifications
```

---

## 12. Error Handling & Recovery

### 12.1 Common Failures

| Failure                          | Detection                          | Recovery                                        |
| -------------------------------- | ---------------------------------- | ----------------------------------------------- |
| Location page doesn't load       | No "Select a Location" heading     | Retry navigation, check internet                |
| Menu doesn't load after location | No category tabs visible           | Click "Order Now" again, try different location |
| Item not found in category       | Search all categories              | Use evaluate to search DOM text                 |
| Modify view stuck                | No "ADD TO BAG" button             | Navigate back, try adding item again            |
| Discard Changes dialog           | Dialog with "Yes, Discard Changes" | Click "Yes, Discard Changes"                    |
| Bag empty after add              | Bag count is 0                     | Retry adding item                               |
| Checkout validation error        | Error messages visible             | Report to user, ask for correction              |
| Payment iframe blocked           | Stripe iframe not accessible       | Fall back to manual payment entry               |
| Session timeout                  | Redirected to locations page       | Re-select location, rebuild order               |
| Page crash/hang                  | Snapshot returns empty/error       | Refresh page, attempt recovery                  |

### 12.2 Retry Policy

- After each browser action, take a fresh snapshot to verify state
- If action fails: wait 2 seconds, retry once
- If retry fails: take screenshot for debugging, report to user
- Maximum 3 retries per operation before asking user for help

### 12.3 Order Safety Rules

1. **NEVER click "Place Order" without explicit user confirmation**
2. **ALWAYS show the full order summary and total before checkout**
3. **ALWAYS confirm the payment amount before placing**
4. If any doubt about user intent → ask for clarification
5. If order seems unusual (>$100, >10 items) → double-confirm

---

## 13. File Structure & Deliverables

### 13.1 Primary Deliverable: `skills/food-birdcall/SKILL.md`

The SKILL.md file should follow the OpenClaw skill format with:

```yaml
---
name: food-birdcall
description: >
  Order food from Birdcall (eatbirdcall.com) via browser automation.
  Conversational ordering: browse menu, customize items, build order,
  checkout with payment. Never place order without explicit confirmation.
  Triggers: order birdcall, birdcall order, get chicken, order from birdcall
homepage: https://order.eatbirdcall.com
metadata:
  openclaw:
    emoji: "🐔"
    requires:
      tools:
        - browser
    capabilities:
      - browser-automation
---
```

### 13.2 Supporting Files

```
skills/food-birdcall/
├── SKILL.md              # Full skill with all procedures
├── menu-reference.md     # Human-readable menu guide
└── README.md             # Developer docs & maintenance notes
```

---

## 14. Testing Strategy

### 14.1 Smoke Tests (Manual/Visual)

1. **Location selection** — Can navigate to locations page and select "Cherry Hills Village"
2. **Menu loading** — After location selection, all category tabs visible
3. **Item addition** — Can add a simple item (e.g., fountain drink) to bag
4. **Customization** — Can modify a tender order (select sauces)
5. **Bag view** — Can see items in bag with correct prices
6. **Checkout navigation** — Can reach checkout page
7. **Payment form** — Can see and identify all payment fields

### 14.2 Integration Test Scenarios

| Scenario            | Steps                                            | Expected                          |
| ------------------- | ------------------------------------------------ | --------------------------------- |
| Simple order        | Select location → Add 1 item → Checkout          | Single item in bag, correct total |
| Multi-item order    | Add 3 different items                            | All 3 in bag, subtotal correct    |
| Customized sandwich | Add Bee's Knees, swap to grilled, remove pickles | Customizations reflected in bag   |
| Tender with sauces  | Add 5-piece, select 2 sauces                     | Sauces shown in bag item          |
| Remove item         | Add item, then remove from bag                   | Bag empty after removal           |
| Quantity change     | Add item, increase quantity to 3                 | Quantity shows 3, price × 3       |

### 14.3 Edge Cases

- Location closed outside operating hours
- Item out of stock / unavailable
- Maximum bag size reached
- Session timeout during ordering
- Payment declined
- Network interruption during checkout
- Menu structure changes (new items, removed items)

---

## Appendix: Known UI Elements

### A.1 Location Page Elements

| Element          | Selector Strategy                                         | Notes                        |
| ---------------- | --------------------------------------------------------- | ---------------------------- |
| Sign In button   | `button "SIGN IN / JOIN"`                                 | Header                       |
| Location heading | `heading "Select a Location"`                             | Confirms page loaded         |
| Nearest button   | `button "Find the nearest location"`                      | Geolocation                  |
| State filters    | `button "arizona"`, `button "colorado"`, `button "texas"` | Scroll to state              |
| Location cards   | `generic [cursor=pointer]` with `heading` child           | Each location                |
| Order Now        | `button "Order Now"` per location                         | Opens menu for that location |
| Map              | `region "Map"` with embedded Google Maps                  | Visual only                  |

### A.2 Menu Page Elements (Expected)

| Element               | Purpose                 | Discovery Notes                              |
| --------------------- | ----------------------- | -------------------------------------------- |
| Category tabs         | Navigate menu sections  | `button "Chicken"`, `button "Tenders"`, etc. |
| Menu item cards       | Individual food items   | Cards with image, name, price                |
| Add button            | Add item to bag         | `button "Add"` or `button "+"` per item      |
| Bag icon              | View current bag        | Badge showing item count                     |
| Item quantity in card | Shows if already in bag | Small count badge on item card               |

### A.3 Modify/Customization View Elements (Expected)

| Element           | Purpose                      | Notes                                                 |
| ----------------- | ---------------------------- | ----------------------------------------------------- |
| Group headings    | Customization group names    | "Free Sauces x2", "Ingredients"                       |
| Radio buttons     | Single-select options        | Protein, bun type                                     |
| Checkboxes        | Multi-select options         | Toppings, sauces                                      |
| ADD TO BAG button | Confirm customization        | `button "ADD TO BAG"` or `[data-cy="add-to-bag-btn"]` |
| Price display     | Shows running price          | Updates as customizations change                      |
| Discard dialog    | Appears when navigating away | "Yes, Discard Changes" button                         |

### A.4 Checkout Page Elements (Expected)

| Element             | Purpose           | Notes                          |
| ------------------- | ----------------- | ------------------------------ |
| Order type selector | Pickup / Delivery | Radio or toggle                |
| Pickup time         | ASAP or scheduled | Dropdown or custom             |
| Name fields         | Customer name     | First/last inputs              |
| Phone field         | Contact number    | Tel input                      |
| Email field         | Receipt email     | Email input                    |
| Order summary       | Final item list   | Read-only                      |
| Subtotal/Tax/Total  | Price breakdown   | Read-only                      |
| Place Order button  | Submit order      | **REQUIRES USER CONFIRMATION** |

### A.5 Payment Elements (Expected)

| Element           | Purpose             | Notes                         |
| ----------------- | ------------------- | ----------------------------- |
| Card number input | CC number           | May be Stripe iframe          |
| Expiry input      | MM/YY               | May be combined or separate   |
| CVV input         | Security code       | May be Stripe iframe          |
| Cardholder name   | Name on card        | Standard input                |
| Billing ZIP       | Billing postal code | Standard input                |
| Tip selector      | Tip amount          | Radio buttons or custom input |
| Total with tip    | Final amount        | Updated dynamically           |

---

## Implementation Notes for Codex

### Priority Order

1. **Phase 1: Location selection + menu navigation** — Get to the menu page reliably
2. **Phase 2: Item browsing + simple add-to-bag** — Add uncustomized items
3. **Phase 3: Full customization workflow** — Modify view automation
4. **Phase 4: Cart management + checkout** — Bag review and checkout form
5. **Phase 5: Payment automation** — Payment form filling
6. **Phase 6: Conversational polish** — Natural language handling, error messages

### Key Technical Challenges

1. **Dynamic content loading** — Menu sections may lazy-load; ensure content is present before interacting
2. **Contenteditable inputs** — Some form fields may use contenteditable divs (similar to Codex Web)
3. **Stripe iframes** — Payment fields in Stripe Elements require iframe context switching
4. **data-cy selectors** — Leverage these when available for the most stable automation
5. **Discard dialog handling** — Navigating away from Modify view triggers a confirmation dialog
6. **Menu variability** — Menu may differ by location and time of day (breakfast vs lunch/dinner)

### Repository Context

- **Repo:** `dgarson/clawdbrain`
- **Skill location:** `skills/food-birdcall/`
- **Existing skill patterns:** See `skills/food-order/SKILL.md` for safety rules pattern
- **Browser tool docs:** The `browser` tool in OpenClaw supports: start, stop, open, snapshot, screenshot, navigate, act (click/type/press/hover/drag/select/fill/wait/evaluate)
- **Snapshot format:** ARIA accessibility tree with refs; use `refs=aria` for stable refs

---

_End of Specification_
