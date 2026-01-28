import { Router } from "express";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "../db";
import { previewCredentials } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "../auth";
import * as apiResponse from "../utils/response";

const router = Router();
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

function generateFriendlyUsername(): string {
  const suffix = randomBytes(6).toString("hex").slice(0, 6);
  return `preview_${suffix}`;
}

function generateSecurePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = randomBytes(16);
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

function getCredentialStatus(credential: {
  expiresAt: Date | null;
  revokedAt: Date | null;
}): "active" | "expired" | "revoked" {
  if (credential.revokedAt) {
    return "revoked";
  }
  if (credential.expiresAt && new Date() > credential.expiresAt) {
    return "expired";
  }
  return "active";
}

router.post("/", isAdmin, async (req, res) => {
  try {
    const { label, expiresAt } = req.body;
    const userId = req.user?.id;

    const username = generateFriendlyUsername();
    const plainPassword = generateSecurePassword();
    const passwordHash = await hashPassword(plainPassword);

    const [credential] = await db
      .insert(previewCredentials)
      .values({
        username,
        passwordHash,
        label: label || null,
        createdById: userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    res.status(201).json({
      id: credential.id,
      username: credential.username,
      password: plainPassword,
      label: credential.label,
      expiresAt: credential.expiresAt,
      createdAt: credential.createdAt,
    });
  } catch (error: any) {
    console.error("Error creating preview credential:", error);
    return apiResponse.serverError(res, "Failed to create preview credential");
  }
});

router.post("/bulk", isAdmin, async (req, res) => {
  try {
    const { count, labelPrefix, expiresAt } = req.body;
    const userId = req.user?.id;

    const numToCreate = Math.min(Math.max(1, parseInt(count) || 1), 500);
    const results: Array<{ username: string; password: string; label: string | null }> = [];

    for (let i = 0; i < numToCreate; i++) {
      const username = generateFriendlyUsername();
      const plainPassword = generateSecurePassword();
      const passwordHash = await hashPassword(plainPassword);
      const label = labelPrefix ? `${labelPrefix} ${i + 1}` : null;

      await db.insert(previewCredentials).values({
        username,
        passwordHash,
        label,
        createdById: userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      results.push({ username, password: plainPassword, label });
    }

    res.status(201).json({
      count: results.length,
      credentials: results,
    });
  } catch (error: any) {
    console.error("Error bulk creating preview credentials:", error);
    return apiResponse.serverError(res, "Failed to create preview credentials");
  }
});

router.get("/", isAdmin, async (req, res) => {
  try {
    const credentials = await db.select().from(previewCredentials);

    const result = credentials.map((cred) => ({
      id: cred.id,
      username: cred.username,
      label: cred.label,
      createdById: cred.createdById,
      createdAt: cred.createdAt,
      expiresAt: cred.expiresAt,
      revokedAt: cred.revokedAt,
      lastUsedAt: cred.lastUsedAt,
      status: getCredentialStatus(cred),
    }));

    res.json(result);
  } catch (error: any) {
    console.error("Error listing preview credentials:", error);
    return apiResponse.serverError(res, "Failed to list preview credentials");
  }
});

router.patch("/:id/revoke", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [credential] = await db
      .update(previewCredentials)
      .set({ revokedAt: new Date() })
      .where(eq(previewCredentials.id, id))
      .returning();

    if (!credential) {
      return apiResponse.notFound(res, "Preview credential not found");
    }

    res.json({
      id: credential.id,
      username: credential.username,
      label: credential.label,
      revokedAt: credential.revokedAt,
      status: "revoked",
    });
  } catch (error: any) {
    console.error("Error revoking preview credential:", error);
    return apiResponse.serverError(res, "Failed to revoke preview credential");
  }
});

router.delete("/:id", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .delete(previewCredentials)
      .where(eq(previewCredentials.id, id))
      .returning();

    if (!deleted) {
      return apiResponse.notFound(res, "Preview credential not found");
    }

    res.json({ message: "Preview credential deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting preview credential:", error);
    return apiResponse.serverError(res, "Failed to delete preview credential");
  }
});

export default router;
