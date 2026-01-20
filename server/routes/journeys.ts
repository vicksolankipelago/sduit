import { Router } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { v4 as uuidv4 } from "uuid";

const router = Router();

const DEFAULT_JOURNEYS = [
  {
    id: "default-intake-call",
    name: "Intake Call",
    description: "Complete voice-guided intake flow for members who have finished the web personalization quiz.",
  },
  {
    id: "default-gad-phq2",
    name: "Mental Health Screening",
    description: "GAD-2 / PHQ-2 mental health screening with compassionate voice guidance.",
  },
  {
    id: "default-dry-january",
    name: "Dry January Intake Call",
    description: "Quick intake call to set up Dry January goals and establish check-in habits.",
  },
];

async function seedDefaultJourneysIfNeeded(userId: string): Promise<void> {
  try {
    const existingJourneys = await storage.listUserJourneys(userId);
    if (existingJourneys.length > 0) {
      return;
    }

    console.log(`Seeding default journeys for user ${userId}...`);
    
    for (const defaultJourney of DEFAULT_JOURNEYS) {
      const journeyId = `${defaultJourney.id}-${userId}`;
      try {
        await storage.createJourney({
          id: journeyId,
          userId,
          name: defaultJourney.name,
          description: defaultJourney.description,
          systemPrompt: "",
          voice: "shimmer",
          agents: [],
          startingAgentId: "",
          version: "1.0.0",
        });
        console.log(`Created default journey: ${defaultJourney.name}`);
      } catch (insertError: any) {
        if (insertError?.code === '23505') {
          console.log(`Default journey already exists: ${defaultJourney.name}`);
        } else {
          console.error(`Failed to create default journey ${defaultJourney.name}:`, insertError);
        }
      }
    }
  } catch (error) {
    console.error("Error seeding default journeys:", error);
  }
}

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    await seedDefaultJourneysIfNeeded(userId);
    
    const journeys = await storage.listUserJourneys(userId);
    
    const journeyList = journeys.map((j) => ({
      id: j.id,
      name: j.name,
      description: j.description || "",
      agentCount: Array.isArray(j.agents) ? (j.agents as any[]).length : 0,
      updatedAt: j.updatedAt,
    }));
    
    res.json(journeyList);
  } catch (error) {
    console.error("Error listing journeys:", error);
    res.status(500).json({ message: "Failed to list journeys" });
  }
});

router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    if (journey.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    res.json({
      id: journey.id,
      name: journey.name,
      description: journey.description || "",
      systemPrompt: journey.systemPrompt,
      voice: journey.voice,
      agents: journey.agents,
      startingAgentId: journey.startingAgentId,
      createdAt: journey.createdAt,
      updatedAt: journey.updatedAt,
      version: journey.version,
    });
  } catch (error) {
    console.error("Error loading journey:", error);
    res.status(500).json({ message: "Failed to load journey" });
  }
});

router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { name, description, systemPrompt, voice, agents, startingAgentId, version } = req.body;
    
    const journey = await storage.createJourney({
      id: uuidv4(),
      userId,
      name: name || "New Journey",
      description: description || "",
      systemPrompt: systemPrompt || "",
      voice: voice || null,
      agents: agents || [],
      startingAgentId: startingAgentId || "",
      version: version || "1.0.0",
    });
    
    res.json({
      id: journey.id,
      name: journey.name,
      description: journey.description || "",
      systemPrompt: journey.systemPrompt,
      voice: journey.voice,
      agents: journey.agents,
      startingAgentId: journey.startingAgentId,
      createdAt: journey.createdAt,
      updatedAt: journey.updatedAt,
      version: journey.version,
    });
  } catch (error) {
    console.error("Error creating journey:", error);
    res.status(500).json({ message: "Failed to create journey" });
  }
});

router.put("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    if (journey.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const { name, description, systemPrompt, voice, agents, startingAgentId, version } = req.body;
    
    const updated = await storage.updateJourney(req.params.id, {
      name,
      description,
      systemPrompt,
      voice,
      agents,
      startingAgentId,
      version,
    });
    
    if (!updated) {
      return res.status(500).json({ message: "Failed to update journey" });
    }
    
    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description || "",
      systemPrompt: updated.systemPrompt,
      voice: updated.voice,
      agents: updated.agents,
      startingAgentId: updated.startingAgentId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      version: updated.version,
    });
  } catch (error) {
    console.error("Error updating journey:", error);
    res.status(500).json({ message: "Failed to update journey" });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    if (journey.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    await storage.deleteJourney(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting journey:", error);
    res.status(500).json({ message: "Failed to delete journey" });
  }
});

router.post("/:id/duplicate", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const original = await storage.getJourney(req.params.id);
    
    if (!original) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    if (original.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const idMapping: Record<string, string> = {};
    const originalAgents = (original.agents || []) as any[];
    const newAgents = originalAgents.map((agent: any) => {
      const newId = uuidv4();
      idMapping[agent.id] = newId;
      return { ...agent, id: newId };
    });
    
    const duplicatedAgents = newAgents.map((agent: any) => ({
      ...agent,
      handoffs: (agent.handoffs || []).map((oldId: string) => idMapping[oldId] || oldId),
    }));
    
    const newStartingAgentId = idMapping[original.startingAgentId] || original.startingAgentId;
    
    const duplicate = await storage.createJourney({
      id: uuidv4(),
      userId,
      name: `${original.name} (Copy)`,
      description: original.description,
      systemPrompt: original.systemPrompt,
      voice: original.voice,
      agents: duplicatedAgents,
      startingAgentId: newStartingAgentId,
      version: original.version,
    });
    
    res.json({
      id: duplicate.id,
      name: duplicate.name,
      description: duplicate.description || "",
      systemPrompt: duplicate.systemPrompt,
      voice: duplicate.voice,
      agents: duplicate.agents,
      startingAgentId: duplicate.startingAgentId,
      createdAt: duplicate.createdAt,
      updatedAt: duplicate.updatedAt,
      version: duplicate.version,
    });
  } catch (error) {
    console.error("Error duplicating journey:", error);
    res.status(500).json({ message: "Failed to duplicate journey" });
  }
});

export default router;
