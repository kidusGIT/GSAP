import { gsap } from "../../src/index.js";

const start = document.getElementById("btn-start");
const pause = document.getElementById("btn-pause");
const reverse = document.getElementById("btn-reverse");
const play = document.getElementById("btn-play");
const resume = document.getElementById("btn-resume");

// const t = gsap.timeline();
// t.to(".green", { duration: 1, x: 535 })
//   .to(".yellow", { duration: 2, x: 535 }, ">-2")
//   .to(".red", { duration: 1, x: 535 }, "<-1");

// const t = gsap.timeline();
// t.to(".green", { duration: 1, x: 535 })
//   .to(".yellow", { duration: 2, x: 535 })
//   .to(".red", { duration: 1, x: 535 });

// const t = gsap.to(".green", {
//   duration: 1.5,
//   x: 535,
//   // rotation: 360,
//   // repeat: -1,
// });

const t = gsap.to(".ball", {
  duration: 1,
  rotation: 180,
  x: 535,
  scale: 0.5,
  opacity: 1,
  // delay: 0.5,
  // stagger: 0.5, // stagger in from the left with a 0.1 second gap in between animations
  stagger: {
    each: 0.05,
    from: "center",
  },
  ease: "sine.out",
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

// start.onclick = () => {
//   // t.animate(".yellow", "left", { duration: 1000, to: 420 });
// };
