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
    <div className="min-h-full flex items-center justify-center bg-gradient-to-tr from-secondary via-primary to-accent p-6">
      <div className="w-full max-w-xl bg-primary/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 space-y-8 transition-all duration-500 hover:shadow-xl hover:scale-[1.02]">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-success to-accent bg-clip-text text-transparent">
            Upload Your File
          </h1>
          <p className="text-theme-textLight">Drag and drop your files here</p>
        </div>

        {/* Drag & Drop Zone */}
        <div
          className={`relative group border-3 ${
            dragOver
              ? "border-success bg-secondary"
              : "border-dashed border-theme-textLight hover:border-success"
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
                dragOver ? "text-success" : "text-theme-textLight"
              } group-hover:text-success transition-colors duration-300 ${
                !file && "animate-bounce"
              }`}
            />

            <div className="text-center space-y-2">
              {file ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span className="text-lg font-medium text-theme-text">
                    {file.name}
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-lg font-medium text-theme-text">
                    Drop your file here, or{" "}
                    <span className="text-success hover:text-accent">
                      browse
                    </span>
                  </p>
                  <p className="text-sm text-theme-textLight">
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
          className={`w-full py-4 rounded-xl font-semibold text-theme-text shadow-lg transition-all duration-300 ${
            uploading || !file
              ? "bg-theme-textLight cursor-not-allowed opacity-50"
              : "bg-gradient-to-r from-success to-accent hover:from-accent hover:to-success hover:shadow-accent/50 hover:-translate-y-0.5"
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center space-x-3">
              <div className="w-5 h-5 border-3 border-theme-text border-t-transparent rounded-full animate-spin"></div>
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
                ? "bg-success/20 text-success"
                : message.includes("❌")
                ? "bg-red-50 text-red-700"
                : "bg-accent/20 text-accent"
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
