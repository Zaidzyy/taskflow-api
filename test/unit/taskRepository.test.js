'use strict';

const { TaskRepository } = require('../../src/repositories/taskRepository');

describe('TaskRepository (unit)', () => {
  let repo;

  beforeEach(() => {
    repo = new TaskRepository();
  });

  test('starts empty', () => {
    expect(repo.count()).toBe(0);
    expect(repo.findAll()).toEqual([]);
  });

  test('creates a task with generated id and timestamps', () => {
    const task = repo.create({ title: 'A', description: 'x', status: 'todo' });
    expect(task.id).toEqual(expect.any(String));
    expect(task.createdAt).toEqual(expect.any(String));
    expect(task.updatedAt).toEqual(task.createdAt);
    expect(repo.count()).toBe(1);
  });

  test('finds a task by id and returns null for unknown id', () => {
    const task = repo.create({ title: 'A', description: '', status: 'todo' });
    expect(repo.findById(task.id)).toMatchObject({ title: 'A' });
    expect(repo.findById('nope')).toBeNull();
  });

  test('filters findAll by status', () => {
    repo.create({ title: 'A', description: '', status: 'todo' });
    repo.create({ title: 'B', description: '', status: 'done' });
    expect(repo.findAll({ status: 'done' })).toHaveLength(1);
    expect(repo.findAll({ status: 'done' })[0].title).toBe('B');
  });

  test('update preserves id/createdAt and bumps updatedAt', async () => {
    const task = repo.create({ title: 'A', description: '', status: 'todo' });
    await new Promise((r) => setTimeout(r, 2)); // ensure timestamp changes
    const updated = repo.update(task.id, { status: 'done' });
    expect(updated.id).toBe(task.id);
    expect(updated.createdAt).toBe(task.createdAt);
    expect(updated.status).toBe('done');
    expect(updated.updatedAt >= task.updatedAt).toBe(true);
  });

  test('update returns null for unknown id', () => {
    expect(repo.update('nope', { status: 'done' })).toBeNull();
  });

  test('delete removes a task and reports success/failure', () => {
    const task = repo.create({ title: 'A', description: '', status: 'todo' });
    expect(repo.delete(task.id)).toBe(true);
    expect(repo.count()).toBe(0);
    expect(repo.delete(task.id)).toBe(false);
  });
});
