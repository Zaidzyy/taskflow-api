'use strict';

const express = require('express');
const taskService = require('../services/taskService');
const { createTaskSchema, updateTaskSchema, taskStatusEnum } = require('../models/taskSchema');
const { requireApiKey } = require('../middleware/auth');

const router = express.Router();

/**
 * Tasks REST resource.
 *   GET    /api/tasks        -> list (optional ?status= filter)   [public]
 *   GET    /api/tasks/:id    -> fetch one                          [public]
 *   POST   /api/tasks        -> create                             [auth]
 *   PUT    /api/tasks/:id    -> update                             [auth]
 *   DELETE /api/tasks/:id    -> delete                             [auth]
 *
 * Handlers delegate validation to zod and business logic to taskService.
 * Errors are thrown and handled centrally by errorHandler.
 */

router.get('/', (req, res) => {
  const filter = {};
  if (req.query.status) {
    // Validate the filter value so a bad query string returns 400, not garbage.
    filter.status = taskStatusEnum.parse(req.query.status);
  }
  res.json({ data: taskService.list(filter) });
});

router.get('/:id', (req, res) => {
  res.json({ data: taskService.get(req.params.id) });
});

router.post('/', requireApiKey, (req, res) => {
  const payload = createTaskSchema.parse(req.body);
  const task = taskService.create(payload);
  res.status(201).json({ data: task });
});

router.put('/:id', requireApiKey, (req, res) => {
  const changes = updateTaskSchema.parse(req.body);
  const task = taskService.update(req.params.id, changes);
  res.json({ data: task });
});

router.delete('/:id', requireApiKey, (req, res) => {
  taskService.remove(req.params.id);
  res.status(204).send();
});

module.exports = router;
