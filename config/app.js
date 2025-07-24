const path = require('path');

class AppConfig {
  constructor() {
    this.loadConfig();
  }

  loadConfig() {
    this.config = {
      // Server Configuration
      server: {
        port: parseInt(process.env.PORT) || 5000,
        host: process.env.HOST || '0.0.0.0',
        environment: process.env.NODE_ENV || 'development',
        apiVersion: '2.0.0',
        maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb'
      },

      // Database Configuration
      database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_vehicle_emergency',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
          serverSelectionTimeoutMS: parseInt(process.env.DB_TIMEOUT) || 5000,
          socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
        }
      },

      // JWT Configuration
      jwt: {
        secret: process.env.JWT_SECRET || 'fallback_secret_key_change_in_production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: process.env.JWT_ISSUER || 'qr-vehicle-emergency-system',
        audience: process.env.JWT_AUDIENCE || 'qr-vehicle-emergency-users'
      },

      // Agora Configuration
      agora: {
        appId: process.env.AGORA_APP_ID,
        appCertificate: process.env.AGORA_APP_CERTIFICATE,
        tokenExpiryTime: parseInt(process.env.AGORA_TOKEN_EXPIRY) || 3600,
        maxChannelUsers: parseInt(process.env.AGORA_MAX_USERS) || 17
      },

      // Firebase Configuration
      firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
          path.join(__dirname, 'firebase-service-account.json')
      },

      // Masked Calling Configuration
      maskedCalling: {
        enabled: process.env.MASKED_CALLING_ENABLED === 'true',
        apiUrl: process.env.MASKED_CALLING_API_URL,
        apiKey: process.env.MASKED_CALLING_API_KEY,
        timeout: parseInt(process.env.MASKED_CALLING_TIMEOUT) || 30000,
        retryAttempts: parseInt(process.env.MASKED_CALLING_RETRIES) || 3
      },

      // CORS Configuration
      cors: {
        origins: this.parseOrigins(process.env.CORS_ORIGINS),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true
      },

      // Rate Limiting Configuration
      rateLimiting: {
        global: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
          max: parseInt(process.env.RATE_LIMIT_MAX) || 1000
        },
        auth: {
          windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
          max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5
        },
        calls: {
          windowMs: parseInt(process.env.CALL_RATE_LIMIT_WINDOW) || 1 * 60 * 1000,
          max: parseInt(process.env.CALL_RATE_LIMIT_MAX) || 10
        },
        admin: {
          windowMs: parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
          max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX) || 50
        }
      },

      // URLs Configuration
      urls: {
        frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
        caller: process.env.CALLER_URL || 'http://localhost:8000',
        api: process.env.API_URL || 'http://localhost:5000'
      },

      // Security Configuration
      security: {
        helmet: {
          crossOriginEmbedderPolicy: false,
          contentSecurityPolicy: process.env.NODE_ENV === 'production'
        },
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
      },

      // Logging Configuration
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined',
        enableConsole: process.env.ENABLE_CONSOLE_LOGS !== 'false',
        enableFile: process.env.ENABLE_FILE_LOGS === 'true',
        filePath: process.env.LOG_FILE_PATH || './logs/app.log'
      },

      // Socket.IO Configuration
      socketIO: {
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
        pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
      },

      // QR Code Configuration
      qrCode: {
        batchSizeLimit: parseInt(process.env.QR_BATCH_SIZE_LIMIT) || 20000,
        defaultType: process.env.QR_DEFAULT_TYPE || 'sticker',
        baseUrl: process.env.QR_BASE_URL || process.env.CALLER_URL || 'http://localhost:8000'
      },

      // Call Configuration
      calls: {
        maxDuration: parseInt(process.env.MAX_CALL_DURATION) || 3600, // 1 hour
        ringTimeout: parseInt(process.env.CALL_RING_TIMEOUT) || 30, // 30 seconds
        enableRecording: process.env.ENABLE_CALL_RECORDING === 'true',
        emergencyPriority: process.env.EMERGENCY_PRIORITY_ENABLED !== 'false'
      },

      // Notification Configuration
      notifications: {
        enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
        tokenApiUrl: process.env.TOKEN_API_URL || 'https://api.torqiot.in/api/token/GetTokenByUserId',
        retryAttempts: parseInt(process.env.NOTIFICATION_RETRIES) || 3,
        timeout: parseInt(process.env.NOTIFICATION_TIMEOUT) || 10000
      }
    };
  }

  parseOrigins(originsString) {
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:8000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://127.0.0.1:8000',
      'http://127.0.0.1:3000'
    ];

    if (!originsString) {
      return [
        ...defaultOrigins,
        this.config?.urls?.frontend || process.env.FRONTEND_URL || 'http://localhost:3000',
        this.config?.urls?.caller || process.env.CALLER_URL || 'http://localhost:8000'
      ];
    }

    return originsString.split(',').map(origin => origin.trim());
  }

  get(path) {
    return this.getNestedValue(this.config, path);
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  isDevelopment() {
    return this.config.server.environment === 'development';
  }

  isProduction() {
    return this.config.server.environment === 'production';
  }

  validateConfig() {
    const requiredFields = [
      'agora.appId',
      'agora.appCertificate',
      'firebase.projectId'
    ];

    const missingFields = requiredFields.filter(field => !this.get(field));
    
    if (missingFields.length > 0) {
      console.warn('⚠️ Missing configuration fields:', missingFields);
      if (this.isProduction()) {
        throw new Error(`Missing required configuration: ${missingFields.join(', ')}`);
      }
    }

    return true;
  }

  getAll() {
    return { ...this.config };
  }
}

module.exports = new AppConfig();