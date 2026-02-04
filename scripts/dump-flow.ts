import { objectStorageClient } from "../server/replit_integrations/object_storage/objectStorage";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const PREFIX = "published-flows";

async function dumpFlow(journeyId: string) {
  const bucket = objectStorageClient.bucket(BUCKET_ID);
  const flowFile = bucket.file(`${PREFIX}/${journeyId}.json`);
  
  const [exists] = await flowFile.exists();
  if (!exists) {
    console.log("Flow not found");
    return;
  }
  
  const [content] = await flowFile.download();
  const flow = JSON.parse(content.toString());
  
  // Show the relevant fields
  console.log("=== Raw Flow Data ===");
  console.log("id:", flow.id);
  console.log("journeyId:", flow.journeyId);
  console.log("name:", flow.name);
  console.log("voiceProvider:", flow.voiceProvider);
  console.log("ttsProvider:", flow.ttsProvider);
  console.log("elevenLabsConfig:", JSON.stringify(flow.elevenLabsConfig, null, 2));
  console.log("voiceEnabled:", flow.voiceEnabled);
}

const journeyId = process.argv[2];
if (!journeyId) {
  console.log("Usage: npx tsx scripts/dump-flow.ts <journeyId>");
  process.exit(1);
}

dumpFlow(journeyId).catch(console.error);
