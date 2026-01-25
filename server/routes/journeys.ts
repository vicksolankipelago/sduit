import { Router, Request, Response } from "express";
import { isAuthenticated, isAdmin } from "../auth";
import { storage } from "../storage";
import { v4 as uuidv4 } from "uuid";
import { publishedFlowStorage } from "../services/publishedFlowStorage";
import { journeyLogger } from "../utils/logger";
import * as apiResponse from "../utils/response";

const router = Router();

// Public preview endpoint - no authentication required
// Returns minimal journey data for mobile preview sharing
router.get("/preview/:id", async (req: Request, res: Response) => {
  try {
    const journey = await storage.getJourney(req.params.id as string);
    
    if (!journey) {
      return apiResponse.notFound(res, "Journey not found");
    }

    // Return only the data needed for preview rendering
    return apiResponse.success(res, {
      id: journey.id,
      name: journey.name,
      agents: journey.agents,
      startingAgentId: journey.startingAgentId,
    });
  } catch (error) {
    journeyLogger.error("Error fetching journey preview:", error);
    return apiResponse.serverError(res, "Failed to load journey preview");
  }
});

router.get("/", isAuthenticated, async (req: Request, res: Response) => {
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

    return apiResponse.success(res, journeyList);
  } catch (error) {
    journeyLogger.error("Error listing journeys:", error);
    return apiResponse.serverError(res, "Failed to list journeys");
  }
});

router.get("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const journey = await storage.getJourney(req.params.id);

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    // All authenticated users can view journeys (admins edit, test users just view/test)
    return apiResponse.success(res, {
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
    journeyLogger.error("Error loading journey:", error);
    return apiResponse.serverError(res, "Failed to load journey");
  }
});

router.post("/", isAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

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

    return apiResponse.success(res, {
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
    }, 201);
  } catch (error) {
    journeyLogger.error("Error creating journey:", error);
    return apiResponse.serverError(res, "Failed to create journey");
  }
});

router.put("/:id", isAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const journey = await storage.getJourney(req.params.id);

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
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
      userId,
      changeNotes
    );

    if (!updated) {
      return apiResponse.serverError(res, "Failed to update journey");
    }

    return apiResponse.success(res, {
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
    journeyLogger.error("Error updating journey:", error);
    return apiResponse.serverError(res, "Failed to update journey");
  }
});

// Get version history for a journey
router.get("/:id/versions", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const journey = await storage.getJourney(req.params.id);

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    // All authenticated users can view version history
    const versions = await storage.listJourneyVersions(req.params.id);

    return apiResponse.success(res, versions.map(v => ({
      id: v.id,
      journeyId: v.journeyId,
      versionNumber: v.versionNumber,
      name: v.name,
      changeNotes: v.changeNotes,
      createdAt: v.createdAt,
    })));
  } catch (error) {
    journeyLogger.error("Error listing journey versions:", error);
    return apiResponse.serverError(res, "Failed to list versions");
  }
});

// Get specific version of a journey
router.get("/:id/versions/:versionId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const journey = await storage.getJourney(req.params.id);

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    // All authenticated users can view specific versions
    const version = await storage.getJourneyVersion(req.params.versionId);

    if (!version || version.journeyId !== req.params.id) {
      return apiResponse.notFound(res, "Version");
    }

    return apiResponse.success(res, {
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
    journeyLogger.error("Error getting journey version:", error);
    return apiResponse.serverError(res, "Failed to get version");
  }
});

// Restore a previous version of a journey
router.post("/:id/versions/:versionId/restore", isAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const journey = await storage.getJourney(req.params.id);

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    const version = await storage.getJourneyVersion(req.params.versionId);

    if (!version || version.journeyId !== req.params.id) {
      return apiResponse.notFound(res, "Version");
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
      return apiResponse.serverError(res, "Failed to restore version");
    }

    // Return normalized Journey shape matching GET/PUT endpoints
    return apiResponse.success(res, {
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
    journeyLogger.error("Error restoring journey version:", error);
    return apiResponse.serverError(res, "Failed to restore version");
  }
});

