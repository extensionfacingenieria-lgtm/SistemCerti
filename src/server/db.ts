import fs from "fs";
import path from "path";
import { Certificate, Stats } from "../types.js";

const DATA_DIR = path.join(process.cwd(), "data");
const CERTS_FILE = path.join(DATA_DIR, "db.json");
const STATS_FILE = path.join(DATA_DIR, "stats.json");

// Ensure files and directories exist
function ensureDataStructure() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CERTS_FILE)) {
    fs.writeFileSync(CERTS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
  if (!fs.existsSync(STATS_FILE)) {
    fs.writeFileSync(STATS_FILE, JSON.stringify({ visitCount: 0 }, null, 2), "utf-8");
  }
}

export function loadCertificates(): Certificate[] {
  ensureDataStructure();
  try {
    const data = fs.readFileSync(CERTS_FILE, "utf-8");
    return JSON.parse(data) as Certificate[];
  } catch (error) {
    console.error("Error reading certificates file:", error);
    return [];
  }
}

export function saveCertificates(certs: Certificate[]): boolean {
  ensureDataStructure();
  try {
    fs.writeFileSync(CERTS_FILE, JSON.stringify(certs, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error saving certificates file:", error);
    return false;
  }
}

export function loadStats(): Stats {
  ensureDataStructure();
  try {
    const data = fs.readFileSync(STATS_FILE, "utf-8");
    return JSON.parse(data) as Stats;
  } catch (error) {
    console.error("Error reading stats file:", error);
    return { visitCount: 0 };
  }
}

export function saveStats(stats: Stats): boolean {
  ensureDataStructure();
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error saving stats file:", error);
    return false;
  }
}

export function incrementVisitCount(): number {
  const stats = loadStats();
  stats.visitCount += 1;
  saveStats(stats);
  return stats.visitCount;
}
