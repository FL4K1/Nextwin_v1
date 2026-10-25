"""
NexTwin Centralized Cloudinary Media Service.
Handles validation, upload, signed URL generation, and deletion
for medical records, consultation attachments, and user avatars.
"""

import os
import re
import uuid
import logging
from typing import Dict, Any, Optional, Tuple
from django.conf import settings

logger = logging.getLogger(__name__)

# Try importing cloudinary safely without crashing if not installed
try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.utils
    CLOUDINARY_AVAILABLE = True
except ImportError:
    cloudinary = None
    CLOUDINARY_AVAILABLE = False


class MediaServiceError(Exception):
    """Base exception for media service operations."""
    status_code = 500
    default_message = "Media service error"

    def __init__(self, message: Optional[str] = None):
        super().__init__(message or self.default_message)
        self.message = message or self.default_message


class CloudinaryNotConfiguredError(MediaServiceError):
    """Raised when Cloudinary credentials are missing or unconfigured."""
    status_code = 503
    default_message = "Cloudinary media service is not configured. Uploads are currently unavailable."


class MediaValidationError(MediaServiceError):
    """Raised when an uploaded file violates validation rules."""
    status_code = 400
    default_message = "Uploaded file failed validation"


class CloudinaryUploadError(MediaServiceError):
    """Raised when Cloudinary upload fails due to upstream API error or timeout."""
    status_code = 502
    default_message = "Upstream media storage error occurred during upload"


class CloudinaryDeleteError(MediaServiceError):
    """Raised when Cloudinary asset deletion fails."""
    status_code = 502
    default_message = "Upstream media storage error occurred during deletion"


class MediaCategory:
    MEDICAL_RECORD = "medical_record"
    AVATAR = "avatar"
    CONSULTATION_ATTACHMENT = "consultation_attachment"


CATEGORY_CONFIG = {
    MediaCategory.MEDICAL_RECORD: {
        "folder": "nexttwin/records",
        "access_type": "authenticated",  # Private signed delivery for patient documents
        "allowed_extensions": {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".dcm", ".txt"},
        "allowed_mimes": {
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/dicom",
            "application/octet-stream",  # DICOM files often tagged as octet-stream
            "text/plain",
        },
        "max_size_bytes": getattr(settings, "MAX_UPLOAD_SIZE_MB", 25) * 1024 * 1024,
    },
    MediaCategory.AVATAR: {
        "folder": "nexttwin/avatars",
        "access_type": "upload",  # Public delivery for user/doctor avatars
        "allowed_extensions": {".jpg", ".jpeg", ".png", ".webp"},
        "allowed_mimes": {
            "image/jpeg",
            "image/png",
            "image/webp",
        },
        "max_size_bytes": 5 * 1024 * 1024,  # 5MB
    },
    MediaCategory.CONSULTATION_ATTACHMENT: {
        "folder": "nexttwin/consultations",
        "access_type": "authenticated",
        "allowed_extensions": {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".dcm", ".txt"},
        "allowed_mimes": {
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/dicom",
            "application/octet-stream",
            "text/plain",
        },
        "max_size_bytes": getattr(settings, "MAX_UPLOAD_SIZE_MB", 25) * 1024 * 1024,
    },
}


