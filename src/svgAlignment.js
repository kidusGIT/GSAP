/**
 * Aligns target Bézier curve array to match source orientation and segment order
 * for smooth SVG morphing without twisting or structure breakdown.
 *
 * @param {number[]} source - Flat array of coordinates [x0, y0, x1, y1, ...]
 * @param {number[]} target - Flat array of coordinates [x0, y0, x1, y1, ...]
 * @returns {number[]} Optimal aligned target array
 */
function alignBezierCurvesForMorphing(source, target) {
  const len = source.length;
  if (len !== target.length) {
    throw new Error("Source and target arrays must be the same length.");
  }

  const numPoints = len / 2;
  // Cubic Bézier curves repeat every 3 points (Control 1, Control 2, Anchor)
  const segmentStride = 3;
  const numSegments = (numPoints - 1) / segmentStride;

  if (!Number.isInteger(numSegments)) {
    console.warn(
      "Array point count does not align cleanly to cubic Bézier segments. Falling back to point-stride.",
    );
  }

  const stride = Number.isInteger(numSegments) ? segmentStride : 1;
  const totalSteps = numPoints / stride;

  let bestAlignedTarget = null;
  let minTotalDistanceSq = Infinity;

  // Test 1: Forward Alignment across valid Bézier segment shifts
  for (let step = 0; step < totalSteps; step++) {
    const shiftPoints = step * stride;
    const shiftCoords = shiftPoints * 2;

    let currentDistSq = 0;
    for (let i = 0; i < len; i += 2) {
      const targetIdx = (i + shiftCoords) % len;
      const dx = source[i] - target[targetIdx];
      const dy = source[i + 1] - target[targetIdx + 1];
      currentDistSq += dx * dx + dy * dy;
    }

    if (currentDistSq < minTotalDistanceSq) {
      minTotalDistanceSq = currentDistSq;
      bestAlignedTarget = reorderArray(target, shiftCoords, false);
    }
  }

  // Test 2: Reverse Winding Order Alignment (handles opposite drawing directions)
  const reversedTarget = reverseBezierPath(target);

  for (let step = 0; step < totalSteps; step++) {
    const shiftPoints = step * stride;
    const shiftCoords = shiftPoints * 2;

    let currentDistSq = 0;
    for (let i = 0; i < len; i += 2) {
      const targetIdx = (i + shiftCoords) % len;
      const dx = source[i] - reversedTarget[targetIdx];
      const dy = source[i + 1] - reversedTarget[targetIdx + 1];
      currentDistSq += dx * dx + dy * dy;
    }

    if (currentDistSq < minTotalDistanceSq) {
      minTotalDistanceSq = currentDistSq;
      bestAlignedTarget = reorderArray(reversedTarget, shiftCoords, false);
    }
  }

  return bestAlignedTarget;
}

// Helper: Cyclically offset array coordinates
function reorderArray(arr, shiftCoords) {
  const len = arr.length;
  const result = new Array(len);
  for (let i = 0; i < len; i += 2) {
    const sourceIdx = (i + shiftCoords) % len;
    result[i] = arr[sourceIdx];
    result[i + 1] = arr[sourceIdx + 1];
  }
  return result;
}

// Helper: Safely reverse Bézier path order while keeping control point pairs attached to their anchors
function reverseBezierPath(arr) {
  const len = arr.length;
  const result = new Array(len);

  // Copy start point from end of original array
  result[0] = arr[len - 2];
  result[1] = arr[len - 1];

  let writeIdx = 2;
  for (let i = len - 2; i > 0; i -= 6) {
    // Reverse control points and anchors in groups of 3 points (6 coords)
    result[writeIdx] = arr[i - 2]; // Control Point 2
    result[writeIdx + 1] = arr[i - 1];
    result[writeIdx + 2] = arr[i - 4]; // Control Point 1
    result[writeIdx + 3] = arr[i - 3];
    result[writeIdx + 4] = arr[i - 6]; // Next Anchor
    result[writeIdx + 5] = arr[i - 5];
    writeIdx += 6;
  }

  return result;
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

const alignedTarget = alignBezierCurvesForMorphing(source, target);

console.log(alignedTarget);

// Now interpolate linearly between source and alignedTarget:
// currentPoint = source[i] + (alignedTarget[i] - source[i]) * progress
