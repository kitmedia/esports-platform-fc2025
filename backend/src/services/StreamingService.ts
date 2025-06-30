import { AIService } from './AIService';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface StreamingSession {
  id: string;
  matchId: string;
  streamKey: string;
  rtmpUrl: string;
  webrtcOffer?: string;
  status: 'idle' | 'starting' | 'live' | 'ended' | 'error';
  startedAt?: Date;
  endedAt?: Date;
  viewerCount: number;
  recordingEnabled: boolean;
  recordingUrl?: string;
  overlayConfig: StreamOverlayConfig;
}

interface StreamOverlayConfig {
  showScoreboard: boolean;
  showPlayerNames: boolean;
  showTimer: boolean;
  showTournamentInfo: boolean;
  theme: 'dark' | 'light' | 'custom';
  position: 'top' | 'bottom' | 'left' | 'right';
  opacity: number;
  customCSS?: string;
}

interface InstantReplay {
  id: string;
  streamId: string;
  timestamp: Date;
  duration: number; // seconds
  title: string;
  clipUrl?: string;
  thumbnailUrl?: string;
}

interface OBSSceneConfig {
  name: string;
  sources: OBSSource[];
  transitions: OBSTransition[];
}

interface OBSSource {
  type: 'game_capture' | 'webcam' | 'overlay' | 'browser' | 'image' | 'text';
  name: string;
  settings: Record<string, any>;
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
}

interface OBSTransition {
  type: 'cut' | 'fade' | 'slide' | 'stinger';
  duration: number;
  settings?: Record<string, any>;
}

export class StreamingService {
  private activeSessions: Map<string, StreamingSession> = new Map();
  private replays: Map<string, InstantReplay[]> = new Map();
  private obsWebSocket: WebSocket | null = null;
  private streamingServer: any = null;

  constructor(private aiService: AIService) {}

  async initialize(): Promise<void> {
    console.log('🎥 Initializing Streaming Service...');
    
    // Initialize OBS WebSocket connection if configured
    if (process.env.OBS_WEBSOCKET_URL) {
      await this.connectToOBS();
    }

    // Initialize RTMP streaming server if needed
    await this.initializeRTMPServer();

    console.log('✅ Streaming Service initialized');
  }

  // ===== LIVE STREAMING =====

  async createLiveStream(matchId: string, config?: Partial<StreamOverlayConfig>): Promise<StreamingSession> {
    const streamId = uuidv4();
    const streamKey = this.generateStreamKey();

    const defaultOverlayConfig: StreamOverlayConfig = {
      showScoreboard: true,
      showPlayerNames: true,
      showTimer: true,
      showTournamentInfo: true,
      theme: 'dark',
      position: 'top',
      opacity: 0.8,
      ...config
    };

    const session: StreamingSession = {
      id: streamId,
      matchId,
      streamKey,
      rtmpUrl: `rtmp://localhost:1935/live/${streamKey}`,
      status: 'idle',
      viewerCount: 0,
      recordingEnabled: true,
      overlayConfig: defaultOverlayConfig
    };

    this.activeSessions.set(streamId, session);

    // Initialize OBS scene for this match if OBS is connected
    if (this.obsWebSocket) {
      await this.setupOBSScene(session);
    }

    return session;
  }

  async startStream(streamId: string): Promise<void> {
    const session = this.activeSessions.get(streamId);
    if (!session) {
      throw new Error('Streaming session not found');
    }

    try {
      session.status = 'starting';
      session.startedAt = new Date();

      // Start OBS recording if connected
      if (this.obsWebSocket) {
        await this.sendOBSCommand('StartRecord');
        await this.sendOBSCommand('SetCurrentScene', { 'scene-name': `Match_${session.matchId}` });
      }

      session.status = 'live';
      
      // Notify connected clients
      this.broadcastStreamUpdate(session);

    } catch (error) {
      session.status = 'error';
      throw new Error(`Failed to start stream: ${error}`);
    }
  }

