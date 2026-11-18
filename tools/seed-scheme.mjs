// Standalone Flutter Material 3 seed-colour kernel for Opurom theme tooling.
// Algorithm source: Flutter stable 3.50.0 material_color_utilities 0.13.0,
// vendored at flutter-golden/.pub-cache/hosted/pub.dev/material_color_utilities-0.13.0/lib:
//   utils/color_utils.dart:15-254, utils/math_utils.dart:15-124
//   hct/cam16.dart:96-381, hct/hct.dart:30-45, hct/viewing_conditions.dart:51-190
//   hct/src/hct_solver.dart:18-520
//   palettes/tonal_palette.dart:35-255
//   scheme/scheme_tonal_spot.dart:20-38 (ColorScheme.fromSeed default variant)
// Only numeric colour science is ported; no Dart object model is copied.
// This tool emits compile-time theme data; nothing is interpreted at runtime.

const SRGB_XYZ = [[0.41233895, 0.35762064, 0.18051042], [0.2126, 0.7152, 0.0722], [0.01932141, 0.11916382, 0.95034478]];
const XYZ_SRGB = [[3.2413774792388685, -1.5376652402851851, -0.49885366846268053], [-0.9691452513005321, 1.8758853451067872, 0.04156585616912061], [0.05562093689691305, -0.20395524564742123, 1.0571799111220335]];
const WHITE = [95.047, 100.0, 108.883];
const SCALED_DISCOUNT = [[0.001200833568784504, 0.002389694492170889, 0.0002795742885861124], [0.0005891086651375999, 0.0029785502573438758, 0.0003270666104008398], [0.00010146692491640572, 0.0005364214359186694, 0.0032979401770712076]];
const DISCOUNT_SCALED = [[1373.2198709594231, -1100.4251190754821, -7.278681089101213], [-271.815969077903, 559.6580465940733, -32.46047482791194], [1.9622899599665666, -57.173814538844006, 308.7233197812385]];
const Y_COEFF = [0.2126, 0.7152, 0.0722];
const CRITICAL_PLANES = [
0.015176349177441876,
0.045529047532325624,
0.07588174588720938,
0.10623444424209313,
0.13658714259697685,
0.16693984095186062,
0.19729253930674434,
0.2276452376616281,
0.2579979360165119,
0.28835063437139563,
0.3188300904430532,
0.350925934958123,
0.3848314933096426,
0.42057480301049466,
0.458183274052838,
0.4976837250274023,
0.5391024159806381,
0.5824650784040898,
0.6277969426914107,
0.6751227633498623,
0.7244668422128921,
0.775853049866786,
0.829304845476233,
0.8848452951698498,
0.942497089126609,
1.0022825574869039,
1.0642236851973577,
1.1283421258858297,
1.1946592148522128,
1.2631959812511864,
1.3339731595349034,
1.407011200216447,
1.4823302800086415,
1.5599503113873272,
1.6398909516233677,
1.7221716113234105,
1.8068114625156377,
1.8938294463134073,
1.9832442801866852,
2.075074464868551,
2.1693382909216234,
2.2660538449872063,
2.36523901573795,
2.4669114995532007,
2.5710888059345764,
2.6777882626779785,
2.7870270208169257,
2.898822059350997,
3.0131901897720907,
3.1301480604002863,
3.2497121605402226,
3.3718988244681087,
3.4967242352587946,
3.624204428461639,
3.754355295633311,
3.887192587735158,
4.022731918402185,
4.160988767090289,
4.301978482107941,
4.445716283538092,
4.592217266055746,
4.741496401646282,
4.893568542229298,
5.048448422192488,
5.20615066083972,
5.3666897647573375,
5.5300801301023865,
5.696336044816294,
5.865471690767354,
6.037501145825082,
6.212438385869475,
6.390297286737924,
6.571091626112461,
6.7548350853498045,
6.941541251256611,
7.131223617812143,
7.323895587840543,
7.5195704746346665,
7.7182615035334345,
7.919981813454504,
8.124744458384042,
8.332562408825165,
8.543448553206703,
8.757415699253682,
8.974476575321063,
9.194643831691977,
9.417930041841839,
9.644347703669503,
9.873909240696694,
10.106627003236781,
10.342513269534024,
10.58158024687427,
10.8238400726681,
11.069304815507364,
11.317986476196008,
11.569896988756009,
11.825048221409341,
12.083451977536606,
12.345119996613247,
12.610063955123938,
12.878295467455942,
13.149826086772048,
13.42466730586372,
13.702830557985108,
13.984327217668513,
14.269168601521828,
14.55736596900856,
14.848930523210871,
15.143873411576273,
15.44220572664832,
15.743938506781891,
16.04908273684337,
16.35764934889634,
16.66964922287304,
16.985093187232053,
17.30399201960269,
17.62635644741625,
17.95219714852476,
18.281524751807332,
18.614349837764564,
18.95068293910138,
19.290534541298456,
19.633915083172692,
19.98083495742689,
20.331304511189067,
20.685334046541502,
21.042933821039977,
21.404114048223256,
21.76888489811322,
22.137256497705877,
22.50923893145328,
22.884842241736916,
23.264076429332462,
23.6469514538663,
24.033477234264016,
24.42366364919083,
24.817520537484558,
25.21505769858089,
25.61628489293138,
26.021211842414342,
26.429848230738664,
26.842203703840827,
27.258287870275353,
27.678110301598522,
28.10168053274597,
28.529008062403893,
28.96010235337422,
29.39497283293396,
29.83362889318845,
30.276079891419332,
30.722335150426627,
31.172403958865512,
31.62629557157785,
32.08401920991837,
32.54558406207592,
33.010999283389665,
33.4802739966603,
33.953417292456834,
34.430438229418264,
34.911345834551085,
35.39614910352207,
35.88485700094671,
36.37747846067349,
36.87402238606382,
37.37449765026789,
37.87891309649659,
38.38727753828926,
38.89959975977785,
39.41588851594697,
39.93615253289054,
40.460400508064545,
40.98864111053629,
41.520882981230194,
42.05713473317016,
42.597404951718396,
43.141702194811224,
43.6900349931913,
44.24241185063697,
44.798841244188324,
45.35933162437017,
45.92389141541209,
46.49252901546552,
47.065252796817916,
47.64207110610409,
48.22299226451468,
48.808024568002054,
49.3971762874833,
49.9904556690408,
50.587870934119984,
51.189430279724725,
51.79514187861014,
52.40501387947288,
53.0190544071392,
53.637271562750364,
54.259673423945976,
54.88626804504493,
55.517063457223934,
56.15206766869424,
56.79128866487574,
57.43473440856916,
58.08241284012621,
58.734331877617365,
59.39049941699807,
60.05092333227251,
60.715611475655585,
61.38457167773311,
62.057811747619894,
62.7353394731159,
63.417162620860914,
64.10328893648692,
64.79372614476921,
65.48848194977529,
66.18756403501224,
66.89098006357258,
67.59873767827808,
68.31084450182222,
69.02730813691093,
69.74813616640164,
70.47333615344107,
71.20291564160104,
71.93688215501312,
72.67524319850172,
73.41800625771542,
74.16517879925733,
74.9167682708136,
75.67278210128072,
76.43322770089146,
77.1981124613393,
77.96744375590167,
78.74122893956174,
79.51947534912904,
80.30219030335869,
81.08938110306934,
81.88105503125999,
82.67721935322541,
83.4778813166706,
84.28304815182372,
85.09272707154808,
85.90692527145302,
86.72564993000343,
87.54890820862819,
88.3767072518277,
89.2090541872801,
90.04595612594655,
90.88742016217518,
91.73345337380438,
92.58406282226491,
93.43925555268066,
94.29903859396902,
95.16341895893969,
96.03240364439274,
96.9059996312159,
97.78421388448044,
98.6670533535366,
99.55452497210776
];

