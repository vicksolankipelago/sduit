import { Router } from "express";
import { isAuthenticated, isAdmin } from "../auth";
import { storage } from "../storage";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// List all global screens (all authenticated users can read)
router.get("/", isAuthenticated, async (req: any, res) => {
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

    res.json(screenList);
  } catch (error) {
    console.error("Error listing screens:", error);
    res.status(500).json({ message: "Failed to list screens" });
  }
});

// Get a single global screen
router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const screen = await storage.getGlobalScreen(req.params.id);

    if (!screen) {
      return res.status(404).json({ message: "Screen not found" });
    }

    res.json({
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
    console.error("Error loading screen:", error);
    res.status(500).json({ message: "Failed to load screen" });
  }
});

// Create a new global screen (admin only)
router.post("/", isAdmin, async (req: any, res) => {
  try {
    const userId = req.user.id;
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

    res.json({
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
    console.error("Error creating screen:", error);
    res.status(500).json({ message: "Failed to create screen" });
  }
});

// Update a global screen (admin only)
router.put("/:id", isAdmin, async (req: any, res) => {
  try {
    const screen = await storage.getGlobalScreen(req.params.id);

    if (!screen) {
      return res.status(404).json({ message: "Screen not found" });
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
      return res.status(500).json({ message: "Failed to update screen" });
    }

    res.json({
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
    console.error("Error updating screen:", error);
    res.status(500).json({ message: "Failed to update screen" });
  }
});

// Delete a global screen (admin only)
router.delete("/:id", isAdmin, async (req: any, res) => {
  try {
    const screen = await storage.getGlobalScreen(req.params.id);

    if (!screen) {
      return res.status(404).json({ message: "Screen not found" });
    }

    await storage.deleteGlobalScreen(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting screen:", error);
    res.status(500).json({ message: "Failed to delete screen" });
  }
});

// Duplicate a global screen (admin only)
router.post("/:id/duplicate", isAdmin, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const original = await storage.getGlobalScreen(req.params.id);

    if (!original) {
      return res.status(404).json({ message: "Screen not found" });
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

    res.json({
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
    });
  } catch (error) {
    console.error("Error duplicating screen:", error);
    res.status(500).json({ message: "Failed to duplicate screen" });
  }
});

export default router;
