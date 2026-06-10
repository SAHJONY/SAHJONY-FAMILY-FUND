import { NextResponse } from "next/server";
import os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type {
  HostTelemetry,
  DockerInfo,
  GpuInfo,
  DockerContainer,
} from "@/lib/types";

const run = promisify(exec);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function safe(cmd: string, timeoutMs = 2500): Promise<string | null> {
  try {
    const { stdout } = await run(cmd, { timeout: timeoutMs });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function getGpu(): Promise<GpuInfo> {
  // NVIDIA path: real VRAM + utilization via nvidia-smi.
  const smi = await safe(
    "nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits"
  );
  if (smi) {
    const [name, used, total, util] = smi.split(",").map((s) => s.trim());
    return {
      vendor: "NVIDIA",
      model: name,
      vramUsedMb: Number(used),
      vramTotalMb: Number(total),
      utilizationPct: Number(util),
      source: "measured",
    };
  }

  // macOS fallback: identify the GPU, but VRAM/compute telemetry is not
  // exposed the way nvidia-smi exposes it, so report it as unavailable.
  if (os.platform() === "darwin") {
    const disp = await safe(
      "system_profiler SPDisplaysDataType 2>/dev/null | grep -i 'Chipset Model' | head -1"
    );
    const model = disp ? disp.split(":").slice(1).join(":").trim() : "Unknown GPU";
    return {
      vendor: model.toLowerCase().includes("amd") ? "AMD" : "Apple/Other",
      model,
      vramUsedMb: null,
      vramTotalMb: null,
      utilizationPct: null,
      source: "unavailable",
      note: "Live VRAM/compute metrics require an NVIDIA GPU + nvidia-smi. Not available on this host.",
    };
  }

  return {
    vendor: "Unknown",
    model: "No GPU detected",
    vramUsedMb: null,
    vramTotalMb: null,
    utilizationPct: null,
    source: "unavailable",
  };
}

async function getDocker(): Promise<DockerInfo> {
  const out = await safe(
    'docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}" 2>/dev/null'
  );
  if (out === null) {
    return {
      available: false,
      containers: [],
      note: "Docker CLI not reachable (daemon stopped or not installed).",
    };
  }
  const containers: DockerContainer[] = out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [id, name, image, state, status] = line.split("|");
      return { id, name, image, state, status };
    });
  return { available: true, containers };
}

export async function GET() {
  const cpus = os.cpus();
  const [la1, la5, la15] = os.loadavg();
  const cores = cpus.length || 1;
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const [gpu, docker] = await Promise.all([getGpu(), getDocker()]);

  const payload: HostTelemetry = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptimeSec: os.uptime(),
    cpu: {
      model: cpus[0]?.model?.trim() ?? "Unknown CPU",
      cores,
      loadAvg1: la1,
      loadAvg5: la5,
      loadAvg15: la15,
      utilizationPct: Math.min(100, Math.round((la1 / cores) * 100)),
      source: "measured",
    },
    mem: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: usedMem,
      usedPct: Math.round((usedMem / totalMem) * 100),
      source: "measured",
    },
    gpu,
    docker,
    timestamp: Date.now(),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
