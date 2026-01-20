import { Router } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { feedback, voiceSessions } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { voiceSessionId, rating, comment } = req.body;

    if (!voiceSessionId || !rating) {
      return res.status(400).json({ message: "voiceSessionId and rating are required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const [session] = await db
      .select()
      .from(voiceSessions)
      .where(eq(voiceSessions.id, voiceSessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ message: "Voice session not found" });
    }

    const [newFeedback] = await db
      .insert(feedback)
      .values({
        userId,
        voiceSessionId,
        rating,
        comment: comment || null,
      })
      .returning();

    res.status(201).json(newFeedback);
  } catch (error) {
    console.error("Error creating feedback:", error);
    res.status(500).json({ message: "Failed to save feedback" });
  }
});

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let feedbackList;
    if (isAdmin) {
      feedbackList = await db
        .select({
          id: feedback.id,
          rating: feedback.rating,
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

    res.json(feedbackList);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
});

router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const [fb] = await db
      .select({
        id: feedback.id,
        rating: feedback.rating,
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
      .where(eq(feedback.id, req.params.id))
      .limit(1);

    if (!fb) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    if (!isAdmin && fb.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(fb);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
});

export default router;
