import { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

export interface AppError extends Error {
  statusCode?: number
  isOperational?: boolean
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'

  logger.error(`Error ${statusCode}: ${message}`, {
    error: err,
    url: req.url,
    method: req.method,
    ip: req.ip,
    stack: err.stack
  })

  // Don't leak error details in production
  const errorResponse = process.env.NODE_ENV === 'production' 
    ? { error: statusCode >= 500 ? 'Internal Server Error' : message }
    : { 
        error: message,
        stack: err.stack,
        statusCode 
      }

  res.status(statusCode).json(errorResponse)
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error: AppError = new Error(message)
  error.statusCode = statusCode
  error.isOperational = true
  return error
}

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}