const PI = Math.PI;
const signum = (x) => x < 0 ? -1 : x > 0 ? 1 : 0;
const clamp = (lo, hi, x) => Math.min(hi, Math.max(lo, x));
const sanitizeDegrees = (d) => ((d % 360) + 360) % 360;
const matmul = (row, m) => [0, 1, 2].map((i) => row[0] * m[i][0] + row[1] * m[i][1] + row[2] * m[i][2]);
const linearized = (v) => { const n = v / 255; return n <= 0.040449936 ? n / 12.92 * 100 : Math.pow((n + 0.055) / 1.055, 2.4) * 100; };
const delinearized = (v) => { const n = v / 100; return clamp(0, 255, Math.round((n <= 0.0031308 ? n * 12.92 : 1.055 * Math.pow(n, 1 / 2.4) - 0.055) * 255)); };
const labF = (t) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
const labInvf = (ft) => ft * ft * ft > 216 / 24389 ? ft * ft * ft : (116 * ft - 16) / (24389 / 27);
const yFromLstar = (l) => 100 * labInvf((l + 16) / 116);
const argbFromRgb = (r, g, b) => ((255 << 24) | ((r & 255) << 16) | ((g & 255) << 8) | (b & 255)) >>> 0;
const argbFromLinrgb = (v) => argbFromRgb(delinearized(v[0]), delinearized(v[1]), delinearized(v[2]));
const argbFromLstar = (l) => { const c = delinearized(yFromLstar(l)); return argbFromRgb(c, c, c); };
export const hex = (argb) => '#' + (argb & 0xffffff).toString(16).toUpperCase().padStart(6, '0');

