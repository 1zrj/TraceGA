import { describe, it, expect } from 'vitest';
import { EventBuffer } from '../src/core/EventBuffer';

describe('EventBuffer', () => {
  describe('constructor', () => {
    it('should create an empty buffer', () => {
      const buf = new EventBuffer<number>(5);
      expect(buf.size()).toBe(0);
    });
  });

  describe('push', () => {
    it('should add items to the buffer', () => {
      const buf = new EventBuffer<number>(5);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      expect(buf.size()).toBe(3);
    });

    it('should remove the oldest item when exceeding maxSize', () => {
      const buf = new EventBuffer<number>(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      buf.push(4); // 超容，应移除 1

      expect(buf.size()).toBe(3);
      expect(buf.takeAll()).toEqual([2, 3, 4]);
    });

    it('should keep removing oldest items when pushing continuously beyond maxSize', () => {
      const buf = new EventBuffer<string>(2);
      buf.push('a');
      buf.push('b');
      buf.push('c'); // 移除 'a'
      buf.push('d'); // 移除 'b'

      expect(buf.size()).toBe(2);
      expect(buf.takeAll()).toEqual(['c', 'd']);
    });
  });

  describe('pop', () => {
    it('should return and remove the oldest item', () => {
      const buf = new EventBuffer<number>(5);
      buf.push(10);
      buf.push(20);

      expect(buf.pop()).toBe(10);
      expect(buf.size()).toBe(1);
      expect(buf.pop()).toBe(20);
      expect(buf.size()).toBe(0);
    });

    it('should return undefined when buffer is empty', () => {
      const buf = new EventBuffer<number>(5);
      expect(buf.pop()).toBeUndefined();
    });
  });

  describe('size', () => {
    it('should return correct count', () => {
      const buf = new EventBuffer<number>(5);
      expect(buf.size()).toBe(0);

      buf.push(1);
      expect(buf.size()).toBe(1);

      buf.push(2);
      expect(buf.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      const buf = new EventBuffer<number>(5);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      buf.clear();

      expect(buf.size()).toBe(0);
      expect(buf.pop()).toBeUndefined();
    });
  });

  describe('takeAll', () => {
    it('should return all items in FIFO order and clear the buffer', () => {
      const buf = new EventBuffer<number>(5);
      buf.push(1);
      buf.push(2);
      buf.push(3);

      const all = buf.takeAll();
      expect(all).toEqual([1, 2, 3]);
      expect(buf.size()).toBe(0);
    });

    it('should return an empty array when buffer is empty', () => {
      const buf = new EventBuffer<number>(5);
      expect(buf.takeAll()).toEqual([]);
      expect(buf.size()).toBe(0);
    });
  });

  describe('FIFO order', () => {
    it('should maintain first-in-first-out order', () => {
      const buf = new EventBuffer<number>(3);
      buf.push(1);
      buf.push(2);
      buf.push(3);
      buf.pop(); // 移除 1
      buf.push(4);

      expect(buf.takeAll()).toEqual([2, 3, 4]);
    });
  });
});