import { objectStorageClient } from "../server/replit_integrations/object_storage/objectStorage";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const PREFIX = "published-flows";

async function listFlows() {
  console.log("Listing published flows in Object Storage...\n");
  
  const bucket = objectStorageClient.bucket(BUCKET_ID);
  const indexFile = bucket.file(`${PREFIX}/index.json`);
  
  const [exists] = await indexFile.exists();
  if (!exists) {
    console.log("No index file found - no published flows");
    return [];
  }
  
  const [content] = await indexFile.download();
  const index = JSON.parse(content.toString());
  
  console.log(`Found ${index.flows?.length || 0} published flows:\n`);
  index.flows?.forEach((flow: any, i: number) => {
    console.log(`${i + 1}. ${flow.name} (ID: ${flow.journeyId})`);
    console.log(`   Published: ${flow.publishedAt}`);
    console.log(`   Agents: ${flow.agentCount || 'unknown'}`);
    console.log("");
  });
  
  return index.flows || [];
}

async function deleteFlow(journeyId: string) {
  console.log(`Deleting flow ${journeyId}...`);
  
  const bucket = objectStorageClient.bucket(BUCKET_ID);
  
  // Delete the flow file
  const flowFile = bucket.file(`${PREFIX}/${journeyId}.json`);
  const [flowExists] = await flowFile.exists();
  if (flowExists) {
    await flowFile.delete();
    console.log(`  Deleted flow file`);
  }
  
  // Update the index
  const indexFile = bucket.file(`${PREFIX}/index.json`);
  const [indexExists] = await indexFile.exists();
  if (indexExists) {
    const [content] = await indexFile.download();
    const index = JSON.parse(content.toString());
    index.flows = (index.flows || []).filter((f: any) => f.journeyId !== journeyId);
    await indexFile.save(JSON.stringify(index, null, 2), {
      contentType: "application/json",
      metadata: { cacheControl: "no-cache" },
    });
    console.log(`  Updated index`);
  }
  
  console.log(`  Done!`);
}

async function deleteAllFlows() {
  console.log("Deleting ALL published flows...\n");
  
  const bucket = objectStorageClient.bucket(BUCKET_ID);
  
  // List all files in the prefix
  const [files] = await bucket.getFiles({ prefix: PREFIX });
  
  for (const file of files) {
    console.log(`  Deleting ${file.name}...`);
    await file.delete();
  }
  
  console.log(`\nDeleted ${files.length} files from Object Storage`);
}

const command = process.argv[2];
const arg = process.argv[3];

async function main() {
  if (!BUCKET_ID) {
    console.error("ERROR: DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
    process.exit(1);
  }
  
  switch (command) {
    case "list":
      await listFlows();
      break;
    case "delete":
      if (!arg) {
        console.error("Usage: npx tsx scripts/manage-production-flows.ts delete <journeyId>");
        process.exit(1);
      }
      await deleteFlow(arg);
      break;
    case "delete-all":
      await deleteAllFlows();
      break;
    default:
      console.log("Usage:");
      console.log("  npx tsx scripts/manage-production-flows.ts list");
      console.log("  npx tsx scripts/manage-production-flows.ts delete <journeyId>");
      console.log("  npx tsx scripts/manage-production-flows.ts delete-all");
  }
}

main().catch(console.error);
