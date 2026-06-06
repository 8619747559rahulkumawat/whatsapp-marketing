# RSendix.pro - SMART BULK MESSAGING PLATFORM

A complete production-ready WhatsApp marketing SaaS platform similar to digitalsms.biz with multi-device support, campaign management, chatbot, and reseller panel.

## Features

- **WhatsApp Multi-Device Connection** - QR code login with Baileys
- **Bulk Messaging** - Send personalized bulk messages with delay & queue system
- **Campaign Management** - Bulk, DP, Button, Premium, Brand, Scheduled campaigns
- **Button Messages** - URL buttons, Call buttons, Quick Reply buttons
- **Contact Management** - Import CSV, groups, tagging, search
- **Chatbot System** - Auto-reply, keyword-based, welcome messages, FAQ
- **Reports & Analytics** - Delivery reports, campaign analytics, export
- **Credit/Wallet System** - Credits tracking, transactions
- **API System** - REST APIs with API keys, webhooks
- **Admin Panel** - User management, monitoring, settings
- **Multi-user/Reseller** - Role-based access (admin, reseller, user)
- **Real-time Updates** - Live delivery status, session status via Socket.io

## Enterprise Features

- **Multi-tenancy** - Tenant DB/schema isolation, tenant-wise campaigns/contacts/sessions/analytics
- **WhatsApp Template Manager** - Template CRUD, categories, variable placeholders, approval system
- **Automation Builder** - Visual drag-drop builder with React Flow, drip campaigns, trigger-based automation
- **Compliance Suite** - Opt-in/opt-out system, STOP keyword unsubscribe, consent logs, DND scrubbing, audit trail, GDPR export/delete
- **Billing & Subscription** - Razorpay/Stripe integration, subscription plans, usage-based pricing, invoice generation
- **Analytics Dashboard** - Real-time analytics, sent/delivered/read/failed metrics, click tracking, conversion funnel
- **Team & Role Management** - RBAC permissions, shared inbox, internal notes, chat assignment
- **AI Assist** - AI smart replies, sentiment analysis, message optimization, AI chatbot (free with Ollama)
- **Integration Hub** - Public REST API, Swagger docs, webhooks, CRM sync, Zapier/Make integration
- **Message Queue System** - Redis + BullMQ integration, retry failed messages, scheduled campaigns, rate limiting

## Tech Stack

### Frontend
- React.js + Vite
- Tailwind CSS
- Framer Motion
- Chart.js
- React Router DOM
- Axios + Socket.io Client

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- Socket.io
- Baileys (WhatsApp API)
- bcryptjs, multer, cors, express-rate-limit

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

## Installation

### 1. Clone & Navigate

```bash
git clone <repo-url>
cd whatsapp-marketing
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 4. Configure Environment

```bash
cd ../backend
cp .env.example .env
# Edit .env with your MongoDB URI and other settings
```

MongoDB Atlas storage is protected by default with retention windows for noisy data such as chat history, message logs, AI chat, audit logs, read notifications, SMS fallback logs, and group scrape snapshots. Important business data like users, contacts, campaigns, templates, billing, deals, tasks, and settings is not auto-deleted.

Use these optional env values to tune retention:

```env
DATA_RETENTION_ENABLED=true
CHAT_RETENTION_DAYS=90
MESSAGE_RETENTION_DAYS=180
AI_CHAT_RETENTION_DAYS=30
AUDIT_LOG_RETENTION_DAYS=180
AUTO_CAPTURE_LOG_RETENTION_DAYS=30
SMS_FALLBACK_LOG_RETENTION_DAYS=90
READ_NOTIFICATION_RETENTION_DAYS=30
GROUP_SCRAPE_RETENTION_DAYS=30
GROUP_SCRAPE_MAX_PARTICIPANTS=5000
GROUP_SCRAPE_MAX_MESSAGES=100
```

Set any `*_RETENTION_DAYS=0` to keep that collection forever.

### 5. Start MongoDB

Make sure MongoDB is running locally or update `MONGODB_URI` in `.env` to your MongoDB Atlas URI.

### 6. Start the Application

From the root directory:

```bash
# Start backend (port 5000)
cd backend
npm run dev

# Open a new terminal, start frontend (port 5173)
cd frontend
npm run dev
```

### 7. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

### Default Admin Credentials

The first admin user is seeded from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`.
Use a strong password in production and do not commit real credentials.

## Project Structure

