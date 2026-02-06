#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const HISTORY_ROOT = ".flow-history";

function usage() {
  console.log("Usage:");
  console.log(
    "  node skills/sduit-sdui-flow-assistant/scripts/flow_snapshot.mjs snapshot <journey-json-path> [label]"
  );
  console.log(
    "  node skills/sduit-sdui-flow-assistant/scripts/flow_snapshot.mjs list <journey-json-path>"
  );
  console.log(
    "  node skills/sduit-sdui-flow-assistant/scripts/flow_snapshot.mjs restore <journey-json-path> <snapshot-path>"
  );
}

function sanitizeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function ensureJsonFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }
}

function getJourneyHistoryDir(journeyPath) {
  const baseName = sanitizeName(path.basename(journeyPath, path.extname(journeyPath)));
  return path.resolve(process.cwd(), HISTORY_ROOT, baseName);
}

function makeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function snapshotJourney(journeyPath, label = "") {
  ensureJsonFileExists(journeyPath);

  // Verify source file is valid JSON before snapshotting
  JSON.parse(fs.readFileSync(journeyPath, "utf8"));

  const historyDir = getJourneyHistoryDir(journeyPath);
  fs.mkdirSync(historyDir, { recursive: true });

  const safeLabel = label ? `-${sanitizeName(label)}` : "";
  const fileName = `${makeTimestamp()}${safeLabel}.json`;
  const snapshotPath = path.join(historyDir, fileName);

  fs.copyFileSync(journeyPath, snapshotPath);

  console.log(`Snapshot created: ${snapshotPath}`);
}

function listSnapshots(journeyPath) {
  const historyDir = getJourneyHistoryDir(journeyPath);
  if (!fs.existsSync(historyDir)) {
    console.log(`No snapshots found for ${journeyPath}`);
    return;
  }

  const files = fs
    .readdirSync(historyDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log(`No snapshots found for ${journeyPath}`);
    return;
  }

  console.log(`Snapshots for ${journeyPath}:`);
  files.forEach((file) => {
    console.log(`- ${path.join(historyDir, file)}`);
  });
}

function restoreJourney(journeyPath, snapshotPathInput) {
  const snapshotPath = path.resolve(process.cwd(), snapshotPathInput);

  ensureJsonFileExists(snapshotPath);
  ensureJsonFileExists(journeyPath);

  // Verify snapshot payload is valid JSON before restore
  JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

  fs.copyFileSync(snapshotPath, journeyPath);
  console.log(`Restored ${journeyPath} from ${snapshotPath}`);
}

function main() {
  const [command, journeyArg, thirdArg] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(command ? 0 : 1);
  }

  if (!journeyArg) {
    usage();
    process.exit(1);
  }

  const journeyPath = path.resolve(process.cwd(), journeyArg);

  try {
    if (command === "snapshot") {
      snapshotJourney(journeyPath, thirdArg || "");
      return;
    }

    if (command === "list") {
      listSnapshots(journeyPath);
      return;
    }

    if (command === "restore") {
      if (!thirdArg) {
        usage();
        process.exit(1);
      }
      restoreJourney(journeyPath, thirdArg);
      return;
    }

    usage();
    process.exit(1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
