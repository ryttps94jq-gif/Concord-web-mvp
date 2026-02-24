"use client";

import { useState } from "react";

interface ArtifactInfo {
  type: string;
  filename: string;
  sizeBytes: number;
  multipart: boolean;
  parts?: { filename: string; type: string; sizeBytes: number }[];
  hasThumbnail?: boolean;
  hasPreview?: boolean;
}

interface ArtifactRendererProps {
  dtuId: string;
  artifact: ArtifactInfo;
  mode?: "inline" | "full" | "thumbnail" | "preview";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function DownloadButton({ url, filename, label }: { url: string; filename?: string; label?: string }) {
  return (
    <a
      href={url}
      download={filename}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
    >
      {label || "Download"}
    </a>
  );
}

function WaveformDisplay({ dtuId }: { dtuId: string }) {
  const [peaks, setPeaks] = useState<number[]>([]);

  // Fetch waveform data on mount
  useState(() => {
    fetch(`/api/artifact/${dtuId}/thumbnail`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPeaks(data); })
      .catch(() => {});
  });

  if (!peaks.length) return <div className="h-12 bg-zinc-900 rounded animate-pulse" />;

  return (
    <svg viewBox={`0 0 ${peaks.length} 100`} className="w-full h-12 text-emerald-500" preserveAspectRatio="none">
      {peaks.map((p, i) => (
        <rect key={i} x={i} y={50 - p * 50} width={1} height={Math.max(1, p * 100)} fill="currentColor" opacity={0.8} />
      ))}
    </svg>
  );
}

export function ArtifactRenderer({ dtuId, artifact, mode = "inline" }: ArtifactRendererProps) {
  const streamUrl = `/api/artifact/${dtuId}/stream`;
  const downloadUrl = `/api/artifact/${dtuId}/download`;
  const zipUrl = `/api/artifact/${dtuId}/zip`;

  // Audio
  if (artifact.type.startsWith("audio/")) {
    if (mode === "thumbnail") return <WaveformDisplay dtuId={dtuId} />;
    return (
      <div className="space-y-2">
        <WaveformDisplay dtuId={dtuId} />
        <audio controls preload="metadata" src={streamUrl} className="w-full" />
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{artifact.filename} — {formatSize(artifact.sizeBytes)}</span>
          <div className="flex gap-2">
            <DownloadButton url={downloadUrl} filename={artifact.filename} />
            <DownloadButton url={zipUrl} filename={`${artifact.filename}.zip`} label="ZIP" />
          </div>
        </div>
      </div>
    );
  }

  // Image
  if (artifact.type.startsWith("image/")) {
    if (mode === "thumbnail") {
      return <img src={streamUrl} className="w-full h-32 object-cover rounded" alt={artifact.filename} />;
    }
    return (
      <div className="space-y-2">
        <img src={streamUrl} alt={artifact.filename} className="w-full rounded-lg max-h-96 object-contain bg-zinc-900" />
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{artifact.filename} — {formatSize(artifact.sizeBytes)}</span>
          <DownloadButton url={downloadUrl} filename={artifact.filename} />
        </div>
      </div>
    );
  }

  // Video
  if (artifact.type.startsWith("video/")) {
    return (
      <div className="space-y-2">
        <video controls preload="metadata" src={streamUrl} className="w-full rounded-lg max-h-96" />
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{artifact.filename} — {formatSize(artifact.sizeBytes)}</span>
          <DownloadButton url={downloadUrl} filename={artifact.filename} />
        </div>
      </div>
    );
  }

  // PDF
  if (artifact.type.includes("pdf")) {
    return (
      <div className="space-y-2">
        <iframe src={streamUrl} className="w-full h-96 rounded-lg border border-zinc-700" />
        <DownloadButton url={downloadUrl} filename={artifact.filename} />
      </div>
    );
  }

  // Text/Code
  if (artifact.type.startsWith("text/") || artifact.type.includes("json") || artifact.type.includes("javascript")) {
    return <TextViewer dtuId={dtuId} filename={artifact.filename} sizeBytes={artifact.sizeBytes} downloadUrl={downloadUrl} />;
  }

  // Multipart
  if (artifact.multipart && artifact.parts) {
    return (
      <div className="space-y-2 p-3 rounded-lg bg-zinc-900 border border-zinc-700">
        <h4 className="text-sm font-medium text-zinc-200">Project: {artifact.parts.length} files</h4>
        <ul className="space-y-1">
          {artifact.parts.map((part, i) => (
            <li key={i} className="flex items-center justify-between text-xs text-zinc-400">
              <span>{part.filename}</span>
              <span>{formatSize(part.sizeBytes)}</span>
            </li>
          ))}
        </ul>
        <DownloadButton url={zipUrl} label="Download All (ZIP)" />
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-700">
      <span className="text-sm text-zinc-300">{artifact.filename} — {formatSize(artifact.sizeBytes)}</span>
      <DownloadButton url={downloadUrl} filename={artifact.filename} />
    </div>
  );
}

function TextViewer({ dtuId, filename, sizeBytes, downloadUrl }: { dtuId: string; filename: string; sizeBytes: number; downloadUrl: string }) {
  const [content, setContent] = useState<string | null>(null);

  useState(() => {
    fetch(`/api/artifact/${dtuId}/stream`)
      .then(r => r.text())
      .then(text => setContent(text.slice(0, 5000)))
      .catch(() => setContent("Error loading file"));
  });

  return (
    <div className="space-y-2">
      <pre className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 overflow-auto max-h-64 font-mono">
        {content || "Loading..."}
      </pre>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{filename} — {formatSize(sizeBytes)}</span>
        <DownloadButton url={downloadUrl} filename={filename} />
      </div>
    </div>
  );
}

export default ArtifactRenderer;
