'use strict';

const request = require('supertest');
const createApp = require('../../src/app');
const repository = require('../../src/repositories/taskRepository');
const config = require('../../src/config');

const app = createApp();
const API_KEY = config.apiKey;

// Isolate every test from shared singleton state.
beforeEach(() => repository.clear());

describe('Tasks API (integration)', () => {
  test('POST /api/tasks requires an API key', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'No auth' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  test('POST /api/tasks creates a task with a valid key', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('X-API-Key', API_KEY)
      .send({ title: 'Write report', description: 'HD task' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Write report',
      description: 'HD task',
      status: 'todo',
    });
    expect(res.body.data.id).toEqual(expect.any(String));
  });

  test('POST /api/tasks rejects invalid payload with 400 + details', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('X-API-Key', API_KEY)
      .send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  test('GET /api/tasks lists created tasks (newest first)', async () => {
    await request(app).post('/api/tasks').set('X-API-Key', API_KEY).send({ title: 'First' });
    await request(app).post('/api/tasks').set('X-API-Key', API_KEY).send({ title: 'Second' });

    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test('GET /api/tasks?status= filters by status', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set('X-API-Key', API_KEY)
      .send({ title: 'Filter me', status: 'done' });
    await request(app).post('/api/tasks').set('X-API-Key', API_KEY).send({ title: 'Other' });

    const res = await request(app).get('/api/tasks?status=done');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(created.body.data.id);
  });

  test('GET /api/tasks/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/tasks/unknown-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
  });

  test('full lifecycle: create -> get -> update -> delete', async () => {
    const create = await request(app)
      .post('/api/tasks')
      .set('X-API-Key', API_KEY)
      .send({ title: 'Lifecycle' });
    const id = create.body.data.id;

    const get = await request(app).get(`/api/tasks/${id}`);
    expect(get.status).toBe(200);

    const update = await request(app)
      .put(`/api/tasks/${id}`)
      .set('X-API-Key', API_KEY)
      .send({ status: 'in_progress' });
    expect(update.status).toBe(200);
    expect(update.body.data.status).toBe('in_progress');

    const del = await request(app)
      .delete(`/api/tasks/${id}`)
      .set('X-API-Key', API_KEY);
    expect(del.status).toBe(204);

    const gone = await request(app).get(`/api/tasks/${id}`);
    expect(gone.status).toBe(404);
  });

  test('DELETE unknown id returns 404', async () => {
    const res = await request(app)
      .delete('/api/tasks/nope')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(404);
  });
});
