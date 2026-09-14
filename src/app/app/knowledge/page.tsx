'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Plus, FileText, CheckCircle2, Upload, Database } from 'lucide-react';

export default function KnowledgePage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newDoc, setNewDoc] = useState({
    title: '',
    type: 'FAQ',
    content: '',
  });

  const fetchDocs = () => {
    setLoading(true);
    fetch('/api/app/knowledge')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setDocs(data.data.documents || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/app/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDoc),
    });
    setShowModal(false);
    setNewDoc({ title: '', type: 'FAQ', content: '' });
    fetchDocs();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 className="title-xl">Knowledge Base & RAG Index</h1>
          <p className="text-body" style={{ marginTop: '4px' }}>
            Attach clinic policies, insurance coverages, and product FAQs to empower AI agent retrieval.
          </p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Add Document
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Document Title</th>
              <th>Format</th>
              <th>Size</th>
              <th>Vector Chunks</th>
              <th>Indexing Status</th>
              <th>Last Synchronized</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading knowledge items...
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No knowledge documents uploaded yet.
                </td>
              </tr>
            ) : (
              docs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={15} style={{ color: '#38bdf8' }} />
                      {doc.title}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-primary">{doc.type}</span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {Math.round(doc.sizeBytes / 1024)} KB
                  </td>
                  <td style={{ fontWeight: 600 }}>{doc.chunkCount} chunks</td>
                  <td>
                    <span className="badge badge-active">
                      <CheckCircle2 size={12} /> {doc.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {doc.lastIndexedAt ? new Date(doc.lastIndexedAt).toLocaleDateString() : 'Just now'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '30px' }}>
            <h2 className="title-md" style={{ marginBottom: '16px' }}>Add Knowledge Document</h2>
            <form onSubmit={handleCreateDoc}>
              <div className="form-group">
                <label className="form-label">Document Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Accepted Insurances & Fee Schedule"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Format Type</label>
                <select
                  className="form-control"
                  value={newDoc.type}
                  onChange={(e) => setNewDoc({ ...newDoc, type: e.target.value })}
                >
                  <option value="FAQ">FAQ / Question & Answer</option>
                  <option value="PDF">PDF Practice Policy</option>
                  <option value="MARKDOWN">Markdown Guidelines</option>
                  <option value="URL">Website Documentation URL</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Content / Text *</label>
                <textarea
                  className="form-control"
                  style={{ minHeight: '120px' }}
                  placeholder="Paste FAQ answers or insurance guidelines here..."
                  value={newDoc.content}
                  onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Upload & Index
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
