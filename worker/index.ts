import { createService, type ServiceEnv } from './service.ts';

export default {
  fetch(request: Request, env: ServiceEnv) { return createService(env).fetch(request); },
};
