import { gsap } from "../../src/index.js";
import { ScrollTrigger } from "../../src/ScrollTrigger.js";
gsap.registerPlugin(ScrollTrigger);

const t = gsap.to(".blue", {
  x: 700,
  duration: 1.5,
  scrollTrigger: {
    trigger: ".scroll-container", // for multiple targets
    start: "-70px 50%",
    end: "258px 60%",
    // start: "-50px center",
    // end: "300px center",

    scrub: true,
    markers: true,
  },
});
