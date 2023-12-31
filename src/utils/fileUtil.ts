import fs from "fs";
import path from "path";

const baseDir = __dirname;

function getCacheFilePath(fileName: string): string {
  return path.join(baseDir, fileName);
}

export function loadCacheFromFile(fileName: string): Map<string, string> {
  const filePath = getCacheFilePath(fileName);
  if (fs.existsSync(filePath)) {
    const fileData = fs.readFileSync(filePath, "utf-8");
    return new Map(JSON.parse(fileData));
  }
  return new Map();
}

export function saveCacheToFile(
  cache: Map<string, string>,
  fileName: string
): void {
  const filePath = getCacheFilePath(fileName);
  const arrayifiedData = Array.from(cache.entries());
  const jsonData = JSON.stringify(arrayifiedData, null, 2);
  fs.writeFileSync(filePath, jsonData, "utf-8");
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
