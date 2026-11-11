import { ServiceError } from './errors.ts';

// One gate belongs to a runtime instance, including all of its concurrent requests.
export class SourceAccess {
  private readonly controller = new AbortController();
  get signal() { return this.controller.signal; }
  assertAvailable() { this.signal.throwIfAborted(); }
  pause() {
    if (!this.signal.aborted) this.controller.abort(new ServiceError('SOURCE_ACCOUNT_LOCKED', 503, '题目服务已暂停，请联系老师处理后再开始。'));
  }
}
