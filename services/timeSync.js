const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Check if server time is synchronized and provide sync commands
 */
const checkTimeSync = async () => {
  try {
    console.log('');
    console.log('🕐 TIME SYNCHRONIZATION CHECK:');
    console.log('🕐 Current server time:', new Date().toISOString());
    console.log('🌐 Current UTC time:', new Date().toUTCString());
    console.log('📅 Local time zone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    // Check if running on Windows or Unix-like system
    const isWindows = process.platform === 'win32';
    
    console.log('');
    console.log('🔧 TIME SYNC COMMANDS:');
    if (isWindows) {
      console.log('💡 Windows (run as Administrator):');
      console.log('   w32tm /resync');
      console.log('   w32tm /query /status');
    } else {
      console.log('💡 Linux/Mac:');
      console.log('   sudo ntpdate -s time.nist.gov');
      console.log('   or: sudo timedatectl set-ntp true');
      console.log('   Check status: timedatectl status');
    }
    
    // Try to get system time info (Unix-like systems only)
    if (!isWindows) {
      try {
        const { stdout } = await execAsync('timedatectl status 2>/dev/null || echo "timedatectl not available"');
        console.log('');
        console.log('📅 SYSTEM TIME INFO:');
        console.log(stdout);
      } catch (error) {
        console.log('   (System time info not available)');
      }
    }
    
    // Check if time seems reasonable (not too far from current time)
    const now = new Date();
    const year = now.getFullYear();
    if (year < 2020 || year > 2030) {
      console.log('');
      console.log('⚠️  WARNING: System time appears to be incorrect!');
      console.log('   Current year:', year);
      console.log('   This will cause Firebase authentication to fail.');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('Error checking time sync:', error.message);
  }
};

module.exports = {
  checkTimeSync
};