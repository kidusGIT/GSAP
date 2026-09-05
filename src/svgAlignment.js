function pairPoints(arr) {
  const pairs = [];
  for (let i = 0; i < arr.length; i += 2) {
    pairs.push({ x: arr[i], y: arr[i + 1] });
  }
  return pairs;
}

function reverseCurve(coords) {
  if (!Array.isArray(coords) || coords.length < 8) {
    return [];
  }

  function cleanNum(n) {
    return Math.round(n * 10000) / 10000;
  }

  const len = coords.length;

  // Auto-detect stride format
  let stride = 8;
  if (len % 8 !== 0) {
    if ((len - 2) % 6 === 0) {
      stride = 6;
    } else {
      console.warn(
        `[SVG Reverser]: Invalid array length ${len}. Must be a multiple of 8, or 2 + multiple of 6.`,
      );
      return [];
    }
  }

  const output = new Array(len);

  // Stride 8: [startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY]
  if (stride === 8) {
    let writeIdx = 0;
    for (let i = len - 8; i >= 0; i -= 8) {
      output[writeIdx++] = cleanNum(coords[i + 6]); // New startX = Old endX
      output[writeIdx++] = cleanNum(coords[i + 7]); // New startY = Old endY
      output[writeIdx++] = cleanNum(coords[i + 4]); // New cp1X   = Old cp2X
      output[writeIdx++] = cleanNum(coords[i + 5]); // New cp1Y   = Old cp2Y
      output[writeIdx++] = cleanNum(coords[i + 2]); // New cp2X   = Old cp1X
      output[writeIdx++] = cleanNum(coords[i + 3]); // New cp2Y   = Old cp1Y
      output[writeIdx++] = cleanNum(coords[i]); // New endX   = Old startX
      output[writeIdx++] = cleanNum(coords[i + 1]); // New endY   = Old startY
    }
  }

  // Stride 6: [startX, startY,  cp1X, cp1Y, cp2X, cp2Y, endX, endY, ...]
  else if (stride === 6) {
    // Initial start point of the reversed path is the end point of the last original segment
    output[0] = cleanNum(coords[len - 2]);
    output[1] = cleanNum(coords[len - 1]);

    let writeIdx = 2;
    for (let i = len - 6; i >= 2; i -= 6) {
      const prevX = i === 2 ? coords[0] : coords[i - 2];
      const prevY = i === 2 ? coords[1] : coords[i - 1];

      output[writeIdx++] = cleanNum(coords[i + 2]); // New cp1X = Old cp2X
      output[writeIdx++] = cleanNum(coords[i + 3]); // New cp1Y = Old cp2Y
      output[writeIdx++] = cleanNum(coords[i]); // New cp2X = Old cp1X
      output[writeIdx++] = cleanNum(coords[i + 1]); // New cp2Y = Old cp1Y
      output[writeIdx++] = cleanNum(prevX); // New endX = Old startX
      output[writeIdx++] = cleanNum(prevY); // New endY = Old startY
    }
  }

  return output;
}

function getCurveDirection(points) {
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    area += points[i].x * points[i + 1].y;
    area -= points[i + 1].x * points[i].y;
  }
  // Last point to first
  area += points[points.length - 1].x * points[0].y;
  area -= points[0].x * points[points.length - 1].y;

  return area > 0 ? 1 : -1; // 1 = CCW, -1 = CW
}

function ensureSameDirection(source, target) {
  const srcDir = getCurveDirection(pairPoints(source));
  const tgtDir = getCurveDirection(pairPoints(target));

  if (srcDir !== tgtDir) {
    // Reverse target to match direction
    return reverseCurve(target);
  }
  return target;
}

