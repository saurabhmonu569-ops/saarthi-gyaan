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

/**
 * Asli PDF web par parosein ya nahi.                          (2026-08-17)
 *
 * `false` ke saath `public/books/` ki 23 PDF (586 MB) build me jaati hi
 * nahi — wo `data/books-pdf/` me rehti hain, repo me rehti hain, aapke
 * paas rehti hain. Bas Netlify par nahi jaati.
 *
 * ⚠️ YE SUVIDHA KA FAISLA NAHI, KANOON KA HAI
 * --------------------------------------------
 * copyright_findings.md me teen kitaabein HIGH RISK hain — Rigveda aur
 * Atharvaveda (Sanskrit Sahitya Prakashan, 2015, ISBN + © chhapa hua) aur
 * Mantra Maha Sagar (Chowkhamba Krishnadas Academy, ISBN 978-81-218-0352-6,
 * 2nd edn. 2017, ₹525). Teenon AAJ BHI bik rahi hain.
 *
 * 17 Aug tak unki poori scan seedhe URL par khuli thi —
 *     saarthi-gyaan.netlify.app/books/rigveda_1.pdf
 * bina login, bina kisi rok ke. Read tab 14 Aug ko chhupa diya gaya tha,
 * par wo PARDA tha, TAALA nahi — URL jaanne wala phir bhi utaar leta.
 *
 * KYA TOOTA (poora, ginti ke saath):
 *   Search ke har nateeje ke aage jo chhota "📄 p.12" link tha — wo ek.
 *   Bas. Read tab pehle se chhupa hai, isliye uske PDF-iframe kabhi
 *   render hote hi nahi the.
 *
 * KYA NAHI TOOTA: Ask ka poora jawab aur Aadhaar, Search ka poora nateeja
 * aur uska paath, adhyay ki soochi, granth ke naam, Amrit, Upload.
 *
 * ⚠️ Ise `true` karne se PEHLE: PDF wapas `public/books/` me laani hongi,
 * AUR publisher ki likhit anumati chahiye. Bina uske ye sirf wahi khatra
 * wapas laana hai. Anumati mile to use `src/data/bookRights.js` me darj
 * karein — wahi jagah hai jahan har granth ka adhikaar likha hai.
 */
export const PDF_PAROSO = false;
