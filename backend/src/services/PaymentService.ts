import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

export class PaymentService {
  private stripe: Stripe;
  private initialized = false;

  constructor(private prisma: PrismaClient) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.warn('⚠️ Stripe secret key not found, payment features will be disabled');
      return;
    }

    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16'
    });
  }

  async initialize(): Promise<void> {
    if (!this.stripe) {
      console.log('💳 Payment service disabled (no Stripe key)');
      return;
    }

    try {
      // Test Stripe connection
      await this.stripe.accounts.retrieve();
      this.initialized = true;
      console.log('✅ Stripe payment service initialized');
    } catch (error) {
      console.error('❌ Stripe initialization failed:', error);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ===== TOURNAMENT ENTRY FEES =====

  async createTournamentPayment(
    tournamentId: string,
    userId: string,
    amount: number,
    currency: string = 'usd'
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    if (!this.initialized) {
      throw new Error('Payment service not available');
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { name: true, entryFee: true }
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.entryFee !== amount) {
      throw new Error('Payment amount does not match entry fee');
    }

    // Create payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency,
      metadata: {
        tournamentId,
        userId,
        type: 'tournament_entry'
      },
      description: `Entry fee for ${tournament.name}`
    });

    // Record payment in database
    await this.prisma.payment.create({
      data: {
        stripePaymentIntentId: paymentIntent.id,
        userId,
        tournamentId,
        amount,
        currency,
        status: 'PENDING',
        type: 'ENTRY_FEE'
      }
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id
    };
  }

  // ===== WEBHOOK HANDLING =====

  async handleWebhook(
    payload: string,
    signature: string
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Payment service not available');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'charge.dispute.created':
        await this.handleDispute(event.data.object as Stripe.Dispute);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id }
    });

    if (!payment) {
      console.error('Payment not found for PaymentIntent:', paymentIntent.id);
      return;
    }

    // Update payment status
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { 
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    // If it's a tournament entry fee, register the participant
    if (payment.type === 'ENTRY_FEE' && payment.tournamentId) {
      try {
        await this.prisma.tournamentParticipant.create({
          data: {
            tournamentId: payment.tournamentId,
            userId: payment.userId,
            status: 'REGISTERED',
            registrationPaid: true
          }
        });
      } catch (error) {
        console.error('Failed to register participant after payment:', error);
      }
    }
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await this.prisma.payment.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: { status: 'FAILED' }
    });
  }

  private async handleDispute(dispute: Stripe.Dispute): Promise<void> {
    // Record dispute for manual review
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: dispute.payment_intent as string }
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'DISPUTED' }
      });
    }
  }

  // ===== PRIZE DISTRIBUTION =====

  async distributePrizes(tournamentId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Payment service not available');
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        prizeDistribution: true,
        participants: {
          include: {
            user: { select: { id: true, stripeAccountId: true } }
          }
        }
      }
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.status !== 'COMPLETED') {
      throw new Error('Tournament must be completed to distribute prizes');
    }

    // Get final standings
    const standings = await this.getTournamentStandings(tournamentId);

    for (const prize of tournament.prizeDistribution) {
      const winner = standings[prize.position - 1];
      if (!winner || !winner.user.stripeAccountId) {
        console.warn(`No winner or Stripe account for position ${prize.position}`);
        continue;
      }

      try {
        // Create transfer to winner's Stripe account
        const transfer = await this.stripe.transfers.create({
          amount: prize.amount * 100, // Convert to cents
          currency: 'usd',
          destination: winner.user.stripeAccountId,
          metadata: {
            tournamentId,
            position: prize.position.toString(),
            userId: winner.userId
          }
        });

        // Record prize payment
        await this.prisma.prizePayment.create({
          data: {
            tournamentId,
            userId: winner.userId,
            position: prize.position,
            amount: prize.amount,
            stripeTransferId: transfer.id,
            status: 'COMPLETED'
          }
        });

      } catch (error) {
        console.error(`Failed to transfer prize to ${winner.userId}:`, error);
        
        // Record failed payment
        await this.prisma.prizePayment.create({
          data: {
            tournamentId,
            userId: winner.userId,
            position: prize.position,
            amount: prize.amount,
            status: 'FAILED'
          }
        });
      }
    }
  }

  private async getTournamentStandings(tournamentId: string): Promise<any[]> {
    // This would implement the logic to get final tournament standings
    // For now, return empty array as placeholder
    return [];
  }

  // ===== SUBSCRIPTION MANAGEMENT =====

  async createSubscription(
    userId: string,
    priceId: string
  ): Promise<{ clientSecret: string; subscriptionId: string }> {
    if (!this.initialized) {
      throw new Error('Payment service not available');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: { userId }
      });
      
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId }
      });
    }

    // Create subscription
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent']
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    return {
      clientSecret: paymentIntent.client_secret!,
      subscriptionId: subscription.id
    };
  }

  // ===== REFUNDS =====

  async processRefund(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Payment service not available');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment || !payment.stripePaymentIntentId) {
      throw new Error('Payment not found');
    }

    try {
      // Create refund in Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: amount ? amount * 100 : undefined, // Convert to cents
        reason: reason as any
      });

      // Record refund in database
      await this.prisma.refund.create({
        data: {
          paymentId: payment.id,
          amount: refund.amount / 100, // Convert back to dollars
          reason: reason || 'requested_by_customer',
          stripeRefundId: refund.id,
          status: 'COMPLETED'
        }
      });

    } catch (error) {
      console.error('Refund failed:', error);
      throw new Error('Failed to process refund');
    }
  }

  // ===== ANALYTICS =====

  async getPaymentAnalytics(tournamentId?: string): Promise<{
    totalRevenue: number;
    totalPayments: number;
    successRate: number;
    avgTransactionValue: number;
  }> {
    const where = tournamentId ? { tournamentId } : {};

    const payments = await this.prisma.payment.findMany({
      where: {
        ...where,
        status: { in: ['COMPLETED', 'FAILED'] }
      }
    });

    const completed = payments.filter(p => p.status === 'COMPLETED');
    const totalRevenue = completed.reduce((sum, p) => sum + p.amount, 0);
    const successRate = payments.length > 0 ? completed.length / payments.length : 0;
    const avgTransactionValue = completed.length > 0 ? totalRevenue / completed.length : 0;

    return {
      totalRevenue,
      totalPayments: payments.length,
      successRate,
      avgTransactionValue
    };
  }
}