function findBestAlignment(source, target) {
  let minDistance = Infinity;
  let bestOffset = 0;
  const sourcePoints = pairPoints(source);
  const targetPoints = pairPoints(reverseCurve(target));

  // Try all possible alignments
  for (let offset = 0; offset < targetPoints.length; offset++) {
    let totalDist = 0;
    for (let i = 0; i < sourcePoints.length; i++) {
      const srcIdx = i % sourcePoints.length;
      const tgtIdx = (i + offset) % targetPoints.length;
      const dx = sourcePoints[srcIdx].x - targetPoints[tgtIdx].x;
      const dy = sourcePoints[srcIdx].y - targetPoints[tgtIdx].y;
      totalDist += dx * dx + dy * dy;
    }
    if (totalDist < minDistance) {
      minDistance = totalDist;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

function centerCurve(curve) {
  const points = pairPoints(curve);
  let cx = 0,
    cy = 0;

  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;

  const centered = [];
  for (const p of points) {
    centered.push(p.x - cx, p.y - cy);
  }
  return centered;
}

export function prepareForMorphing(source, target) {
  // 1. Ensure same number of points
  let src = source;
  let tgt = target;

  // 2. Match direction
  tgt = ensureSameDirection(src, tgt);

  // 3. Find best starting alignment
  const offset = findBestAlignment(src, tgt);
  tgt = rotatePoints(tgt, offset);

  // 4. Center both curves
  src = centerCurve(src);
  tgt = centerCurve(tgt);

  return { source: src, target: tgt };
}

function rotatePoints(curve, offset) {
  const points = pairPoints(curve);
  const rotated = [];
  for (let i = 0; i < points.length; i++) {
    const idx = (i + offset) % points.length;
    rotated.push(points[idx].x, points[idx].y);
  }
  return rotated;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function morphPoints(source, target, progress) {
  const result = [];

  // Ensure both arrays have same length
  const count = Math.min(source.length, target.length);

  for (let i = 0; i < count; i++) {
    const srcVal = source[i];
    const tgtVal = target[i];
    // const easedProgress = easeInOut(progress);
    result.push(srcVal + (tgtVal - srcVal) * progress);
  }

  return result;
}

// Usage
export function animateMorph(sourceArray, targetArray, progress) {
  const prepared = prepareForMorphing(sourceArray, targetArray);
  return morphPoints(prepared.source, prepared.target, progress);
}

const source = [
  53.2635, 68.6401, 59.776, 64.496, 66.1405, 59.7599, 71.3949, 54.5058, 89.3043,
  36.5975, 91.3025, 20.8353, 89.4523, 15.2112, 92.1166, 12.5471, 94.7808,
  9.8831, 97.445, 7.21906, 98.185, 6.47904, 98.185, 5.29502, 97.445, 4.55501,
  96.7049, 3.815, 95.5208, 3.815, 94.7807, 4.55501, 92.1165, 7.21905, 89.4523,
  9.8831, 86.7881, 12.5471, 81.1637, 10.6971, 65.4005, 12.6951, 47.4911,
  30.6034, 42.2366, 35.8575, 37.5003, 42.2216, 33.356, 48.7337, 27.3615,
  47.2537, 16.9267, 47.2537, 9.6741, 55.3198, 1.38545, 64.422, 6.26983, 73.0801,
  8.11997, 71.3041, 9.60009, 69.7501, 12.1163, 60.6479, 23.0691, 67.678, 21.293,
  71.3781, 21.367, 73.6721, 22.5511, 74.7821, 24.1052, 76.3362, 25.6593,
  77.8902, 27.2135, 79.4442, 28.3976, 80.6282, 30.6177, 80.7762, 34.392,
  78.9262, 41.3486, 89.8784, 32.2459, 92.3944, 30.7657, 93.9484, 28.9156,
  95.7245, 37.5743, 100.609, 46.677, 92.3204, 54.7436, 85.0683, 54.7436,
  74.6341, 53.2635, 68.6401,
];

const target = [
  47.1, 0.8, 51.46666666666667, 0.8, 55.833333333333336, 0.8, 60.2, 0.8,
  64.56666666666666, 0.8, 68.93333333333334, 0.8, 73.3, 0.8, 71.4,
  6.866666666666667, 69.5, 12.933333333333335, 67.6, 19.000000000000004,
  65.69999999999999, 25.06666666666667, 63.8, 31.133333333333336, 61.9, 37.2,
  63.58888888888889, 37.2, 65.27777777777777, 37.2, 66.96666666666665, 37.2,
  68.65555555555554, 37.2, 70.34444444444443, 37.2, 72.03333333333333, 37.2,
  73.72222222222221, 37.2, 75.4111111111111, 37.2, 77.1, 37.2,
  69.36666666666666, 47.56666666666667, 61.633333333333326, 57.93333333333334,
  53.89999999999999, 68.30000000000001, 46.166666666666664, 78.66666666666667,
  38.43333333333333, 89.03333333333333, 30.7, 99.4, 32.37777777777778,
  94.12222222222222, 34.05555555555556, 88.84444444444445, 35.733333333333334,
  83.56666666666668, 37.41111111111111, 78.28888888888889, 39.08888888888889,
  73.01111111111112, 40.766666666666666, 67.73333333333333, 42.44444444444444,
  62.455555555555556, 44.12222222222222, 57.17777777777778, 45.8, 51.9, 43,
  51.9, 40.2, 51.9, 37.400000000000006, 51.9, 34.6, 51.9, 31.8, 51.9, 29, 51.9,
  31.01111111111111, 46.22222222222222, 33.02222222222222, 40.544444444444444,
  35.03333333333333, 34.86666666666667, 37.044444444444444, 29.18888888888889,
  39.05555555555556, 23.511111111111113, 41.06666666666667, 17.833333333333336,
  43.07777777777778, 12.155555555555559, 45.08888888888889, 6.47777777777778,
  47.1, 0.8,
];

// const bestOffset = findBestAlignment(source, target);

// console.log(
//   "findBestAlignment: ",
//   bestOffset,
//   " info: ",
//   source[bestOffset],
//   " - ",
//   target[bestOffset],
// );

// Now interpolate linearly between source and alignedTarget:
// currentPoint = source[i] + (alignedTarget[i] - source[i]) * progress
