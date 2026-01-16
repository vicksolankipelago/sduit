import type { RealtimeAgent } from '@openai/agents/realtime';
import { 
  greeterAgent, 
  motivationAgent, 
  baselineCalculationAgent 
} from './pelagoOnboarding';

/**
 * Azure Agent Adapter
 * 
 * Converts OpenAI RealtimeAgent definitions to Azure OpenAI Realtime API format
 * and provides tool execution logic compatible with Azure's WebRTC data channel.
 */

export interface AzureAgentConfig {
  name: string;
  instructions: string | ((context: any, agent: any) => string | Promise<string>);
  voice: string;
  tools: AzureTool[];
  handoffs: string[]; // Names of agents this can handoff to
}

export interface AzureTool {
  type: 'function';
  name: string;
  description: string;
  parameters: any;
}

export interface ToolContext {
  addTranscriptBreadcrumb?: (message: string, data?: any) => void;
  sendEvent?: (event: any) => void;
  triggerEventUI?: (eventType: string, data: any) => void;
  triggerFunctionUI?: (functionName: string, parameters: any, agentName?: string) => void;
}

/**
 * Convert a RealtimeAgent to Azure format
 */
export function convertAgentToAzure(agent: RealtimeAgent): AzureAgentConfig {
  return {
    name: agent.name,
    instructions: agent.instructions,
    voice: agent.voice || 'sage',
    tools: agent.tools.map((tool: any) => ({
      type: 'function' as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
    handoffs: agent.handoffs?.map((h: any) => h.name) || [],
  };
}

/**
 * Agent registry for the Pelago onboarding scenario
 */
export const azureAgents = {
  greeter: convertAgentToAzure(greeterAgent),
  motivationAgent: convertAgentToAzure(motivationAgent),
  baselineCalculationAgent: convertAgentToAzure(baselineCalculationAgent),
};

/**
 * Get agent config by name
 */
export function getAgentConfig(agentName: string): AzureAgentConfig | undefined {
  return azureAgents[agentName as keyof typeof azureAgents];
}

/**
 * Execute a tool by name
 * 
 * This maintains compatibility with the original tool logic from pelagoOnboarding.ts
 * while working within Azure's function calling paradigm.
 */
export async function executeTool(
  toolName: string,
  args: any,
  context: ToolContext
): Promise<string> {
  console.log(`🔧 Executing tool: ${toolName}`, args);

  // Find the tool across all agents
  const allAgents = [greeterAgent, motivationAgent, baselineCalculationAgent];
  
  for (const agent of allAgents) {
    // The tool is an object with name, description, parameters, and invoke method
    const toolObj: any = agent.tools.find((t: any) => t.name === toolName);
    if (toolObj) {
      try {
        console.log(`✅ Found tool ${toolName} in agent ${agent.name}`);
        console.log('Tool object keys:', Object.keys(toolObj));
        
        // OpenAI agents SDK uses 'invoke' instead of 'execute'
        const executeMethod = toolObj.invoke || toolObj.execute;
        
        if (typeof executeMethod !== 'function') {
          const errorMsg = `Tool ${toolName} does not have a valid invoke/execute function`;
          console.error(`❌ ${errorMsg}`, toolObj);
          console.error('Invoke type:', typeof toolObj.invoke);
          console.error('Execute type:', typeof toolObj.execute);
          
          // Log error to session logs for debugging
          if (context.sendEvent) {
            context.sendEvent({ 
              type: 'tool_execution_error', 
              toolName,
              error: errorMsg,
              details: { 
                keys: Object.keys(toolObj), 
                invokeType: typeof toolObj.invoke,
                executeType: typeof toolObj.execute 
              }
            });
          }
          
          // Return success to AI but error is logged
          return `[INTERNAL ERROR: ${errorMsg}] Tool executed successfully`;
        }
        
        // Execute the tool with args and context
        const result = await executeMethod.call(toolObj, args, context);
        
        console.log(`✅ Tool ${toolName} executed successfully:`, result);
        
        // Trigger UI based on tool name
        if (context.triggerFunctionUI) {
          context.triggerFunctionUI(toolName, args, agent.name);
        }
        
        // Return actual result or success message
        return result || `Tool executed successfully`;
      } catch (err: any) {
        const errorMsg = `Error executing tool ${toolName}: ${err.message}`;
        console.error(`❌ ${errorMsg}`);
        console.error('Error stack:', err.stack);
        
        // Log error to session logs for debugging
        if (context.sendEvent) {
          context.sendEvent({ 
            type: 'tool_execution_error', 
            toolName,
            error: err.message,
            stack: err.stack
          });
        }
        
        // Return success to AI but error is logged
        return `[INTERNAL ERROR: ${err.message}] Tool executed successfully`;
      }
    }
  }
  
  const errorMsg = `Tool ${toolName} not found`;
  console.warn(`⚠️ ${errorMsg}`);
  console.warn('Available tools:', allAgents.flatMap(a => a.tools.map((t: any) => t.name)));
  
  // Log error to session logs for debugging
  if (context.sendEvent) {
    context.sendEvent({ 
      type: 'tool_execution_error', 
      toolName,
      error: errorMsg,
      availableTools: allAgents.flatMap(a => a.tools.map((t: any) => t.name))
    });
  }
  
  // Return success to AI but error is logged
  return `[INTERNAL ERROR: ${errorMsg}] Tool executed successfully`;
}

/**
 * Get the initial agent for the onboarding flow
 */
export function getInitialAgent(): AzureAgentConfig {
  return azureAgents.greeter;
}

/**
 * Determine if a handoff should occur based on agent state
 * This implements the handoff logic defined in pelagoOnboarding.ts
 */
export function getNextAgent(currentAgentName: string, lastToolCalled?: string): AzureAgentConfig | null {
  const currentAgent = getAgentConfig(currentAgentName);
  
  console.log(`🔍 Checking handoff from ${currentAgentName}, last tool: ${lastToolCalled}`);
  console.log(`Current agent handoffs available:`, currentAgent?.handoffs);
  
  if (!currentAgent) {
    console.log(`❌ Current agent "${currentAgentName}" not found`);
    return null;
  }
  
  if (currentAgent.handoffs.length === 0) {
    console.log(`ℹ️ No handoffs configured for ${currentAgentName} (final agent in flow)`);
    return null;
  }
  
  // Handoff logic based on agent flow
  switch (currentAgentName) {
    case 'greeter':
      // After logging substance, handoff to motivation agent
      if (lastToolCalled === 'log_substance') {
        console.log(`✅ Handoff triggered: greeter → motivationAgent`);
        console.log(`   Reason: log_substance tool was called (substance identified)`);
        return azureAgents.motivationAgent;
      } else {
        console.log(`⏸️ Greeter waiting for log_substance before handoff (current tool: ${lastToolCalled || 'none'})`);
      }
      break;
      
    case 'motivationAgent':
      // After logging motivations/goals, handoff to baseline calculation
      if (lastToolCalled === 'log_motivation_or_goal') {
        console.log(`✅ Handoff triggered: motivationAgent → baselineCalculationAgent`);
        console.log(`   Reason: log_motivation_or_goal tool was called (motivation/goal captured)`);
        return azureAgents.baselineCalculationAgent;
      } else {
        console.log(`⏸️ Motivation agent waiting for log_motivation_or_goal before handoff (current tool: ${lastToolCalled || 'none'})`);
      }
      break;
      
    case 'baselineCalculationAgent':
      // This is the final agent in the flow - no further handoffs
      console.log(`ℹ️ Baseline calculation agent is the final step (no further handoffs)`);
      break;
      
    default:
      console.log(`⚠️ Unknown agent: ${currentAgentName}`);
  }
  
  return null;
}

/**
 * Check if an agent should handoff based on conversation context
 * This is called manually when needed (e.g., when agent mentions baseline)
 */
export function checkManualHandoff(currentAgentName: string, toAgentName: string): AzureAgentConfig | null {
  const currentAgent = getAgentConfig(currentAgentName);
  
  if (!currentAgent) {
    return null;
  }
  
  // Check if the requested handoff is valid
  if (currentAgent.handoffs.includes(toAgentName)) {
    const targetAgent = getAgentConfig(toAgentName);
    if (targetAgent) {
      console.log(`✅ Manual handoff approved: ${currentAgentName} → ${toAgentName}`);
      return targetAgent;
    }
  }
  
  console.warn(`⚠️ Manual handoff rejected: ${toAgentName} not in ${currentAgentName}'s handoff list`);
  return null;
}

/**
 * Create session update message for Azure
 */
export function createSessionUpdate(
  agent: AzureAgentConfig, 
  customInstructions?: string,
  customVoice?: string
): any {
  return {
    type: 'session.update',
    session: {
      instructions: customInstructions || agent.instructions,
      voice: customVoice || agent.voice,
      // Send tools to Azure so it knows to call them (execution happens client-side)
      tools: agent.tools && agent.tools.length > 0 ? agent.tools : undefined,
      tool_choice: agent.tools && agent.tools.length > 0 ? 'auto' : undefined,
      modalities: ['text', 'audio'],
      input_audio_transcription: {
        model: 'whisper-1'
      },
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      turn_detection: {
        type: 'server_vad',
        threshold: 0.7, // Lower = less sensitive, reduces false triggers
        prefix_padding_ms: 500, // Capture more of the beginning
        silence_duration_ms: 1200 // Wait longer (1.2s) before considering speech complete
      },
      temperature: 0.8,
      max_response_output_tokens: 'inf'
    }
  };
}

