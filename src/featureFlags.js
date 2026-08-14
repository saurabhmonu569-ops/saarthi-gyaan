/**
 * SAARTHI — feature switch
 * =====================================================================
 * Ek jagah, taaki koi cheez chalu/band karne ke liye kai files me
 * dhoondhna na pade.
 */

/**
 * READ (Books) tab user ko dikhe ya nahi.                    (2026-08-14)
 *
 * SAURABH ka faisla: "user ko Read sec ka option hi na dikhe, baaki sab
 * chalta rahe."
 *
 * ⚠️ CODE HATAYA NAHI GAYA — SIRF CHHUPAYA HAI.
 * BooksView.jsx, uska data, aur App.jsx me uska pane — sab jaise the
 * waise hain. Yahan `false` se `true` karne par Read tab poora ka poora
 * wapas aa jaata hai, aur kuch nahi karna padta.
 *
 * Aisa kyun (hatane ke bajay chhupana):
 *   1. Faisla palat sakta hai. Hatane par wapas laana ek din ka kaam
 *      hota; chhupane par ek line ka hai.
 *   2. BooksView ka chapter-reader wahi `useKnowledge` istemaal karta
 *      hai jo Search karta hai. Use nikaalne par Search ke kod ko bhi
 *      chhedna padta — aur Search ko chalte rehna hai.
 *
 * ⚠️ YE SIRF UI KA PARDA HAI, SURAKSHA NAHI.
 * `/knowledge/books/*.json` aur `/books/*.pdf` abhi bhi seedhe URL par
 * khule hain. Kisi ko unhe utaarne se rokna ho to wo alag kaam hai
 * (task #28) — is switch se uska koi lena-dena nahi.
 *
 * KYA ASAR NAHI PADTA (jaancha gaya, 14 Aug):
 *   Ask     — Worker /search par hai, isse koi rishta nahi
 *   Search  — apna corpus khud utaarta hai (visited.has("search")),
 *             BooksView par nirbhar nahi
 *   Amrit   — alag file (/knowledge/amrit.json)
 *   PDF     — Upload tab, alag raasta
 */
export const READ_TAB_DIKHAO = false;
