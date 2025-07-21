# QR Vehicle Emergency Calling System v2.0 - Backend API

A comprehensive device-linked QR code system for vehicle emergency and contact calls. This backend provides complete API functionality for GPS installation companies to distribute QR codes to customers, which can then be linked to their vehicles for emergency contact purposes.

## 🚀 System Architecture

### Core Components
- **Express.js API Server** - RESTful API with comprehensive endpoints
- **MongoDB Database** - Scalable document storage for all system data
- **Agora SDK Integration** - Real-time voice calling capabilities
- **Firebase Push Notifications** - Instant emergency alerts
- **JWT Authentication** - Secure user and admin authentication
- **Rate Limiting** - Protection against abuse and spam

### Business Model
1. **GPS Installation Company** generates bulk QR codes (10K-20K per batch)
2. **QR codes distributed** to customers during device installation
3. **Customers link** QR codes to their vehicles and accounts
4. **Anonymous callers** can scan QR codes to contact vehicle owners
5. **Emergency calls** are prioritized and classified by type

## 📋 System Requirements

- Node.js 16+
- MongoDB 4.4+
- Agora.io account (for voice calls)
- Firebase account (for push notifications)

## 🛠️ Installation & Setup

### 1. Clone and Install Dependencies
```bash
git clone <repository>
cd qr-vehicle-emergency-backend
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/qr_vehicle_emergency

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your_super_secret_jwt_key_here

# Agora (Voice Calls)
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# URLs
CALLER_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# Admin
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=secure_admin_password_123
```

### 3. Database Setup
```bash
# Start MongoDB
mongod

# Create admin user and sample data
npm run seed
npm run generate-qrs
```

### 4. Start the Server
```bash
# Development
npm run dev

# Production
npm start
```

The server will run on `http://localhost:5000`

## 🎯 API Endpoints

### 🔐 Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User/Admin login
- `GET /profile` - Get user profile
- `PUT /profile` - Update profile
- `POST /device-token` - Register device for notifications
- `POST /change-password` - Change password
- `GET /verify` - Verify token
- `POST /logout` - Logout user

### 🏢 Admin - QR Code Management (`/api/admin`)
- `POST /qr/bulk-generate` - Generate bulk QR codes (10K-20K per batch)
- `GET /qr/inventory` - View QR code inventory with filtering
- `GET /qr/analytics` - Get comprehensive usage analytics
- `PUT /qr/:qrId/status` - Update QR code status (suspend/reactivate)
- `GET /qr/export/:batchNumber` - Export QR batch for printing
- `GET /dashboard` - Get admin dashboard data
- `GET /users` - Get all users (admin view)

### 📱 QR Code & Device Management (`/api/qr`)
- `GET /info/:qrId` - Get QR info (public, no auth required)
- `POST /link` - Link QR code to vehicle and GPS device
- `GET /my-devices` - Get user's linked devices
- `PUT /device/:deviceId/settings` - Update device emergency settings
- `POST /unlink/:qrId` - Unlink QR code from device
- `GET /device/:deviceId/calls` - Get device-specific call history

### 📞 Call Management (`/api/calls`)
- `POST /initiate` - Start emergency call (no auth, anonymous callers)
- `POST /:callId/answer` - Answer call (auth required)
- `POST /:callId/reject` - Reject call (auth required)
- `POST /:callId/end` - End call
- `GET /:callId/status` - Get call status
- `GET /history` - Get call history (auth required)
- `GET /:callId` - Get call details (auth required)

### 🎥 Agora Integration (`/api/agora`)
- `POST /token` - Generate video call token (auth required)
- `GET /config` - Get Agora configuration

### 🔔 Notifications (`/api/notifications`)
- `POST /test` - Send test notification (auth required)
- `POST /send` - Send notification to user (auth required)
- `GET /settings` - Get notification settings (auth required)
- `PUT /settings` - Update notification settings (auth required)
- `POST /bulk` - Send bulk notifications (admin only)

### 🏥 System Health & Info
- `GET /health` - System health check
- `GET /api` - API information and version

## 🔒 Authentication

The system supports two types of authentication:

**User Authentication** (for customers):
```bash
Authorization: Bearer <user_jwt_token>
```

**Admin Authentication** (for GPS installation companies):
```bash
Authorization: Bearer <admin_jwt_token>
```

## 📊 Database Models

### User Model
```javascript
{
  userId: String (UUID),
  name: String,
  email: String (unique),
  phone: String (unique),
  password: String (hashed),
  role: 'user' | 'admin',
  deviceTokens: [String],
  preferences: {
    notifications: { calls, emergencies, marketing },
    privacy: { showName, showPhone }
  },
  stats: { totalCalls, emergencyCalls, devicesLinked }
}
```

### QRCode Model
```javascript
{
  qrId: String (unique),
  qrUrl: String,
  status: 'available' | 'linked' | 'suspended' | 'damaged',
  batchNumber: String,
  linkedTo: { userId, deviceId, linkedAt },
  emergencyInfo: { showOwnerName, emergencyContact, etc. },
  stats: { scanCount, callCount, emergencyCallCount }
}
```

