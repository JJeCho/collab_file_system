import React, { useState } from 'react';
import DocumentEditor from './components/DocumentEditor';
import FileList from './components/FileList';
import FileUpload from './components/FileUpload';
import Login from './components/Login';
import Register from './components/Register';
import './styles.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [token, setToken] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleFileSaved = () => {
    setSelectedFile(null);
  };

  const handleLogin = (newToken) => {
    setToken(newToken);
  };

  const toggleRegister = () => {
    setIsRegistering(!isRegistering);
  };

  return (
    <div className="App">
      <h1>Collaborative Document Editor</h1>
      {!token ? (
        isRegistering ? (
          <Register onRegister={toggleRegister} />
        ) : (
          <Login onLogin={handleLogin} />
        )
      ) : (
        <>
          <FileUpload token={token} />
          <FileList onFileSelect={setSelectedFile} token={token} />
          {selectedFile && <DocumentEditor filename={selectedFile} onFileSaved={handleFileSaved} token={token} />}
        </>
      )}
      {!token && (
        <button onClick={toggleRegister}>
          {isRegistering ? 'Go to Login' : 'Register'}
        </button>
      )}
    </div>
  );
}

export default App;
