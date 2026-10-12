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

var values = "100%;40% 60%;20 350;50% 50%;true;10%".split(";"),
  currentIndex = 0;

//set the initial value
gsap.set("#path, #code", { visibility: "visible" });

function next() {
  gsap.killTweensOf(next); //in case the user clicks, clear any delayed calls to this method.
  if (++currentIndex === values.length) {
    currentIndex = 0;
  }
  if (values[currentIndex] === "true") {
    gsap.set("#current", { text: values[currentIndex] });
  } else {
    gsap.set("#current", { text: '"' + values[currentIndex] + '"' });
  }
  gsap.to("#path", {
    drawSVG: values[currentIndex],
    duration: 1,
    ease: "power1.inOut",
  });
}

document.querySelector("#next").addEventListener("click", next);

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
  t.seek(1.5);
};
