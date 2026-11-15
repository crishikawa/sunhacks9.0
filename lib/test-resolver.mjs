import { register } from "node:module";

register(new URL("./test-hook.mjs", import.meta.url), import.meta.url);
