# 🏥 Health Check System for WLNX Telegram Bot

## 📊 Overview

The Health Check system provides real-time monitoring of the bot and its components status. Automatically starts an HTTP server for status checks.

## 🚀 Quick Start

### Running bot with healthcheck
```bash
npm run dev
# Health check will be available at http://localhost:3001
```

### Status checking
```bash
# From command line
npm run health

# JSON format
npm run health:json

# Direct request
curl http://localhost:3001/health
```

## 🔗 Endpoints

### `/health` and `/status`
Complete information about bot status

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 300000,
  "version": "1.0.0",
  "services": {
    "openai": {
      "status": "up",
      "responseTime": 45
    },
    "api": {
      "status": "up", 
      "responseTime": 12
    },
    "telegram": {
      "status": "up",
      "responseTime": 8
    }
  },
  "memory": {
    "used": 128,
    "total": 256,
    "percentage": 50
  }
}
```

### `/ping`
Simple availability check

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 📈 Statuses

### Overall bot status
- **`healthy`** ✅ - all services are working
- **`degraded`** ⚠️ - some services are unavailable
- **`unhealthy`** ❌ - critical services are not working

### Service status
- **`up`** 🟢 - service is working
- **`down`** 🔴 - service is unavailable
- **`unknown`** ⚪ - status is unknown

## 🔧 Configuration

### Environment variables
```bash
# Port for health check server (default: 3001)
HEALTH_PORT=3001

# Main bot settings for checking
BOT_TOKEN=your_bot_token
OPENAI_API_KEY=your_openai_key
API_BASE_URL=http://your-api-server.com
```

## 📱 Monitoring

### 1. Web Interface
Open `examples/health-client.html` in browser for visual monitoring:

![Health Monitor](https://via.placeholder.com/600x400?text=Health+Monitor+UI)

### 2. Command Line
```bash
# Pretty table output
npm run health

# JSON for parsing
npm run health:json

# Custom URL
node scripts/check-health.js --url=http://production-bot:3001
```

### 3. Curl requests
```bash
# Quick check
curl -s http://localhost:3001/ping

# Full status
curl -s http://localhost:3001/health | jq .

# Status only
curl -s http://localhost:3001/health | jq -r .status
```

## 🚨 Alerting and Monitoring

### Script exit codes
- **0** - Bot is healthy
- **1** - Bot is unhealthy or degraded
- **2** - Connection error

### Monitoring integration
```bash
#!/bin/bash
# Example monitoring script

if npm run health > /dev/null 2>&1; then
    echo "✅ Bot is healthy"
else
    echo "❌ Bot needs attention"
    # Send notification
    curl -X POST "https://api.telegram.org/bot$ALERT_BOT_TOKEN/sendMessage" \
         -d "chat_id=$ADMIN_CHAT_ID" \
         -d "text=🚨 WLNX Bot is unhealthy!"
fi
```

### Prometheus metrics (optional)
```javascript
// Can be extended for metrics export
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP bot_uptime_seconds Bot uptime in seconds
# TYPE bot_uptime_seconds counter
bot_uptime_seconds ${Math.floor(process.uptime())}

# HELP bot_memory_usage_bytes Memory usage in bytes
# TYPE bot_memory_usage_bytes gauge
bot_memory_usage_bytes ${process.memoryUsage().heapUsed}
  `);
});
```

## 🧪 Testing

```bash
# Run health check tests
npm test -- healthcheck.test.ts

# Check all endpoints
curl http://localhost:3001/health
curl http://localhost:3001/status  
curl http://localhost:3001/ping
curl http://localhost:3001/unknown  # Should return 404
```

## 🔒 Security

### CORS settings
Health check endpoints are available for all origins for monitoring convenience.

### Private data
Health check **DOES NOT expose**:
- API keys
- Tokens
- User data
- Internal configurations

Shows only:
- Service availability status
- Performance metrics
- Uptime

## 📋 Production Usage

### Docker Health Check
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/ping || exit 1
```

### Kubernetes Probes
```yaml
livenessProbe:
  httpGet:
    path: /ping
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Load Balancer Health Check
```nginx
upstream telegram_bot {
    server bot1:3000;
    server bot2:3000;
}

# Health check endpoint
location /health {
    proxy_pass http://telegram_bot:3001/health;
}
```

## 🎯 Best Practices

1. **Regular monitoring** - check status every 30 seconds
2. **Alerting** - set up notifications for `unhealthy` status
3. **Logging** - all health check requests are logged
4. **Auto-start** - health check server starts automatically with bot
5. **Graceful shutdown** - server stops correctly when bot shuts down

---

**Ready for production use!** 🚀
