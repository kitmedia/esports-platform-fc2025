import { Router } from 'express';
import { z } from 'zod';
import { PaymentService } from '../services/PaymentService';
import { validateRequest, CommonSchemas } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, adminMiddleware } from '../middleware/auth';

const router = Router();

// Validation schemas
const CreatePaymentSchema = z.object({
  tournamentId: z.string().uuid(),
  amount: z.number().min(0.01),
  currency: z.string().length(3).default('usd')
});

const RefundSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.number().min(0.01).optional(),
  reason: z.string().max(500).optional()
});

const SubscriptionSchema = z.object({
  priceId: z.string().min(1),
  paymentMethodId: z.string().optional()
});

export default function paymentRoutes(paymentService: PaymentService) {
  // Get payment service status
  router.get('/status',
    asyncHandler(async (req: any, res: any) => {
      res.json({
        success: true,
        data: {
          available: paymentService.isInitialized(),
          features: {
            tournamentEntryFees: true,
            subscriptions: true,
            prizeDistribution: true,
            refunds: true,
            multiCurrency: false // Currently USD only
          },
          supportedMethods: ['card', 'bank_transfer'],
          currencies: ['usd']
        }
      });
    })
  );

  // Create payment intent for tournament entry
  router.post('/tournament/entry',
    validateRequest({ body: CreatePaymentSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      if (!paymentService.isInitialized()) {
        return res.status(503).json({
          success: false,
          message: 'Payment service unavailable'
        });
      }

      const payment = await paymentService.createTournamentPayment(
        req.body.tournamentId,
        req.user!.userId,
        req.body.amount,
        req.body.currency
      );

      res.json({
        success: true,
        message: 'Payment intent created',
        data: payment
      });
    })
  );

  // Create subscription
  router.post('/subscription',
    validateRequest({ body: SubscriptionSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      if (!paymentService.isInitialized()) {
        return res.status(503).json({
          success: false,
          message: 'Payment service unavailable'
        });
      }

      const subscription = await paymentService.createSubscription(
        req.user!.userId,
        req.body.priceId
      );

      res.json({
        success: true,
        message: 'Subscription created',
        data: subscription
      });
    })
  );

  // Get user payments
  router.get('/my-payments',
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement get user payments from database
      res.json({
        success: true,
        data: [],
        message: 'User payments endpoint - to be implemented'
      });
    })
  );

  // Get payment details
  router.get('/:id',
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      // TODO: Implement get payment details
      res.json({
        success: true,
        data: {
          id: req.params.id,
          status: 'completed',
          amount: 25.00,
          currency: 'usd',
          description: 'Tournament entry fee',
          createdAt: new Date().toISOString()
        }
      });
    })
  );

  // Stripe webhook endpoint
  router.post('/webhook/stripe',
    asyncHandler(async (req: any, res: any) => {
      const signature = req.headers['stripe-signature'];
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing Stripe signature'
        });
      }

      try {
        await paymentService.handleWebhook(req.body, signature);
        res.json({ received: true });
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({
          success: false,
          message: 'Webhook processing failed'
        });
      }
    })
  );

  // Admin routes

  // Get payment analytics
  router.get('/admin/analytics',
    adminMiddleware,
    validateRequest({
      query: z.object({
        tournamentId: z.string().uuid().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional()
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      const analytics = await paymentService.getPaymentAnalytics(req.query.tournamentId);

      res.json({
        success: true,
        data: analytics
      });
    })
  );

  // Process refund
  router.post('/admin/refund',
    adminMiddleware,
    validateRequest({ body: RefundSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      if (!paymentService.isInitialized()) {
        return res.status(503).json({
          success: false,
          message: 'Payment service unavailable'
        });
      }

      await paymentService.processRefund(
        req.body.paymentId,
        req.body.amount,
        req.body.reason
      );

      res.json({
        success: true,
        message: 'Refund processed successfully'
      });
    })
  );

  // Distribute tournament prizes
  router.post('/admin/distribute-prizes/:tournamentId',
    adminMiddleware,
    validateRequest({ params: CommonSchemas.id }),
    asyncHandler(async (req: AuthenticatedRequest, res: any) => {
      if (!paymentService.isInitialized()) {
        return res.status(503).json({
          success: false,
          message: 'Payment service unavailable'
        });
      }

      await paymentService.distributePrizes(req.params.id);

      res.json({
        success: true,
        message: 'Prize distribution initiated'
      });
    })
  );

  // Get all payments (admin)
  router.get('/admin/all',
    adminMiddleware,
    validateRequest({
      query: z.object({
        status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'DISPUTED', 'REFUNDED']).optional(),
        tournamentId: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
        offset: z.string().regex(/^\d+$/).transform(Number).default('0')
      })
    }),
    asyncHandler(async (req: any, res: any) => {
      // TODO: Implement get all payments for admin
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

  // Get subscription plans
  router.get('/plans',
    asyncHandler(async (req: any, res: any) => {
      res.json({
        success: true,
        data: [
          {
            id: 'basic',
            name: 'Basic',
            price: 9.99,
            currency: 'usd',
            interval: 'month',
            features: [
              'Participate in tournaments',
              'Basic statistics',
              'Community access'
            ]
          },
          {
            id: 'pro',
            name: 'Pro',
            price: 19.99,
            currency: 'usd',
            interval: 'month',
            features: [
              'All Basic features',
              'Advanced analytics',
              'Priority support',
              'Custom overlays',
              'Stream integration'
            ]
          },
          {
            id: 'organizer',
            name: 'Organizer',
            price: 49.99,
            currency: 'usd',
            interval: 'month',
            features: [
              'All Pro features',
              'Tournament creation',
              'Advanced AI tools',
              'Custom branding',
              'Revenue sharing'
            ]
          }
        ]
      });
    })
  );

  return router;
}