import { gsap } from "../../../src/index.js";
import { MorphSVGPlugin } from "../../../src/MorphSVGPlugin.js";

gsap.registerPlugin(MorphSVGPlugin);

const start = document.getElementById("btn-start");
const pause = document.getElementById("btn-pause");
const reverse = document.getElementById("btn-reverse");
const play = document.getElementById("btn-play");
const resume = document.getElementById("btn-resume");
const seek = document.getElementById("btn-seek");

let t;
t = gsap.to("#diamond", { morphSVG: "#lightning", duration: 1.5 });

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
