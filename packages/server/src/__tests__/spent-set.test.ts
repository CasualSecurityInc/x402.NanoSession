import { describe, test, expect, vi } from 'vitest';
import { InMemorySpentSet } from '../spent-set.js';

describe('InMemorySpentSet', () => {
    test('basic add and has', async () => {
        const spentSet = new InMemorySpentSet();
        const result1 = await spentSet.has('HASH1');
        expect(result1).toBe(false);

        await spentSet.add('HASH1');
        const result2 = await spentSet.has('HASH1');
        expect(result2).toBe(true);
    });

    test('TTL logic - entry expires', async () => {
        // TTL of 1 second
        const spentSet = new InMemorySpentSet(1);

        await spentSet.add('EXPIRES_SOON');
        expect(await spentSet.has('EXPIRES_SOON')).toBe(true);

        // Mock time forward by 2 seconds
        vi.useFakeTimers();
        vi.advanceTimersByTime(2000);

        expect(await spentSet.has('EXPIRES_SOON')).toBe(false);
        vi.useRealTimers();
    });

    test('prune() removes expired entries', async () => {
        // TTL of 1 second
        const spentSet = new InMemorySpentSet(1);

        await spentSet.add('ASH_1');
        await spentSet.add('ASH_2');

        // Total size should be 2
        expect(spentSet.size()).toBe(2);

        // Mock time forward
        vi.useFakeTimers();
        vi.advanceTimersByTime(2000);

        // has() on an expired entry also self-prunes it
        expect(await spentSet.has('ASH_1')).toBe(false);
        expect(spentSet.size()).toBe(1);

        // Prune should remove the remaining expired one (ASH_2)
        spentSet.prune();
        expect(spentSet.size()).toBe(0);

        vi.useRealTimers();
    });

    test('prune() keeps active entries', async () => {
        const spentSet = new InMemorySpentSet(100000); // 100s TTL

        await spentSet.add('ACTIVE_HASH');
        expect(spentSet.size()).toBe(1);

        spentSet.prune();
        expect(spentSet.size()).toBe(1);
        expect(await spentSet.has('ACTIVE_HASH')).toBe(true);
    });
});
