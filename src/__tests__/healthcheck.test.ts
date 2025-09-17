/**
 * Tests for Health Check Service
 */

import { healthCheckService } from '../healthcheck';

// Mock dependencies
jest.mock('../services/conversationService');
jest.mock('../services/apiService');
jest.mock('../config');

describe('HealthCheckService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(healthCheckService).toBeDefined();
  });

  it('should start and stop health check server', async () => {
    const testPort = 3999; // Use different port for tests
    
    // Start server
    await healthCheckService.start(testPort);
    
    // Test if server is running by making a request
    const response = await fetch(`http://localhost:${testPort}/ping`);
    const data = await response.json() as any;
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
    
    // Stop server
    await healthCheckService.stop();
  }, 10000);

  it('should return health status', async () => {
    const testPort = 3998;
    
    await healthCheckService.start(testPort);
    
    const response = await fetch(`http://localhost:${testPort}/health`);
    const data = await response.json() as any;
    
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(data.status).toMatch(/healthy|unhealthy|degraded/);
    expect(data.timestamp).toBeDefined();
    expect(data.uptime).toBeGreaterThan(0);
    expect(data.services).toBeDefined();
    expect(data.services.openai).toBeDefined();
    expect(data.services.api).toBeDefined();
    expect(data.services.telegram).toBeDefined();
    expect(data.memory).toBeDefined();
    
    await healthCheckService.stop();
  }, 10000);

  it('should handle 404 for unknown endpoints', async () => {
    const testPort = 3997;
    
    await healthCheckService.start(testPort);
    
    const response = await fetch(`http://localhost:${testPort}/unknown`);
    const data = await response.json() as any;
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Not found');
    expect(data.availableEndpoints).toContain('/health');
    expect(data.availableEndpoints).toContain('/status');
    expect(data.availableEndpoints).toContain('/ping');
    
    await healthCheckService.stop();
  }, 10000);
});