### Device Model
```javascript
{
  deviceId: String (UUID),
  deviceInfo: { model, serialNumber, firmwareVersion },
  vehicle: { type, make, model, plateNumber, color, vin },
  owner: { userId, isPrimary, relationship },
  installation: { installedBy, installationDate, notes },
  settings: { emergencyContacts, autoAnswer, allowAnonymousCalls },
  status: 'active' | 'inactive' | 'maintenance' | 'removed'
}
```

### Call Model
```javascript
{
  callId: String (UUID),
  callerId: String | null (null for anonymous),
  receiverId: String,
  qrCodeId: String,
  callerInfo: {
    emergencyType: 'accident' | 'breakdown' | 'theft' | 'medical' | 'general',
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
  },
  deviceInfo: { deviceId, vehicleType, vehicleModel, etc. },
  status: 'initiated' | 'answered' | 'rejected' | 'ended'
}
```

## 🚨 Emergency Call Types

- **🚨 Accident** - Critical priority, immediate notification
- **🔧 Breakdown** - High priority, vehicle assistance needed
- **🚔 Theft/Security** - High priority, security issue
- **🏥 Medical** - Critical priority, medical emergency
- **💬 General** - Normal priority, general contact

## 🔧 Usage Examples

### For GPS Installation Companies (Admins)

1. **Generate QR Codes**:
```bash
curl -X POST http://localhost:5000/api/admin/qr/bulk-generate \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "count": 1000,
    "batchNumber": "BATCH_001_2024",
    "qrType": "sticker"
  }'
```

2. **Monitor Inventory**:
```bash
curl -X GET "http://localhost:5000/api/admin/qr/inventory?status=linked&page=1&limit=50" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### For Customers

1. **Register Account**:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "password": "password123"
  }'
```

2. **Link QR Code to Vehicle**:
```bash
curl -X POST http://localhost:5000/api/qr/link \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qrId": "QR_BATCH_001_2024_000001",
    "deviceInfo": {
      "model": "GPS-2000",
      "serialNumber": "SN123456789"
    },
    "vehicleInfo": {
      "type": "car",
      "make": "Toyota",
      "model": "Camry",
      "year": 2023,
      "plateNumber": "ABC123",
      "color": "Blue"
    }
  }'
```

### For Anonymous Callers

1. **Get QR Info**:
```bash
curl -X GET http://localhost:5000/api/qr/info/QR_BATCH_001_2024_000001
```

2. **Initiate Emergency Call**:
```bash
curl -X POST http://localhost:5000/api/calls/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "qrId": "QR_BATCH_001_2024_000001",
    "emergencyType": "accident",
    "urgencyLevel": "high",
    "callerInfo": {
      "name": "Emergency Caller",
      "phone": "+1987654321",
      "location": "Highway 101, Mile 45",
      "description": "Vehicle accident, need immediate assistance"
    }
  }'
```

## 🔍 Testing

### 1. System Health Check
```bash
curl http://localhost:5000/health
```

### 2. API Information
```bash
curl http://localhost:5000/api
```

### 3. Complete Testing Flow
1. Create admin user: `npm run seed`
2. Generate QR codes: Use admin bulk-generate endpoint
3. Register customer: Use auth/register endpoint
4. Link QR to vehicle: Use qr/link endpoint
5. Test emergency call: Use calls/initiate endpoint

## 🚀 Production Deployment

### Environment Variables
```env
NODE_ENV=production
MONGODB_URI=mongodb://production-server/qr_vehicle_emergency
CALLER_URL=https://your-domain.com
FRONTEND_URL=https://your-app.com
JWT_SECRET=production_secret_key
```

### Recommended Setup
- Use MongoDB Atlas or dedicated MongoDB server
- Deploy on AWS/Azure/GCP with load balancing
- Enable HTTPS for all endpoints
- Set up monitoring and logging
- Configure backup strategies
- Use PM2 for process management

## 📈 Scaling Considerations

- **QR Code Generation**: Can handle 20,000+ QR codes per batch
- **Concurrent Calls**: Agora SDK supports thousands of concurrent calls
- **Database**: MongoDB can scale horizontally
- **Rate Limiting**: Configurable per endpoint type
- **Caching**: Redis can be added for session management

## 🛡️ Security Features

- **JWT Authentication** - Secure token-based auth
- **Rate Limiting** - Protection against abuse
- **Input Validation** - Joi schema validation
- **Password Hashing** - bcrypt with salt rounds
- **CORS Protection** - Configurable origins
- **Helmet.js** - Security headers
- **Error Handling** - Secure error responses

## 🆘 Support & Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MONGODB_URI in .env
   - Ensure MongoDB is running
   - Verify network connectivity

2. **Agora Token Generation Failed**
   - Verify AGORA_APP_ID and AGORA_APP_CERTIFICATE
   - Check Agora account status
   - Ensure proper token format

3. **Push Notifications Not Working**
   - Verify Firebase configuration
   - Check device token registration
   - Ensure proper Firebase permissions

### Debug Tools
- Health check endpoint: `/health`
- API information: `/api`
- Console logging with timestamps
- Error codes for all responses

## 📄 License

This project is licensed under the MIT License.

---

**QR Vehicle Emergency System v2.0 Backend** - Powering emergency communications through innovative QR technology. 🚗📞