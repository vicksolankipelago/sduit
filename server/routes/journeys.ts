import { Router } from "express";
import { isAuthenticated, isAdmin } from "../auth";
import { storage } from "../storage";
import { v4 as uuidv4 } from "uuid";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
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

router.post("/", isAdmin, async (req: any, res) => {
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

router.put("/:id", isAdmin, async (req: any, res) => {
  try {
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    if (journey.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const { name, description, systemPrompt, voice, agents, startingAgentId, version, changeNotes } = req.body;
    
    const updated = await storage.updateJourney(
      req.params.id,
      {
        name,
        description,
        systemPrompt,
        voice,
        agents,
        startingAgentId,
        version,
      },
      req.user.id,
      changeNotes
    );
    
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

// Get version history for a journey
router.get("/:id/versions", isAuthenticated, async (req: any, res) => {
  try {
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    if (journey.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const versions = await storage.listJourneyVersions(req.params.id);
    
    res.json(versions.map(v => ({
      id: v.id,
      journeyId: v.journeyId,
      versionNumber: v.versionNumber,
      name: v.name,
      changeNotes: v.changeNotes,
      createdAt: v.createdAt,
    })));
  } catch (error) {
    console.error("Error listing journey versions:", error);
    res.status(500).json({ message: "Failed to list versions" });
  }
});

// Get specific version of a journey
router.get("/:id/versions/:versionId", isAuthenticated, async (req: any, res) => {
  try {
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    if (journey.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const version = await storage.getJourneyVersion(req.params.versionId);
    
    if (!version || version.journeyId !== req.params.id) {
      return res.status(404).json({ message: "Version not found" });
    }
    
    res.json({
      id: version.id,
      journeyId: version.journeyId,
      versionNumber: version.versionNumber,
      name: version.name,
      description: version.description,
      systemPrompt: version.systemPrompt,
      voice: version.voice,
      agents: version.agents,
      startingAgentId: version.startingAgentId,
      changeNotes: version.changeNotes,
      createdAt: version.createdAt,
    });
  } catch (error) {
    console.error("Error getting journey version:", error);
    res.status(500).json({ message: "Failed to get version" });
  }
});

router.delete("/:id", isAdmin, async (req: any, res) => {
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

// Export all journeys for syncing to production
router.get("/export/all", isAdmin, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const journeys = await storage.listUserJourneys(userId);
    
    // Get full journey data for each
    const fullJourneys = await Promise.all(
      journeys.map(j => storage.getJourney(j.id))
    );
    
    const exportData = fullJourneys
      .filter(j => j !== null)
      .map(j => ({
        id: j!.id,
        name: j!.name,
        description: j!.description,
        systemPrompt: j!.systemPrompt,
        voice: j!.voice,
        agents: j!.agents,
        startingAgentId: j!.startingAgentId,
        version: j!.version,
      }));
    
    res.json({
      exportedAt: new Date().toISOString(),
      count: exportData.length,
      journeys: exportData,
    });
  } catch (error) {
    console.error("Error exporting journeys:", error);
    res.status(500).json({ message: "Failed to export journeys" });
  }
});

// Import journeys (for syncing from dev to production)
router.post("/import", isAdmin, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { journeys } = req.body;
    
    if (!Array.isArray(journeys)) {
      return res.status(400).json({ message: "Invalid import data: journeys must be an array" });
    }
    
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };
    
    for (const journey of journeys) {
      try {
        // Check if journey already exists
        const existing = await storage.getJourney(journey.id);
        
        if (existing) {
          // Update existing journey
          await storage.updateJourney(
            journey.id,
            {
              name: journey.name,
              description: journey.description,
              systemPrompt: journey.systemPrompt,
              voice: journey.voice,
              agents: journey.agents,
              startingAgentId: journey.startingAgentId,
              version: journey.version,
            },
            userId,
            "Imported from dev environment"
          );
          results.updated++;
        } else {
          // Create new journey with the same ID
          await storage.createJourney({
            id: journey.id,
            userId,
            name: journey.name,
            description: journey.description || "",
            systemPrompt: journey.systemPrompt || "",
            voice: journey.voice || null,
            agents: journey.agents || [],
            startingAgentId: journey.startingAgentId || "",
            version: journey.version || "1.0.0",
          });
          results.created++;
        }
      } catch (err) {
        results.errors.push(`Failed to import journey "${journey.name}": ${err}`);
      }
    }
    
    res.json({
      success: true,
      message: `Imported ${results.created + results.updated} journeys (${results.created} new, ${results.updated} updated)`,
      ...results,
    });
  } catch (error) {
    console.error("Error importing journeys:", error);
    res.status(500).json({ message: "Failed to import journeys" });
  }
});

router.post("/:id/duplicate", isAdmin, async (req: any, res) => {
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