function makeViewingConditions() {
  const adapting = 200 / PI * yFromLstar(50) / 100;
  const rW = WHITE[0] * 0.401288 + WHITE[1] * 0.650173 + WHITE[2] * -0.051461;
  const gW = WHITE[0] * -0.250268 + WHITE[1] * 1.204414 + WHITE[2] * 0.045854;
  const bW = WHITE[0] * -0.002079 + WHITE[1] * 0.048952 + WHITE[2] * 0.953127;
  const f = 0.8 + 2.0 / 10;
  const c = f >= 0.9 ? 0.59 + (f - 0.9) * 10 * 0.1 : 0.525 + (f - 0.8) * 10 * 0.065;
  const d = clamp(0, 1, f * (1 - (1 / 3.6) * Math.exp((-adapting - 42) / 92)));
  const rgbD = [d * (100 / rW) + 1 - d, d * (100 / gW) + 1 - d, d * (100 / bW) + 1 - d];
  const k = 1 / (5 * adapting + 1);
  const k4 = k * k * k * k;
  const k4F = 1 - k4;
  const fl = k4 * adapting + 0.1 * k4F * k4F * Math.pow(5 * adapting, 1 / 3);
  const n = yFromLstar(50) / WHITE[1];
  const z = 1.48 + Math.sqrt(n);
  const nbb = 0.725 / Math.pow(n, 0.2);
  const whiteCone = [rW, gW, bW];
  const rgbAF = whiteCone.map((w, i) => Math.pow(fl * rgbD[i] * w / 100, 0.42));
  const rgbA = rgbAF.map((v) => 400 * v / (v + 27.13));
  const aw = (40 * rgbA[0] + 20 * rgbA[1] + rgbA[2]) / 20 * nbb;
  return { rgbD, fl, fLRoot: Math.pow(fl, 0.25), aw, nbb, c, z, n, nC: f, ncb: nbb };
}
const VC = makeViewingConditions();

function cam16FromXyz(x, y, z) {
  const rC = 0.401288 * x + 0.650173 * y - 0.051461 * z;
  const gC = -0.250268 * x + 1.204414 * y + 0.045854 * z;
  const bC = -0.002079 * x + 0.048952 * y + 0.953127 * z;
  const rD = VC.rgbD[0] * rC, gD = VC.rgbD[1] * gC, bD = VC.rgbD[2] * bC;
  const af = (v) => Math.pow(VC.fl * Math.abs(v) / 100, 0.42);
  const rAF = af(rD), gAF = af(gD), bAF = af(bD);
  const rA = signum(rD) * 400 * rAF / (rAF + 27.13);
  const gA = signum(gD) * 400 * gAF / (gAF + 27.13);
  const bA = signum(bD) * 400 * bAF / (bAF + 27.13);
  const a = (11 * rA - 12 * gA + bA) / 11;
  const b = (rA + gA - 2 * bA) / 9;
  const u = (20 * rA + 20 * gA + 21 * bA) / 20;
  const p2 = (40 * rA + 20 * gA + bA) / 20;
  let hue = Math.atan2(b, a) * 180 / PI;
  if (hue < 0) hue += 360;
  if (hue >= 360) hue -= 360;
  const ac = p2 * VC.nbb;
  const J = 100 * Math.pow(ac / VC.aw, VC.c * VC.z);
  const huePrime = hue < 20.14 ? hue + 360 : hue;
  const eHue = 0.25 * (Math.cos(huePrime * PI / 180 + 2) + 3.8);
  const p1 = 50000 / 13 * eHue * VC.nC * VC.ncb;
  const t = p1 * Math.sqrt(a * a + b * b) / (u + 0.305);
  const alpha = Math.pow(t, 0.9) * Math.pow(1.64 - Math.pow(0.29, VC.n), 0.73);
  return { hue, chroma: alpha * Math.sqrt(J / 100) };
}

