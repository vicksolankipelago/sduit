import { Router } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
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
    const userId = req.user.id;
    const count = await storage.getSessionCount(userId);
    res.json({ count });
  } catch (error) {
    console.error("Error counting sessions:", error);
    res.status(500).json({ message: "Failed to count sessions" });
  }
});

router.get("/:sessionId", isAuthenticated, async (req: any, res) => {
  try {
    // Try looking up by database ID first, then by OpenAI sessionId
    let session = await storage.getSessionById(req.params.sessionId);
    if (!session) {
      session = await storage.getSession(req.params.sessionId);
    }
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    if (session.userId !== req.user.id) {
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
    const userId = req.user.id;
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

router.put("/:sessionId/message", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { message, journey, agent } = req.body;
    
    if (!message || !message.itemId) {
      return res.status(400).json({ message: "Message with itemId is required" });
    }
    
    const existingSession = await storage.getSession(sessionId);
    if (existingSession && existingSession.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const session = await storage.upsertSessionMessage({
      userId,
      sessionId,
      message,
      journeyId: journey?.id,
      journeyName: journey?.name,
      journeyVoice: journey?.voice,
      agentId: agent?.id,
      agentName: agent?.name,
      agentPrompt: agent?.prompt,
      agentTools: agent?.tools || [],
    });
    
    res.json({ success: true, id: session.id });
  } catch (error) {
    console.error("Error upserting session message:", error);
    res.status(500).json({ message: "Failed to save message" });
  }
});

router.delete("/:sessionId", isAuthenticated, async (req: any, res) => {
  try {
    // Try looking up by database ID first, then by OpenAI sessionId
    let session = await storage.getSessionById(req.params.sessionId);
    if (!session) {
      session = await storage.getSession(req.params.sessionId);
    }
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    if (session.userId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    await storage.deleteSession(session.sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ message: "Failed to delete session" });
  }
});

// Notes routes
router.get("/:sessionId/notes", isAuthenticated, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const session = await storage.getSessionBySessionId(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    // Use session.id (database UUID) to query notes
    const notes = await storage.listSessionNotes(session.id);
    res.json(notes);
  } catch (error) {
    console.error("Error listing notes:", error);
    res.status(500).json({ message: "Failed to list notes" });
  }
});

router.post("/:sessionId/notes", isAuthenticated, async (req: any, res) => {
  console.log("POST notes request:", req.params.sessionId, req.body);
  try {
    const { sessionId } = req.params;
    const { messageIndex, content, parentId } = req.body;
    const user = req.user;
    
    const session = await storage.getSessionBySessionId(sessionId);
    if (!session) {
      console.log("Session not found:", sessionId);
      return res.status(404).json({ message: "Session not found" });
    }
    
    if (typeof messageIndex !== "number" || !content) {
      return res.status(400).json({ message: "messageIndex and content are required" });
    }
    
    // Use session.id (database UUID) not sessionId (OpenAI session ID)
    const note = await storage.createNote({
      sessionId: session.id,
      messageIndex,
      userId: user.id,
      userRole: user.role || "member",
      userName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
      content,
      status: "todo",
      parentId: parentId || null,
    });
    
    console.log("Note created:", note.id);
    res.json(note);
  } catch (error) {
    console.error("Error creating note:", error);
    res.status(500).json({ message: "Failed to create note" });
  }
});

router.patch("/:sessionId/notes/:noteId", isAuthenticated, async (req: any, res) => {
  try {
    const { sessionId, noteId } = req.params;
    const { content, status } = req.body;
    
    const session = await storage.getSessionBySessionId(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    const note = await storage.getNote(noteId);
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    
    if (note.sessionId !== sessionId) {
      return res.status(403).json({ message: "Note does not belong to this session" });
    }
    
    const updates: any = {};
    if (content !== undefined) updates.content = content;
    if (status !== undefined) updates.status = status;
    
    const updatedNote = await storage.updateNote(noteId, updates);
    res.json(updatedNote);
  } catch (error) {
    console.error("Error updating note:", error);
    res.status(500).json({ message: "Failed to update note" });
  }
});

router.delete("/:sessionId/notes/:noteId", isAuthenticated, async (req: any, res) => {
  try {
    const { sessionId, noteId } = req.params;
    
    const session = await storage.getSessionBySessionId(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    const note = await storage.getNote(noteId);
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    
    if (note.sessionId !== sessionId) {
      return res.status(403).json({ message: "Note does not belong to this session" });
    }
    
    await storage.deleteNoteWithReplies(noteId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).json({ message: "Failed to delete note" });
  }
});

export default router;
