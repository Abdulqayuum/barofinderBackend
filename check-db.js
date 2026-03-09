import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'barofinder'
    });

    const [cols] = await connection.query('DESCRIBE notifications');
    console.log('Notifications Columns:', cols);

    await connection.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
