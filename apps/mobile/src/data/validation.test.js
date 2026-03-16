import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidApiBaseUrl,
  parseGamesLines,
  validateAddGamesForm,
  validateDiskSideTitlesText,
} from "./validation.js";

test("isValidApiBaseUrl supports empty and http(s) URLs", () => {
  assert.equal(isValidApiBaseUrl(""), true);
  assert.equal(isValidApiBaseUrl("http://localhost:5000"), true);
  assert.equal(isValidApiBaseUrl("https://example.com/api"), true);
  assert.equal(isValidApiBaseUrl("ftp://example.com"), false);
  assert.equal(isValidApiBaseUrl("not-a-url"), false);
});

test("parseGamesLines strips blanks and whitespace", () => {
  const list = parseGamesLines(" Pitstop II \n\n  Impossible Mission \n");
  assert.deepEqual(list, ["Pitstop II", "Impossible Mission"]);
});

test("validateDiskSideTitlesText requires at least one title", () => {
  assert.equal(validateDiskSideTitlesText("").valid, false);
  const ok = validateDiskSideTitlesText("Summer Games");
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.titles, ["Summer Games"]);
});

test("validateAddGamesForm validates existing-store mode", () => {
  const fail = validateAddGamesForm({
    mode: "existing",
    datasetKey: "",
    diskId: "",
    side: "",
    gamesText: "",
  });
  assert.equal(fail.valid, false);
  assert.ok(fail.errors.datasetKey);
  assert.ok(fail.errors.diskId);
  assert.ok(fail.errors.gamesText);
});

test("validateAddGamesForm validates new-store mode", () => {
  const ok = validateAddGamesForm({
    mode: "new",
    newStoreName: "My Store",
    diskId: "8",
    side: "sideA",
    gamesText: "1942\nCommando",
  });
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.normalized.games, ["1942", "Commando"]);
});

