const journeyId = '1995176b-6686-4c6a-ac29-63c58d687dc9';

async function testApi() {
  const res = await fetch(`http://localhost:3001/api/journeys/production/${journeyId}`);
  const data = await res.json();
  
  console.log("API Response:");
  console.log("  name:", data.name);
  console.log("  ttsProvider:", data.ttsProvider);
  console.log("  voiceProvider:", data.voiceProvider);
  console.log("  elevenLabsConfig:", JSON.stringify(data.elevenLabsConfig, null, 2));
  console.log("  voiceEnabled:", data.voiceEnabled);
}

testApi().catch(console.error);
