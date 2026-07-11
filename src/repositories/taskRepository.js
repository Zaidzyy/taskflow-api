'use strict';

const crypto = require('crypto');

/**
 * In-memory task repository (data-access layer).
 *
 * The repository pattern isolates persistence behind a stable interface, so the
 * storage engine can be swapped for Postgres/SQLite/Redis later without touching
 * the service or route layers. It is deliberately dependency-free to keep the
 * container image small and the test suite fast and deterministic.
 */
class TaskRepository {
  constructor() {
    /** @type {Map<string, object>} */
    this._store = new Map();
  }

  /** Remove all tasks. Primarily used to isolate tests. */
  clear() {
    this._store.clear();
  }

  count() {
    return this._store.size;
  }

  findAll({ status } = {}) {
    let tasks = Array.from(this._store.values());
    if (status) {
      tasks = tasks.filter((t) => t.status === status);
    }
    // Newest first for a predictable, useful ordering.
    return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findById(id) {
    return this._store.get(id) || null;
  }

  create({ title, description, status }) {
    const now = new Date().toISOString();
    const task = {
      id: crypto.randomUUID(),
      title,
      description,
      status,
      createdAt: now,
      updatedAt: now,
    };
    this._store.set(task.id, task);
    return task;
  }

  update(id, changes) {
    const existing = this._store.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...changes,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this._store.set(id, updated);
    return updated;
  }

  delete(id) {
    return this._store.delete(id);
  }
}

// Export a singleton instance so all layers share the same store within a process.
module.exports = new TaskRepository();
module.exports.TaskRepository = TaskRepository;
