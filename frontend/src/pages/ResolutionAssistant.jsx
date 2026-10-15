import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Cpu,
  Layers,
} from 'lucide-react';
import Header from '../components/Header';
import { api } from '../api';

export default function ResolutionAssistant() {
  const [searchParams] = useSearchParams();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [disclaimer, setDisclaimer] = useState('');
  const [searchedCount, setSearchedCount] = useState(0);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const urlTitle = searchParams.get('title');
    const urlDesc = searchParams.get('desc');
    if (urlTitle) {
      setTitle(urlTitle);
      if (urlDesc) setDescription(urlDesc);
      triggerSearch(urlTitle, urlDesc || '');
    }
  }, [searchParams]);

  const triggerSearch = async (t, d) => {
    if (!t.trim()) {
      setError('Please provide an issue title to analyze.');
      return;
    }
    setError('');
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await api.getSimilarIssues(t, d, 3);
      setResults(data.results || []);
      setDisclaimer(data.disclaimer || '');
      setSearchedCount(data.total_historical_searched || 0);
    } catch (err) {
      setError(err.message || 'Failed to perform similarity search.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    triggerSearch(title, description);
  };

  const loadSample = (sampleTitle, sampleDesc) => {
    setTitle(sampleTitle);
    setDescription(sampleDesc);
    triggerSearch(sampleTitle, sampleDesc);
  };

  return (
    <div>
      <Header title="AI Resolution Assistant" />

      <div className="content-body">
        {/* Intro Banner */}
        <div className="card" style={{ marginBottom: '24px', backgroundColor: '#0f172a', color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={24} color="#ffffff" />
            </div>

            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '6px', color: '#ffffff' }}>
                Statistical Defect Resolution Recommender
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: '1.5' }}>
                Describe any software bug or error trace below. The assistant leverages an explainable{' '}
                <strong style={{ color: '#60a5fa' }}>TF-IDF vectorizer + Cosine Similarity</strong> algorithm to scan{' '}
                2,500+ verified historical Apache defects, uncovering how senior engineers previously diagnosed and resolved similar failures.
              </p>
            </div>
          </div>
        </div>

        {/* Input Form Card */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Defect Summary / Error Message</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. NullPointerException when metadata loader exceeds batch size"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Detailed Symptoms, Logs, or Stack Trace</label>
              <textarea
                className="form-textarea"
                placeholder="Paste the relevant exception stack trace, logs, or reproduction steps..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.82rem', color: '#64748b' }}>
                <span>Try quick demo cases:</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    loadSample(
                      'MetadataLoader receive uncommitted data when log reads exceed MAX_BATCH_SIZE_BYTES',
                      'Kafka metadata log layer slice records from KRaft greater than max batch size'
                    )
                  }
                >
                  Kafka Batch Bug
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    loadSample(
                      'Fix applyInPandasWithState failure with PyArrow 26 due to float slice offsets',
                      'RecordBatch slice validate offset length operator index float failure'
                    )
                  }
                >
                  PyArrow Slice Bug
                </button>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Sparkles size={16} />
                <span>{loading ? 'Analyzing Corpus...' : 'Search Solutions'}</span>
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        {/* Results Section */}
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
            <Cpu size={36} style={{ margin: '0 auto 12px', animation: 'spin 2s linear infinite', color: '#3b82f6' }} />
            <p style={{ fontWeight: '600', fontSize: '1rem', color: '#0f172a' }}>
              Vectorizing Query & Computing Cosine Similarities...
            </p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Comparing n-gram TF-IDF vectors against historical Apache defects.
            </p>
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
            <HelpCircle size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontWeight: '600' }}>No sufficiently similar historical defect was found</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Try refining the bug title with technical terms (e.g. exception names, module names, or library versions).
            </p>
          </div>
        ) : results.length > 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
                Top {results.length} Similar Historical Defect Tickets
              </h3>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Scanned {searchedCount} historical records
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {results.map((item, idx) => (
                <div key={item.id || idx} className="card" style={{ borderLeft: '4px solid #2563eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '700', color: '#2563eb', fontSize: '0.95rem' }}>
                          {item.issue_key}
                        </span>
                        <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1e40af' }}>
                          {item.project}
                        </span>
                        <span className="badge badge-resolved">{item.status}</span>
                        {item.resolution && (
                          <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
                            Resolution: {item.resolution}
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: '600', color: '#0f172a' }}>
                        {item.title}
                      </h4>
                    </div>

                    {/* Similarity Score Pill */}
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: '800',
                          color: item.similarity_score > 30 ? '#16a34a' : '#2563eb',
                        }}
                      >
                        {item.similarity_score}% Match
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Cosine Similarity</div>
                    </div>
                  </div>

                  {/* Description Snippet */}
                  <div
                    style={{
                      fontSize: '0.88rem',
                      color: '#475569',
                      backgroundColor: '#f8fafc',
                      padding: '12px 14px',
                      borderRadius: '6px',
                      lineHeight: '1.5',
                      marginBottom: '12px',
                    }}
                  >
                    {item.description ? item.description.slice(0, 320) + (item.description.length > 320 ? '...' : '') : 'No description text recorded.'}
                  </div>

                  {/* Resolution Guidance Box */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#047857', backgroundColor: '#ecfdf5', padding: '8px 12px', borderRadius: '4px' }}>
                    <CheckCircle2 size={16} />
                    <span>
                      <strong>Historical Fix Status:</strong> {item.resolution || 'Resolved'} in {item.project}.
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Disclaimer Alert */}
            {disclaimer && (
              <div className="alert alert-info" style={{ marginTop: '24px' }}>
                <HelpCircle size={18} />
                <span style={{ fontSize: '0.84rem' }}>{disclaimer}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
