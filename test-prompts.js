const { promptConfigService } = require('./dist/services/promptConfigService');
const { config } = require('./dist/config');

async function testPrompts() {
  console.log('Testing prompt configuration service...');
  console.log('API Base URL:', config.apiBaseUrl);
  
  try {
    // Test loading prompt configuration
    console.log('\n1. Testing loadPromptConfig...');
    const promptConfig = await promptConfigService.loadPromptConfig(true);
    console.log('Prompt config result:', promptConfig ? 'SUCCESS' : 'FAILED');
    if (promptConfig) {
      console.log('Available stages:', Object.keys(promptConfig.data));
    }
    
    // Test getting question prompt
    console.log('\n2. Testing getQuestionPrompt...');
    try {
      const questionPrompt = await promptConfigService.getQuestionPrompt('demographics_baseline');
      console.log('Question prompt loaded successfully:', questionPrompt.substring(0, 100) + '...');
    } catch (error) {
      console.error('Failed to get question prompt:', error.message);
    }
    
    // Test getting extraction prompt
    console.log('\n3. Testing getExtractionPrompt...');
    try {
      const extractionPrompt = await promptConfigService.getExtractionPrompt('demographics_baseline');
      console.log('Extraction prompt loaded successfully:', extractionPrompt.substring(0, 100) + '...');
    } catch (error) {
      console.error('Failed to get extraction prompt:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testPrompts().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
