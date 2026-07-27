/**
 * SAARTHI — Real PDF Parser v3
 *
 * Uses PDF.js (CDN) to extract actual text from uploaded PDFs.
 * All processing is in the browser — no server needed.
 *
 * Fixes in v3:
 * - Removed invalid PDF.js config flags that caused worker crashes
 * - Fixed GlobalWorkerOptions worker config (use workerSrc instead)
 * - Voice preload at module load to avoid cold-start issues
 * - Correct onProgress signature (pct 0-1, page, total) — matches App.jsx caller
 * - Improved scanned-PDF detection threshold
 * - Added proper cleanup after parsing
 */

// ─── CDN SOURCES (tried in order) ────────────────────────────────────────────

const CDN_SOURCES = [
  {
    lib:    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  },
  {
    lib:    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    worker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  },
];

const MAX_CONTEXT_CHARS = 28_000;
const CHUNK_SIZE        = 1_800;
const CHUNK_OVERLAP     = 200;

// ─── PDF.JS LOADER ────────────────────────────────────────────────────────────

let _pdfjsLib   = null;
let _loadPromise = null;

async function loadPdfJs() {
  if (_pdfjsLib) return _pdfjsLib;

  // Deduplicate concurrent calls
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    // Already loaded by another script tag
    if (window.pdfjsLib) {
      _pdfjsLib = window.pdfjsLib;
      _configureWorker(_pdfjsLib, CDN_SOURCES[0].worker);
      return _pdfjsLib;
    }

    for (const src of CDN_SOURCES) {
      try {
        await injectScript(src.lib);
        if (window.pdfjsLib) {
          _pdfjsLib = window.pdfjsLib;
          _configureWorker(_pdfjsLib, src.worker);
          return _pdfjsLib;
        }
      } catch {
        // Try next CDN
      }
    }

    throw new Error(
      "Could not load the PDF engine.\n\n" +
      "Please check your internet connection and try again."
    );
  })();

  try {
    return await _loadPromise;
  } finally {
    _loadPromise = null;
  }
}

function _configureWorker(lib, workerSrc) {
  try {
    lib.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch {
    // If worker config fails, set workerSrc to empty string
    // PDF.js will run on the main thread (slower but functional)
    try { lib.GlobalWorkerOptions.workerSrc = ""; } catch {}
  }
}

// SCRIPT_TIMEOUT_MS: agar CDN slow/blocked ho (kuch office/college WiFi
// PDF.js CDN block kar dete hain), toh script tag hamesha ke liye latka reh
// sakta hai — na onload, na onerror. Isse user "PDF parsing…" par hamesha ke
// liye phansa reh jaata tha (ek asli "upload sometimes fails" wajah). Ab
// timeout ke baad hum agla CDN try karte hain.
const SCRIPT_TIMEOUT_MS = 12_000;

function injectScript(src) {
  return new Promise((resolve, reject) => {
    // Pehle se lagi tag ho toh bhi window.pdfjsLib set hone tak poll karo —
    // sirf tag ka hona kaafi nahi, pichla attempt adhoora bhi ho sakta hai.
    const existing = document.querySelector(`script[src="${src}"]`);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Script load timed out (12s): " + src));
    }, SCRIPT_TIMEOUT_MS);

    if (existing) {
      const started = Date.now();
      const poll = setInterval(() => {
        if (settled) { clearInterval(poll); return; }
        if (window.pdfjsLib) {
          settled = true;
          clearTimeout(timer);
          clearInterval(poll);
          resolve();
        } else if (Date.now() - started > SCRIPT_TIMEOUT_MS) {
          settled = true;
          clearInterval(poll);
          reject(new Error("Existing script tag never finished loading: " + src));
        }
      }, 150);
      return;
    }

    const s   = document.createElement("script");
    s.src     = src;
    s.async   = true;
    s.onload  = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    s.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("Script load failed: " + src));
    };
    document.head.appendChild(s);
  });
}

// ─── TEXT EXTRACTION ──────────────────────────────────────────────────────────

/**
 * Extract text from PDF ArrayBuffer, page by page.
 *
 * @param {ArrayBuffer} buffer
 * @param {(pct: number, currentPage: number, totalPages: number) => void} onProgress
 * @returns {Promise<{ pages: string[], fullText: string, pageCount: number }>}
 */
