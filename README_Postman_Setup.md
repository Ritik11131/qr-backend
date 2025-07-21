# QR Vehicle Emergency System API - Complete Postman Collection

This comprehensive collection provides complete API testing for the QR Vehicle Emergency System, covering all workflows from admin QR generation to emergency call management. Perfect for GPS installation companies, vehicle owners, and development teams.

## 📦 Import Instructions

### 1. Import Collection
1. Open Postman
2. Click "Import" button
3. Select `Emergency_Contact_API.postman_collection.json` 
4. Click "Import"

### 2. Import Environment
1. Click the gear icon (⚙️) in the top right
2. Click "Import" 
3. Select `Emergency_Contact_API.postman_environment.json`
4. Click "Import"
5. Select "QR Vehicle Emergency System Environment" from the environment dropdown

## 🔧 Setup Environment Variables

Update these variables in your environment:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `base_url` | API base URL | `http://localhost:5000/api` or `https://your-api.com/api` |
| `auth_token` | JWT token (auto-set after login) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `admin_token` | Admin JWT token (auto-set after admin login) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `user_id` | Current user ID (auto-set after login) | `uuid-string` |
| `qr_id` | QR code ID (auto-set after generation/linking) | `QR_001_2024_000001` |
| `device_id` | Device ID (auto-set after linking) | `device_uuid_here` |
| `call_id` | Call ID (auto-set after call initiation) | `call_uuid_here` |
| `agora_app_id` | Agora App ID for video calls | `your_agora_app_id` |
| `caller_url` | Caller interface URL | `http://localhost:8000` |
| `frontend_url` | Frontend app URL | `http://localhost:3000` |

## 🚀 Quick Start Testing

### Complete System Testing (Recommended)

#### For GPS Installation Companies (Admins):
1. **Admin Login** → Sets `admin_token` automatically
2. **Generate QR Batch** → Creates 100-20,000 QR codes, sets `qr_id`
3. **Check Inventory** → Monitor QR code distribution
4. **View Analytics** → Track usage and ROI

#### For Vehicle Owners (Customers):
1. **Customer Registration** → Sets `auth_token` and `user_id`
2. **Setup Device Token** → Enable push notifications
3. **Link QR to Vehicle** → Connect QR code to GPS device, sets `device_id`
4. **View My Devices** → See all linked vehicles

#### For Emergency Callers (Anonymous):
1. **Get QR Info** → Scan QR code to see vehicle details
2. **Initiate Emergency Call** → Start emergency communication, sets `call_id`
3. **Check Call Status** → Monitor call progress
4. **End Call** → Complete emergency interaction

### Authentication Flow
1. **Register User/Admin Login** → Sets authentication tokens
2. **Get Profile** → Verify authentication
3. **Update Device Token** → Enable notifications

### QR Code & Device Management Flow
1. **Bulk Generate QR Codes** (Admin) → Create QR inventory
2. **Link QR to Device** (Customer) → Connect QR to vehicle
3. **Get My Devices** → View linked devices
4. **Update Device Settings** → Configure emergency preferences

### Emergency Call Flow
1. **Get QR Info** (Anonymous) → View vehicle details
2. **Initiate Emergency Call** → Start emergency communication
3. **Answer/Reject Call** (Vehicle Owner) → Respond to emergency
4. **End Call** → Complete interaction
5. **Get Call History** → Review past emergencies

## 📊 API Endpoints Overview

### 🔐 Authentication (`/auth`)
- `POST /register` - Register new user
- `POST /login` - User/Admin login
- `GET /profile` - Get user profile
- `PUT /profile` - Update profile
- `POST /device-token` - Register device for notifications
- `POST /change-password` - Change password
- `GET /verify` - Verify token
- `POST /logout` - Logout user

### 🏢 Admin - QR Code Management (`/qr/admin`)
- `POST /bulk-generate` - Generate bulk QR codes (10K-20K per batch)
- `GET /inventory` - View QR code inventory with filtering
- `GET /analytics` - Get comprehensive usage analytics
- `PUT /:qrId/status` - Update QR code status (suspend/reactivate)
- `GET /export/:batchNumber` - Export QR batch for printing

