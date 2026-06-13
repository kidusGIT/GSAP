import { gsap } from "../../src/index.js";

const start = document.getElementById("btn-start");
const pause = document.getElementById("btn-pause");
const reverse = document.getElementById("btn-reverse");
const play = document.getElementById("btn-play");
const resume = document.getElementById("btn-resume");
const seek = document.getElementById("btn-seek");

let t;

// const t = gsap.timeline();
// t.to(".green", { duration: 1, x: 535 })
//   .to(".yellow", { duration: 2, x: 535 }, ">-2")
//   .to(".red", { duration: 1, x: 535 }, "<-1");

t = gsap.timeline({ repeat: 2, yoyo: true });
t.to(".green", { duration: 1, x: 535 })
  .to(".yellow", { duration: 1.3, x: 535 })
  .to(".red", { duration: 1, x: 535 });

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

// start.onclick = () => {
//   // t.animate(".yellow", "left", { duration: 1000, to: 420 });
// };