async function extractPdfText(buffer, onProgress) {
  const lib = await loadPdfJs();

  // Open document — minimal options to avoid browser compatibility issues
  // loadingTask hoisted so finally block can call .destroy() and release worker memory
  let pdf;
  let loadingTask;
  try {
    loadingTask = lib.getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked: true,
    });
    pdf = await loadingTask.promise;
  } catch (err) {
    const msg = err?.message || "";
    if (/password/i.test(msg) || err?.name === "PasswordException") {
      throw new Error(
        "This PDF is password-protected.\n\n" +
        "Please remove the password first:\n" +
        "Open in Adobe Acrobat → File → Properties → Security → No Security"
      );
    }
    if (/invalid/i.test(msg) || err?.name === "InvalidPDFException") {
      throw new Error(
        "This doesn't appear to be a valid PDF file.\n\n" +
        "Please check that the file is not corrupted."
      );
    }
    throw new Error(
      "Could not open this PDF.\n\n" +
      "Possible reasons:\n" +
      "• File is corrupted or incomplete\n" +
      "• File is a scanned image PDF (no selectable text)\n" +
      "• File requires a newer PDF reader\n\n" +
      "Technical detail: " + (msg || "unknown error")
    );
  }

  // numPages is available synchronously after the promise resolves
  const pageCount = pdf.numPages;
  const pages     = [];

  for (let i = 1; i <= pageCount; i++) {
    try {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent({ normalizeWhitespace: true });

      let pageText = "";
      let lastY    = null;

      for (const item of content.items) {
        if (typeof item.str !== "string") continue;
        const y = Array.isArray(item.transform) ? (item.transform[5] ?? 0) : 0;

        // Insert newline when vertical position changes significantly
        if (lastY !== null && Math.abs(y - lastY) > 5) {
          pageText += "\n";
        }
        pageText += item.str;
        lastY = y;
      }

      pages.push(cleanText(pageText));

      // Release page resources
      page.cleanup?.();
    } catch {
      pages.push(`[Page ${i}: could not extract text]`);
    }

    // EARLY-FAIL (audit fix): scan-wali photo-PDF ka pata pehle 10 page mein
    // hi chal jaata hai — 127 page tak parse karke user ka time mat barbaad karo.
    if (i === 10 && pageCount > 15) {
      // \w Devanagari nahi ginta — Hindi text-PDF ko galti se "scanned" na samjho
      const sampleWords = (pages.join(" ").match(/[\wऀ-ॿ]{3,}/g) || []).length;
      if (sampleWords < 20) {
        pdf.cleanup?.();
        try { await loadingTask?.destroy(); } catch {}
        throw new Error(
          "This PDF appears to be a scanned image with no selectable text.\n\n" +
          "To use it with Saarthi:\n" +
          "1. Open in Adobe Acrobat\n" +
          "2. Tools → Enhance Scans → Recognize Text\n" +
          "3. Save and re-upload the OCR'd version.\n\n" +
          "Alternatively, try using the text-based version of this document."
        );
      }
    }

    // Progress callback — internal, wrapped by parsePdf before reaching UI
    onProgress?.(i / pageCount, i, pageCount);
  }

  // Clean up PDF document and destroy the loadingTask worker reference.
  // This releases the memory held by the PDF.js worker for this document.
  // The shared worker script (GlobalWorkerOptions.workerSrc) stays loaded
  // but the per-document memory is freed.
  pdf.cleanup?.();
  try { await loadingTask?.destroy(); } catch {}

  const fullText = pages.join("\n\n---\n\n");

  // Detect scanned-image PDFs (very few words = probably no text layer)
  // (audit fix: Devanagari bhi gino — pehle shuddh Hindi PDF galti se
  //  "scanned" maan li jaati thi kyunki \w sirf A-Z ginta hai)
  const wordCount = (fullText.match(/[\wऀ-ॿ]{3,}/g) || []).length;
  if (wordCount < 30 && pageCount > 0) {
    throw new Error(
      "This PDF appears to be a scanned image with no selectable text.\n\n" +
      "To use it with Saarthi:\n" +
      "1. Open in Adobe Acrobat\n" +
      "2. Tools → Enhance Scans → Recognize Text\n" +
      "3. Save and re-upload the OCR'd version.\n\n" +
      "Alternatively, try using the text-based version of this document."
    );
  }

  return { pages, fullText, pageCount };
}

// ─── TEXT CLEANING ────────────────────────────────────────────────────────────

function cleanText(raw) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([a-z])-\n([a-z])/g, "$1$2")  // rejoin hyphenated words
    .trim();
}

// ─── SEMANTIC CHUNKING ────────────────────────────────────────────────────────

