# Qonvey Backend API

Backend API for Qonvey - Zimbabwe's leading truck and delivery marketplace platform.

## 🚀 Features

- **Authentication & Authorization** - JWT-based auth with OTP verification
- **Subscription Management** - Tiered pricing (FREE, STARTER, PROFESSIONAL, BUSINESS)
- **Load Management** - Post, search, and manage cargo deliveries
- **Bidding System** - Drivers bid on available loads
- **Trip Tracking** - Real-time location tracking with Socket.IO
- **Payment Integration** - EcoCash, OneMoney, Card payments via Paynow
- **Reviews & Ratings** - Two-way review system
- **Messaging** - Real-time chat between cargo owners and drivers
- **File Uploads** - Cloudinary/AWS S3 integration
- **Push Notifications** - Firebase Cloud Messaging
- **SMS Notifications** - Twilio/Africa's Talking integration

## 📋 Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 6.0 (optional, for rate limiting)
- npm >= 9.0.0

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Set up database**
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database
npm run prisma:seed
```

5. **Start development server**
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── src/
│   ├── api/
│   │   └── v1/
│   │       ├── controllers/   # Route controllers
│   │       ├── routes/        # API routes
│   │       └── index.ts       # V1 router
│   ├── config/
│   │   ├── database.ts        # Prisma client
│   │   └── env.ts             # Environment config
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── rateLimiter.middleware.ts
│   │   └── validation.middleware.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── load.service.ts
│   │   ├── bid.service.ts
│   │   ├── trip.service.ts
│   │   ├── payment.service.ts
│   │   └── ...
│   ├── utils/
│   │   └── logger.ts
│   ├── types/
│   ├── app.ts                 # Express app
│   └── server.ts              # Server entry point
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🔑 Environment Variables

Key environment variables (see `.env.example` for complete list):

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/qonvey"

# JWT
JWT_SECRET="your-secret-key"

# Payment (Paynow)
PAYNOW_INTEGRATION_ID="your-id"
PAYNOW_INTEGRATION_KEY="your-key"

# SMS (Twilio)
TWILIO_ACCOUNT_SID="your-sid"
TWILIO_AUTH_TOKEN="your-token"

# Firebase
FIREBASE_PROJECT_ID="your-project-id"

# Storage (Cloudinary)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
```

## 🌐 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/verify-otp` - Verify OTP
- `POST /api/v1/auth/refresh-token` - Refresh JWT token

### Loads
- `GET /api/v1/loads/search` - Search loads
- `POST /api/v1/loads` - Create load (auth required)
- `GET /api/v1/loads/:loadId` - Get load details
- `PUT /api/v1/loads/:loadId` - Update load
- `POST /api/v1/loads/:loadId/publish` - Publish load

### Bids
- `POST /api/v1/bids` - Place bid (auth required)
- `GET /api/v1/bids/my-bids` - Get user's bids
- `POST /api/v1/bids/:bidId/accept` - Accept bid
- `POST /api/v1/bids/:bidId/reject` - Reject bid

### Trips
- `POST /api/v1/trips/:tripId/start` - Start trip
- `POST /api/v1/trips/:tripId/location` - Update location
- `POST /api/v1/trips/:tripId/complete` - Complete trip
- `GET /api/v1/trips/active` - Get active trips

### Vehicles
- `POST /api/v1/vehicles` - Add vehicle
- `GET /api/v1/vehicles/my-vehicles` - Get user's vehicles
- `PUT /api/v1/vehicles/:vehicleId` - Update vehicle

### Subscriptions
- `GET /api/v1/subscriptions` - Get subscription
- `POST /api/v1/subscriptions/upgrade` - Upgrade plan
- `GET /api/v1/subscriptions/pricing` - Get pricing

### Payments
- `POST /api/v1/payments/initiate` - Initiate payment
- `GET /api/v1/payments/status/:reference` - Check payment status
- `GET /api/v1/payments/invoices` - Get invoices

See full API documentation for complete endpoint list.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🚢 Deployment

### Build for production
```bash
npm run build
```

### Start production server
```bash
npm start
```

### Environment Setup
- Set `NODE_ENV=production`
- Use production database
- Enable proper CORS origins
- Set up Redis for rate limiting
- Configure monitoring (Sentry, DataDog)

## 📊 Database Management

```bash
# Open Prisma Studio (database GUI)
npm run prisma:studio

# Create new migration
npm run prisma:migrate

# Push schema changes (dev only)
npm run prisma:push

# Reset database
npx prisma migrate reset
```

## 🔒 Security

- JWT token authentication
- Rate limiting per endpoint
- Helmet.js for security headers
- CORS configuration
- Password hashing with bcrypt
- Input validation with Zod
- SQL injection prevention (Prisma)

## 🎯 Subscription Tiers

| Feature | FREE | STARTER | PROFESSIONAL | BUSINESS |
|---------|------|---------|--------------|----------|
| Loads/month | 1 | Unlimited | Unlimited | Unlimited |
| Bids/month | 3 | Unlimited | Unlimited | Unlimited |
| Priority listing | ❌ | ✅ | ✅ | ✅ |
| Featured listing | ❌ | ❌ | ✅ | ✅ |
| Team management | ❌ | ❌ | ❌ | ✅ |
| Price | $0 | $3/mo | $5/mo | $7/mo |

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Support

For support, email support@qonvey.co.zw or join our WhatsApp group.