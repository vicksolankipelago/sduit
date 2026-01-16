#!/usr/bin/env node
/**
 * Azure OpenAI Connection Test Script
 *
 * Tests the API server and Azure OpenAI Realtime connection
 * Run: node scripts/test-azure-connection.js
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function testHealthEndpoint() {
  console.log('\n📡 Testing API Server Health...');
  console.log(`   URL: ${API_URL}/health`);

  try {
    const response = await fetch(`${API_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ API server is healthy');
      console.log(`   Response: ${JSON.stringify(data)}`);
      return true;
    } else {
      console.log(`   ❌ API server returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('   ❌ Failed to connect to API server');
    console.log(`   Error: ${error.message}`);
    console.log('\n   💡 Make sure the API server is running:');
    console.log('      cd apps/api && npm run dev');
    return false;
  }
}

async function testSessionEndpoint() {
  console.log('\n🔐 Testing Azure OpenAI Session Endpoint...');
  console.log(`   URL: ${API_URL}/api/session`);

  try {
    const response = await fetch(`${API_URL}/api/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'shimmer',
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('   ✅ Session endpoint working');
      console.log(`   Session ID: ${data.id || 'N/A'}`);
      console.log(`   Model: ${data.model || 'N/A'}`);

      if (data.client_secret) {
        console.log('   ✅ Received client_secret (ephemeral key)');
        console.log(`   Key prefix: ${data.client_secret.value?.substring(0, 20)}...`);
        console.log(`   Expires: ${data.client_secret.expires_at || 'N/A'}`);
      }
      return true;
    } else {
      console.log(`   ❌ Session endpoint returned status ${response.status}`);
      console.log(`   Error: ${JSON.stringify(data, null, 2)}`);

      // Provide helpful debugging info
      if (response.status === 401) {
        console.log('\n   💡 Authentication failed. Check your Azure credentials:');
        console.log('      - AZURE_OPENAI_API_KEY is correct');
        console.log('      - AZURE_OPENAI_ENDPOINT is correct');
      } else if (response.status === 404) {
        console.log('\n   💡 Deployment not found. Check:');
        console.log('      - AZURE_OPENAI_DEPLOYMENT_NAME matches your deployment');
        console.log('      - The deployment uses gpt-4o-realtime-preview model');
      } else if (response.status === 400) {
        console.log('\n   💡 Bad request. The endpoint URL format may be wrong.');
      }

      return false;
    }
  } catch (error) {
    console.log('   ❌ Failed to create session');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function testEnvVariables() {
  console.log('\n🔧 Checking Environment Variables (via API)...');
  console.log(`   URL: ${API_URL}/api/debug/env`);

  try {
    const response = await fetch(`${API_URL}/api/debug/env`);
    if (response.ok) {
      const data = await response.json();
      console.log('   Environment check:');
      Object.entries(data).forEach(([key, value]) => {
        const status = value ? '✅' : '❌';
        console.log(`   ${status} ${key}: ${value ? 'Set' : 'Missing'}`);
      });
      return true;
    } else {
      console.log('   ⚠️  Debug endpoint not available (this is fine in production)');
      return true;
    }
  } catch (error) {
    console.log('   ⚠️  Could not check env variables');
    return true;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════');
  console.log('       Azure OpenAI Connection Test Suite          ');
  console.log('═══════════════════════════════════════════════════');

  const results = {
    health: await testHealthEndpoint(),
    env: await testEnvVariables(),
    session: await testSessionEndpoint(),
  };

  console.log('\n═══════════════════════════════════════════════════');
  console.log('                    Summary                         ');
  console.log('═══════════════════════════════════════════════════');

  const allPassed = Object.values(results).every(r => r);

  console.log(`\n   API Health:     ${results.health ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Env Variables:  ${results.env ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Session Create: ${results.session ? '✅ PASS' : '❌ FAIL'}`);

  if (allPassed) {
    console.log('\n🎉 All tests passed! Your Azure connection is ready.');
  } else {
    console.log('\n⚠️  Some tests failed. See details above for debugging.');
    console.log('\n📋 Checklist:');
    console.log('   1. API server running: npm run dev:api');
    console.log('   2. .env file exists in apps/api/');
    console.log('   3. Azure credentials are correct');
    console.log('   4. Deployment name matches Azure portal');
    console.log('   5. Model is gpt-4o-realtime-preview');
  }

  console.log('\n');
}

runTests();
