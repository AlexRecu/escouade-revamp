import mongoose from 'mongoose';
 
export const connectDB = async () => {
  try {
    console.log('\x1b[35m%s\x1b[0m', '🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!, {
      dbName: process.env.MONGODB_DB
    });
    console.log('\x1b[32m%s\x1b[0m', '✅ MongoDB connected successfully.\n');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Error connecting to MongoDB:', error);
    process.exit(1);
  }
};
 