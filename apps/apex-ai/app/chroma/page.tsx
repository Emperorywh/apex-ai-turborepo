"use client";

import { useState, useEffect } from "react";

interface Collection {
  name: string;
  id: string;
  metadata: Record<string, any> | null;
}

interface CollectionDetails extends Collection {
  count: number;
  peek: {
    ids: string[];
    embeddings: number[][] | null;
    documents: (string | null)[];
    metadatas: (Record<string, any> | null)[];
  };
}

interface QueryResult {
  ids: string[];
  embeddings: number[][] | null;
  documents: (string | null)[];
  metadatas: (Record<string, any> | null)[];
}

export default function ChromaViewer() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null
  );
  const [details, setDetails] = useState<CollectionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination / Query state
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [queryData, setQueryData] = useState<QueryResult | null>(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      fetchCollectionDetails(selectedCollection);
    }
  }, [selectedCollection]);

  useEffect(() => {
    if (selectedCollection) {
        // Fetch data with pagination when offset/limit changes
        fetchData(selectedCollection, offset, limit);
    }
  }, [selectedCollection, offset, limit]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/chroma/collections");
      if (!res.ok) throw new Error("Failed to fetch collections");
      const data = await res.json();
      console.log("Fetched collections:", data);
      setCollections(data);
      if (data.length > 0 && !selectedCollection) {
        setSelectedCollection(data[0].name);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectionDetails = async (name: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/chroma/collection/${name}`);
      if (!res.ok) throw new Error("Failed to fetch collection details");
      const data = await res.json();
      console.log("Fetched details:", data);
      setDetails(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (name: string, offsetVal: number, limitVal: number) => {
      try {
          const res = await fetch(`/api/chroma/collection/${name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ offset: offsetVal, limit: limitVal })
          });
          if (!res.ok) throw new Error("Failed to fetch data");
          const data = await res.json();
          console.log("Fetched query data:", data);
          setQueryData(data);
      } catch (err: any) {
          console.error(err);
          setError(err.message);
      }
  }

  const handleNextPage = () => {
      if (details && offset + limit < details.count) {
          setOffset(offset + limit);
      }
  };

  const handlePrevPage = () => {
      if (offset - limit >= 0) {
          setOffset(offset - limit);
      }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h1 className="text-xl font-bold">ChromaDB Viewer</h1>
          <button onClick={fetchCollections} className="text-gray-400 hover:text-white" title="Refresh Collections">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {collections.length === 0 && !loading && (
             <div className="p-4 text-gray-500 text-sm text-center">No collections found. Check console for errors.</div>
          )}
          {collections.map((col) => (
            <button
              key={col.name}
              onClick={() => {
                  setSelectedCollection(col.name);
                  setOffset(0);
              }}
              className={`w-full text-left px-4 py-3 rounded-md mb-1 transition-colors ${
                selectedCollection === col.name
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-700 text-gray-300"
              }`}
            >
              <div className="font-medium truncate">{col.name}</div>
              <div className="text-xs text-gray-400 truncate">ID: {col.id}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {loading && !details && (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        )}

        {error && (
            <div className="p-4 bg-red-900/50 text-red-200 border-b border-red-800 flex justify-between">
                <span>Error: {error}</span>
                <button onClick={() => setError(null)} className="text-red-200 hover:text-white">&times;</button>
            </div>
        )}

        {details && (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-700 bg-gray-800/50">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{details.name}</h2>
                  <div className="flex gap-4 text-sm text-gray-400">
                    <div>Count: <span className="text-white font-mono">{details.count}</span></div>
                    <div>ID: <span className="text-white font-mono">{details.id}</span></div>
                  </div>
                </div>
                {details.metadata && (
                    <div className="bg-gray-900 p-3 rounded text-xs font-mono text-gray-300 max-w-md overflow-auto">
                        <pre>{JSON.stringify(details.metadata, null, 2)}</pre>
                    </div>
                )}
              </div>
            </div>

            {/* Data Table */}
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3 w-24">#</th>
                                <th className="px-6 py-3 w-48">ID</th>
                                <th className="px-6 py-3">Document</th>
                                <th className="px-6 py-3 w-64">Metadata</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {queryData && queryData.ids && queryData.ids.length > 0 ? (
                                queryData.ids.map((id, idx) => (
                                    <tr key={id} className="hover:bg-gray-750">
                                        <td className="px-6 py-4 text-gray-500 font-mono">
                                            {offset + idx + 1}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-blue-300 truncate max-w-xs" title={id}>
                                            {id}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="max-h-32 overflow-y-auto bg-gray-900/50 p-2 rounded border border-gray-700/50">
                                                <p className="whitespace-pre-wrap text-gray-300">
                                                    {queryData.documents[idx] || <span className="text-gray-600 italic">null</span>}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {queryData.metadatas[idx] ? (
                                                <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto text-green-300 max-w-xs">
                                                    {JSON.stringify(queryData.metadatas[idx], null, 2)}
                                                </pre>
                                            ) : (
                                                <span className="text-gray-600 italic">null</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                        No documents found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer / Pagination */}
            <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
                <div className="text-sm text-gray-400">
                    Showing {offset + 1} to {Math.min(offset + limit, details.count)} of {details.count}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handlePrevPage}
                        disabled={offset === 0}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm transition-colors"
                    >
                        Previous
                    </button>
                    <button
                        onClick={handleNextPage}
                        disabled={offset + limit >= details.count}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
