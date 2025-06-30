import OpenAI from 'openai';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { z } from 'zod';

// Types
interface TournamentOptimization {
  format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS';
  rounds: number;
  estimatedDuration: string;
  suggestions: string[];
  confidence: number;
}

interface MatchResult {
  player1Score: number;
  player2Score: number;
  confidence: number;
  anomalies: string[];
  ocrText: string;
}

interface EventDescription {
  title: string;
  description: string;
  rules: string[];
  hashtags: string[];
}

// Validation schemas
const ImageValidationSchema = z.object({
  buffer: z.instanceof(Buffer),
  mimetype: z.string().regex(/^image\/(jpeg|png|gif|webp)$/),
  size: z.number().max(10 * 1024 * 1024) // 10MB max
});

export class AIService {
  private openai: OpenAI | null = null;
  private isInitialized = false;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async initialize(): Promise<void> {
    console.log('🤖 Initializing AI Service...');
    
    // Test OpenAI connection if API key is available
    if (this.openai) {
      try {
        await this.openai.models.list();
        console.log('✅ OpenAI API connected successfully');
      } catch (error) {
        console.warn('⚠️ OpenAI API connection failed, using fallback responses');
        this.openai = null;
      }
    } else {
      console.log('ℹ️ OpenAI API key not provided, using intelligent fallbacks');
    }

    this.isInitialized = true;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  // ===== TOURNAMENT ASSISTANT =====

  async suggestTournamentFormat(
    participantCount: number,
    timeConstraints: string,
    skillLevels: 'mixed' | 'similar' | 'professional'
  ): Promise<TournamentOptimization> {
    const prompt = `
    As an eSports tournament expert, suggest the optimal format for a tournament with:
    - ${participantCount} participants
    - Time constraints: ${timeConstraints}
    - Skill levels: ${skillLevels}
    
    Consider formats: Single Elimination, Double Elimination, Round Robin, Swiss System.
    Respond with JSON format including format, rounds, estimatedDuration, suggestions, and confidence (0-1).
    `;

    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          try {
            return JSON.parse(content);
          } catch (parseError) {
            // Fallback if JSON parsing fails
          }
        }
      } catch (error) {
        console.error('OpenAI API error:', error);
      }
    }

    // Intelligent fallback based on participant count and constraints
    return this.generateTournamentFallback(participantCount, timeConstraints, skillLevels);
  }

  private generateTournamentFallback(
    participantCount: number,
    timeConstraints: string,
    skillLevels: string
  ): TournamentOptimization {
    let format: TournamentOptimization['format'];
    let rounds: number;
    let estimatedDuration: string;
    let suggestions: string[];

    // Algorithm for format selection
    if (participantCount <= 8) {
      format = 'DOUBLE_ELIMINATION';
      rounds = Math.ceil(Math.log2(participantCount)) + 3;
      estimatedDuration = '2-3 hours';
      suggestions = [
        'Double elimination gives everyone a second chance',
        'Perfect size for intense competition',
        'Consider bo3 finals for more excitement'
      ];
    } else if (participantCount <= 16) {
      format = 'SINGLE_ELIMINATION';
      rounds = Math.ceil(Math.log2(participantCount));
      estimatedDuration = '3-4 hours';
      suggestions = [
        'Single elimination keeps tournament moving',
        'Consider seeding based on skill ratings',
        'Stream quarter-finals and beyond'
      ];
    } else if (participantCount <= 32) {
      format = timeConstraints.includes('long') ? 'DOUBLE_ELIMINATION' : 'SINGLE_ELIMINATION';
      rounds = format === 'DOUBLE_ELIMINATION' ? Math.ceil(Math.log2(participantCount)) + 4 : Math.ceil(Math.log2(participantCount));
      estimatedDuration = format === 'DOUBLE_ELIMINATION' ? '6-8 hours' : '4-5 hours';
      suggestions = [
        'Consider group stage qualifiers',
        'Implement check-in system',
        'Plan for potential delays'
      ];
    } else {
      format = 'SWISS';
      rounds = Math.ceil(Math.log2(participantCount));
      estimatedDuration = '4-6 hours';
      suggestions = [
        'Swiss system ensures fair matchmaking',
        'Everyone plays the same number of rounds',
        'Top 8 can advance to elimination bracket'
      ];
    }

    return {
      format,
      rounds,
      estimatedDuration,
      suggestions,
      confidence: 0.85
    };
  }

  async generateEventDescription(
    gameType: string,
    prizePool: number,
    specialFeatures: string[]
  ): Promise<EventDescription> {
    const prompt = `
    Create an engaging tournament description for:
    - Game: ${gameType}
    - Prize Pool: $${prizePool}
    - Special Features: ${specialFeatures.join(', ')}
    
    Generate: compelling title, detailed description, clear rules, relevant hashtags.
    Make it exciting and professional. Respond in JSON format.
    `;

    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 600
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          try {
            return JSON.parse(content);
          } catch (parseError) {
            // Fallback if JSON parsing fails
          }
        }
      } catch (error) {
        console.error('OpenAI API error:', error);
      }
    }

    // Intelligent fallback
    return {
      title: `${gameType} Championship - $${prizePool.toLocaleString()} Prize Pool`,
      description: `Join the ultimate ${gameType} competition featuring ${specialFeatures.join(', ')}. Compete against the best players for your share of the $${prizePool.toLocaleString()} prize pool. This tournament promises intense matches, fair play, and unforgettable moments.`,
      rules: [
        'All participants must check in 30 minutes before start time',
        'Matches are best of 3 unless specified otherwise',
        'No disconnections or rage quits allowed',
        'Screenshots required for result verification',
        'Respect all players and tournament staff'
      ],
      hashtags: ['#EASportsFCs', '#eSports', '#Tournament', '#Gaming', '#Competition']
    };
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    if (!this.openai) {
      return `[${targetLanguage.toUpperCase()}] ${text}`; // Simple fallback
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Translate the following text to ${targetLanguage}. Maintain the original meaning and tone. If it's tournament rules or gaming terminology, keep the professional eSports context.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });

      return response.choices[0]?.message?.content || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text if translation fails
    }
  }

  // ===== RESULT VALIDATION =====

  async validateMatchResult(imageBuffer: Buffer, mimetype: string): Promise<MatchResult> {
    // Validate image
    const validation = ImageValidationSchema.safeParse({
      buffer: imageBuffer,
      mimetype,
      size: imageBuffer.length
    });

    if (!validation.success) {
      throw new Error('Invalid image format or size');
    }

    try {
      // Preprocess image for better OCR
      const processedImage = await sharp(imageBuffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .sharpen()
        .normalize()
        .png()
        .toBuffer();

      // Perform OCR
      const { data: { text } } = await Tesseract.recognize(processedImage, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      // Extract scores using pattern matching
      const result = this.extractScoreFromText(text);
      
      // AI-powered anomaly detection
      const anomalies = await this.detectAnomalies(text, result);

      return {
        ...result,
        confidence: this.calculateConfidence(text, result),
        anomalies,
        ocrText: text
      };

    } catch (error) {
      console.error('OCR processing error:', error);
      throw new Error('Failed to process match result image');
    }
  }

  private extractScoreFromText(text: string): { player1Score: number; player2Score: number } {
    // Multiple patterns to match score formats
    const patterns = [
      /(\d+)\s*-\s*(\d+)/g,           // "3-1", "2 - 0"
      /(\d+)\s*:\s*(\d+)/g,           // "3:1", "2 : 0"
      /Score.*?(\d+).*?(\d+)/gi,      // "Score: 3 vs 1"
      /(\d+)\s*vs\s*(\d+)/gi,         // "3 vs 1"
      /(\d+)\s*goals.*?(\d+)\s*goals/gi // "3 goals - 1 goals"
    ];

    for (const pattern of patterns) {
      const matches = Array.from(text.matchAll(pattern));
      if (matches.length > 0) {
        const match = matches[0];
        const score1 = parseInt(match[1]);
        const score2 = parseInt(match[2]);
        
        if (!isNaN(score1) && !isNaN(score2) && score1 >= 0 && score2 >= 0) {
          return { player1Score: score1, player2Score: score2 };
        }
      }
    }

    // Fallback: look for any two numbers
    const numbers = text.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      const score1 = parseInt(numbers[0]);
      const score2 = parseInt(numbers[1]);
      return { player1Score: score1, player2Score: score2 };
    }

    throw new Error('Could not extract valid scores from image');
  }

  private calculateConfidence(text: string, result: { player1Score: number; player2Score: number }): number {
    let confidence = 0.5; // Base confidence

    // Check for game-specific indicators
    const gameIndicators = [
      'EA SPORTS', 'FIFA', 'FC 25', 'ULTIMATE TEAM', 'FULL TIME',
      'MATCH RESULT', 'FINAL SCORE', 'GOALS'
    ];
    
    for (const indicator of gameIndicators) {
      if (text.toUpperCase().includes(indicator)) {
        confidence += 0.1;
      }
    }

    // Check for reasonable score ranges (0-10 goals is normal)
    if (result.player1Score <= 10 && result.player2Score <= 10) {
      confidence += 0.2;
    }

    // Check for text clarity (more text usually means clearer image)
    if (text.length > 50) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private async detectAnomalies(text: string, result: { player1Score: number; player2Score: number }): Promise<string[]> {
    const anomalies: string[] = [];

    // Check for impossible scores
    if (result.player1Score > 20 || result.player2Score > 20) {
      anomalies.push('Unusually high score detected');
    }

    // Check for suspicious patterns in text
    if (text.includes('EDITED') || text.includes('MODIFIED')) {
      anomalies.push('Possible image manipulation detected');
    }

    // Check for missing game elements
    const requiredElements = ['FULL TIME', 'FINAL', 'RESULT', 'SCORE'];
    const hasGameElements = requiredElements.some(element => 
      text.toUpperCase().includes(element)
    );
    
    if (!hasGameElements) {
      anomalies.push('Missing expected game interface elements');
    }

    // AI-powered text analysis if OpenAI is available
    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Analyze this OCR text from a football game screenshot. Identify any anomalies, inconsistencies, or signs of manipulation. Respond with a JSON array of detected issues.'
            },
            { role: 'user', content: `OCR Text: ${text}\nExtracted Score: ${result.player1Score}-${result.player2Score}` }
          ],
          temperature: 0.1,
          max_tokens: 200
        });

        const aiAnalysis = response.choices[0]?.message?.content;
        if (aiAnalysis) {
          try {
            const aiAnomalies = JSON.parse(aiAnalysis);
            if (Array.isArray(aiAnomalies)) {
              anomalies.push(...aiAnomalies);
            }
          } catch (parseError) {
            // Ignore JSON parsing errors for AI analysis
          }
        }
      } catch (error) {
        console.error('AI anomaly detection error:', error);
      }
    }

    return anomalies;
  }

  // ===== CONTENT MODERATION =====

  async moderateContent(content: string): Promise<{
    isAppropriate: boolean;
    confidence: number;
    flaggedReasons: string[];
    suggestedAction: 'approve' | 'review' | 'reject';
  }> {
    if (!this.openai) {
      // Basic word filter fallback
      const inappropriateWords = [
        'cheat', 'hack', 'noob', 'trash', 'garbage', 'suck'
        // Add more words as needed
      ];
      
      const lowerContent = content.toLowerCase();
      const flaggedReasons: string[] = [];
      
      for (const word of inappropriateWords) {
        if (lowerContent.includes(word)) {
          flaggedReasons.push(`Contains inappropriate language: ${word}`);
        }
      }

      return {
        isAppropriate: flaggedReasons.length === 0,
        confidence: 0.7,
        flaggedReasons,
        suggestedAction: flaggedReasons.length === 0 ? 'approve' : 'review'
      };
    }

    try {
      const response = await this.openai.moderations.create({
        input: content,
      });

      const result = response.results[0];
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, flagged]) => flagged)
        .map(([category, _]) => category);

      return {
        isAppropriate: !result.flagged,
        confidence: 0.95,
        flaggedReasons: flaggedCategories.map(cat => `Flagged for: ${cat}`),
        suggestedAction: result.flagged ? 'reject' : 'approve'
      };
    } catch (error) {
      console.error('Content moderation error:', error);
      return {
        isAppropriate: true,
        confidence: 0.5,
        flaggedReasons: ['Unable to moderate content'],
        suggestedAction: 'review'
      };
    }
  }

  // ===== MATCH PREDICTIONS =====

  async predictMatchOutcome(
    player1Stats: any,
    player2Stats: any,
    historicalData?: any[]
  ): Promise<{
    player1WinProbability: number;
    player2WinProbability: number;
    confidence: number;
    factors: string[];
  }> {
    // Simple ELO-based prediction as fallback
    const player1Elo = player1Stats.currentElo || 1200;
    const player2Elo = player2Stats.currentElo || 1200;
    
    const eloDifference = player1Elo - player2Elo;
    const player1WinProbability = 1 / (1 + Math.pow(10, -eloDifference / 400));
    const player2WinProbability = 1 - player1WinProbability;

    const factors: string[] = [];
    
    if (Math.abs(eloDifference) > 200) {
      factors.push(`Significant ELO difference (${Math.abs(eloDifference)} points)`);
    }
    
    if (player1Stats.winRate > player2Stats.winRate + 0.2) {
      factors.push('Player 1 has significantly higher win rate');
    } else if (player2Stats.winRate > player1Stats.winRate + 0.2) {
      factors.push('Player 2 has significantly higher win rate');
    }

    return {
      player1WinProbability,
      player2WinProbability,
      confidence: 0.7,
      factors
    };
  }

  // ===== SCHEDULE OPTIMIZATION =====

  async optimizeSchedule(
    matches: any[],
    constraints: {
      maxConcurrentMatches?: number;
      breakDuration?: number;
      preferredStartTime?: string;
      timezone?: string;
    }
  ): Promise<any[]> {
    // Simple greedy algorithm for schedule optimization
    const optimizedMatches = [...matches];
    const maxConcurrent = constraints.maxConcurrentMatches || 4;
    const breakDuration = constraints.breakDuration || 15; // minutes

    let currentTime = new Date(constraints.preferredStartTime || Date.now());
    const slots: Date[][] = Array(maxConcurrent).fill(null).map(() => []);

    for (let i = 0; i < optimizedMatches.length; i++) {
      // Find the earliest available slot
      let earliestSlot = 0;
      let earliestTime = slots[0][slots[0].length - 1] || currentTime;

      for (let j = 1; j < slots.length; j++) {
        const slotTime = slots[j][slots[j].length - 1] || currentTime;
        if (slotTime < earliestTime) {
          earliestSlot = j;
          earliestTime = slotTime;
        }
      }

      // Schedule match in the earliest slot
      const matchStart = new Date(earliestTime.getTime() + (breakDuration * 60 * 1000));
      const matchEnd = new Date(matchStart.getTime() + (30 * 60 * 1000)); // 30 min average

      optimizedMatches[i].scheduledAt = matchStart;
      optimizedMatches[i].estimatedEnd = matchEnd;
      optimizedMatches[i].slot = earliestSlot;

      slots[earliestSlot].push(matchEnd);
    }

    return optimizedMatches;
  }
}