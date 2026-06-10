// Lightweight semantic intent parser for the voice engine.
//
// Not raw string equality: each intent has a set of weighted concept terms and
// synonyms; the parser scores an utterance against every intent and returns the
// best match above a confidence floor, plus extracted targets. This handles
// paraphrases like "evaluate my local processing speed" or "how fast am I
// running right now" mapping to the same SHOW_SPEED intent.

export type IntentName =
  | "SHOW_SPEED"
  | "SHOW_RUNTIME"
  | "SHOW_FLEET"
  | "SHOW_CONSOLIDATION"
  | "DEPLOY_POST"
  | "CHECK_HEALTH"
  | "GREETING"
  | "UNKNOWN";

interface IntentSpec {
  name: IntentName;
  // term -> weight
  concepts: Record<string, number>;
  response: string;
}

const SPECS: IntentSpec[] = [
  {
    name: "SHOW_SPEED",
    concepts: {
      speed: 3, fast: 3, velocity: 3, throughput: 2, token: 2, latency: 2,
      processing: 1, performance: 1, quick: 1, rate: 1,
    },
    response: "Showing operational velocity metrics.",
  },
  {
    name: "SHOW_RUNTIME",
    concepts: {
      runtime: 3, infrastructure: 3, cpu: 2, memory: 2, gpu: 3, vram: 3,
      docker: 2, container: 2, hardware: 2, system: 1, telemetry: 2, thread: 1,
    },
    response: "Displaying runtime infrastructure status.",
  },
  {
    name: "SHOW_FLEET",
    concepts: {
      fleet: 3, device: 3, devices: 3, workstation: 2, node: 2, nodes: 2,
      client: 1, connected: 1, network: 1, cross: 1,
    },
    response: "Bringing up cross-device fleet status.",
  },
  {
    name: "SHOW_CONSOLIDATION",
    concepts: {
      consolidation: 3, metrics: 2, summary: 2, aggregate: 2, ingestion: 2,
      posting: 1, interval: 1, publish: 2, utilization: 1, overview: 2,
    },
    response: "Opening the metric consolidation overview.",
  },
  {
    name: "DEPLOY_POST",
    concepts: {
      deploy: 4, deployment: 4, ship: 2, publish: 2, release: 2, push: 2,
      post: 2, build: 1, production: 2, vercel: 2,
    },
    response: "Deploy Post requested. Confirm to proceed.",
  },
  {
    name: "CHECK_HEALTH",
    concepts: {
      health: 3, status: 2, online: 2, alive: 2, reachable: 2, backend: 2,
      check: 1, diagnostic: 2, ping: 2,
    },
    response: "Running backend health diagnostics.",
  },
  {
    name: "GREETING",
    concepts: { hello: 3, hey: 3, sahjony: 1, jarvis: 1, hi: 3, "you there": 2, online: 1 },
    response: "Online and listening, sir.",
  },
];

const STOP = new Set([
  "the", "a", "an", "my", "me", "i", "is", "are", "to", "of", "and", "on",
  "for", "please", "can", "you", "could", "would", "show", "tell", "give",
  "whats", "what", "how", "right", "now", "current", "currently", "do",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

export interface IntentResult {
  intent: IntentName;
  confidence: number; // 0..1
  response: string;
  raw: string;
}

export function parseIntent(utterance: string): IntentResult {
  const tokens = tokenize(utterance);
  const lower = utterance.toLowerCase();
  let best: IntentSpec | null = null;
  let bestScore = 0;
  let bestMax = 1;

  for (const spec of SPECS) {
    let score = 0;
    let maxPossible = 0;
    for (const [term, weight] of Object.entries(spec.concepts)) {
      maxPossible += weight;
      if (term.includes(" ")) {
        if (lower.includes(term)) score += weight;
      } else if (tokens.includes(term)) {
        score += weight;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = spec;
      bestMax = maxPossible;
    }
  }

  if (!best || bestScore === 0) {
    return {
      intent: "UNKNOWN",
      confidence: 0,
      response: "I didn't catch a clear command. Try 'evaluate my speed' or 'deploy post'.",
      raw: utterance,
    };
  }

  // Confidence: matched weight relative to a small saturating denominator so a
  // couple of strong concept hits already reads as confident.
  const confidence = Math.min(1, bestScore / Math.min(bestMax, 5));
  return {
    intent: best.name,
    confidence: Number(confidence.toFixed(2)),
    response: best.response,
    raw: utterance,
  };
}
