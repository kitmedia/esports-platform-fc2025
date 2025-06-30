import { z } from 'zod'

// Common validation schemas
export const CommonSchemas = {
  id: z.string().cuid(),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  displayName: z.string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must be less than 50 characters'),
  bio: z.string()
    .max(500, 'Bio must be less than 500 characters')
    .optional(),
  url: z.string().url('Invalid URL').optional(),
  phoneNumber: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
    .optional(),
  date: z.string().datetime('Invalid date format'),
  amount: z.number()
    .min(0, 'Amount must be positive')
    .max(1000000, 'Amount is too large'),
  percentage: z.number()
    .min(0, 'Percentage must be between 0 and 100')
    .max(100, 'Percentage must be between 0 and 100'),
}

// User validation schemas
export const UserSchemas = {
  register: z.object({
    username: CommonSchemas.username,
    email: CommonSchemas.email,
    password: CommonSchemas.password,
    confirmPassword: z.string(),
    displayName: CommonSchemas.displayName.optional(),
    platform: z.enum(['PLAYSTATION', 'XBOX', 'PC', 'NINTENDO']).optional(),
    agreeToTerms: z.boolean().refine(val => val, 'You must agree to the terms and conditions'),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),

  login: z.object({
    identifier: z.string().min(1, 'Email or username is required'),
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional(),
  }),

  updateProfile: z.object({
    displayName: CommonSchemas.displayName.optional(),
    bio: CommonSchemas.bio,
    platform: z.enum(['PLAYSTATION', 'XBOX', 'PC', 'NINTENDO']).optional(),
    country: z.string().max(100).optional(),
    timezone: z.string().max(100).optional(),
    isPublic: z.boolean(),
    allowDirectMessages: z.boolean(),
    showOnlineStatus: z.boolean(),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: CommonSchemas.password,
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),
}

// Tournament validation schemas
export const TournamentSchemas = {
  create: z.object({
    name: z.string()
      .min(3, 'Tournament name must be at least 3 characters')
      .max(100, 'Tournament name must be less than 100 characters'),
    description: z.string()
      .min(10, 'Description must be at least 10 characters')
      .max(2000, 'Description must be less than 2000 characters'),
    format: z.enum(['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'SWISS']),
    maxParticipants: z.number()
      .min(4, 'Tournament must have at least 4 participants')
      .max(256, 'Tournament cannot have more than 256 participants'),
    prizePool: CommonSchemas.amount,
    entryFee: CommonSchemas.amount.optional(),
    registrationEndDate: CommonSchemas.date,
    startDate: CommonSchemas.date,
    rules: z.string().max(5000, 'Rules must be less than 5000 characters').optional(),
    isPublic: z.boolean(),
    requireApproval: z.boolean(),
    streamingRequired: z.boolean(),
    skillLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL']).optional(),
    region: z.string().max(100).optional(),
    gameMode: z.string().max(100).optional(),
  }).refine((data) => {
    const registrationEnd = new Date(data.registrationEndDate)
    const start = new Date(data.startDate)
    return registrationEnd < start
  }, {
    message: "Registration must end before tournament starts",
    path: ["registrationEndDate"],
  }),

  update: z.object({
    name: z.string()
      .min(3, 'Tournament name must be at least 3 characters')
      .max(100, 'Tournament name must be less than 100 characters')
      .optional(),
    description: z.string()
      .min(10, 'Description must be at least 10 characters')
      .max(2000, 'Description must be less than 2000 characters')
      .optional(),
    prizePool: CommonSchemas.amount.optional(),
    rules: z.string().max(5000, 'Rules must be less than 5000 characters').optional(),
    isPublic: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
  }),
}

// Match validation schemas
export const MatchSchemas = {
  submitResult: z.object({
    playerScore: z.number()
      .min(0, 'Score cannot be negative')
      .max(50, 'Score seems unrealistic'),
    opponentScore: z.number()
      .min(0, 'Score cannot be negative')
      .max(50, 'Score seems unrealistic'),
    screenshot: z.instanceof(File).optional(),
    notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  }),

  reportIssue: z.object({
    reason: z.enum(['CHEATING', 'UNSPORTING_BEHAVIOR', 'TECHNICAL_ISSUE', 'NO_SHOW', 'OTHER']),
    description: z.string()
      .min(10, 'Description must be at least 10 characters')
      .max(1000, 'Description must be less than 1000 characters'),
    evidence: z.array(z.instanceof(File)).optional(),
  }),
}

// Payment validation schemas
export const PaymentSchemas = {
  cardPayment: z.object({
    cardNumber: z.string()
      .min(13, 'Card number must be at least 13 digits')
      .max(19, 'Card number must be less than 19 digits')
      .regex(/^\d+$/, 'Card number must contain only digits'),
    expiryMonth: z.string()
      .regex(/^(0[1-9]|1[0-2])$/, 'Invalid month'),
    expiryYear: z.string()
      .regex(/^\d{2}$/, 'Invalid year'),
    cvv: z.string()
      .min(3, 'CVV must be 3-4 digits')
      .max(4, 'CVV must be 3-4 digits')
      .regex(/^\d+$/, 'CVV must contain only digits'),
    cardholderName: z.string()
      .min(2, 'Cardholder name is required')
      .max(100, 'Cardholder name is too long'),
    billingAddress: z.object({
      line1: z.string().min(1, 'Address is required').max(200),
      line2: z.string().max(200).optional(),
      city: z.string().min(1, 'City is required').max(100),
      state: z.string().min(1, 'State is required').max(100),
      postalCode: z.string().min(1, 'Postal code is required').max(20),
      country: z.string().min(2, 'Country is required').max(2),
    }),
    saveCard: z.boolean(),
  }),

  refundRequest: z.object({
    reason: z.enum(['DUPLICATE_PAYMENT', 'TOURNAMENT_CANCELLED', 'TECHNICAL_ISSUE', 'OTHER']),
    description: z.string()
      .min(10, 'Description must be at least 10 characters')
      .max(500, 'Description must be less than 500 characters'),
  }),
}

// Settings validation schemas
export const SettingsSchemas = {
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    tournament: z.boolean(),
    match: z.boolean(),
    marketing: z.boolean(),
  }),

  privacy: z.object({
    profileVisibility: z.enum(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']),
    showOnlineStatus: z.boolean(),
    allowDirectMessages: z.boolean(),
    showStats: z.boolean(),
  }),

  display: z.object({
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
    language: z.string().min(2).max(5),
    timezone: z.string().max(100),
  }),
}

// Chat validation schemas
export const ChatSchemas = {
  message: z.object({
    content: z.string()
      .min(1, 'Message cannot be empty')
      .max(1000, 'Message is too long'),
    type: z.enum(['TEXT', 'IMAGE', 'EMOTE']).default('TEXT'),
  }),

  reportMessage: z.object({
    reason: z.enum(['SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'HATE_SPEECH', 'OTHER']),
    description: z.string().max(500).optional(),
  }),
}

// Admin validation schemas
export const AdminSchemas = {
  banUser: z.object({
    reason: z.string()
      .min(10, 'Reason must be at least 10 characters')
      .max(500, 'Reason must be less than 500 characters'),
    duration: z.number()
      .min(1, 'Duration must be at least 1 hour')
      .max(8760, 'Duration cannot exceed 1 year')
      .optional(), // If not provided, it's a permanent ban
  }),

  moderateTournament: z.object({
    action: z.enum(['APPROVE', 'REJECT', 'SUSPEND', 'FEATURE', 'UNFEATURE']),
    reason: z.string().max(500).optional(),
  }),

  handleReport: z.object({
    action: z.enum(['DISMISS', 'WARNING', 'BAN_USER', 'DELETE_CONTENT', 'ESCALATE']),
    notes: z.string().max(1000).optional(),
  }),
}

// File validation
export const FileSchemas = {
  image: z.instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, 'File size must be less than 5MB')
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
      'File must be a valid image (JPEG, PNG, GIF, or WebP)'
    ),

  avatar: z.instanceof(File)
    .refine((file) => file.size <= 2 * 1024 * 1024, 'Avatar must be less than 2MB')
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      'Avatar must be JPEG, PNG, or WebP'
    ),

  screenshot: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'Screenshot must be less than 10MB')
    .refine(
      (file) => ['image/jpeg', 'image/png'].includes(file.type),
      'Screenshot must be JPEG or PNG'
    ),
}

// Utility functions for validation
export const validateField = (schema: z.ZodSchema, value: any) => {
  try {
    schema.parse(value)
    return { isValid: true, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        error: error.errors[0]?.message || 'Validation failed'
      }
    }
    return { isValid: false, error: 'Unknown validation error' }
  }
}

export const validateForm = (schema: z.ZodSchema, data: any) => {
  try {
    const result = schema.parse(data)
    return { isValid: true, data: result, errors: {} }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {}
      error.errors.forEach((err) => {
        const path = err.path.join('.')
        errors[path] = err.message
      })
      return { isValid: false, data: null, errors }
    }
    return { isValid: false, data: null, errors: { general: 'Validation failed' } }
  }
}

// Sanitization functions
export const sanitizeText = (text: string): string => {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/[<>]/g, '') // Remove potential HTML tags
}

export const sanitizeUsername = (username: string): string => {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '') // Only allow letters, numbers, and underscores
    .slice(0, 20) // Limit length
}

export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim()
}

// Real-time validation hook
export const useRealTimeValidation = (schema: z.ZodSchema) => {
  const validate = (value: any) => {
    return validateField(schema, value)
  }

  return { validate }
}