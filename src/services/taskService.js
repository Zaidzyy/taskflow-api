'use strict';

const repository = require('../repositories/taskRepository');
const { tasksTotal } = require('../metrics');

/**
 * Domain error used to signal "resource not found" to the HTTP layer without
 * coupling the service to Express. The error handler maps this to a 404.
 */
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

/**
 * Business logic for tasks. Sits between the routes and the repository so that
 * rules (e.g. keeping the Prometheus gauge in sync) live in exactly one place.
 */
const taskService = {
  list(filter) {
    return repository.findAll(filter);
  },

  get(id) {
    const task = repository.findById(id);
    if (!task) {
      throw new NotFoundError(`Task ${id} not found`);
    }
    return task;
  },

  create(data) {
    const task = repository.create(data);
    tasksTotal.set(repository.count());
    return task;
  },

  update(id, changes) {
    const task = repository.update(id, changes);
    if (!task) {
      throw new NotFoundError(`Task ${id} not found`);
    }
    return task;
  },

  remove(id) {
    const existed = repository.delete(id);
    if (!existed) {
      throw new NotFoundError(`Task ${id} not found`);
    }
    tasksTotal.set(repository.count());
    return true;
  },
};

module.exports = taskService;
module.exports.NotFoundError = NotFoundError;
