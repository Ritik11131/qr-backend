const mongoose = require('mongoose');

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
  }

  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_vehicle_emergency';
      
      const options = {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
        // maxPoolSize: 10,
        // serverSelectionTimeoutMS: 5000,
        // socketTimeoutMS: 45000,
        // bufferMaxEntries: 0,
        // bufferCommands: false,
      };

      await mongoose.connect(mongoUri, options);
      
      this.isConnected = true;
      this.connectionRetries = 0;
      
      console.log('✅ Connected to MongoDB');
      console.log(`📍 Database: ${mongoose.connection.name}`);
      console.log(`🔗 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
      
      // Handle connection events
      mongoose.connection.on('error', this.handleError.bind(this));
      mongoose.connection.on('disconnected', this.handleDisconnected.bind(this));
      mongoose.connection.on('reconnected', this.handleReconnected.bind(this));
      
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  handleError(error) {
    console.error('❌ MongoDB connection error:', error);
    this.isConnected = false;
  }

  handleDisconnected() {
    console.warn('⚠️ MongoDB disconnected');
    this.isConnected = false;
    this.attemptReconnection();
  }

  handleReconnected() {
    console.log('✅ MongoDB reconnected');
    this.isConnected = true;
    this.connectionRetries = 0;
  }

  async attemptReconnection() {
    if (this.connectionRetries < this.maxRetries) {
      this.connectionRetries++;
      console.log(`🔄 Attempting to reconnect to MongoDB (${this.connectionRetries}/${this.maxRetries})`);
      
      setTimeout(() => {
        this.connect();
      }, 5000 * this.connectionRetries);
    } else {
      console.error('❌ Max reconnection attempts reached. Exiting...');
      process.exit(1);
    }
  }

  handleConnectionError(error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    
    if (this.connectionRetries < this.maxRetries) {
      this.connectionRetries++;
      console.log(`🔄 Retrying connection (${this.connectionRetries}/${this.maxRetries}) in 5 seconds...`);
      
      setTimeout(() => {
        this.connect();
      }, 5000);
    } else {
      console.error('❌ Max connection attempts reached. Exiting...');
      process.exit(1);
    }
  }

  async disconnect() {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('✅ MongoDB connection closed');
    } catch (error) {
      console.error('❌ Error closing MongoDB connection:', error);
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }
}

module.exports = new DatabaseConnection();