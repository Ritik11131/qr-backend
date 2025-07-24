const fetch = require('node-fetch');
const config = require('../config/app');

class MaskedCallingService {
  constructor() {
    this.config = config.get('maskedCalling');
    this.isEnabled = this.config.enabled;
    this.apiUrl = this.config.apiUrl;
    this.apiKey = this.config.apiKey;
    this.timeout = this.config.timeout;
    this.retryAttempts = this.config.retryAttempts;
  }

  /**
   * Check if masked calling is available
   */
  isAvailable() {
    return this.isEnabled && this.apiUrl && this.apiKey;
  }

  /**
   * Initiate a masked call between caller and receiver
   * @param {Object} callData - Call information
   * @returns {Promise<Object>} - Call result
   */
  async initiateMaskedCall(callData) {
    if (!this.isAvailable()) {
      throw new Error('Masked calling service is not configured or disabled');
    }

    const { callId, callerPhone, receiverPhone, callbackUrl, metadata } = callData;

    if (!callerPhone || !receiverPhone) {
      throw new Error('Both caller and receiver phone numbers are required for masked calling');
    }

    const payload = {
      call_id: callId,
      caller_number: this.formatPhoneNumber(callerPhone),
      receiver_number: this.formatPhoneNumber(receiverPhone),
      callback_url: callbackUrl,
      call_type: 'emergency',
      max_duration: config.get('calls.maxDuration'),
      metadata: {
        ...metadata,
        initiated_at: new Date().toISOString(),
        service: 'qr-vehicle-emergency'
      }
    };

    try {
      console.log(`📞 Initiating masked call: ${callId}`);
      console.log(`   📱 Caller: ${this.maskPhoneNumber(callerPhone)}`);
      console.log(`   📱 Receiver: ${this.maskPhoneNumber(receiverPhone)}`);

      const response = await this.makeApiCall('/initiate-call', 'POST', payload);
      
      console.log(`✅ Masked call initiated successfully: ${callId}`);
      
      return {
        success: true,
        callId,
        maskedCallId: response.masked_call_id,
        callerMaskedNumber: response.caller_masked_number,
        receiverMaskedNumber: response.receiver_masked_number,
        status: response.status,
        estimatedConnectTime: response.estimated_connect_time,
        callbackUrl: response.callback_url
      };

    } catch (error) {
      console.error(`❌ Failed to initiate masked call ${callId}:`, error.message);
      throw new Error(`Masked calling failed: ${error.message}`);
    }
  }

  /**
   * End a masked call
   * @param {string} maskedCallId - The masked call ID
   * @returns {Promise<Object>} - End call result
   */
  async endMaskedCall(maskedCallId) {
    if (!this.isAvailable()) {
      throw new Error('Masked calling service is not configured');
    }

    try {
      console.log(`📴 Ending masked call: ${maskedCallId}`);

      const response = await this.makeApiCall(`/end-call/${maskedCallId}`, 'POST');
      
      console.log(`✅ Masked call ended: ${maskedCallId}`);
      
      return {
        success: true,
        maskedCallId,
        status: response.status,
        duration: response.duration,
        endedAt: response.ended_at
      };

    } catch (error) {
      console.error(`❌ Failed to end masked call ${maskedCallId}:`, error.message);
      throw new Error(`Failed to end masked call: ${error.message}`);
    }
  }

  /**
   * Get masked call status
   * @param {string} maskedCallId - The masked call ID
   * @returns {Promise<Object>} - Call status
   */
  async getMaskedCallStatus(maskedCallId) {
    if (!this.isAvailable()) {
      throw new Error('Masked calling service is not configured');
    }

    try {
      const response = await this.makeApiCall(`/call-status/${maskedCallId}`, 'GET');
      
      return {
        success: true,
        maskedCallId,
        status: response.status,
        duration: response.duration,
        startedAt: response.started_at,
        endedAt: response.ended_at,
        participants: response.participants
      };

    } catch (error) {
      console.error(`❌ Failed to get masked call status ${maskedCallId}:`, error.message);
      throw new Error(`Failed to get call status: ${error.message}`);
    }
  }

  /**
   * Handle masked call webhook callbacks
   * @param {Object} webhookData - Webhook payload
   * @returns {Object} - Processed webhook data
   */
  handleWebhook(webhookData) {
    const { 
      masked_call_id, 
      call_id, 
      event_type, 
      status, 
      duration, 
      participants,
      timestamp 
    } = webhookData;

    console.log(`🔔 Masked call webhook received: ${event_type} for call ${masked_call_id}`);

    const processedData = {
      maskedCallId: masked_call_id,
      originalCallId: call_id,
      eventType: event_type,
      status,
      duration,
      participants,
      timestamp: new Date(timestamp),
      receivedAt: new Date()
    };

    // Emit socket event based on webhook type
    switch (event_type) {
      case 'call_initiated':
        return { ...processedData, action: 'call_started' };
      case 'call_answered':
        return { ...processedData, action: 'call_connected' };
      case 'call_ended':
        return { ...processedData, action: 'call_finished' };
      case 'call_failed':
        return { ...processedData, action: 'call_error' };
      default:
        return { ...processedData, action: 'call_update' };
    }
  }

  /**
   * Make API call to masked calling service
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request payload
   * @returns {Promise<Object>} - API response
   */
  async makeApiCall(endpoint, method = 'GET', data = null) {
    const url = `${this.apiUrl}${endpoint}`;
    let attempt = 0;

    while (attempt < this.retryAttempts) {
      try {
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'QR-Vehicle-Emergency/2.0'
          },
          timeout: this.timeout
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        return result;

      } catch (error) {
        attempt++;
        console.error(`❌ Masked calling API attempt ${attempt} failed:`, error.message);

        if (attempt >= this.retryAttempts) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        await this.sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
  }

  /**
   * Format phone number for API
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming +1 for US/Canada)
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    } else if (!cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    
    return cleaned;
  }

  /**
   * Mask phone number for logging
   * @param {string} phoneNumber - Phone number to mask
   * @returns {string} - Masked phone number
   */
  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 4) {
      return '***-***-****';
    }
    
    const cleaned = phoneNumber.replace(/\D/g, '');
    const lastFour = cleaned.slice(-4);
    const masked = '*'.repeat(Math.max(0, cleaned.length - 4));
    
    return `${masked}${lastFour}`;
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} - Sleep promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service configuration
   * @returns {Object} - Service configuration
   */
  getConfig() {
    return {
      enabled: this.isEnabled,
      available: this.isAvailable(),
      apiUrl: this.apiUrl ? `${this.apiUrl.split('/')[0]}//${this.apiUrl.split('/')[2]}` : null,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts
    };
  }
}

module.exports = new MaskedCallingService();