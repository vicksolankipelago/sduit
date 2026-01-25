import { Router, Request, Response } from "express";
import { isAuthenticated, isAdmin } from "../auth";
import { storage } from "../storage";
import { v4 as uuidv4 } from "uuid";
import { screenLogger } from "../utils/logger";
import * as apiResponse from "../utils/response";

const router = Router();

// List all global screens (all authenticated users can read)
router.get("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const screens = await storage.listGlobalScreens();

    const screenList = screens.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description || "",
      tags: s.tags || [],
      sectionCount: Array.isArray(s.sections) ? (s.sections as any[]).length : 0,
      elementCount: Array.isArray(s.sections)
        ? (s.sections as any[]).reduce((acc, section) => acc + (section.elements?.length || 0), 0)
        : 0,
      updatedAt: s.updatedAt,
    }));

    return apiResponse.success(res, screenList);
  } catch (error) {
    screenLogger.error("Error listing screens:", error);
    return apiResponse.serverError(res, "Failed to list screens");
  }
});

// Get a single global screen
router.get("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const screen = await storage.getGlobalScreen(req.params.id);

    if (!screen) {
      return apiResponse.notFound(res, "Screen");
    }

    return apiResponse.success(res, {
      id: screen.id,
      title: screen.title,
      description: screen.description || "",
      tags: screen.tags || [],
      sections: screen.sections,
      events: screen.events || [],
      state: screen.state || {},
      hidesBackButton: screen.hidesBackButton,
      version: screen.version,
      createdAt: screen.createdAt,
      updatedAt: screen.updatedAt,
    });
  } catch (error) {
    screenLogger.error("Error loading screen:", error);
    return apiResponse.serverError(res, "Failed to load screen");
  }
});

// Create a new global screen (admin only)
router.post("/", isAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const { title, description, tags, sections, events, state, hidesBackButton, version } = req.body;

    const screen = await storage.createGlobalScreen({
      id: uuidv4(),
      title: title || "New Screen",
      description: description || "",
      tags: tags || [],
      sections: sections || [],
      events: events || [],
      state: state || {},
      hidesBackButton: hidesBackButton || false,
      version: version || "1.0.0",
      createdBy: userId,
    });

    return apiResponse.success(res, {
      id: screen.id,
      title: screen.title,
      description: screen.description || "",
      tags: screen.tags || [],
      sections: screen.sections,
      events: screen.events || [],
      state: screen.state || {},
      hidesBackButton: screen.hidesBackButton,
      version: screen.version,
      createdAt: screen.createdAt,
      updatedAt: screen.updatedAt,
    }, 201);
  } catch (error) {
    screenLogger.error("Error creating screen:", error);
    return apiResponse.serverError(res, "Failed to create screen");
  }
});

// Update a global screen (admin only)
router.put("/:id", isAdmin, async (req: Request, res: Response) => {
  try {
    const screen = await storage.getGlobalScreen(req.params.id);

    if (!screen) {
      return apiResponse.notFound(res, "Screen");
    }

    const { title, description, tags, sections, events, state, hidesBackButton, version } = req.body;

    const updated = await storage.updateGlobalScreen(req.params.id, {
      title,
      description,
      tags,
      sections,
      events,
      state,
      hidesBackButton,
      version,
    });

    if (!updated) {
      return apiResponse.serverError(res, "Failed to update screen");
    }

    return apiResponse.success(res, {
      id: updated.id,
      title: updated.title,
      description: updated.description || "",
      tags: updated.tags || [],
      sections: updated.sections,
      events: updated.events || [],
      state: updated.state || {},
      hidesBackButton: updated.hidesBackButton,
      version: updated.version,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    screenLogger.error("Error updating screen:", error);
    return apiResponse.serverError(res, "Failed to update screen");
  }
});

// Delete a global screen (admin only)
router.delete("/:id", isAdmin, async (req: Request, res: Response) => {
  try {
    const screen = await storage.getGlobalScreen(req.params.id);

    if (!screen) {
      return apiResponse.notFound(res, "Screen");
    }

    await storage.deleteGlobalScreen(req.params.id);
    return apiResponse.success(res, { deleted: true });
  } catch (error) {
    screenLogger.error("Error deleting screen:", error);
    return apiResponse.serverError(res, "Failed to delete screen");
  }
});

// Duplicate a global screen (admin only)
router.post("/:id/duplicate", isAdmin, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res);
    }

    const original = await storage.getGlobalScreen(req.params.id);

    if (!original) {
      return apiResponse.notFound(res, "Screen");
    }

    const duplicate = await storage.createGlobalScreen({
      id: uuidv4(),
      title: `${original.title} (Copy)`,
      description: original.description,
      tags: original.tags,
      sections: original.sections,
      events: original.events,
      state: original.state,
      hidesBackButton: original.hidesBackButton,
      version: original.version,
      createdBy: userId,
    });

    return apiResponse.success(res, {
      id: duplicate.id,
      title: duplicate.title,
      description: duplicate.description || "",
      tags: duplicate.tags || [],
      sections: duplicate.sections,
      events: duplicate.events || [],
      state: duplicate.state || {},
      hidesBackButton: duplicate.hidesBackButton,
      version: duplicate.version,
      createdAt: duplicate.createdAt,
      updatedAt: duplicate.updatedAt,
    }, 201);
  } catch (error) {
    screenLogger.error("Error duplicating screen:", error);
    return apiResponse.serverError(res, "Failed to duplicate screen");
  }
});

export default router;
