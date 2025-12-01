import React, { useState, useRef } from "react";
import axios from "axios";
import { FiUploadCloud } from "react-icons/fi";

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("⚠️ Please select a file first!");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);
      setMessage("");

      const response = await axios.post(
        "http://localhost:3000/userdocs/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        }
      );

      setMessage("✅ File uploaded successfully!");
      console.log("Upload response:", response.data);
      setFile(null);
    } catch (error) {
      console.error(error);
      setMessage("❌ Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-purple-100 via-blue-50 to-teal-50 p-6">
      <div className="w-full max-w-xl bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 space-y-8 transition-all duration-500 hover:shadow-xl hover:scale-[1.02]">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Upload Your File
          </h1>
          <p className="text-gray-500">Drag and drop your files here</p>
        </div>

        {/* Drag & Drop Zone */}
        <div
          className={`relative group border-3 ${
            dragOver
              ? "border-blue-500 bg-blue-50"
              : "border-dashed border-gray-300 hover:border-blue-400"
          } rounded-2xl p-8 transition-all duration-300 ease-in-out transform cursor-pointer`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center space-y-4">
            <FiUploadCloud
              className={`text-7xl ${
                dragOver ? "text-blue-500" : "text-gray-400"
              } group-hover:text-blue-500 transition-colors duration-300 ${
                !file && "animate-bounce"
              }`}
            />

            <div className="text-center space-y-2">
              {file ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-lg font-medium text-gray-700">
                    {file.name}
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-lg font-medium text-gray-700">
                    Drop your file here, or{" "}
                    <span className="text-blue-500 hover:text-blue-600">
                      browse
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Support for any file type
                  </p>
                </>
              )}
            </div>
          </div>
          <input
            type="file"
            ref={inputRef}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className={`w-full py-4 rounded-xl font-semibold text-white shadow-lg transition-all duration-300 ${
            uploading || !file
              ? "bg-gray-400 cursor-not-allowed opacity-50"
              : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 hover:shadow-blue-200/50 hover:-translate-y-0.5"
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center space-x-3">
              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Uploading...</span>
            </div>
          ) : (
            "Upload File"
          )}
        </button>

        {message && (
          <div
            className={`text-center p-4 rounded-lg ${
              message.includes("✅")
                ? "bg-green-50 text-green-700"
                : message.includes("❌")
                ? "bg-red-50 text-red-700"
                : "bg-yellow-50 text-yellow-700"
            } transition-all duration-300 animate-fade-in`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;
