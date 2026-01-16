/**
 * Journey to Code Generator
 * 
 * Converts visual journey configurations to TypeScript agent files
 * matching the format of greeterAgent.ts, motivationAgent.ts, etc.
 */

import { Journey, Agent, Tool } from '../../types/journey';

/**
 * Generate TypeScript code for a single agent
 */
export function generateAgentCode(agent: Agent, systemPrompt: string): string {
  const toolsCode = agent.tools.map(tool => generateToolCode(tool)).join(',\n    ');
  
  const combinedInstructions = [
    '// System Prompt',
    systemPrompt,
    '',
    '// Agent Prompt',
    agent.prompt,
  ].filter(Boolean).join('\n');

  return `import { RealtimeAgent, tool } from '@openai/agents/realtime';

/**
 * ${agent.name}
 * ${agent.handoffDescription || 'Agent in the conversation flow'}
 */
export const ${toCamelCase(agent.name)}Agent = new RealtimeAgent({
  name: '${toCamelCase(agent.name)}',
  voice: '${agent.voice}',
  instructions: \`${escapeTicks(combinedInstructions)}\`,
  handoffs: [], // Will be set in journey orchestration file
  tools: [
    ${toolsCode}
  ],
  handoffDescription: '${escapeTicks(agent.handoffDescription || '')}',
});
`;
}

/**
 * Generate TypeScript code for a tool
 */
function generateToolCode(tool: Tool): string {
  const parametersJson = JSON.stringify(tool.parameters, null, 6).replace(/\n/g, '\n      ');
  
  return `tool({
      name: '${tool.name}',
      description: '${escapeSingleQuotes(tool.description)}',
      parameters: ${parametersJson},
      execute: async (input: any, context: any) => {
        ${tool.executeCode || '// Tool execution logic\n        return `Tool executed successfully`;'}
      },
    })`;
}

/**
 * Generate the main journey orchestration file
 */
export function generateJourneyOrchestrationCode(journey: Journey): string {
  const imports = journey.agents.map(agent => 
    `import { ${toCamelCase(agent.name)}Agent } from './${toCamelCase(agent.name)}Agent';`
  ).join('\n');

  const handoffSetup = journey.agents.map(agent => {
    if (agent.handoffs.length === 0) return null;
    const handoffNames = agent.handoffs
      .map(id => {
        const targetAgent = journey.agents.find(a => a.id === id);
        return targetAgent ? `${toCamelCase(targetAgent.name)}Agent` : null;
      })
      .filter(Boolean)
      .join(', ');
    
    return `${toCamelCase(agent.name)}Agent.handoffs = [${handoffNames}];`;
  }).filter(Boolean).join('\n');

  const scenarioAgents = journey.agents.map(agent => `${toCamelCase(agent.name)}Agent`).join(',\n  ');

  return `/**
 * ${journey.name}
 * ${journey.description}
 * 
 * Generated from Journey Builder
 * Created: ${journey.createdAt}
 * Updated: ${journey.updatedAt}
 */

${imports}

/**
 * Configure handoffs between agents
 */
${handoffSetup}

/**
 * Export the complete journey scenario
 */
export const ${toCamelCase(journey.name)}Scenario = [
  ${scenarioAgents}
];

/**
 * Export individual agents
 */
export {
  ${scenarioAgents.replace(/,\n  /g, ',\n  ')}
};

/**
 * Starting agent for this journey
 */
export const startingAgent = ${journey.agents.find(a => a.id === journey.startingAgentId) 
    ? `${toCamelCase(journey.agents.find(a => a.id === journey.startingAgentId)!.name)}Agent`
    : journey.agents[0] ? `${toCamelCase(journey.agents[0].name)}Agent` : 'null'};
`;
}

/**
 * Generate all files for a journey as a downloadable package
 */
export function generateJourneyPackage(journey: Journey): Record<string, string> {
  const files: Record<string, string> = {};

  // Generate individual agent files
  journey.agents.forEach(agent => {
    const filename = `${toCamelCase(agent.name)}Agent.ts`;
    files[filename] = generateAgentCode(agent, journey.systemPrompt);
  });

  // Generate orchestration file
  files[`${toCamelCase(journey.name)}.ts`] = generateJourneyOrchestrationCode(journey);

  // Generate README
  files['README.md'] = generateReadme(journey);

  return files;
}

/**
 * Generate README for the journey package
 */
function generateReadme(journey: Journey): string {
  const agentList = journey.agents.map(agent => 
    `- **${agent.name}** (${agent.voice}): ${agent.handoffDescription || 'Agent in flow'}\n  - ${agent.tools.length} tool(s)\n  - Hands off to: ${agent.handoffs.length > 0 ? agent.handoffs.map(id => journey.agents.find(a => a.id === id)?.name || id).join(', ') : 'None (terminal agent)'}`
  ).join('\n\n');

  return `# ${journey.name}

${journey.description}

## Overview

- **Agents**: ${journey.agents.length}
- **Starting Agent**: ${journey.agents.find(a => a.id === journey.startingAgentId)?.name || 'Not set'}
- **Created**: ${new Date(journey.createdAt).toLocaleString()}
- **Last Updated**: ${new Date(journey.updatedAt).toLocaleString()}

## Agents

${agentList}

## System Prompt

\`\`\`
${journey.systemPrompt}
\`\`\`

## Usage

\`\`\`typescript
import { ${toCamelCase(journey.name)}Scenario, startingAgent } from './${toCamelCase(journey.name)}';

// Use with Azure OpenAI Realtime API
// The scenario array contains all agents in order
// startingAgent is the entry point
\`\`\`

---

Generated by Journey Builder on ${new Date().toLocaleString()}
`;
}

/**
 * Download journey as a ZIP file (multiple files)
 */
export function downloadJourneyAsZip(journey: Journey): void {
  const files = generateJourneyPackage(journey);
  
  // For now, download as separate files
  // TODO: Use JSZip library to create actual ZIP file
  Object.entries(files).forEach(([filename, content]) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  console.log(`📦 Downloaded ${Object.keys(files).length} files for journey: ${journey.name}`);
}

/**
 * Helper: Convert string to camelCase
 */
function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (char) => char.toLowerCase());
}

/**
 * Helper: Escape backticks for template literals
 */
function escapeTicks(str: string): string {
  return str.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

/**
 * Helper: Escape single quotes for strings
 */
function escapeSingleQuotes(str: string): string {
  return str.replace(/'/g, "\\'");
}

