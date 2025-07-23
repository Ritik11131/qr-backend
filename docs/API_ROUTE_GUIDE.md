# QR Vehicle Emergency System - API Route Usage Guide

## 📋 Table of Contents
1. [System Health & Information](#system-health--information)
2. [Admin Routes (Role: 1)](#admin-routes-role-1)
3. [QR Code & Device Management](#qr-code--device-management)
4. [Call Management](#call-management)
5. [Agora Integration](#agora-integration)
6. [Notifications](#notifications)
7. [Authentication Guide](#authentication-guide)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Testing Scenarios](#testing-scenarios)

---

## System Health & Information

### 🏥 Health Check
**Route:** `GET /health`  
**Auth:** None required  
**When to use:** 
- Monitor system status
- Check database connectivity
- Verify service availability
- Load balancer health checks

**Response includes:**
- System status
- Database connection status
- Service configurations
- Uptime information

---

### 📖 API Information
**Route:** `GET /api`  
**Auth:** None required  
**When to use:**
- Discover available endpoints
- Check API version
- Understand system capabilities
- Integration planning

---

### ⚙️ Configuration (Development Only)
**Route:** `GET /config`  
**Auth:** Required (any valid JWT)  
**When to use:**
- Debug configuration issues
- Verify environment settings
- Development troubleshooting
- **Note:** Only available in development mode

---

## Admin Routes (Role: 1)

### 🏭 Bulk Generate QR Codes
**Route:** `POST /api/admin/qr/bulk-generate`  
**Auth:** Admin JWT (role: "1")  
**When to use:**
- GPS installation companies generating QR batches
- Creating QR codes for distribution to customers
- Preparing QR codes for printing and packaging

**Payload:**
```json
{
  "count": 1000,
  "batchNumber": "BATCH_2024_001",
  "qrType": "sticker",
  "notes": "For January 2024 installations"
}
```

**Use cases:**
- Generate 10,000-20,000 QR codes per batch
- Different QR types: sticker, card, magnet, plate
- Track batches for inventory management

---

### 📊 Get QR Inventory
**Route:** `GET /api/admin/qr/inventory`  
**Auth:** Admin JWT (role: "1")  
**When to use:**
- Monitor QR code usage and availability
- Track which QR codes are linked vs available
- Filter by batch, status, or date range
- Inventory management and reporting

**Query Parameters:**
- `page`, `limit` - Pagination
- `status` - Filter by status (available, linked, suspended, damaged)
- `batchNumber` - Filter by specific batch
- `search` - Search QR IDs or batch numbers
- `dateFrom`, `dateTo` - Date range filtering

---

### 📈 Get QR Analytics
**Route:** `GET /api/admin/qr/analytics`  
**Auth:** Admin JWT (role: "1")  
**When to use:**
- Business intelligence and reporting
- Track QR code usage patterns
- Monitor emergency call statistics
- Performance analysis and optimization

**Provides:**
- Status distribution
- Usage statistics
- Emergency call patterns
- Batch performance metrics

---

### 🔄 Update QR Status
**Route:** `PUT /api/admin/qr/:qrId/status`  
**Auth:** Admin JWT (role: "1")  
**When to use:**
- Suspend damaged or lost QR codes
- Reactivate suspended QR codes
- Mark QR codes as damaged during installation
- Administrative control over QR lifecycle

**Payload:**
```json
{
  "status": "suspended",
  "reason": "QR code damaged during installation"
}
```

---

### 📤 Export QR Batch
**Route:** `GET /api/admin/qr/export/:batchNumber`  
**Auth:** Admin JWT (role: "1")  
**When to use:**
- Export QR codes for printing
- Generate CSV files for external systems
- Backup QR code data
- Integration with printing services

**Query Parameters:**
- `format` - "json" or "csv"

---

### 📊 Admin Dashboard
**Route:** `GET /api/admin/dashboard`  
**Auth:** Admin JWT (role: "1")  
**When to use:**
- System overview and monitoring
- Key performance indicators
- Recent activity tracking
- Executive reporting

---

## QR Code & Device Management

### 🔍 Get QR Info (Public)
**Route:** `GET /api/qr/info/:qrId`  
**Auth:** None required (Public endpoint)  
**When to use:**
- Anonymous users scanning QR codes
- Check if QR is linked and active
- Get emergency contact information
- Verify QR code validity before calling

**Response varies by QR status:**
- **Available:** Shows QR is not yet activated
- **Linked:** Shows device info and emergency settings
- **Suspended/Damaged:** Shows status message

---

### 🔗 Link QR to Device
**Route:** `POST /api/qr/link`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Vehicle owners linking QR to their GPS device
- Initial device setup and activation
- Associating QR with vehicle information

**Payload:**
```json
{
  "qrId": "QR_BATCH_001_000001",
  "deviceInfo": {
    "model": "GPS-Tracker-Pro-2000",
    "serialNumber": "SN123456789ABC"
  }
}
```

---

### 📱 Get My Devices
**Route:** `GET /api/qr/my-devices`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Users viewing their linked devices
- Device management dashboard
- Check QR code status and statistics
- Access emergency settings

---

### ⚙️ Update Device Settings
**Route:** `PUT /api/qr/device/:deviceId/settings`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Configure emergency contacts
- Set call preferences (direct vs masked)
- Enable/disable anonymous calls
- Update auto-answer settings

**Payload:**
```json
{
  "emergencyContacts": [
    {
      "name": "Jane Doe",
      "phone": "+1234567890",
      "relationship": "spouse",
      "priority": 1
    }
  ],
  "autoAnswer": false,
  "allowAnonymousCalls": true,
  "callMethods": ["direct", "masked"]
}
```

---

### 🔓 Unlink QR Code
**Route:** `POST /api/qr/unlink/:qrId`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Vehicle sold or transferred
- Device replacement or upgrade
- Deactivating QR code temporarily
- Making QR available for relinking

---

### 📞 Get Device Call History
**Route:** `GET /api/qr/device/:deviceId/calls`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Review emergency calls received
- Monitor device usage
- Filter by emergency type or call method
- Security and audit purposes

---

## Call Management

### 📋 Get Available Call Methods
**Route:** `GET /api/calls/methods`  
**Auth:** None required  
**When to use:**
- Check which calling methods are available
- Determine if masked calling is configured
- Display calling options to users
- Feature discovery

**Returns:**
- Direct calling (always available)
- Masked calling (if configured)
- Method requirements and descriptions

---

### 📞 Initiate Emergency Call
**Route:** `POST /api/calls/initiate`  
**Auth:** None required (Anonymous callers)  
**When to use:**
- Anonymous users calling vehicle owners
- Emergency situations requiring immediate contact
- Both direct and masked calling support

**Direct Call Payload:**
```json
{
  "qrId": "QR_BATCH_001_000001",
  "callMethod": "direct",
  "callerInfo": {
    "name": "Good Samaritan",
    "location": "Highway 101, Mile 42"
  },
  "emergencyType": "breakdown",
  "urgencyLevel": "medium"
}
```

**Masked Call Payload:**
```json
{
  "qrId": "QR_BATCH_001_000001",
  "callMethod": "masked",
  "callerInfo": {
    "name": "Emergency Caller",
    "phone": "+1234567890",
    "location": "Highway 101, Mile 42"
  },
  "emergencyType": "accident",
  "urgencyLevel": "high"
}
```

**Emergency Types:**
- `accident` - Vehicle accident (critical priority)
- `breakdown` - Vehicle breakdown (high priority)
- `theft` - Vehicle theft/security (high priority)
- `medical` - Medical emergency (critical priority)
- `general` - General contact (normal priority)

**Urgency Levels:**
- `low` - Non-urgent contact
- `medium` - Standard emergency
- `high` - Urgent emergency
- `critical` - Life-threatening emergency

---

### ✅ Answer Call
**Route:** `POST /api/calls/:callId/answer`  
**Auth:** User JWT (role: "2") - Only QR owner can answer  
**When to use:**
- Vehicle owner accepting incoming emergency call
- Establishing communication with caller
- Both direct and masked calls supported

---

### ❌ Reject Call
**Route:** `POST /api/calls/:callId/reject`  
**Auth:** User JWT (role: "2") - Only QR owner can reject  
**When to use:**
- Unable to take call at the moment
- Inappropriate or spam calls
- Automatic rejection based on settings

---

### 📴 End Call
**Route:** `POST /api/calls/:callId/end`  
**Auth:** None required - Anyone in call can end  
**When to use:**
- Completing emergency call
- Ending call due to technical issues
- Call quality feedback and rating

**Payload:**
```json
{
  "duration": 120,
  "endedBy": "caller",
  "callQuality": {
    "rating": 5,
    "feedback": "Helpful conversation"
  }
}
```

---

### 📊 Get Call Status
**Route:** `GET /api/calls/:callId/status`  
**Auth:** None required - Anonymous callers can check  
**When to use:**
- Anonymous callers checking call progress
- Monitoring call state changes
- Debugging call issues
- Real-time status updates

---

### 📋 Get Call History
**Route:** `GET /api/calls/history`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Users reviewing their call history
- Filtering by emergency type or call method
- Security and audit purposes
- Analytics and reporting

**Query Parameters:**
- `emergencyOnly` - Filter emergency calls only
- `emergencyType` - Filter by specific emergency type
- `callMethod` - Filter by direct or masked calls
- `dateFrom`, `dateTo` - Date range filtering

---

### 📞 Get Call Details
**Route:** `GET /api/calls/:callId`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Detailed call information
- Call quality metrics
- Masked call details (if applicable)
- Audit and compliance

---

### 🔗 Masked Call Webhook
**Route:** `POST /api/calls/webhook/masked`  
**Auth:** None required (Webhook endpoint)  
**When to use:**
- Masked calling service sending status updates
- Call state changes (answered, ended, failed)
- Automatic call record updates
- Real-time synchronization

---

## Agora Integration

### 🎤 Generate Agora Token
**Route:** `POST /api/agora/token`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Direct calling via Agora SDK
- Voice/video call authentication
- Channel access token generation
- Real-time communication setup

**Payload:**
```json
{
  "channelName": "emergency_call_123",
  "uid": "caller_123",
  "role": 1
}
```

---

### ⚙️ Get Agora Configuration
**Route:** `GET /api/agora/config`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Client-side Agora SDK initialization
- Feature availability checking
- Configuration validation
- Integration setup

---

## Notifications

### 🧪 Send Test Notification
**Route:** `POST /api/notifications/test`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Testing notification delivery
- Verifying device token registration
- Debugging notification issues
- User notification preferences testing

---

### 📤 Send Notification to User
**Route:** `POST /api/notifications/send`  
**Auth:** User JWT (role: "2")  
**When to use:**
- Custom notification sending
- Emergency alerts
- System notifications
- Administrative messages

---

### ⚙️ Get/Update Notification Settings
**Routes:** 
- `GET /api/notifications/settings`
- `PUT /api/notifications/settings`  
**Auth:** User JWT (role: "2")  
**When to use:**
- User preference management
- Enable/disable notification types
- Configure notification channels
- Privacy settings

---

### 📢 Send Bulk Notification
**Route:** `POST /api/notifications/bulk`  
**Auth:** Admin JWT (role: "1")  
**When to use:**
- System-wide announcements
- Maintenance notifications
- Emergency broadcasts
- Marketing communications

---

## Authentication Guide

### JWT Token Structure
All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Admin JWT (role: "1")
```json
{
  "unique_name": "Admin User",
  "role": "1",
  "user_id": "2",
  "parent_id": "1",
  "time_zone": "05:30",
  "exp": 1753698102
}
```

**Admin Capabilities:**
- Generate and manage QR codes
- View system analytics
- Export QR batches
- System administration
- Bulk notifications

### User JWT (role: "2")
```json
{
  "unique_name": "Vehicle Owner",
  "role": "2",
  "user_id": "10",
  "parent_id": "2",
  "time_zone": "Asia/Kolkata",
  "exp": 1753707041
}
```

**User Capabilities:**
- Link QR codes to devices
- Manage device settings
- Answer/reject calls
- View call history
- Notification preferences

### Public Endpoints (No Auth)
- Health check
- API information
- QR code information
- Call initiation
- Call status checking
- Masked call webhooks

---

## Error Handling

### Standard Error Response Format
```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": ["Additional error details"]
}
```

### Common Error Codes
- `NO_TOKEN` - Missing authentication token
- `INVALID_TOKEN` - Invalid or expired token
- `ADMIN_REQUIRED` - Admin privileges required
- `QR_NOT_FOUND` - QR code not found
- `DEVICE_NOT_FOUND` - Device not found
- `CALL_NOT_FOUND` - Call not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `VALIDATION_ERROR` - Request validation failed

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Rate Limiting

### Rate Limit Headers
All responses include rate limiting headers:
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset time

### Rate Limit Types
- **Global:** 1000 requests per 15 minutes
- **Auth:** 5 requests per 15 minutes
- **Calls:** 10 requests per minute
- **Admin:** 50 requests per 15 minutes

### Rate Limit Strategies
- IP-based for anonymous users
- User-based for authenticated users
- Endpoint-specific limits
- Bypass for health checks

---

## Testing Scenarios

### Complete Emergency Flow - Direct Call
1. **Get QR Info:** `GET /api/qr/info/:qrId`
2. **Check Call Methods:** `GET /api/calls/methods`
3. **Initiate Call:** `POST /api/calls/initiate` (callMethod: "direct")
4. **Check Status:** `GET /api/calls/:callId/status`
5. **Answer Call:** `POST /api/calls/:callId/answer` (with auth)
6. **End Call:** `POST /api/calls/:callId/end`

### Complete Emergency Flow - Masked Call
1. **Get QR Info:** `GET /api/qr/info/:qrId`
2. **Initiate Masked Call:** `POST /api/calls/initiate` (callMethod: "masked", phone required)
3. **Check Status:** `GET /api/calls/:callId/status`
4. **Webhook Updates:** `POST /api/calls/webhook/masked`
5. **Answer Call:** `POST /api/calls/:callId/answer` (with auth)
6. **End Call:** `POST /api/calls/:callId/end`

### Admin Workflow
1. **Generate QR Batch:** `POST /api/admin/qr/bulk-generate`
2. **Check Inventory:** `GET /api/admin/qr/inventory`
3. **Export for Printing:** `GET /api/admin/qr/export/:batchNumber`
4. **Monitor Analytics:** `GET /api/admin/qr/analytics`
5. **Update QR Status:** `PUT /api/admin/qr/:qrId/status`

### User Device Management
1. **Link QR Code:** `POST /api/qr/link`
2. **View Devices:** `GET /api/qr/my-devices`
3. **Update Settings:** `PUT /api/qr/device/:deviceId/settings`
4. **Check Call History:** `GET /api/qr/device/:deviceId/calls`
5. **Unlink if Needed:** `POST /api/qr/unlink/:qrId`

---

## Best Practices

### For Developers
1. Always check rate limits before making requests
2. Handle errors gracefully with proper user feedback
3. Use appropriate HTTP methods and status codes
4. Implement proper authentication token management
5. Test both direct and masked calling scenarios

### For System Administrators
1. Monitor health endpoints regularly
2. Set up proper logging and alerting
3. Configure rate limits based on usage patterns
4. Regularly backup QR code data
5. Monitor masked calling service integration

### For Integration Partners
1. Use webhook endpoints for real-time updates
2. Implement proper retry logic for failed requests
3. Cache configuration data appropriately
4. Handle service degradation gracefully
5. Test emergency scenarios thoroughly

---

This guide provides comprehensive information about when and how to use each API endpoint in the QR Vehicle Emergency System. For additional technical details, refer to the API documentation and Postman collection.