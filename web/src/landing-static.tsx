import React from "react";
import ReactDOM from "react-dom/client";
import "@douyinfe/semi-ui/lib/es/_base/base.css";
import "./app/styles/landing-static.css";
import { LandingContent } from "./features/landing/LandingContent";

const quickstartUrl = "https://github.com/yv1ing/Z3r0/blob/main/Quickstart.md";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LandingContent onOpenWorkbench={() => window.location.assign(quickstartUrl)} />
  </React.StrictMode>,
);
