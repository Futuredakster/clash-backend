require('dotenv').config();  // LOAD ENV FIRST

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.cloudinary_cloud_name,
  api_key: process.env.cloudinary_api_key,
  api_secret: process.env.cloudinary_api_secret,
});

const { CloudinaryStorage } = require('multer-storage-cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tournaments',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
  },
});

const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'recordings',
    allowed_formats: ['mp4', 'webm', 'avi', 'mov'],
    resource_type: 'video',
  },
});



module.exports = { cloudinary, storage, videoStorage };
