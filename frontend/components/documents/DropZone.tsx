"use client";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, CheckCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  caseId: string;
  onUploaded: (doc: any) => void;
}

export default function DropZone({ caseId, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      for (const file of accepted) {
        setUploading(true);
        try {
          const doc = await api.uploadDocument(caseId, file);
          onUploaded(doc);
          toast.success(`${file.name} uploaded and processed`);
        } catch (err: any) {
          toast.error(`${file.name}: ${err.message}`);
        } finally {
          setUploading(false);
        }
      }
    },
    [caseId, onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    maxSize: 50 * 1024 * 1024,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
        isDragActive ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-brand-300 bg-gray-50 hover:bg-brand-50"
      } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <Loader2 className="w-8 h-8 text-brand-500 mx-auto mb-3 animate-spin" />
      ) : (
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
      )}
      <p className="text-sm font-medium text-gray-600">
        {uploading ? "Uploading and extracting text…" : isDragActive ? "Drop files here" : "Drag & drop files or click to browse"}
      </p>
      <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 50 MB</p>
    </div>
  );
}
