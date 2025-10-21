// Timeout wrapper for commands to prevent hangs
const { spawn } = require('child_process');

function runWithTimeout(command, args = [], timeoutMs = 300000) { // 5 minutes default
  return new Promise((resolve, reject) => {
    console.log(`⏱️ Running command with ${timeoutMs/1000}s timeout: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, { 
      shell: true,
      stdio: 'inherit'
    });
    
    const timeout = setTimeout(() => {
      console.log(`⏰ Command timed out after ${timeoutMs/1000}s, killing process...`);
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs/1000}s`));
    }, timeoutMs);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log(`✅ Command completed successfully`);
        resolve(code);
      } else {
        console.log(`❌ Command failed with exit code ${code}`);
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`❌ Command error:`, error.message);
      reject(error);
    });
  });
}

// Export for use in other scripts
module.exports = { runWithTimeout };

// If run directly, execute the command passed as arguments
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  const timeout = parseInt(process.argv.find(arg => arg.startsWith('--timeout='))?.split('=')[1]) || 300000;
  
  if (!command) {
    console.log('Usage: node timeout-command.js <command> [args...] [--timeout=300000]');
    process.exit(1);
  }
  
  runWithTimeout(command, args, timeout)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Command failed:', error.message);
      process.exit(1);
    });
}
