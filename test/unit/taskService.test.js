'use strict';

const taskService = require('../../src/services/taskService');
const { NotFoundError } = require('../../src/services/taskService');
const repository = require('../../src/repositories/taskRepository');

beforeEach(() => repository.clear());

describe('taskService (unit)', () => {
  test('create then get returns the same task', () => {
    const created = taskService.create({ title: 'A', description: '', status: 'todo' });
    expect(taskService.get(created.id)).toEqual(created);
  });

  test('get throws NotFoundError (status 404) for unknown id', () => {
    expect(() => taskService.get('missing')).toThrow(NotFoundError);
    try {
      taskService.get('missing');
    } catch (err) {
      expect(err.status).toBe(404);
    }
  });

  test('update throws NotFoundError for unknown id', () => {
    expect(() => taskService.update('missing', { status: 'done' })).toThrow(NotFoundError);
  });

  test('remove deletes and then throws on second removal', () => {
    const created = taskService.create({ title: 'A', description: '', status: 'todo' });
    expect(taskService.remove(created.id)).toBe(true);
    expect(() => taskService.remove(created.id)).toThrow(NotFoundError);
  });
});
