/**
 * SAARTHI — vitest setup
 * =====================================================================
 * NODE 22 KA localStorage TAKRAAV (2026-08-03 mein pakda)
 *
 * Node 22 ne apna EXPERIMENTAL `localStorage` global joda hai. Woh
 * globalThis par pehle se maujood rehta hai, par `--localstorage-file`
 * flag diye bina hamesha `undefined` rehta hai:
 *
 *     ExperimentalWarning: localStorage is not available because
 *     --localstorage-file was not provided.
 *
 * Vitest ka jsdom environment jab window ki properties globalThis par
 * copy karta hai, tab yeh pehle se baitha hua global usse rok deta hai —
 * chup-chaap. Nateeja: `environment: "jsdom"` set hone ke BAAWAJOOD
 * localStorage undefined milta hai, aur quota.test.js ke saare 8 tests
 * `beforeEach` mein hi mar jaate hain.
 *
 * Kisi ne code nahi toda — Node upgrade hone par test infra chup-chaap
 * kharab ho gaya. (Wahi pattern jo is poore audit mein baar-baar mila:
 * chup-chaap fail hone wali cheezein mahino tak nahi dikhtin.)
 *
 * Yahan hum jsdom ka asli localStorage globalThis par jabardasti bithaate
 * hain; woh na ho toh ek simple in-memory version.
 */

function makeMemoryStorage() {
  const store = new Map();
  return {
    getItem(k) { const key = String(k); return store.has(key) ? store.get(key) : null; },
    setItem(k, v) { store.set(String(k), String(v)); },
    removeItem(k) { store.delete(String(k)); },
    clear() { store.clear(); },
    key(i) { return [...store.keys()][i] ?? null; },
    get length() { return store.size; },
  };
}

function install(name) {
  const fromJsdom = typeof window !== "undefined" ? window[name] : undefined;
  // Kaam kar raha hai ya nahi — maan mat lo, chala kar dekho.
  let usable = false;
  try {
    if (fromJsdom && typeof fromJsdom.setItem === "function") {
      fromJsdom.setItem("__saarthi_probe__", "1");
      fromJsdom.removeItem("__saarthi_probe__");
      usable = true;
    }
  } catch { usable = false; }

  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: usable ? fromJsdom : makeMemoryStorage(),
  });
}

install("localStorage");
install("sessionStorage");
