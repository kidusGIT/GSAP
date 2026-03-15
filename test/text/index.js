import { gsap } from "../../src/index.js";
import ScrambleTextPlugin from "../../src/ScrambleTextPlugin.js";
import TextPlugin from "../../src/TextPlugin.js";
import SplitText from "../../src/SplitText.js";

gsap.registerPlugin(TextPlugin);
gsap.registerPlugin(ScrambleTextPlugin);
gsap.registerPlugin(SplitText);

const pause = document.getElementById("btn-pause");
const reverse = document.getElementById("btn-reverse");
const play = document.getElementById("btn-play");
const resume = document.getElementById("btn-resume");

let t;
let split;

// split = SplitText.create(".animate-text", {
//   type: "words, chars",
//   // mask: "lines",
//   // autoSplit: true,
//   onSplit(self) {
//     console.log("self ", self.words);
//     return gsap.from(self.chars, {
//       duration: 0.5,
//       y: 100,
//       autoAlpha: 0,
//       stagger: 0.5,
//     });
//   },
// });

split = SplitText.create(".animate-text", { type: "words, chars" });

// now animate the characters in a staggered fashion
t = gsap.from(split.chars, {
  duration: 2,
  x: 100, // animate from 100px below
  autoAlpha: 0, // fade in from opacity: 0 and visibility: hidden
  stagger: 0.5, // 0.05 seconds between each
});

//use the defaults
// t = gsap.to(".animate-text", {
//   duration: 1,
//   scrambleText: "This Is New Text",
// }); //or customize things:

// t = gsap.to(".animate-text", {
//   duration: 2,
//   scrambleText: {
//     text: "This Is New Text",
//     chars: "YYYYzzzz",
//     revealDelay: 0,
//     speed: 1,
//     newClass: "myClass",
//   },
// });

// t = gsap.to(".animate-text", {
//   duration: 2,
//   text: "This is the new text",
//   ease: "none",
// });

pause.onclick = () => {
  t.pause();
};

reverse.onclick = () => {
  console.log("----------------------------");
  t.reverse();
};

play.onclick = () => {
  t.play();
};

resume.onclick = () => {
  t.resume();
};
