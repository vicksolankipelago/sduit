import { Router, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { sessionLogger } from "../utils/logger";
import * as apiResponse from "../utils/response";

const router = Router();

router.get("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role;

    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const limitParam = req.query.limit as string;
    const offsetParam = req.query.offset as string;
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    if (isNaN(limit) || isNaN(offset) || limit < 0 || offset < 0) {
      return apiResponse.validationError(res, "limit and offset must be non-negative integers");
    }

    // Admins can see all sessions, test users only see their own
    const sessions = userRole === 'admin'
      ? await storage.listAllSessions(limit, offset)
      : await storage.listUserSessions(userId, limit, offset);

    const sessionList = sessions.map((s) => ({
      id: s.id,
      sessionId: s.sessionId,
      journeyName: s.journeyName,
      agentName: s.agentName,
      durationSeconds: s.durationTotalSeconds || 0,
      messageCount: s.statsTotalMessages || 0,
      createdAt: s.createdAt,
      userName: s.userName,
    }));

    return apiResponse.success(res, sessionList);
  } catch (error) {
    sessionLogger.error("Error listing sessions:", error);
    return apiResponse.serverError(res, "Failed to list sessions");
  }
});

router.get("/count", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const count = await storage.getSessionCount(userId);
    return apiResponse.success(res, { count });
  } catch (error) {
    sessionLogger.error("Error counting sessions:", error);
    return apiResponse.serverError(res, "Failed to count sessions");
  }
});

router.post("/note-counts", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { sessionIds } = req.body;
    if (!Array.isArray(sessionIds)) {
      return apiResponse.validationError(res, "sessionIds must be an array");
    }
    if (sessionIds.length === 0) {
      return apiResponse.success(res, {});
    }

    const counts = await storage.countNotesForSessions(sessionIds);
    return apiResponse.success(res, counts);
  } catch (error) {
    sessionLogger.error("Error counting notes:", error);
    return apiResponse.serverError(res, "Failed to count notes");
  }
});

router.get("/:sessionId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role;

    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    // Try looking up by database ID first, then by OpenAI sessionId
    let session = await storage.getSessionById(req.params.sessionId);
    if (!session) {
      session = await storage.getSession(req.params.sessionId);
    }

    if (!session) {
      return apiResponse.notFound(res, "Session");
    }

    // Admins can view any session, test users only their own
    if (userRole !== 'admin' && session.userId !== userId) {
      return apiResponse.forbidden(res);
    }

    // Fetch full journey config if journeyId exists
    let journeyConfig: any = null;
    if (session.journeyId) {
      const journey = await storage.getJourney(session.journeyId);
      if (journey) {
        journeyConfig = {
          id: journey.id,
          name: journey.name,
          description: journey.description || "",
          systemPrompt: journey.systemPrompt,
          voice: journey.voice,
          agents: journey.agents,
          startingAgentId: journey.startingAgentId,
          version: journey.version,
        };
      }
    }

    return apiResponse.success(res, {
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
      journeyConfig: journeyConfig,
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
      prolific: (session.prolificPid || session.prolificStudyId || session.prolificSessionId) ? {
        participantId: session.prolificPid || undefined,
        studyId: session.prolificStudyId || undefined,
        sessionId: session.prolificSessionId || undefined,
      } : undefined,
    });
  } catch (error) {
    sessionLogger.error("Error loading session:", error);
    return apiResponse.serverError(res, "Failed to load session");
  }
});

router.post("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const sessionData = req.body;

    if (!sessionData.sessionId) {
      return apiResponse.validationError(res, "sessionId is required");
    }

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
      prolificPid: sessionData.prolific?.participantId,
      prolificStudyId: sessionData.prolific?.studyId,
      prolificSessionId: sessionData.prolific?.sessionId,
    });

    return apiResponse.success(res, { id: session.id }, 201);
  } catch (error) {
    sessionLogger.error("Error saving session:", error);
    return apiResponse.serverError(res, "Failed to save session");
  }
});

