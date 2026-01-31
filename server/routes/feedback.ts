import { Router, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { feedback, voiceSessions } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { feedbackLogger } from "../utils/logger";
import * as apiResponse from "../utils/response";

const router = Router();

router.post("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const { 
      voiceSessionId, 
      rating, 
      conversationNaturalness,
      informationHelpfulness,
      wouldDownloadApp,
      likedMost,
      improvements,
      comment 
    } = req.body;

    if (!voiceSessionId) {
      return apiResponse.validationError(res, "voiceSessionId is required");
    }
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return apiResponse.validationError(res, "rating must be a number between 1 and 5");
    }
    
    // Validate optional rating fields (1-5 scale)
    if (conversationNaturalness !== undefined && conversationNaturalness !== null) {
      if (typeof conversationNaturalness !== "number" || conversationNaturalness < 1 || conversationNaturalness > 5) {
        return apiResponse.validationError(res, "conversationNaturalness must be a number between 1 and 5");
      }
    }
    if (informationHelpfulness !== undefined && informationHelpfulness !== null) {
      if (typeof informationHelpfulness !== "number" || informationHelpfulness < 1 || informationHelpfulness > 5) {
        return apiResponse.validationError(res, "informationHelpfulness must be a number between 1 and 5");
      }
    }
    
    // Validate wouldDownloadApp enum
    const validDownloadOptions = ['yes', 'maybe', 'no'];
    if (wouldDownloadApp !== undefined && wouldDownloadApp !== null) {
      if (!validDownloadOptions.includes(wouldDownloadApp)) {
        return apiResponse.validationError(res, "wouldDownloadApp must be 'yes', 'maybe', or 'no'");
      }
    }

    // Look up by sessionId field (client session ID) or database id
    let session;
    [session] = await db
      .select()
      .from(voiceSessions)
      .where(eq(voiceSessions.sessionId, voiceSessionId))
      .limit(1);

    // Fallback to database ID lookup
    if (!session) {
      [session] = await db
        .select()
        .from(voiceSessions)
        .where(eq(voiceSessions.id, voiceSessionId))
        .limit(1);
    }

    if (!session) {
      return apiResponse.notFound(res, "Voice session");
    }

    if (session.userId !== userId) {
      return apiResponse.forbidden(res, "You can only submit feedback for your own sessions");
    }

    // Use database ID for the foreign key
    const [newFeedback] = await db
      .insert(feedback)
      .values({
        userId,
        voiceSessionId: session.id,
        rating,
        conversationNaturalness: conversationNaturalness || null,
        informationHelpfulness: informationHelpfulness || null,
        wouldDownloadApp: wouldDownloadApp || null,
        likedMost: likedMost?.trim() || null,
        improvements: improvements?.trim() || null,
        comment: comment?.trim() || null,
      })
      .returning();

    return apiResponse.success(res, newFeedback, 201);
  } catch (error) {
    feedbackLogger.error("Error creating feedback:", error);
    return apiResponse.serverError(res, "Failed to save feedback");
  }
});

router.get("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const isAdmin = (req.user as any)?.role === 'admin';

    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    let feedbackList;
    if (isAdmin) {
      feedbackList = await db
        .select({
          id: feedback.id,
          rating: feedback.rating,
          conversationNaturalness: feedback.conversationNaturalness,
          informationHelpfulness: feedback.informationHelpfulness,
          wouldDownloadApp: feedback.wouldDownloadApp,
          likedMost: feedback.likedMost,
          improvements: feedback.improvements,
          comment: feedback.comment,
          createdAt: feedback.createdAt,
          voiceSessionId: feedback.voiceSessionId,
          userId: feedback.userId,
          journeyName: voiceSessions.journeyName,
          agentName: voiceSessions.agentName,
        })
        .from(feedback)
        .leftJoin(voiceSessions, eq(feedback.voiceSessionId, voiceSessions.id))
        .orderBy(desc(feedback.createdAt));
    } else {
      feedbackList = await db
        .select({
          id: feedback.id,
          rating: feedback.rating,
          conversationNaturalness: feedback.conversationNaturalness,
          informationHelpfulness: feedback.informationHelpfulness,
          wouldDownloadApp: feedback.wouldDownloadApp,
          likedMost: feedback.likedMost,
          improvements: feedback.improvements,
          comment: feedback.comment,
          createdAt: feedback.createdAt,
          voiceSessionId: feedback.voiceSessionId,
          journeyName: voiceSessions.journeyName,
          agentName: voiceSessions.agentName,
        })
        .from(feedback)
        .leftJoin(voiceSessions, eq(feedback.voiceSessionId, voiceSessions.id))
        .where(eq(feedback.userId, userId))
        .orderBy(desc(feedback.createdAt));
    }

    return apiResponse.success(res, feedbackList);
  } catch (error) {
    feedbackLogger.error("Error fetching feedback:", error);
    return apiResponse.serverError(res, "Failed to fetch feedback");
  }
});

router.get("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const isAdmin = (req.user as any)?.role === 'admin';

    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const feedbackId = req.params.id as string;
    const [fb] = await db
      .select({
        id: feedback.id,
        rating: feedback.rating,
        conversationNaturalness: feedback.conversationNaturalness,
        informationHelpfulness: feedback.informationHelpfulness,
        wouldDownloadApp: feedback.wouldDownloadApp,
        likedMost: feedback.likedMost,
        improvements: feedback.improvements,
        comment: feedback.comment,
        createdAt: feedback.createdAt,
        voiceSessionId: feedback.voiceSessionId,
        userId: feedback.userId,
        journeyName: voiceSessions.journeyName,
        agentName: voiceSessions.agentName,
        transcript: voiceSessions.transcript,
      })
      .from(feedback)
      .leftJoin(voiceSessions, eq(feedback.voiceSessionId, voiceSessions.id))
      .where(eq(feedback.id, feedbackId))
      .limit(1);

    if (!fb) {
      return apiResponse.notFound(res, "Feedback");
    }

    if (!isAdmin && fb.userId !== userId) {
      return apiResponse.forbidden(res);
    }

    return apiResponse.success(res, fb);
  } catch (error) {
    feedbackLogger.error("Error fetching feedback:", error);
    return apiResponse.serverError(res, "Failed to fetch feedback");
  }
});

export default router;
