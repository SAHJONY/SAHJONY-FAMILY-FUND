// Shared types for the JARVIS control plane.
// `source` marks whether a value is measured on this host or simulated for
// display. The UI always shows this so nothing is presented as real telemetry
// when it is not.

export type Source = "measured" | "simulated" | "unavailable";

export interface CpuInfo {
  model: string;
  cores: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  utilizationPct: number; // derived from load / cores
  source: Source;
}

export interface MemInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPct: number;
  source: Source;
}

export interface GpuInfo {
  vendor: string;
  model: string;
  // VRAM / compute utilization is only available for NVIDIA via nvidia-smi.
  // On this AMD/Mac host these are reported as unavailable, not faked.
  vramUsedMb: number | null;
  vramTotalMb: number | null;
  utilizationPct: number | null;
  source: Source;
  note?: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export interface DockerInfo {
  available: boolean;
  containers: DockerContainer[];
  note?: string;
}

export interface HostTelemetry {
  hostname: string;
  platform: string;
  arch: string;
  uptimeSec: number;
  cpu: CpuInfo;
  mem: MemInfo;
  gpu: GpuInfo;
  docker: DockerInfo;
  timestamp: number;
}

export type ServiceState = "online" | "degraded" | "offline" | "unknown";

export interface LlmBackendHealth {
  target: string;
  state: ServiceState;
  latencyMs: number | null;
  model?: string;
  detail: string;
}

export interface VelocityMetrics {
  inputTokensPerSec: number;
  outputTokensPerSec: number;
  firstTokenLatencyMs: number;
  activeTurns: number;
  queueDepth: number;
  source: Source;
}

export interface DeviceNode {
  id: string;
  label: string;
  os: string;
  state: ServiceState;
  lastSeen: number;
  enrolled: boolean;
}
