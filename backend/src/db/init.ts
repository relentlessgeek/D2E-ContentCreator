import { initializeDatabase, seedDefaultPrompts } from './index';

console.log('Initializing database...');
initializeDatabase();
seedDefaultPrompts();
console.log('Database setup complete!');
