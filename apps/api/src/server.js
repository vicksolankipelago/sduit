import express from 'express';
import cors from 'cors';
import { AzureOpenAI } from 'openai';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { recordingStorage } from './services/recordingStorage.js';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = 3001;

// Enable CORS for the Vite dev server (allow multiple ports for development)
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' })); // Increase limit for audio chunk uploads

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Voice Agent API server is running (Azure OpenAI)' });
});

// Debug endpoint to check environment variables (development only)
app.get('/api/debug/env', (req, res) => {
  res.json({
    AZURE_OPENAI_ENDPOINT: !!process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_API_KEY: !!process.env.AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '(default: test-gpt-realtime)',
    OPENAI_API_VERSION: process.env.OPENAI_API_VERSION || '(default: 2025-04-01-preview)',
    endpoint_value: process.env.AZURE_OPENAI_ENDPOINT ? process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '') : 'NOT SET',
  });
});

// Azure OpenAI ephemeral key endpoint for WebRTC
// Creates a temporary (1-minute) key for secure browser WebRTC connection
app.get('/api/session', async (req, res) => {
  try {
    let endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'test-gpt-realtime';
    const apiVersion = process.env.OPENAI_API_VERSION || '2025-04-01-preview'; // Required for /realtimeapi/sessions
    
    // Remove trailing slash from endpoint if present
    if (endpoint && endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
    }
    
    if (!apiKey) {
      console.error('❌ AZURE_OPENAI_API_KEY environment variable is not set');
      return res.status(500).json({
        error: 'Azure OpenAI API key not configured',
        details: 'AZURE_OPENAI_API_KEY environment variable is missing'
      });
    }

    if (!endpoint) {
      console.error('❌ AZURE_OPENAI_ENDPOINT environment variable is not set');
      return res.status(500).json({
        error: 'Azure OpenAI endpoint not configured',
        details: 'AZURE_OPENAI_ENDPOINT environment variable is missing'
      });
    }

    console.log('🔑 Creating ephemeral key for WebRTC connection...');
    console.log('📍 Endpoint:', endpoint);
    console.log('🚀 Deployment:', deploymentName);
    
    // Call Azure OpenAI /realtimeapi/sessions endpoint to get ephemeral key
    // Note: The path is /openai/realtimeapi/sessions (not /openai/deployments/...)
    const sessionsUrl = `${endpoint}/openai/realtimeapi/sessions?api-version=${apiVersion}`;
    console.log('🔗 Sessions URL:', sessionsUrl);
    
    const response = await fetch(sessionsUrl, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: deploymentName,
        voice: 'sage'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to create session:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Failed to create ephemeral session',
        details: errorText
      });
    }

    const sessionData = await response.json();
    console.log('✅ Ephemeral key created:', sessionData.id);
    
    // Extract region from endpoint for WebRTC URL
    // e.g., vick-mgjiaeas-swedencentral.openai.azure.com -> swedencentral
    const regionMatch = endpoint.match(/-(swedencentral|eastus2)\.openai\.azure\.com/);
    const region = regionMatch ? regionMatch[1] : 'swedencentral';
    
    // Return session data with WebRTC endpoint
    res.json({
      ...sessionData,
      webrtcUrl: `https://${region}.realtimeapi-preview.ai.azure.com/v1/realtimertc`,
      deployment: deploymentName,
      region: region
    });
  } catch (err) {
    console.error('❌ Error creating ephemeral key:', err.message);
    console.error('📋 Error details:', err);
    res.status(500).json({
      error: 'Failed to create ephemeral key',
      details: err.message
    });
  }
});

// Also handle POST requests for compatibility
app.post('/api/session', async (req, res) => {
  // Forward to GET handler
  return app._router.handle(req, res);
});

// Note: Persona now uses voice-to-voice via Realtime API (same as voice agent)
// No separate API endpoint needed - persona connects via WebRTC like the agent

/**
 * Parse AWS Bedrock bearer token
 * Supports ABSK format: ABSK + base64(accessKeyId:secretAccessKey)
 */
