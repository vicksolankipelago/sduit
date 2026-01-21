import { Router } from "express";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

const router = Router();

router.get("/:sessionId/notes", isAuthenticated, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await storage.getSessionBySessionId(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    const notes = await storage.listSessionNotes(sessionId);
    res.json(notes);
  } catch (error) {
    console.error("Error listing notes:", error);
    res.status(500).json({ message: "Failed to list notes" });
  }
});

router.post("/:sessionId/notes", isAuthenticated, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const { messageIndex, content, parentId } = req.body;
    const user = req.user;
    
    const session = await storage.getSessionBySessionId(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    if (typeof messageIndex !== "number" || !content) {
      return res.status(400).json({ message: "messageIndex and content are required" });
    }
    
    const note = await storage.createNote({
      sessionId,
      messageIndex,
      userId: user.id,
      userRole: user.role || "member",
      userName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
      content,
      status: "todo",
      parentId: parentId || null,
    });
    
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
