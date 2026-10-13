import { gsap } from "../../../../src/index.js";
import { DrawSVGPlugin } from "../../../../src/DrawSVGPlugin.js";

gsap.registerPlugin(DrawSVGPlugin);

const start = document.getElementById("btn-start");
const pause = document.getElementById("btn-pause");
const reverse = document.getElementById("btn-reverse");
const play = document.getElementById("btn-play");
const resume = document.getElementById("btn-resume");
const seek = document.getElementById("btn-seek");

let t;

// var values = "100%;40% 60%;20 350;50% 50%;true;10%".split(";"),
//   currentIndex = 0;

//set the initial value
let values = ["-70%", "100%", "70%"];
let currentIndex = 0;
gsap.set("#rocket, #code", { visibility: "visible" });

const text = document.getElementById("current");

function next() {
  gsap.killTweensOf(next); //in case the user clicks, clear any delayed calls to this method.
  if (++currentIndex === values.length) {
    currentIndex = 0;
  }
  if (values[currentIndex] === "true") {
    gsap.set("#current", { text: values[currentIndex] });
    text.textContent = values[currentIndex];
  } else {
    gsap.set("#current", { text: '"' + values[currentIndex] + '"' });
    text.textContent = '"' + values[currentIndex] + '"';
  }
  gsap.to("#rocket", {
    drawSVG: values[currentIndex],
    duration: 1,
    ease: "power1.inOut",
  });
}

gsap.from("#rocket", {
  drawSVG: "25% 90%",
  duration: 1,
  ease: "power1.inOut",
});

const drawPercentage = ["10% 75%", "25% 90%", "100%"]; // [ "offset, dash array" ] it offset will be multiplied by -1 internally by DrawSVGPlugin

let index = 0;
function draw() {
  index = (index + 1) % drawPercentage.length;
  console.log("index ", index);

  const el = document.querySelector("#rocket");
  const length = el.getTotalLength();

  gsap.to("#rocket", {
    drawSVG: drawPercentage[index],
    duration: 1,
    ease: "power1.inOut",
  });
  text.textContent = drawPercentage[index];
}

// draw()
document.querySelector("#next").addEventListener("click", draw);

// pause.onclick = () => {
//   t.pause();
// };

// reverse.onclick = () => {
//   console.log("-----------------------------------");
//   t.reverse();
// };

// play.onclick = () => {
//   t.play();
// };

// resume.onclick = () => {
//   t.resume();
// };

// seek.onclick = () => {
//   t.seek(1.5);
// };
