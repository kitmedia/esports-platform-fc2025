import { Router } from 'express';
import { z } from 'zod';
import { StreamingService } from '../services/StreamingService';
import { validateRequest, CommonSchemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const CreateStreamSchema = z.object({
  matchId: z.string().uuid(),
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  quality: z.enum(['720p', '1080p', '1440p', '4k']).default('1080p'),
  enableOverlay: z.boolean().default(true),
  enableChat: z.boolean().default(true),
  isPublic: z.boolean().default(true)
});

const StreamConfigSchema = z.object({
  overlayConfig: z.object({
    showScores: z.boolean().default(true),
    showPlayerNames: z.boolean().default(true),
    showTimer: z.boolean().default(true),
    theme: z.enum(['dark', 'light', 'custom']).default('dark'),
    customColors: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      accent: z.string().optional()
    }).optional()
  }).optional(),
  bitrate: z.number().min(1000).max(10000).default(5000),
  framerate: z.enum([30, 60]).default(60)
});

const ClipRequestSchema = z.object({
  streamId: z.string().uuid(),
  startTime: z.number().min(0),
  duration: z.number().min(5).max(60).default(30),
  title: z.string().min(1).max(50)
});

export default function streamingRoutes(streamingService: StreamingService) {
  // Get streaming status
  router.get('/status',
    asyncHandler(async (req: any, res: any) => {
      res.json({
        success: true,
        data: {
          available: true, // streamingService would check actual availability
          features: {
            liveStreaming: true,
            recordingReplay: true,
            overlaySupport: true,
            multiQuality: true,
            chatIntegration: true
          },
          limits: {
            maxConcurrentStreams: 10,
            maxClipDuration: 60,
            maxStreamDuration: 7200 // 2 hours
          }
        }
      });
    })
  );

  // Create live stream for match
  router.post('/create',
    validateRequest({ body: CreateStreamSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const stream = await streamingService.createLiveStream(req.body.matchId, {
        title: req.body.title,
        description: req.body.description,
        quality: req.body.quality,
        enableOverlay: req.body.enableOverlay,
        enableChat: req.body.enableChat,
        isPublic: req.body.isPublic,
        streamerId: req.user!.userId
      });

      res.status(201).json({
        success: true,
        message: 'Stream created successfully',
        data: stream
      });
    })
  );

  // Get stream details
  router.get('/:id',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: any, res: any) => {
      // TODO: Implement get stream details
      res.json({
        success: true,
        data: {
          id: req.params.id,
          status: 'live',
          viewers: 42,
          streamUrl: `https://stream.platform.com/live/${req.params.id}`,
          chatUrl: `https://stream.platform.com/chat/${req.params.id}`,
          embedCode: `<iframe src="https://stream.platform.com/embed/${req.params.id}" width="640" height="360"></iframe>`
        }
      });
    })
  );

  // Update stream configuration
  router.put('/:id/config',
    validateRequest({ 
      params: CommonSchemas.id,
      body: StreamConfigSchema 
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement stream config update
      res.json({
        success: true,
        message: 'Stream configuration updated',
        data: {
          streamId: req.params.id,
          config: req.body
        }
      });
    })
  );

  // Start stream
  router.post('/:id/start',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement start stream
      res.json({
        success: true,
        message: 'Stream started',
        data: {
          streamId: req.params.id,
          status: 'live',
          streamKey: 'sk_live_' + Math.random().toString(36).substring(7),
          rtmpUrl: `rtmp://ingest.platform.com/live`,
          viewers: 0
        }
      });
    })
  );

  // Stop stream
  router.post('/:id/stop',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement stop stream
      res.json({
        success: true,
        message: 'Stream stopped',
        data: {
          streamId: req.params.id,
          status: 'ended',
          duration: '00:45:23',
          maxViewers: 67,
          recordingUrl: `https://recordings.platform.com/${req.params.id}.mp4`
        }
      });
    })
  );

  // Create instant replay clip
  router.post('/clip',
    validateRequest({ body: ClipRequestSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const clip = await streamingService.createInstantReplay(
        req.body.streamId,
        new Date(Date.now() - req.body.startTime * 1000),
        req.body.duration
      );

      res.json({
        success: true,
        message: 'Clip created successfully',
        data: clip
      });
    })
  );

  // Get stream clips
  router.get('/:id/clips',
    validateRequest({ 
      params: CommonSchemas.id,
      query: z.object({
        limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // TODO: Implement get stream clips
      res.json({
        success: true,
        data: [],
        pagination: {
          limit: req.query.limit,
          offset: req.query.offset,
          hasMore: false
        }
      });
    })
  );

  // Detect highlights automatically
  router.post('/:id/highlights/detect',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      const highlights = await streamingService.detectHighlights(req.params.id);

      res.json({
        success: true,
        message: 'Highlights detected successfully',
        data: highlights
      });
    })
  );

  // Get stream analytics
  router.get('/:id/analytics',
    validateRequest({ 
      params: CommonSchemas.id,
      query: z.object({
        timeframe: z.enum(['hour', 'day', 'week', 'month']).default('day')
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement stream analytics
      res.json({
        success: true,
        data: {
          streamId: req.params.id,
          timeframe: req.query.timeframe,
          metrics: {
            totalViews: 1245,
            uniqueViewers: 892,
            averageViewTime: '12:34',
            peakViewers: 156,
            chatMessages: 2341,
            likes: 89,
            shares: 23
          },
          viewershipTimeline: [],
          topCountries: [
            { country: 'US', viewers: 234 },
            { country: 'UK', viewers: 156 },
            { country: 'DE', viewers: 123 }
          ]
        }
      });
    })
  );

  // Get live streams
  router.get('/live/all',
    validateRequest({
      query: z.object({
        game: z.string().optional(),
        tournament: z.string().uuid().optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // TODO: Implement get live streams
      res.json({
        success: true,
        data: [],
        pagination: {
          limit: req.query.limit,
          offset: req.query.offset,
          hasMore: false
        }
      });
    })
  );

  // Generate OBS scene configuration
  router.get('/:id/obs-config',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Generate OBS configuration
      res.json({
        success: true,
        data: {
          streamId: req.params.id,
          obsConfig: {
            scenes: [
              {
                name: 'Tournament Match',
                sources: [
                  {
                    name: 'Game Capture',
                    type: 'game_capture',
                    settings: {}
                  },
                  {
                    name: 'Tournament Overlay',
                    type: 'browser_source',
                    settings: {
                      url: `https://overlays.platform.com/${req.params.id}`,
                      width: 1920,
                      height: 1080
                    }
                  }
                ]
              }
            ],
            streamSettings: {
              server: 'rtmp://ingest.platform.com/live',
              key: 'sk_live_' + req.params.id
            }
          },
          downloadUrl: `https://platform.com/api/streaming/${req.params.id}/obs-config.json`
        }
      });
    })
  );

  // WebRTC peer connection for direct streaming
  router.post('/:id/webrtc/offer',
    validateRequest({ 
      params: CommonSchemas.id,
      body: z.object({
        offer: z.string(),
        type: z.literal('offer')
      })
    }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Handle WebRTC offer for direct streaming
      res.json({
        success: true,
        data: {
          answer: 'mock_webrtc_answer',
          type: 'answer',
          iceServers: [
            { urls: 'stun:stun.platform.com:3478' },
            {
              urls: 'turn:turn.platform.com:3478',
              username: 'user',
              credential: 'pass'
            }
          ]
        }
      });
    })
  );

  return router;
}