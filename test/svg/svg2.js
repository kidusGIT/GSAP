// ==========================================
// 1. CUBIC BEZIER MATHEMATICS
// ==========================================

function getCubicPoint(p, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p[0].x + 3 * mt2 * t * p[1].x + 3 * mt * t2 * p[2].x + t3 * p[3].x,
    y: mt3 * p[0].y + 3 * mt2 * t * p[1].y + 3 * mt * t2 * p[2].y + t3 * p[3].y,
  };
}

// Subdivide a cubic Bezier at local t using De Casteljau's algorithm
function splitCubicBezier(p, t) {
  const lerp = (a, b, t) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  const p01 = lerp(p[0], p[1], t);
  const p12 = lerp(p[1], p[2], t);
  const p23 = lerp(p[2], p[3], t);

  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);

  const p0123 = lerp(p012, p123, t);

  return [
    [p[0], p01, p012, p0123], // Left curve [0, t]
    [p0123, p123, p23, p[3]], // Right curve [t, 1]
  ];
}

// Slice sub-curve between [t1, t2] - guaranteed to return 4 valid points
function sliceCubicBezier(p, t1, t2) {
  t1 = Math.max(0, Math.min(1, t1));
  t2 = Math.max(0, Math.min(1, t2));

  if (t1 > t2) [t1, t2] = [t2, t1];

  if (Math.abs(t2 - t1) < 1e-6) {
    const pt = getCubicPoint(p, t1);
    return [pt, pt, pt, pt];
  }

  if (t1 === 0 && t2 === 1) return p;
  if (t1 === 0) return splitCubicBezier(p, t2)[0];
  if (t2 === 1) return splitCubicBezier(p, t1)[1];

  // t1 > 0 and t2 < 1, so (1 - t1) is guaranteed > 0 (no division by zero)
  const [, right] = splitCubicBezier(p, t1);
  const t2Remapped = (t2 - t1) / (1 - t1);
  const [middle] = splitCubicBezier(
    right,
    Math.max(0, Math.min(1, t2Remapped)),
  );
  return middle;
}

// ==========================================
// 2. ARC LENGTH LOOKUP TABLE (LUT)
// ==========================================

function buildCurveLUT(p, samples = 200) {
  const lens = [0];
  let totalLength = 0;
  let prevPt = getCubicPoint(p, 0);

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const pt = getCubicPoint(p, t);
    const dx = pt.x - prevPt.x;
    const dy = pt.y - prevPt.y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
    lens.push(totalLength);
    prevPt = pt;
  }

  return { totalLength, samples, lens, points: p };
}

