/**
 * SAARTHI — Vedic Panchang Calculator (item #14: Vikramaditya Vedic Clock)
 * =========================================================================
 * Poore app ki tarah yeh bhi 100% client-side hai — koi backend/API-key
 * nahi chahiye, sab kuch device ke ghadi + (optional) location se LIVE
 * calculate hota hai. Koi date/tithi kabhi hardcode nahi ki gayi — spec ki
 * "Never hardcode dates" requirement yahi tarike se poori hoti hai.
 *
 * Method: Sun aur Moon ki ecliptic longitude ke liye standard low-precision
 * astronomical formulas (Jean Meeus, "Astronomical Algorithms" ch. 25 & 47
 * ka truncated series) — commercial-grade Panchang software jitni decimal-
 * second precision nahi, per tithi/nakshatra boundary ke aas-paas 1-2 minute
 * तक ka farq ho sakta hai. Yeh SAARTHI jaise spiritual-guidance app ke liye
 * bilkul theek hai; agar future mein paise wali Panchang API chahiye ho
 * (zyada sateek) toh yeh file replace karna aasan hai — baaki UI wahi rahega.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const norm360 = x => { x = x % 360; return x < 0 ? x + 360 : x; };

function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}
function jdToDate(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

// ─── SUN — apparent ecliptic longitude (tropical), accuracy ~0.01° ──────────
function sunEclipticLongitude(jd) {
  const T  = (jd - 2451545.0) / 36525;
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M  = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mr = M * DEG;
  const C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
           + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
           + 0.000289 * Math.sin(3 * Mr);
  return norm360(L0 + C);
}

// ─── MOON — ecliptic longitude, truncated periodic series, accuracy ~few' ──
function moonEclipticLongitude(jd) {
  const T  = (jd - 2451545.0) / 36525;
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
  const D  = norm360(297.8501921 + 445267.1114034  * T - 0.0018819 * T * T) * DEG;
  const M  = norm360(357.5291092 + 35999.0502909   * T - 0.0001536 * T * T) * DEG;
  const Mp = norm360(134.9633964 + 477198.8675055  * T + 0.0089970 * T * T) * DEG;
  const F  = norm360(93.2720950  + 483202.0175233  * T - 0.0036539 * T * T) * DEG;

  const lon = Lp
    + 6.288774 * Math.sin(Mp)
    + 1.274027 * Math.sin(2 * D - Mp)
    + 0.658314 * Math.sin(2 * D)
    + 0.213618 * Math.sin(2 * Mp)
    - 0.185116 * Math.sin(M)
    - 0.114332 * Math.sin(2 * F)
    + 0.058793 * Math.sin(2 * D - 2 * Mp)
    + 0.057066 * Math.sin(2 * D - M - Mp)
    + 0.053322 * Math.sin(2 * D + Mp)
    + 0.045758 * Math.sin(2 * D - M)
    - 0.040923 * Math.sin(M - Mp)
    - 0.034720 * Math.sin(D)
    - 0.030383 * Math.sin(M + Mp)
    + 0.015327 * Math.sin(2 * D - 2 * F)
    - 0.012528 * Math.sin(Mp + 2 * F)
    + 0.010980 * Math.sin(Mp - 2 * F)
    + 0.010675 * Math.sin(4 * D - Mp)
    + 0.010034 * Math.sin(3 * Mp)
    + 0.008548 * Math.sin(4 * D - 2 * Mp);
  return norm360(lon);
}

// ─── AYANAMSA — Lahiri (approx linear model, ~1 arcmin/century error) ──────
function lahiriAyanamsa(jd) {
  const T = (jd - 2451545.0) / 36525;
  return 23.85 + 0.013971 * (T * 100);
}

// ─── SUNRISE / SUNSET — NOAA-style sunrise equation, accuracy ~1-2 min ─────
function sunriseSunset(dateAtLocalMidnightUTCms, lat, lon) {
  const jd0 = Math.floor(dateAtLocalMidnightUTCms / 86400000 + 2440587.5) + 0.5;
  const n = jd0 - 2451545.0 + 0.0008;
  const Jstar = n - lon / 360;
  const M  = norm360(357.5291 + 0.98560028 * Jstar);
  const Mr = M * DEG;
  const C  = 1.9148 * Math.sin(Mr) + 0.0200 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr);
  const lambda  = norm360(M + 102.9372 + C + 180);
  const lambdaR = lambda * DEG;
  const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(Mr) - 0.0069 * Math.sin(2 * lambdaR);
  const delta = Math.asin(Math.sin(lambdaR) * Math.sin(23.4397 * DEG));
  const latR  = lat * DEG;
  const cosH  = (Math.sin(-0.83 * DEG) - Math.sin(latR) * Math.sin(delta)) / (Math.cos(latR) * Math.cos(delta));
  if (cosH > 1 || cosH < -1) return { sunrise: null, sunset: null };
  const H = Math.acos(cosH) * RAD;
  return { sunrise: jdToDate(Jtransit - H / 360), sunset: jdToDate(Jtransit + H / 360) };
}

const MOVABLE_KARANA = ["bava", "balava", "kaulava", "taitila", "gara", "vanija", "vishti"];

/**
 * computePanchang — mukhya function. `date` = JS Date (device local clock),
 * `lat`/`lon` = user location (default Ujjain — parampara ke reference
 * meridian ke roop mein, agar location permission na mile).
 */
