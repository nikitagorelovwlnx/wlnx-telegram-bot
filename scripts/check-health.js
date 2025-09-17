#!/usr/bin/env node

/**
 * Simple health check script for WLNX Telegram Bot
 * Usage: node scripts/check-health.js [--url=http://localhost:3001] [--format=json|table]
 */

const http = require('http');
const https = require('https');

// Parse command line arguments
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));
const formatArg = args.find(arg => arg.startsWith('--format='));

const HEALTH_URL = urlArg ? urlArg.split('=')[1] : 'http://localhost:3001';
const FORMAT = formatArg ? formatArg.split('=')[1] : 'table';

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getStatusEmoji(status) {
  switch (status) {
    case 'healthy': return '✅';
    case 'degraded': return '⚠️';
    case 'unhealthy': return '❌';
    case 'up': return '🟢';
    case 'down': return '🔴';
    default: return '⚪';
  }
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function displayTable(healthData) {
  console.log('\n🤖 WLNX Telegram Bot Health Status\n');
  console.log('━'.repeat(50));
  
  // Overall status
  const statusEmoji = getStatusEmoji(healthData.status);
  console.log(`${statusEmoji} Overall Status: ${healthData.status.toUpperCase()}`);
  console.log(`⏰ Uptime: ${formatDuration(healthData.uptime)}`);
  console.log(`📦 Version: ${healthData.version}`);
  console.log(`💾 Memory: ${healthData.memory.used}MB / ${healthData.memory.total}MB (${healthData.memory.percentage}%)`);
  console.log(`🕐 Last Check: ${new Date(healthData.timestamp).toLocaleString()}`);
  
  console.log('\n📊 Services Status:');
  console.log('━'.repeat(50));
  
  Object.entries(healthData.services).forEach(([name, service]) => {
    const emoji = getStatusEmoji(service.status);
    const serviceName = name.charAt(0).toUpperCase() + name.slice(1);
    const responseTime = service.responseTime ? `${service.responseTime}ms` : 'N/A';
    
    console.log(`${emoji} ${serviceName.padEnd(12)} ${service.status.toUpperCase().padEnd(8)} ${responseTime}`);
    
    if (service.error) {
      console.log(`   ↳ Error: ${service.error}`);
    }
  });
  
  console.log('━'.repeat(50));
}

function displayJson(healthData) {
  console.log(JSON.stringify(healthData, null, 2));
}

async function checkHealth() {
  try {
    console.log(`Checking bot health at: ${HEALTH_URL}/health`);
    
    const result = await makeRequest(`${HEALTH_URL}/health`);
    
    if (FORMAT === 'json') {
      displayJson(result.data);
    } else {
      displayTable(result.data);
    }
    
    // Exit code based on health status
    const exitCode = result.data.status === 'healthy' ? 0 : 1;
    process.exit(exitCode);
    
  } catch (error) {
    console.error(`\n❌ Health check failed: ${error.message}`);
    console.error(`Make sure the bot is running and accessible at: ${HEALTH_URL}`);
    
    if (FORMAT === 'json') {
      console.log(JSON.stringify({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      }, null, 2));
    }
    
    process.exit(2);
  }
}

// Show usage if help requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node scripts/check-health.js [options]

Options:
  --url=<url>        Health check URL (default: http://localhost:3001)
  --format=<format>  Output format: json|table (default: table)
  --help, -h         Show this help message

Exit codes:
  0 - Bot is healthy
  1 - Bot is unhealthy or degraded
  2 - Health check failed (connection error)

Examples:
  node scripts/check-health.js
  node scripts/check-health.js --url=http://localhost:3001 --format=json
  node scripts/check-health.js --format=table
`);
  process.exit(0);
}

checkHealth();
