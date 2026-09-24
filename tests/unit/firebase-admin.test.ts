import { describe, it, expect, beforeEach } from 'vitest';
import { getAdminAuth, getAdminDb } from '../../src/lib/firebase/admin';

describe('Firebase Admin helper', () => {
  beforeEach(() => {
    process.env.FIREBASE_PROJECT_ID = 'test-demo-innov';
    process.env.FIREBASE_CLIENT_EMAIL = 'admin@example.com';
    process.env.FIREBASE_PRIVATE_KEY = 'mock-key';
  });

  it('provides singleton auth and firestore instances', () => {
    const auth1 = getAdminAuth();
    const auth2 = getAdminAuth();
    expect(auth1).toBeDefined();
    expect(auth1).toBe(auth2);

    const db1 = getAdminDb();
    const db2 = getAdminDb();
    expect(db1).toBeDefined();
    expect(db1).toBe(db2);
  });
});
