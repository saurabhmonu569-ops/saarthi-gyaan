import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * SAARTHI — /search ko KYA bheja ja raha hai   2026-08-18
 * =====================================================================
 * ⚠️ YE TEST IS FILE KE LIYE NAHI, US SEEMA KE LIYE HAI JAHAN CLIENT AUR
 * SERVER MILTE HAIN. Us seema par is project me DO baar chot lag chuki hai:
 *
 *   10 Agast — client 0.30 maang raha tha, server 0.18 de raha tha.
 *              Aadhaar POORA GAAYAB ho gaya.
 *   18 Agast — debug-query.mjs `toDevanagari()` seedha bhej rahi thi
 *              jabki app teen kadam se guzarti hai. Uske saare nidaan
 *              app ke the hi nahi.
 *
 * Aaj query banana client se worker par gaya. Client ka poora hissa ab
 * EK LINE hai — `{ q: q.trim() }`. Ek line "itni chhoti hai ki toot hi
 * nahi sakti" lagti hai; upar wali dono chot bhi utni hi chhoti thi.
 *
 * Aur ise pakadne ka koi doosra raasta nahi hai: `npm run dev` par
 * /search 403 deta hai (localhost ALLOWED_ORIGINS me nahi), yaani ye
 * poora raasta browser me sirf PRODUCTION par hi chal kar dikhta hai.
 * Ye test wahi jagah hai jahan wo bina deploy kiye jaanchi ja sakti hai.
 *
 * JO JAANCHA JA RAHA HAI:
 *   • body me SIRF `q` jaaye — client ab findQ/rerankQ/hintedBook na bheje
 *   • `q` kaccha sawaal ho — client use badle NA (wahi to poora point hai)
 *   • khaali/space-only sawaal par network call ho hi na
 *   • Worker gire to KHAALI laute, throw NA kare (chat tootna nahi chahiye)
 */

const PROXY = "https://test-worker.example.com";

let fetchMock;

beforeEach(() => {
  vi.resetModules();                       // module-level AI_PROXY_URL dobara pade
  vi.stubEnv("VITE_AI_PROXY_URL", PROXY);
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ chunks: [], stats: { pool: 0, ms: 1 } }),
  }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** ⚠️ Dynamic import — AI_PROXY_URL module load par pada jaata hai, isliye
 *  stubEnv ke BAAD import hona chahiye. Upar static import likhne par ye
 *  test chup-chaap har baar "URL set nahi hai" wale raaste par chala jaata
 *  aur kabhi kuch jaanchta hi nahi. */
const load = () => import("./serverSearch.js");

const bhejaGayaBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe("serverRetrieve — /search ko kya jaata hai", () => {
  it("body me SIRF kaccha sawaal jaata hai", async () => {
    const { serverRetrieve } = await load();
    await serverRetrieve({ q: "गीता में कर्म योग क्या है?" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${PROXY}/search`);
    expect(bhejaGayaBody()).toEqual({ q: "गीता में कर्म योग क्या है?" });
  });

  // ⚠️ YE SABSE ZAROORI JAANCH HAI. Poora badlaav isi baat par tika hai ki
  // client query ko CHHEDE NA. Agar kabhi koi yahan "thoda-sa saaf kar dete
  // hain" likh de, to client aur worker phir se do alag query banane
  // lagenge — aur wo chup-chaap hoga.
  it("client sawaal ko badalta NAHI (na translit, na paryay)", async () => {
    const { serverRetrieve } = await load();
    const kaccha = "gita me karma yog kya hai";
    await serverRetrieve({ q: kaccha });
    expect(bhejaGayaBody().q).toBe(kaccha);       // Devanagari me NAHI badla
  });

  it("purane khet (findQ/rerankQ/hintedBook) ab nahi jaate", async () => {
    const { serverRetrieve } = await load();
    await serverRetrieve({ q: "धर्म" });
    const body = bhejaGayaBody();
    expect(body).not.toHaveProperty("findQ");
    expect(body).not.toHaveProperty("rerankQ");
    expect(body).not.toHaveProperty("hintedBook");
  });

  it("aage-peeche ki khaali jagah kat jaati hai", async () => {
    const { serverRetrieve } = await load();
    await serverRetrieve({ q: "  धर्म क्या है  " });
    expect(bhejaGayaBody().q).toBe("धर्म क्या है");
  });

  it("khaali sawaal par network call hoti hi nahi", async () => {
    const { serverRetrieve } = await load();
    expect(await serverRetrieve({ q: "" })).toEqual({ chunks: [], stats: null });
    expect(await serverRetrieve({ q: "   " })).toEqual({ chunks: [], stats: null });
    expect(await serverRetrieve({ q: undefined })).toEqual({ chunks: [], stats: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/**
 * FAIL-SOFT — user ka apna niyam: "agar 1% bhi jawab nahi mila toh saada
 * jawab dena, source ke bina bhi chalega."
 *
 * Yaani /search ka girna Ask section ko GIRA NAHI sakta. Throw karne par
 * poora chat toot jaata aur user ko kuch bhi nahi milta.
 */
describe("serverRetrieve — girne par bhi chat zinda rahe", () => {
  it("Worker 5xx de to khaali lautata hai, throw nahi", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" });
    const { serverRetrieve } = await load();
    await expect(serverRetrieve({ q: "धर्म" })).resolves.toEqual({ chunks: [], stats: null });
  });

  it("network hi gir jaye to bhi khaali lautata hai", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const { serverRetrieve } = await load();
    await expect(serverRetrieve({ q: "धर्म" })).resolves.toEqual({ chunks: [], stats: null });
  });

  // 403 wahi haalat hai jo aaj localhost par mili — origin allowed nahi.
  // User ko tab bhi jawab milna chahiye, bas bina Aadhaar ke.
  it("403 (origin allowed nahi) par bhi khaali, throw nahi", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => "Origin not allowed" });
    const { serverRetrieve } = await load();
    await expect(serverRetrieve({ q: "धर्म" })).resolves.toEqual({ chunks: [], stats: null });
  });
});
