import { Response } from 'express';

// SSE Event types for generation progress
export interface SSEEvent {
  type:
    | 'connected'
    | 'breakdown_start'
    | 'breakdown_complete'
    | 'lesson_start'
    | 'lesson_content_complete'
    | 'lesson_podcast_complete'
    | 'lesson_complete'
    | 'lesson_error'
    | 'generation_complete'
    | 'generation_error'
    | 'heartbeat';
  data: Record<string, unknown>;
  timestamp: string;
}

export interface SSEConnection {
  res: Response;
  topicId: number;
  connectedAt: Date;
  lastEventAt: Date;
}

class SSEManager {
  private connections: Map<string, SSEConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Generate a unique connection ID
   */
  private generateConnectionId(topicId: number): string {
    return `${topicId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a new SSE connection
   */
  addConnection(topicId: number, res: Response): string {
    const connectionId = this.generateConnectionId(topicId);

    const connection: SSEConnection = {
      res,
      topicId,
      connectedAt: new Date(),
      lastEventAt: new Date(),
    };

    this.connections.set(connectionId, connection);

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send initial connection event
    this.sendToConnection(connectionId, {
      type: 'connected',
      data: { connectionId, topicId },
      timestamp: new Date().toISOString(),
    });

    console.log(`[SSE] Connection added: ${connectionId} for topic ${topicId}`);

    return connectionId;
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      console.log(`[SSE] Connection removed: ${connectionId}`);
    }
  }

  /**
   * Send an event to a specific connection
   */
  private sendToConnection(connectionId: string, event: SSEEvent): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
      connection.res.write(eventData);
      connection.lastEventAt = new Date();
      return true;
    } catch (error) {
      console.error(`[SSE] Failed to send event to ${connectionId}:`, error);
      this.removeConnection(connectionId);
      return false;
    }
  }

  /**
   * Send an event to all connections for a topic
   */
  sendToTopic(topicId: number, event: Omit<SSEEvent, 'timestamp'>): void {
    const fullEvent: SSEEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    for (const [connectionId, connection] of this.connections) {
      if (connection.topicId === topicId) {
        this.sendToConnection(connectionId, fullEvent);
      }
    }
  }

  /**
   * Get the number of connections for a topic
   */
  getConnectionCount(topicId: number): number {
    let count = 0;
    for (const connection of this.connections.values()) {
      if (connection.topicId === topicId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Check if a topic has any active connections
   */
  hasConnections(topicId: number): boolean {
    for (const connection of this.connections.values()) {
      if (connection.topicId === topicId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Send heartbeat to all connections
   */
  private sendHeartbeat(): void {
    const now = new Date();
    for (const [connectionId, connection] of this.connections) {
      try {
        connection.res.write(`: heartbeat\n\n`);
        connection.lastEventAt = now;
      } catch {
        // Connection likely closed
        this.removeConnection(connectionId);
      }
    }
  }

  /**
   * Start the heartbeat interval
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop the heartbeat interval
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Close all connections for a topic
   */
  closeTopicConnections(topicId: number): void {
    for (const [connectionId, connection] of this.connections) {
      if (connection.topicId === topicId) {
        try {
          connection.res.end();
        } catch {
          // Ignore errors when closing
        }
        this.connections.delete(connectionId);
      }
    }
  }

  /**
   * Get statistics about connections
   */
  getStats(): { totalConnections: number; connectionsByTopic: Record<number, number> } {
    const connectionsByTopic: Record<number, number> = {};

    for (const connection of this.connections.values()) {
      connectionsByTopic[connection.topicId] = (connectionsByTopic[connection.topicId] || 0) + 1;
    }

    return {
      totalConnections: this.connections.size,
      connectionsByTopic,
    };
  }
}

// Export singleton instance
export const sseManager = new SSEManager();
export default sseManager;
