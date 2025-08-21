// src/features/match-history/matchHistoryService.js

// This service writes to Firebase Firestore if window.firebase/app is set up.
// Otherwise it falls back to localStorage so the feature works in the MVP.

const LS_KEY = "fitfinder.matchHistory.v1";

// Normalize localStorage shape:
// {
//   [uid]: {
//     [opportunityId]: [
//       { timestamp, score, delta, note, opportunityName }
//     ]
//   }
// }

function readLS() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLS(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export async function recordFitScore({ uid, opportunityId, opportunityName, newScore, note = "" }) {
  const ts = Date.now();

  // If Firebase exists, try Firestore write
  try {
    const fb = await tryGetFirebase();
    if (fb) {
      const { getFirestore, doc, collection, addDoc } = await import("firebase/firestore");
      const db = getFirestore(fb.app);
      // users/{uid}/matchHistory/{opportunityId}/entries
      const entriesCol = collection(
        db,
        "users",
        uid,
        "matchHistory",
        opportunityId,
        "entries"
      );
      const last = await getLastScoreFirebase({ db, uid, opportunityId });
      const delta = last == null ? 0 : newScore - last;
      await addDoc(entriesCol, {
        timestamp: ts,
        score: newScore,
        delta,
        note,
        opportunityName: opportunityName || ""
      });
      return;
    }
  } catch (e) {
    // fall back to LS
    console.warn("Firestore write failed or not configured, using localStorage.", e);
  }

  // LocalStorage fallback
  const data = readLS();
  const userData = data[uid] || {};
  const list = userData[opportunityId] || [];
  const last = list.length ? list[list.length - 1].score : null;
  const delta = last == null ? 0 : newScore - last;

  list.push({
    timestamp: ts,
    score: newScore,
    delta,
    note,
    opportunityName: opportunityName || ""
  });

  userData[opportunityId] = list;
  data[uid] = userData;
  writeLS(data);
}

export async function getAllHistory({ uid }) {
  // If Firebase available, read from it; else from LS
  try {
    const fb = await tryGetFirebase();
    if (fb) {
      const { getFirestore, collection, getDocs } = await import("firebase/firestore");
      const db = getFirestore(fb.app);
      const root = collection(db, "users", uid, "matchHistory");
      const groupsSnap = await getDocs(root);

      const result = {};
      for (const g of groupsSnap.docs) {
        const oppId = g.id;
        const entriesCol = collection(db, "users", uid, "matchHistory", oppId, "entries");
        const entriesSnap = await getDocs(entriesCol);
        result[oppId] = entriesSnap.docs
          .map(d => d.data())
          .sort((a, b) => a.timestamp - b.timestamp);
      }
      return result;
    }
  } catch (e) {
    console.warn("Firestore read failed or not configured, using localStorage.", e);
  }

  // LS
  const data = readLS();
  return data[uid] || {};
}

async function tryGetFirebase() {
  try {
    // If your app initializes Firebase in a module, you can import it here
    // Assumes src/firebase.js exports { app }
    const mod = await import("../../firebase.js").catch(() => null);
    if (mod && mod.app) {
      return { app: mod.app };
    }
  } catch {
    // ignore
  }
  return null;
}

async function getLastScoreFirebase({ db, uid, opportunityId }) {
  const { collection, getDocs, orderBy, query, limit } = await import("firebase/firestore");
  const entriesCol = collection(db, "users", uid, "matchHistory", opportunityId, "entries");
  const q = query(entriesCol, orderBy("timestamp", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.docs.length === 0) return null;
  return snap.docs[0].data().score ?? null;
}
