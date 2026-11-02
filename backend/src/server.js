import 'dotenv/config';
import { connectDB } from './config/db.js';
import app from './app.js';
import seededAdmin from './utils/seed.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDB();
  await seededAdmin();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exitCode = 1;
});
