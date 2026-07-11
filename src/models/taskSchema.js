'use strict';

const { z } = require('zod');

/**
 * Validation schemas for task payloads, powered by zod.
 * Centralising validation keeps the route handlers thin and gives us
 * consistent, well-structured 400 errors for bad input.
 */
const taskStatusEnum = z.enum(['todo', 'in_progress', 'done']);

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  description: z.string().trim().max(2000).optional().default(''),
  status: taskStatusEnum.optional().default('todo'),
});

// Partial schema for updates: at least one field must be present.
const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    status: taskStatusEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'at least one field must be provided',
  });

module.exports = {
  taskStatusEnum,
  createTaskSchema,
  updateTaskSchema,
};
