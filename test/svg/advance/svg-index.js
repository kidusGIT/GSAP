import { gsap } from "../../../src/index.js";
import { MorphSVGPlugin } from "../../../src/MorphSVGPlugin.js";

const pause = document.getElementById("btn-pause");
const reverse = document.getElementById("btn-reverse");
const play = document.getElementById("btn-play");
const resume = document.getElementById("btn-resume");
const seek = document.getElementById("btn-seek");

gsap.registerPlugin(MorphSVGPlugin);

let t = gsap
  .timeline({
    defaults: { duration: 1.5, ease: "expo.inOut" },
    // repeat: -1,
  })
  .to("#morph", { morphSVG: "#speech" })
  .to("#morph", { morphSVG: "#rocket" })
  .to("#morph", { morphSVG: "#lightning" })
  .to("#morph", { morphSVG: "#mute" })
  .to("#morph", { morphSVG: "#thumb" })
  .to("#morph", { morphSVG: "#square" })
  .to("#morph", { morphSVG: "#grid" })
  .to("#morph", { morphSVG: "#bulb" })
  .to("#morph", { morphSVG: "#morph" });

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
