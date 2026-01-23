import { objectStorageClient } from "../replit_integrations/object_storage/objectStorage";

const PUBLISHED_FLOWS_BUCKET = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const PUBLISHED_FLOWS_PREFIX = "published-flows";

export interface PublishedFlowData {
  id: string;
  journeyId: string;
  name: string;
  description: string;
  systemPrompt: string;
  voice: string | null;
  agents: any[];
  startingAgentId: string;
  version: string;
  publishedAt: string;
  publishedByUserId: string;
}

export class PublishedFlowStorageService {
  private getBucket() {
    if (!PUBLISHED_FLOWS_BUCKET) {
      throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
    }
    return objectStorageClient.bucket(PUBLISHED_FLOWS_BUCKET);
  }

  private getFlowPath(journeyId: string): string {
    return `${PUBLISHED_FLOWS_PREFIX}/${journeyId}.json`;
  }

  private getIndexPath(): string {
    return `${PUBLISHED_FLOWS_PREFIX}/index.json`;
  }

  async savePublishedFlow(flow: PublishedFlowData): Promise<void> {
    const bucket = this.getBucket();
    const file = bucket.file(this.getFlowPath(flow.journeyId));
    
    await file.save(JSON.stringify(flow, null, 2), {
      contentType: "application/json",
      metadata: {
        cacheControl: "no-cache",
      },
    });

    await this.updateIndex(flow.journeyId, flow.name, flow.description, flow.publishedAt);
  }

  async getPublishedFlow(journeyId: string): Promise<PublishedFlowData | null> {
    try {
      const bucket = this.getBucket();
      const file = bucket.file(this.getFlowPath(journeyId));
      
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [content] = await file.download();
      return JSON.parse(content.toString());
    } catch (error) {
      console.error("Error getting published flow:", error);
      return null;
    }
  }

  async deletePublishedFlow(journeyId: string): Promise<boolean> {
    try {
      const bucket = this.getBucket();
      const file = bucket.file(this.getFlowPath(journeyId));
      
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
      }

      await this.removeFromIndex(journeyId);
      return true;
    } catch (error) {
      console.error("Error deleting published flow:", error);
      return false;
    }
  }

  async listPublishedFlows(): Promise<{ journeyId: string; name: string; description: string; publishedAt: string }[]> {
    try {
      const bucket = this.getBucket();
      const indexFile = bucket.file(this.getIndexPath());
      
      const [exists] = await indexFile.exists();
      if (!exists) {
        return [];
      }

      const [content] = await indexFile.download();
      const index = JSON.parse(content.toString());
      return index.flows || [];
    } catch (error) {
      console.error("Error listing published flows:", error);
      return [];
    }
  }

  private async updateIndex(journeyId: string, name: string, description: string, publishedAt: string): Promise<void> {
    try {
      const bucket = this.getBucket();
      const indexFile = bucket.file(this.getIndexPath());
      
      let index: { flows: { journeyId: string; name: string; description: string; publishedAt: string }[] } = { flows: [] };
      
      const [exists] = await indexFile.exists();
      if (exists) {
        const [content] = await indexFile.download();
        index = JSON.parse(content.toString());
      }

      const existingIdx = index.flows.findIndex(f => f.journeyId === journeyId);
      const flowEntry = { journeyId, name, description, publishedAt };
      
      if (existingIdx >= 0) {
        index.flows[existingIdx] = flowEntry;
      } else {
        index.flows.push(flowEntry);
      }

      await indexFile.save(JSON.stringify(index, null, 2), {
        contentType: "application/json",
        metadata: {
          cacheControl: "no-cache",
        },
      });
    } catch (error) {
      console.error("Error updating index:", error);
    }
  }

  private async removeFromIndex(journeyId: string): Promise<void> {
    try {
      const bucket = this.getBucket();
      const indexFile = bucket.file(this.getIndexPath());
      
      const [exists] = await indexFile.exists();
      if (!exists) return;

      const [content] = await indexFile.download();
      const index = JSON.parse(content.toString());
      
      index.flows = (index.flows || []).filter((f: any) => f.journeyId !== journeyId);

      await indexFile.save(JSON.stringify(index, null, 2), {
        contentType: "application/json",
        metadata: {
          cacheControl: "no-cache",
        },
      });
    } catch (error) {
      console.error("Error removing from index:", error);
    }
  }
}

export const publishedFlowStorage = new PublishedFlowStorageService();
