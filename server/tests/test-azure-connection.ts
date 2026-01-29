import 'dotenv/config';

interface AzureSessionResponse {
  id: string;
  client_secret?: {
    value: string;
    expires_at: string;
  };
  expires_at?: string;
  webrtcUrl?: string;
  deployment?: string;
  region?: string;
}

interface AzureErrorResponse {
  error: {
    code: string;
    message: string;
    innererror?: unknown;
  };
}

async function testAzureConnection(): Promise<void> {
  console.log('=== Azure OpenAI Realtime API Connection Test ===\n');

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, '');
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-realtime';
  const apiVersion = process.env.OPENAI_API_VERSION || '2025-04-01-preview';

  console.log('Configuration:');
  console.log('  Endpoint:', endpoint ? `${endpoint.substring(0, 40)}...` : 'NOT SET');
  console.log('  API Key:', apiKey ? `SET (${apiKey.length} chars)` : 'NOT SET');
  console.log('  Deployment:', deploymentName);
  console.log('  API Version:', apiVersion);
  console.log('');

  if (!endpoint) {
    console.error('❌ AZURE_OPENAI_ENDPOINT is not set');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('❌ AZURE_OPENAI_API_KEY is not set');
    process.exit(1);
  }

  const sessionsUrl = `${endpoint}/openai/realtimeapi/sessions?api-version=${apiVersion}`;
  console.log('Sessions URL:', sessionsUrl);
  console.log('');

  console.log('Testing connection...\n');

  try {
    const requestBody = {
      model: deploymentName,
      voice: 'sage',
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    console.log('');

    const startTime = Date.now();
    const response = await fetch(sessionsUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    const duration = Date.now() - startTime;

    console.log(`Response received in ${duration}ms`);
    console.log('Status:', response.status, response.statusText);
    console.log('');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Request failed!\n');
      
      try {
        const errorJson: AzureErrorResponse = JSON.parse(errorText);
        console.error('Error Details:');
        console.error('  Code:', errorJson.error?.code);
        console.error('  Message:', errorJson.error?.message);
        
        if (errorJson.error?.innererror) {
          console.error('  Inner Error:', JSON.stringify(errorJson.error.innererror, null, 2));
        }

        console.log('\n=== Troubleshooting Guide ===\n');

        switch (errorJson.error?.code) {
          case 'DeploymentNotFound':
            console.log(`The deployment '${deploymentName}' was not found.`);
            console.log('\nPossible causes:');
            console.log('1. The deployment name is incorrect');
            console.log('2. The deployment was deleted');
            console.log('3. The deployment is in a different Azure region');
            console.log('\nTo fix:');
            console.log('1. Go to Azure Portal > Azure OpenAI > Your Resource > Deployments');
            console.log('2. Find your gpt-4o-realtime-preview deployment');
            console.log('3. Copy the exact deployment name');
            console.log('4. Update AZURE_OPENAI_DEPLOYMENT_NAME in your secrets');
            break;

          case 'InvalidApiKey':
          case 'Unauthorized':
            console.log('The API key is invalid or unauthorized.');
            console.log('\nTo fix:');
            console.log('1. Go to Azure Portal > Azure OpenAI > Your Resource > Keys');
            console.log('2. Copy KEY 1 or KEY 2');
            console.log('3. Update AZURE_OPENAI_API_KEY in your secrets');
            break;

          case 'ResourceNotFound':
            console.log('The Azure OpenAI resource was not found.');
            console.log('\nTo fix:');
            console.log('1. Verify AZURE_OPENAI_ENDPOINT is correct');
            console.log('2. Ensure the resource exists in your Azure subscription');
            break;

          default:
            console.log('Unknown error. Please check Azure documentation.');
        }
      } catch {
        console.error('Raw error response:', errorText);
      }

      process.exit(1);
    }

    const sessionData: AzureSessionResponse = await response.json();
    
    console.log('✅ Connection successful!\n');
    console.log('Session Details:');
    console.log('  Session ID:', sessionData.id);
    console.log('  Expires At:', sessionData.expires_at || sessionData.client_secret?.expires_at);
    console.log('  Has Client Secret:', !!sessionData.client_secret?.value);
    
    if (sessionData.client_secret?.value) {
      console.log('  Secret Length:', sessionData.client_secret.value.length, 'chars');
    }

    const regionMatch = endpoint.match(/-(swedencentral|eastus2)\.openai\.azure\.com/);
    const region = regionMatch ? regionMatch[1] : 'swedencentral';
    const webrtcUrl = `https://${region}.realtimeapi-preview.ai.azure.com/v1/realtimertc`;

    console.log('  Region:', region);
    console.log('  WebRTC URL:', webrtcUrl);
    console.log('');
    console.log('=== All tests passed! The Azure OpenAI connection is working. ===');

  } catch (error) {
    console.error('❌ Network error:', (error as Error).message);
    console.error('\nPossible causes:');
    console.error('1. No internet connection');
    console.error('2. Azure endpoint is unreachable');
    console.error('3. Firewall blocking the request');
    process.exit(1);
  }
}

testAzureConnection();
