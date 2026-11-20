import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword } from '../src/utils/password';
import { permissionsFor } from '../src/services/auth.service';

describe('Phase 3 utilities', () => {
  it('enforces strong password rules', () => {
    assert.doesNotThrow(() => validatePassword('StrongPass1!'));
    assert.throws(() => validatePassword('weakpassword'));
  });

  it('gives SUPER_ADMIN full permissions', () => {
    assert.ok(permissionsFor('SUPER_ADMIN').includes('admins:manage'));
    assert.ok(permissionsFor('SUPER_ADMIN').includes('participants:write'));
  });
});