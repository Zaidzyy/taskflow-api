'use strict';

const { createTaskSchema, updateTaskSchema } = require('../../src/models/taskSchema');

describe('task schemas (unit)', () => {
  describe('createTaskSchema', () => {
    test('applies defaults for description and status', () => {
      const parsed = createTaskSchema.parse({ title: 'Buy milk' });
      expect(parsed).toEqual({ title: 'Buy milk', description: '', status: 'todo' });
    });

    test('rejects empty title', () => {
      expect(() => createTaskSchema.parse({ title: '   ' })).toThrow();
    });

    test('rejects invalid status', () => {
      expect(() => createTaskSchema.parse({ title: 'x', status: 'nope' })).toThrow();
    });
  });

  describe('updateTaskSchema', () => {
    test('accepts a partial update', () => {
      expect(updateTaskSchema.parse({ status: 'done' })).toEqual({ status: 'done' });
    });

    test('rejects an empty update object', () => {
      expect(() => updateTaskSchema.parse({})).toThrow();
    });
  });
});
