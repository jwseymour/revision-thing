const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./node_modules/openai/package.json', 'utf8'));
console.log("OpenAI Version:", pkg.version);

const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: "test" });
console.log("Has beta?", !!openai.beta);
console.log("Has vectorStores?", !!openai.beta?.vectorStores);
console.log("Keys in beta:", Object.keys(openai.beta || {}));
