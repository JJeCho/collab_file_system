import axios from 'axios';
import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

function DocumentEditor({ filename, onFileSaved, token }) {
  const [content, setContent] = useState('');
  const [notification, setNotification] = useState('');

  useEffect(() => {
    if (filename) {
      axios.get(`http://localhost:5000/file/content/${filename}`, {
        headers: {
          'Authorization': token // Include the token in the request headers
        }
      })
      .then(res => {
        setContent(res.data);
      })
      .catch(err => console.error('Error fetching file:', err));

      // Subscribe to socket events
      socket.on('document-update', updatedContent => {
        if (updatedContent.filename === filename) {
          setContent(updatedContent.content);
          setNotification(`Another user is editing this document.`);
          setTimeout(() => setNotification(''), 3000); // Clear notification after 3 seconds
        }
      });

      return () => {
        socket.off('document-update');
      };
    }
  }, [filename, token]);

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    socket.emit('document-edit', { filename, content: newContent });
  };

  const handleSave = () => {
    const encodedFilename = encodeURIComponent(filename);
    axios.post(`http://localhost:5000/file/update/${encodedFilename}`, { content }, {
      headers: {
        'Authorization': token // Include the token in the request headers
      }
    })
    .then(res => {
      console.log('File saved successfully');
      alert('File saved successfully');
      onFileSaved(); // Call the callback to inform parent component that file is saved
    })
    .catch(err => {
      console.error('Error saving file:', err);
      alert('Failed to save file');
    });
  };

  return (
    <div>
      {notification && <div className="notification">{notification}</div>}
      <textarea 
        value={content} 
        onChange={handleContentChange} 
        style={{ width: '100%', height: '300px' }} 
      />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

export default DocumentEditor;
