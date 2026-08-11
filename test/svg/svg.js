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

// Bisection search: robust against zero-speed endpoints
function findTForLength(p, targetLen, totalLen, tolerance = 1e-6) {
  if (!totalLen || totalLen <= 0) return 0;
  if (targetLen <= 0) return 0;
  if (targetLen >= totalLen) return 1;

  let low = 0;
  let high = 1;
  let t = targetLen / totalLen;

  for (let i = 0; i < 30; i++) {
    const curLen = getCubicArcLength(p, 0, t);
    const error = curLen - targetLen;

    if (Math.abs(error) < tolerance) break;

    if (error > 0) {
      high = t;
    } else {
      low = t;
    }
    t = (low + high) / 2;
  }
  return isNaN(t) ? 0 : Math.max(0, Math.min(1, t));
}

// De Casteljau's algorithm to split a cubic Bezier
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

  const leftCurve = [p[0], p01, p012, p0123];
  const rightCurve = [p0123, p123, p23, p[3]];

  return [leftCurve, rightCurve];
}

// Safe slice with full division-by-zero protection
function sliceCubicBezier(p, t1, t2) {
  t1 = Math.max(0, Math.min(1, t1));
  t2 = Math.max(0, Math.min(1, t2));

  if (t1 > t2) [t1, t2] = [t2, t1];
  if (Math.abs(t2 - t1) < 1e-6) return null;
  if (t1 === 0 && t2 === 1) return p;
  if (t1 === 0) return splitCubicBezier(p, t2)[0];
  if (t2 === 1) return splitCubicBezier(p, t1)[1];

  const [, right] = splitCubicBezier(p, t1);
  const denominator = 1 - t1;

  // Prevent divide-by-zero NaN
  if (denominator < 1e-7) return null;

  const t2Remapped = Math.max(0, Math.min(1, (t2 - t1) / denominator));
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
// 3. CONTINUOUS SUBDIVISION ENGINE
// ==========================================

function subdivideCubicSvgPath(dPath, targetSegments, precision = 4) {
  const { curves, isClosed } = parseCubicSvgPath(dPath);
  if (curves.length === 0) return dPath;

  const totalLength = curves.reduce((sum, c) => sum + c.length, 0);
  if (totalLength === 0) return dPath;

  const cumulativeLengths = [];
  let currentAccum = 0;
  for (const c of curves) {
    currentAccum += c.length;
    cumulativeLengths.push(currentAccum);
  }

  function locateGlobalDistance(dist) {
    const clampedDist = Math.max(0, Math.min(totalLength, dist));

    if (clampedDist >= totalLength - 1e-7) {
      return { curveIdx: curves.length - 1, t: 1 };
    }
    if (clampedDist <= 1e-7) {
      return { curveIdx: 0, t: 0 };
    }

    let idx = cumulativeLengths.findIndex((len) => len > clampedDist);
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

  const segmentLength = totalLength / targetSegments;
  const resultCurves = [];

  for (let i = 0; i < targetSegments; i++) {
    const startDist = i * segmentLength;
    const endDist = (i + 1) * segmentLength;

    const startLoc = locateGlobalDistance(startDist);
    const endLoc = locateGlobalDistance(endDist);

    if (startLoc.curveIdx === endLoc.curveIdx) {
      const sliced = sliceCubicBezier(
        curves[startLoc.curveIdx].points,
        startLoc.t,
        endLoc.t,
      );
      if (sliced) resultCurves.push(sliced);
    } else {
      // Tail of initial curve
      if (startLoc.t < 1 - 1e-6) {
        const head = sliceCubicBezier(
          curves[startLoc.curveIdx].points,
          startLoc.t,
          1,
        );
        if (head) resultCurves.push(head);
      }

      // Middle complete curves
      for (let c = startLoc.curveIdx + 1; c < endLoc.curveIdx; c++) {
        resultCurves.push(curves[c].points);
      }

      // Head of final curve
      if (endLoc.t > 1e-6) {
        const tail = sliceCubicBezier(
          curves[endLoc.endLoc || endLoc.curveIdx].points,
          0,
          endLoc.t,
        );
        if (tail) resultCurves.push(tail);
      }
    }
  }

  if (resultCurves.length === 0) return dPath;

  const formatNum = (n) => (isNaN(n) ? 0 : Number(n.toFixed(precision)));
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

// Example Execution:
const inputPath =
  "M2 4C2 4 34.1774 4 34.1774 4C34.1774 4 34.1774 35.4113 34.1774 35.4113C34.1774 35.4113 64.8226 35.4113 64.8226 35.4113C64.8226 35.4113 64.8226 4 64.8226 4C64.8226 4 97 4 97 4C97 4 97 36.1774 97 36.1774C97 36.1774 65.5887 36.1774 65.5887 36.1774C65.5887 36.1774 65.5887 66.8226 65.5887 66.8226C65.5887 66.8226 97 66.8226 97 66.8226C97 66.8226 97 99 97 99C97 99 64.8226 99 64.8226 99C64.8226 99 64.8226 67.5887 64.8226 67.5887C64.8226 67.5887 34.1774 67.5887 34.1774 67.5887C34.1774 67.5887 34.1774 99 34.1774 99C34.1774 99 2 99 2 99C2 99 2 66.8226 2 66.8226C2 66.8226 33.4113 66.8226 33.4113 66.8226C33.4113 66.8226 33.4113 36.1774 33.4113 36.1774C33.4113 36.1774 2 36.1774 2 36.1774C2 36.1774 2 4 2 4Z";
const resultPath = subdivideCubicSvgPath(inputPath, 8);
console.log(resultPath);
