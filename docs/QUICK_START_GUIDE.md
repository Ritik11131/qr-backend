# QR Vehicle Emergency System - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Required for basic functionality
MONGODB_URI=mongodb://localhost:27017/qr_vehicle_emergency
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
JWT_SECRET=your_super_secret_jwt_key

# Optional: Enable masked calling
MASKED_CALLING_ENABLED=true
MASKED_CALLING_API_URL=https://api.maskedcalling.com/v1
MASKED_CALLING_API_KEY=your_api_key
```

### 3. Start the Server
```bash
npm run dev
```

### 4. Test the API
Visit: `http://localhost:5000/health`

---

## 📱 Common Use Cases

### 🏢 GPS Company Admin
```bash
# 1. Generate QR codes
POST /api/admin/qr/bulk-generate
{
  "count": 1000,
  "batchNumber": "BATCH_2024_001",
  "qrType": "sticker"
}

# 2. Export for printing
GET /api/admin/qr/export/BATCH_2024_001?format=csv
```

### 👤 Vehicle Owner
```bash
# 1. Link QR to device
POST /api/qr/link
{
  "qrId": "QR_BATCH_001_000001",
  "deviceInfo": {
    "model": "GPS-Pro-2000",
    "serialNumber": "SN123456"
  }
}

# 2. Configure emergency settings
PUT /api/qr/device/{deviceId}/settings
{
  "allowAnonymousCalls": true,
  "emergencyContacts": [...]
}
```

### 🆘 Emergency Caller
```bash
# 1. Check QR info
GET /api/qr/info/QR_BATCH_001_000001

# 2. Initiate emergency call
POST /api/calls/initiate
{
  "qrId": "QR_BATCH_001_000001",
  "callMethod": "direct",
  "emergencyType": "accident",
  "urgencyLevel": "critical"
}
```

---

## 🔧 Configuration Options

### Call Methods
- **Direct:** Agora-based voice calling
- **Masked:** Third-party masked number calling

### Emergency Types
- `accident` - Vehicle accidents
- `breakdown` - Vehicle breakdowns  
- `theft` - Security issues
- `medical` - Medical emergencies
- `general` - General contact

### Rate Limits
- Global: 1000/15min
- Calls: 10/min
- Admin: 50/15min

---

## 🧪 Testing with Postman

1. Import the collection: `Emergency_Contact_API.postman_collection.json`
2. Set variables:
   - `base_url`: `http://localhost:5000`
   - `auth_token`: Your JWT token
3. Run the test scenarios

---

## 📞 Call Flow Examples

### Direct Call Flow
1. Scan QR → Get device info
2. Initiate call → Get Agora token
3. Connect via Agora SDK
4. Real-time voice communication

### Masked Call Flow  
1. Scan QR → Get device info
2. Initiate masked call → API handles routing
3. Both parties receive calls from masked numbers
4. Communication via phone network

---

## 🔍 Monitoring & Health

### Health Check
```bash
GET /health
```
Returns system status, database connectivity, and service availability.

### Configuration Check (Dev)
```bash
GET /config
```
Returns current configuration (development only).

---

## 🐛 Common Issues

### Database Connection
```bash
# Check MongoDB is running
mongod --version

# Test connection
mongo mongodb://localhost:27017/qr_vehicle_emergency
```

### Agora Configuration
```bash
# Verify in .env
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate

# Test token generation
POST /api/agora/token
```

### Masked Calling
```bash
# Check service availability
GET /api/calls/methods

# Verify configuration
MASKED_CALLING_ENABLED=true
MASKED_CALLING_API_URL=https://api.example.com
```

---

## 📚 Next Steps

1. **Read the full documentation:** `docs/API_ROUTE_USAGE_GUIDE.md`
2. **Set up monitoring:** Configure health checks and logging
3. **Test emergency scenarios:** Use the Postman collection
4. **Configure notifications:** Set up Firebase for push notifications
5. **Deploy to production:** Follow the deployment guide

---

## 🆘 Support

- **Health Check:** `GET /health`
- **API Info:** `GET /api`  
- **Documentation:** `docs/` folder
- **Postman Collection:** Test all endpoints
- **Configuration:** All settings in `.env`

The system is now ready for emergency vehicle communications! 🚗📞