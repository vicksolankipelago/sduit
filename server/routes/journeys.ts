import { Router } from "express";
import { isAuthenticated, isAdmin } from "../auth";
import { storage } from "../storage";
import { v4 as uuidv4 } from "uuid";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    // Admins see all journeys, test users see all journeys too (but can only test, not edit)
    const journeys = await storage.listAllJourneys();
    
    const journeyList = journeys.map((j) => ({
      id: j.id,
      name: j.name,
      description: j.description || "",
      agentCount: Array.isArray(j.agents) ? (j.agents as any[]).length : 0,
      updatedAt: j.updatedAt,
      status: j.status || "draft",
      isPublished: j.isPublished || false,
      publishedAt: j.publishedAt,
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
    
    // All authenticated users can view journeys (admins edit, test users just view/test)
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
      status: journey.status || "draft",
      isPublished: journey.isPublished || false,
      publishedAt: journey.publishedAt,
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
    
    // Admins can edit any journey
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
    
    // All authenticated users can view version history
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
    
    // All authenticated users can view specific versions
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

// Restore a previous version of a journey
router.post("/:id/versions/:versionId/restore", isAdmin, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    const version = await storage.getJourneyVersion(req.params.versionId);
    
    if (!version || version.journeyId !== req.params.id) {
      return res.status(404).json({ message: "Version not found" });
    }
    
    // Restore the journey to the selected version
    const updated = await storage.updateJourney(
      req.params.id,
      {
        name: version.name,
        description: version.description,
        systemPrompt: version.systemPrompt,
        voice: version.voice,
        agents: version.agents,
        startingAgentId: version.startingAgentId,
      },
      userId,
      `Restored from version ${version.versionNumber}`
    );
    
    if (!updated) {
      return res.status(500).json({ message: "Failed to restore version" });
    }
    
    // Return normalized Journey shape matching GET/PUT endpoints
    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      systemPrompt: updated.systemPrompt,
      voice: updated.voice,
      agents: updated.agents,
      startingAgentId: updated.startingAgentId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      version: updated.version,
    });
  } catch (error) {
    console.error("Error restoring journey version:", error);
    res.status(500).json({ message: "Failed to restore version" });
  }
});

router.delete("/:id", isAdmin, async (req: any, res) => {
  try {
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    // Admins can delete any journey
    await storage.deleteJourney(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting journey:", error);
    res.status(500).json({ message: "Failed to delete journey" });
  }
});

// Publish a journey to production
router.post("/:id/publish", isAdmin, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    const published = await storage.publishJourney(req.params.id, userId);
    
    if (!published) {
      return res.status(500).json({ message: "Failed to publish journey" });
    }
    
    res.json({
      success: true,
      publishedJourney: {
        id: published.id,
        journeyId: published.journeyId,
        name: published.name,
        publishedAt: published.publishedAt,
      },
    });
  } catch (error) {
    console.error("Error publishing journey:", error);
    res.status(500).json({ message: "Failed to publish journey" });
  }
});

// Unpublish a journey (remove from production)
router.post("/:id/unpublish", isAdmin, async (req: any, res) => {
  try {
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    await storage.unpublishJourney(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error unpublishing journey:", error);
    res.status(500).json({ message: "Failed to unpublish journey" });
  }
});

// Get published version of a journey
router.get("/:id/published", isAuthenticated, async (req: any, res) => {
  try {
    const published = await storage.getPublishedJourney(req.params.id);
    
    if (!published) {
      return res.status(404).json({ message: "No published version found" });
    }
    
    res.json({
      id: published.id,
      journeyId: published.journeyId,
      name: published.name,
      description: published.description || "",
      systemPrompt: published.systemPrompt,
      voice: published.voice,
      agents: published.agents,
      startingAgentId: published.startingAgentId,
      version: published.version,
      publishedAt: published.publishedAt,
    });
  } catch (error) {
    console.error("Error getting published journey:", error);
    res.status(500).json({ message: "Failed to get published journey" });
  }
});

// List all published journeys (for production use)
router.get("/published/all", isAuthenticated, async (req: any, res) => {
  try {
    const publishedJourneys = await storage.listPublishedJourneys();
    
    res.json(publishedJourneys.map((p) => ({
      id: p.id,
      journeyId: p.journeyId,
      name: p.name,
      description: p.description || "",
      publishedAt: p.publishedAt,
    })));
  } catch (error) {
    console.error("Error listing published journeys:", error);
    res.status(500).json({ message: "Failed to list published journeys" });
  }
});

router.post("/:id/duplicate", isAdmin, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const original = await storage.getJourney(req.params.id);
    
    if (!original) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    // Admins can duplicate any journey
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
