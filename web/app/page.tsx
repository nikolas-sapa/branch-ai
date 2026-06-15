'use client';

import { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, Terminal, GitFork, GitCompare, ChevronRight } from 'lucide-react';

const MONO = 'var(--font-geist-mono), monospace';
const DISPLAY = 'var(--font-sora), sans-serif';

/* ── Palette ── Sky → Cyan on blue-tinted near-black. Unique to Branch. */
const A = '#38BDF8'; // sky
const A2 = '#22D3EE'; // cyan

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

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 78% 55% at 50% 0%, #000 25%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 78% 55% at 50% 0%, #000 25%, transparent 78%)',
        }}
      />
      <div
        className="absolute -top-44 left-1/4 h-[560px] w-[760px] rounded-full blur-[150px] opacity-50"
        style={{ background: `radial-gradient(ellipse, ${A}33, ${A2}1a 45%, transparent 70%)` }}
      />
    </div>
  );
}

function BlurIn({ text, className, accentFrom }: { text: string; className?: string; accentFrom?: number }) {
  const words = text.split(' ');
  return (
    <h1 className={className} style={{ fontFamily: DISPLAY }}>
      {words.map((w, i) => {
        const accent = accentFrom !== undefined && i >= accentFrom;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, filter: 'blur(8px)', y: 12 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="mr-[0.26em] inline-block"
            style={accent ? { background: `linear-gradient(135deg, ${A}, ${A2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : undefined}
          >
            {w}
          </motion.span>
        );
      })}
    </h1>
  );
}

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-70px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

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
      style={{ fontFamily: MONO, color: copied ? A : undefined }}
      className="border border-white/10 rounded px-2 py-1 text-[11px] cursor-pointer transition-all tracking-[0.04em] text-white/45 hover:text-white hover:border-white/25 flex items-center gap-1.5"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

const FEATURES = [
  { num: '01', name: 'Navigate', icon: Terminal, desc: 'Every reasoning step is a node. Click any point in the tree to inspect, copy, or continue from there.' },
  { num: '02', name: 'Fork', icon: GitFork, desc: 'Branch from any node. Inject a new fact mid-thought. See how the conclusion changes without starting over.' },
  { num: '03', name: 'Compare', icon: GitCompare, desc: 'Diff two runs side by side. Same prompt, different assumptions — what changed?' },
];

const CLI_CHIPS = ['Claude Code', 'OpenAI Codex', 'Google Gemini CLI', 'Factory.ai Droid'];

const WAYS = [
  { tag: 'CLI', title: "branch 'prompt'", desc: 'Captures the full reasoning tree in your terminal. Navigate it without leaving your workflow.' },
  { tag: 'MCP', title: 'MCP server', desc: 'Claude Code agents externalize their own reasoning. Branch intercepts and stores every step automatically.' },
  { tag: 'Web', title: 'Web viewer', desc: 'Share trees with your team. Public or private. Persistent links, no setup required.' },
];

const TERMINAL_LINES = [
  [{ text: 'npm', color: A }, { text: ' install -g branch-ai', color: '#9FB4C2' }],
  [{ text: 'branch', color: A }, { text: ' "explain why this query is slow"', color: '#9FB4C2' }],
  [{ text: 'branch', color: A }, { text: ' doctor', color: '#9FB4C2' }, { text: '  # check which CLIs are available', color: '#4A5560' }],
];

export default function BranchAILanding() {
  return (
    <div className="relative min-h-screen bg-[#0A0F14] text-[#E6EDF3] antialiased selection:bg-[#38BDF8]/30 selection:text-white">
      <Backdrop />

      {/* Nav */}
      <nav className="sticky top-0 z-[100] border-b border-white/[0.06] px-8 py-4 flex items-center justify-between bg-[#0A0F14]/70 backdrop-blur-xl">
        <div style={{ fontFamily: MONO }} className="text-[14px] font-semibold tracking-[-0.02em]">
          <span style={{ background: `linear-gradient(135deg, ${A}, ${A2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>branch</span> ai
        </div>
        <ul className="flex gap-7 list-none">
          {([['#problem', 'problem'], ['#features', 'features'], ['#install', 'install'], ['https://github.com/nikolas-sapa/branch-ai', 'github ↗']] as const).map(
            ([href, label]) => (
              <li key={href}>
                <a href={href} style={{ fontFamily: MONO }} className="text-[12px] text-white/45 hover:text-white transition-colors tracking-[0.03em]">{label}</a>
              </li>
            )
          )}
        </ul>
      </nav>

      {/* Hero */}
      <section className="py-[104px] max-w-[920px] mx-auto px-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.04] pl-3 pr-2 py-1 text-[11px] font-mono tracking-[0.12em] uppercase text-white/55 mb-7" style={{ fontFamily: MONO }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: A }} />
          reasoning trees for AI agents
          <ChevronRight size={13} className="text-white/30" />
        </motion.div>

        <BlurIn
          text="AI reasoning that vanishes the moment you see the answer."
          className="font-bold leading-[1.05] tracking-[-0.03em] text-[#F4F8FB] mb-6 max-w-[780px]"
          accentFrom={3}
        />
        <p className="text-[18px] text-white/50 leading-[1.7] max-w-[560px] mb-10">
          Branch captures every step. Navigate the tree. Fork from any node.
          Diff two runs. Finally understand <em className="not-italic font-medium" style={{ color: A2 }}>why</em> the answer changed.
        </p>

        <div className="flex items-center gap-5 flex-wrap mb-16">
          <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-[8px] px-4 py-3 transition-colors hover:border-[#38BDF8]/40">
            <code style={{ fontFamily: MONO }} className="text-[14px] text-[#E6EDF3] tracking-[-0.01em]">npm install -g branch-ai</code>
            <CopyBtn text="npm install -g branch-ai" />
          </div>
        </div>

        {/* Reasoning tree */}
        <motion.div {...reveal}>
          <div className="relative bg-white/[0.02] border border-white/[0.08] rounded-[14px] px-8 py-7 max-w-[600px] overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, ${A} 0%, transparent 60%)` }} />
            <div style={{ fontFamily: MONO }} className="text-[11px] text-white/30 tracking-[0.08em] uppercase mb-4">// reasoning tree · live</div>
            <pre style={{ fontFamily: MONO, whiteSpace: 'pre', margin: 0 }} className="text-[13px] leading-[1.9] text-white/45">
              <span className="text-[#E6EDF3] font-medium">{'┌─ [root] How should I architect this?'}</span>{'\n'}
              <span className="text-white/25">{'│'}</span>{'\n'}
              <span className="text-white/25">{'│  ├─ '}</span>{'Option A: monolith'}{'\n'}
              <span className="text-white/25">{'│  │'}</span>{'\n'}
              <span className="text-white/25">{'│  │   └─ '}</span><span className="font-medium" style={{ color: A }}>{'[fork]'}</span>{' What if the team scales?'}{'\n'}
              <span className="text-white/25">{'│  │         ├─ '}</span>{'introduce service boundaries early'}{'\n'}
              <span className="text-white/25">{'│  │         └─ '}</span>{'refactor later (tech debt)'}{'\n'}
              <span className="text-white/25">{'│  │'}</span>{'\n'}
              <span className="text-white/25">{'│  └─ '}</span>{'Option B: services '}<span style={{ color: A2 }}>{'← you are here'}</span>{'\n'}
              <span className="text-white/25">{'│        ├─ '}</span>{'define contracts first'}{'\n'}
              <span className="text-white/25">{'│        └─ '}</span>{'deploy independently'}
            </pre>
          </div>
        </motion.div>
      </section>

      {/* Problem */}
      <section id="problem" className="py-[80px] border-y border-white/[0.06]">
        <motion.div {...reveal} className="max-w-[920px] mx-auto px-8">
          <h2 style={{ fontFamily: DISPLAY, fontSize: 'clamp(24px, 3.5vw, 36px)' }} className="font-bold leading-[1.15] tracking-[-0.03em] text-[#F4F8FB] mb-5">
            Reasoning that vanishes<br />the moment you see the answer.
          </h2>
          <p className="text-[18px] text-white/50 leading-[1.7] max-w-[620px] border-l-2 pl-6" style={{ borderColor: `${A}66` }}>
            When an AI works through a hard problem, the reasoning disappears the moment you read the output.
            You got a wall of text you can&apos;t trace.{' '}
            <strong className="text-[#E6EDF3] font-medium">If the answer is wrong, you start over. If it&apos;s right, you don&apos;t know why.</strong>
          </p>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-[80px] border-b border-white/[0.06]">
        <div className="max-w-[920px] mx-auto px-8">
          <motion.h2 {...reveal} style={{ fontFamily: DISPLAY, fontSize: 'clamp(24px, 3.5vw, 36px)' }} className="font-bold leading-[1.15] tracking-[-0.03em] text-[#F4F8FB] mb-12">
            Every step. Inspectable.<br />Forkable. Comparable.
          </motion.h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div key={f.num} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }}>
                  <div className="group relative h-full bg-white/[0.02] border border-white/[0.08] rounded-[14px] p-7 transition-all hover:-translate-y-1 overflow-hidden" style={{ ['--a' as string]: A }}>
                    <div className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, transparent, ${A}, transparent)` }} />
                    <span className="grid place-items-center w-9 h-9 rounded-lg border border-white/[0.08] mb-4" style={{ background: `${A}1a`, color: A }}>
                      <Icon size={16} />
                    </span>
                    <div style={{ fontFamily: MONO }} className="text-[11px] text-white/30 tracking-[0.08em] mb-1.5">{f.num}</div>
                    <div style={{ fontFamily: DISPLAY, color: A }} className="text-[19px] font-semibold mb-2.5 tracking-[-0.02em]">{f.name}</div>
                    <p className="text-[14px] text-white/45 leading-[1.6]">{f.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Supported CLIs */}
      <section className="py-[80px] border-b border-white/[0.06]">
        <motion.div {...reveal} className="max-w-[920px] mx-auto px-8">
          <h2 style={{ fontFamily: DISPLAY, fontSize: 'clamp(22px, 2.8vw, 30px)' }} className="font-bold tracking-[-0.03em] text-[#F4F8FB] mb-8">Works where you already work.</h2>
          <div className="flex flex-wrap gap-3 mb-6">
            {CLI_CHIPS.map((cli) => (
              <div key={cli} style={{ fontFamily: MONO }} className="text-[13px] text-white/55 bg-white/[0.03] border border-white/10 rounded-[8px] px-4 py-2 hover:border-[#38BDF8]/40 hover:text-white transition-colors">{cli}</div>
            ))}
          </div>
          <p style={{ fontFamily: MONO }} className="text-[13px] text-white/30">
            Uses your existing CLI auth. <span style={{ color: A }}>No API keys needed.</span>
          </p>
        </motion.div>
      </section>

      {/* Three ways */}
      <section className="py-[80px] border-b border-white/[0.06]">
        <div className="max-w-[920px] mx-auto px-8">
          <motion.h2 {...reveal} style={{ fontFamily: DISPLAY, fontSize: 'clamp(22px, 2.8vw, 30px)' }} className="font-bold tracking-[-0.03em] text-[#F4F8FB] mb-10">Terminal. Agent. Team.</motion.h2>
          <div className="flex flex-col">
            {WAYS.map((way, i) => (
              <motion.div key={way.tag} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }}>
                <div className={`flex items-start gap-5 bg-white/[0.02] border border-white/[0.08] px-6 py-5 hover:bg-white/[0.04] transition-colors ${i === 0 ? 'rounded-t-[8px]' : i === WAYS.length - 1 ? 'rounded-b-[8px] border-t-0' : 'border-t-0'}`}>
                  <span style={{ fontFamily: MONO, background: `${A}1a`, border: `1px solid ${A}33`, color: A }} className="text-[11px] rounded px-2.5 py-0.5 whitespace-nowrap shrink-0 mt-0.5 tracking-[0.04em] uppercase">{way.tag}</span>
                  <div>
                    <div style={{ fontFamily: MONO }} className="text-[14px] text-[#E6EDF3] font-medium mb-1">{way.title}</div>
                    <p className="text-[13px] text-white/45">{way.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Install */}
      <section id="install" className="py-[80px] border-b border-white/[0.06]">
        <div className="max-w-[920px] mx-auto px-8">
          <motion.h2 {...reveal} style={{ fontFamily: DISPLAY, fontSize: 'clamp(22px, 2.8vw, 30px)' }} className="font-bold tracking-[-0.03em] text-[#F4F8FB] mb-10">Three lines to get started.</motion.h2>
          <motion.div {...reveal}>
            <div className="bg-[#070B0F] border border-white/[0.08] rounded-[14px] overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
              <div className="bg-white/[0.03] border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
              </div>
              <div style={{ fontFamily: MONO }} className="px-8 py-7 text-[14px] leading-[2]">
                {TERMINAL_LINES.map((parts, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="select-none" style={{ color: A }}>$</span>
                    <span>{parts.map((p, j) => (<span key={j} style={{ color: p.color }}>{p.text}</span>))}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/[0.06]">
        <div className="max-w-[920px] mx-auto px-8 flex items-center justify-between flex-wrap gap-4">
          <div style={{ fontFamily: MONO }} className="text-[13px] text-white/30">
            <span style={{ color: A }}>branch</span> ai
          </div>
          <ul className="flex gap-6 list-none">
            <li><a href="https://github.com/nikolas-sapa/branch-ai" style={{ fontFamily: MONO }} className="text-[12px] text-white/30 hover:text-white transition-colors">GitHub ↗</a></li>
            <li><span style={{ fontFamily: MONO }} className="text-[11px] text-white/30 rounded px-2.5 py-0.5 bg-white/[0.03] border border-white/10">MIT</span></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
