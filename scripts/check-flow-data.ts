import { objectStorageClient } from "../server/replit_integrations/object_storage/objectStorage";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const PREFIX = "published-flows";

async function checkFlow(journeyId: string) {
  const bucket = objectStorageClient.bucket(BUCKET_ID);
  const flowFile = bucket.file(`${PREFIX}/${journeyId}.json`);
  
  const [exists] = await flowFile.exists();
  if (!exists) {
    console.log("Flow not found in Object Storage");
    return;
  }
  
  const [content] = await flowFile.download();
  const flow = JSON.parse(content.toString());
  
  console.log("Flow Name:", flow.name);
  console.log("Voice Provider:", flow.voiceProvider);
  console.log("ElevenLabs Config:", JSON.stringify(flow.elevenLabsConfig, null, 2));
  console.log("Azure Config:", JSON.stringify(flow.azureConfig, null, 2));
}

const journeyId = process.argv[2];
if (!journeyId) {
  console.log("Usage: npx tsx scripts/check-flow-data.ts <journeyId>");
  process.exit(1);
}

checkFlow(journeyId).catch(console.error);