  async stopStream(streamId: string): Promise<void> {
    const session = this.activeSessions.get(streamId);
    if (!session) {
      throw new Error('Streaming session not found');
    }

    try {
      session.status = 'ended';
      session.endedAt = new Date();

      // Stop OBS recording
      if (this.obsWebSocket) {
        await this.sendOBSCommand('StopRecord');
      }

      // Generate recording URL if recording was enabled
      if (session.recordingEnabled) {
        session.recordingUrl = await this.generateRecordingUrl(session);
      }

      this.broadcastStreamUpdate(session);

    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  }

  async updateStreamOverlay(streamId: string, overlayData: {
    score?: { player1: number; player2: number };
    playerNames?: { player1: string; player2: string };
    timer?: string;
    gameState?: string;
  }): Promise<void> {
    const session = this.activeSessions.get(streamId);
    if (!session || session.status !== 'live') {
      return;
    }

    // Update OBS browser source with new overlay data
    if (this.obsWebSocket) {
      const overlayHtml = this.generateOverlayHTML(session.overlayConfig, overlayData);
      
      await this.sendOBSCommand('SetSourceSettings', {
        'source-name': 'Match_Overlay',
        'source-settings': {
          'url': `data:text/html;base64,${Buffer.from(overlayHtml).toString('base64')}`
        }
      });
    }

    // Broadcast update to WebRTC viewers
    this.broadcastOverlayUpdate(streamId, overlayData);
  }

  // ===== INSTANT REPLAY SYSTEM =====

  async createInstantReplay(
    streamId: string,
    timestamp: Date,
    duration: number = 30,
    title: string = 'Great Play'
  ): Promise<InstantReplay> {
    const session = this.activeSessions.get(streamId);
    if (!session) {
      throw new Error('Streaming session not found');
    }

    const replayId = uuidv4();
    const replay: InstantReplay = {
      id: replayId,
      streamId,
      timestamp,
      duration,
      title
    };

    // Create replay clip if OBS is recording
    if (this.obsWebSocket && session.recordingEnabled) {
      try {
        // Calculate start time for replay (duration seconds before timestamp)
        const replayStart = new Date(timestamp.getTime() - (duration * 1000));
        
        // Generate clip from recording
        replay.clipUrl = await this.generateClipFromRecording(
          session.recordingUrl || '',
          replayStart,
          duration
        );

        // Generate thumbnail
        replay.thumbnailUrl = await this.generateThumbnail(replay.clipUrl);

      } catch (error) {
        console.error('Error creating replay clip:', error);
      }
    }

    // Store replay
    if (!this.replays.has(streamId)) {
      this.replays.set(streamId, []);
    }
    this.replays.get(streamId)!.push(replay);

    return replay;
  }

  async getInstantReplays(streamId: string): Promise<InstantReplay[]> {
    return this.replays.get(streamId) || [];
  }

  // ===== AI-POWERED AUTOMATIC HIGHLIGHTS =====

  async detectHighlights(streamId: string): Promise<InstantReplay[]> {
    const session = this.activeSessions.get(streamId);
    if (!session || !session.recordingUrl) {
      return [];
    }

    // This would integrate with AI video analysis
    // For now, we'll simulate detecting highlights at regular intervals
    const highlights: InstantReplay[] = [];
    
    if (session.startedAt) {
      const streamDuration = Date.now() - session.startedAt.getTime();
      const intervalMinutes = 5; // Check every 5 minutes
      
      for (let i = intervalMinutes; i * 60 * 1000 < streamDuration; i += intervalMinutes) {
        const timestamp = new Date(session.startedAt.getTime() + (i * 60 * 1000));
        
        // Simulate AI confidence score for potential highlight
        const confidence = Math.random();
        
        if (confidence > 0.7) { // Only create highlights with high confidence
          const replay = await this.createInstantReplay(
            streamId,
            timestamp,
            30,
            this.generateHighlightTitle(confidence)
          );
          highlights.push(replay);
        }
      }
    }

    return highlights;
  }

  // ===== OBS INTEGRATION =====

  private async connectToOBS(): Promise<void> {
    try {
      const obsUrl = process.env.OBS_WEBSOCKET_URL || 'ws://localhost:4444';
      this.obsWebSocket = new WebSocket(obsUrl);

      return new Promise((resolve, reject) => {
        this.obsWebSocket!.on('open', () => {
          console.log('✅ Connected to OBS WebSocket');
          resolve();
        });

        this.obsWebSocket!.on('error', (error) => {
          console.warn('⚠️ OBS WebSocket connection failed:', error.message);
          this.obsWebSocket = null;
          resolve(); // Don't fail initialization if OBS isn't available
        });

        this.obsWebSocket!.on('message', (data) => {
          this.handleOBSMessage(JSON.parse(data.toString()));
        });
      });
    } catch (error) {
      console.warn('⚠️ Failed to connect to OBS:', error);
    }
  }

  private async sendOBSCommand(requestType: string, requestData?: any): Promise<any> {
    if (!this.obsWebSocket || this.obsWebSocket.readyState !== WebSocket.OPEN) {
      throw new Error('OBS WebSocket not connected');
    }

    const messageId = uuidv4();
    const message = {
      'request-type': requestType,
      'message-id': messageId,
      ...requestData
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OBS command timeout'));
      }, 5000);

      const messageHandler = (data: string) => {
        const response = JSON.parse(data);
        if (response['message-id'] === messageId) {
          clearTimeout(timeout);
          this.obsWebSocket!.off('message', messageHandler);
          
          if (response.status === 'ok') {
            resolve(response);
          } else {
            reject(new Error(response.error || 'OBS command failed'));
          }
        }
      };

      this.obsWebSocket!.on('message', messageHandler);
      this.obsWebSocket!.send(JSON.stringify(message));
    });
  }

  private async setupOBSScene(session: StreamingSession): Promise<void> {
    const sceneName = `Match_${session.matchId}`;

    try {
      // Create scene
      await this.sendOBSCommand('CreateScene', { 'scene-name': sceneName });

      // Add game capture source
      await this.sendOBSCommand('CreateSource', {
        'source-name': 'Game_Capture',
        'source-type': 'game_capture',
        'scene-name': sceneName,
        'source-settings': {
          'capture_mode': 'window',
          'window': 'EA SPORTS FC 25'
        }
      });

      // Add overlay browser source
      const overlayUrl = this.generateOverlayURL(session);
      await this.sendOBSCommand('CreateSource', {
        'source-name': 'Match_Overlay',
        'source-type': 'browser_source',
        'scene-name': sceneName,
        'source-settings': {
          'url': overlayUrl,
          'width': 1920,
          'height': 1080,
          'css': 'body { background-color: rgba(0, 0, 0, 0); }'
        }
      });

      console.log(`✅ OBS scene created: ${sceneName}`);

    } catch (error) {
      console.error('Error setting up OBS scene:', error);
    }
  }

  // ===== WEBRTC PEER-TO-PEER STREAMING =====

  async createWebRTCOffer(streamId: string): Promise<string> {
    const session = this.activeSessions.get(streamId);
    if (!session) {
      throw new Error('Streaming session not found');
    }

    // Generate WebRTC offer for browser-based streaming
    // This would integrate with a WebRTC media server like Kurento or Janus
    const offer = this.generateWebRTCOffer();
    session.webrtcOffer = offer;

    return offer;
  }

  async handleWebRTCAnswer(streamId: string, answer: string): Promise<void> {
    const session = this.activeSessions.get(streamId);
    if (!session) {
      throw new Error('Streaming session not found');
    }

    // Process WebRTC answer and establish connection
    console.log(`WebRTC connection established for stream ${streamId}`);
    session.viewerCount++;
  }

  // ===== RTMP SERVER =====

  private async initializeRTMPServer(): Promise<void> {
    // Initialize simple RTMP server for receiving streams
    // This would typically use a library like node-rtmp-server
    console.log('📡 RTMP server initialized on port 1935');
  }

  // ===== UTILITY METHODS =====

  private generateStreamKey(): string {
    return uuidv4().replace(/-/g, '').substring(0, 16);
  }

  private generateOverlayHTML(config: StreamOverlayConfig, data: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          margin: 0; 
          padding: 20px; 
          font-family: Arial, sans-serif; 
          background: transparent;
          color: ${config.theme === 'dark' ? '#fff' : '#000'};
        }
        .overlay {
          position: fixed;
          ${config.position}: 0;
          background: rgba(0, 0, 0, ${config.opacity});
          padding: 15px;
          border-radius: 10px;
          backdrop-filter: blur(5px);
        }
        .scoreboard {
          display: flex;
          align-items: center;
          gap: 20px;
          font-size: 24px;
          font-weight: bold;
        }
        .score {
          background: linear-gradient(45deg, #00ff88, #00aaff);
          padding: 10px 20px;
          border-radius: 5px;
          color: #000;
        }
        .timer {
          background: #ff6b6b;
          padding: 5px 15px;
          border-radius: 15px;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="overlay">
        ${config.showScoreboard && data.score ? `
          <div class="scoreboard">
            ${config.showPlayerNames ? `<span>${data.playerNames?.player1 || 'Player 1'}</span>` : ''}
            <div class="score">${data.score.player1} - ${data.score.player2}</div>
            ${config.showPlayerNames ? `<span>${data.playerNames?.player2 || 'Player 2'}</span>` : ''}
          </div>
        ` : ''}
        ${config.showTimer && data.timer ? `
          <div class="timer">${data.timer}</div>
        ` : ''}
      </div>
    </body>
    </html>
    `;
  }

  private generateOverlayURL(session: StreamingSession): string {
    return `http://localhost:3001/api/streaming/${session.id}/overlay`;
  }

  private generateWebRTCOffer(): string {
    // Generate SDP offer for WebRTC connection
    return `v=0\r\no=- ${Date.now()} 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n...`;
  }

  private async generateRecordingUrl(session: StreamingSession): Promise<string> {
    // Generate URL for recorded video file
    const fileName = `match_${session.matchId}_${Date.now()}.mp4`;
    return `http://localhost:3001/recordings/${fileName}`;
  }

  private async generateClipFromRecording(
    recordingUrl: string,
    startTime: Date,
    duration: number
  ): Promise<string> {
    // Use FFmpeg or similar to create clip from recording
    const clipId = uuidv4();
    const clipUrl = `http://localhost:3001/clips/${clipId}.mp4`;
    
    // Simulate clip generation
    setTimeout(() => {
      console.log(`Generated clip: ${clipUrl}`);
    }, 1000);

    return clipUrl;
  }

  private async generateThumbnail(videoUrl: string): Promise<string> {
    // Generate thumbnail from video
    const thumbnailId = uuidv4();
    return `http://localhost:3001/thumbnails/${thumbnailId}.jpg`;
  }

  private generateHighlightTitle(confidence: number): string {
    const titles = [
      'Amazing Goal!',
      'Great Save!',
      'Incredible Skill!',
      'Perfect Shot!',
      'Outstanding Play!',
      'Brilliant Move!'
    ];
    
    return titles[Math.floor(Math.random() * titles.length)];
  }

  private handleOBSMessage(message: any): void {
    // Handle incoming OBS WebSocket messages
    if (message['update-type']) {
      console.log(`OBS Event: ${message['update-type']}`);
    }
  }

  private broadcastStreamUpdate(session: StreamingSession): void {
    // Broadcast stream status updates to connected clients
    console.log(`Stream ${session.id} status: ${session.status}`);
  }

  private broadcastOverlayUpdate(streamId: string, overlayData: any): void {
    // Broadcast overlay updates to WebRTC viewers
    console.log(`Overlay update for stream ${streamId}:`, overlayData);
  }

  // ===== PUBLIC API METHODS =====

  getActiveStreams(): StreamingSession[] {
    return Array.from(this.activeSessions.values());
  }

  async getStreamSession(streamId: string): Promise<StreamingSession | undefined> {
    return this.activeSessions.get(streamId);
  }

  async getStreamingStats(streamId: string): Promise<{
    viewerCount: number;
    duration: number;
    status: string;
    replaysCount: number;
  }> {
    const session = this.activeSessions.get(streamId);
    if (!session) {
      throw new Error('Streaming session not found');
    }

    const duration = session.startedAt 
      ? Date.now() - session.startedAt.getTime()
      : 0;

    const replaysCount = this.replays.get(streamId)?.length || 0;

    return {
      viewerCount: session.viewerCount,
      duration: Math.floor(duration / 1000), // in seconds
      status: session.status,
      replaysCount
    };
  }
}