import { gsap } from "../../../../src/index.js";
import { MotionPathPlugin } from "../../../../src/MotionPathPlugin.js";

gsap.registerPlugin(MotionPathPlugin);

const pause = document.getElementById("btn-pause");
const reverse = document.getElementById("btn-reverse");
const play = document.getElementById("btn-play");
const resume = document.getElementById("btn-resume");
const seek = document.getElementById("btn-seek");

let t;

const path = document.getElementById("path");
const group = document.getElementById("rect-2");

/**
 * @param {SVGGeometryElement} path
 * @param {SVGGElement} wrapper
 * @param {number} t - Progress from 0 to 1
 * @param {object} options
 * @returns {boolean} Whether placement succeeded
 */
function placeShapeAlongPath(path, wrapper, t, options = {}) {
  const {
    alignX = 0.5,
    alignY = 0.5,
    autoRotate = true,
    rotationOffset = 0, // radians
    delta,
    box,
  } = options;

  // 1. Validate inputs
  if (
    !path ||
    typeof path.getTotalLength !== "function" ||
    typeof path.getPointAtLength !== "function" ||
    !wrapper
  ) {
    throw new TypeError(
      "Expected an SVG geometry path and an SVG motion wrapper.",
    );
  }

  if (!Number.isFinite(t)) {
    throw new TypeError("Progress t must be a finite number.");
  }

  if (
    !Number.isFinite(alignX) ||
    !Number.isFinite(alignY) ||
    alignX < 0 ||
    alignX > 1 ||
    alignY < 0 ||
    alignY > 1
  ) {
    throw new RangeError("alignX and alignY must be between 0 and 1.");
  }

  if (!Number.isFinite(rotationOffset)) {
    throw new TypeError("rotationOffset must be finite.");
  }

  // 2. Get path length and clamp progress
  const totalLength = path.getTotalLength();

  if (!Number.isFinite(totalLength) || totalLength <= 0) {
    return false;
  }
  const isSvg = wrapper instanceof SVGGElement;

  const progress = Math.max(0, Math.min(1, t));
  const distance = progress * totalLength;

  // 3. Resolve coordinate systems
  const parent = wrapper.parentElement;
  const pathCTM = path.getScreenCTM();
  const parentCTM = isSvg ? parent?.getScreenCTM() : null;

  if (!pathCTM || (isSvg && !parentCTM)) {
    return false;
  }

  let screenToParent;

  try {
    let ctm = parentCTM;
    if (!isSvg || !ctm) {
      const style = window.getComputedStyle(parent);
      const transform = style.transform;
      ctm = new DOMMatrix(transform);
    }
    screenToParent = ctm.inverse();
  } catch {
    // A singular transform cannot be inverted.
    return false;
  }

  // Transform a path-local point into wrapper-parent coordinates.
  function toParent(point) {
    const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(pathCTM);

    return screenPoint.matrixTransform(screenToParent);
  }

  // 4. Convert the target point into the correct coordinate space
  const target = toParent(path.getPointAtLength(distance));

  // 5. Estimate tangent in the same coordinate space
  let theta = 0;

  if (autoRotate) {
    const sampleDelta =
      delta === undefined ? Math.max(totalLength * 0.0001, 0.01) : delta;

    if (!Number.isFinite(sampleDelta) || sampleDelta <= 0) {
      throw new RangeError("delta must be positive and finite.");
    }

    const d1 = Math.max(0, distance - sampleDelta);
    const d2 = Math.min(totalLength, distance + sampleDelta);

    if (d1 !== d2) {
      const p1 = toParent(path.getPointAtLength(d1));
      const p2 = toParent(path.getPointAtLength(d2));

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      if (Number.isFinite(dx) && Number.isFinite(dy)) {
        if (dx !== 0 || dy !== 0) {
          theta = Math.atan2(dy, dx);
        }
      }
    }
  }

  theta += rotationOffset;

  // 6. Get wrapper-local bounds
  const bounds = isSvg
    ? (box ?? wrapper.getBBox())
    : wrapper.getBoundingClientRect();

  if (
    !bounds ||
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
  ) {
    throw new TypeError("The bounding box must contain finite values.");
  }

  // Anchor position in the wrapper's local coordinates.
  const localX = bounds.x + bounds.width * alignX;
  const localY = bounds.y + bounds.height * alignY;

  // 7. Construct a rotation + translation matrix.
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const e = target.x - cos * localX + sin * localY;
  const f = target.y - sin * localX - cos * localY;

  // 8. Apply the motion transform to the wrapper.

  if (!isSvg) {
    wrapper.style.transform = `translate(${0}px, ${f}px)`;
  } else {
    wrapper.setAttribute(
      "transform",
      `matrix(${cos}, ${sin}, ${-sin}, ${cos}, ${e}, ${f})`,
    );
  }

  return true;
}

function positionDivAlongPath(path, div, progress = 0.5) {
  const pathLength = path.getTotalLength();
  const currentLength = pathLength * progress;

  // 1. Get the target point
  const point = path.getPointAtLength(currentLength);

  // 2. Get a second point slightly ahead (e.g., 1 pixel) to calculate the tangent angle
  const nextPoint = path.getPointAtLength(
    Math.min(pathLength, currentLength + 1),
  );

  // Calculate the angle in degrees
  const radians = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x);
  const angle = radians * (180 / Math.PI);

  // 3. Transform point to screen coordinates
  const svgPoint = svg.createSVGPoint();
  svgPoint.x = point.x;
  svgPoint.y = point.y;
  const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());

  // 4. Calculate container-relative position
  const container = div.parentElement;
  const containerRect = container.getBoundingClientRect();
  const x = screenPoint.x - containerRect.left;
  const y = screenPoint.y - containerRect.top;

  div.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg) `;
}

// positionDivAlongPath(
//   document.getElementById("path"),
//   document.getElementById("div"),
//   0.5,
// );

// placeShapeAlongPath(path, group, 0.45, {
//   alignX: 0.5,
//   alignY: 0.5,
//   // box: group.getBBox(),
//   autoRotate: true,
// });

// window.addEventListener("load", () =>
//   positionDivAlongPath(
//     document.getElementById("path"),
//     document.getElementById("div"),
//     0.5,
//   ),
// );
// window.addEventListener("resize", () =>
//   positionDivAlongPath(
//     document.getElementById("path"),
//     document.getElementById("div"),
//     0.5,
//   ),
// );

t = gsap.to("#div", {
  duration: 5,
  // repeat: 3,
  // yoyo: true,
  ease: "power1.inOut",
  motionPath: {
    path: "#path",
    align: "#path",
    autoRotate: true,
    alignOrigin: [0.5, 0.5],
  },
});

pause.onclick = () => {
  t.pause();
};

reverse.onclick = () => {
  console.log("-----------------------------------");
  t.reverse();
};

play.onclick = () => {
  t.play();
};

resume.onclick = () => {
  t.resume();
};

seek.onclick = () => {
  t.seek(0.5);
};
