# QR Vehicle Emergency Calling System v2.0 - Backend API

A comprehensive device-linked QR code system for vehicle emergency and contact calls. This backend provides complete API functionality for GPS installation companies to distribute QR codes to customers, which can then be linked to their vehicles for emergency contact purposes.

## 🚀 System Architecture

### Core Components
- **Express.js API Server** - RESTful API with comprehensive endpoints
- **MongoDB Database** - Scalable document storage for all system data
- **Agora SDK Integration** - Real-time voice calling capabilities
- **Firebase Push Notifications** - Instant emergency alerts
- **JWT Authentication** - Secure user and admin authentication (via external provider)
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

# Admin (legacy, not used)
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=secure_admin_password_123
```

### 3. Database Setup
```bash
# Start MongoDB
mongod

# Generate sample QR codes (optional)
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

### 🏢 Admin - QR Code Management (`/api/admin`)
- `POST /qr/bulk-generate` - Generate bulk QR codes (10K-20K per batch)
- `GET /qr/inventory` - View QR code inventory with filtering
- `GET /qr/analytics` - Get comprehensive usage analytics
- `PUT /qr/:qrId/status` - Update QR code status (suspend/reactivate)
- `GET /qr/export/:batchNumber` - Export QR batch for printing
- `GET /dashboard` - Get admin dashboard data

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
- `POST /test` - Send test notification (auth required, stub only)
- `POST /send` - Send notification to user (auth required, stub only)
- `GET /settings` - Get notification settings (auth required, stub only)
- `PUT /settings` - Update notification settings (auth required, stub only)
- `POST /bulk` - Send bulk notifications (admin only, stub only)

### 🏥 System Health & Info
- `GET /health` - System health check
- `GET /api` - API information and version

## 🔒 Authentication

**All authentication is handled externally.**
- The backend expects a valid JWT in the `Authorization` header for all protected endpoints.
- The JWT must be issued by your external authentication provider and include the following claims:
  - `unique_name`: User's display name
  - `role`: User's role (1 = admin, 2 = user)
  - `user_id`: Unique user identifier
  - `parent_id`: (if applicable)
  - `time_zone`: User's time zone
  - `nbf`, `exp`, `iat`: Standard JWT claims

**Example JWT payload:**
```json
{
  "unique_name": "Balin Admin",
  "role": "1",
  "user_id": "2",
  "parent_id": "1",
  "time_zone": "05:30",
  "nbf": 1753093302,
  "exp": 1753698102,
  "iat": 1753093302
}
```

**How to authenticate:**
```bash
Authorization: Bearer <your_jwt_token>
```

## 🆕 Example JWTs and Role-Based Flow

### JWT Example (User)
```json
{
  "unique_name": "torqdemo",
  "role": "2",
  "user_id": "10",
  "parent_id": "2",
  "time_zone": "Asia/Kolkata",
  "nbf": 1753102241,
  "exp": 1753707041,
  "iat": 1753102241
}
```
- `role: "1"` = Admin (GPS company, manages QR codes)
- `role: "2"` = User (vehicle owner, links QR, receives calls)

### Flow Overview

#### Admin (role: 1)
- Uses the web portal to:
  1. Generate bulk QR codes (`/api/admin/qr/bulk-generate`)
  2. View/manage QR inventory and analytics
  3. Export QR batches for printing
  4. Suspend/reactivate QR codes
- All admin endpoints require a JWT with `role: "1"` in the Authorization header.

#### User (role: 2)
- Uses the mobile app or web to:
  1. Scan QR code (public info, no auth required)
  2. Link QR code to their vehicle (`/api/qr/link`)
  3. View/manage their linked devices (`/api/qr/my-devices`)
  4. Update device emergency settings
  5. Receive and answer emergency calls
- All user endpoints require a JWT with `role: "2"` in the Authorization header.

#### Anonymous Caller
- Anyone can scan a QR and initiate an emergency call (no auth required).

### Example Flows

#### Admin Flow (Web Portal)
1. **Login externally, get admin JWT**
2. **Generate QR codes**: POST `/api/admin/qr/bulk-generate` (JWT in header)
3. **Export/print QR codes**: GET `/api/admin/qr/export/:batchNumber` (JWT in header)
4. **Monitor inventory/analytics**: GET `/api/admin/qr/inventory` and `/api/admin/qr/analytics` (JWT in header)

#### User Flow (Mobile App or Web)
1. **Login externally, get user JWT**
2. **Scan QR code**: GET `/api/qr/info/:qrId` (public)
3. **Link QR to vehicle**: POST `/api/qr/link` (JWT in header)
4. **View/manage devices**: GET `/api/qr/my-devices` (JWT in header)
5. **Answer/reject calls**: POST `/api/calls/:callId/answer` or `/reject` (JWT in header)

#### Caller Flow (Webpage or App)
1. **Scan QR code**: GET `/api/qr/info/:qrId` (public)
2. **Initiate call**: POST `/api/calls/initiate` (no auth required)

---

## 🔄 Testing Both Roles

- Use the provided Postman collection and set the `auth_token` variable to either an admin JWT (role: 1) or user JWT (role: 2) to test all endpoints.
- Admin endpoints will only work with a valid admin JWT.
- User endpoints will only work with a valid user JWT.
- Anonymous call endpoints require no JWT.

## 📦 Database Models

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

## 🧪 Testing

### 1. System Health Check
```bash
curl http://localhost:5000/health
```

### 2. API Information
```bash
curl http://localhost:5000/api
```

### 3. Complete Testing Flow
1. Generate QR codes: Use admin bulk-generate endpoint
2. Link QR to vehicle: Use qr/link endpoint
3. Test emergency call: Use calls/initiate endpoint

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

- **JWT Authentication** - Secure token-based auth (external)
- **Rate Limiting** - Protection against abuse
- **Input Validation** - Joi schema validation
- **CORS Protection** - Configurable origins
- **Helmet.js** - Security headers
- **Error Handling** - Secure error responses

## 🏢 Support & Troubleshooting

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
   - Check device token registration (external)
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