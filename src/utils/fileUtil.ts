import fs from "fs";
import path from "path";
import { Action } from "../agents/parsingAgent";

const baseDir = __dirname;

function getCacheFilePath(fileName: string): string {
  return path.join(baseDir, "cache", fileName);
}

export function loadCacheFromFile(fileName: string): Map<string, object> {
  const filePath = getCacheFilePath(fileName);

  if (fs.existsSync(filePath)) {
    const fileData = fs.readFileSync(filePath, "utf-8");
    const rawCacheData: [string, object][] = JSON.parse(fileData);
    return new Map(rawCacheData);
  }

  return new Map();
}

export function saveCacheToFile(
  cache: Map<string, object>,
  fileName: string
): void {
  const filePath = getCacheFilePath(fileName);
  const dirPath = path.dirname(filePath);

  // 'cache' 폴더가 없으면 생성합니다.
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const arrayifiedData: [string, object][] = Array.from(cache.entries());
  const jsonData = JSON.stringify(arrayifiedData, null, 2);
  fs.writeFileSync(filePath, jsonData, "utf-8");
}

export function loadJsonFromFile(fileName: string): object {
  const filePath = getCacheFilePath(fileName);
  if (fs.existsSync(filePath)) {
    const fileData = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileData);
  }
  return {};
}

export function loadObjectArrayFromFile<T>(fileName: string): T[] {
  const filePath = getCacheFilePath(fileName);
  if (fs.existsSync(filePath)) {
    const fileData = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileData) as T[];
  }
  return [];
}

export function saveObjectArrayToFile<T>(array: T[], fileName: string): void {
  const filePath = getCacheFilePath(fileName);
  const jsonData = JSON.stringify(array, null, 2);
  fs.writeFileSync(filePath, jsonData, "utf-8");
}

export function deleteFile(fileName: string): void {
  const filePath = getCacheFilePath(fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export class ActionCache {
  private cache: Map<string, object>;
  private cacheFileName: string;

  constructor(cacheFileName: string) {
    this.cache = loadCacheFromFile(cacheFileName);
    this.cacheFileName = cacheFileName;
  }

  get(identifier: string): Action | undefined {
    return this.cache.get(identifier) as Action | undefined;
  }

  set(identifier: string, action: Action) {
    this.cache.set(identifier, action);
  }

  save() {
    saveCacheToFile(this.cache, this.cacheFileName);
  }

  clear() {
    this.cache.clear();
    saveCacheToFile(this.cache, this.cacheFileName);
  }
}

interface Screen {
  type: string;
  screenDescription: string;
  screenDescriptionKorean: string;
}

export class ScreenCache {
  private cache: Map<string, object>;
  private cacheFileName: string;

  constructor(cacheFileName: string) {
    this.cache = loadCacheFromFile(cacheFileName);
    this.cacheFileName = cacheFileName;
  }

  get(identifier: string): Screen | undefined {
    return this.cache.get(identifier) as Screen | undefined;
  }

  set(identifier: string, screen: Screen) {
    this.cache.set(identifier, screen);
  }

  save() {
    saveCacheToFile(this.cache, this.cacheFileName);
  }

  clear() {
    this.cache.clear();
    saveCacheToFile(this.cache, this.cacheFileName);
  }
}

export type Row = {
  data: any;
  i: string;
  description: string | undefined;
  actionType: string;
  content: string;
};

export class TableCache {
  private cache: Map<string, object>;
  private cacheFileName: string;

  constructor(cacheFileName: string) {
    this.cache = loadCacheFromFile(cacheFileName);
    this.cacheFileName = cacheFileName;
  }

  get(identifier: string): Row | undefined {
    return this.cache.get(identifier) as Row | undefined;
  }

  set(identifier: string, row: Row) {
    this.cache.set(identifier, row);
  }

  save() {
    saveCacheToFile(this.cache, this.cacheFileName);
  }

  clear() {
    this.cache.clear();
    saveCacheToFile(this.cache, this.cacheFileName);
  }
}

export class AttrCache {
  private cache: Map<string, object>;
  private cacheFileName: string;

  constructor(cacheFileName: string) {
    this.cache = loadCacheFromFile(cacheFileName);
    this.cacheFileName = cacheFileName;
  }

  get(identifier: string): Record<string, string> | undefined {
    return this.cache.get(identifier) as Record<string, string> | undefined;
  }

  set(identifier: string, attr: Record<string, string>) {
    this.cache.set(identifier, attr);
  }

  save() {
    saveCacheToFile(this.cache, this.cacheFileName);
  }

  clear() {
    this.cache.clear();
    saveCacheToFile(this.cache, this.cacheFileName);
  }
}
