/**
 * Debug test to see what is actually extracted
 */

import { conversationService } from '../services/conversationService';

describe('Debug Data Extraction', () => {
  it('should show what is actually extracted', () => {
    const conversation = [
      {
        role: 'user' as const,
        content: "Hi, I'm 30 years old, weigh 70kg and I'm 175cm tall. I sleep 7 hours.",
        timestamp: '2023-12-01T10:00:00Z'
      }
    ];

    const result = conversationService.extractUserInfo(conversation);
    
    console.log('Extracted data:', JSON.stringify(result, null, 2));
    
    // Basic test to ensure the function runs
    expect(result).toBeDefined();
  });
});
