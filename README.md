# Alumzi Server

The backend API for **Alumzi**, a platform for managing alumni associations, payments, memberships, and events.

## 🚀 Overview
This server is built with **Node.js, Express, and TypeScript**. It uses **MongoDB (Mongoose)** for the database, **Socket.IO** for real-time features (chat, notifications), and **Nodemailer** for email services. It integrates with payment gateways (likely Paystack based on dependencies) and provides a secure, RESTful API.

## 🛠 Tech Stack
-   **Runtime**: Node.js
-   **Language**: TypeScript
-   **Framework**: Express.js
-   **Database**: MongoDB (Mongoose ODM)
-   **Real-time**: Socket.IO
-   **Authentication**: JWT, Speakeasy (2FA)
-   **Email**: Nodemailer (Gmail SMTP)
-   **Security**: Helmet, CORS, Bcryptjs

## 📂 Folder Structure
The source code is located in `src/` and serves as the core logic for the application.

```bash
src/
├── config/             # Environment and global configuration
├── controllers/        # Request handlers (logic layer)
├── jobs/               # Scheduled tasks (Cron jobs)
├── libs/               # Shared utilities (DB connection, Email service, Logger)
├── models/             # Mongoose schemas and data models
├── routers/            # API Route definitions
├── server.ts           # Entry point (App initialization)
├── sms/                # SMS service integration logic
└── sockets/            # Socket.IO event handlers
```

### Key Components

*   **`src/server.ts`**: The main entry point. It sets up Express, middleware (CORS, Helmet, BodyParser), connects to MongoDB, initializes Socket.IO, and starts the HTTP server.
*   **`src/libs/mongoose.ts`**: Handles the database connection logic.
*   **`src/libs/email.service.ts`**: Manages email sending via Nodemailer (e.g., OTPs).
*   **`src/sockets/index.ts`**: Manages real-time connections and events.

## 🔧 Prerequisites
-   **Node.js** (v18+ recommended)
-   **MongoDB** (Local or Atlas connection string)
-   **npm** or **yarn**

## 📦 Installation
1.  Navigate to the server directory:
    ```bash
    cd server
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

## ⚙️ Configuration
Create a `.env` file in the root of the `server` directory. Structure it as follows (see `.env.example`):

```env
PORT=3001
NODE_ENV=development
MONGODB_URL=mongodb://localhost:27017/alumzi
# OR your Atlas URL
# MONGODB_URL=mongodb+srv://<user>:<password>@cluster.mongodb.net/alumzi

# Email Configuration (for Nodemailer)
EMAIL_USER=your-email@gmail.com
# IMPORTANT: Use an App Password if using Gmail 2-Step Verification
EMAIL_PASS=your-app-password 

# JWT / Security
JWT_SECRET=your_jwt_secret_key
SMS_TOKEN=your_sms_provider_token
```

## 🏃‍♂️ Running the Server

### Development
Runs the server with `nodemon` for hot-reloading.
```bash
npm run dev
```
*   Server runs on: `http://localhost:3001` (default)

### Production Build
```bash
npm run build
npm start
```

## 📡 API Documentation
The API is organized into several modules. All endpoints are prefixed with `/api`.

| Module | URL Prefix | Description |
| :--- | :--- | :--- |
| **Auth** | `/api/auth` | Login, Register, OTP, Password Reset |
| **Associations** | `/api/associations` | Create/Manage Associations, Dashboards |
| **Members** | `/api/members` | Manage Members, Approvals, Details |
| **Chat** | `/api/chat` | Real-time Chat functionality |
| **Finance (Income)** | `/api/incomes` | Record and manage income |
| **Finance (Expense)** | `/api/expenses` | Record and manage expenses |
| **Payments** | `/api/payments` | Payment processing and history |
| **Notifications** | `/api/notifications` | User notifications |
| **Fundraisers** | `/api/fundraisers` | Create and manage fundraising campaigns |
| **Admin** | `/api/admin` | System admin routes |

### Real-Time Features (Socket.IO)
The server exposes a Socket.IO connection on the main port. Clients can listen for:
-   `new_notification`: Real-time alerts.
-   `new_message`: Chat messages.
-   `financial_update`: Live updates to dashboard stats.
-   `member_update`: Live updates when members join/leave.

## 🤝 Contributing
1.  Ensure you are on the correct branch.
2.  Follow the TypeScript coding standards.
3.  Test your API changes using Postman or the Frontend app.
