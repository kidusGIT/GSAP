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
// t.to(".green", { duration: 1, x: 535, repeat: 3, yoyo: true })
//   .to(".yellow", { duration: 2, x: 535 })
//   .to(".red", { duration: 1, x: 535 });

let t = gsap.timeline();

t.to(".green", {
  x: 535,
  rotation: 360,
  scale: 0.5,
})
  .to(".green", {
    y: 100,
  })
  .to(".green", {
    x: 10,
  })
  .to(".green", {
    y: 0,
  });

// const t = gsap.to(".green", {
//   duration: 1.5,
//   x: 535,
//   rotation: 360,
//   scale: 0.5,
//   // repeat: 2,
//   // yoyo: true,
// });

// const t = gsap.to(".ball", {
//   duration: 1,
//   rotation: 180,
//   x: 535,
//   scale: 0.5,
//   opacity: 1,
//   repeat: 2,
//   yoyo: true,
//   stagger: {
//     each: 0.5,
//     from: "center",
//     // yoyo: true,
//   },
//   ease: "sine.out",
// });

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
