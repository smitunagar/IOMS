# 🍽️ GastronomeAI
Developed by WebMeister360 - Germany
**GastronomeAI** is an AI-powered restaurant management system designed to optimize operations across ordering, inventory, staff coordination, and customer engagement. It blends a powerful core POS with intelligent automation to elevate the dining and management experience for modern restaurants.

---

## 🚀 Features

### I. Core Point of Sale (POS) & Order Management

#### 🧾 Order Entry
- Create new orders (dine-in, delivery, pickup)
- Select dishes from a categorized menu
- Customize items: ingredients, removals, notes
- Assign tables, capture customer info, assign drivers
- Real-time subtotal and order placement

#### 🍽️ Table Management
- Visual table layout with capacity tracking
- Status updates: Available, Occupied, Needs Cleaning
- Linked order visibility and manual override

#### 💳 Payment Processing
- Select payment method: cash, card, mobile
- Tip handling, total calculation, receipt printing
- Auto-release tables post-payment

#### 🗂️ Order History
- View all completed orders with full detail
- Connect to customer personas

#### 🔗 3rd-Party Orders (Mocked)
- View orders from Lieferando, Uber Eats, Wolt
- Accept, track, and update order statuses

---

### II. AI-Powered Features & Intelligence

#### 🧠 AI Menu Setup
- Parse menus from URLs or uploaded files
- Auto-populate categorized menu items

#### 🥘 AI Ingredient Generator
- Generate ingredient lists from dish names and servings
- Add dishes and ingredients to the menu and inventory

#### 🤖 SmartChefBot (AI Assistant)
- Real-time dish suggestions based on:
  - Customer preferences (persona data)
  - Pairings and complementary items
  - Expiring ingredients (waste-smart specials)
- Save custom pairings per customer or main dish

#### 📞 AI Order Agent (Transcript Parsing)
- Extract structured order data from call transcripts
- Confidence scoring + staff review/edit interface

#### 👥 Smart Customer Engine
- Build and update customer personas using phone numbers + history
- Attributes: dietary, behavioral, taste, demographics, preferences
- Visual persona groupings powered by AI (mocked)

#### 📦 Smart Inventory Insights
- Highlights critical stock, expiring soon, overstocked items
- Visual dashboards with expiry tracking

#### 🧪 AI Agents Console (Mocked)
- Central hub to monitor AI agents like SmartChefBot, WasteWatchDog

#### 📣 Promotion AI (Mocked)
- Suggest promotions using sales goals and expiring inventory
- Simulates social media content generation

---

### III. Inventory & Menu Management

- Full-featured inventory system with stock, expiry, category tracking
- AI-assisted menu creation and ingredient linking
- Bulk CSV import/export for inventory

---

### IV. Staff & Operational Tools

- 🔐 Role-based access (owner, manager, chef, waiter)
- 🔔 Real-time notifications for stock, expiry, discounts
- 📊 Mocked analytics dashboard: sales, top dishes, occupancy
- 📜 Conceptual logs: orders, inventory, alerts

---

## 🛠️ Tech Stack

### 🖥️ Frontend
- **Next.js (App Router)** + **TypeScript** + **React**
- **ShadCN UI**, **Radix UI**, **Tailwind CSS**
- **React Hook Form**, **Zod**, **Lucide**, **Recharts**

### 🧠 AI & ML
- **Genkit** for orchestration + prompt templates
- **Gemini via Genkit** for LLM tasks
- **Google Vision API** / custom models for food waste detection
- (Optional) Hosting on **Vertex AI**, **Hugging Face**, **Replicate**

### 🔐 Authentication & Roles
- **Firebase Auth** with custom claims
- Role enforcement via **Next.js middleware**

### 💾 Database & Storage
- **Firestore** (NoSQL), optional **Supabase (PostgreSQL)** with **Prisma**
- File storage: **Firebase Storage**, **Cloudflare R2**, **S3**
- Caching with **Upstash Redis** or **RedisCloud**

### 🔧 Backend & APIs
- **Next.js API Routes** or **Server Actions**
- Task scheduling: **Vercel Cron**, **Supabase Edge Functions**
- Webhooks for 3rd-party integrations

### 🔍 Observability
- **Sentry**, **LogRocket** or **Highlight.io**
- **PostHog**, **Vercel Analytics**, **Firebase Crashlytics**

### ⚙️ DevOps & Hosting
- **Vercel**, **Firebase Functions**, **GitHub Actions**
- Environment configs via `.env.*`
- Optional: **Docker** for containerized deployment

### 📢 Messaging & Notifications
- **Resend**, **SendGrid**, **Mailgun**
- **Twilio** for SMS/WhatsApp
- **Firebase Cloud Messaging** for in-app alerts

### 🧪 Dev Tools
- **ESLint**, **Prettier**, **Husky**, **Storybook**
- **Jest**, **React Testing Library**, **Playwright/Cypress**

### 📱 Mobile / PWA Support
- **PWA** support
- Optional **React Native** via **Expo + Firebase**

---

## 📌 Status

> 🚧 This is a working prototype with a mix of fully implemented and conceptual features. AI integrations and external service mocks are designed to simulate real-world restaurant dynamics.

---

## 🤝 Contributing

We welcome feature requests, issue reports, and improvements! Please follow conventional commits and test before submitting PRs.

---

## 📄 License

MIT License — free to use, modify, and distribute with attribution.

---