function parseBedrockToken(bearerToken) {
  let accessKeyId = '';
  let secretAccessKey = '';
  
  if (bearerToken.startsWith('ABSK')) {
    try {
      const encodedCredentials = bearerToken.substring(4);
      const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
      
      if (decodedCredentials.includes(':')) {
        [accessKeyId, secretAccessKey] = decodedCredentials.split(':');
        console.log('✓ Decoded ABSK token successfully');
      }
    } catch (error) {
      console.error('Failed to decode token:', error.message);
    }
  } else if (bearerToken.includes(':')) {
    [accessKeyId, secretAccessKey] = bearerToken.split(':');
  }
  
  return { accessKeyId, secretAccessKey };
}

// AI Screen Generation endpoint using AWS Bedrock
app.post('/generate-screens', async (req, res) => {
  const { systemPrompt, agentPrompt, agentName, existingScreens, customInstructions } = req.body;
  
  if (!systemPrompt || !agentPrompt) {
    return res.status(400).json({ 
      error: 'systemPrompt and agentPrompt are required' 
    });
  }

  const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!bearerToken) {
    return res.status(500).json({ 
      error: 'AWS_BEARER_TOKEN_BEDROCK not configured. Please set it in .env file.' 
    });
  }

  try {
    // Parse token
    const { accessKeyId, secretAccessKey } = parseBedrockToken(bearerToken);
    
    if (!accessKeyId || !secretAccessKey) {
      return res.status(500).json({ 
        error: 'Failed to parse AWS bearer token. Ensure it\'s in ABSK format.' 
      });
    }
    
    // Initialize Bedrock client
    const bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
    });

    const modelId = 'global.anthropic.claude-opus-4-5-20251101-v1:0';
    console.log(`🤖 Generating screens using Bedrock (Claude Opus 4.5)`);
    
    // Build generation prompt with element defaults
    const elementDefaults = {
      button: { state: { id: '', title: 'Button', isDisabled: false }, style: { style: 'primary', size: 'large' } },
      textBlock: { state: { id: '', text: 'Text content' }, style: { style: 'body1', alignment: 'leading' } },
      image: { state: { id: '', imageName: 'placeholder' }, style: { width: 200, height: 200, contentMode: 'fit' } },
      spacer: { state: { id: '' }, style: { height: 16, isFlexible: false, direction: 'vertical' } },
      loadingView: { state: { id: '' } },
      imageCard: { 
        state: { id: '', title: 'Title', description: 'Description' }, 
        style: { imageName: 'Success', imageWidth: 72, imageHeight: 72, backgroundColor: 'backgroundTeaGreen', cornerRadius: 8 } 
      },
      checklistCard: { 
        state: { id: '', title: 'Checklist', itemTitles: ['Item 1', 'Item 2'] }, 
        style: { backgroundColor: 'backgroundLightTeaGreen', cornerRadius: 12 } 
      },
      toggleCard: { 
        state: { id: '', title: 'Toggle', description: 'Description', isToggled: false }, 
        style: { backgroundColor: 'secondaryDisabled', borderColor: 'secondaryDefault', cornerRadius: 8 } 
      },
      largeQuestion: { 
        state: { 
          id: '', 
          title: 'Question?', 
          options: [{ id: 'opt1', title: 'Option 1', description: 'Description' }] 
        } 
      },
      circularStepper: { state: { id: '', value: 0, minValue: 0, maxValue: 10, step: 1, label: 'Count' } },
      miniWidget: { 
        state: { id: '', title: 'Widget', value: '0', icon: '📈' }, 
        style: { backgroundColor: 'backgroundLightCard', cornerRadius: 8 } 
      },
      agentMessageCard: { 
        state: { id: '', message: 'Message', agentName: 'Agent', avatar: '🤖' }, 
        style: { backgroundColor: 'backgroundLightCard', cornerRadius: 12 } 
      },
    };
    
    const generationPrompt = `You are a UX designer for a voice-guided mental health application called Pelago.
  
Analyse the following agent configuration and suggest appropriate mobile UI screens:

SYSTEM PROMPT:
${systemPrompt}

AGENT PROMPT:
${agentPrompt}

AGENT NAME: ${agentName}

${existingScreens?.length ? `EXISTING SCREENS (don't duplicate these): ${existingScreens.map(s => s.title).join(', ')}` : ''}

${customInstructions ? `CUSTOM INSTRUCTIONS FROM USER:
${customInstructions}

Please incorporate these specific requirements into your screen designs.
` : ''}

CRITICAL: All elements will have defaults applied automatically on the frontend. You only need to specify:
1. The element "type"
2. Properties you want to CUSTOMIZE (override defaults)
3. All other properties will be filled in with safe defaults

Available UI Elements with their COMPLETE DEFAULT VALUES:
${JSON.stringify(elementDefaults, null, 2)}

IMPORTANT INSTRUCTIONS:
- ALL elements will automatically receive these defaults on the frontend
- You ONLY need to specify properties you want to OVERRIDE
- NEVER omit style properties that have defaults (like backgroundColor, cornerRadius, etc.)
- If you specify a "style" object, ALL style defaults will be applied first, then your overrides
- For "id" fields, you can leave them empty "" - unique IDs will be generated automatically

Element Structure:
- Each element MUST have "type" (matching one of the types above)
- State object is OPTIONAL - defaults will be used if not provided
- Style object is OPTIONAL - defaults will be used if not provided
- Events object is OPTIONAL - only include if needed

Available Screen Templates:
- welcome: Centred text with CTA button
- question: Multiple choice with large options
- info: Cards with information and checklist
- settings: Toggle cards for preferences
- custom: Build from scratch

TASK: Suggest screens that would complement this agent's conversation flow.
If the prompt describes a multi-step assessment or questionnaire with multiple questions, create a SEPARATE screen for EACH question (up to 10 screens).
Focus on screens that:
1. Capture information the agent needs to collect
2. Display information the member needs to see
3. Provide interactive elements for user input
4. Match the agent's tone and purpose
5. Use appropriate Pelago design patterns
6. For assessments: include introduction, individual question screens, and a completion/thank-you screen

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "screens": [
    {
      "screenType": "question",
      "title": "Select Your Focus",
      "description": "Helps members choose their primary area of focus",
      "reasoning": "The agent asks about focus areas, so this screen provides a visual way to select options",
      "elements": [
        {
          "type": "textBlock",
          "state": { "text": "What would you like to focus on?" },
          "style": { "style": "heading2", "alignment": "center" }
        },
        {
          "type": "spacer"
        },
        {
          "type": "largeQuestion",
          "state": {
            "title": "Choose your focus",
            "options": [
              { "id": "stress", "title": "Manage Stress", "description": "Learn techniques to handle daily stress" },
              { "id": "sleep", "title": "Improve Sleep", "description": "Develop better sleep habits" }
            ]
          }
        },
        {
          "type": "button",
          "state": { "title": "Continue" }
        }
      ]
    }
  ]
}

