import { useState } from "react";
import { executeQueryRequest } from "../api/query.api";

const ACCESS_PASSWORD = "Baccano1829";

function QueryPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === ACCESS_PASSWORD) {
      setAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleRunQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setColumns([]);
    setRowCount(0);

    try {
      const response = await executeQueryRequest(query);
      const { rows, rowCount: count } = response.data;
      setResults(rows);
      setRowCount(count);
      if (rows.length > 0) {
        setColumns(Object.keys(rows[0]));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      handleRunQuery();
    }
  };

  const renderCellValue = (value) => {
    if (value === null || value === undefined) {
      return <span className="italic text-gray-400">NULL</span>;
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Password gate
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <form onSubmit={handlePasswordSubmit} className="bg-white rounded-lg shadow-md p-8 w-full max-w-sm">
          <h2 className="text-xl font-bold text-center mb-6 text-stone-700">Acceso Consultas SQL</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(false); }}
            placeholder="Contraseña"
            className={`w-full border rounded-md px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500 ${passwordError ? "border-red-500" : "border-gray-300"}`}
            autoFocus
          />
          {passwordError && (
            <p className="text-red-500 text-sm mb-3">Contraseña incorrecta</p>
          )}
          <button
            type="submit"
            className="w-full bg-purple-700 text-white rounded-md px-4 py-2 hover:bg-purple-800"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-center text-stone-700 mb-4">Consultas SQL</h1>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe tu consulta SELECT aquí..."
        className="w-full h-40 p-3 border border-gray-300 rounded-md font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-500"
        spellCheck={false}
      />

      <div className="flex items-center gap-3 mt-2 mb-4">
        <button
          type="button"
          onClick={handleRunQuery}
          disabled={loading || !query.trim()}
          className="bg-purple-700 text-white rounded-md px-5 py-2 hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Ejecutando..." : "Ejecutar"}
        </button>
        <span className="text-xs text-gray-400">Ctrl+Enter para ejecutar</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-md p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {results && (
        <div className="mb-2 text-sm text-gray-600">
          {rowCount} resultado{rowCount !== 1 ? "s" : ""} encontrado{rowCount !== 1 ? "s" : ""}
        </div>
      )}

      {results && results.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          La consulta no retorno resultados.
        </div>
      )}

      {results && results.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-gray-300">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col} className="bg-stone-700 text-white px-3 py-2 text-left border border-stone-600 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 border border-gray-200 whitespace-nowrap">
                      {renderCellValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default QueryPage;