router.delete("/:id", isAdmin, async (req: Request, res: Response) => {
  try {
    const journey = await storage.getJourney(req.params.id);

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    // Admins can delete any journey
    await storage.deleteJourney(req.params.id);
    return apiResponse.success(res, { deleted: true });
  } catch (error) {
    journeyLogger.error("Error deleting journey:", error);
    return apiResponse.serverError(res, "Failed to delete journey");
  }
});

// Publish a journey to production
router.post("/:id/publish", isAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const journey = await storage.getJourney(req.params.id);

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    // Save to local database (for dev environment tracking)
    const published = await storage.publishJourney(req.params.id, userId);

    if (!published) {
      return apiResponse.serverError(res, "Failed to publish journey");
    }

    // Also save to Object Storage (shared between dev and prod)
    try {
      await publishedFlowStorage.savePublishedFlow({
        id: published.id,
        journeyId: published.journeyId,
        name: published.name,
        description: published.description || "",
        systemPrompt: published.systemPrompt,
        voice: published.voice,
        agents: published.agents as any[],
        startingAgentId: published.startingAgentId,
        version: published.version,
        publishedAt: published.publishedAt?.toISOString() || new Date().toISOString(),
        publishedByUserId: userId,
      });
      journeyLogger.info(`Published journey ${journey.name} to Object Storage for production`);
    } catch (storageError) {
      journeyLogger.warn("Failed to save to Object Storage:", storageError);
      // Continue anyway - local publish still succeeded
    }

    return apiResponse.success(res, {
      success: true,
      publishedJourney: {
        id: published.id,
        journeyId: published.journeyId,
        name: published.name,
        publishedAt: published.publishedAt,
      },
    });
  } catch (error) {
    journeyLogger.error("Error publishing journey:", error);
    return apiResponse.serverError(res, "Failed to publish journey");
  }
});

// Unpublish a journey (remove from production)
router.post("/:id/unpublish", isAdmin, async (req: Request, res: Response) => {
  try {
    const journey = await storage.getJourney(req.params.id);

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    await storage.unpublishJourney(req.params.id);

    // Also remove from Object Storage
    try {
      await publishedFlowStorage.deletePublishedFlow(req.params.id);
      journeyLogger.info(`Unpublished journey ${journey.name} from Object Storage`);
    } catch (storageError) {
      journeyLogger.warn("Failed to remove from Object Storage:", storageError);
    }

    return apiResponse.success(res, { success: true });
  } catch (error) {
    journeyLogger.error("Error unpublishing journey:", error);
    return apiResponse.serverError(res, "Failed to unpublish journey");
  }
});

// Get published version of a journey
router.get("/:id/published", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const published = await storage.getPublishedJourney(req.params.id);

    if (!published) {
      return apiResponse.notFound(res, "Published version");
    }

    return apiResponse.success(res, {
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
    journeyLogger.error("Error getting published journey:", error);
    return apiResponse.serverError(res, "Failed to get published journey");
  }
});

// List all published journeys (for production use)
router.get("/published/all", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const publishedJourneys = await storage.listPublishedJourneys();

    return apiResponse.success(res, publishedJourneys.map((p) => ({
      id: p.id,
      journeyId: p.journeyId,
      name: p.name,
      description: p.description || "",
      publishedAt: p.publishedAt,
    })));
  } catch (error) {
    journeyLogger.error("Error listing published journeys:", error);
    return apiResponse.serverError(res, "Failed to list published journeys");
  }
});

// Get environment info for frontend
router.get("/environment", (_req: Request, res: Response) => {
  return apiResponse.success(res, {
    isProduction: process.env.NODE_ENV === "production",
    environment: process.env.NODE_ENV || "development",
  });
});

// Production endpoints - fetch flows from Object Storage (shared between dev/prod)
// These are public read-only endpoints since production runtime needs to load flows
// List all production flows (from Object Storage)
router.get("/production/list", async (_req: Request, res: Response) => {
  try {
    const flows = await publishedFlowStorage.listPublishedFlows();
    return apiResponse.success(res, flows);
  } catch (error) {
    journeyLogger.error("Error listing production flows:", error);
    return apiResponse.serverError(res, "Failed to list production flows");
  }
});

