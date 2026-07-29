# Backend Documentation

## Overview

This project is a Node.js + Express + MongoDB backend for a food-delivery management application. It handles authentication, customer records, delivery assignments, role-based access, logs, exports, and scheduled delivery generation.

## Current capabilities

- Login and logout flows with JWT cookies
- Role-based access control for Owner, Manager, Delivery-Guy, and Observer users
- Delivery list, detail, add, and status-update APIs
- Customer list, search, add, detail, and update APIs
- Logging middleware for delivery and dashboard actions
- JSON and DOCX export/import endpoints for backup and restore workflows
- Scheduled daily delivery generation based on active subscriptions
- Static HTML pages served from the Express app

## Tech stack

- Runtime: Node.js
- Framework: Express 5
- Database: MongoDB with Mongoose
- Authentication: JWT stored in an HTTP-only cookie
- Password hashing: bcrypt
- Configuration: dotenv
- Utilities: cookie-parser, cors, docx

Dependencies are defined in package.json.

## Project structure

- __init__.js: application entry point and route mounting
- helpers/DbConnect.js: MongoDB connection lifecycle helper
- helpers/JwtGetToken.js: JWT generator
- helpers/businessRules.js: post-login redirect helper and customer payload validation
- helpers/deliveryScheduler.js: scheduled daily delivery generation
- middleware/auth.js: soft auth middleware
- middleware/MustAuth.js: strict auth middleware
- middleware/roleAuth.js: role guard middleware
- middleware/logManagerAction.js: logging middleware for route actions
- Models/: Mongoose schemas
- routes/login.js: login/logout routes
- routes/dashboardHome.js: dashboard, user management, exports, imports
- routes/dashboard.js: delivery routes and APIs
- routes/customers.js: customer routes and APIs
- routes/logs.js: log viewing routes
- public/: frontend HTML pages
- tests/: smoke and business-rule tests

## Startup flow

The server starts from __init__.js.

Boot sequence:
1. Load environment variables using dotenv.
2. Enable cookie parsing, CORS, JSON parsing, and URL-encoded body parsing.
3. Connect to MongoDB using connectDB().
4. Start the delivery scheduler.
5. Mount routes:
   - /login
   - /dashboard
   - /delivery and /dashboard/delivery
   - /dashboard/customers
   - /logs
6. Start the app on the configured port (default 3000).

## Environment variables

Expected environment values:

- MONGODB_URI: MongoDB connection string
- JWT_SECRET: primary JWT signing secret
- JWTSECRETKEY: legacy fallback for JWT signing
- PORT: HTTP port override (defaults to 3000)
- DAILY_DELIVERY_TIME: time of day for scheduled delivery generation, in HH:MM format using Dubai time
- NODE_ENV: used to toggle secure cookies in production

Important note:
- The code checks JWT_SECRET first and falls back to JWTSECRETKEY for compatibility.
- If neither secret is configured, authentication will fail with a server configuration error.

## Data models

### Customer (Models/customersSchema.js)

Fields:
- customers_id (Number, required, unique)
- customers_name (String, required)
- phone_number (String, required, unique)
- location (String, required)
- diet_preference (String, must be Veg or Non-Veg)
- plan (String, must be Trial, Weekly, or Monthly)
- active_for_days (Number, typically 7, 20, or 30)
- meal_time (Array of strings, such as Breakfast/Lunch/Dinner)
- delivery_guy (String, required)
- comments (String, default empty)
- purchase_proof (String, optional)

### Delivery (Models/DeliverSchema.js)

Fields:
- delivery_id (Number, unique, auto-generated when omitted)
- subscription_id (Number, optional)
- customer_id (Number, optional)
- assigned_to_user_id (Number, required)
- assigned_to_username (String, required)
- delivery_date (Date, required)
- food (String, typically Combined Meal)
- meal_time (Array of strings)
- photo_url (String, optional)
- photo_uploaded_at (Date, optional)
- delivery_status (String, Pending/Delivered/Cancelled)
- comments (String, default empty)

### User (Models/UserSchema.js)

Fields:
- user_id (Number, required, unique)
- username (String, required, unique)
- password (String, required)
- role (Owner, Manager, Delivery-Guy, Observer)
- photo_url (String, optional)
- created_at (Date, default now)
- last_login (Date, default null)
- is_active (Boolean, default true)

### Subscription (Models/SubscriptionSchema.js)

Stores subscription windows for customers. It is used by the daily delivery generation flow and by customer creation.

## Authentication and middleware

### Token generation (helpers/JwtGetToken.js)

- generateToken(username, role) creates a JWT with a 24-hour expiration.

### Soft auth (middleware/auth.js)

- Reads the token cookie.
- If the cookie is missing, it sets req.user = null and continues.
- If the token is valid, it populates req.user.
- If the token is invalid, it clears the cookie and continues as an unauthenticated request.

### Strict auth (middleware/MustAuth.js)

- Requires a valid token cookie.
- Verifies the JWT and attaches req.user.
- Redirects to /login when no valid token is present.
- Clears the token cookie on verification failure.

### Role guard (middleware/roleAuth.js)

- allowRoles([...]) blocks requests when the authenticated user lacks the required role.
- Responses are returned as JSON with 403 when access is denied.

## Routes and endpoints

### Login routes (routes/login.js)

#### GET /login
- Serves public/login.html.

