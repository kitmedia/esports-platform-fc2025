import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { logger } from '@/utils/logger'

export interface AppError extends Error {
  statusCode: number
  isOperational: boolean
  code?: string
}

export class CustomError extends Error implements AppError {
  statusCode: number
  isOperational: boolean
  code?: string

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    this.code = code
    
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends CustomError {
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR')
  }
}

export class ConflictError extends CustomError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR')
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR')
  }
}

export class ServiceUnavailableError extends CustomError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE_ERROR')
  }
}

const handleZodError = (error: ZodError): CustomError => {
  const errors = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }))

  const message = `Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`
  
  return new ValidationError(message)
}

const handlePrismaError = (error: PrismaClientKnownRequestError): CustomError => {
  switch (error.code) {
    case 'P2002':
      return new ConflictError(`Unique constraint violation: ${error.meta?.target}`)
    case 'P2025':
      return new NotFoundError('Record not found')
    case 'P2003':
      return new ValidationError('Foreign key constraint violation')
    case 'P2014':
      return new ValidationError('Required relation missing')
    case 'P2021':
      return new NotFoundError('Table does not exist')
    case 'P2022':
      return new NotFoundError('Column does not exist')
    default:
      logger.error('Unhandled Prisma error:', { code: error.code, meta: error.meta })
      return new CustomError('Database operation failed', 500, 'DATABASE_ERROR')
  }
}

const handleJWTError = (error: Error): CustomError => {
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token')
  }
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired')
  }
  if (error.name === 'NotBeforeError') {
    return new AuthenticationError('Token not active')
  }
  return new AuthenticationError('Token verification failed')
}

const handleMulterError = (error: any): CustomError => {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new ValidationError('File too large')
    case 'LIMIT_FILE_COUNT':
      return new ValidationError('Too many files')
    case 'LIMIT_UNEXPECTED_FILE':
      return new ValidationError('Unexpected file field')
    case 'MISSING_FIELD_NAME':
      return new ValidationError('Missing field name')
    default:
      return new ValidationError('File upload failed')
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error: AppError

  // Handle known error types
  if (err instanceof CustomError) {
    error = err
  } else if (err instanceof ZodError) {
    error = handleZodError(err)
  } else if (err instanceof PrismaClientKnownRequestError) {
    error = handlePrismaError(err)
  } else if (err.name?.includes('JWT') || err.name?.includes('Token')) {
    error = handleJWTError(err)
  } else if (err.name === 'MulterError' || 'code' in err) {
    error = handleMulterError(err)
  } else {
    // Unknown error
    error = new CustomError(
      process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      500,
      'INTERNAL_ERROR'
    )
  }

  // Log error details
  const errorDetails = {
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString()
  }

  if (error.statusCode >= 500) {
    logger.error('Server error:', errorDetails)
  } else {
    logger.warn('Client error:', errorDetails)
  }

  // Send error response
  const response: any = {
    success: false,
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack
  }

  // Include request ID if available
  if (res.locals.requestId) {
    response.requestId = res.locals.requestId
  }

  res.status(error.statusCode).json(response)
}

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`)
  next(error)
}

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
}