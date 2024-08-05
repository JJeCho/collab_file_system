import axios from 'axios';
import React, { useEffect, useState } from 'react';

function FileList({ onFileSelect, token }) {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5000/files', {
      headers: {
        'Authorization': token // Include the token in the request headers
      }
    })
    .then(res => {
      setFiles(res.data);
    })
    .catch(err => console.error('Error fetching files:', err));
  }, [token]);

  const handleDelete = (filename) => {
    axios.delete(`http://localhost:5000/files/${filename}`, {
      headers: {
        'Authorization': token // Include the token in the request headers
      }
    })
    .then(() => {
      setFiles(files.filter(file => file.filename !== filename));
    })
    .catch(err => console.error('Error deleting file:', err));
  };

  return (
    <div>
      <h2>Available Files</h2>
      <ul>
        {files.map(file => (
          <li key={file._id}>
            <span onClick={() => onFileSelect(file.filename)}>{file.filename}</span>
            <button onClick={() => handleDelete(file.filename)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FileList;