#### POST /login
- Validates username and password against the User collection.
- Uses bcrypt for password verification.
- Legacy plain-text passwords are migrated to bcrypt after a successful login.
- Updates last_login after a successful login.
- Sets the token cookie and redirects based on role:
  - Delivery-Guy -> /delivery
  - Everyone else -> /dashboard

#### POST /logout
- Clears the token cookie and redirects back to /login.

### Dashboard home routes (routes/dashboardHome.js)

#### GET /dashboard/
- Serves public/dashboard.html.

#### GET /dashboard/data
- Returns dashboard counts and capability flags for the current user.
- Delivery-Guy users see a narrower set of capabilities.

#### POST /dashboard/users/add
- Creates a new user with a hashed password.
- Allowed roles: Owner, Manager, Delivery-Guy, Observer.

#### GET /dashboard/export
- Exports the database collections as JSON.

#### GET /dashboard/export/docx
- Generates a DOCX report containing users, assigned deliveries, delivery photos, and customer details.
- Restricted to Owner and Manager.

#### POST /dashboard/import
- Imports a JSON export payload into the database.
- Creates missing users, customers, subscriptions, deliveries, and logs.

### Delivery routes (routes/dashboard.js)

#### GET /dashboard/delivery/ and GET /delivery/
- Serves public/deliveries.html.

#### GET /dashboard/delivery/data
- Returns paginated deliveries (30 per page).
- Delivery-Guy users only see deliveries assigned to their username.
- Response includes success, deliveries, role, currentPage, totalPages, and totalDeliveries.

#### GET /dashboard/delivery/agents
- Returns active delivery-guy users for assignment dropdowns.

#### GET /dashboard/delivery/add
- Serves public/adddelivery.html.

#### GET /dashboard/delivery/customers-list
- Returns customer name and ID pairs for the add-delivery form.

#### GET /dashboard/delivery/:id
- Loads a delivery by Mongo ObjectId or numeric delivery_id.
- Enforces access rules so Delivery-Guy users can only view their own assigned deliveries.
- Returns JSON when requested or serves public/delivery-details.html otherwise.

#### PATCH /dashboard/delivery/:id/status
- Updates delivery_status.
- Allowed values: Pending, Delivered, Cancelled.
- A photo is required before a delivery can be marked Delivered.
- Delivered deliveries cannot be changed again.

#### POST /dashboard/delivery/add
- Creates a new delivery record from the submitted payload.
- Resolves the selected customer and assigned delivery guy before creating the record.

### Customer routes (routes/customers.js)

#### GET /dashboard/customers/
- Serves public/customers.html.

#### GET /dashboard/customers/data
- Returns paginated customers (30 per page).
- Supports case-insensitive search by customers_name or phone_number.

#### GET /dashboard/customers/add
- Serves public/add-customer.html.

#### GET /dashboard/customers/delivery-guys
- Returns active delivery-guy usernames for the customer form.

#### POST /dashboard/customers/add
- Validates the incoming payload.
- Checks for duplicate phone numbers.
- Creates the customer and a matching active subscription.

#### GET /dashboard/customers/:id
- Returns a customer, its linked deliveries, and its subscription by numeric customers_id.

#### PATCH /dashboard/customers/:id
- Updates customer profile data, including meal times, delivery guy, comments, and purchase proof.

### Logs route (routes/logs.js)

#### GET /logs/
- Serves public/logs.html for Owner and Manager users.

#### GET /logs/data
- Returns paginated log entries.

## Scheduled delivery generation

The app includes a scheduler in helpers/deliveryScheduler.js.

- It runs once per minute.
- It checks the current time against DAILY_DELIVERY_TIME in Dubai time.
- When the scheduled time matches, it scans active subscriptions.
- It creates a delivery if the subscription is currently active and no delivery already exists for that customer on the current day.
- The generated delivery uses the customer’s assigned delivery guy when available.

## Public pages

- public/login.html: login form
- public/deliveries.html: delivery table and list view
- public/delivery-details.html: delivery detail and status/photo workflow
- public/customers.html: customer list and search UI
- public/customer-details.html: customer detail and edit UI
- public/adddelivery.html: add-delivery form
- public/add-customer.html: add-customer form
- public/dashboard.html: dashboard landing page
- public/logs.html: log viewer page

## NPM scripts

From package.json:
- npm run dev: starts the app with nodemon
- npm start: starts the app with node
- npm test: runs the Node test suite

## Security and quality notes

- Authentication currently relies on a cookie-based JWT and does not include CSRF protection.
- Login does not have rate limiting or brute-force protection.
- Some routes redirect while others return JSON; this can be inconsistent for clients.
- The codebase has a test suite under tests/ that covers business rules and route smoke scenarios.

## Quick run instructions

1. Install dependencies:
   - npm install
2. Ensure MongoDB is running locally.
3. Set the required environment variables, especially JWT_SECRET and MONGODB_URI.
4. Start the server:
   - npm run dev
5. Open the app:
   - http://localhost:3000/login

## Suggested next improvements

1. Standardize error responses across routes.
2. Add rate limiting and account lockout for login.
3. Add CSRF protection for state-changing cookie-auth requests.
4. Replace legacy JWTSECRETKEY usage with JWT_SECRET only.
5. Expand test coverage for auth, delivery updates, and customer CRUD flows.
