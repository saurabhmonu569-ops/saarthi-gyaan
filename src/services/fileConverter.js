/**
 * SAARTHI — File Converter (Word → PDF, JPG/PNG → PDF)
 * =====================================================
 * User item #10 ka bacha hissa: PDF section mein ab sirf .pdf nahi,
 * .docx (Word) aur .jpg/.jpeg/.png (photo) bhi upload ki ja sakti hain —
 * yeh service unhe seedhe browser mein (CDN libraries se) ek asli PDF
 * Blob mein badal deti hai, phir wahi purani parsePdf() pipeline (PDF.js)
 * usse padh leti hai. Server ki zaroorat nahi, sab kuch user ke browser
 * mein hota hai — jaisa pdfParser.js mein PDF.js CDN se load hota hai.
 *
 * Libraries (CDN, sirf zaroorat padne par load hoti hain):
 *  - mammoth.js   → .docx ka text+formatting HTML mein nikalta hai
 *  - html2pdf.js  → HTML (ya seedha image) ko asli multi-page PDF banata hai
 *                   (yeh khud hi html2canvas + jsPDF istemal karta hai)
 */

const MAMMOTH_CDN  = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js";
const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js";
const SCRIPT_TIMEOUT_MS = 15_000;

// pdfParser.js jaisa hi robust script-loader — CDN slow/blocked ho toh
// hamesha ke liye latakne ke bajaye timeout ke saath saaf fail ho.
function injectScript(src, globalCheck) {
  return new Promise((resolve, reject) => {
    if (globalCheck()) { resolve(); return; }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Conversion engine load timed out — internet check karein."));
    }, SCRIPT_TIMEOUT_MS);

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      const started = Date.now();
      const poll = setInterval(() => {
        if (settled) { clearInterval(poll); return; }
        if (globalCheck()) {
          settled = true; clearTimeout(timer); clearInterval(poll); resolve();
        } else if (Date.now() - started > SCRIPT_TIMEOUT_MS) {
          settled = true; clearInterval(poll);
          reject(new Error("Conversion engine load timed out — internet check karein."));
        }
      }, 150);
      return;
    }

    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
    s.onerror = () => { if (settled) return; settled = true; clearTimeout(timer); reject(new Error("Conversion engine load fail hui — internet check karein.")); };
    document.head.appendChild(s);
  });
}

async function loadMammoth() {
  await injectScript(MAMMOTH_CDN, () => !!window.mammoth);
  return window.mammoth;
}
async function loadHtml2Pdf() {
  await injectScript(HTML2PDF_CDN, () => !!window.html2pdf);
  return window.html2pdf;
}

function pdfFileName(originalName) {
  return (originalName || "document").replace(/\.[a-zA-Z0-9]+$/, "") + ".pdf";
}

/**
 * .docx → PDF Blob (wrapped as a File, .pdf extension) — mammoth se HTML
 * nikal ke html2pdf se PDF banata hai. Tables/basic formatting theek se
 * aate hain; bahut complex layouts (multi-column, tracked-changes) mein
 * kuch farq aa sakta hai — yeh ek "best-effort" conversion hai, scanning
 * ke barabar sateek nahi.
 */
export async function convertDocxToPdf(file, onProgress) {
  onProgress?.("Word file padhi ja rahi hai…", 0.1);
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value || "";
  if (!html.trim()) {
    throw new Error("Is Word file mein koi padhne-layak text nahi mila. Kripya file check karein.");
  }

  onProgress?.("PDF mein badla ja raha hai…", 0.5);
  const html2pdf = await loadHtml2Pdf();

  // Offscreen container — user ko dikhta nahi, sirf render karke PDF
  // banane ke liye A4-jaisi width par rakha gaya hai.
  const container = document.createElement("div");
  container.style.cssText = "position:fixed; left:-9999px; top:0; width:780px; padding:24px; background:#fff; font-family:Arial,sans-serif; font-size:14px; line-height:1.6; color:#111;";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const pdfBlob = await html2pdf()
      .set({
        margin:      10,
        image:       { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF:       { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak:   { mode: ["css", "legacy"] },
      })
      .from(container)
      .outputPdf("blob");

    onProgress?.("Taiyaar!", 1);
    return new File([pdfBlob], pdfFileName(file.name), { type: "application/pdf" });
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Photo (.jpg/.jpeg/.png) → PDF Blob (ek page, poori photo). Kai chapters
 * ki photos ek saath chuni ho toh sab ek hi multi-page PDF mein ban jaati
 * hain (page-order = jis order mein files select ki gayi).
 */
export async function convertImagesToPdf(files, onProgress) {
  onProgress?.("Photo(s) PDF mein badli ja rahi hain…", 0.2);
  const html2pdf = await loadHtml2Pdf();

  const container = document.createElement("div");
  container.style.cssText = "position:fixed; left:-9999px; top:0; width:780px; background:#fff;";

  const fileArr = Array.from(files);
  for (let i = 0; i < fileArr.length; i++) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Photo padhi nahi ja saki: " + fileArr[i].name));
      reader.readAsDataURL(fileArr[i]);
    });
    const img = document.createElement("img");
    img.src = dataUrl;
    img.style.cssText = "display:block; width:100%; height:auto;" + (i < fileArr.length - 1 ? " page-break-after: always;" : "");
    container.appendChild(img);
  }
  document.body.appendChild(container);

  try {
    onProgress?.("PDF mein badla ja raha hai…", 0.6);
    const pdfBlob = await html2pdf()
      .set({
        margin:      5,
        image:       { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF:       { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak:   { mode: ["css"] },
      })
      .from(container)
      .outputPdf("blob");

    onProgress?.("Taiyaar!", 1);
    const name = fileArr.length > 1 ? "photos.pdf" : pdfFileName(fileArr[0].name);
    return new File([pdfBlob], name, { type: "application/pdf" });
  } finally {
    document.body.removeChild(container);
  }
}

export function isDocxFile(file) {
  return file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
         /\.docx$/i.test(file.name || "");
}
export function isImageFile(file) {
  return /^image\/(jpeg|jpg|png)$/i.test(file.type || "") || /\.(jpe?g|png)$/i.test(file.name || "");
}