export function hctFromArgb(argb) {
  const r = linearized((argb >> 16) & 255), g = linearized((argb >> 8) & 255), b = linearized(argb & 255);
  const xyz = matmul([r, g, b], SRGB_XYZ);
  const cam = cam16FromXyz(xyz[0], xyz[1], xyz[2]);
  const lab = [xyz[0] / WHITE[0], xyz[1] / WHITE[1], xyz[2] / WHITE[2]].map(labF);
  return { hue: cam.hue, chroma: cam.chroma, tone: 116 * lab[1] - 16 };
}

const sanitizeRadians = (angle) => (angle + PI * 8) % (PI * 2);
const trueDelinearized = (c) => (c / 100 <= 0.0031308 ? c / 100 * 12.92 : 1.055 * Math.pow(c / 100, 1 / 2.4) - 0.055) * 255;
const chromaAdaptation = (c) => { const af = Math.pow(Math.abs(c), 0.42); return signum(c) * 400 * af / (af + 27.13); };
function hueOf(linrgb) {
  const d = matmul(linrgb, SCALED_DISCOUNT).map(chromaAdaptation);
  return Math.atan2((d[0] + d[1] - 2 * d[2]) / 9, (11 * d[0] - 12 * d[1] + d[2]) / 11);
}
const cyclic = (a, b, c) => sanitizeRadians(b - a) < sanitizeRadians(c - a);
const intercept = (s, m, t) => (m - s) / (t - s);
const lerpPoint = (s, t, target) => s.map((v, i) => v + (target[i] - v) * t);
const setCoord = (s, coord, t, axis) => lerpPoint(s, intercept(s[axis], coord, t[axis]), t);
const bounded = (x) => x >= 0 && x <= 100;
function nthVertex(y, n) {
  const ca = n % 4 <= 1 ? 0 : 100, cb = n % 2 === 0 ? 0 : 100;
  if (n < 4) { const g = ca, b = cb, r = (y - g * Y_COEFF[1] - b * Y_COEFF[2]) / Y_COEFF[0]; return bounded(r) ? [r, g, b] : [-1, -1, -1]; }
  if (n < 8) { const b = ca, r = cb, g = (y - r * Y_COEFF[0] - b * Y_COEFF[2]) / Y_COEFF[1]; return bounded(g) ? [r, g, b] : [-1, -1, -1]; }
  const r = ca, g = cb, b = (y - r * Y_COEFF[0] - g * Y_COEFF[1]) / Y_COEFF[2];
  return bounded(b) ? [r, g, b] : [-1, -1, -1];
}
function bisectSegment(y, targetHue) {
  let left = [-1, -1, -1], right = left, leftHue = 0, rightHue = 0, initialized = false, uncut = true;
  for (let n = 0; n < 12; n++) {
    const mid = nthVertex(y, n); if (mid[0] < 0) continue;
    const midHue = hueOf(mid);
    if (!initialized) { left = right = mid; leftHue = rightHue = midHue; initialized = true; continue; }
    if (uncut || cyclic(leftHue, midHue, rightHue)) {
      uncut = false;
      if (cyclic(leftHue, targetHue, midHue)) { right = mid; rightHue = midHue; }
      else { left = mid; leftHue = midHue; }
    }
  }
  return [left, right];
}
const inverseAdaptation = (a) => signum(a) * Math.pow(Math.max(0, 27.13 * Math.abs(a) / (400 - Math.abs(a))), 1 / 0.42);
function bisectLimit(y, targetHue) {
  const [segLeft, segRight] = bisectSegment(y, targetHue);
  let left = segLeft, leftHue = hueOf(left), right = segRight;
  for (let axis = 0; axis < 3; axis++) {
    if (left[axis] === right[axis]) continue;
    let lPlane = -1, rPlane = 255;
    if (left[axis] < right[axis]) { lPlane = Math.floor(trueDelinearized(left[axis]) - 0.5); rPlane = Math.ceil(trueDelinearized(right[axis]) - 0.5); }
    else { lPlane = Math.ceil(trueDelinearized(left[axis]) - 0.5); rPlane = Math.floor(trueDelinearized(right[axis]) - 0.5); }
    for (let i = 0; i < 8 && Math.abs(rPlane - lPlane) > 1; i++) {
      const mPlane = Math.floor((lPlane + rPlane) / 2);
      const mid = setCoord(left, CRITICAL_PLANES[mPlane], right, axis);
      if (cyclic(leftHue, targetHue, hueOf(mid))) { right = mid; rPlane = mPlane; }
      else { left = mid; leftHue = hueOf(mid); lPlane = mPlane; }
    }
  }
  return left.map((v, i) => (v + right[i]) / 2);
}
function findResultByJ(hueRad, chroma, y) {
  let j = Math.sqrt(y) * 11;
  const tInnerCoeff = 1 / Math.pow(1.64 - Math.pow(0.29, VC.n), 0.73);
  const eHue = 0.25 * (Math.cos(hueRad + 2) + 3.8);
  const p1 = eHue * 50000 / 13 * VC.nC * VC.ncb;
  const hSin = Math.sin(hueRad), hCos = Math.cos(hueRad);
  for (let round = 0; round < 5; round++) {
    const jN = j / 100;
    const alpha = chroma === 0 || j === 0 ? 0 : chroma / Math.sqrt(jN);
    const t = Math.pow(alpha * tInnerCoeff, 1 / 0.9);
    const ac = VC.aw * Math.pow(jN, 1 / VC.c / VC.z);
    const p2 = ac / VC.nbb;
    const gamma = 23 * (p2 + 0.305) * t / (23 * p1 + 11 * t * hCos + 108 * t * hSin);
    const a = gamma * hCos, b = gamma * hSin;
    const rA = (460 * p2 + 451 * a + 288 * b) / 1403;
    const gA = (460 * p2 - 891 * a - 261 * b) / 1403;
    const bA = (460 * p2 - 220 * a - 6300 * b) / 1403;
    const linrgb = matmul([inverseAdaptation(rA), inverseAdaptation(gA), inverseAdaptation(bA)], DISCOUNT_SCALED);
    if (linrgb.some((v) => v < 0)) return 0;
    const fnj = linrgb[0] * Y_COEFF[0] + linrgb[1] * Y_COEFF[1] + linrgb[2] * Y_COEFF[2];
    if (fnj <= 0) return 0;
    if (round === 4 || Math.abs(fnj - y) < 0.002) {
      if (linrgb.some((v) => v > 100.01)) return 0;
      return argbFromLinrgb(linrgb);
    }
    j = j - (fnj - y) * j / (2 * fnj);
  }
  return 0;
}
export function solveToInt(hueDegrees, chroma, lstar) {
  if (chroma < 0.0001 || lstar < 0.0001 || lstar > 99.9999) return argbFromLstar(lstar);
  const hueRad = sanitizeDegrees(hueDegrees) / 180 * PI;
  const y = yFromLstar(lstar);
  return findResultByJ(hueRad, chroma, y) || argbFromLinrgb(bisectLimit(y, hueRad));
}
function maxChroma(hue, tone, cache) {
  if (cache.has(tone)) return cache.get(tone);
  const value = hctFromArgb(solveToInt(hue, 200, tone)).chroma;
  cache.set(tone, value);
  return value;
}
function keyColor(hue, requestedChroma) {
  // KeyColor.create(), tonal_palette.dart:188-230: pivot around T50, search
  // the tone whose maximum achievable chroma first satisfies the request.
  const cache = new Map();
  const pivotTone = 50;
  const toneStepSize = 1;
  const epsilon = 0.01;
  let lowerTone = 0;
  let upperTone = 100;
  while (lowerTone < upperTone) {
    const midTone = Math.floor((lowerTone + upperTone) / 2);
    const isAscending = maxChroma(hue, midTone, cache) < maxChroma(hue, midTone + toneStepSize, cache);
    const sufficientChroma = maxChroma(hue, midTone, cache) >= requestedChroma - epsilon;
    if (sufficientChroma) {
      if (Math.abs(lowerTone - pivotTone) < Math.abs(upperTone - pivotTone)) upperTone = midTone;
      else {
        if (lowerTone === midTone) return solveToInt(hue, requestedChroma, lowerTone);
        lowerTone = midTone;
      }
    } else if (isAscending) lowerTone = midTone + toneStepSize;
    else upperTone = midTone;
  }
  return solveToInt(hue, requestedChroma, lowerTone);
}
export function tonalPalette(hue, chroma) {
  // tonal_palette.dart:60-66,132-137: tone lookup uses the requested hue and
  // chroma. KeyColor only validates that the request is representable.
  keyColor(hue, chroma);
  const cache = new Map();
  return (tone) => {
    if (!cache.has(tone)) cache.set(tone, solveToInt(hue, chroma, tone));
    return cache.get(tone);
  };
}

