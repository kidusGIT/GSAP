// ==========================================
// 1. GAUSS-LEGENDRE ARC LENGTH MATH
// ==========================================

function getCubicDerivative(p, t) {
  const mt = 1 - t;
  return {
    x:
      3 * mt * mt * (p[1].x - p[0].x) +
      6 * mt * t * (p[2].x - p[1].x) +
      3 * t * t * (p[3].x - p[2].x),
    y:
      3 * mt * mt * (p[1].y - p[0].y) +
      6 * mt * t * (p[2].y - p[1].y) +
      3 * t * t * (p[3].y - p[2].y),
  };
}

function getCubicSpeed(p, t) {
  const d = getCubicDerivative(p, t);
  return Math.sqrt(d.x * d.x + d.y * d.y);
}

function getCubicArcLength(p, t1 = 0, t2 = 1) {
  const legendrePoints = [
    { w: 0.5688888889, x: 0.0 },
    { w: 0.4786286705, x: -0.5384693101 },
    { w: 0.4786286705, x: 0.5384693101 },
    { w: 0.2369268851, x: -0.9061798459 },
    { w: 0.2369268851, x: 0.9061798459 },
  ];

  const halfLength = (t2 - t1) / 2;
  const midPoint = (t1 + t2) / 2;
  let length = 0;

  for (const pt of legendrePoints) {
    const t = midPoint + halfLength * pt.x;
    length += pt.w * getCubicSpeed(p, t);
  }

  return halfLength * length;
}

// Newton-Raphson to find t for a specific arc length on a single curve
function findTForLength(p, targetLen, totalLen, tolerance = 1e-6) {
  let t = Math.max(0, Math.min(1, targetLen / totalLen));
  for (let i = 0; i < 20; i++) {
    const curLen = getCubicArcLength(p, 0, t);
    const error = curLen - targetLen;
    if (Math.abs(error) < tolerance) break;
    const speed = getCubicSpeed(p, t);
    if (speed === 0) break;
    t = t - error / speed;
    t = Math.max(0, Math.min(1, t));
  }
  return t;
}

// De Casteljau's algorithm to split a cubic Bezier at local t
function splitCubicBezier(p, t) {
  const lerp = (pA, pB, t) => ({
    x: pA.x + (pB.x - pA.x) * t,
    y: pA.y + (pB.y - pA.y) * t,
  });

  const p01 = lerp(p[0], p[1], t);
  const p12 = lerp(p[1], p[2], t);
  const p23 = lerp(p[2], p[3], t);

  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);

  const p0123 = lerp(p012, p123, t);

  return [
    [p[0], p01, p012, p0123],
    [p0123, p123, p23, p[3]],
  ];
}

// Slice a cubic Bezier between local parameters t1 and t2
function sliceCubicBezier(p, t1, t2) {
  if (t1 === 0 && t2 === 1) return p;
  if (t1 === 0) return splitCubicBezier(p, t2)[0];
  if (t2 === 1) return splitCubicBezier(p, t1)[1];

  // Trim left first, then right relative to remaining curve
  const [, right] = splitCubicBezier(p, t1);
  const t2Remapped = (t2 - t1) / (1 - t1);
  const [middle] = splitCubicBezier(right, t2Remapped);
  return middle;
}

// ==========================================
// 2. SVG PARSER & SERIALIZER
// ==========================================

function parseCubicSvgPath(d) {
  const tokens = d.match(/([a-zA-Z])|([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g);
  if (!tokens) return { curves: [], isClosed: false };

  const curves = [];
  let currentPoint = null;
  let isClosed = false;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token === "M" || token === "m") {
      currentPoint = {
        x: parseFloat(tokens[i + 1]),
        y: parseFloat(tokens[i + 2]),
      };
      i += 3;
    } else if (token === "C" || token === "c") {
      const p1 = { x: parseFloat(tokens[i + 1]), y: parseFloat(tokens[i + 2]) };
      const p2 = { x: parseFloat(tokens[i + 3]), y: parseFloat(tokens[i + 4]) };
      const p3 = { x: parseFloat(tokens[i + 5]), y: parseFloat(tokens[i + 6]) };

      const curvePoints = [currentPoint, p1, p2, p3];
      const length = getCubicArcLength(curvePoints, 0, 1);

      curves.push({ points: curvePoints, length });
      currentPoint = p3;
      i += 7;
    } else if (token === "Z" || token === "z") {
      isClosed = true;
      i += 1;
    } else {
      i += 1;
    }
  }

  return { curves, isClosed };
}

