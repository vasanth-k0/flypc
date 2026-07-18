import { body, validationResult } from 'express-validator'
import type { NextFunction, Request, Response } from 'express'

export const usernameRules = [
  body('username')
    .isString()
    .withMessage('username must be a string')
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('username must be between 1 and 64 chars')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('username must be alphanumeric'),
]

export const passwordRules = [
  body('password')
    .isString()
    .withMessage('password must be a string')
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters long'),
]

export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const result = validationResult(req)
  if (!result.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: result.array().map((issue) => ({
        path: issue.type === 'field' ? issue.path : issue.type,
        message: issue.msg,
      })),
    })
    return
  }

  next()
}
