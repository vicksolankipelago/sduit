import { Router, Request, Response } from 'express';
import { objectStorageClient } from '../replit_integrations/object_storage';

const router = Router();

interface ChunkInfo {
  index: number;
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
}

interface RecordingManifest {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  chunks: ChunkInfo[];
  status: 'recording' | 'completed';
  totalDuration: number;
  metadata: {
    format: string;
    chunkDuration: number;
    [key: string]: any;
  };
}

function getBucketName(): string {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');
  }
  return bucketId;
}

async function getManifest(sessionId: string): Promise<RecordingManifest | null> {
  try {
    const bucket = objectStorageClient.bucket(getBucketName());
    const file = bucket.file(`recordings/${sessionId}/manifest.json`);
    const [exists] = await file.exists();
    
    if (!exists) {
      return null;
    }
    
    const [contents] = await file.download();
    return JSON.parse(contents.toString());
  } catch (error) {
    console.error(`Failed to get manifest for ${sessionId}:`, error);
    return null;
  }
}

async function saveManifest(sessionId: string, manifest: RecordingManifest): Promise<void> {
  const bucket = objectStorageClient.bucket(getBucketName());
  const file = bucket.file(`recordings/${sessionId}/manifest.json`);
  await file.save(JSON.stringify(manifest, null, 2), {
    contentType: 'application/json',
  });
}

router.post('/start', async (req: Request, res: Response) => {
  try {
    const { metadata = {}, sessionId: providedSessionId } = req.body;
    const sessionId = providedSessionId || `rec_${Date.now()}`;

    console.log(`🎙️ Starting recording session: ${sessionId} (provided: ${providedSessionId || 'none'})`);

    const manifest: RecordingManifest = {
      sessionId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      chunks: [],
      status: 'recording',
      totalDuration: 0,
      metadata: {
        ...metadata,
        format: 'audio/webm;codecs=opus',
        chunkDuration: 5000,
      }
    };

    await saveManifest(sessionId, manifest);
    console.log(`🎙️ Recording session started: ${sessionId}`);

    res.json({ sessionId, status: 'started' });
  } catch (error) {
    console.error('Failed to start recording:', error);
    res.status(500).json({ error: 'Failed to start recording session', details: String(error) });
  }
});

router.post('/chunk', async (req: Request, res: Response) => {
  try {
    const { sessionId, chunkIndex, audioData } = req.body;

    if (!sessionId || chunkIndex === undefined) {
      return res.status(400).json({ error: 'sessionId and chunkIndex are required' });
    }

    let audioBuffer: Buffer;
    
    // Handle both file upload and base64 JSON formats
    const files = (req as any).files;
    if (files?.audio) {
      audioBuffer = files.audio.data;
    } else if (audioData) {
      // Base64 encoded audio data from JSON body
      audioBuffer = Buffer.from(audioData, 'base64');
    } else {
      return res.status(400).json({ error: 'No audio data provided (expected audioData in JSON or audio file)' });
    }

    console.log(`🎙️ Uploading chunk ${chunkIndex} for session ${sessionId} (${audioBuffer.length} bytes)`);

    const chunkName = `chunk-${String(chunkIndex).padStart(4, '0')}.webm`;
    const chunkPath = `recordings/${sessionId}/${chunkName}`;

    const bucket = objectStorageClient.bucket(getBucketName());
    const storageFile = bucket.file(chunkPath);
    await storageFile.save(audioBuffer, {
      contentType: 'audio/webm',
    });

    const manifest = await getManifest(sessionId);
    if (manifest) {
      manifest.chunks.push({
        index: chunkIndex,
        name: chunkName,
        path: chunkPath,
        size: audioBuffer.length,
        uploadedAt: new Date().toISOString()
      });
      manifest.totalDuration = manifest.chunks.length * (manifest.metadata.chunkDuration / 1000);
      await saveManifest(sessionId, manifest);
    }

    res.json({ success: true, chunkIndex, size: audioBuffer.length });
  } catch (error) {
    console.error('Failed to upload chunk:', error);
    res.status(500).json({ error: 'Failed to upload chunk', details: String(error) });
  }
});

