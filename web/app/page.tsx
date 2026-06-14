'use client';

import { useState, useCallback } from 'react';

const MONO = 'var(--font-geist-mono), monospace';

function fallbackCopy(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    try {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } catch {
      fallbackCopy(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button
      onClick={copy}
      style={{ fontFamily: MONO, background: 'none' }}
      className={`border rounded px-2.5 py-1 text-[11px] cursor-pointer transition-all tracking-[0.04em] ${
        copied
          ? 'border-[#3d9e5a] text-[#3d9e5a]'
          : 'border-[#2A2A2E] text-[#8A8A96] hover:border-[#E55A1C] hover:text-[#E55A1C]'
      }`}
    >
      {copied ? 'copied!' : 'copy'}
    </button>
  );
}

const FEATURES = [
  { num: '01', name: 'Navigate', desc: 'Every reasoning step is a node. Click any point in the tree to inspect, copy, or continue from there.' },
  { num: '02', name: 'Fork', desc: 'Branch from any node. Inject a new fact mid-thought. See how the conclusion changes without starting over.' },
  { num: '03', name: 'Compare', desc: 'Diff two runs side by side. Same prompt, different assumptions — what changed?' },
];

const CLI_CHIPS = ['Claude Code', 'OpenAI Codex', 'Google Gemini CLI', 'Factory.ai Droid'];

const WAYS = [
  { tag: 'CLI', title: "branch 'prompt'", desc: 'Captures the full reasoning tree in your terminal. Navigate it without leaving your workflow.' },
  { tag: 'MCP', title: 'MCP server', desc: 'Claude Code agents externalize their own reasoning. Branch intercepts and stores every step automatically.' },
  { tag: 'Web', title: 'Web viewer', desc: 'Share trees with your team. Public or private. Persistent links, no setup required.' },
];

const TERMINAL_LINES = [
  [{ text: 'npm', color: '#E55A1C' }, { text: ' install -g branch-ai', color: '#8ABFE8' }],
  [{ text: 'branch', color: '#E55A1C' }, { text: ' "explain why this query is slow"', color: '#8ABFE8' }],
  [{ text: 'branch', color: '#E55A1C' }, { text: ' doctor', color: '#8ABFE8' }, { text: '  # check which CLIs are available', color: '#4A4A56' }],
];

export default function BranchAILanding() {
  return (
    <div className="min-h-screen bg-[#0B0B0D] text-[#E8E8EC] antialiased">
      {/* Nav */}
      <nav
        className="sticky top-0 z-[100] border-b border-[#2A2A2E] px-8 py-4 flex items-center justify-between"
        style={{ background: 'rgba(11,11,13,0.88)', backdropFilter: 'blur(12px)' }}
      >
        <div style={{ fontFamily: MONO }} className="text-[14px] font-semibold tracking-[-0.02em]">
          <span className="text-[#E55A1C]">branch</span> ai
        </div>
        <ul className="flex gap-7 list-none">
          {([['#problem', 'problem'], ['#features', 'features'], ['#install', 'install'], ['https://github.com/nikolas-sapa/branch-ai', 'github ↗']] as const).map(
            ([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  style={{ fontFamily: MONO }}
                  className="text-[12px] text-[#8A8A96] hover:text-[#E8E8EC] transition-colors tracking-[0.03em]"
                >
                  {label}
                </a>
              </li>
            )
          )}
        </ul>
      </nav>

      {/* Hero */}
      <section className="py-[96px] max-w-[900px] mx-auto px-8">
        <p style={{ fontFamily: MONO }} className="text-[11px] text-[#E55A1C] tracking-[0.12em] uppercase mb-5">
          // reasoning trees for AI agents
        </p>
        <h1
          style={{ fontFamily: MONO, fontSize: 'clamp(28px, 4vw, 48px)' }}
          className="font-bold leading-[1.15] tracking-[-0.025em] text-[#E8E8EC] mb-5 max-w-[680px]"
        >
          AI reasoning that vanishes<br />the moment you see the answer.
        </h1>
        <p className="text-[18px] text-[#8A8A96] leading-[1.7] max-w-[560px] mb-10">
          Branch captures every step. Navigate the tree. Fork from any node.
          Diff two runs. Finally understand <em>why</em> the answer changed.
        </p>

        <div className="flex items-center gap-5 flex-wrap mb-16">
          <div className="flex items-center gap-3 bg-[#1A1A1E] border border-[#2A2A2E] rounded-[6px] px-4 py-3">
            <code style={{ fontFamily: MONO }} className="text-[14px] text-[#E8E8EC] tracking-[-0.01em]">
              npm install -g branch-ai
            </code>
            <CopyBtn text="npm install -g branch-ai" />
          </div>
        </div>

        {/* Reasoning tree */}
        <div className="relative bg-[#1A1A1E] border border-[#2A2A2E] rounded-[12px] px-8 py-7 max-w-[600px] overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-px opacity-60"
            style={{ background: 'linear-gradient(90deg, #E55A1C 0%, transparent 60%)' }}
          />
          <div style={{ fontFamily: MONO }} className="text-[11px] text-[#4A4A56] tracking-[0.08em] uppercase mb-4">
            // reasoning tree · live
          </div>
          <pre style={{ fontFamily: MONO, whiteSpace: 'pre', margin: 0 }} className="text-[13px] leading-[1.9] text-[#8A8A96]">
            <span className="text-[#E8E8EC] font-medium">{'┌─ [root] How should I architect this?'}</span>{'\n'}
            <span className="text-[#4A4A56]">{'│'}</span>{'\n'}
            <span className="text-[#4A4A56]">{'│  ├─ '}</span>{'Option A: monolith'}{'\n'}
            <span className="text-[#4A4A56]">{'│  │'}</span>{'\n'}
            <span className="text-[#4A4A56]">{'│  │   └─ '}</span><span className="text-[#E55A1C] font-medium">{'[fork]'}</span>{' What if the team scales?'}{'\n'}
            <span className="text-[#4A4A56]">{'│  │         ├─ '}</span>{'introduce service boundaries early'}{'\n'}
            <span className="text-[#4A4A56]">{'│  │         └─ '}</span>{'refactor later (tech debt)'}{'\n'}
            <span className="text-[#4A4A56]">{'│  │'}</span>{'\n'}
            <span className="text-[#4A4A56]">{'│  └─ '}</span>{'Option B: services '}<span className="text-[#E55A1C]">{'← you are here'}</span>{'\n'}
            <span className="text-[#4A4A56]">{'│        ├─ '}</span>{'define contracts first'}{'\n'}
            <span className="text-[#4A4A56]">{'│        └─ '}</span>{'deploy independently'}
          </pre>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="py-[80px] border-y border-[#1F1F23]">
        <div className="max-w-[900px] mx-auto px-8">
          <h2
            style={{ fontFamily: MONO, fontSize: 'clamp(22px, 3vw, 32px)' }}
            className="font-semibold leading-[1.2] tracking-[-0.025em] text-[#E8E8EC] mb-5"
          >
            Reasoning that vanishes<br />the moment you see the answer.
          </h2>
          <p className="text-[18px] text-[#8A8A96] leading-[1.7] max-w-[620px] border-l-2 border-[#2A2A2E] pl-6">
            When an AI works through a hard problem, the reasoning disappears the moment you read the output.
            You got a wall of text you can&apos;t trace.{' '}
            <strong className="text-[#E8E8EC] font-medium">
              If the answer is wrong, you start over. If it&apos;s right, you don&apos;t know why.
            </strong>
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-[80px] border-b border-[#1F1F23]">
        <div className="max-w-[900px] mx-auto px-8">
          <h2
            style={{ fontFamily: MONO, fontSize: 'clamp(22px, 3vw, 32px)' }}
            className="font-semibold leading-[1.2] tracking-[-0.025em] text-[#E8E8EC] mb-12"
          >
            Every step. Inspectable.<br />Forkable. Comparable.
          </h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {FEATURES.map((f) => (
              <div
                key={f.num}
                className="group relative bg-[#1A1A1E] border border-[#2A2A2E] rounded-[12px] p-7 transition-colors hover:border-[#E55A1C] overflow-hidden"
              >
                <div
                  className="absolute inset-0 rounded-[12px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: 'rgba(229,90,28,0.08)' }}
                />
                <div style={{ fontFamily: MONO }} className="text-[11px] text-[#4A4A56] tracking-[0.08em] mb-3">
                  {f.num}
                </div>
                <div style={{ fontFamily: MONO }} className="text-[17px] font-semibold text-[#E55A1C] mb-3 tracking-[-0.02em]">
                  {f.name}
                </div>
                <p className="text-[14px] text-[#8A8A96] leading-[1.6]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported CLIs */}
      <section className="py-[80px] border-b border-[#1F1F23]">
        <div className="max-w-[900px] mx-auto px-8">
          <h2
            style={{ fontFamily: MONO, fontSize: 'clamp(20px, 2.5vw, 28px)' }}
            className="font-semibold tracking-[-0.025em] text-[#E8E8EC] mb-8"
          >
            Works where you already work.
          </h2>
          <div className="flex flex-wrap gap-3 mb-6">
            {CLI_CHIPS.map((cli) => (
              <div
                key={cli}
                style={{ fontFamily: MONO }}
                className="text-[13px] text-[#8A8A96] bg-[#1A1A1E] border border-[#2A2A2E] rounded-[6px] px-4 py-2"
              >
                {cli}
              </div>
            ))}
          </div>
          <p style={{ fontFamily: MONO }} className="text-[13px] text-[#4A4A56]">
            Uses your existing CLI auth. <span className="text-[#E55A1C]">No API keys needed.</span>
          </p>
        </div>
      </section>

      {/* Three ways */}
      <section className="py-[80px] border-b border-[#1F1F23]">
        <div className="max-w-[900px] mx-auto px-8">
          <h2
            style={{ fontFamily: MONO, fontSize: 'clamp(20px, 2.5vw, 28px)' }}
            className="font-semibold tracking-[-0.025em] text-[#E8E8EC] mb-10"
          >
            Terminal. Agent. Team.
          </h2>
          <div className="flex flex-col">
            {WAYS.map((way, i) => (
              <div
                key={way.tag}
                className={`flex items-start gap-5 bg-[#1A1A1E] border border-[#2A2A2E] px-6 py-5 hover:bg-[#141416] transition-colors ${
                  i === 0 ? 'rounded-t-[6px]' : i === WAYS.length - 1 ? 'rounded-b-[6px] border-t-0' : 'border-t-0'
                }`}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    background: 'rgba(229,90,28,0.10)',
                    border: '1px solid rgba(229,90,28,0.2)',
                  }}
                  className="text-[11px] text-[#E55A1C] rounded px-2.5 py-0.5 whitespace-nowrap shrink-0 mt-0.5 tracking-[0.04em] uppercase"
                >
                  {way.tag}
                </span>
                <div>
                  <div style={{ fontFamily: MONO }} className="text-[14px] text-[#E8E8EC] font-medium mb-1">
                    {way.title}
                  </div>
                  <p className="text-[13px] text-[#8A8A96]">{way.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Install */}
      <section id="install" className="py-[80px] border-b border-[#1F1F23]">
        <div className="max-w-[900px] mx-auto px-8">
          <h2
            style={{ fontFamily: MONO, fontSize: 'clamp(20px, 2.5vw, 28px)' }}
            className="font-semibold tracking-[-0.025em] text-[#E8E8EC] mb-10"
          >
            Three lines to get started.
          </h2>
          <div className="bg-[#0D0D10] border border-[#2A2A2E] rounded-[12px] overflow-hidden">
            <div className="bg-[#1A1A1E] border-b border-[#2A2A2E] px-4 py-2.5 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
            </div>
            <div style={{ fontFamily: MONO }} className="px-8 py-7 text-[14px] leading-[2]">
              {TERMINAL_LINES.map((parts, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[#E55A1C] select-none">$</span>
                  <span>
                    {parts.map((p, j) => (
                      <span key={j} style={{ color: p.color }}>{p.text}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#1F1F23]">
        <div className="max-w-[900px] mx-auto px-8 flex items-center justify-between flex-wrap gap-4">
          <div style={{ fontFamily: MONO }} className="text-[13px] text-[#4A4A56]">
            <span className="text-[#E55A1C]">branch</span> ai
          </div>
          <ul className="flex gap-6 list-none">
            <li>
              <a
                href="https://github.com/nikolas-sapa/branch-ai"
                style={{ fontFamily: MONO }}
                className="text-[12px] text-[#4A4A56] hover:text-[#E8E8EC] transition-colors"
              >
                GitHub ↗
              </a>
            </li>
            <li>
              <span
                style={{ fontFamily: MONO, background: '#1A1A1E', border: '1px solid #2A2A2E' }}
                className="text-[11px] text-[#4A4A56] rounded px-2.5 py-0.5"
              >
                MIT
              </span>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
