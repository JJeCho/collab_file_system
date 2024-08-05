const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const authRoutes = require("./routes/authRoutes");
const http = require("http");
const socketio = require("socket.io");
const authMiddleware = require('./middleware/authMiddleware');
const dotenv = require("dotenv");
dotenv.config();

// Create an Express application
const app = express();
// Create HTTP server and wrap the Express app
const server = http.createServer(app);
// Initialize Socket.IO and bind it to the server
const io = socketio(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware to parse JSON bodies
app.use(bodyParser.json());
// Middleware to allow cross-origin requests
app.use(cors());

// Basic route for testing
app.get("/", (req, res) => {
  res.send("Hello, your server is running!");
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connection established successfully");
    // Initialize GridFS
    const conn = mongoose.connection;
    let gfs = new mongoose.mongo.GridFSBucket(conn.db, {
      bucketName: "file_uploads"
    });

    // In-memory document states
    let documentStates = {};

    // Create storage engine
    const storage = new GridFsStorage({
      url: process.env.MONGO_URI,
      file: (req, file) => {
        return {
          filename: file.originalname,
          bucketName: "file_uploads",
        };
      },
    });

    const upload = multer({ storage });

    // Routes to upload, retrieve, and delete files
    app.post("/upload", authMiddleware, upload.single("file"), (req, res) => {
      if (!req.file) {
        return res.status(400).send("No file uploaded");
      }
      res.json({ file: req.file });
    });

    app.get('/files', (req, res) => {
      if (!gfs) {
        console.log("GridFS not initialized");
        return res.status(500).send("Server error");
      }

      const files = [];
      gfs.find().forEach(file => {
        files.push({
          _id: file._id,
          filename: file.filename,
          contentType: file.contentType,
          length: file.length,
          uploadDate: file.uploadDate
        });
      }).then(() => {
        if (files.length === 0) {
          return res.status(404).send("No files found");
        }
        console.log("Files retrieved:", files);
        res.json(files);
      }).catch(err => {
        console.log("Error during file retrieval:", err);
        res.status(500).send("Error retrieving files");
      });
    });

    app.get("/files/:filename", (req, res) => {
      gfs.find({ filename: req.params.filename }).toArray((err, files) => {
        if (!files[0] || files.length === 0) {
          return res.status(404).send("No file exists");
        }
        gfs.openDownloadStreamByName(req.params.filename).pipe(res);
      });
    });

    app.delete("/files/:filename", authMiddleware, async (req, res) => {
      try {
        const file = await gfs.find({ filename: req.params.filename }).toArray();
        if (!file[0] || file.length === 0) {
          return res.status(404).send("No file exists");
        }
        await gfs.delete(file[0]._id);
        res.status(204).send("File deleted");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Route to get the content of a file for editing
    app.get("/file/content/:filename", authMiddleware, async (req, res) => {
      try {
        if (documentStates[req.params.filename]) {
          return res.send(documentStates[req.params.filename]);
        }

        const file = await gfs.find({ filename: req.params.filename }).toArray();
        if (!file[0] || file.length === 0) {
          return res.status(404).json({
            err: 'No file exists'
          });
        }

        const readstream = gfs.openDownloadStreamByName(req.params.filename);
        let data = '';
        readstream.on('data', (chunk) => {
          data += chunk.toString('utf8');
        });
        readstream.on('end', () => {
          documentStates[req.params.filename] = data;
          res.send(data);
        });
        readstream.on('error', (err) => {
          console.log('An error occurred!', err);
          throw err;
        });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Route to update the content of a file
    app.post("/file/update/:filename", authMiddleware, async (req, res) => {
      const { filename } = req.params;
      const { content } = req.body;

      if (!content) {
        return res.status(400).send("Content is required");
      }

      try {
        const files = await gfs.find({ filename }).toArray();
        if (!files[0] || files.length === 0) {
          return res.status(404).send("No file exists");
        }

        await gfs.delete(files[0]._id);

        const writeStream = gfs.openUploadStream(filename, {
          contentType: 'text/plain'
        });
        writeStream.end(content);

        writeStream.on('finish', () => {
          documentStates[filename] = content;
          res.send("File content updated successfully");
        });

        writeStream.on('error', (err) => {
          console.error('Error saving file:', err);
          res.status(500).send("Error saving file");
        });
      } catch (err) {
        console.error('Error updating file:', err);
        res.status(500).send("Error updating file");
      }
    });

    // Setup Socket.IO for real-time communication
    io.on("connection", (socket) => {
      console.log("New client connected");

      socket.on("document-edit", (data) => {
        const { filename, content } = data;
        documentStates[filename] = content;
        socket.broadcast.emit("document-update", data);
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected");
      });
    });

  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Use routes for authentication
app.use("/api/auth", authRoutes);

// Define the port
const PORT = process.env.PORT || 5000;

// Start the server using the HTTP server, not the Express app
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