```
whatsapp-marketing/
├── backend/
│   ├── controllers/     # Route handlers
│   │   ├── adminController.js
│   │   ├── apiController.js
│   │   ├── authController.js
│   │   ├── campaignController.js
│   │   ├── chatController.js
│   │   ├── complianceController.js
│   │   ├── contactController.js
│   │   ├── messageController.js
│   │   ├── reportController.js
│   │   ├── sessionController.js
│   │   ├── supportController.js
│   │   ├── templateController.js
│   │   └── walletController.js
│   ├── middleware/       # Auth, error handler, upload, tenant
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   ├── tenant.js
│   │   └── upload.js
│   ├── models/          # Mongoose schemas
│   │   ├── ApiKey.js
│   │   ├── Campaign.js
│   │   ├── Chat.js
│   │   ├── Compliance.js
│   │   ├── Contact.js
│   │   ├── ContactGroup.js
│   │   ├── Message.js
│   │   ├── Session.js
│   │   ├── Setting.js
│   │   ├── SupportTicket.js
│   │   ├── Tenant.js
│   │   ├── Template.js
│   │   ├── Transaction.js
│   │   └── User.js
│   ├── routes/          # Express routes
│   │   ├── auth.js
│   │   ├── campaigns.js
│   │   ├── chat.js
│   │   ├── compliance.js
│   │   ├── contacts.js
│   │   ├── messages.js
│   │   ├── reports.js
│   │   ├── support.js
│   │   ├── sessions.js
│   │   ├── templates.js
│   │   ├── upload.js
│   │   ├── wallet.js
│   │   └── api.js
│   ├── services/        # WhatsApp, campaign, chatbot services
│   │   ├── campaignService.js
│   │   ├── whatsappService.js
│   │   └── chatbotService.js
│   ├── utils/           # Helpers, queue, seeder
│   │   ├── helpers.js
│   │   ├── imageCompressor.js
│   │   ├── queue.js
│   │   └── seeder.js
│   ├── sessions/        # WhatsApp auth sessions
│   ├── uploads/         # File uploads
│   ├── server.js        # Entry point
│   └── .env             # Environment variables
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   │   └── automation/     # Automation builder components
│   │   │       └── AutomationBuilder.jsx
│   │   ├── contexts/    # Auth context
│   │   ├── layouts/     # Sidebar, header, dashboard layout
│   │   ├── pages/       # All application pages
│   │   ├── utils/       # API client, socket
│   │   ├── App.jsx      # Routes
│   │   └── main.jsx     # Entry point
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### WhatsApp Sessions
- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions/:id/qr` - Get QR code
- `POST /api/sessions/:id/disconnect` - Disconnect
- `POST /api/sessions/:id/reconnect` - Reconnect
- `DELETE /api/sessions/:id` - Delete session

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/:id` - Get campaign
- `POST /api/campaigns/:id/start` - Start campaign
- `POST /api/campaigns/:id/pause` - Pause campaign
- `POST /api/campaigns/:id/resume` - Resume campaign
- `POST /api/campaigns/:id/cancel` - Cancel campaign

### Messages
- `POST /api/messages/send` - Send message
- `POST /api/messages/bulk` - Send bulk
- `POST /api/messages/cloud-template-batch` - Official WhatsApp Cloud API template batch send
- `GET /api/messages/cloud-template-batch/:jobId` - Check Cloud API batch progress
- `POST /api/messages/cloud-template-batch/:jobId/cancel` - Cancel a running Cloud API batch
- `GET /api/messages` - List messages

#### Official WhatsApp Cloud API Batch Send

Set these in `backend/.env`:

```env
WHATSAPP_CLOUD_ACCESS_TOKEN=your_meta_cloud_api_access_token
WHATSAPP_CLOUD_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WHATSAPP_GRAPH_API_VERSION=v20.0
```

Start a template batch job:

```bash
curl -X POST http://localhost:5000/api/messages/cloud-template-batch \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmOptIn": true,
    "templateName": "hello_world",
    "languageCode": "en_US",
    "contacts": ["919999999999", "918888888888"],
    "batchSize": 100,
    "batchDelayMs": 120000,
    "dailyLimit": 5000
  }'
```

For templates with variables, pass Meta Cloud API `components`:

```json
{
  "components": [
    {
      "type": "body",
      "parameters": [
        { "type": "text", "text": "Rahul" },
        { "type": "text", "text": "20% OFF" }
      ]
    }
  ]
}
```

Check progress:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:5000/api/messages/cloud-template-batch/JOB_ID
```

The same batch sender is also available with an API key:

```bash
curl -X POST http://localhost:5000/api/api/cloud-template-batch \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmOptIn": true,
    "templateName": "hello_world",
    "languageCode": "en_US",
    "contacts": ["919999999999"],
    "batchSize": 100,
    "batchDelayMs": 120000,
    "dailyLimit": 5000
  }'
```

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `POST /api/contacts/import` - Import CSV
- `GET /api/contacts/export` - Export CSV

### Reports
- `GET /api/reports/dashboard` - Dashboard stats
- `GET /api/reports/delivery` - Delivery reports
- `GET /api/reports/campaigns` - Campaign reports
- `GET /api/reports/export` - Export report

### Wallet
- `GET /api/wallet/balance` - Get balance
- `GET /api/wallet/transactions` - Transaction history

### Chatbot
- `GET /api/chatbot` - List rules
- `POST /api/chatbot` - Create rule

### Admin
- `GET /api/admin/dashboard` - Admin stats
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/settings` - Get settings
- `PUT /api/admin/settings` - Update settings

### Public API
- `POST /api/api/send` - Send via API key
- `POST /api/api/send-bulk` - Bulk via API key
- `POST /api/api/cloud-template-batch` - Official WhatsApp Cloud API template batch via API key
- `GET /api/api/cloud-template-batch/:jobId` - Check Cloud API batch progress via API key
- `POST /api/api/contacts` - Create contact via API
- `GET /api/api/reports` - Reports via API
- `POST /api/api/webhook` - Trigger webhook

## License

MIT
