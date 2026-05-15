import { Button, Tag } from "@douyinfe/semi-ui";
import {
  Activity,
  ArrowRight,
  Bot,
  Box,
  Braces,
  CheckCircle2,
  ChevronRight,
  Code2,
  Database,
  FileSearch,
  Fingerprint,
  GitBranch,
  Layers3,
  LockKeyhole,
  MessageSquareCode,
  Network,
  ShieldCheck,
  SquareTerminal,
  UsersRound,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import z3r0Logo from "../../assets/z3r0-logo.png";
import { useAuth } from "../../shared/auth/AuthProvider";

type ArchitectureNode = {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
};

const navItems = [
  ["Architecture", "architecture"],
  ["Agents", "agents"],
  ["Runtime", "runtime"],
  ["Security", "security"],
];

const architectureNodes: ArchitectureNode[] = [
  { id: "operator", label: "Security Operator", detail: "Starts authorized research, review, and red team tasks from the browser.", icon: Fingerprint },
  { id: "web", label: "React Workbench", detail: "Consumes stable REST and WebSocket event contracts without SDK coupling.", icon: MessageSquareCode },
  { id: "api", label: "FastAPI API", detail: "Owns route contracts, auth dependencies, streaming handlers, and resource services.", icon: Braces },
  { id: "runtime", label: "Agent Runtime", detail: "Builds sessions, streams normalized events, compacts context, and binds tools.", icon: Workflow },
  { id: "registry", label: "Agent Registry", detail: "Creates a per-session agent graph from role specs, config, knowledge, and sandbox state.", icon: GitBranch },
  { id: "team", label: "CSO + Specialists", detail: "Coordinator delegates to intelligence, penetration, reverse, and crypto specialists.", icon: UsersRound },
  { id: "llm", label: "LiteLLM / OpenAI-compatible Models", detail: "Model access stays behind the runtime and specialist roles.", icon: Bot },
  { id: "store", label: "PostgreSQL Session Store", detail: "Persists messages, metadata, delegation jobs, and replayable investigation history.", icon: Database },
  { id: "sandbox", label: "Docker Sandbox", detail: "Provides controlled command, shell, browser, file, and GUI execution surfaces.", icon: Box },
  { id: "tools", label: "Commands / Skills / noVNC", detail: "Tool results are structured for agents while operators can take manual control.", icon: SquareTerminal },
];

const agents = [
  { code: "cso", name: "Z3r0", role: "Chief Security Officer", detail: "Task decomposition, coordination, result integration.", accent: "red" },
  { code: "cie", name: "L1ly", role: "Chief Intelligence Engineer", detail: "Target profiling, asset mapping, relationship analysis.", accent: "cyan" },
  { code: "cpe", name: "Fr4nk", role: "Chief Penetration Engineer", detail: "Penetration testing, vulnerability validation, risk verification.", accent: "red" },
  { code: "cre", name: "J4m3", role: "Chief Reverse Engineer", detail: "File, binary, firmware, and APK reverse engineering.", accent: "cyan" },
  { code: "cce", name: "Nu1L", role: "Chief Cryptography Engineer", detail: "Protocol review, key management, implementation analysis.", accent: "red" },
];

const runtimeSteps = [
  { title: "Send", text: "User sends text, target agent, and optional sandbox binding.", icon: MessageSquareCode },
  { title: "Pool", text: "AgentSessionPool creates or resumes the active session.", icon: Layers3 },
  { title: "Project", text: "Z3r0Session loads the right history view for each agent.", icon: FileSearch },
  { title: "Stream", text: "Runner output becomes thinking, text, tool, and subagent events.", icon: Activity },
  { title: "Persist", text: "Messages, metadata, and durable facts are stored for replay.", icon: Database },
];

const highlights = [
  ["Session-level Agent Graph", "Role configuration, tools, knowledge, and subagents are bound dynamically per session."],
  ["Persistent Delegation Jobs", "Subagents can run in the background, recover from stale state, and notify the parent agent."],
  ["Viewer-specific Projection", "Agents share persisted history while receiving scoped context views."],
  ["Long-context Compaction", "Earlier history is summarized while recent context and durable facts stay available."],
  ["Stable Streaming Contract", "Frontend event schemas are independent from model SDK internals."],
  ["Sandbox Tool Invalidation", "Sandbox status changes invalidate tool bindings and clean up active jobs."],
];

const sandboxTools = ["Commands", "Skills", "Shell", "Files", "noVNC", "Ghidra", "jadx", "sqlmap", "nmap"];

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeNode, setActiveNode] = useState(architectureNodes[3]);
  const consolePath = isAuthenticated ? "/playground" : "/login";
  const ActiveArchitectureIcon = activeNode.icon;

  return (
    <main className="landing-page">
      <div className="landing-grid" aria-hidden="true" />
      <div className="landing-scanline" aria-hidden="true" />

      <header className="landing-headbar">
        <a className="landing-headbar-brand" href="#top" aria-label="Z3r0 home">
          <img src={z3r0Logo} alt="" />
          <span>Z3r0</span>
        </a>
        <nav className="landing-headbar-links" aria-label="Landing navigation">
          {navItems.map(([label, id]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </nav>
        <Button theme="solid" type="danger" icon={<ArrowRight size={16} />} onClick={() => navigate(consolePath)}>
          {isAuthenticated ? "Open console" : "Enter workbench"}
        </Button>
      </header>

      <section id="top" className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <Tag color="red" size="large">Authorized security operations</Tag>
          <div className="landing-title-row">
            <img className="landing-hero-logo" src={z3r0Logo} alt="Z3r0 logo" />
            <div>
              <h1 id="landing-title">Z3r0</h1>
              <p>
                A multi-agent collaboration platform for authorized red team operations,
                code auditing, and security research.
              </p>
            </div>
          </div>
          <div className="landing-actions">
            <Button theme="solid" type="danger" size="large" icon={<ShieldCheck size={17} />} onClick={() => navigate(consolePath)}>
              Launch console
            </Button>
            <Button theme="outline" size="large" icon={<Network size={17} />} onClick={() => scrollToSection("architecture")}>
              Explore architecture
            </Button>
          </div>
        </div>

        <div className="landing-orbit" aria-label="Z3r0 operating model">
          <div className="landing-orbit-core">
            <div className="landing-orbit-core-mark">Z3r0</div>
            <strong>Coordinator</strong>
            <span>specialist graph</span>
          </div>
          {agents.slice(1).map((agent, index) => (
            <div key={agent.code} className={`landing-orbit-node landing-orbit-node-${index + 1}`}>
              <b>{agent.name}</b>
              <span>{agent.role.replace("Chief ", "").replace(" Engineer", "")}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="architecture" className="landing-section landing-architecture" aria-labelledby="architecture-title">
        <div className="landing-section-heading">
          <span className="page-eyebrow">Architecture</span>
          <h2 id="architecture-title">React workbench, FastAPI runtime, specialist agents, and sandbox tools.</h2>
          <p>The README architecture is rendered here as an interactive map. Hover or focus a node to inspect its responsibility.</p>
        </div>

        <div className="landing-architecture-layout">
          <div className="landing-architecture-map">
            {architectureNodes.map((node, index) => {
              const Icon = node.icon;
              const isActive = activeNode.id === node.id;
              return (
                <button
                  key={node.id}
                  className={`landing-arch-node landing-arch-node-${node.id}${isActive ? " active" : ""}`}
                  type="button"
                  onClick={() => setActiveNode(node)}
                  onFocus={() => setActiveNode(node)}
                  onMouseEnter={() => setActiveNode(node)}
                >
                  <Icon size={18} />
                  <span>{node.label}</span>
                  {index < 6 ? <ChevronRight size={15} /> : null}
                </button>
              );
            })}
          </div>

          <aside className="landing-architecture-detail">
            <div className="landing-detail-icon">
              <ActiveArchitectureIcon size={26} />
            </div>
            <span className="page-eyebrow">Selected node</span>
            <h3>{activeNode.label}</h3>
            <p>{activeNode.detail}</p>
            <div className="landing-contract">
              <Code2 size={16} />
              <span>Stable REST / WebSocket event protocol</span>
            </div>
          </aside>
        </div>
      </section>

      <section id="agents" className="landing-section" aria-labelledby="agents-title">
        <div className="landing-section-heading">
          <span className="page-eyebrow">Agent Team</span>
          <h2 id="agents-title">A coordinator with domain specialists for security work that spans multiple disciplines.</h2>
        </div>
        <div className="landing-agent-grid">
          {agents.map((agent) => (
            <article key={agent.code} className={`landing-agent-card landing-agent-card-${agent.accent}`}>
              <div>
                <span>{agent.code}</span>
                <strong>{agent.name}</strong>
              </div>
              <h3>{agent.role}</h3>
              <p>{agent.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="runtime" className="landing-section landing-runtime" aria-labelledby="runtime-title">
        <div className="landing-section-heading">
          <span className="page-eyebrow">Runtime Flow</span>
          <h2 id="runtime-title">Streaming sessions stay replayable, cancellable, and compacted for long investigations.</h2>
        </div>

        <div className="landing-runtime-track">
          {runtimeSteps.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className="landing-runtime-step">
              <div>
                <Icon size={18} />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>

        <div className="landing-sandbox-panel">
          <div>
            <span className="page-eyebrow">Sandbox Tooling</span>
            <h3>Manual takeover and agent tools share the same controlled execution boundary.</h3>
            <p>Agents receive structured command results while operators can open shell, screen, and file manager views for review.</p>
          </div>
          <div className="landing-tool-cloud">
            {sandboxTools.map((tool) => <span key={tool}>{tool}</span>)}
          </div>
        </div>
      </section>

      <section className="landing-section landing-highlights" aria-labelledby="highlights-title">
        <div className="landing-section-heading">
          <span className="page-eyebrow">Technical Highlights</span>
          <h2 id="highlights-title">Runtime boundaries designed for controlled, reviewable security operations.</h2>
        </div>
        <div className="landing-highlight-grid">
          {highlights.map(([title, text], index) => (
            <article key={title} className="landing-highlight-card">
              {index % 2 === 0 ? <Zap size={18} /> : <CheckCircle2 size={18} />}
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="security" className="landing-section landing-security" aria-labelledby="security-title">
        <div>
          <span className="page-eyebrow">Quick Start</span>
          <h2 id="security-title">Deploy the workbench, then treat the sandbox and credentials as high-privilege assets.</h2>
        </div>
        <div className="landing-terminal" aria-label="Quick start commands">
          <div><span /> <strong>z3r0 bootstrap</strong></div>
          <pre>{`cp .z3r0/config.json.example .z3r0/config.json
docker compose -f docker-compose.prod.yml up -d --build
open http://127.0.0.1:8000`}</pre>
        </div>
        <div className="landing-boundary">
          <LockKeyhole size={20} />
          <p>
            Z3r0 is intended for authorized testing, code auditing, red team exercises,
            research, and training environments. Docker socket access, terminal access,
            file management, and model credentials should stay isolated and trusted.
          </p>
        </div>
      </section>
    </main>
  );
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}