function findTForDistance(lut, targetDist) {
  if (targetDist <= 0) return 0;
  if (targetDist >= lut.totalLength) return 1;

  const lens = lut.lens;
  let low = 0;
  let high = lut.samples;

  while (low < high - 1) {
    const mid = (low + high) >> 1;
    if (lens[mid] <= targetDist) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const d0 = lens[low];
  const d1 = lens[high];
  const span = d1 - d0;
  const frac = span > 0 ? (targetDist - d0) / span : 0;

  return (low + frac) / lut.samples;
}

// ==========================================
// 3. SVG PARSER (Supports M, m, C, c)
// ==========================================

function parseCubicSvgPath(d) {
  const tokens = d.match(/([a-zA-Z])|([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g);
  if (!tokens) return { curves: [], isClosed: false };

  const curves = [];
  let currentPoint = { x: 0, y: 0 };
  let isClosed = false;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token === "M") {
      currentPoint = {
        x: parseFloat(tokens[i + 1]),
        y: parseFloat(tokens[i + 2]),
      };
      i += 3;
    } else if (token === "m") {
      currentPoint = {
        x: currentPoint.x + parseFloat(tokens[i + 1]),
        y: currentPoint.y + parseFloat(tokens[i + 2]),
      };
      i += 3;
    } else if (token === "C") {
      const p1 = { x: parseFloat(tokens[i + 1]), y: parseFloat(tokens[i + 2]) };
      const p2 = { x: parseFloat(tokens[i + 3]), y: parseFloat(tokens[i + 4]) };
      const p3 = { x: parseFloat(tokens[i + 5]), y: parseFloat(tokens[i + 6]) };

      curves.push(buildCurveLUT([currentPoint, p1, p2, p3]));
      currentPoint = p3;
      i += 7;
    } else if (token === "c") {
      const p1 = {
        x: currentPoint.x + parseFloat(tokens[i + 1]),
        y: currentPoint.y + parseFloat(tokens[i + 2]),
      };
      const p2 = {
        x: currentPoint.x + parseFloat(tokens[i + 3]),
        y: currentPoint.y + parseFloat(tokens[i + 4]),
      };
      const p3 = {
        x: currentPoint.x + parseFloat(tokens[i + 5]),
        y: currentPoint.y + parseFloat(tokens[i + 6]),
      };

      curves.push(buildCurveLUT([currentPoint, p1, p2, p3]));
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
// 4. SUBDIVISION ENGINE
// ==========================================

function subdivideCubicSvgPath(dPath, numSegments, precision = 4) {
  if (!numSegments || numSegments < 1) return dPath;

  const { curves, isClosed } = parseCubicSvgPath(dPath);
  if (!curves || curves.length === 0) return dPath;

  const totalLength = curves.reduce((sum, c) => sum + c.totalLength, 0);
  if (totalLength === 0) return dPath;

  const cumulativeLengths = [];
  let currentAccum = 0;
  for (const c of curves) {
    currentAccum += c.totalLength;
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

    let idx = cumulativeLengths.findIndex((len) => len >= clampedDist - 1e-7);
    if (idx === -1) idx = curves.length - 1;

    const prevLen = idx === 0 ? 0 : cumulativeLengths[idx - 1];
    const localDist = clampedDist - prevLen;
    const lut = curves[idx];

    const localT = findTForDistance(lut, localDist);
    return { curveIdx: idx, t: localT };
  }

  const segmentLength = totalLength / numSegments;
  const resultCurves = [];

  for (let i = 0; i < numSegments; i++) {
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
      resultCurves.push(sliced);
    } else {
      // 1. Head piece from start curve
      if (startLoc.t < 1 - 1e-6) {
        const head = sliceCubicBezier(
          curves[startLoc.curveIdx].points,
          startLoc.t,
          1,
        );
        resultCurves.push(head);
      }

      // 2. Middle full curves
      for (let c = startLoc.curveIdx + 1; c < endLoc.curveIdx; c++) {
        resultCurves.push(curves[c].points);
      }

      // 3. Tail piece from end curve
      if (endLoc.t > 1e-6) {
        const tail = sliceCubicBezier(
          curves[endLoc.curveIdx].points,
          0,
          endLoc.t,
        );
        resultCurves.push(tail);
      }
    }
  }

  // Safety fallback check to guarantee non-empty result
  if (!resultCurves || resultCurves.length === 0) return dPath;

  const fmt = (n) => (isNaN(n) ? 0 : Number(n.toFixed(precision)));
  const startPoint = resultCurves[0][0];
  let dResult = `M ${fmt(startPoint.x)} ${fmt(startPoint.y)}`;

  for (const c of resultCurves) {
    const p1 = `${fmt(c[1].x)} ${fmt(c[1].y)}`;
    const p2 = `${fmt(c[2].x)} ${fmt(c[2].y)}`;
    const p3 = `${fmt(c[3].x)} ${fmt(c[3].y)}`;
    dResult += ` C ${p1}, ${p2}, ${p3}`;
  }

  if (isClosed) dResult += " Z";

  return dResult;
}

// Example Execution:
const inputPath =
  "M 53.2635 68.6401 C 59.776 64.496 66.1405 59.7599 71.3949 54.5058 C 89.3043 36.5975 91.3025 20.8353 89.4523 15.2112 C 92.1166 12.5471 94.7808 9.8831 97.445 7.21906 C 98.185 6.47904 98.185 5.29502 97.445 4.55501 C 96.7049 3.815 95.5208 3.815 94.7807 4.55501 C 92.1165 7.21905 89.4523 9.8831 86.7881 12.5471 C 81.1637 10.6971 65.4005 12.6951 47.4911 30.6034 C 42.2366 35.8575 37.5003 42.2216 33.356 48.7337 C 27.3615 47.2537 16.9267 47.2537 9.6741 55.3198 C 1.38545 64.422 6.26983 73.0801 8.11997 71.3041 C 9.60009 69.7501 12.1163 60.6479 23.0691 67.678 C 21.293 71.3781 21.367 73.6721 22.5511 74.7821 C 24.1052 76.3362 25.6593 77.8902 27.2135 79.4442 C 28.3976 80.6282 30.6177 80.7762 34.392 78.9262 C 41.3486 89.8784 32.2459 92.3944 30.7657 93.9484 C 28.9156 95.7245 37.5743 100.609 46.677 92.3204 C 54.7436 85.0683 54.7436 74.6341 53.2635 68.6401 Z M 64.5864 37.4115 C 61.9222 34.7475 61.9222 30.3074 64.5864 27.6434 C 67.3246 24.9053 71.6909 24.9053 74.3552 27.6434 C 77.0934 30.3814 77.0934 34.6735 74.3552 37.4115 C 71.6909 40.0756 67.3246 40.0756 64.5864 37.4115 Z M 20.1089 77.0762 C 20.1089 77.0762 12.7083 78.4082 9.97012 92.0244 C 23.5872 89.3604 24.9193 81.8863 24.9193 81.8863 C 23.3652 80.2582 21.737 78.7042 20.1089 77.0762 Z";

// Subdivide into 16 equal arc-length segments
const resultPath = subdivideCubicSvgPath(inputPath, 15);
console.log(resultPath);
