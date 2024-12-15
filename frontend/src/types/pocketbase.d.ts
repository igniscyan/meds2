import PocketBase from 'pocketbase';

declare module 'pocketbase' {
  export interface Record<T = any> {
    id: string;
    created: string;
    updated: string;
    collectionId: string;
    collectionName: string;
    expand?: { [key: string]: any };
  }

  export interface BaseModel extends Record {
    [key: string]: any;
  }

  interface BaseQueryOptions {
    expand?: string;
    fields?: string;
    $autoCancel?: boolean;
  }

  interface GetOptions extends BaseQueryOptions {}

  interface ListOptions extends BaseQueryOptions {
    page?: number;
    perPage?: number;
    sort?: string;
    filter?: string;
  }

  interface ListResult<T> {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
    items: T[];
  }

  interface Collection {
    getList<T extends Record = Record>(page?: number, perPage?: number, options?: ListOptions): Promise<ListResult<T>>;
    getOne<T extends Record = Record>(id: string, options?: GetOptions): Promise<T>;
    getFirstListItem<T extends Record = Record>(filter: string, options?: ListOptions): Promise<T>;
    create<T extends Record = Record>(bodyParams: { [key: string]: any }, options?: any): Promise<T>;
    update<T extends Record = Record>(id: string, bodyParams: { [key: string]: any }, options?: any): Promise<T>;
    delete(id: string, options?: any): Promise<boolean>;
  }

  interface PocketBase {
    collection(idOrName: string): Collection;
  }
} 