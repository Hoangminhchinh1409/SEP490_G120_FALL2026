const cloudinary = require('cloudinary').v2;

const getCloudinaryConfig = () => ({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim()
});

const isCloudinaryConfigured = () => {
  const { cloud_name, api_key, api_secret } = getCloudinaryConfig();
  return Boolean(cloud_name && api_key && api_secret);
};

const assertCloudinaryConfigured = () => {
  const { cloud_name, api_key, api_secret } = getCloudinaryConfig();
  if (!cloud_name || !api_key || !api_secret) {
    const err = new Error(
      'Chưa cấu hình đầy đủ Cloudinary trên máy chủ (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET trong BE/.env). Vui lòng bổ sung khóa thật để tải ảnh/tài liệu.'
    );
    err.statusCode = 503;
    throw err;
  }
  cloudinary.config({
    cloud_name,
    api_key,
    api_secret,
    secure: true
  });
  return { cloud_name, api_key, api_secret };
};

if (isCloudinaryConfigured()) {
  const cfg = getCloudinaryConfig();
  cloudinary.config({ ...cfg, secure: true });
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  assertCloudinaryConfigured
};
