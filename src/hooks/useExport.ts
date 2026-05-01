import { useCallback, useRef } from 'react';
import { useProjectStore } from '../store/project';

export function useExport() {
  const { project } = useProjectStore();
  const workerRef = useRef<Worker | null>(null);

  const exportLottie = useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      const worker = new Worker(new URL('../workers/composer.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'success') {
          resolve(JSON.stringify(e.data.result, null, 2));
        } else {
          reject(new Error(e.data.message));
        }
        worker.terminate();
      };

      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };

      worker.postMessage({ project, format: 'lottie' });
    });
  }, [project]);

  const exportCss = useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      const worker = new Worker(new URL('../workers/composer.worker.ts', import.meta.url), { type: 'module' });

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'success') {
          resolve(e.data.result as string);
        } else {
          reject(new Error(e.data.message));
        }
        worker.terminate();
      };

      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };

      worker.postMessage({ project, format: 'css' });
    });
  }, [project]);

  const downloadFile = useCallback((content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadLottie = useCallback(async () => {
    const json = await exportLottie();
    downloadFile(json, `${project.name}.json`, 'application/json');
  }, [exportLottie, downloadFile, project.name]);

  const downloadCss = useCallback(async () => {
    const css = await exportCss();
    downloadFile(css, `${project.name}.css`, 'text/css');
  }, [exportCss, downloadFile, project.name]);

  const downloadMotifJson = useCallback(() => {
    const json = JSON.stringify(project, null, 2);
    downloadFile(json, `${project.name}.motif.json`, 'application/json');
  }, [project, downloadFile]);

  return { downloadLottie, downloadCss, downloadMotifJson, exportLottie };
}
