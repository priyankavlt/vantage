import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  listWorkspaces,
  signUp,
  TEST_DATABASE_URL,
  type TestApp,
} from '../test/helpers';

describe.skipIf(!TEST_DATABASE_URL)('auth + workspaces (integration)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ database: true });
  });
  afterAll(() => t.close());

  it('creates a personal workspace on sign-up, owned by the new user', async () => {
    const cookie = await signUp(t.app, { name: 'Ada Lovelace', email: 'ada@example.com' });
    const workspaces = await listWorkspaces(t.app, cookie);
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]?.name).toBe("Ada's workspace");

    const res = await t.app.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaces[0]?.id ?? ''}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: "Ada's workspace", role: 'owner' });
  });

  it("forbids access to another user's workspace", async () => {
    const owner = await signUp(t.app, { name: 'Grace Hopper', email: 'grace@example.com' });
    const [ws] = await listWorkspaces(t.app, owner);
    const intruder = await signUp(t.app, { name: 'Eve', email: 'eve@example.com' });

    const res = await t.app.inject({
      method: 'GET',
      url: `/api/workspaces/${ws?.id ?? ''}`,
      headers: { cookie: intruder },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects duplicate emails', async () => {
    await expect(signUp(t.app, { name: 'Ada', email: 'ada@example.com' })).rejects.toThrow(
      /sign-up failed/,
    );
  });
});
