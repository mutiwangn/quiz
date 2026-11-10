export class PreparationError extends Error {
  retryAt: number;
  code: string;
  constructor(message: string, retryAt = 0, code = '') { super(message); this.retryAt = retryAt; this.code = code; }
}
