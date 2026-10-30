import React, { useState, useRef } from 'react';
import './App.css';

// Inline Icons
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

function App() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        setResult(null); // Reset previous result
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setImage(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    
    setIsAnalyzing(true);
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', image);
      
      // Call the Node.js backend
      const response = await fetch('http://localhost:5001/predict', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setResult({
          disease: data.disease,
          confidence: data.confidence, // This is the analyze percentage
          status: data.status,
          recommendation: data.recommendation
        });
      } else {
        throw new Error(data.error || 'Prediction failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze the image: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="App">
      <header>
        <h1>CropHealth AI</h1>
        <p className="subtitle">Instant Plant Disease Detection</p>
      </header>

      <main className={`main-content ${result ? 'has-result' : ''}`}>
        <div className="upload-card">
          <input 
            type="file" 
            accept="image/*" 
            style={{ display: 'none' }} 
            ref={fileInputRef}
            onChange={handleFileInput}
          />
          
          <div 
            className={`drop-zone ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !preview && fileInputRef.current?.click()}
          >
            {preview ? (
              <>
                <img src={preview} alt="Preview" className="preview-image" />
                <button className="remove-btn" onClick={handleRemoveImage} title="Remove image">
                  <TrashIcon />
                </button>
              </>
            ) : (
              <>
                <UploadIcon />
                <h3>Drag & drop a leaf image</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  or click to browse from your device
                </p>
              </>
            )}
          </div>

          <button 
            className="analyze-btn" 
            onClick={handleAnalyze} 
            disabled={!preview || isAnalyzing}
          >
            {isAnalyzing ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span className="loader"></span> Analyzing...
              </span>
            ) : 'Analyze Image'}
          </button>
        </div>

        {result && (
          <div className="result-card">
            <h2>
              <CheckCircleIcon /> 
              Analysis Complete
            </h2>
            
            <div className="result-item">
              <div className="result-label">Diagnosis</div>
              <div className={`result-value ${result.status}`}>
                {result.disease}
              </div>
            </div>

            <div className="result-item">
              <div className="result-label">Confidence Score</div>
              <div className="result-value">{result.confidence}%</div>
              <div className="confidence-bar">
                <div 
                  className="confidence-level" 
                  style={{ width: `${result.confidence}%` }}
                ></div>
              </div>
            </div>

            <div className="result-item" style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
              <div className="result-label" style={{ color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 'bold' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Treatment Suggestion
              </div>
              <div style={{ lineHeight: '1.6', marginTop: '0.75rem', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {result.recommendation}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
