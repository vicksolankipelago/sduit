/**
 * Recording Storage Service
 * Handles streaming audio recording uploads to Replit Object Storage
 */

import { Client } from '@replit/object-storage';

class RecordingStorageService {
  constructor() {
    this.client = new Client();
  }

  /**
   * Start a new recording session
   * Creates a manifest file to track chunks
   */
  async startSession(sessionId, metadata = {}) {
    const manifest = {
      sessionId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      chunks: [],
      status: 'recording',
      totalDuration: 0,
      metadata: {
        ...metadata,
        format: 'audio/webm;codecs=opus',
        chunkDuration: 5000, // 5 seconds per chunk
      }
    };

    const manifestPath = `recordings/${sessionId}/manifest.json`;
    const { ok, error } = await this.client.uploadFromText(
      manifestPath,
      JSON.stringify(manifest, null, 2)
    );

    if (!ok) {
      throw new Error(`Failed to create recording session: ${error}`);
    }

    console.log(`[RecordingStorage] Started session: ${sessionId}`);
    return { sessionId, manifestPath };
  }

  /**
   * Upload a single audio chunk
   */
  async uploadChunk(sessionId, chunkIndex, buffer) {
    const chunkName = `chunk-${String(chunkIndex).padStart(4, '0')}.webm`;
    const chunkPath = `recordings/${sessionId}/${chunkName}`;

    const { ok, error } = await this.client.uploadFromBytes(chunkPath, buffer);

    if (!ok) {
      throw new Error(`Failed to upload chunk ${chunkIndex}: ${error}`);
    }

    // Update manifest with new chunk
    await this.addChunkToManifest(sessionId, {
      index: chunkIndex,
      name: chunkName,
      path: chunkPath,
      size: buffer.length,
      uploadedAt: new Date().toISOString()
    });

    console.log(`[RecordingStorage] Uploaded chunk ${chunkIndex} for session ${sessionId} (${buffer.length} bytes)`);
    return { chunkPath, chunkIndex, size: buffer.length };
  }

  /**
   * Add chunk info to the session manifest
   */
  async addChunkToManifest(sessionId, chunkInfo) {
    const manifestPath = `recordings/${sessionId}/manifest.json`;

    // Download current manifest
    const { ok: downloadOk, value, error: downloadError } = await this.client.downloadAsText(manifestPath);

    if (!downloadOk) {
      throw new Error(`Failed to download manifest: ${downloadError}`);
    }

    const manifest = JSON.parse(value);
    manifest.chunks.push(chunkInfo);
    manifest.totalDuration = manifest.chunks.length * (manifest.metadata.chunkDuration / 1000);

    // Upload updated manifest
    const { ok: uploadOk, error: uploadError } = await this.client.uploadFromText(
      manifestPath,
      JSON.stringify(manifest, null, 2)
    );

    if (!uploadOk) {
      throw new Error(`Failed to update manifest: ${uploadError}`);
    }
  }

  /**
   * End a recording session
   */
  async endSession(sessionId) {
    const manifestPath = `recordings/${sessionId}/manifest.json`;

    // Download current manifest
    const { ok: downloadOk, value, error: downloadError } = await this.client.downloadAsText(manifestPath);

    if (!downloadOk) {
      throw new Error(`Failed to download manifest: ${downloadError}`);
    }

    const manifest = JSON.parse(value);
    manifest.status = 'completed';
    manifest.endedAt = new Date().toISOString();

    // Upload final manifest
    const { ok: uploadOk, error: uploadError } = await this.client.uploadFromText(
      manifestPath,
      JSON.stringify(manifest, null, 2)
    );

    if (!uploadOk) {
      throw new Error(`Failed to finalize manifest: ${uploadError}`);
    }

    console.log(`[RecordingStorage] Ended session: ${sessionId} (${manifest.chunks.length} chunks, ${manifest.totalDuration}s)`);
    return manifest;
  }

  /**
   * Get recording session info
   */
  async getSession(sessionId) {
    const manifestPath = `recordings/${sessionId}/manifest.json`;

    const { ok, value, error } = await this.client.downloadAsText(manifestPath);

    if (!ok) {
      if (error?.includes('not found') || error?.includes('NoSuchKey')) {
        return null;
      }
      throw new Error(`Failed to get session: ${error}`);
    }

    return JSON.parse(value);
  }

  /**
   * Download a specific chunk
   */
  async downloadChunk(sessionId, chunkIndex) {
    const chunkName = `chunk-${String(chunkIndex).padStart(4, '0')}.webm`;
    const chunkPath = `recordings/${sessionId}/${chunkName}`;

    const { ok, value, error } = await this.client.downloadAsBytes(chunkPath);

    if (!ok) {
      throw new Error(`Failed to download chunk: ${error}`);
    }

    return value;
  }

  /**
   * List all recordings
   */
  async listRecordings(limit = 50) {
    const { ok, value, error } = await this.client.list('recordings/');

    if (!ok) {
      throw new Error(`Failed to list recordings: ${error}`);
    }

    // Extract unique session IDs from paths
    const sessions = new Set();
    for (const obj of value.objects || []) {
      const match = obj.name.match(/^recordings\/([^/]+)\//);
      if (match) {
        sessions.add(match[1]);
      }
    }

    // Get manifest for each session
    const recordings = [];
    for (const sessionId of Array.from(sessions).slice(0, limit)) {
      try {
        const manifest = await this.getSession(sessionId);
        if (manifest) {
          recordings.push(manifest);
        }
      } catch (err) {
        console.error(`Failed to get manifest for ${sessionId}:`, err);
      }
    }

    return recordings.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /**
   * Delete a recording session and all its chunks
   */
  async deleteSession(sessionId) {
    const manifest = await this.getSession(sessionId);
    if (!manifest) {
      throw new Error('Session not found');
    }

    // Delete all chunks
    for (const chunk of manifest.chunks) {
      try {
        await this.client.delete(chunk.path);
      } catch (err) {
        console.error(`Failed to delete chunk ${chunk.path}:`, err);
      }
    }

    // Delete manifest
    await this.client.delete(`recordings/${sessionId}/manifest.json`);

    console.log(`[RecordingStorage] Deleted session: ${sessionId}`);
    return { deleted: true, sessionId };
  }
}

// Export singleton instance
export const recordingStorage = new RecordingStorageService();
export { RecordingStorageService };
