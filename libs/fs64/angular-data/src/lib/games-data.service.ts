import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { FS64_BACKEND_API_BASE } from './api';
import { Fs64GamesSearchResponse } from './contracts';

@Injectable({ providedIn: 'root' })
export class Fs64GamesDataService {
  private readonly http = inject(HttpClient);

  search(query: { q?: string; dataset?: string; limit?: number } = {}): Observable<Fs64GamesSearchResponse> {
    let params = new HttpParams().set('limit', String(query.limit ?? 50));

    if (query.q?.trim()) {
      params = params.set('q', query.q.trim());
    }

    if (query.dataset?.trim()) {
      params = params.set('dataset', query.dataset.trim());
    }

    return this.http.get<Fs64GamesSearchResponse>(`${FS64_BACKEND_API_BASE}/games/search`, { params });
  }
}
