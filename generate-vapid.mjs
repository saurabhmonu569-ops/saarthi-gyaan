// SAARTHI — VAPID key generator
// Chalao:  node generate-vapid.mjs
//
// Ek matched pair banata hai aur use vapid-keys.txt me SAVE karta hai,
// taaki terminal scrollback se copy karne ki zaroorat na pade (pichli baar
// wahi mix-up 403 ka kaaran bana tha).
// Kuch network pe nahi jaata, sab local hai.

import { webcrypto as crypto } from "node:crypto";
import { writeFileSync } from "node:fs";

const kp = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);

const p = await crypto.subtle.exportKey("jwk", kp.privateKey);
const jwk = { kty: p.kty, crv: p.crv, x: p.x, y: p.y, d: p.d };

const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
const pub = Buffer.from(raw).toString("base64url");

// Sanity check — public key ka tail JWK ke y se match karna chahiye
const ok = pub.endsWith(jwk.y) && pub.length === 87;

const out = `SAARTHI VAPID KEYS — generated ${new Date().toISOString()}
=====================================================================
IN DONO VALUES KO HAMESHA SAATH ME UPDATE KARNA. Alag runs se mix
karoge to push bhejte waqt HTTP 403 aayega.

---------------------------------------------------------------------
1) CLOUDFLARE  →  saarthi-ai → Settings → Variables and Secrets
   Type: Secret   Name: VAPID_PRIVATE_JWK
---------------------------------------------------------------------
${JSON.stringify(jwk)}

---------------------------------------------------------------------
2) CLOUDFLARE  →  same page
   Type: Text     Name: VAPID_PUBLIC_KEY
   NETLIFY        Name: VITE_VAPID_PUBLIC_KEY   (bilkul yahi value)
   LOCAL .env     Name: VITE_VAPID_PUBLIC_KEY   (bilkul yahi value)
---------------------------------------------------------------------
${pub}

---------------------------------------------------------------------
self-check: ${ok ? "PASS — pair valid (87 chars, y matches)" : "FAIL — dobara chalao"}
=====================================================================
`;

writeFileSync("vapid-keys.txt", out);
console.log(out);
console.log(">> vapid-keys.txt me save ho gaya. Wahin se copy karo.");
console.log(">> Cloudflare/Netlify me daalne ke baad ye file DELETE kar dena.\n");
