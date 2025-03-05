/// <reference types="react-scripts" />

import { BaseAuthStore } from 'pocketbase';

declare module 'pocketbase' {
  export interface Record {
    id: string;
    created: string;
    updated: string;
    collectionId: string;
    collectionName: string;
  }

  export interface AuthModel extends Record {
    email: string;
    emailVisibility: boolean;
    username: string;
    verified: boolean;
    avatar?: string;
  }

  export interface Admin extends Record {
    email: string;
    avatar: string;
    verified: boolean;
  }

  export interface AuthResponse {
    token: string;
    record: Record;
  }

  export interface RealtimeEvent {
    action: 'create' | 'update' | 'delete';
    record: Record;
  }

  export type UnsubscribeFunc = () => void;

  export interface Collection {
    authWithPassword(email: string, password: string): Promise<AuthResponse>;
    getList(page: number, perPage: number, options?: any): Promise<{ items: Record[] }>;
    subscribe(topic: string, callback: (data: RealtimeEvent) => void): UnsubscribeFunc;
    create(data: Record | object): Promise<Record>;
    getOne(id: string): Promise<Record>;
    update(id: string, data: Record | object): Promise<Record>;
    delete(id: string): Promise<boolean>;
  }

  export interface BaseAuthStore {
    model: AuthModel | null;
    token: string;
    isValid: boolean;
    clear(): void;
    save(token: string, model: AuthModel | null): void;
    onChange(callback: (token: string, model: AuthModel | null) => void): void;
  }

  export default class PocketBase {
    constructor(url: string);
    collection(name: string): Collection;
    authStore: BaseAuthStore;
    autoCancellation(enable: boolean): void;
  }
}