export function computePanchang(date = new Date(), lat = 23.1765, lon = 75.7885) {
  const jd       = julianDay(date);
  const sunLon   = sunEclipticLongitude(jd);
  const moonLon  = moonEclipticLongitude(jd);
  const ayanamsa = lahiriAyanamsa(jd);
  const sunSid   = norm360(sunLon - ayanamsa);
  const moonSid  = norm360(moonLon - ayanamsa);

  // Tithi (angle Moon-Sun cancels ayanamsa, tropical diff == sidereal diff)
  const tithiAngle    = norm360(moonLon - sunLon);
  const tithiIndex    = Math.floor(tithiAngle / 12);      // 0..29
  const paksha        = tithiIndex < 15 ? "shukla" : "krishna";
  const tithiInPaksha = (tithiIndex < 15 ? tithiIndex : tithiIndex - 15) + 1; // 1..15

  // Nakshatra (27 x 13°20')
  const span            = 360 / 27;
  const nakshatraIndex  = Math.floor(moonSid / span);         // 0..26
  const nakshatraPada   = Math.floor((moonSid % span) / (span / 4)) + 1; // 1..4

  // Yoga (Sun + Moon sidereal, same 27-fold span)
  const yogaIndex = Math.floor(norm360(sunSid + moonSid) / span); // 0..26

  // Karana (half-tithi, 60 per lunar month)
  const karanaIndex = Math.floor(tithiAngle / 6) % 60; // 0..59
  let karanaKey;
  if (karanaIndex === 0) karanaKey = "kimstughna";
  else if (karanaIndex >= 57) karanaKey = ["shakuni", "chatushpada", "naga"][karanaIndex - 57];
  else karanaKey = MOVABLE_KARANA[(karanaIndex - 1) % 7];

  // Ritu (season) — classical definition: Sun's sidereal longitude / 60°
  const rituIndex = Math.floor(sunSid / 60); // 0..5

  // Vaar (weekday, local calendar)
  const vaarIndex = date.getDay(); // 0=Sunday

  // Sunrise / Sunset for today (local)
  const { sunrise, sunset } = sunriseSunset(date.getTime(), lat, lon);

  // Muhurta — user's own reference doc: 1 din = 30 muhurta, har ek ~48 min,
  // Vedic din sunrise se shuru hota hai (madhyaratri se nahi).
  let muhurtaIndex = null;
  if (sunrise) {
    let sinceSunriseMin = (date.getTime() - sunrise.getTime()) / 60000;
    if (sinceSunriseMin < 0) sinceSunriseMin += 1440; // pichle sunrise se ganein
    muhurtaIndex = Math.floor((sinceSunriseMin % 1440) / 48) % 30; // 0..29
  }

  // Hindu (Amanta) lunar month — best-effort: pichli Amavasya ke waqt Sun
  // jis Rashi mein tha, uske hisaab se classical mapping table se naam.
  // NOTE: yeh ek approximation hai (tithi-angle se din peeche extrapolate
  // karke), exact iterative new-moon-solve jitna sateek nahi — UI mein isse
  // "अनुमानित" (approximate) label ke saath dikhाया jaata hai.
  const daysSinceAmavasya = (tithiIndex >= 15 ? tithiIndex - 15 : tithiIndex + 15) * (29.530588 / 30);
  const jdAtLastAmavasya  = jd - daysSinceAmavasya;
  const sunSidAtAmavasya  = norm360(sunEclipticLongitude(jdAtLastAmavasya) - lahiriAyanamsa(jdAtLastAmavasya));
  const rashiAtAmavasya   = Math.floor(sunSidAtAmavasya / 30); // 0=Mesha..11=Meena
  // Mesha(0)->Vaishakha ... Meena(11)->Chaitra
  const monthOrder = ["vaishakha","jyeshtha","ashadha","shravana","bhadrapada","ashwin",
                       "kartika","margashirsha","pausha","magha","phalguna","chaitra"];
  const hinduMonthKey = monthOrder[rashiAtAmavasya];

  // Vikram Samvat — approx: naya varsh Chaitra Shukla Pratipada (~laate March/
  // early April) se shuru hota hai; April onward +57, uske pehle +56.
  const gYear  = date.getFullYear();
  const gMonth = date.getMonth(); // 0-indexed
  const vikramSamvat = gYear + (gMonth >= 3 ? 57 : 56);

  return {
    date, jd, sunSiderealLon: sunSid, moonSiderealLon: moonSid, ayanamsa,
    tithi:     { index: tithiIndex, inPaksha: tithiInPaksha, paksha },
    nakshatra: { index: nakshatraIndex, pada: nakshatraPada },
    yoga:      { index: yogaIndex },
    karana:    { key: karanaKey },
    ritu:      { index: rituIndex },
    vaar:      { index: vaarIndex },
    muhurta:   { index: muhurtaIndex },
    hinduMonth: { key: hinduMonthKey, approximate: true },
    vikramSamvat: { value: vikramSamvat, approximate: true },
    sunrise, sunset,
  };
}

/** Browser geolocation ke saath, permission na mile toh Ujjain default. */
export function getUserLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve({ lat: 23.1765, lon: 75.7885, isDefault: true }); return; }
    const timer = setTimeout(() => resolve({ lat: 23.1765, lon: 75.7885, isDefault: true }), 5000);
    navigator.geolocation.getCurrentPosition(
      pos => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, isDefault: false }); },
      ()  => { clearTimeout(timer); resolve({ lat: 23.1765, lon: 75.7885, isDefault: true }); },
      { timeout: 4500, maximumAge: 3600000 }
    );
  });
}
