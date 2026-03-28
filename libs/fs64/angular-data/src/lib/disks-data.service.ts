import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { FS64_BACKEND_API_BASE } from './api';
import { Fs64DiskRecord, Fs64DiskStoresResponse } from './contracts';

@Injectable({ providedIn: 'root' })
export class Fs64DisksDataService {
  private readonly http = inject(HttpClient);

  getStores(): Observable<Fs64DiskStoresResponse> {
    return this.http.get<Fs64DiskStoresResponse>(`${FS64_BACKEND_API_BASE}/stores`);
  }

  setActiveStores(keys: string[]): Observable<Fs64DiskStoresResponse> {
    return this.http.patch<Fs64DiskStoresResponse>(`${FS64_BACKEND_API_BASE}/stores/active`, { keys });
  }

  getDisks(dataset?: string): Observable<Fs64DiskRecord[]> {
    const params = dataset ? new HttpParams().set('dataset', dataset) : undefined;
    return this.http.get<Fs64DiskRecord[]>(`${FS64_BACKEND_API_BASE}/items/disks`, { params });
  }
}
