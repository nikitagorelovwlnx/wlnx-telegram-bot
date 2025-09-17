/**
 * Health check service for monitoring bot status
 */

import http from 'http';
import { conversationService } from './services/conversationService';
import { apiService } from './services/apiService';
import { config } from './config';
import { logger } from './utils/logger';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    openai: ServiceStatus;
    api: ServiceStatus;
    telegram: ServiceStatus;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

interface ServiceStatus {
  status: 'up' | 'down' | 'unknown';
  responseTime?: number;
  error?: string;
}

class HealthCheckService {
  private server: http.Server | null = null;
  private startTime: number = Date.now();

  async start(port: number = 3001): Promise<void> {
    this.server = http.createServer(async (req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Content-Type', 'application/json');

      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
      }

      if (req.url === '/health' || req.url === '/status') {
        try {
          const healthStatus = await this.getHealthStatus();
          const statusCode = healthStatus.status === 'healthy' ? 200 : 
                           healthStatus.status === 'degraded' ? 200 : 503;
          
          res.statusCode = statusCode;
          res.end(JSON.stringify(healthStatus, null, 2));
        } catch (error) {
          logger.error('Health check error:', error);
          res.statusCode = 503;
          res.end(JSON.stringify({
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
          }, null, 2));
        }
      } else if (req.url === '/ping') {
        res.statusCode = 200;
        res.end(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString() 
        }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ 
          error: 'Not found',
          availableEndpoints: ['/health', '/status', '/ping']
        }));
      }
    });

    this.server.listen(port, () => {
      logger.info(`Health check server started on port ${port}`);
      logger.info(`Available endpoints:`);
      logger.info(`  - http://localhost:${port}/health`);
      logger.info(`  - http://localhost:${port}/status`);
      logger.info(`  - http://localhost:${port}/ping`);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          logger.info('Health check server stopped');
          resolve();
        });
      });
    }
  }

  private async getHealthStatus(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    // Check services
    const [openaiStatus, apiStatus, telegramStatus] = await Promise.all([
      this.checkOpenAI(),
      this.checkAPI(),
      this.checkTelegram()
    ]);

    // Memory usage
    const memUsage = process.memoryUsage();
    const memory = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    };

    // Determine overall status
    const services = { openai: openaiStatus, api: apiStatus, telegram: telegramStatus };
    const overallStatus = this.calculateOverallStatus(services);

    return {
      status: overallStatus,
      timestamp,
      uptime,
      version: process.env.npm_package_version || '1.0.0',
      services,
      memory
    };
  }

  private async checkOpenAI(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const isAvailable = conversationService.isAvailable();
      
      if (!isAvailable) {
        return {
          status: 'down',
          error: 'OpenAI service not configured'
        };
      }

      // Try a simple test (mock response for health check)
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'up',
        responseTime
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkAPI(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      // Check if API service is configured
      const hasBaseUrl = !!config.apiBaseUrl;
      
      if (!hasBaseUrl) {
        return {
          status: 'down',
          error: 'API base URL not configured'
        };
      }

      // Try to make a simple health check request to API server
      try {
        const response = await fetch(`${config.apiBaseUrl}/health`);
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          return {
            status: 'up',
            responseTime
          };
        } else {
          return {
            status: 'down',
            responseTime,
            error: `API health check failed: ${response.status}`
          };
        }
      } catch (fetchError) {
        const responseTime = Date.now() - startTime;
        return {
          status: 'down',
          responseTime,
          error: 'API server unreachable'
        };
      }
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkTelegram(): Promise<ServiceStatus> {
    const startTime = Date.now();
    
    try {
      const hasBotToken = !!config.token;
      
      if (!hasBotToken) {
        return {
          status: 'down',
          error: 'Bot token not configured'
        };
      }

      const responseTime = Date.now() - startTime;
      
      return {
        status: 'up',
        responseTime
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private calculateOverallStatus(services: Record<string, ServiceStatus>): 'healthy' | 'unhealthy' | 'degraded' {
    const statuses = Object.values(services).map(s => s.status);
    const upCount = statuses.filter(s => s === 'up').length;
    const totalCount = statuses.length;

    if (upCount === totalCount) {
      return 'healthy';
    } else if (upCount === 0) {
      return 'unhealthy';
    } else {
      return 'degraded';
    }
  }
}

export const healthCheckService = new HealthCheckService();
