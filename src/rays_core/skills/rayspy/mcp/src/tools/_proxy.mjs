import { createRequire } from 'node:module';

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
let _dispatcher;

export function getProxyDispatcher() {
  if (!PROXY_URL) return undefined;
  if (_dispatcher) return _dispatcher;
  try {
    const require_ = createRequire(import.meta.url);
    const { ProxyAgent } = require_('undici');
    _dispatcher = new ProxyAgent(PROXY_URL);
    return _dispatcher;
  } catch {
    return undefined;
  }
}

export { PROXY_URL };
