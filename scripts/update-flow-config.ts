import { objectStorageClient } from "../server/replit_integrations/object_storage/objectStorage";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const PREFIX = "published-flows";

async function updateFlowConfig(journeyId: string, agentId: string) {
  console.log(`Updating flow ${journeyId} with agent ID ${agentId}...`);
  
  const bucket = objectStorageClient.bucket(BUCKET_ID);
  const flowFile = bucket.file(`${PREFIX}/${journeyId}.json`);
  
  const [exists] = await flowFile.exists();
  if (!exists) {
    console.log("Flow not found in Object Storage");
    return;
  }
  
  const [content] = await flowFile.download();
  const flow = JSON.parse(content.toString());
  
  // Update the elevenLabsConfig
  flow.elevenLabsConfig = {
    agentId: agentId
  };
  flow.voiceProvider = 'elevenlabs';
  
  // Save back
  await flowFile.save(JSON.stringify(flow, null, 2), {
    contentType: "application/json",
    metadata: { cacheControl: "no-cache" },
  });
  
  console.log("Flow updated successfully!");
  console.log("  elevenLabsConfig:", JSON.stringify(flow.elevenLabsConfig));
  console.log("  voiceProvider:", flow.voiceProvider);
}

const journeyId = process.argv[2];
const agentId = process.argv[3];

if (!journeyId || !agentId) {
  console.log("Usage: npx tsx scripts/update-flow-config.ts <journeyId> <agentId>");
  process.exit(1);
}

updateFlowConfig(journeyId, agentId).catch(console.error);
