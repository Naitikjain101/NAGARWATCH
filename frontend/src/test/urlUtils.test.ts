import { describe, it, expect } from 'vitest';
import { normalizeApiBaseUrl } from '../lib/urlUtils';
import axios from 'axios';

describe('API Base URL Normalization', () => {
  it('handles clean base URL without trailing slash', () => {
    expect(normalizeApiBaseUrl('http://localhost:5000')).toBe('http://localhost:5000');
  });

  it('strips trailing slashes', () => {
    expect(normalizeApiBaseUrl('http://localhost:5000/')).toBe('http://localhost:5000');
    expect(normalizeApiBaseUrl('http://localhost:5000///')).toBe('http://localhost:5000');
  });

  it('strips trailing /api/v1 without trailing slash', () => {
    expect(normalizeApiBaseUrl('http://localhost:5000/api/v1')).toBe('http://localhost:5000');
  });

  it('strips trailing /api/v1 with trailing slash', () => {
    expect(normalizeApiBaseUrl('http://localhost:5000/api/v1/')).toBe('http://localhost:5000');
    expect(normalizeApiBaseUrl('http://localhost:5000/api/v1///')).toBe('http://localhost:5000');
  });

  it('handles production domains correctly', () => {
    expect(normalizeApiBaseUrl('https://api.nagarwatch.org')).toBe('https://api.nagarwatch.org');
    expect(normalizeApiBaseUrl('https://api.nagarwatch.org/api/v1/')).toBe('https://api.nagarwatch.org');
  });

  it('handles empty or undefined inputs safely', () => {
    expect(normalizeApiBaseUrl('')).toBe('');
    expect(normalizeApiBaseUrl(undefined)).toBe('');
    expect(normalizeApiBaseUrl('   ')).toBe('');
  });

  it('guarantees requests never produce duplicate /api/v1/api/v1 paths', () => {
    const rawConfigs = [
      'http://localhost:5000',
      'http://localhost:5000/',
      'http://localhost:5000/api/v1',
      'http://localhost:5000/api/v1/'
    ];

    for (const raw of rawConfigs) {
      const normalized = normalizeApiBaseUrl(raw);
      const client = axios.create({ baseURL: normalized });
      const fullUri = client.getUri({ url: '/api/v1/incidents/me' });
      
      expect(fullUri).toBe('http://localhost:5000/api/v1/incidents/me');
      expect(fullUri).not.toContain('/api/v1/api/v1');
    }
  });
});

