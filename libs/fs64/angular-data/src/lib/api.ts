function getFs64BackendOrigin(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000';
  }

  const { protocol, hostname, port } = window.location;
  const localHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (port === '5000') {
    return `${protocol}//${hostname}:5000`;
  }

  if (localHost) {
    return `${protocol}//${hostname}:5000`;
  }

  return '';
}

export const FS64_BACKEND_API_BASE = `${getFs64BackendOrigin()}/api`;

export function normalizeFs64Route(route: string): string {
  const trimmed = route.trim();
  if (!trimmed) {
    return '/';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
