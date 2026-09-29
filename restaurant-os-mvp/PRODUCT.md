# Product

## Register

product

## Users

Waiters and floor staff at Indian dine-in restaurants using the Dine in One platform. They work standing, phone in one hand, mid-shift during lunch and dinner rushes. Every interaction is a 2–5 second glance between tables: check the floor, accept a service request, serve food that just came ready, settle a bill. Accuracy and speed under pressure matter more than exploration or delight.

## Product Purpose

The waiter panel is the operational heart of Dine in One's dine-in SaaS: a realtime floor-management surface covering table state tracking, service-request response (call waiter, water, cutlery, bill), kitchen-ready pickups, order placement on behalf of guests, bill settlement, and table merging/assignment. Success = zero missed requests during a full-capacity shift.

## Brand Personality

Swift, sharp, dependable. Calm confidence — the interface should feel like a well-run restaurant: quiet, precise, instantly responsive. Never playful-consumer, never dense enterprise-gray.

## Anti-references

- Generic admin-dashboard gray (rows of identical muted cards, no hierarchy)
- The current app's inconsistency: three unrelated design languages across screens
- Decorative glassmorphism and gradient text that trade legibility for style
- Consumer-social playfulness (bounces, confetti) in an operations tool

## Design Principles

1. **Glanceable first** — any table's status readable at arm's length in under two seconds; status color is the primary signal.
2. **Motion signals state** — animation confirms what changed (request accepted, food ready, merge selected); never decorates idle UI.
3. **One accent carries identity** — deep lagoon teal is the brand voice for navigation, selection, and primary actions; semantic status colors (emerald ready, amber cooking, coral urgent) are never borrowed for decoration.
4. **Thumb-zone ergonomics** — primary actions live in the bottom third; every tap target ≥44px for one-handed use.
5. **Honest data** — no invented people or numbers; empty states teach the workflow instead of faking activity.

## Accessibility & Inclusion

- WCAG AA contrast minimums for all text and status indicators (never color alone — pair hue with icon/label).
- `prefers-reduced-motion` honored: springs collapse to fades, pulses stop.
- Touch targets ≥44px; timers and prices use tabular numerals so digits don't jitter.