### 📱 QR Code & Device Management (`/qr`)
- `GET /info/:qrId` - Get QR info (public, no auth required)
- `POST /link` - Link QR code to vehicle and GPS device
- `GET /my-devices` - Get user's linked devices
- `PUT /device/:deviceId/settings` - Update device emergency settings
- `POST /unlink/:qrId` - Unlink QR code from device
- `GET /device/:deviceId/calls` - Get device-specific call history

### 📞 Call Management (`/calls`)
- `POST /initiate` - Start emergency call (no auth, anonymous callers)
- `POST /:callId/answer` - Answer call (auth required)
- `POST /:callId/reject` - Reject call (auth required)
- `POST /:callId/end` - End call
- `GET /:callId/status` - Get call status
- `GET /history` - Get call history (auth required)
- `GET /:callId` - Get call details (auth required)

### 🎥 Agora Integration (`/agora`)
- `POST /token` - Generate video call token (auth required)

### 🔔 Notifications (`/notifications`)
- `POST /test` - Send test notification (auth required)
- `POST /send` - Send notification to user (auth required)
- `GET /settings` - Get notification settings (auth required)
- `PUT /settings` - Update notification settings (auth required)

### 🏥 System Health & Info
- `GET /health` - System health check
- `GET /api` - API information and version

## 🔒 Authentication

Most endpoints require authentication via Bearer token. The collection handles two types of tokens:

**User Token** (for customers):
```
Authorization: Bearer {{auth_token}}
```

**Admin Token** (for GPS installation companies):
```
Authorization: Bearer {{admin_token}}
```

The collection automatically manages tokens through environment variables and test scripts.

## 🧪 Testing Scenarios

### Business Workflows

#### GPS Installation Company Workflow:
1. **Bulk QR Generation** - Generate 1,000-20,000 QR codes per batch
2. **Inventory Management** - Track QR distribution and usage
3. **Analytics & Reporting** - Monitor ROI and system performance
4. **QR Status Management** - Handle damaged or lost QR codes

#### Customer Onboarding Workflow:
1. **Account Registration** - Create customer account
2. **Device Installation** - GPS device installed in vehicle
3. **QR Code Linking** - Link QR to vehicle and emergency settings
4. **Emergency Readiness** - System ready for emergency calls

#### Emergency Response Workflow:
1. **QR Code Scan** - Anonymous person finds issue with vehicle
2. **Emergency Classification** - Select emergency type and urgency
3. **Real-time Communication** - Voice call between caller and owner
4. **Issue Resolution** - Emergency handled effectively

### Emergency Call Types
- **🚨 Accident** - `emergencyType: "accident"`, `urgencyLevel: "high"/"critical"`
- **🔧 Breakdown** - `emergencyType: "breakdown"`, `urgencyLevel: "medium"`
- **🚔 Theft/Security** - `emergencyType: "theft"`, `urgencyLevel: "high"`
- **🏥 Medical** - `emergencyType: "medical"`, `urgencyLevel: "critical"`
- **💬 General** - `emergencyType: "general"`, `urgencyLevel: "low"`

### QR Code Statuses
- **Available** - Ready for linking to customer
- **Linked** - Connected to vehicle and active
- **Suspended** - Temporarily disabled
- **Damaged** - Physically damaged, needs replacement

### Rate Limiting
The API implements rate limiting:
- **Auth endpoints**: 5 requests per minute per IP
- **Call endpoints**: 10 requests per minute per IP
- **Admin endpoints**: 20 requests per minute per admin
- **General endpoints**: 100 requests per minute per IP

## 🔍 Response Examples

### Successful QR Generation
```json
{
  "success": true,
  "message": "1000 QR codes generated successfully",
  "batchInfo": {
    "batchNumber": "BATCH_001_2024",
    "totalGenerated": 1000,
    "qrType": "sticker",
    "generatedAt": "2024-01-15T10:30:00Z"
  },
  "qrCodes": [
    {
      "qrId": "QR_001_2024_000001",
      "qrUrl": "https://emergency.example.com/call?qr=QR_001_2024_000001",
      "status": "available"
    }
  ]
}
```

