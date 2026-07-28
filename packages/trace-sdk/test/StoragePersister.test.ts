import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoragePersister } from '../src/utils/StoragePersister';

describe('StoragePersister', () => {
  let persister: StoragePersister;

  beforeEach(() => {
    persister = new StoragePersister();
    localStorage.clear();
  });

  describe('save', () => {
    it('should save and return true', () => {
      const result = persister.save('test_key', { name: 'test' });
      expect(result).toBe(true);
      expect(localStorage.getItem('test_key')).toBe('{"name":"test"}');
    });

    it('should return false when QuotaExceeded', () => {
      // 使用 spyOn 模拟 localStorage.setItem 抛出 QuotaExceededError
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const err = new Error('QuotaExceeded');
        (err as any).name = 'QuotaExceededError';
        throw err;
      });

      const result = persister.save('test_key', { data: 'large' });
      expect(result).toBe(false);

      spy.mockRestore();
    });
  });

  describe('load', () => {
    it('should load and parse data', () => {
      localStorage.setItem('test_key', '{"name":"test"}');
      const result = persister.load('test_key');
      expect(result).toEqual({ name: 'test' });
    });

    it('should return null for non-existent key', () => {
      const result = persister.load('missing_key');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      localStorage.setItem('test_key', 'not-json');
      const result = persister.load('test_key');
      expect(result).toBeNull();
    });
  });

  describe('clear', () => {
    it('should remove the key from localStorage', () => {
      localStorage.setItem('test_key', 'data');
      persister.clear('test_key');
      expect(localStorage.getItem('test_key')).toBeNull();
    });

    it('should not throw for non-existent key', () => {
      expect(() => persister.clear('missing_key')).not.toThrow();
    });
  });
});
