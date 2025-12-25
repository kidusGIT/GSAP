import { gsap } from "../../src/index.js";
import { ScrollTrigger } from "../../src/ScrollTrigger.js";
gsap.registerPlugin(ScrollTrigger);

const t = gsap.timeline({
  scrollTrigger: {
    trigger: ".card",
    start: "-100px center",
    end: "300px center",
    scrub: true,
    markers: true,
    // toggleActions: 'onEnter onLeave onEnterBack onLeaveBack' // make scrub false
  },
});

// onEnter onLeave onEnterBack onLeaveBack can be [ play, pause, reverse, resume, restart, reset, complete, none ]

t.to(".card", {
  x: 1100,
});
