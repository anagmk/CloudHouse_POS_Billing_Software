import User from '../models/User.js';
import bcrypt from 'bcrypt';

const seedUsers = async () => {
    try {
        const { ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

        if (!ADMIN_USERNAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
            console.warn('Admin env vars missing. Skipping seeding.');
            return;
        }

        const adminExists = await User.exists({ role: 'admin' });
        if (adminExists) {
            console.log('Admin already exists. Skipping seeding.');
            return;
        }

        await User.create({
            username: ADMIN_USERNAME,
            email: ADMIN_EMAIL,
            password: await bcrypt.hash(ADMIN_PASSWORD, 10),
            role: 'admin',
            isActive: true,
        });

        console.log('Admin seeded successfully.');
    } catch (error) {
        console.error('Error seeding users:', error);
    }
};

export default seedUsers;