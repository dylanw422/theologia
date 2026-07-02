import agent from "@convex-dev/agent/convex.config";
import betterAuth from "@convex-dev/better-auth/convex.config";
import polar from "@convex-dev/polar/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);
app.use(polar);
app.use(agent);

export default app;