router.post('/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    console.log(`🎙️ Ending recording session: ${sessionId}`);

    const manifest = await getManifest(sessionId);
    if (!manifest) {
      return res.status(404).json({ error: 'Recording session not found' });
    }

    manifest.status = 'completed';
    manifest.endedAt = new Date().toISOString();
    await saveManifest(sessionId, manifest);

    console.log(`🎙️ Recording session ended: ${sessionId} (${manifest.chunks.length} chunks)`);

    res.json({
      success: true,
      sessionId,
      totalChunks: manifest.chunks.length,
      totalDuration: manifest.totalDuration
    });
  } catch (error) {
    console.error('Failed to end recording:', error);
    res.status(500).json({ error: 'Failed to end recording session', details: String(error) });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const bucket = objectStorageClient.bucket(getBucketName());
    const [files] = await bucket.getFiles({ prefix: 'recordings/' });
    
    const sessions = new Set<string>();
    for (const file of files) {
      const match = file.name.match(/^recordings\/([^/]+)\//);
      if (match) {
        sessions.add(match[1]);
      }
    }

    const recordings: RecordingManifest[] = [];
    for (const sessionId of Array.from(sessions).slice(0, 50)) {
      const manifest = await getManifest(sessionId);
      if (manifest) {
        recordings.push(manifest);
      }
    }

    recordings.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    res.json({ recordings });
  } catch (error) {
    console.error('Failed to list recordings:', error);
    res.status(500).json({ error: 'Failed to list recordings', details: String(error) });
  }
});

router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    console.log(`🎧 Getting recording info for session: ${sessionId}`);

    const manifest = await getManifest(sessionId);
    if (!manifest) {
      console.log(`🎧 Recording not found for session: ${sessionId}`);
      return res.status(404).json({ error: 'Recording not found' });
    }

    console.log(`🎧 Found recording for session ${sessionId}: ${manifest.chunks.length} chunks`);
    res.json({ recording: manifest });
  } catch (error) {
    console.error('Failed to get recording:', error);
    res.status(500).json({ error: 'Failed to get recording', details: String(error) });
  }
});

router.get('/:sessionId/audio', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    console.log(`🎧 Streaming audio for session: ${sessionId}`);

    const manifest = await getManifest(sessionId);
    if (!manifest || manifest.chunks.length === 0) {
      return res.status(404).json({ error: 'No audio available' });
    }

    res.setHeader('Content-Type', 'audio/webm');
    res.setHeader('Accept-Ranges', 'bytes');

    const bucket = objectStorageClient.bucket(getBucketName());
    
    for (const chunk of manifest.chunks.sort((a, b) => a.index - b.index)) {
      const file = bucket.file(chunk.path);
      const [contents] = await file.download();
      res.write(contents);
    }

    res.end();
  } catch (error) {
    console.error('Failed to stream audio:', error);
    res.status(500).json({ error: 'Failed to stream audio', details: String(error) });
  }
});

router.get('/:sessionId/chunks/:chunkIndex', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const chunkIndex = req.params.chunkIndex as string;
    const chunkName = `chunk-${String(parseInt(chunkIndex)).padStart(4, '0')}.webm`;
    const chunkPath = `recordings/${sessionId}/${chunkName}`;

    const bucket = objectStorageClient.bucket(getBucketName());
    const file = bucket.file(chunkPath);
    const [exists] = await file.exists();
    
    if (!exists) {
      return res.status(404).json({ error: 'Chunk not found' });
    }

    const [contents] = await file.download();
    res.setHeader('Content-Type', 'audio/webm');
    res.send(contents);
  } catch (error) {
    console.error('Failed to get chunk:', error);
    res.status(500).json({ error: 'Failed to get chunk', details: String(error) });
  }
});

router.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;

    const manifest = await getManifest(sessionId);
    if (!manifest) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    const bucket = objectStorageClient.bucket(getBucketName());

    for (const chunk of manifest.chunks) {
      try {
        await bucket.file(chunk.path).delete();
      } catch (err) {
        console.error(`Failed to delete chunk ${chunk.path}:`, err);
      }
    }

    await bucket.file(`recordings/${sessionId}/manifest.json`).delete();

    console.log(`🎙️ Deleted recording session: ${sessionId}`);
    res.json({ deleted: true, sessionId });
  } catch (error) {
    console.error('Failed to delete recording:', error);
    res.status(500).json({ error: 'Failed to delete recording', details: String(error) });
  }
});

export default router;
