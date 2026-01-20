import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const sessions = await storage.listUserSessions(userId, limit, offset);
    
    const sessionList = sessions.map((s) => ({
      id: s.id,
      sessionId: s.sessionId,
      journeyName: s.journeyName,
      agentName: s.agentName,
      durationSeconds: s.durationTotalSeconds || 0,
      messageCount: s.statsTotalMessages || 0,
      createdAt: s.createdAt,
    }));
    
    res.json(sessionList);
  } catch (error) {
    console.error("Error listing sessions:", error);
    res.status(500).json({ message: "Failed to list sessions" });
  }
});

router.get("/count", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const count = await storage.getSessionCount(userId);
    res.json({ count });
  } catch (error) {
    console.error("Error counting sessions:", error);
    res.status(500).json({ message: "Failed to count sessions" });
  }
});

router.get("/:sessionId", isAuthenticated, async (req: any, res) => {
  try {
    const session = await storage.getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    if (session.userId !== req.user.claims.sub) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    res.json({
      sessionId: session.sessionId,
      exportedAt: session.exportedAt,
      duration: {
        startMs: session.durationStartMs || 0,
        endMs: session.durationEndMs || 0,
        totalSeconds: session.durationTotalSeconds || 0,
      },
      journey: session.journeyId
        ? {
            id: session.journeyId,
            name: session.journeyName || "",
            voice: session.journeyVoice || "",
          }
        : undefined,
      agent: session.agentId
        ? {
            id: session.agentId,
            name: session.agentName || "",
            prompt: session.agentPrompt || "",
            tools: session.agentTools || [],
          }
        : undefined,
      transcript: session.transcript || [],
      events: session.events || [],
      stats: {
        totalMessages: session.statsTotalMessages || 0,
        userMessages: session.statsUserMessages || 0,
        assistantMessages: session.statsAssistantMessages || 0,
        toolCalls: session.statsToolCalls || 0,
        breadcrumbs: session.statsBreadcrumbs || 0,
      },
    });
  } catch (error) {
    console.error("Error loading session:", error);
    res.status(500).json({ message: "Failed to load session" });
  }
});

router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const sessionData = req.body;
    
    const session = await storage.saveSession({
      userId,
      sessionId: sessionData.sessionId,
      exportedAt: new Date(sessionData.exportedAt),
      durationStartMs: sessionData.duration?.startMs,
      durationEndMs: sessionData.duration?.endMs,
      durationTotalSeconds: sessionData.duration?.totalSeconds,
      journeyId: sessionData.journey?.id,
      journeyName: sessionData.journey?.name,
      journeyVoice: sessionData.journey?.voice,
      agentId: sessionData.agent?.id,
      agentName: sessionData.agent?.name,
      agentPrompt: sessionData.agent?.prompt,
      agentTools: sessionData.agent?.tools || [],
      transcript: sessionData.transcript || [],
      events: sessionData.events || [],
      statsTotalMessages: sessionData.stats?.totalMessages || 0,
      statsUserMessages: sessionData.stats?.userMessages || 0,
      statsAssistantMessages: sessionData.stats?.assistantMessages || 0,
      statsToolCalls: sessionData.stats?.toolCalls || 0,
      statsBreadcrumbs: sessionData.stats?.breadcrumbs || 0,
    });
    
    res.json({ success: true, id: session.id });
  } catch (error) {
    console.error("Error saving session:", error);
    res.status(500).json({ message: "Failed to save session" });
  }
});

router.delete("/:sessionId", isAuthenticated, async (req: any, res) => {
  try {
    const session = await storage.getSession(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    if (session.userId !== req.user.claims.sub) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    await storage.deleteSession(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ message: "Failed to delete session" });
  }
});

export default router;