EXAMPLE showing minimal customization (defaults are applied):
{
  "type": "imageCard",
  "state": { "title": "Welcome!", "description": "Let's get started" }
  // backgroundColor, cornerRadius, imageWidth, etc. will use defaults
}`;

    // Call Bedrock
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 12288,
      temperature: 0.7,
      system: 'You are a UX designer specialising in mental health and voice-guided mobile applications. Return only valid JSON with no markdown formatting.',
      messages: [
        {
          role: 'user',
          content: generationPrompt
        }
      ]
    };
    
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
    });
    
    console.log('📡 Sending request to Bedrock...');
    const apiResponse = await bedrockClient.send(command);
    
    // Parse response
    const responseBody = JSON.parse(new TextDecoder().decode(apiResponse.body));
    console.log('✅ Received response from Bedrock');
    
    // Extract text content
    let content = '';
    if (responseBody.content && Array.isArray(responseBody.content)) {
      content = responseBody.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    }
    
    // Clean up response - remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse JSON response
    const parsed = JSON.parse(content);
    const suggestions = Array.isArray(parsed) ? parsed : (parsed.screens || []);
    
    console.log(`📋 Generated ${suggestions.length} screen suggestions`);
    
    res.json({ suggestions });
    
  } catch (error) {
    console.error('❌ Error generating screens:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate screens'
    });
  }
});

// ============================================
// Recording API Endpoints
// ============================================

/**
 * Start a new recording session
 * Creates a session and manifest in Replit Object Storage
 */
app.post('/api/recording/start', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const { metadata = {} } = req.body;

    console.log(`🎙️ Starting recording session: ${sessionId}`);

    const result = await recordingStorage.startSession(sessionId, metadata);

    res.json({
      success: true,
      sessionId: result.sessionId,
      message: 'Recording session started'
    });
  } catch (error) {
    console.error('❌ Failed to start recording:', error);
    res.status(500).json({
      error: 'Failed to start recording session',
      details: error.message
    });
  }
});

/**
 * Upload an audio chunk
 * Receives base64-encoded audio data and uploads to storage
 */
app.post('/api/recording/chunk', async (req, res) => {
  try {
    const { sessionId, chunkIndex, audioData } = req.body;

    if (!sessionId || chunkIndex === undefined || !audioData) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, chunkIndex, audioData'
      });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(audioData, 'base64');

    console.log(`📦 Uploading chunk ${chunkIndex} for session ${sessionId} (${buffer.length} bytes)`);

    const result = await recordingStorage.uploadChunk(sessionId, chunkIndex, buffer);

    res.json({
      success: true,
      chunkPath: result.chunkPath,
      chunkIndex: result.chunkIndex,
      size: result.size
    });
  } catch (error) {
    console.error('❌ Failed to upload chunk:', error);
    res.status(500).json({
      error: 'Failed to upload audio chunk',
      details: error.message
    });
  }
});

/**
 * End a recording session
 * Marks the session as complete
 */
app.post('/api/recording/end', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing required field: sessionId'
      });
    }

    console.log(`🏁 Ending recording session: ${sessionId}`);

    const manifest = await recordingStorage.endSession(sessionId);

    res.json({
      success: true,
      sessionId,
      totalChunks: manifest.chunks.length,
      totalDuration: manifest.totalDuration,
      status: manifest.status
    });
  } catch (error) {
    console.error('❌ Failed to end recording:', error);
    res.status(500).json({
      error: 'Failed to end recording session',
      details: error.message
    });
  }
});

/**
 * List all recordings
 */
app.get('/api/recordings', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const recordings = await recordingStorage.listRecordings(limit);

    res.json({
      success: true,
      recordings,
      count: recordings.length
    });
  } catch (error) {
    console.error('❌ Failed to list recordings:', error);
    res.status(500).json({
      error: 'Failed to list recordings',
      details: error.message
    });
  }
});

/**
 * Get a specific recording session
 */
app.get('/api/recordings/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await recordingStorage.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Recording not found'
      });
    }

    res.json({
      success: true,
      recording: session
    });
  } catch (error) {
    console.error('❌ Failed to get recording:', error);
    res.status(500).json({
      error: 'Failed to get recording',
      details: error.message
    });
  }
});

/**
 * Download a specific chunk from a recording
 */
app.get('/api/recordings/:sessionId/chunks/:chunkIndex', async (req, res) => {
  try {
    const { sessionId, chunkIndex } = req.params;
    const buffer = await recordingStorage.downloadChunk(sessionId, parseInt(chunkIndex));

    res.set({
      'Content-Type': 'audio/webm',
      'Content-Disposition': `attachment; filename="chunk-${chunkIndex}.webm"`
    });
    res.send(buffer);
  } catch (error) {
    console.error('❌ Failed to download chunk:', error);
    res.status(500).json({
      error: 'Failed to download chunk',
      details: error.message
    });
  }
});

/**
 * Stream full recording audio by combining all chunks
 * Returns a single audio/webm file with all chunks concatenated
 */
app.get('/api/recordings/:sessionId/audio', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Get session manifest to find all chunks
    const session = await recordingStorage.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        error: 'Recording not found'
      });
    }
    
    if (session.chunks.length === 0) {
      return res.status(404).json({
        error: 'No audio chunks found for this recording'
      });
    }
    
    console.log(`🎵 Loading audio for session ${sessionId} (${session.chunks.length} chunks)`);
    
    // Download all chunks - fail if any chunk is missing
    const chunks = [];
    for (let i = 0; i < session.chunks.length; i++) {
      try {
        const buffer = await recordingStorage.downloadChunk(sessionId, i);
        chunks.push(buffer);
      } catch (err) {
        console.error(`Failed to download chunk ${i}:`, err);
        return res.status(500).json({
          error: `Failed to load audio: chunk ${i} is missing or corrupted`,
          details: err.message
        });
      }
    }
    
    // Concatenate all buffers
    const fullAudio = Buffer.concat(chunks);
    
    res.set({
      'Content-Type': 'audio/webm',
      'Content-Length': fullAudio.length,
      'Cache-Control': 'no-cache'
    });
    
    res.send(fullAudio);
  } catch (error) {
    console.error('❌ Failed to load audio:', error);
    res.status(500).json({
      error: 'Failed to load audio',
      details: error.message
    });
  }
});

/**
 * Delete a recording session
 */
app.delete('/api/recordings/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log(`🗑️ Deleting recording session: ${sessionId}`);

    const result = await recordingStorage.deleteSession(sessionId);

    res.json({
      success: true,
      deleted: result.deleted,
      sessionId: result.sessionId
    });
  } catch (error) {
    console.error('❌ Failed to delete recording:', error);
    res.status(500).json({
      error: 'Failed to delete recording',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🎙️  Voice Agent API Server Running (Azure OpenAI)       ║
║                                                            ║
║  Port: ${PORT}                                              ║
║  Region: Sweden Central                                    ║
║  Endpoints:                                                ║
║    - GET  /health              (Health check)             ║
║    - GET  /api/session         (Create Azure session)     ║
║    - POST /api/session         (Create Azure session)     ║
║    - POST /generate-screens    (AI Screen Generation)     ║
║                                                            ║
║  🎙️  Recording Endpoints:                                  ║
║    - POST /api/recording/start (Start recording)          ║
║    - POST /api/recording/chunk (Upload audio chunk)       ║
║    - POST /api/recording/end   (End recording)            ║
║    - GET  /api/recordings      (List recordings)          ║
║    - GET  /api/recordings/:id  (Get recording)            ║
║    - DELETE /api/recordings/:id (Delete recording)        ║
║                                                            ║
║  ⚡ Azure OpenAI Configuration:                            ║
║     AZURE_OPENAI_ENDPOINT                                  ║
║     AZURE_OPENAI_API_KEY                                   ║
║     AZURE_OPENAI_DEPLOYMENT_NAME                           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
  
  // Check if configuration is available
  const hasEndpoint = !!process.env.AZURE_OPENAI_ENDPOINT;
  const hasApiKey = !!process.env.AZURE_OPENAI_API_KEY;
  const hasDeployment = !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  
  if (!hasEndpoint || !hasApiKey) {
    console.warn(`
⚠️  WARNING: Azure OpenAI configuration incomplete!
   
   Missing variables:
   ${!hasEndpoint ? '   ❌ AZURE_OPENAI_ENDPOINT\n' : ''}${!hasApiKey ? '   ❌ AZURE_OPENAI_API_KEY\n' : ''}${!hasDeployment ? '   ⚠️  AZURE_OPENAI_DEPLOYMENT_NAME (using default)\n' : ''}
   Make sure your .env file is configured correctly.
    `);
  } else {
    console.log('✅ Azure OpenAI configuration loaded');
    console.log('✅ Endpoint:', process.env.AZURE_OPENAI_ENDPOINT);
    console.log('✅ Deployment:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-realtime-preview');
  }
});