### Successful Device Linking
```json
{
  "success": true,
  "message": "QR code linked successfully",
  "deviceId": "device_uuid_here",
  "qrInfo": {
    "qrId": "QR_001_2024_000001",
    "status": "linked",
    "linkedAt": "2024-01-15T14:30:00Z"
  },
  "emergencyUrl": "https://emergency.example.com/call?qr=QR_001_2024_000001"
}
```

### Successful Call Initiation
```json
{
  "success": true,
  "callId": "call_uuid_here",
  "callerUID": "caller_12345",
  "channelName": "emergency_call_uuid",
  "token": "agora_token_here",
  "appId": "agora_app_id",
  "receiver": {
    "userId": "user_uuid",
    "name": "Vehicle Owner",
    "avatar": "avatar_url"
  },
  "deviceInfo": {
    "vehicleType": "car",
    "vehicleModel": "Toyota Camry",
    "plateNumber": "ABC123",
    "color": "Blue"
  },
  "emergencyInfo": {
    "showOwnerName": true,
    "showVehiclePlate": true,
    "emergencyContact": "+1234567890"
  },
  "callContext": {
    "emergencyType": "accident",
    "urgencyLevel": "high",
    "isEmergency": true
  }
}
```

### Admin Inventory Response
```json
{
  "success": true,
  "inventory": [
    {
      "qrId": "QR_001_2024_000001",
      "status": "linked",
      "qrType": "sticker",
      "batchNumber": "BATCH_001_2024",
      "linkedTo": {
        "userId": "user_123",
        "deviceId": "device_456",
        "linkedAt": "2024-01-16T09:15:00Z"
      },
      "stats": {
        "scanCount": 5,
        "callCount": 2,
        "emergencyCallCount": 1
      }
    }
  ],
  "summary": {
    "total": 1000,
    "available": 750,
    "linked": 230,
    "suspended": 15,
    "damaged": 5
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 20,
    "totalItems": 1000
  }
}
```

## 🛠️ Development Tips

1. **Auto-token management**: Collection scripts automatically save both user and admin tokens
2. **Environment switching**: Use different environments for dev/staging/prod
3. **Workflow testing**: Use the "Complete Testing Workflows" folder for end-to-end testing
4. **Bulk testing**: Use Collection Runner for automated regression testing
5. **Data extraction**: Test scripts automatically extract and save IDs for chaining requests
6. **Admin vs User**: Switch between admin and user tokens for different permission levels

## 🐛 Troubleshooting

### Common Issues
- **401 Unauthorized**: Check if `auth_token` is set correctly
- **404 Not Found**: Verify `base_url` environment variable
2. **404 Not Found**: Verify `base_url` environment variable (should be `http://localhost:5000/api`)
3. **Rate Limited**: Wait and retry after rate limit window (varies by endpoint)
4. **QR Code Not Found**: Ensure QR code exists in database and is active
5. **QR Code Not Linked**: QR must be linked to device before emergency calls
6. **Permission Denied**: Admin endpoints require admin token, user endpoints require user token
### Debug Steps
1. Check environment variables are set correctly
2. Verify correct token type (admin vs user) for endpoint
3. Ensure QR codes are generated before linking
4. Check request body format matches API expectations
5. Review response error messages for specific issues
6. Test complete workflows in sequence
7. Use health check endpoint to verify system status

### Testing Order
For best results, test in this order:
1. **System Health** - Verify API is running
2. **Admin Workflow** - Generate QR codes
3. **Customer Workflow** - Register and link QR
4. **Emergency Workflow** - Test emergency calls
5. **Analytics** - Review usage data

---

**For GPS Installation Companies**: Use admin endpoints to manage QR inventory and track business metrics.

**For Web Developers**: Complete API contracts for building customer-facing applications.

**For App Developers**: Mobile app integration testing with real-world emergency scenarios.

**For Backend Developers**: Comprehensive API testing, debugging, and development workflow validation.

**For QA Teams**: End-to-end testing scenarios covering all user types and emergency situations.