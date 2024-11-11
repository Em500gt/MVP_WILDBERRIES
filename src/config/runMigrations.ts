import knex from 'knex';
import dotenv from 'dotenv';
import knexConfig from './knexfile';
dotenv.config();

const db = knex(knexConfig);

(async () => {
  try {
    console.log('Running migrations...');
    await db.migrate.latest();
    console.log('Migrations completed!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await db.destroy();
  }
})();