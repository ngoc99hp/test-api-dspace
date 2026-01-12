"use client";
import { useState } from "react";

/* ===== Helpers ===== */
function detectFormat(text = "") {
  const t = text.trim();
  if (t.startsWith("<")) return "xml";
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  return "text";
}

function formatXML(xml) {
  let formatted = "";
  const reg = /(>)(<)(\/*)/g;
  xml = xml.replace(reg, "$1\n$2$3");
  let pad = 0;
  xml.split("\n").forEach((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) indent = 0;
    else if (node.match(/^<\/\w/)) pad--;
    else if (node.match(/^<\w([^>]*[^/])?>/)) indent = 1;
    formatted += " ".repeat(Math.max(pad, 0)) + node + "\n";
    pad += indent;
  });
  return formatted.trim();
}

export default function Page() {
  // ===== LOGIN =====
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // ===== SESSION =====
  const [session, setSession] = useState(null);
  // ===== ITEM METADATA =====
  const [title, setTitle] = useState("Cơ sở văn hóa Việt Nam-Giáo dục-2001");
  const [author, setAuthor] = useState("Nguyễn Văn A");
  const [year, setYear] = useState("2024");
  const [abstract, setAbstract] = useState(
    "Cơ sở văn hóa Việt Nam-Giáo dục-2001_pdfa"
  );
  // ===== STATE =====
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // ===== CHECK SESSION (CỰC KỲ QUAN TRỌNG) =====
  const checkSession = async () => {
    const res = await fetch("/api/session", {
      credentials: "include",
    });
    const data = await res.json();
    console.log("SESSION:", data);
    setSession(data);
    return data;
  };

  // ===== LOGIN =====
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err);
        return;
      }
      // 👉 KHÔNG dùng response login
      await checkSession();
    } catch (err) {
      setError({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ===== CREATE ITEM =====
  const handleCreateItem = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          metadata: [
            { key: "dc.title", value: title },
            { key: "dc.contributor.author", value: author },
            { key: "dc.date.issued", value: year },
            { key: "dc.description.abstract", value: abstract },
            { key: "dc.language.iso", value: "vi" },
            { key: "dc.type", value: "Text" },
          ],
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  /* ===== UI ===== */
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-10 text-center">
          DSpace 6.3 REST API Tester
        </h1>

        {!session?.authenticated && (
          <div className="bg-white shadow-lg rounded-xl p-7 border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Login</h2>
            <form onSubmit={handleLogin} className="space-y-5">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <button
                disabled={loading}
                className={`
                  w-full py-3 px-6 font-medium rounded-lg text-white transition-colors duration-200
                  ${loading 
                    ? "bg-blue-400 cursor-not-allowed" 
                    : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"}
                `}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
          </div>
        )}

        {session?.authenticated && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl p-7 mt-10 shadow-sm">
              <h2 className="text-2xl font-semibold text-green-800 mb-5">
                ✅ Đăng nhập thành công
              </h2>
              <pre className="bg-green-900/10 p-5 rounded-lg text-sm overflow-x-auto font-mono text-green-950">
                {JSON.stringify(session, null, 2)}
              </pre>
            </div>

            <div className="bg-white shadow-lg rounded-xl p-7 mt-10 border border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                Insert Item (Test)
              </h2>
              <form onSubmit={handleCreateItem} className="space-y-5">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <textarea
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all min-h-[120px] resize-y"
                />
                <button
                  disabled={loading}
                  className={`
                    w-full md:w-auto px-8 py-3 font-medium rounded-lg text-white transition-colors duration-200
                    ${loading 
                      ? "bg-indigo-400 cursor-not-allowed" 
                      : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"}
                  `}
                >
                  {loading ? "Creating..." : "Create Item"}
                </button>
              </form>
            </div>
          </>
        )}

        {result && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-7 mt-10 shadow-sm">
            <h3 className="text-xl font-semibold text-blue-800 mb-5">Result</h3>
            <pre className="bg-blue-900/10 p-5 rounded-lg text-sm overflow-x-auto font-mono text-blue-950 whitespace-pre-wrap break-words">
              {result.raw
                ? detectFormat(result.raw) === "xml"
                  ? formatXML(result.raw)
                  : JSON.stringify(JSON.parse(result.raw), null, 2)
                : JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-7 mt-10 shadow-sm">
            <h3 className="text-xl font-semibold text-red-800 mb-5">Error</h3>
            <pre className="bg-red-900/10 p-5 rounded-lg text-sm overflow-x-auto font-mono text-red-950 whitespace-pre-wrap break-words">
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}