router.put("/:sessionId/message", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const { sessionId } = req.params;
    const { message, journey, agent, prolific } = req.body;

    if (!message || !message.itemId) {
      return apiResponse.validationError(res, "Message with itemId is required");
    }

    const existingSession = await storage.getSession(sessionId);
    if (existingSession && existingSession.userId !== userId) {
      return apiResponse.forbidden(res);
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
      prolificPid: prolific?.participantId,
      prolificStudyId: prolific?.studyId,
      prolificSessionId: prolific?.sessionId,
    });

    return apiResponse.success(res, { id: session.id });
  } catch (error) {
    sessionLogger.error("Error upserting session message:", error);
    return apiResponse.serverError(res, "Failed to save message");
  }
});

router.delete("/:sessionId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role;

    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    // Try looking up by database ID first, then by OpenAI sessionId
    let session = await storage.getSessionById(req.params.sessionId);
    if (!session) {
      session = await storage.getSession(req.params.sessionId);
    }

    if (!session) {
      return apiResponse.notFound(res, "Session");
    }

    // Admins can delete any session, test users only their own
    if (userRole !== 'admin' && session.userId !== userId) {
      return apiResponse.forbidden(res);
    }

    await storage.deleteSession(session.sessionId);
    return apiResponse.success(res, { deleted: true });
  } catch (error) {
    sessionLogger.error("Error deleting session:", error);
    return apiResponse.serverError(res, "Failed to delete session");
  }
});

// Notes routes
router.get("/:sessionId/notes", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await storage.getSessionBySessionId(sessionId);
    if (!session) {
      return apiResponse.notFound(res, "Session");
    }
    // Use session.id (database UUID) to query notes
    const notes = await storage.listSessionNotes(session.id);
    return apiResponse.success(res, notes);
  } catch (error) {
    sessionLogger.error("Error listing notes:", error);
    return apiResponse.serverError(res, "Failed to list notes");
  }
});

router.post("/:sessionId/notes", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { messageIndex, content, parentId } = req.body;
    const user = req.user as any;

    if (!user?.id) {
      return apiResponse.unauthorized(res);
    }

    const session = await storage.getSessionBySessionId(sessionId);
    if (!session) {
      sessionLogger.debug("Session not found:", sessionId);
      return apiResponse.notFound(res, "Session");
    }

    if (typeof messageIndex !== "number" || !content) {
      return apiResponse.validationError(res, "messageIndex (number) and content (string) are required");
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

    sessionLogger.debug("Note created:", note.id);
    return apiResponse.success(res, note, 201);
  } catch (error) {
    sessionLogger.error("Error creating note:", error);
    return apiResponse.serverError(res, "Failed to create note");
  }
});

router.patch("/:sessionId/notes/:noteId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { sessionId, noteId } = req.params;
    const { content, status } = req.body;

    const session = await storage.getSessionBySessionId(sessionId);
    if (!session) {
      return apiResponse.notFound(res, "Session");
    }

    const note = await storage.getNote(noteId);
    if (!note) {
      return apiResponse.notFound(res, "Note");
    }

    if (note.sessionId !== sessionId) {
      return apiResponse.forbidden(res, "Note does not belong to this session");
    }

    const updates: any = {};
    if (content !== undefined) updates.content = content;
    if (status !== undefined) updates.status = status;

    const updatedNote = await storage.updateNote(noteId, updates);
    return apiResponse.success(res, updatedNote);
  } catch (error) {
    sessionLogger.error("Error updating note:", error);
    return apiResponse.serverError(res, "Failed to update note");
  }
});

router.delete("/:sessionId/notes/:noteId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { sessionId, noteId } = req.params;

    const session = await storage.getSessionBySessionId(sessionId);
    if (!session) {
      return apiResponse.notFound(res, "Session");
    }

    const note = await storage.getNote(noteId);
    if (!note) {
      return apiResponse.notFound(res, "Note");
    }

    if (note.sessionId !== sessionId) {
      return apiResponse.forbidden(res, "Note does not belong to this session");
    }

    await storage.deleteNoteWithReplies(noteId);
    return apiResponse.success(res, { deleted: true });
  } catch (error) {
    sessionLogger.error("Error deleting note:", error);
    return apiResponse.serverError(res, "Failed to delete note");
  }
});

export default router;