export function semanticChunks(text) {
  if (!text) return [];

  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 40);

  const chunks  = [];
  let current   = "";

  for (const para of paragraphs) {
    const candidate = current ? current + "\n\n" + para : para;

    if (candidate.length > CHUNK_SIZE && current) {
      chunks.push(current.trim());
      current = current.slice(-CHUNK_OVERLAP) + "\n\n" + para;
    } else if (para.length > CHUNK_SIZE) {
      // Single long paragraph — split by sentence
      if (current) { chunks.push(current.trim()); current = ""; }
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
      for (const sent of sentences) {
        if ((current + " " + sent).length > CHUNK_SIZE && current) {
          chunks.push(current.trim());
          current = sent;
        } else {
          current += (current ? " " : "") + sent;
        }
      }
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─── SECTION DETECTION ────────────────────────────────────────────────────────

export function detectSections(fullText) {
  const HEADING = /^(?:chapter|section|part|unit|topic|module|chapter|lesson)\s+(\d+|[ivxlc]+)[:.]\s*(.+)/im;
  const lines   = fullText.split("\n");
  const sections = [];
  let current   = { title: "Introduction", content: "" };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && HEADING.test(trimmed) && trimmed.length < 120) {
      if (current.content.trim().length > 100) {
        sections.push({ ...current, content: current.content.trim() });
      }
      current = { title: trimmed, content: "" };
    } else {
      current.content += line + "\n";
    }
  }

  if (current.content.trim()) {
    sections.push({ ...current, content: current.content.trim() });
  }

  return sections.length > 1 ? sections : [{ title: "Full Document", content: fullText }];
}

// ─── CONTEXT BUILDER ──────────────────────────────────────────────────────────

export function buildPdfContext(doc) {
  const header =
    `=== UPLOADED DOCUMENT: ${doc.filename} ===\n` +
    `Pages: ${doc.pageCount} | Words: ~${doc.wordCount}\n` +
    `Sections: ${doc.sections.length}\n\n`;

  const toc = doc.sections.length > 1
    ? "TABLE OF CONTENTS:\n" +
      doc.sections.slice(0, 20).map((s, i) => `  ${i + 1}. ${s.title}`).join("\n") +
      "\n\n"
    : "";

  const budget  = MAX_CONTEXT_CHARS - header.length - toc.length - 200;
  const content = doc.fullText.slice(0, budget);
  const tail    = doc.fullText.length > budget
    ? `\n\n[Document continues... ${doc.pageCount} pages total]`
    : "";

  return header + toc + content + tail;
}

// ─── STATISTICS ───────────────────────────────────────────────────────────────

export function estimateReadingTime(text) {
  const words = (text.match(/\S+/g) || []).length;
  return Math.ceil(words / 200);
}

export function extractKeywords(text) {
  const STOP = new Set([
    "the","a","an","is","in","of","to","and","or","but","for","with","on","at","by",
    "from","that","this","it","as","was","are","be","been","being","have","has","had",
    "do","does","did","will","would","could","should","may","might","not","no","so",
    "if","then","than","also","any","all","its","their","they","we","you","i","he",
    "she","what","which","who","how","when","where","why","about","into","through",
    "one","two","three","can","very","just","more","some","these","those","there",
    "each","they","him","her","his","our","your","their","been","were","said","use",
  ]);

  const freq = {};
  for (const w of (text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [])) {
    if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([w]) => w);
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

/**
 * Parse a PDF File object into a structured document for AI.
 *
 * @param {File} file
 * @param {(stage: string, pct: number) => void} onProgress
 * @returns {Promise<{
 *   filename, fileSize, pageCount, wordCount, readingTime,
 *   keywords, sections, chunks, fullText, context
 * }>}
 */
export async function parsePdf(file, onProgress) {
  onProgress?.("Loading PDF engine…", 0.03);

  const buffer = await file.arrayBuffer();
  onProgress?.("PDF engine ready, starting extraction…", 0.12);

  const { pages, fullText, pageCount } = await extractPdfText(
    buffer,
    (pct, pg, total) => {
      onProgress?.(
        `Extracting text… page ${pg} of ${total}`,
        0.12 + pct * 0.58
      );
    }
  );

  onProgress?.("Detecting document structure…", 0.72);
  const sections = detectSections(fullText);

  onProgress?.("Building semantic index…", 0.82);
  const chunks = semanticChunks(fullText);

  onProgress?.("Finalising…", 0.94);
  const wordCount   = (fullText.match(/\S+/g) || []).length;
  const readingTime = estimateReadingTime(fullText);
  const keywords    = extractKeywords(fullText);

  const doc = { filename: file.name, fullText, pageCount, wordCount, sections };
  const context = buildPdfContext(doc);

  onProgress?.("Ready!", 1.0);

  return {
    filename:    file.name,
    fileSize:    file.size,
    pageCount,
    wordCount,
    readingTime,
    keywords,
    sections,
    chunks,
    fullText,
    context,   // ← this is what gets passed to Gemini as pdfText
  };
}