// Get a specific production flow (from Object Storage)
router.get("/production/:journeyId", async (req: Request, res: Response) => {
  try {
    const flow = await publishedFlowStorage.getPublishedFlow(req.params.journeyId);

    if (!flow) {
      return apiResponse.notFound(res, "Production flow");
    }

    return apiResponse.success(res, flow);
  } catch (error) {
    journeyLogger.error("Error getting production flow:", error);
    return apiResponse.serverError(res, "Failed to get production flow");
  }
});

router.post("/:id/duplicate", isAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const original = await storage.getJourney(req.params.id);

    if (!original) {
      return apiResponse.notFound(res, "Journey");
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

    return apiResponse.success(res, {
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
    }, 201);
  } catch (error) {
    journeyLogger.error("Error duplicating journey:", error);
    return apiResponse.serverError(res, "Failed to duplicate journey");
  }
});

// Export journey config with transcripts for external review
router.get("/:id/export", isAuthenticated, async (req: any, res) => {
  try {
    const journey = await storage.getJourney(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    // Get recent voice sessions for this journey to include transcripts
    const sessions = await storage.getSessionsByJourneyId(journey.id, 10);
    
    const transcripts = sessions.map((session: any) => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      durationSeconds: session.durationTotalSeconds || 0,
      transcript: session.transcript || [],
    }));
    
    // Build export object with prompt, config, and transcripts
    const exportData = {
      exportVersion: "1.0",
      exportedAt: new Date().toISOString(),
      journey: {
        id: journey.id,
        name: journey.name,
        description: journey.description || "",
        systemPrompt: journey.systemPrompt,
        voice: journey.voice,
        agents: journey.agents,
        startingAgentId: journey.startingAgentId,
        version: journey.version,
      },
      recentTranscripts: transcripts,
    };
    
    res.json(exportData);
  } catch (error) {
    console.error("Error exporting journey:", error);
    res.status(500).json({ message: "Failed to export journey" });
  }
});

// Import journey config to update an existing journey
router.post("/:id/import", isAdmin, async (req: any, res) => {
  try {
    const existingJourney = await storage.getJourney(req.params.id);
    
    if (!existingJourney) {
      return res.status(404).json({ message: "Journey not found" });
    }
    
    const importData = req.body;
    
    // Validate import data structure
    if (!importData.journey) {
      return res.status(400).json({ message: "Invalid import format: missing 'journey' field" });
    }
    
    const importedJourney = importData.journey;
    const userId = req.user.id;
    
    // Update the journey with imported config - use ?? to preserve empty/cleared values
    const updatedJourney = await storage.updateJourney(req.params.id, {
      name: importedJourney.name ?? existingJourney.name,
      description: importedJourney.description ?? existingJourney.description,
      systemPrompt: importedJourney.systemPrompt ?? existingJourney.systemPrompt,
      voice: importedJourney.voice ?? existingJourney.voice,
      agents: importedJourney.agents ?? existingJourney.agents,
      startingAgentId: importedJourney.startingAgentId ?? existingJourney.startingAgentId,
      version: importedJourney.version ?? existingJourney.version,
    }, userId, "Imported from external config");
    
    if (!updatedJourney) {
      return res.status(500).json({ message: "Failed to update journey" });
    }
    
    res.json({
      success: true,
      message: "Journey updated successfully from import",
      journey: {
        id: updatedJourney.id,
        name: updatedJourney.name,
        description: updatedJourney.description || "",
        systemPrompt: updatedJourney.systemPrompt,
        voice: updatedJourney.voice,
        agents: updatedJourney.agents,
        startingAgentId: updatedJourney.startingAgentId,
        updatedAt: updatedJourney.updatedAt,
        version: updatedJourney.version,
      },
    });
  } catch (error) {
    console.error("Error importing journey:", error);
    res.status(500).json({ message: "Failed to import journey" });
  }
});

export default router;
