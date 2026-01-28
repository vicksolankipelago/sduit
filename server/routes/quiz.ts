import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { storage } from "../storage";
import * as apiResponse from "../utils/response";

const router = Router();

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const { journeyId, journeyName, metadata } = req.body;

    const sessionId = `quiz_${uuidv4()}`;
    const session = await storage.createQuizSession({
      sessionId,
      journeyId: journeyId || null,
      journeyName: journeyName || null,
      answers: {},
      state: {},
      metadata: metadata || {},
    });

    return apiResponse.success(res, {
      sessionId: session.sessionId,
      id: session.id,
      journeyName: session.journeyName,
      createdAt: session.createdAt,
    }, 201);
  } catch (error) {
    console.error("Error creating quiz session:", error);
    return apiResponse.serverError(res, "Failed to create quiz session");
  }
});

router.get("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const session = await storage.getQuizSession(req.params.sessionId);

    if (!session) {
      return apiResponse.notFound(res, "Quiz session");
    }

    return apiResponse.success(res, {
      sessionId: session.sessionId,
      id: session.id,
      journeyId: session.journeyId,
      journeyName: session.journeyName,
      answers: session.answers,
      state: session.state,
      currentAgentId: session.currentAgentId,
      currentScreenId: session.currentScreenId,
      isCompleted: session.isCompleted,
      completedAt: session.completedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error("Error getting quiz session:", error);
    return apiResponse.serverError(res, "Failed to get quiz session");
  }
});

router.post("/sessions/:sessionId/answers", async (req: Request, res: Response) => {
  try {
    const { questionId, questionText, answer, answerValue, agentId, screenId } = req.body;

    if (!questionId || answer === undefined) {
      return apiResponse.validationError(res, "questionId and answer are required");
    }

    const session = await storage.getQuizSession(req.params.sessionId);
    if (!session) {
      return apiResponse.notFound(res, "Quiz session");
    }

    const existingAnswers = (session.answers as Record<string, any>) || {};
    const updatedAnswers = {
      ...existingAnswers,
      [questionId]: {
        questionId,
        questionText: questionText || "",
        answer,
        answerValue: answerValue !== undefined ? answerValue : answer,
        agentId: agentId || session.currentAgentId,
        screenId: screenId || session.currentScreenId,
        answeredAt: new Date().toISOString(),
      },
    };

    const updated = await storage.updateQuizSession(req.params.sessionId, {
      answers: updatedAnswers,
      currentAgentId: agentId || session.currentAgentId,
      currentScreenId: screenId || session.currentScreenId,
    });

    if (!updated) {
      return apiResponse.serverError(res, "Failed to store answer");
    }

    return apiResponse.success(res, {
      success: true,
      questionId,
      answer,
      totalAnswers: Object.keys(updatedAnswers).length,
    });
  } catch (error) {
    console.error("Error storing quiz answer:", error);
    return apiResponse.serverError(res, "Failed to store answer");
  }
});

router.post("/sessions/:sessionId/navigate", async (req: Request, res: Response) => {
  try {
    const { agentId, screenId } = req.body;

    const session = await storage.getQuizSession(req.params.sessionId);
    if (!session) {
      return apiResponse.notFound(res, "Quiz session");
    }

    const updated = await storage.updateQuizSession(req.params.sessionId, {
      currentAgentId: agentId || session.currentAgentId,
      currentScreenId: screenId || session.currentScreenId,
    });

    if (!updated) {
      return apiResponse.serverError(res, "Failed to update navigation");
    }

    return apiResponse.success(res, {
      success: true,
      currentAgentId: updated.currentAgentId,
      currentScreenId: updated.currentScreenId,
    });
  } catch (error) {
    console.error("Error updating navigation:", error);
    return apiResponse.serverError(res, "Failed to update navigation");
  }
});

router.post("/sessions/:sessionId/complete", async (req: Request, res: Response) => {
  try {
    const { metadata } = req.body;

    const session = await storage.getQuizSession(req.params.sessionId);
    if (!session) {
      return apiResponse.notFound(res, "Quiz session");
    }

    const existingMetadata = (session.metadata as Record<string, any>) || {};
    const updatedMetadata = {
      ...existingMetadata,
      ...(metadata || {}),
      completionTime: new Date().toISOString(),
    };

    const updated = await storage.updateQuizSession(req.params.sessionId, {
      isCompleted: true,
      completedAt: new Date(),
      metadata: updatedMetadata,
    });

    if (!updated) {
      return apiResponse.serverError(res, "Failed to complete quiz");
    }

    const answers = (updated.answers as Record<string, any>) || {};

    return apiResponse.success(res, {
      success: true,
      sessionId: updated.sessionId,
      isCompleted: true,
      completedAt: updated.completedAt,
      totalAnswers: Object.keys(answers).length,
      answers: answers,
    });
  } catch (error) {
    console.error("Error completing quiz:", error);
    return apiResponse.serverError(res, "Failed to complete quiz");
  }
});

router.patch("/sessions/:sessionId/state", async (req: Request, res: Response) => {
  try {
    const { state } = req.body;

    if (!state || typeof state !== "object") {
      return apiResponse.validationError(res, "state must be an object");
    }

    const session = await storage.getQuizSession(req.params.sessionId);
    if (!session) {
      return apiResponse.notFound(res, "Quiz session");
    }

    const existingState = (session.state as Record<string, any>) || {};
    const updatedState = {
      ...existingState,
      ...state,
    };

    const updated = await storage.updateQuizSession(req.params.sessionId, {
      state: updatedState,
    });

    if (!updated) {
      return apiResponse.serverError(res, "Failed to update state");
    }

    return apiResponse.success(res, {
      success: true,
      state: updated.state,
    });
  } catch (error) {
    console.error("Error updating quiz state:", error);
    return apiResponse.serverError(res, "Failed to update state");
  }
});

export default router;
