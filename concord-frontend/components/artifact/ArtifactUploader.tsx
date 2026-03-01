"use client";

import { useState, useCallback, useRef } from "react";

interface ArtifactUploaderProps {
  lens: string;
  onUploadComplete: (dtuId: string) => void;
  acceptTypes?: string;
  multi?: boolean;
  compact?: boolean;
}

export function ArtifactUploader({ lens, onUploadComplete, acceptTypes, multi = false, compact = false }: ArtifactUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      const fileArray = Array.from(files);

      if (multi && fileArray.length > 1) {
        for (const file of fileArray) formData.append("files", file);
        formData.append("domain", lens);
        formData.append("title", fileArray[0].name);

        const res = await fetch("/api/artifact/upload-multi", { method: "POST", body: formData });
        const data = await res.json();
        if (data.ok) onUploadComplete(data.dtuId);
        else setError(data.error || "Upload failed");
      } else {
        formData.append("file", fileArray[0]);
        formData.append("domain", lens);
        formData.append("title", fileArray[0].name);

        const res = await fetch("/api/artifact/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.ok) onUploadComplete(data.dtuId);
        else setError(data.error || "Upload failed");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [lens, multi, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={acceptTypes || "*/*"}
          multiple={multi}
          onChange={(e) => e.target.files?.length && handleUpload(e.target.files)}
          disabled={uploading}
          className="hidden"
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        dragOver ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700 hover:border-zinc-500"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptTypes || "*/*"}
        multiple={multi}
        onChange={(e) => e.target.files?.length && handleUpload(e.target.files)}
        disabled={uploading}
        className="hidden"
      />
      <div className="space-y-2">
        <p className="text-sm text-zinc-400">
          {uploading ? "Uploading..." : "Drop files here or"}
        </p>
        {!uploading && (
          <button
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 text-sm font-medium rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Browse Files
          </button>
        )}
        {uploading && (
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full animate-pulse w-2/3" />
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}

export default ArtifactUploader;
