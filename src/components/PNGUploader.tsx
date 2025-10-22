import React, { useState, useEffect } from 'react';
import { createWorker } from 'tesseract.js';

type Props = {
  uploadUrl?: string; // POST endpoint to receive the file
  maxSizeMB?: number; // max allowed file size in MB
  onSuccess?: (response: any) => void;
  onError?: (error: any) => void;
};

const PNGUploader: React.FC<Props> = ({
  uploadUrl = '/api/upload',
  maxSizeMB = 5,
  onSuccess,
  onError,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  // New: context state (Shiny | Alpha)
  const [context, setContext] = useState<'Shiny' | 'Alpha'>('Shiny');

  // New: OCR result state
  const [ocrText, setOcrText] = useState<string | null>(null);


  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const validateFile = (f: File) => {
    if (f.type !== 'image/png' && !f.name.toLowerCase().endsWith('.png')) {
      return 'Only PNG files are allowed.';
    }
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (f.size > maxBytes) {
      return `File is too large. Max ${maxSizeMB}MB allowed.`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!file) {
      setError('Please select a PNG file first.');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
        // Use Tesseract.js OCR and include the selected context in the result
        (async () => {
            const worker = await createWorker('eng');
            setProgress(50);
            const { data } = await worker.recognize(file);
            const text = data?.text ?? '';
            // include context with OCR output
            console.log('OCR text:', text);
            setOcrText(text);
            console.log('Submission context:', context);
            onSuccess?.({ text, context });
            await worker.terminate();
            setProgress(100);
        })();
    } catch (err: any) {
      setError(err?.message ?? 'Read error');
      onError?.(err);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(null), 800);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload PNG</span>
        <input
          type="file"
          accept="image/png"
          onChange={handleFileChange}
          className="mt-2"
          aria-label="Choose a PNG file"
        />
      </label>

      {/* New: context dropdown */}
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">Submission Type</span>
        <select
          value={context}
          onChange={(e) => setContext(e.target.value as 'Shiny' | 'Alpha')}
          className="mt-1 p-2 border rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          aria-label="Select submission context"
        >
          <option value="Shiny">Shiny</option>
          <option value="Alpha">Alpha</option>
        </select>
      </label>

      {error && (
        <div role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-2">
          <span className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Preview:</span>
          <img src={preview} alt="Preview" className="max-w-xs max-h-48 rounded border" />
        </div>
      )}

      {progress !== null && (
        <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
          <div
            className="bg-primary-500 h-2"
            style={{ width: `${progress}%`, transition: 'width 150ms linear' }}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={uploading || !file}
          className="px-3 py-1 bg-primary-600 text-white rounded disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload PNG'}
        </button>

        <button
          type="button"
          onClick={() => {
            setFile(null);
            setError(null);
            setProgress(null);
          }}
          className="px-3 py-1 border rounded"
        >
          Clear
        </button>
      </div>

      {ocrText !== null && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 border rounded">
          <h3 className="font-semibold text-sm mb-2 text-gray-900 dark:text-white">OCR Result</h3>
          <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{ocrText}</pre>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Context: {context}</p>
        </div>
      )}
    </form>
  );
};

export default PNGUploader;