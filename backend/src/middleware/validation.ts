import { Request, Response, NextFunction } from 'express'
import { validationResult } from 'express-validator'
import { createError } from './errorHandler'

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req)
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg).join(', ')
    throw createError(`Validation error: ${errorMessages}`, 400)
  }
  
  next()
}