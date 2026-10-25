"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Upload, Search, Shield, Lock, Eye,
  Calendar, User, ExternalLink, Download,
  Pill, Stethoscope, FlaskConical, FileImage,
  AlertCircle, CheckCircle2, Loader2, X, RefreshCw, Trash2
} from "lucide-react";
import { recordsAPI, MedicalRecord, ApiError, getToken } from "@/lib/api";

const recordTypes = [
  { key: "all", label: "All", icon: FileText },
  { key: "lab_report", label: "Lab Reports", icon: FlaskConical },
  { key: "prescription", label: "Prescriptions", icon: Pill },
  { key: "imaging", label: "Imaging", icon: FileImage },
  { key: "consultation_note", label: "Consultation Notes", icon: Stethoscope },
];

const mockRecords: MedicalRecord[] = [
  {
    id: "demo-1",
    title: "Complete Blood Count (CBC)",
    record_type: "lab_report",
    description: "Routine blood panel — all values in normal range. WBC, RBC, hemoglobin, and platelet counts stable.",
    provider: "Apollo Diagnostics",
    created_at: "2026-03-28T10:30:00Z",
    is_encrypted: true,
    ipfs_cid: "QmX7d...",
    file_url: "",
  },
  {
    id: "demo-2",
    title: "Chest X-Ray PA View",
    record_type: "imaging",
    description: "PA and lateral chest radiograph. Lungs clear, no infiltrates. Heart size normal. No pleural effusion.",
    provider: "AMTZ Medical Center",
    created_at: "2026-03-20T14:15:00Z",
    is_encrypted: true,
    ipfs_cid: "QmRk2...",
    file_url: "",
  },
  {
    id: "demo-3",
    title: "Metformin HCl 500mg Prescription",
    record_type: "prescription",
    description: "Prescribed Metformin 500mg twice daily with meals for pre-diabetic management. 3-month supply.",
    provider: "Dr. Sharma, Endocrinology",
    created_at: "2026-03-15T09:00:00Z",
    is_encrypted: true,
    ipfs_cid: "QmFz9...",
    file_url: "",
  },
];

const typeIcons: Record<string, typeof FileText> = {
  lab_report: FlaskConical,
  prescription: Pill,
  imaging: FileImage,
  consultation_note: Stethoscope,
  diagnosis: FileText,
  vaccination: Shield,
  discharge_summary: FileText,
};

const typeColors: Record<string, string> = {
  lab_report: "#00f0ff",
  prescription: "#f59e0b",
  imaging: "#8b5cf6",
  consultation_note: "#10b981",
  diagnosis: "#ec4899",
  vaccination: "#14b8a6",
  discharge_summary: "#6366f1",
};

