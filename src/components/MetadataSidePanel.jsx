"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Save, Upload, ChevronRight, RotateCcw } from "lucide-react";

const OCR_API_URL = process.env.NEXT_PUBLIC_OCR_API_URL;

// Dublin Core key -> nhan hien thi dep hon
const KEY_LABELS = {
  "dc.title":                   "Title",
  "dc.title.alternative":       "Alternative Title",
  "dc.contributor.author":      "Author",
  "dc.contributor.advisor":     "Advisor",
  "dc.contributor.editor":      "Editor",
  "dc.publisher":               "Publisher",
  "dc.date.issued":             "Year",
  "dc.subject":                 "Subjects",
  "dc.description.abstract":    "Abstract",
  "dc.type":                    "Type",
  "dc.language.iso":            "Language",
  "dc.identifier.isbn":         "ISBN",
  "dc.format.extent":           "Pages",
  "dc.size":                    "Size",
  "dc.description.degree":      "Degree",
  "dc.department":              "Department",
  "dc.format.mimetype":         "MIME Type",
};

// Cac field nen dung textarea thay vi input
const TEXTAREA_KEYS = new Set([
  "dc.description.abstract",
  "dc.subject",
]);

// Cac field khong cho chinh sua
const READONLY_KEYS = new Set([
  "dc.format.mimetype",
]);

export default function MetadataSidePanel({ job, onClose, onSaved, onPush }) {
  const [fields,   setFields]   = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [pushing,  setPushing]  = useState(false);
  const [dirty,    setDirty]    = useState(false);
  const [saveMsg,  setSaveMsg]  = useState(null); // "saved" | "error"

  // Load metadata khi mo panel
  useEffect(() => {
    if (!job) return;

    const load = async () => {
      try {
        const res = await fetch(`${OCR_API_URL}/api/v2/jobs/${job.job_id}/metadata`);
        if (!res.ok) throw new Error("Failed to load metadata");
        const data = await res.json();
        setFields(data.metadata || []);
        setDirty(false);
      } catch (err) {
        console.error("Load metadata error:", err);
      }
    };
    load();
  }, [job?.job_id]);

  const handleChange = (idx, value) => {
    setFields(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], value };
      return next;
    });
    setDirty(true);
    setSaveMsg(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${OCR_API_URL}/api/v2/jobs/${job.job_id}/metadata`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: fields }),
      });
      if (!res.ok) throw new Error("Save failed");
      setDirty(false);
      setSaveMsg("saved");
      onSaved?.(job.job_id, fields);
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (err) {
      setSaveMsg("error");
    } finally {
      setSaving(false);
    }
  };

  const handlePush = async () => {
    // Luu truoc neu con dirty
    if (dirty) await handleSave();
    setPushing(true);
    try {
      await onPush(job.job_id);
    } finally {
      setPushing(false);
    }
  };

  if (!job) return null;

  // Nhom fields theo nhom de hien thi dep hon
  const groups = [
    {
      label: "Bibliographic",
      keys: ["dc.title", "dc.title.alternative", "dc.contributor.author",
             "dc.contributor.advisor", "dc.contributor.editor", "dc.publisher",
             "dc.date.issued", "dc.identifier.isbn"],
    },
    {
      label: "Content",
      keys: ["dc.subject", "dc.description.abstract", "dc.type",
             "dc.language.iso", "dc.description.degree", "dc.department"],
    },
    {
      label: "Technical",
      keys: ["dc.format.extent", "dc.size", "dc.format.mimetype"],
    },
  ];

  // Fields khong thuoc nhom nao -> nhom Other
  const groupedKeys = new Set(groups.flatMap(g => g.keys));
  const otherFields = fields.filter(f => !groupedKeys.has(f.key));

  return (
    <>
      {/* Backdrop mo */}
      <div
        className="fixed inset-0 bg-black/10 z-30 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-40 flex flex-col animate-slide-in-right">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">
              Edit Metadata
            </p>
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {job.filename}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Save status bar */}
        {saveMsg && (
          <div className={`px-6 py-2 text-xs font-medium shrink-0 ${
            saveMsg === "saved"
              ? "bg-green-50 text-green-700 border-b border-green-100"
              : "bg-red-50 text-red-700 border-b border-red-100"
          }`}>
            {saveMsg === "saved" ? "✓ Saved successfully" : "✗ Save failed, please try again"}
          </div>
        )}

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {groups.map(group => {
            const groupFields = fields
              .map((f, idx) => ({ ...f, idx }))
              .filter(f => group.keys.includes(f.key));

            if (groupFields.length === 0) return null;

            return (
              <div key={group.label}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  {group.label}
                </p>
                <div className="space-y-3">
                  {groupFields.map(f => (
                    <FieldRow
                      key={`${f.key}-${f.idx}`}
                      field={f}
                      onChange={val => handleChange(f.idx, val)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {otherFields.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Other
              </p>
              <div className="space-y-3">
                {otherFields.map(f => {
                  const idx = fields.findIndex(x => x.key === f.key && x.value === f.value);
                  return (
                    <FieldRow
                      key={`${f.key}-${idx}`}
                      field={{ ...f, idx }}
                      onChange={val => handleChange(idx, val)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center gap-3 bg-gray-50/50">
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {saving
              ? <RotateCcw className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />
            }
            {dirty ? "Save Changes" : "Saved"}
          </button>

          {/* Push button */}
          <button
            onClick={handlePush}
            disabled={pushing || job.dspace_status === "uploaded"}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {pushing
              ? <RotateCcw className="w-4 h-4 animate-spin" />
              : <Upload className="w-4 h-4" />
            }
            {job.dspace_status === "uploaded" ? "Already Uploaded" : "Save & Push to DSpace"}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </>
  );
}

// ---------------------------------------------------------------
// FieldRow - 1 metadata field co the edit
// ---------------------------------------------------------------
function FieldRow({ field, onChange }) {
  const label    = KEY_LABELS[field.key] || field.key.replace("dc.", "").replace(/\./g, " ");
  const readonly = READONLY_KEYS.has(field.key);
  const isArea   = TEXTAREA_KEYS.has(field.key);

  return (
    <div className="group">
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
        {field.language && (
          <span className="ml-1.5 text-gray-300 font-normal">[{field.language}]</span>
        )}
      </label>

      {isArea ? (
        <textarea
          value={field.value}
          onChange={e => onChange(e.target.value)}
          disabled={readonly}
          rows={3}
          className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors resize-none"
        />
      ) : (
        <input
          type="text"
          value={field.value}
          onChange={e => onChange(e.target.value)}
          disabled={readonly}
          className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
        />
      )}
    </div>
  );
}