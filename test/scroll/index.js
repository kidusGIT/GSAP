import { gsap } from "../../src/index.js";
import { ScrollTrigger } from "../../src/ScrollTrigger.js";
gsap.registerPlugin(ScrollTrigger);

// const t = gsap.timeline({
//   scrollTrigger: {
//     trigger: [".violet", ".blue"], // for multiple targets
//     start: "-100px 40%",
//     end: "300px 50%",
//     scrub: true,
//     markers: true,
//     // toggleActions: 'onEnter onLeave onEnterBack onLeaveBack' // make scrub false
//   },
// });

// t.to(".violet", {
//   x: 1100,
// }).to(".blue", {
//   x: 900,
// });

// onEnter onLeave onEnterBack onLeaveBack can be [ play, pause, reverse, resume, restart, reset, complete, none ]

gsap.to(".violet", {
  x: 1100,
  scrollTrigger: {
    trigger: ".violet", // for multiple targets
    start: "-50px center",
    end: "300px center",
    scrub: true,
    markers: true,
  },
});

gsap.to(".blue", {
  x: 900,
  scrollTrigger: {
    trigger: ".blue", // for multiple targets
    // start: "-50px 70%",
    // end: "300px 90%",
    start: "-50px center",
    end: "300px center",
    scrub: true,
    markers: true,
  },
});