export default function RecordsView() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState("lab_report");
  const [uploadDescription, setUploadDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  // Preview & Access Modal State
  const [previewAsset, setPreviewAsset] = useState<{
    record: MedicalRecord;
    url: string;
    isFreshUrl: boolean;
  } | null>(null);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);

  // Fetch records from backend
  const fetchRecords = async () => {
    setIsLoading(true);
    setUploadError(null);
    try {
      const response = await recordsAPI.list(selectedType);
      const items = Array.isArray(response) ? response : response.results || [];
      setRecords(items);
      setServiceUnavailable(false);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 503) {
        setServiceUnavailable(true);
      } else {
        console.warn("Unable to fetch live records from backend:", err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedType]);

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size limit (25MB)
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("File size exceeds 25 MB limit.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setUploadSuccess(null);

    // Auto-populate title if empty
    if (!uploadTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setUploadTitle(cleanName);
    }

    // Auto-detect type suggestion from extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") {
      setUploadType("imaging");
    } else if (file.name.toLowerCase().includes("prescription") || file.name.toLowerCase().includes("rx")) {
      setUploadType("prescription");
    } else {
      setUploadType("lab_report");
    }
  };

  // Execute upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    if (!getToken()) {
      setUploadError("Authentication required: Please sign in to upload medical records.");
      return;
    }

    if (!uploadTitle.trim()) {
      setUploadError("Please provide a title for the record.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", uploadTitle.trim());
    formData.append("record_type", uploadType);
    if (uploadDescription.trim()) {
      formData.append("description", uploadDescription.trim());
    }

    try {
      const newRecord = await recordsAPI.upload(formData);
      setUploadSuccess(`"${newRecord.title}" uploaded successfully to Cloudinary!`);
      setSelectedFile(null);
      setUploadTitle("");
      setUploadDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowUpload(false);
      // Refresh record list
      await fetchRecords();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 503) {
          setServiceUnavailable(true);
          setUploadError("Cloudinary media service is currently unconfigured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the backend environment.");
        } else if (err.status === 400) {
          setUploadError(err.message || "Invalid file format or size.");
        } else if (err.status === 401) {
          setUploadError("Authentication session expired or invalid. Please sign in again.");
        } else if (err.status === 403) {
          setUploadError("Permission denied: You cannot upload records for this patient.");
        } else if (err.status === 502) {
          setUploadError("Cloudinary storage timeout or upstream failure. Please retry.");
        } else {
          setUploadError(err.message || "Upload failed. Please ensure backend is reachable.");
        }
      } else {
        setUploadError(err instanceof Error ? err.message : "An unexpected upload error occurred.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  // View or download record asset
  const handleViewRecord = async (record: MedicalRecord) => {
    if (record.file_url) {
      setPreviewAsset({ record, url: record.file_url, isFreshUrl: false });
      return;
    }

    // Attempt to resolve fresh signed access URL from backend
    setIsResolvingUrl(true);
    try {
      const access = await recordsAPI.getAccessUrl(record.id);
      if (access && access.access_url) {
        setPreviewAsset({ record, url: access.access_url, isFreshUrl: true });
      } else {
        setUploadError("No file attachment found for this record.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to generate signed access URL.";
      setUploadError(msg);
    } finally {
      setIsResolvingUrl(false);
    }
  };

  // Delete record
  const handleDeleteRecord = async (record: MedicalRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${record.title}"? This will remove it from Cloudinary and the database.`)) {
      return;
    }

    try {
      await recordsAPI.delete(record.id);
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
      if (previewAsset?.record.id === record.id) {
        setPreviewAsset(null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete record.");
    }
  };

  // Display items: use backend records if available, otherwise show synthetic demo fixtures with an explicit label
  const displayRecords = records.length > 0 ? records : mockRecords;
  const isUsingDemoFixtures = records.length === 0 && !isLoading;

  const filtered = displayRecords.filter((r) => {
    if (selectedType !== "all" && r.record_type !== selectedType) return false;
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Cloudinary Service Unavailable Banner */}
      {serviceUnavailable && (
        <motion.div
          className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200">Cloudinary Media Storage Not Configured</p>
            <p className="text-amber-300/80 leading-relaxed">
              Uploads are running in mock/demo mode. To activate live uploads, configure{" "}
              <code className="px-1 py-0.5 rounded bg-black/40 text-amber-200 font-mono text-[11px]">
                CLOUDINARY_CLOUD_NAME
              </code>
              ,{" "}
              <code className="px-1 py-0.5 rounded bg-black/40 text-amber-200 font-mono text-[11px]">
                CLOUDINARY_API_KEY
              </code>
              , and{" "}
              <code className="px-1 py-0.5 rounded bg-black/40 text-amber-200 font-mono text-[11px]">
                CLOUDINARY_API_SECRET
              </code>{" "}
              in your backend environment.
            </p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-200">Medical Records</h2>
            {isUsingDemoFixtures && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Demo Fixtures
              </span>
            )}
            {!isUsingDemoFixtures && records.length > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Cloudinary Storage Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {records.length} live records stored • Encrypted, signed access on Cloudinary & IPFS
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={fetchRecords}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-slate-400 hover:text-slate-200 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title="Refresh records"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </motion.button>

          <motion.button
            onClick={() => {
              setShowUpload(!showUpload);
              setUploadError(null);
              setUploadSuccess(null);
            }}
            className="btn-primary flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Upload size={16} />
            {showUpload ? "Close Upload" : "Upload Record"}
          </motion.button>
        </div>
      </div>

      {/* Success Notification */}
      {uploadSuccess && (
        <motion.div
          className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between gap-2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
          <button onClick={() => setUploadSuccess(null)} className="text-emerald-400 hover:text-white">
            <X size={14} />
          </button>
        </motion.div>
      )}

      {/* Upload Zone */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            className="glass-card p-6 border-2 border-dashed border-violet-500/30"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm,.txt"
              className="hidden"
            />

            {!selectedFile ? (
              <div className="text-center py-4">
                <Upload size={36} className="mx-auto text-violet-400 mb-3 animate-pulse" />
                <p className="text-sm text-slate-200 font-medium mb-1">
                  Select a medical document or diagnostic image
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  Supports PDF, DICOM, JPG, PNG, WEBP — up to 25 MB per record
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary text-sm inline-flex items-center gap-2"
                >
                  <Upload size={14} />
                  Choose File from Device
                </button>
              </div>
            ) : (
              <form onSubmit={handleUploadSubmit} className="space-y-4 max-w-xl mx-auto">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-medium text-slate-200 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || "Document"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.05]"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Record Title *</label>
                    <input
                      type="text"
                      required
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g. Chest X-Ray PA View"
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Record Category *</label>
                    <select
                      value={uploadType}
                      onChange={(e) => setUploadType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#0e0e24] border border-white/[0.08] text-xs text-slate-200 focus:outline-none focus:border-violet-500/40"
                    >
                      <option value="lab_report">Lab Report</option>
                      <option value="prescription">Prescription</option>
                      <option value="imaging">Imaging (X-Ray, MRI, CT)</option>
                      <option value="consultation_note">Consultation Note</option>
                      <option value="diagnosis">Diagnosis</option>
                      <option value="vaccination">Vaccination Record</option>
                      <option value="discharge_summary">Discharge Summary</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Clinical Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Add brief clinical context, dosage instructions, or observations..."
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/40 resize-none"
                  />
                </div>

                {uploadError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setShowUpload(false);
                      setUploadError(null);
                    }}
                    disabled={isUploading}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.03] transition-all"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isUploading}
                    className="btn-primary text-xs flex items-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Uploading to Cloudinary...
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        Upload & Store Securely
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            placeholder="Search records by title, doctor, diagnosis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/30 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {recordTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.key}
                onClick={() => setSelectedType(type.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedType === type.key
                    ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                    : "text-slate-500 hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                <Icon size={13} />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4 animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/[0.05]" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-white/[0.05] rounded w-1/3" />
                <div className="h-3 bg-white/[0.02] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Records List */}
      {!isLoading && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="glass-card p-10 text-center space-y-3">
              <FileText size={36} className="mx-auto text-slate-600" />
              <p className="text-sm font-medium text-slate-300">No medical records found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? "No records matched your search query. Try another term or reset filters."
                  : "Upload your first lab report, prescription, or clinical scan to store it securely."}
              </p>
              {!showUpload && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="btn-outline text-xs inline-flex items-center gap-1.5 mt-2"
                >
                  <Upload size={12} />
                  Upload First Record
                </button>
              )}
            </div>
          ) : (
            filtered.map((record, i) => {
              const Icon = typeIcons[record.record_type] || FileText;
              const color = typeColors[record.record_type] || "#94a3b8";
              const date = new Date(record.created_at);
              const isCloudinary = Boolean(record.cloudinary_public_id || record.file_url);

              return (
                <motion.div
                  key={record.id}
                  onClick={() => handleViewRecord(record)}
                  className="glass-card p-4 group cursor-pointer hover:border-violet-500/25 transition-all"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ x: 2 }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}15` }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm font-medium text-slate-200 truncate">
                          {record.title}
                        </h4>
                        {record.is_encrypted && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Lock size={10} /> Signed Access
                          </span>
                        )}
                        {isCloudinary && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            Cloudinary
                          </span>
                        )}
                        {record.file_size && (
                          <span className="text-[10px] text-slate-600">
                            {(record.file_size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-1 mb-2">
                        {record.description || "No clinical description provided."}
                      </p>

                      <div className="flex items-center gap-4 text-[10px] text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User size={11} className="text-slate-600" />
                          {record.provider || "NexTwin Health"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="text-slate-600" />
                          {isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        {record.file_name && (
                          <span className="text-slate-600 truncate max-w-[150px]">
                            {record.file_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewRecord(record);
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-white/[0.04] transition-all"
                        title="View Asset"
                      >
                        <Eye size={15} />
                      </button>

                      {record.file_url && (
                        <a
                          href={record.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-white/[0.04] transition-all"
                          title="Open Download Link"
                        >
                          <Download size={15} />
                        </a>
                      )}

                      {!String(record.id).startsWith("demo-") && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRecord(record, e)}
                          className="p-2 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                          title="Delete Record"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Asset Preview Modal */}
      <AnimatePresence>
        {previewAsset && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewAsset(null)}
          >
            <motion.div
              className="glass-card max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 truncate max-w-md">
                      {previewAsset.record.title}
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Category: {previewAsset.record.record_type} • Temporary Signed Access (1 hr validity)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewAsset(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.05]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Asset Content Rendering */}
              <div className="rounded-xl bg-black/40 border border-white/[0.04] p-3 text-center min-h-[240px] flex items-center justify-center">
                {previewAsset.url.match(/\.(jpg|jpeg|png|webp)($|\?)/i) || previewAsset.record.mime_type?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewAsset.url}
                    alt={previewAsset.record.title}
                    className="max-h-[420px] max-w-full rounded-lg object-contain mx-auto shadow-2xl"
                  />
                ) : (
                  <div className="space-y-3 py-6">
                    <FileText size={48} className="mx-auto text-violet-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {previewAsset.record.file_name || "Medical Document"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        PDF or clinical data file. Open in secure viewer or download.
                      </p>
                    </div>
                    <a
                      href={previewAsset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary text-xs inline-flex items-center gap-2"
                    >
                      <ExternalLink size={13} />
                      Open Full Document
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <Shield size={13} /> Cloudinary Authenticated Delivery
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewAsset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={previewAsset.record.file_name || "medical_record"}
                    className="btn-outline text-xs flex items-center gap-1.5"
                  >
                    <Download size={13} /> Download
                  </a>
                  <button
                    onClick={() => setPreviewAsset(null)}
                    className="btn-primary text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
