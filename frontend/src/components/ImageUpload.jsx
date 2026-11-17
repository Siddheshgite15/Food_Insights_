import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, X, Sparkles, Camera } from 'lucide-react';
import CameraCapture from './CameraCapture';

export default function ImageUpload({
  onImagesSelect,
  selectedImages = [],
  previewUrls = [],
  onClear,
  viewCount,
  setViewCount,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith('image/')).slice(0, viewCount);
      if (files.length > 0) onImagesSelect([...selectedImages, ...files].slice(0, viewCount));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files?.length) {
      onImagesSelect([...selectedImages, ...Array.from(e.target.files)].slice(0, viewCount));
    }
    e.target.value = '';
  };

  const handleCameraCapture = (file) => {
    setShowCamera(false);
    onImagesSelect([...selectedImages, file].slice(0, viewCount));
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
        <ImageIcon size={16} className="text-amber-400" />
        Banana Specimen Image
      </label>

      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs text-gray-400">Number of angles</span>
        <div className="flex rounded-xl bg-black/30 border border-white/10 p-1">
          {[1, 2, 4].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setViewCount(count)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewCount === count ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:text-white'
              }`}
            >
              {count} {count === 1 ? 'image' : 'images'}
            </button>
          ))}
        </div>
      </div>

      {selectedImages.length > 0 ? (
        <>
          <div className={`grid gap-3 ${viewCount === 4 ? 'grid-cols-2' : viewCount === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {selectedImages.map((image, index) => (
              <div key={`${image.name}-${index}`} className="relative rounded-xl overflow-hidden border border-white/10 bg-black/30">
                <img src={previewUrls[index]} alt={`Fruit angle ${index + 1}`} className="w-full aspect-video object-contain" />
                <span className="absolute left-2 bottom-2 px-2 py-1 rounded-md bg-black/70 text-[10px] text-white">Angle {index + 1}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">{selectedImages.length} of {viewCount} images selected</span>
            <button type="button" onClick={onClear} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 text-xs border border-red-500/20">
              <X size={14} /> Clear all
            </button>
          </div>
          {selectedImages.length < viewCount && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 px-4 py-3 text-xs font-semibold"
              >
                <UploadCloud size={16} /> Add image
              </button>
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 px-4 py-3 text-xs font-semibold"
              >
                <Camera size={16} /> Add from camera
              </button>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            multiple={viewCount > 1}
            className="hidden"
          />
        </>
      ) : (
        <div className="space-y-3">
          {/* Drag & drop / browse area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 flex flex-col items-center justify-center min-h-[170px] ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
                : 'border-white/15 hover:border-amber-500/50 bg-gray-900/40 hover:bg-gray-900/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              multiple={viewCount > 1}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3 text-amber-400 shadow-inner">
              <UploadCloud size={28} />
            </div>
            <h4 className="text-sm font-semibold text-white mb-1">
              Drag & drop your fruit photo here
            </h4>
            <p className="text-[11px] text-gray-400 max-w-sm mb-3">
              Supports JPG, PNG, WebP
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10 transition-colors">
              <Sparkles size={14} />
              Browse from Device
            </span>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Camera Capture Button */}
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="w-full cursor-pointer rounded-2xl border-2 border-dashed border-white/15 hover:border-emerald-500/50 bg-gray-900/40 hover:bg-emerald-500/5 p-5 text-center transition-all duration-300 flex flex-col items-center justify-center gap-2.5 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-110 transition-transform duration-300">
              <Camera size={28} />
            </div>
            <h4 className="text-sm font-semibold text-white">
              Open Camera & Capture
            </h4>
            <p className="text-[11px] text-gray-400 max-w-xs">
              Take a live photo of the banana using your device camera
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500/5 group-hover:bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 transition-colors">
              <Camera size={14} />
              Launch Camera
            </span>
          </button>
        </div>
      )}

      {/* Camera modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
