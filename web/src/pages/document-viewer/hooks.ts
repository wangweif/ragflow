import { Authorization } from '@/constants/authorization';
import { getAuthorization } from '@/utils/authorization-util';
import jsPreviewExcel from '@js-preview/excel';
import axios from 'axios';
import mammoth from 'mammoth';
import { useCallback, useEffect, useRef, useState } from 'react';

export const useCatchError = (api: string) => {
  const [error, setError] = useState('');
  const fetchDocument = useCallback(async () => {
    const ret = await axios.get(api);
    const { data } = ret;
    if (!(data instanceof ArrayBuffer) && data.code !== 0) {
      setError(data.message);
    }
    return ret;
  }, [api]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  return { fetchDocument, error };
};

export const useFetchDocument = () => {
  const fetchDocument = useCallback(async (api: string) => {
    const ret = await axios.get(api, {
      headers: {
        [Authorization]: getAuthorization(),
      },
      responseType: 'arraybuffer',
    });
    return ret;
  }, []);

  return { fetchDocument };
};

export const useFetchExcel = (filePath: string) => {
  const [status, setStatus] = useState(true);
  const { fetchDocument } = useFetchDocument();
  const containerRef = useRef<HTMLDivElement>(null);
  const { error } = useCatchError(filePath);

  const fetchDocumentAsync = useCallback(async () => {
    let myExcelPreviewer;
    if (containerRef.current) {
      myExcelPreviewer = jsPreviewExcel.init(containerRef.current);
    }
    const jsonFile = await fetchDocument(filePath);
    myExcelPreviewer
      ?.preview(jsonFile.data)
      .then(() => {
        console.log('succeed');
        setStatus(true);
      })
      .catch((e) => {
        console.warn('failed', e);
        myExcelPreviewer.destroy();
        setStatus(false);
      });
  }, [filePath, fetchDocument]);

  useEffect(() => {
    fetchDocumentAsync();
  }, [fetchDocumentAsync]);

  return { status, containerRef, error };
};

export const useFetchDocx = (filePath: string) => {
  const [succeed, setSucceed] = useState(true);
  const [error, setError] = useState<string>();
  const { fetchDocument } = useFetchDocument();
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchDocumentAsync = useCallback(async () => {
    try {
      const jsonFile = await fetchDocument(filePath);
      mammoth
        .convertToHtml(
          { arrayBuffer: jsonFile.data },
          { includeDefaultStyleMap: true },
        )
        .then((result) => {
          setSucceed(true);
          const docEl = document.createElement('div');
          docEl.className = 'document-container';
          docEl.innerHTML = result.value;
          const container = containerRef.current;
          if (container) {
            container.innerHTML = docEl.outerHTML;
          }
        })
        .catch(() => {
          setSucceed(false);
        });
    } catch (error: any) {
      setError(error.toString());
    }
  }, [filePath, fetchDocument]);

  useEffect(() => {
    fetchDocumentAsync();
  }, [fetchDocumentAsync]);

  return { succeed, containerRef, error };
};

export const useFetchCsv = (filePath: string) => {
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const { fetchDocument } = useFetchDocument();

  const fetchCsvAsync = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchDocument(filePath);

      // Convert ArrayBuffer to string
      const decoder = new TextDecoder('utf-8');
      const csvText = decoder.decode(response.data);

      // Parse CSV data
      const lines = csvText.split('\n').filter((line) => line.trim());
      const parsedData = lines.map((line) => {
        // Simple CSV parsing - handles basic cases
        const cells = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if ((char === ',' || char === '\t') && !inQuotes) {
            cells.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        cells.push(current.trim());

        return cells;
      });

      setCsvData(parsedData);
      setError(undefined);
    } catch (err: any) {
      setError(err.toString());
      setCsvData([]);
    } finally {
      setLoading(false);
    }
  }, [filePath, fetchDocument]);

  useEffect(() => {
    fetchCsvAsync();
  }, [fetchCsvAsync]);

  return { csvData, loading, error };
};