class CloudinaryMediaService:
    """Reusable service for Cloudinary operations with strict validation and security."""

    @classmethod
    def get_credentials(cls) -> Dict[str, str]:
        """Retrieve Cloudinary credentials from settings or environment."""
        cloud_name = getattr(settings, "CLOUDINARY_CLOUD_NAME", None)
        if cloud_name is None:
            cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "")

        api_key = getattr(settings, "CLOUDINARY_API_KEY", None)
        if api_key is None:
            api_key = os.getenv("CLOUDINARY_API_KEY", "")

        api_secret = getattr(settings, "CLOUDINARY_API_SECRET", None)
        if api_secret is None:
            api_secret = os.getenv("CLOUDINARY_API_SECRET", "")

        cloudinary_url = getattr(settings, "CLOUDINARY_URL", None)
        if cloudinary_url is None:
            cloudinary_url = os.getenv("CLOUDINARY_URL", "")

        return {
            "cloud_name": cloud_name.strip(),
            "api_key": api_key.strip(),
            "api_secret": api_secret.strip(),
            "cloudinary_url": cloudinary_url.strip(),
        }

    @classmethod
    def is_configured(cls) -> bool:
        """Check if Cloudinary is configured with non-empty, non-placeholder credentials."""
        creds = cls.get_credentials()
        if creds["cloudinary_url"] and not creds["cloudinary_url"].startswith("cloudinary://your-"):
            return True

        cloud_name = creds["cloud_name"]
        api_key = creds["api_key"]
        api_secret = creds["api_secret"]

        if not cloud_name or not api_key or not api_secret:
            return False

        # Reject common placeholder values
        placeholders = {"your-cloud-name", "your-api-key", "your-api-secret", "placeholder", "xxx"}
        if any(v in placeholders for v in [cloud_name, api_key, api_secret]):
            return False

        return True

    @classmethod
    def configure(cls):
        """Initialize Cloudinary SDK configuration safely."""
        if not CLOUDINARY_AVAILABLE:
            raise CloudinaryNotConfiguredError("Cloudinary media service is not configured (Python SDK is not installed).")

        if not cls.is_configured():
            raise CloudinaryNotConfiguredError()

        creds = cls.get_credentials()
        if creds["cloudinary_url"]:
            cloudinary.config(cloudinary_url=creds["cloudinary_url"], secure=True)
        else:
            cloudinary.config(
                cloud_name=creds["cloud_name"],
                api_key=creds["api_key"],
                api_secret=creds["api_secret"],
                secure=True,
            )

    @classmethod
    def validate_file(cls, file_obj, category: str = MediaCategory.MEDICAL_RECORD) -> Tuple[str, str, int]:
        """
        Validate file presence, size, extension, and content headers.
        Returns (sanitized_filename, extension, size_in_bytes).
        """
        if not file_obj:
            raise MediaValidationError("No file was provided in the upload request.")

        # Check size
        size = getattr(file_obj, "size", 0)
        if size <= 0:
            raise MediaValidationError("The uploaded file is empty.")

        config = CATEGORY_CONFIG.get(category, CATEGORY_CONFIG[MediaCategory.MEDICAL_RECORD])
        if category == MediaCategory.AVATAR:
            max_size = 5 * 1024 * 1024
        else:
            max_mb = getattr(settings, "MAX_UPLOAD_SIZE_MB", 25)
            max_size = max_mb * 1024 * 1024

        if size > max_size:
            limit_mb = max_size / (1024 * 1024)
            raise MediaValidationError(f"File size exceeds the allowed limit of {limit_mb:.0f} MB.")

        # Check filename & extension
        raw_name = getattr(file_obj, "name", "unnamed_file")
        base_name, ext = os.path.splitext(raw_name)
        ext = ext.lower()

        allowed_exts = config["allowed_extensions"]
        if ext not in allowed_exts:
            allowed_list = ", ".join(sorted(allowed_exts))
            raise MediaValidationError(f"Unsupported file format '{ext}'. Allowed formats: {allowed_list}")

        # Check declared MIME type
        content_type = getattr(file_obj, "content_type", "").lower()
        allowed_mimes = config["allowed_mimes"]
        if content_type and content_type not in allowed_mimes:
            logger.warning(f"File {raw_name} has unexpected content-type {content_type}, verifying header magic bytes")

        # Inspect binary magic numbers
        try:
            head = file_obj.read(256)
            file_obj.seek(0)
        except Exception:
            head = b""

        if ext in {".jpg", ".jpeg"} and not head.startswith(b"\xff\xd8\xff"):
            raise MediaValidationError("File content does not match JPEG image format.")
        elif ext == ".png" and not head.startswith(b"\x89PNG\r\n\x1a\n"):
            raise MediaValidationError("File content does not match PNG image format.")
        elif ext == ".pdf" and not head.startswith(b"%PDF-"):
            raise MediaValidationError("File content does not match PDF document format.")
        elif ext == ".webp" and not (head[:4] == b"RIFF" and head[8:12] == b"WEBP"):
            raise MediaValidationError("File content does not match WEBP image format.")

        sanitized_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", raw_name)
        return sanitized_name, ext, size

    @classmethod
    def upload_file(cls, file_obj, category: str = MediaCategory.MEDICAL_RECORD, custom_filename: Optional[str] = None) -> Dict[str, Any]:
        """
        Validates and uploads a file to Cloudinary.
        Generates a server-controlled random public_id with NO sensitive patient info.
        Returns normalized asset metadata.
        """
        sanitized_name, ext, size = cls.validate_file(file_obj, category=category)
        cls.configure()

        config = CATEGORY_CONFIG.get(category, CATEGORY_CONFIG[MediaCategory.MEDICAL_RECORD])
        folder = config["folder"]
        access_type = config["access_type"]

        # Server-controlled unique public ID: nexttwin/records/<uuid4>
        random_id = uuid.uuid4().hex
        public_id = f"{folder}/{random_id}"

        # Resource type: 'image' for images, 'raw' for PDFs and other docs
        if ext in {".jpg", ".jpeg", ".png", ".webp"}:
            resource_type = "image"
        else:
            resource_type = "raw"

        upload_options = {
            "public_id": public_id,
            "resource_type": resource_type,
            "overwrite": False,
            "tags": ["nexttwin", category],
        }

        # For private/authenticated assets (medical records and consultation attachments)
        if access_type == "authenticated":
            upload_options["type"] = "authenticated"
        else:
            upload_options["type"] = "upload"

        try:
            file_obj.seek(0)
            result = cloudinary.uploader.upload(file_obj, **upload_options)
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {str(e)}")
            raise CloudinaryUploadError(f"Upload to media storage failed: {str(e)}")

        return {
            "public_id": result.get("public_id"),
            "version": result.get("version"),
            "resource_type": result.get("resource_type", resource_type),
            "format": result.get("format") or ext.lstrip("."),
            "bytes": result.get("bytes", size),
            "secure_url": result.get("secure_url", ""),
            "original_filename": custom_filename or sanitized_name,
            "access_type": access_type,
            "created_at": result.get("created_at"),
        }

    @classmethod
    def get_signed_access_url(
        cls,
        public_id: str,
        resource_type: str = "image",
        access_type: str = "authenticated",
        expires_seconds: int = 3600,
        format_ext: Optional[str] = None,
        attachment: bool = False,
    ) -> str:
        """
        Generate a signed, temporary URL for private medical assets.
        Uses Cloudinary's private_download_url for authenticated delivery,
        ensuring proper HMAC-SHA signature and expiration.
        Valid for `expires_seconds` (default: 1 hour).
        """
        if not public_id:
            return ""

        if not CLOUDINARY_AVAILABLE or not cls.is_configured():
            logger.warning("Cloudinary credentials or SDK not configured; returning empty access URL")
            return ""

        try:
            cls.configure()
            if access_type == "authenticated":
                import time
                target_format = ""
                if resource_type == "image":
                    target_format = format_ext or ""

                url = cloudinary.utils.private_download_url(
                    public_id=public_id,
                    format=target_format,
                    resource_type=resource_type,
                    type="authenticated",
                    expires_at=int(time.time()) + expires_seconds,
                    attachment=attachment,
                )
                return url
            else:
                url, _ = cloudinary.utils.cloudinary_url(
                    public_id,
                    resource_type=resource_type,
                    type="upload",
                    secure=True,
                    format=format_ext,
                )
                return url
        except Exception as e:
            logger.error(f"Failed to generate signed Cloudinary URL: {str(e)}")
            return ""

    @classmethod
    def delete_asset(cls, public_id: str, resource_type: str = "image", access_type: str = "authenticated") -> bool:
        """
        Safely delete an asset from Cloudinary.
        Returns True if deleted, False otherwise.
        """
        if not public_id:
            return True

        if not CLOUDINARY_AVAILABLE or not cls.is_configured():
            logger.warning(f"Cloudinary not configured; skipping remote delete for {public_id}")
            return True

        try:
            cls.configure()
            target_type = "authenticated" if access_type == "authenticated" else "upload"
            result = cloudinary.uploader.destroy(
                public_id,
                resource_type=resource_type,
                type=target_type,
                invalidate=True,
            )
            result_status = result.get("result")
            if result_status in {"ok", "not found"}:
                return True
            logger.warning(f"Cloudinary deletion unexpected result: {result}")
            return False
        except Exception as e:
            logger.error(f"Cloudinary asset deletion error: {str(e)}")
            raise CloudinaryDeleteError(f"Failed to delete media asset: {str(e)}")
