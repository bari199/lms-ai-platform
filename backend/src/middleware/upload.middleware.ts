import multer from "multer";

export const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith("video/")) {
      callback(null, true);
    } else {
      callback(new Error("Only video files are allowed"));
    }
  },
});

export const thumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

export const lectureResourceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes: Record<string, string[]> = {
      "application/pdf": [".pdf"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [".pptx"],
    };

    const extension = file.originalname
      .slice(file.originalname.lastIndexOf("."))
      .toLowerCase();

    const extensions = allowedTypes[file.mimetype];

    if (extensions?.includes(extension)) {
      callback(null, true);
    } else {
      callback(new Error("Only PDF, PPT, and PPTX files are allowed"));
    }
  },
});
