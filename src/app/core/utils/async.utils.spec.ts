import { OperationTimeoutError, withTimeout } from './async.utils';

describe('withTimeout', () => {
  it('returns the operation result when it finishes before the deadline', async () => {
    const result = await withTimeout(Promise.resolve('ready'), 100, 'Timed out');
    expect(result).toBe('ready');
  });

  it('rejects with a timeout error when the operation takes too long', async () => {
    let error: unknown;
    try {
      await withTimeout(new Promise<string>((resolve) => setTimeout(() => resolve('late'), 50)), 1, 'Firebase tardó demasiado');
    } catch (caught: unknown) {
      error = caught;
    }
    expect(error).toBeInstanceOf(OperationTimeoutError);
  });
});
