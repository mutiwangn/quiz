import { createService, type ServiceEnv } from './service.ts';
import { SourceAccess } from './sourceAccess.ts';

const sourceAccess = new SourceAccess();

export default {
  fetch(request: Request, env: ServiceEnv) { return createService(env, fetch, sourceAccess).fetch(request); },
};
