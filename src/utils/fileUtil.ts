import fs from "fs";
import path from "path";

const parsingCacheFilePath = path.join(__dirname, "descriptionCache.json");

export function loadParsingCacheFromFile() {
  if (fs.existsSync(parsingCacheFilePath)) {
    const fileData = fs.readFileSync(parsingCacheFilePath, "utf-8");
    return new Map(JSON.parse(fileData));
  }
  return new Map();
}

export function saveParsingCacheToFile(cache: Map<string, string>) {
  const arrayifiedData = Array.from(cache.entries());
  const jsonData = JSON.stringify(arrayifiedData, null, 2);
  fs.writeFileSync(parsingCacheFilePath, jsonData, "utf-8");
}

export function deleteParsingCacheFile() {
  if (fs.existsSync(parsingCacheFilePath)) {
    fs.unlinkSync(parsingCacheFilePath);
  }
}

const questionCacheFilePath = path.join(__dirname, "questionCache.json");

export function loadQuestionCacheFromFile() {
  if (fs.existsSync(questionCacheFilePath)) {
    const fileData = fs.readFileSync(questionCacheFilePath, "utf-8");
    return new Map(JSON.parse(fileData));
  }
  return new Map();
}

export function saveQuestionCacheToFile(cache: Map<string, string>) {
  const arrayifiedData = Array.from(cache.entries());
  const jsonData = JSON.stringify(arrayifiedData, null, 2);
  fs.writeFileSync(questionCacheFilePath, jsonData, "utf-8");
}

export function deleteQuestionCacheFile() {
  if (fs.existsSync(questionCacheFilePath)) {
    fs.unlinkSync(questionCacheFilePath);
  }
}
