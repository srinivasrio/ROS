# Restaurant OS MVP - Complete Project Documentation

> **Product Name:** Dine In One
> **Repo:** restaurant-os-mvp
> **Type:** Multi-tenant SaaS restaurant operating system
> **Last Updated:** 2026-06-22 (restructured)

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Environment Variables](#environment-variables)
4. [Project Structure](#project-structure)
5. [User Roles & Access Control](#user-roles--access-control)
6. [Panels & Features](#panels--features)
   - [Landing Page](#1-landing-page)
   - [Admin Panel](#2-admin-panel)
   - [Customer Panel](#3-customer-panel)
   - [Waiter Panel](#4-waiter-panel)
   - [KDS (Kitchen Display System)](#5-kds-kitchen-display-system)
   - [Manager Panel](#6-manager-panel)
   - [SaaS Super Admin](#7-saas-super-admin-panel)
7. [Supabase Database](#supabase-database)
8. [Cloudflare R2 Storage](#cloudflare-r2-storage)
9. [Services Layer](#services-layer)
10. [Context Providers](#context-providers)
11. [API Routes](#api-routes)
12. [Middleware & Auth](#middleware--auth)
13. [Components Library](#components-library)
14. [Real-time Features](#real-time-features)
15. [AI Integrations](#ai-integrations)
16. [SaaS Admin Deep Dive](#saas-admin-deep-dive)
17. [Database Migrations](#database-migrations)
18. [Scripts & Utilities](#scripts--utilities)
19. [Deployment & Dev](#deployment--dev)

---

## Tech Stack

### Main App (Port 3000)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | 5.x |
| UI Library | React | 19.2.3 |
| Styling | Tailwind CSS | 4.x |
| Animations | Framer Motion | 12.31.0 |
| Icons | Lucide React | 0.563.0 |
| Charts | Recharts | 3.8.0 |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js 2.94.1 |
| Auth | Supabase Auth + SSR | @supabase/ssr 0.8.0 |
| Object Storage | Cloudflare R2 (S3-compatible) | @aws-sdk/client-s3 3.1051.0 |
| Image Compression | browser-image-compression | Client-side |
| Drag & Drop | @dnd-kit/core + sortable | 6.3.1 / 10.0.0 |
| QR Codes | react-qr-code | 2.0.18 |
| Printing | react-to-print | 3.2.0 |
| Markdown | react-markdown + remark-gfm | 10.1.0 |
| Toasts | Sonner | 2.0.7 |
| Theming | next-themes | 0.4.6 |
| AI (Google) | @google/generative-ai | 0.24.1 |
| AI (Sarvam) | Sarvam AI API | via API key |
| OpenAI | openai | 6.25.0 |
| DB Driver | pg | 8.20.0 |
| Faker | @faker-js/faker | 10.3.0 |
| CSS Utilities | clsx, tailwind-merge | latest |

### SaaS Admin App (Port 3002)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.1.7 |
| UI Library | React | 19.2.4 |
| Database | Supabase | @supabase/supabase-js 2.99.2 |
| Animations | Framer Motion | 12.38.0 |
| Icons | Lucide React | 0.577.0 |
| CSS Utilities | clsx, tailwind-merge | latest |

---

## Architecture Overview

```
                    +--------------------------+
                    |     Landing Page (/)      |
                    |  Marketing + Auth Pages   |
                    +-----------+--------------+
                                |
                    +-----------v--------------+
                    |      Middleware.ts         |
                    |  Auth + RBAC + Routing     |
                    +-----------+--------------+
                                |
          +---------------------+---------------------+
          |                     |                     |
+---------v--------+  +---------v--------+  +---------v--------+
| /[restaurantCode]|  | /[restaurantCode]|  | /[restaurantCode]|
|     /admin/*     |  |   /customer/*    |  |    /waiter/*     |
|  (Restaurant     |  | /[tableNumber]/* |  | /[staffMobile]/* |
|   Admin Panel)   |  | (Customer Panel) |  |  (Waiter Panel)  |
+------------------+  +------------------+  +------------------+
          |                     |                     |
          |           +---------v--------+            |
          |           | /[restaurantCode]|            |
          |           |     /kds/*       |            |
          |           | (Kitchen Display)|            |
          |           +------------------+            |
          |                                           |
+---------v-------------------------------------------v--------+
|                     Services Layer                            |
|  menu.ts | orders.ts | staff.ts | analytics.ts | etc.        |
+-----------------------------+--------------------------------+
                              |
              +---------------v---------------+
              |          Supabase              |
              |  PostgreSQL + Auth + Realtime  |
              +-------------------------------+
                              |
              +---------------v---------------+
              |        Cloudflare R2           |
              |     Image/Asset Storage        |
              +-------------------------------+

              +-------------------------------+
              |     SaaS Admin (Port 3002)     |
              |   Super Admin Dashboard        |
              |   /saas-admin/*                |
              +-------------------------------+
```

### Multi-Tenancy Model

- URL pattern: `/{restaurantCode}/{panel}/{params}`
- `restaurantCode` = UUID or numeric restaurant ID
- Each restaurant has isolated data via `restaurant_id` column + Supabase RLS
- Customer routes include `[tableNumber]` for QR-code-based dine-in ordering
- Waiter routes include `[staffMobile]` for staff identification

---

## Environment Variables

### Supabase (Primary - Restaurant Data)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key
- `NEXT_PUBLIC_PRIMARY_SUPABASE_URL` - Alias for primary Supabase URL
- `NEXT_PUBLIC_PRIMARY_SUPABASE_ANON_KEY` - Alias for primary anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side service role key (full access)

### Supabase (SaaS Admin Data)
- `NEXT_PUBLIC_SAAS_SUPABASE_URL` - SaaS admin Supabase URL (redirected to primary in dev)
- `NEXT_PUBLIC_SAAS_SUPABASE_ANON_KEY` - SaaS admin anon key
- `SAAS_SUPABASE_SERVICE_ROLE_KEY` - SaaS admin service role key

### Cloudflare R2
- `CLOUDFLARE_R2_ACCESS_KEY_ID` - R2 access key
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY` - R2 secret key
- `CLOUDFLARE_R2_ENDPOINT` - R2 S3-compatible endpoint (`https://{accountId}.r2.cloudflarestorage.com`)
- `CLOUDFLARE_R2_BUCKET_NAME` - Bucket name (`dineinone-assets`)
- `NEXT_PUBLIC_R2_PUBLIC_URL` - Public CDN URL for R2 (`https://pub-*.r2.dev`)

### AI Services
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google Gemini AI API key
- `SARVAM_AI_API_KEY` - Sarvam AI API key (Indian language AI)

---

## Project Structure

> **Convention:** `app/` contains ONLY routes. All shared code lives at root level.
> **Import alias:** `@/*` maps to project root (e.g., `@/lib/supabase`, `@/services/menu.service`, `@/components/admin/...`)

```
restaurant-os-mvp/
├── app/                                    # ROUTES ONLY
│   ├── layout.tsx                          # Root layout (ThemeProvider, RestaurantProvider, GlobalContext, Toaster)
│   ├── page.tsx                            # Landing page (marketing)
│   ├── globals.css                         # Global styles
│   │
│   ├── (auth)/                             # Auth route group (URLs unchanged)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── waiting-approval/page.tsx
│   │
│   ├── portal/route.ts                     # Portal redirect route
│   ├── auth/callback/route.ts              # OAuth callback handler
│   │
│   ├── [restaurantCode]/                   # Multi-tenant routes
│   │   ├── admin/                          # Restaurant admin panel
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── menu/page.tsx
│   │   │   ├── orders/page.tsx
│   │   │   ├── staff/page.tsx
│   │   │   ├── services/page.tsx
│   │   │   ├── tables/page.tsx
│   │   │   ├── specials/page.tsx
│   │   │   ├── offers/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   ├── live-kitchen/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── homepage-builder/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   ├── customers/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── inventory/
│   │   │       ├── layout.tsx, page.tsx
│   │   │       ├── alerts/page.tsx
│   │   │       ├── calendar/page.tsx
│   │   │       └── recipes/page.tsx
│   │   │
│   │   ├── customer/                       # Customer-facing panel
│   │   │   ├── layout.tsx
│   │   │   ├── home/[tableNumber]/page.tsx
│   │   │   ├── menu/[tableNumber]/page.tsx
│   │   │   ├── cart/[tableNumber]/page.tsx
│   │   │   ├── myorders/[tableNumber]/page.tsx
│   │   │   ├── specials/[tableNumber]/page.tsx
│   │   │   ├── combos/[tableNumber]/page.tsx
│   │   │   ├── offers/[tableNumber]/page.tsx
│   │   │   ├── service/[tableNumber]/page.tsx
│   │   │   ├── services/[tableNumber]/page.tsx
│   │   │   └── status/[tableNumber]/[orderId]/page.tsx
│   │   │
│   │   ├── waiter/                         # Waiter panel
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── [staffMobile]/
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── alerts/page.tsx
│   │   │   │   ├── kitchen/page.tsx
│   │   │   │   ├── profile/page.tsx
│   │   │   │   ├── menu/[tableId]/page.tsx
│   │   │   │   └── order/[tableId]/page.tsx
│   │   │   ├── components/                 # Waiter-specific components (co-located)
│   │   │   │   ├── BottomNav.tsx
│   │   │   │   ├── OrderReadyModal.tsx
│   │   │   │   └── WaiterAlertSystem.tsx
│   │   │   └── context/                    # Waiter-specific context (co-located)
│   │   │
│   │   ├── kds/                            # Kitchen Display System
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── manager/page.tsx
│   │   ├── portal/page.tsx
│   │   └── staff/[staffMobile]/dashboard/page.tsx
│   │
│   └── api/                                # API routes
│       ├── upload/route.ts
│       ├── media/private/route.ts
│       ├── lookup-phone/route.ts
│       └── admin/migrate-homepage/route.ts
│
├── components/                             # ALL shared components (import as @/components/...)
│   ├── admin/
│   │   ├── analytics/                      # Charts & data viz
│   │   │   ├── DetailedTable.tsx
│   │   │   ├── ProfessionalCharts.tsx
│   │   │   └── TimeFilter.tsx
│   │   ├── homepage-builder/               # Homepage builder tools
│   │   │   ├── BannerManager.tsx, DataBrowser.tsx, EditableElement.tsx
│   │   │   ├── ImageUploader.tsx, LivePreview.tsx, PropertiesPanel.tsx
│   │   │   └── SectionManager.tsx
│   │   ├── payroll/                        # Payroll components
│   │   │   ├── AttendanceTab.tsx, EmployeeModal.tsx, EmployeesTab.tsx
│   │   │   ├── PayrollTab.tsx, ReportsTab.tsx
│   │   ├── AddStaffModal.tsx
│   │   ├── CreateOfferModal.tsx
│   │   ├── OrderDetailsModal.tsx
│   │   └── OrderKanbanBoard.tsx
│   ├── customer/
│   │   ├── CustomerBottomNav.tsx
│   │   ├── PersistentHome.tsx, PersistentMenu.tsx, PersistentOrders.tsx
│   │   ├── PersistentProfile.tsx, PersistentService.tsx
│   │   ├── BillRequestModal.tsx, WaiterCallModal.tsx
│   │   ├── Redirector.tsx, SharedSkeleton.tsx
│   ├── kitchen/KitchenTicket.tsx
│   ├── landing/                            # Marketing page sections
│   │   ├── Navbar.tsx, HeroSection.tsx, ProblemSection.tsx, SolutionSection.tsx
│   │   ├── FeaturesGrid.tsx, PanelsSection.tsx, PricingSection.tsx
│   │   ├── FAQSection.tsx, CTABanner.tsx, ContactSection.tsx
│   │   ├── Footer.tsx, RevealMotion.tsx
│   ├── shared/
│   │   ├── MainHeader.tsx, SharedComboCard.tsx, SharedQuantityControl.tsx
│   │   ├── cart/SharedFloatingCart.tsx
│   │   ├── homepage/BannerSlider.tsx, SharedHomepageLayout.tsx
│   │   └── services/SharedServicePopupCard.tsx
│   ├── ui/
│   │   ├── ConfirmationModal.tsx
│   │   └── LoadingState.tsx
│   ├── ThemeProvider.tsx, ThemeToggle.tsx
│   ├── CountdownTimer.tsx, Timer.tsx
│   └── InvoiceComponent.tsx
│
├── context/                                # React Context providers (import as @/context/...)
│   ├── RestaurantContext.tsx
│   ├── GlobalContext.tsx
│   └── CartContext.tsx
│
├── hooks/                                  # Custom React hooks (import as @/hooks/...)
│   ├── useRestaurantId.ts
│   └── useScrollReveal.ts
│
├── lib/                                    # Core utilities (import as @/lib/...)
│   ├── supabase.ts                         # Supabase browser client
│   ├── supabase-server.ts                  # Supabase server client
│   ├── r2.ts                               # Cloudflare R2 S3 client
│   ├── image-compress.ts                   # Client-side image compression
│   ├── data-cache.ts                       # Data caching utilities
│   ├── context-validator.ts                # Multi-tenant context validation
│   ├── utils.ts                            # Shared utilities (cn, formatCurrency, etc.)
│   └── service-utils.ts                    # Service layer utilities
│
├── services/                               # Business logic layer (import as @/services/...)
│   │                                       # ALL files use .service.ts naming convention
│   ├── analytics.service.ts                # Sales & analytics
│   ├── banner.service.ts                   # Banner management
│   ├── customers.service.ts                # Customer profiles
│   ├── festival.service.ts                 # Festival/event specials
│   ├── homepage-builder.service.ts         # Homepage customization
│   ├── homepage-cache.service.ts           # Homepage caching
│   ├── inventory.service.ts                # Inventory tracking
│   ├── menu.service.ts                     # Menu CRUD
│   ├── offers.service.ts                   # Promotional offers
│   ├── orders.service.ts                   # Order management
│   ├── payroll.service.ts                  # Payroll & attendance
│   ├── query-monitor.service.ts            # Query performance monitoring
│   ├── recipe.service.ts                   # Recipe & ingredients
│   ├── registration.service.ts             # Restaurant onboarding
│   ├── restaurant.service.ts               # Restaurant profile & settings
│   ├── service-options.service.ts          # Service requests (call waiter, etc.)
│   ├── specials.service.ts                 # Daily specials
│   ├── staff.service.ts                    # Staff management
│   ├── staff-tasks.service.ts              # Staff task assignment
│   ├── supplier.service.ts                 # Supplier management
│   ├── universal-homepage.service.ts       # Universal homepage data aggregator
│   ├── users.service.ts                    # User profiles & auth
│   └── utils.service.ts                    # Restaurant config fetcher & BoundedCache
│
├── scripts/                                # Utility & DB scripts
│   ├── db/                                 # Database utility scripts
│   ├── seed-minerva-menu.ts
│   ├── migrate-images-to-storage.ts
│   ├── migrate-supabase-to-r2.ts
│   └── ...
│
├── supabase/migrations/                    # 24 migration files
│
├── saas-admin/                             # Separate SaaS Super Admin App (port 3002)
│   ├── app/
│   │   ├── layout.tsx, page.tsx            # Main super admin dashboard
│   │   └── api/                            # restaurants/, approve/, delete/, admin-data/
│   ├── components/
│   │   ├── CommandPalette.tsx, ComplianceDashboard.tsx, ImpersonationBanner.tsx
│   │   └── modules/                        # 19 feature modules
│   ├── lib/supabase.ts, services/
│   └── styles/globals.css
│
├── middleware.ts                            # Auth & routing middleware
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── marketing-repo/                         # Separate Vite + React marketing site
```

---

## User Roles & Access Control

### Roles (stored in `users.role` column)

| Role | Access | Description |
|------|--------|-------------|
| `saas_admin` | Full platform access | Super admin managing all restaurants |
| `restaurant_admin` | Full restaurant access | Restaurant owner/manager (requires `is_approved` = true) |
| `manager` | Admin + Waiter panels | Restaurant manager |
| `waiter` | Waiter panel | Front-of-house staff |
| `customer` | Customer panel | Dine-in customers (anonymous via QR code) |

### Authentication Flow

1. **Registration:** User signs up via `/register` -> Creates Supabase Auth user + `users` table profile
2. **Approval:** `is_approved` defaults to `false` -> User sees `/waiting-approval` page
3. **SaaS Admin approves** via SaaS Admin dashboard -> `is_approved` = true
4. **Login:** Authenticated user redirected to `/portal` -> Then to `/{restaurantId}/admin/dashboard`
5. **Customer Access:** No auth required - QR code scans go directly to `/{restaurantCode}/customer/home/{tableNumber}`

### Middleware Route Protection

- `/admin/*` -> Requires `restaurant_admin` role
- `/waiter/*` -> Requires `restaurant_admin`, `waiter`, or `manager` role
- `/kds/*` -> Requires authenticated user
- `/manager/*` -> Requires authenticated user
- `/customer/*` -> Public (no auth required, table number from URL)
- Old root paths (`/admin`, `/waiter`, `/kitchen`) -> Auto-redirect to `/{restaurantId}/...`
- Restaurant ownership validated: users can only access their own restaurant's data
- Branch access validated if multi-branch is enabled

---

## Panels & Features

### 1. Landing Page

**Route:** `/`

Full marketing landing page with scroll-reveal animations:

- **Navbar** - Navigation with login/register CTAs
- **HeroSection** - Main value proposition
- **ProblemSection** - Pain points restaurants face
- **SolutionSection** - How Dine In One solves them
- **FeaturesGrid** - Feature showcase grid
- **PanelsSection** - Showcase of admin/customer/waiter/KDS panels
- **PricingSection** - Subscription tiers
- **FAQSection** - Frequently asked questions
- **CTABanner** - Call to action
- **ContactSection** - Contact form
- **Footer** - Links and legal

---

### 2. Admin Panel

**Route:** `/{restaurantCode}/admin/*`
**Role Required:** `restaurant_admin`

#### Dashboard (`/admin/dashboard`)
- Real-time order statistics (pending, preparing, ready, completed today)
- Today's revenue counter
- OrderKanbanBoard - Drag-and-drop order management across status columns
- Real-time Supabase subscriptions for live order updates
- Sound notifications for new orders (configurable)
- Filters: status, table number, date range

#### Menu Management (`/admin/menu`)
- **Categories:** Add, edit, delete (soft-delete), reorder via drag-and-drop
- **Menu Items:** Full CRUD with:
  - Name, price, description
  - Image upload (R2 with client-side compression to WebP, max 800px, 0.3MB)
  - Veg/Non-veg toggle
  - Availability toggle
  - Category assignment
- Bulk availability toggle
- Search and filter by category

#### Order Management (`/admin/orders`)
- Order list with status progression
- Status flow: `pending` -> `confirmed` -> `preparing` -> `ready` -> `served` -> `completed`
- Order details modal (items, customer info, special instructions)
- Real-time updates via Supabase Realtime

#### Staff Management (`/admin/staff`)
- Add/edit/remove staff members
- Role assignment (waiter, manager, kitchen)
- Staff profiles with mobile number, name, role
- AddStaffModal component

#### Service Options (`/admin/services`)
- Configure service request buttons customers see (Call Waiter, Water, Bill, etc.)
- Service types: dine-in, takeaway, delivery, bar
- Enable/disable individual service options
- Custom icons and names

#### Table Management (`/admin/tables`)
- Add/edit/delete tables with table numbers
- QR code generation for each table (links to customer ordering page)
- Table status tracking: available, occupied, reserved
- Bulk QR code download and print

#### Specials Management (`/admin/specials`)
- CRUD for daily specials
- Fields: title, description, original price, special price, image, badge text
- Day-of-week scheduling (Mon-Sun toggles)
- Time-based availability (start_time, end_time)
- Display order management
- Active/inactive toggle

#### Offers Management (`/admin/offers`)
- Create promotional offers with CreateOfferModal
- Discount types: percentage, fixed amount
- Min order value, max discount caps
- Validity dates (valid_from, valid_until)
- Coupon codes
- Usage limits and tracking
- Terms and conditions

#### Analytics (`/admin/analytics`)
- Revenue charts (daily/weekly/monthly) via Recharts
- Order volume trends
- Popular items ranking
- Table utilization stats
- Peak hours analysis
- Date range filtering

#### Live Kitchen View (`/admin/live-kitchen`)
- Real-time view of kitchen operations
- Order preparation progress

#### Homepage Builder (`/admin/homepage-builder`)
- Drag-and-drop homepage customization
- Section types: hero, specials, offers, menu highlights, custom
- Components: BannerManager, SectionManager, LivePreview, PropertiesPanel, EditableElement, DataBrowser
- Real-time live preview
- Image upload with ImageUploader

#### Inventory Management (`/admin/inventory/*`)
- Stock tracking with low-stock alerts
- Inventory calendar view
- Recipe/ingredient management
- Sub-routes: `/inventory`, `/inventory/alerts`, `/inventory/calendar`, `/inventory/recipes`

#### Order History (`/admin/history`)
- Historical transaction/order logs
- Search and filter past orders

#### About/Restaurant Info (`/admin/about`)
- Restaurant profile management

#### Customer Management (`/admin/customers`)
- Customer profiles and history

#### Settings (`/admin/settings`)
- Restaurant configuration

---

### 3. Customer Panel

**Route:** `/{restaurantCode}/customer/*`
**Auth Required:** No (public, accessed via QR code)
**URL Pattern:** All routes include `[tableNumber]` for dine-in context

#### Home (`/customer/home/{tableNumber}`)
- Uses PersistentHome wrapper (maintains state across tab switches)
- Renders SharedHomepageLayout with:
  - Hero banner
  - Daily specials carousel
  - Promotional offers
  - Menu highlights
- Data fetched via `universal-homepage.service.ts` (aggregates all homepage data in one call)

#### Menu (`/customer/menu/{tableNumber}`)
- Uses PersistentMenu wrapper
- Browse menu by categories (scrollable category tabs)
- Item cards: name, price, image, veg/non-veg indicator, description
- Add to cart with quantity selector and special instructions
- Only shows active (`is_active`) and available (`is_available`) items
- Search functionality

#### Cart (`/customer/cart/{tableNumber}`)
- Full cart management via CartContext (localStorage-persisted)
- Quantity adjustment (+/-)
- Special instructions per item
- Order summary with subtotal calculation
- Customer name and phone collection before ordering
- Place order button -> Creates order in Supabase

#### My Orders (`/customer/myorders/{tableNumber}`)
- Uses PersistentOrders wrapper
- View active and past orders
- Real-time status tracking per order

#### Order Status (`/customer/status/{tableNumber}/{orderId}`)
- Detailed order status tracking page
- Real-time status updates

#### Specials (`/customer/specials/{tableNumber}`)
- Browse daily specials
- Shows original vs. special price with discount badge
- Time-based availability display
- Add specials to cart

#### Combos (`/customer/combos/{tableNumber}`)
- Combo deal browsing
- SharedComboCard component

#### Offers (`/customer/offers/{tableNumber}`)
- View all available promotional offers
- Apply coupon codes

#### Service Requests (`/customer/service/{tableNumber}`)
- Uses PersistentService wrapper
- Service request buttons (Call Waiter, Water, Bill, Tissue, etc.)
- Request status tracking: pending -> accepted -> completed
- Cancel pending requests
- Real-time status updates via Supabase Realtime

#### Bottom Navigation
- Fixed bottom nav via CustomerBottomNav
- Tabs: Home, Menu, Cart (with item count badge), Orders, Service
- Dynamic active state based on current route
- Restaurant-themed colors

---

### 4. Waiter Panel

**Route:** `/{restaurantCode}/waiter/{staffMobile}/*`
**Role Required:** `waiter`, `manager`, or `restaurant_admin`

#### Login (`/waiter/login`)
- Staff login via mobile number

#### Dashboard (`/waiter/{staffMobile}/dashboard`)
- Active orders assigned to this waiter
- Real-time order updates
- Quick status change buttons (confirm, mark ready, mark served)
- Table assignments view
- Expandable order details

#### Alerts (`/waiter/{staffMobile}/alerts`)
- WaiterAlertSystem component (complex, ~37KB)
- Real-time Supabase subscription for service requests
- Sound and visual notifications for new requests
- Accept/complete request flow
- **Atomic single-waiter assignment** - prevents race conditions where two waiters accept the same request
- Filtered to show only relevant alerts for the specific waiter
- Alert categories based on service option type

#### Kitchen View (`/waiter/{staffMobile}/kitchen`)
- View kitchen order status from waiter perspective

#### Profile (`/waiter/{staffMobile}/profile`)
- Waiter profile management

#### Table Menu & Order (`/waiter/{staffMobile}/menu/{tableId}`, `/order/{tableId}`)
- Browse menu on behalf of a customer at a table
- Create orders for a table

#### Components
- **BottomNav** - Waiter-specific bottom navigation
- **OrderReadyModal** - Notification when an order is ready for pickup
- **WaiterAlertSystem** - Real-time alert management system

---

### 5. KDS (Kitchen Display System)

**Route:** `/{restaurantCode}/kds/*`

- Real-time order feed via Supabase Realtime subscriptions
- Order tickets displayed in preparation pipeline
- Status progression buttons: confirmed -> preparing -> ready
- Order items with special instructions highlighted
- Color-coded by status/urgency
- Timer for order duration tracking
- Auto-refresh and sound alerts for new orders
- KitchenTicket component for individual order display

---

### 6. Manager Panel

**Route:** `/{restaurantCode}/manager`

- Manager-level dashboard with overview of operations
- Access to both admin and waiter functionality

---

### 7. SaaS Super Admin Panel

**Route:** Separate app on Port 3002 (`saas-admin/`)
**Product Name:** Dine In One SaaS Platform Admin

#### Sidebar Navigation (4 categories, 19 modules)

**Operations:**
| Module | Description |
|--------|-------------|
| Dashboard | KPIs: total restaurants, users, live orders, revenue, staff count. Quick navigation tiles |
| Restaurants | List all restaurants, approve/reject pending registrations, impersonate restaurant admins, suspend/unsuspend, change subscription plans |
| Branches | Multi-branch management across restaurants |
| Live Monitoring | Real-time system health and order activity |
| Devices | Device management across restaurants |

**Support & CRM:**
| Module | Description |
|--------|-------------|
| Staff & Roster | Cross-restaurant staff overview |
| Support Center | Support ticket management |
| Announcements | System-wide notifications to restaurants |

**Financials:**
| Module | Description |
|--------|-------------|
| Subscriptions | Manage restaurant subscription tiers |
| Payments | Payment processing and tracking |
| Analytics | Cross-platform analytics and trends |

**Infrastructure:**
| Module | Description |
|--------|-------------|
| Storage & CDN | Cloudflare R2 storage usage monitoring |
| Feature Flags | Toggle features per restaurant |
| Backups | Database backup management |
| Audit Logs | System audit trail |
| Updates & OTA | System update management |
| Security Center | Security settings and monitoring |
| API Monitoring | API performance and health |
| Settings | Global platform settings |

#### Super Admin Features

1. **Restaurant Onboarding:**
   - View pending registrations
   - Approve restaurants (creates restaurant record, enables admin access)
   - Reject/delete registrations

2. **Impersonation Mode:**
   - Enter any restaurant's admin view
   - Two modes: `readonly` (view only) and `full` (can take actions)
   - Orange impersonation banner shown during session
   - Tab views: Overview, Menu, Orders, Staff
   - Mock data for safe exploration

3. **Restaurant Management:**
   - Suspend/unsuspend restaurants
   - Change subscription plans
   - View restaurant details (location, phone, email, compliance)

4. **Command Palette:**
   - `Cmd+K` keyboard shortcut
   - Quick navigation to any module
   - Search restaurants
   - Quick impersonation

5. **Compliance Dashboard:**
   - FSSAI license tracking per restaurant
   - Expiry date monitoring
   - Document verification
   - Alert system for expiring licenses

---

## Supabase Database

### Tables (inferred from services and migrations)

#### Core Tables

| Table | Key Columns | Description |
|-------|------------|-------------|
| `users` | id, email, role, is_approved, restaurant_id, branch_id, phone, name | User accounts with roles |
| `restaurants` | id, code, name, logo_url, primary_color, secondary_color, font, border_radius, button_style, currency, veg_only, business_type, status, subscription_plan | Restaurant profiles |
| `branches` | id, restaurant_id, name, code | Multi-branch support |

#### Menu Tables

| Table | Key Columns | Description |
|-------|------------|-------------|
| `categories` | id, restaurant_id, name, display_order, is_active | Menu categories |
| `menu_items` | id, category_id, restaurant_id, name, price, description, image_url, is_veg, is_available, is_active | Menu items |

#### Order Tables

| Table | Key Columns | Description |
|-------|------------|-------------|
| `orders` | id, table_number, restaurant_id, status, total_amount, customer_name, customer_phone, created_at | Orders |
| `order_items` | id, order_id, menu_item_id, quantity, unit_price, subtotal, special_instructions, status | Order line items |

#### Staff Tables

| Table | Key Columns | Description |
|-------|------------|-------------|
| `staff` | id, user_id, restaurant_id, name, mobile, role | Staff members |
| `payroll` | id, staff_id, restaurant_id | Payroll records |
| `attendance` | id, staff_id, date | Attendance tracking |

#### Service Tables

| Table | Key Columns | Description |
|-------|------------|-------------|
| `service_options` | id, restaurant_id, name, icon, is_active | Configurable service buttons |
| `service_requests` | id, table_number, restaurant_id, service_option_id, status, quantity, assigned_to, accepted_by, accepted_at | Customer service requests |

#### Marketing Tables

| Table | Key Columns | Description |
|-------|------------|-------------|
| `specials` | id, restaurant_id, title, description, original_price, special_price, image_url, is_active, day_of_week, start_time, end_time, badge_text, display_order | Daily specials |
| `offers` | id, restaurant_id, title, description, discount_type, discount_value, code, min_order_value, max_discount, valid_from, valid_until, is_active, image_url, terms_conditions, usage_limit, used_count | Promotional offers |
| `banners` | id, restaurant_id, title, subtitle, image_url, link_url, is_active, display_order | Banner images |

#### Homepage Tables

| Table | Key Columns | Description |
|-------|------------|-------------|
| `homepage_sections` | id, restaurant_id, section_type, title, subtitle, content (JSONB), display_order, is_visible | Homepage customization |
| `section_style_settings` | id, section_id | Section styling |

#### Inventory Tables

| Table | Key Columns | Description |
|-------|------------|-------------|
| `inventory` | id, restaurant_id | Stock items |
| `inventory_categories` | id, restaurant_id | Inventory categories |
| `recipes` | id, restaurant_id | Recipe definitions |
| `ingredients` | id, recipe_id | Recipe ingredients |
| `suppliers` | id, restaurant_id | Supplier records |

#### System Tables

| Table | Key Columns | Description |
|-------|------------|-------------|
| `audit_logs` | id, action, user_id, restaurant_id | Audit trail |
| `realtime_subscriptions` | id | Realtime subscription config |

### Order Status Flow

```
pending -> confirmed -> preparing -> ready -> served -> completed
```

### Service Request Status Flow

```
pending -> accepted -> completed
                   \-> cancelled
```

### Row-Level Security (RLS)

- All tables use RLS policies scoped by `restaurant_id`
- Anonymous access enabled for customer-facing queries (service_requests, menu_items, etc.)
- Service role key used server-side for admin operations
- Migration `20260205_rls_public.sql` sets up base RLS policies
- Migration `20260520010000_add_service_requests_anon_policies.sql` adds anonymous policies

### Real-time Configuration

- Migration `20260529120000_configure_realtime.sql` sets up Supabase Realtime
- Tables with realtime enabled: orders, order_items, service_requests
- Used for: live order updates in admin/KDS, service request alerts for waiters, order status for customers

---

## Cloudflare R2 Storage

### Configuration

- **S3-Compatible API** via `@aws-sdk/client-s3`
- **Bucket:** `dineinone-assets`
- **Endpoint:** `https://{accountId}.r2.cloudflarestorage.com`
- **Public CDN:** `https://pub-fc925b324e51441ba1d8aef9ee47e211.r2.dev`

### Image Pipeline

1. **Client-side compression** (`app/lib/image-compress.ts`):
   - Max file size: 0.3MB
   - Max dimensions: 800x800px
   - Format: WebP preferred
   - Quality: 0.6
2. **Upload** via `POST /api/upload`:
   - Accepts file + optional folder parameter
   - Generates unique filename with timestamp
   - Uploads to R2 bucket
3. **Serve** via public CDN URL
4. **Private media** via `GET /api/media/private` (pre-signed URLs)

### Usage

- Menu item images
- Specials images
- Offer images
- Banner images
- Restaurant logos
- Homepage builder images

### Next.js Image Optimization

`next.config.ts` configures remote patterns for:
- `images.unsplash.com`
- `*.supabase.co`
- `pub-*.r2.dev` (Cloudflare R2 CDN)

---

## Services Layer

All services in `services/` (root level) use consistent `.service.ts` naming. Import as `@/services/...`:

| Service | File | Tables Used | Key Operations |
|---------|------|-------------|----------------|
| Utils | `utils.service.ts` | `restaurants` | Fetch restaurant config by code, BoundedCache |
| Menu | `menu.service.ts` | `categories`, `menu_items` | Full CRUD for categories and items, reordering, availability toggles |
| Orders | `orders.service.ts` | `orders`, `order_items` | Create orders, update status, real-time subscriptions, fetch by table/restaurant |
| Users | `users.service.ts` | `users` | Get current profile, authentication helpers |
| Staff | `staff.service.ts` | `staff` | Staff CRUD, role assignment |
| Customers | `customers.service.ts` | `customers` | Customer profiles, loyalty |
| Analytics | `analytics.service.ts` | `orders`, `order_items` | Revenue reports, KPIs, trends |
| Specials | `specials.service.ts` | `specials` | CRUD with day-of-week and time scheduling |
| Offers | `offers.service.ts` | `offers` | CRUD with discount calculations, coupon management |
| Banners | `banner.service.ts` | `banners` | Banner CRUD, ordering |
| Service Options | `service-options.service.ts` | `service_options`, `service_requests` | Configure service buttons, handle requests with atomic assignment |
| Homepage Builder | `homepage-builder.service.ts` | `homepage_sections` | Section CRUD, reordering, visibility |
| Homepage Cache | `homepage-cache.service.ts` | - | Cache management for homepage data |
| Universal Homepage | `universal-homepage.service.ts` | Multiple | Aggregates all homepage data (config, banners, specials, offers, highlights, sections) |
| Restaurant | `restaurant.service.ts` | `restaurants` | Profile management, business type, settings |
| Inventory | `inventory.service.ts` | `inventory`, `inventory_categories` | Stock tracking, alerts |
| Recipe | `recipe.service.ts` | `recipes`, `ingredients` | Recipe definitions, ingredient management |
| Supplier | `supplier.service.ts` | `suppliers` | Supplier CRUD |
| Festival | `festival.service.ts` | - | Festival/event special management |
| Payroll | `payroll.service.ts` | `payroll`, `attendance` | Payroll calculations, attendance records |
| Registration | `registration.service.ts` | `users`, `restaurants` | Restaurant onboarding flow |
| Staff Tasks | `staff-tasks.service.ts` | - | Task assignment to staff |
| Query Monitor | `query-monitor.service.ts` | - | Query performance monitoring |

---

## Context Providers

### RestaurantContext (`context/RestaurantContext.tsx`)

Provides restaurant-scoped data throughout the app:

```typescript
interface RestaurantContextType {
    restaurantId: string | null;
    restaurantName: string | null;
    businessType: 'restaurant' | 'bar' | 'restaurant_bar';
    featureFlags: {
        enable_restaurant_module: boolean;
        enable_bar_module: boolean;
    };
    user: UserProfile | null;
    loading: boolean;
    refreshProfile: () => Promise<void>;
}
```

- Resolves restaurant ID from URL (supports UUID, numeric ID, and restaurant codes)
- Fetches business type to toggle restaurant vs bar modules
- Derives feature flags from business type
- Skips profile fetch on public pages (/, /login, /register)

### GlobalContext (`context/GlobalContext.tsx`)

Manages multi-tenant operational context:

```typescript
interface GlobalContextState {
    restaurantId: string | null;
    branchId: string | null;
    panel: 'admin' | 'customer' | 'waiter' | 'kitchen' | 'manager' | null;
    staffId: string | null;
    tableId: string | null;
    orderId: string | null;
    sessionId: string | null;
    role: string | null;
    serviceType: 'dine-in' | 'takeaway' | 'delivery' | 'bar' | null;
    mergeGroupId: string | null;
}
```

- Extracts context from URL params (restaurantCode, branchCode, tableId, orderId)
- Identifies active panel from URL path
- Fetches user session and profile from Supabase
- Provides `validateContext()` to check required fields before operations
- `updateContext()` for partial updates

### CartContext (`context/CartContext.tsx`)

Shopping cart state management:

- Add/remove/update items with quantity and special instructions
- Cart persisted to `localStorage` (keyed by `restaurantCode`)
- Tracks `tableNumber` per cart
- Item count badge for bottom nav

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `POST /api/upload` | POST | Upload images to Cloudflare R2. Accepts multipart form with `file` + optional `folder`. Returns public CDN URL |
| `GET /api/media/private` | GET | Retrieve private media via pre-signed R2 URLs |
| `GET /api/lookup-phone` | GET | Look up user by phone number |
| `POST /api/admin/migrate-homepage` | POST | Utility for migrating homepage configurations |
| `GET /auth/callback` | GET | OAuth callback handler for Supabase Auth |
| `GET /portal` | GET | Portal redirect route (redirects to appropriate panel based on role) |

### SaaS Admin API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `GET /api/restaurants` | GET | List all restaurants |
| `POST /api/approve` | POST | Approve restaurant registration |
| `DELETE /api/delete` | DELETE | Delete restaurant |
| `GET /api/admin-data` | GET | Fetch SaaS dashboard data |
| `PUT /api/admin-data/update` | PUT | Update admin settings |

---

## Middleware & Auth

### Middleware (`middleware.ts`)

Runs on every request (except static assets):

1. **Creates Supabase SSR client** with cookie management
2. **Gets current user** via `supabase.auth.getUser()`
3. **Protected route check:** Redirects to `/login` if not authenticated
4. **Profile fetch:** Gets user role, approval status, restaurant_id, branch_id
5. **Old path redirect:** Redirects `/admin` -> `/{restaurantId}/admin`, etc.
6. **Approval check:**
   - Approved users on auth pages -> redirect to `/portal`
   - Non-approved users trying to access protected routes -> redirect to `/waiting-approval`
7. **Tenant-scoped validation:**
   - Validates restaurant ownership (user's `restaurant_id` matches URL)
   - Validates branch access if applicable
   - Panel access control (admin panel requires `restaurant_admin` role, etc.)
8. **SaaS admin:** Future logic placeholder for super admin routing

### Route Matcher

```
/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
```

Matches all routes except static files and images.

---

## Components Library

### Admin Components

| Component | Purpose |
|-----------|---------|
| `OrderKanbanBoard` | Kanban board for order management with drag-and-drop (@dnd-kit) |
| `AddStaffModal` | Modal for adding staff members |
| `CreateOfferModal` | Modal for creating promotional offers |
| `OrderDetailsModal` | Detailed order view modal |
| Homepage Builder suite | BannerManager, SectionManager, LivePreview, PropertiesPanel, EditableElement, DataBrowser, ImageUploader |
| Payroll suite | AttendanceTab, EmployeeModal, EmployeesTab, PayrollTab, ReportsTab |

### Customer Components

| Component | Purpose |
|-----------|---------|
| `CustomerBottomNav` | Fixed bottom navigation (Home, Menu, Cart, Orders, Service) |
| `PersistentHome` | Maintains homepage state across tab switches |
| `PersistentMenu` | Maintains menu state across navigation |
| `PersistentOrders` | Maintains order history state |
| `PersistentService` | Maintains service request state |
| `PersistentProfile` | Maintains profile state |
| `BillRequestModal` | Request bill modal |
| `WaiterCallModal` | Call waiter modal |
| `Redirector` | Route redirector utility |
| `SharedSkeleton` | Loading skeleton placeholder |

### Shared Components

| Component | Purpose |
|-----------|---------|
| `SharedHomepageLayout` | Reusable homepage template rendering sections by type |
| `BannerSlider` | Image banner carousel |
| `SharedFloatingCart` | Floating cart widget |
| `SharedComboCard` | Combo deal card |
| `SharedQuantityControl` | +/- quantity control |
| `SharedServicePopupCard` | Service request popup |
| `MainHeader` | Shared page header |
| `ConfirmationModal` | Generic confirmation dialog |
| `InvoiceComponent` | Invoice printing/display |
| `CountdownTimer` / `Timer` | Timer components |
| `ThemeProvider` / `ThemeToggle` | Dark/light theme switching (next-themes) |
| `KitchenTicket` | Individual order ticket for KDS |

### Landing Components

Full marketing page component set: Navbar, HeroSection, ProblemSection, SolutionSection, FeaturesGrid, PanelsSection, PricingSection, FAQSection, CTABanner, ContactSection, Footer, RevealMotion

---

## Real-time Features

Powered by **Supabase Realtime** (PostgreSQL logical replication):

1. **Admin Dashboard:** Live order count and status updates
2. **Order Kanban Board:** Real-time order card movement
3. **KDS:** Auto-appearing order tickets when new orders placed
4. **Waiter Alerts:** Instant service request notifications
5. **Customer Order Status:** Live status progression tracking
6. **Service Requests:** Real-time status updates (pending -> accepted -> completed)

Sound notifications are used in:
- Admin dashboard (new orders)
- KDS (new orders)
- Waiter alerts (new service requests)

---

## AI Integrations

| Service | API Key Env | Usage |
|---------|------------|-------|
| Google Gemini AI | `GOOGLE_GENERATIVE_AI_API_KEY` | Content generation, menu descriptions, AI-assisted features |
| Sarvam AI | `SARVAM_AI_API_KEY` | Indian language AI (translation, regional language support) |
| OpenAI | Via `openai` package | Additional AI features |

---

## SaaS Admin Deep Dive

### Architecture

- **Separate Next.js app** in `saas-admin/` directory
- Runs on **Port 3002** (`next dev -p 3002`)
- Has its own `package.json`, `tsconfig.json`, `tailwind.config.ts`
- Connects to same Supabase instance (redirected in dev)
- Light theme enforced (no dark mode)
- Font: Inter

### Data Flow

```
SaaS Admin App
    |
    ├── lib/services/users.ts        -> Fetch/approve/delete users
    ├── lib/services/saas-data.ts    -> Fetch dashboard data, suspend restaurants, change plans
    ├── lib/services/compliance.ts   -> FSSAI compliance checks
    └── lib/supabase.ts              -> Supabase client (SAAS_SUPABASE keys)
    |
    ├── API Routes
    │   ├── /api/restaurants          -> List restaurants
    │   ├── /api/approve              -> Approve registrations
    │   ├── /api/delete               -> Delete restaurants
    │   ├── /api/admin-data           -> Dashboard aggregated data
    │   └── /api/admin-data/update    -> Update settings
```

### SaaSAdminData Interface

```typescript
interface SaaSAdminData {
    restaurants: Restaurant[];
    branches: Branch[];
    totalUsers: number;
    liveOrdersCount: number;
    totalRevenue: number;
    activityLogs: AuditLog[];
    staffCount: number;
    totalOrdersCount: number;
}
```

### All 19 Modules

1. **DashboardModule** - KPIs, quick stats, navigation tiles
2. **RestaurantsModule** - Restaurant list, approval queue, impersonation, suspension, plan changes
3. **BranchesModule** - Multi-branch management
4. **LiveMonitoringModule** - Real-time system health
5. **DevicesModule** - Device management
6. **StaffModule** - Cross-restaurant staff view
7. **SupportCenterModule** - Support tickets
8. **NotificationsModule** - System-wide announcements
9. **SubscriptionsModule** - Subscription tier management
10. **PaymentsModule** - Payment processing
11. **AnalyticsModule** - Cross-platform analytics
12. **StorageModule** - R2 storage usage
13. **FeatureFlagsModule** - Per-restaurant feature toggles
14. **BackupsModule** - Database backups
15. **AuditLogsModule** - Audit trail viewer
16. **UpdatesModule** - OTA/system updates
17. **SecurityModule** - Security settings
18. **ApiMonitoringModule** - API performance
19. **SettingsModule** - Global settings

---

## Database Migrations

24 migration files in `supabase/migrations/`:

| Migration | Date | Description |
|-----------|------|-------------|
| `20260205_rls_public.sql` | Feb 5 | Base RLS policies |
| `20260207_optimize_and_secure.sql` | Feb 7 | Security optimizations |
| `20260210_add_alert_status.sql` | Feb 10 | Alert status column |
| `20260213_add_timers.sql` | Feb 13 | Timer columns |
| `20260213_rename_categories.sql` | Feb 13 | Category renaming |
| `20260215200000_add_quantity_column.sql` | Feb 15 | Quantity column for service requests |
| `20260215_service_requests.sql` | Feb 15 | Service requests table |
| `20260227195020_add_inventory_categories.sql` | Feb 27 | Inventory categories |
| `20260227201314_fix_inventory_categories_rls_and_seed.sql` | Feb 27 | Fix inventory RLS + seed data |
| `20260301132000_add_restaurant_profile.sql` | Mar 1 | Restaurant profile table |
| `20260302014605_add_restaurant_id_to_orders.sql` | Mar 2 | Multi-tenant orders |
| `20260304_today_specials.sql` | Mar 4 | Today's specials table |
| `20260427_add_traceability.sql` | Apr 27 | Audit/traceability columns |
| `20260506000000_homepage_builder.sql` | May 6 | Homepage builder tables |
| `20260509000000_add_header_footer_bg.sql` | May 9 | Header/footer background settings |
| `20260513000000_create_section_style_settings.sql` | May 13 | Section style settings table |
| `20260519000000_create_payroll_tables.sql` | May 19 | Payroll and attendance tables |
| `20260519010000_fix_service_requests_cascade.sql` | May 19 | Fix cascade deletes on service requests |
| `20260520000000_unify_staff_and_employees.sql` | May 20 | Merge staff/employee tables |
| `20260520010000_add_service_requests_anon_policies.sql` | May 20 | Anonymous RLS for service requests |
| `20260520020000_drop_stale_employees_sync_trigger.sql` | May 20 | Clean up old triggers |
| `20260520030000_refactor_service_requests_delivery.sql` | May 20 | Refactor service requests for delivery |
| `20260529120000_configure_realtime.sql` | May 29 | Enable Supabase Realtime |
| `20260529130000_create_get_homepage_config.sql` | May 29 | Homepage config getter function |

---

## Scripts & Utilities

Located in `scripts/` and root-level helper files:

| Script | Purpose |
|--------|---------|
| `seed-minerva-menu.ts` | Seed sample menu data |
| `migrate-images-to-storage.ts` | Migrate images to R2 storage |
| `migrate-supabase-to-r2.ts` | Migrate all Supabase storage to Cloudflare R2 |
| `update-menu-images.ts` | Update menu item image URLs |
| `test-rls.js` / `test-rls2.js` | Test Row-Level Security policies |
| `test-users.js` / `test-login.js` | Test user authentication |
| `check_tables.js` | Verify table structure |
| `reset_pass.js` | Password reset utility |
| `test-db.js` | Database connection test |
| `saas-admin/scripts/initialize-saas-db.js` | Initialize SaaS admin database |

---

## Deployment & Dev

### Development

```bash
# Main app (port 3000, accessible on LAN)
npm run dev          # next dev -H 0.0.0.0

# SaaS Admin (port 3002)
cd saas-admin
npm run dev          # next dev -p 3002
```

### Build & Production

```bash
# Main app
npm run build        # next build
npm start            # next start

# SaaS Admin
cd saas-admin
npm run build
npm start            # next start -p 3002
```

### TypeScript Path Aliases

- `@/*` maps to project root (configured in `tsconfig.json`)

### Image Optimization

`next.config.ts` configures remote image patterns:
- `images.unsplash.com`
- `*.supabase.co/storage/v1/object/public/**`
- `pub-*.r2.dev` (Cloudflare R2 CDN)

---

## Key Design Decisions

1. **Multi-tenancy via URL** - Restaurant code in URL path, not subdomain, for simpler deployment
2. **Customer access is anonymous** - No login required for customers; QR code provides restaurant + table context
3. **Atomic waiter assignment** - Single-waiter locking on service request acceptance prevents race conditions
4. **Client-side image compression** - Reduces upload size before hitting R2, saving bandwidth and storage
5. **Persistent components** - Customer panel uses wrapper components to maintain state across tab navigation, preventing re-fetches
6. **Separate SaaS admin app** - Keeps super admin concerns isolated from restaurant app
7. **Supabase Realtime** - Native PostgreSQL replication for instant updates across all panels
8. **Feature flags via business type** - Restaurant vs bar modules toggled at the restaurant level
9. **Soft deletes** - Categories use `is_active` flag instead of hard deletes to prevent orphaned items
10. **LocalStorage cart** - Cart persisted per restaurant, survives page refreshes without auth