// ==========================================
// 3. GLOBAL CONTINUOUS SUBDIVISION ENGINE
// ==========================================

/**
 * Subdivides ANY SVG path containing Cubic (C) commands into N equal arc-length segments.
 *
 * @param {string} dPath - Input SVG path 'd' string
 * @param {number} totalSegments - Total equal segments desired across the entire path
 * @param {number} precision - Rounding precision for SVG numbers
 * @returns {string} Subdivided SVG path string
 */
function subdivideCubicSvgPath(dPath, totalSegments, precision = 4) {
  const { curves, isClosed } = parseCubicSvgPath(dPath);
  if (curves.length === 0) return dPath;

  // 1. Build global cumulative distance map
  const totalLength = curves.reduce((sum, c) => sum + c.length, 0);
  if (totalLength === 0) return dPath;

  const cumulativeLengths = [];
  let currentAccum = 0;
  for (const c of curves) {
    currentAccum += c.length;
    cumulativeLengths.push(currentAccum);
  }

  // Helper to convert global length [0, totalLength] -> { curveIndex, localT }
  function locateGlobalDistance(dist) {
    const clampedDist = Math.max(0, Math.min(totalLength, dist));

    // Find curve index containing this distance
    let idx = cumulativeLengths.findIndex((len) => len >= clampedDist - 1e-7);
    if (idx === -1) idx = curves.length - 1;

    const prevLen = idx === 0 ? 0 : cumulativeLengths[idx - 1];
    const localDist = clampedDist - prevLen;
    const curve = curves[idx];

    const localT =
      curve.length === 0
        ? 0
        : findTForLength(curve.points, localDist, curve.length);
    return { curveIdx: idx, t: localT };
  }

  const segmentLength = totalLength / totalSegments;
  const resultCurves = [];

  // 2. Extract each equal segment slice across boundaries
  for (let i = 0; i < totalSegments; i++) {
    const startDist = i * segmentLength;
    const endDist = (i + 1) * segmentLength;

    const startLoc = locateGlobalDistance(startDist);
    const endLoc = locateGlobalDistance(endDist);

    if (startLoc.curveIdx === endLoc.curveIdx) {
      // Piece lies entirely within one curve
      const sliced = sliceCubicBezier(
        curves[startLoc.curveIdx].points,
        startLoc.t,
        endLoc.t,
      );
      resultCurves.push(sliced);
    } else {
      // Piece spans across 2 or more curves
      // First part: tail of start curve
      const head = sliceCubicBezier(
        curves[startLoc.curveIdx].points,
        startLoc.t,
        1,
      );
      resultCurves.push(head);

      // Middle parts: any full curves in-between
      for (let c = startLoc.curveIdx + 1; c < endLoc.curveIdx; c++) {
        resultCurves.push(curves[c].points);
      }

      // Last part: head of end curve
      if (endLoc.t > 0) {
        const tail = sliceCubicBezier(
          curves[endLoc.curveIdx].points,
          0,
          endLoc.t,
        );
        resultCurves.push(tail);
      }
    }
  }

  // 3. Serialise into SVG path string format
  const formatNum = (n) => Number(n.toFixed(precision));
  const startPoint = resultCurves[0][0];
  let dResult = `M ${formatNum(startPoint.x)} ${formatNum(startPoint.y)}`;

  for (const c of resultCurves) {
    const p1 = `${formatNum(c[1].x)} ${formatNum(c[1].y)}`;
    const p2 = `${formatNum(c[2].x)} ${formatNum(c[2].y)}`;
    const p3 = `${formatNum(c[3].x)} ${formatNum(c[3].y)}`;
    dResult += ` C ${p1}, ${p2}, ${p3}`;
  }

  if (isClosed) dResult += " Z";

  return dResult;
}

const inputPath = "M 50 1 C 50 1, 99 50, 99 50 Z";
// const inputPath =
//   "M 50 1 C 50 1, 99 50, 99 50 C 99 50, 50 99, 50 99 C 50 99, 1 50, 1 50 C 1 50, 50 1, 50 1 Z";

// Subdivide each of the 4 Bezier curves in the path into 2 equal parts (8 segments total)
const resultPath = subdivideCubicSvgPath(inputPath, 7);

console.log(resultPath);
