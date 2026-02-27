# POS-less Restaurant Operating System (MVP) - Design Specs

## Project Overview
**Project Name:** Restaurant OS POS-less
**Project ID:** `7693128086382679756`
**Goal:** Create an extremely simple, fast-to-understand system for small & mid-size Indian restaurants.

## Design Goals
- **Extremely simple**: Minimal learning curve.
- **Fast to understand**: Intuitive UI.
- **Works for small & mid-size Indian restaurants**.
- **No POS machines**.
- **Mobile-first for customers**.
- **TV-friendly for kitchen**.
- **Desktop-friendly for admin**.
- **Currency**: Indian Rupees (₹).

## Generated Screens (Stitch)

### Customer Mobile App (Indian Context)
1.  **Menu & Ordering** (`e94d84fd9f62439caac78846fe2d0e83`)
    - Sticky header, category list, item cards, floating "View Cart", INR Prices, Veg/Non-Veg icons.
2.  **Cart Confirmation** (`269cb36939d44e30ba98e6f21818dfdf`)
    - Item list, quantity controls, "Place Order" button, GST breakdown, Pay at counter note.
3.  **Order Success** (`6e2ed6595eb14048b20a7b3423ecbfd8`)
    - Success icon, Order ID, "Pay at counter" message.

### Waiter App (Mobile)
4.  **Waiter Login** (`a4687d1672c749bfa62d4d206eb36e22`)
    - Thumb-friendly layout, large input fields for Mobile+PIN.
5.  **Waiter Dashboard** (`f38daeb84de945b5a4469353a2d2e9a2`)
    - **[NEW]** Grid of tables, Status colors (Green/Red/Yellow), Table numbers.

### Kitchen Display System (KDS)
6.  **KDS Dashboard** (`a885db2399fe43fea44bfbb35b03e3e4`)
    - Full-screen dark mode, large text, order cards with timers.

### Admin Panel (INR Metrics)
7.  **Admin Login** (`f0c74f56d98644ba999977e589d3ad52`)
    - Simple secure login card.
8.  **Admin Dashboard** (`d50cda62d71c4f05ad48ae31b3348ae7`)
    - Live metrics, active orders table, Revenue in ₹.
9.  **Order History** (`4f5a8eec6c1f40b28fd69cb1f2362b39`)
    - Data table with date filters, status search, Grand Total in ₹.
10. **Menu Management** (`8f7015a1e26e4c658ced715f69f94ad0`)
    - Category sidebar, item list, INR prices, availability toggles.
11. **Tables & QR Management** (`8d3ab1c973c7423abd972fd2dbf6d40d`)
    - Grid of tables, QR code download/print actions.
12. **Staff Management** (`3615d65bc4f04dcf930493f78ac2a27e`)
    - **[NEW]** Staff list, Role badges (Waiter/Chef/Admin), PIN management.
13. **Restaurant Settings** (`a4d36f042499453999edcd47d031628b`)
    - Profile, business hours, tax & fee configuration.

## Screen Details

... [Sections 1-4 Unchanged] ...

### 5. Waiter Dashboard (Mobile)
- **User:** Waiter.
- **Layout:** Grid of table cards.
- **Features:** Status colors (Green=Free, Red=Occupied, Yellow=Ready).

... [Sections 6-11 Unchanged] ...

### 12. Staff Management Page (Admin)
- **User:** Admin.
- **Layout:** Staff List Table.
- **Columns:** Name, Role, Mobile, PIN, Actions.

### 13. Restaurant Settings Page (Admin)
- **User:** Admin.
- **Layout:** Forms for Restaurant Details, Hours, Taxes.
