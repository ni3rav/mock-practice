import { validateImport } from "./logic/validate.js";

const DB_NAME = "astound-prep";
const DB_VERSION = 1;

let dbPromise;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("questions")) {
          db.createObjectStore("questions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("tests")) {
          db.createObjectStore("tests", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("attempts")) {
          const store = db.createObjectStore("attempts", { keyPath: "id" });
          store.createIndex("testId", "testId", { unique: false });
          store.createIndex("status", "status", { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export async function importBank(data) {
  const db = await openDb();
  const readTx = db.transaction("questions", "readonly");
  const existingIds = await requestToPromise(
    readTx.objectStore("questions").getAllKeys()
  );

  const result = validateImport(data, existingIds);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }

  const updatedAt = Date.now();
  const writeTx = db.transaction(["questions", "tests"], "readwrite");
  const done = transactionDone(writeTx);
  const questionsStore = writeTx.objectStore("questions");
  const testsStore = writeTx.objectStore("tests");

  for (const question of result.questions) {
    questionsStore.put({ ...question, updatedAt });
  }
  for (const test of result.tests) {
    testsStore.put({ ...test, updatedAt });
  }
  await done;

  return {
    ok: true,
    questionCount: result.questions.length,
    testCount: result.tests.length,
  };
}

export async function getAllTests() {
  const db = await openDb();
  const tx = db.transaction("tests", "readonly");
  const tests = await requestToPromise(tx.objectStore("tests").getAll());
  return tests.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getTest(id) {
  const db = await openDb();
  const tx = db.transaction("tests", "readonly");
  const test = await requestToPromise(tx.objectStore("tests").get(id));
  return test ?? null;
}

export async function getQuestion(id) {
  const db = await openDb();
  const tx = db.transaction("questions", "readonly");
  const question = await requestToPromise(tx.objectStore("questions").get(id));
  return question ?? null;
}

export async function findInProgress(testId) {
  const db = await openDb();
  const tx = db.transaction("attempts", "readonly");
  const attempts = await requestToPromise(
    tx.objectStore("attempts").index("testId").getAll(testId)
  );
  return attempts.find((attempt) => attempt.status === "in_progress") ?? null;
}

export async function putAttempt(attempt) {
  const db = await openDb();
  const tx = db.transaction("attempts", "readwrite");
  const done = transactionDone(tx);
  tx.objectStore("attempts").put(attempt);
  await done;
}

export async function deleteAttempt(id) {
  const db = await openDb();
  const tx = db.transaction("attempts", "readwrite");
  const done = transactionDone(tx);
  tx.objectStore("attempts").delete(id);
  await done;
}

export async function getAttempt(id) {
  const db = await openDb();
  const tx = db.transaction("attempts", "readonly");
  const attempt = await requestToPromise(tx.objectStore("attempts").get(id));
  return attempt ?? null;
}

export async function listSubmittedAttempts() {
  const db = await openDb();
  const tx = db.transaction("attempts", "readonly");
  const attempts = await requestToPromise(
    tx.objectStore("attempts").index("status").getAll("submitted")
  );
  return attempts.sort((a, b) => b.submittedAt - a.submittedAt);
}
