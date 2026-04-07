#!/usr/bin/env node

const TEAL = "\x1b[38;2;0;206;209m";
const DIM = "\x1b[38;2;80;90;100m";
const WHITE = "\x1b[38;2;220;225;230m";
const RESET = "\x1b[0m";

const cmd = process.argv[2];

if (cmd === "install") {
  require("./install.js");
} else {
  console.log("");
  console.log(`${TEAL}  ◆ Qualia Framework v2${RESET}`);
  console.log(`${DIM}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log("");
  console.log(`  ${WHITE}Usage:${RESET}`);
  console.log(`    npx qualia-framework-v2 ${TEAL}install${RESET}    Install the framework`);
  console.log("");
}
