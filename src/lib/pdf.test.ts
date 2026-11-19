import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPdf } from './pdf';
const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), options: { workerSrc: '' } }));
vi.mock('pdfjs-dist', () => ({ getDocument: mocks.getDocument, GlobalWorkerOptions: mocks.options }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
describe('PDF extraction recovery and Japanese support', () => {
  it('loads bundled character maps and preserves Japanese source text', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    mocks.getDocument.mockReturnValue({ destroy, promise: Promise.resolve({numPages: 1, getPage: async () => ({getTextContent: async () => ({ items: [{str: '請求総額：100,000円', hasEOL: true}] })})}) });
    expect(await readPdf(new ArrayBuffer(4))).toEqual({text: '[Page 1]\n請求総額：100,000円\n', pages: 1});
    expect(mocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({cMapUrl: '/pdfjs/cmaps/', cMapPacked: true}));
    expect(destroy).toHaveBeenCalled();
  });
  it('releases a failed password-protected document', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    mocks.getDocument.mockReturnValue({ destroy, promise: Promise.reject(new Error('Password required')) });
    await expect(readPdf(new ArrayBuffer(4))).rejects.toThrow('Password required');
    expect(destroy).toHaveBeenCalled();
  });
  it('stops a stuck worker rather than keeping the upload busy forever', async () => {
    vi.useFakeTimers();
    const destroy = vi.fn().mockResolvedValue(undefined);
    mocks.getDocument.mockReturnValue({ destroy, promise: new Promise(() => {}) });
    const result = expect(readPdf(new ArrayBuffer(4))).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(20001);
    await result;
    expect(destroy).toHaveBeenCalled();
  });
});