export function fromSeed(seedHex, isDark = false) {
  const source = hctFromArgb(parseInt(seedHex.replace('#', ''), 16) | 0xff000000);
  const primary = tonalPalette(source.hue, 36);
  const secondary = tonalPalette(source.hue, 16);
  const tertiary = tonalPalette(sanitizeDegrees(source.hue + 60), 24);
  const neutral = tonalPalette(source.hue, 6);
  const neutralVariant = tonalPalette(source.hue, 8);
  const error = tonalPalette(25, 84);
  const t = isDark
    ? { primary: 80, onPrimary: 20, primaryContainer: 30, onPrimaryContainer: 90, secondary: 80, onSecondary: 20, secondaryContainer: 30, onSecondaryContainer: 90, tertiary: 80, onTertiary: 20, tertiaryContainer: 30, onTertiaryContainer: 90, error: 80, onError: 20, errorContainer: 30, onErrorContainer: 80, surface: 10, onSurface: 90, surfaceVariant: 30, onSurfaceVariant: 80, outline: 60, inverseSurface: 90, inversePrimary: 40 }
    : { primary: 40, onPrimary: 100, primaryContainer: 90, onPrimaryContainer: 10, secondary: 40, onSecondary: 100, secondaryContainer: 90, onSecondaryContainer: 10, tertiary: 40, onTertiary: 100, tertiaryContainer: 90, onTertiaryContainer: 10, error: 40, onError: 100, errorContainer: 90, onErrorContainer: 10, surface: 99, onSurface: 10, surfaceVariant: 90, onSurfaceVariant: 30, outline: 50, inverseSurface: 20, inversePrimary: 80 };
  const palettes = { primary, onPrimary: primary, primaryContainer: primary, onPrimaryContainer: primary, inversePrimary: primary, secondary, onSecondary: secondary, secondaryContainer: secondary, onSecondaryContainer: secondary, tertiary, onTertiary: tertiary, tertiaryContainer: tertiary, onTertiaryContainer: tertiary, error, onError: error, errorContainer: error, onErrorContainer: error, surface: neutral, onSurface: neutral, inverseSurface: neutral, surfaceVariant: neutralVariant, onSurfaceVariant: neutralVariant, outline: neutralVariant };
  const out = {};
  for (const [role, tone] of Object.entries(t)) out[role] = hex(palettes[role](tone));
  return out;
}

// Generate compile-time token files from a seed colour. The output has no
// runtime dependency on this script: the compiler flattens md-* colours into
// IR and the renderer resolves them once by mode.
export function generateThemeTokens(seedHex) {
  const light = fromSeed(seedHex, false);
  const dark = fromSeed(seedHex, true);
  const roles = Object.keys(light).sort();
  return {
    light: Object.fromEntries(roles.map((r) => ['md-sys-color-' + r, light[r]])),
    dark: Object.fromEntries(roles.map((r) => ['md-sys-color-' + r, dark[r]])),
    seed: seedHex.toUpperCase(),
    variant: 'tonalSpot',
    source: 'color_scheme.dart:268-320,1768-1787; scheme_tonal_spot.dart:20-38'
  };
}
