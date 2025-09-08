const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', '..', 'orders.db');

let db;

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
      createTables().then(resolve).catch(reject);
    });
  });
};

const createTables = () => {
  return new Promise((resolve, reject) => {
    const tables = [
      // Orders table
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number INTEGER UNIQUE NOT NULL,
        customer_first_name TEXT NOT NULL,
        customer_last_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        order_description TEXT,
        special_instructions TEXT,
        status TEXT NOT NULL DEFAULT 'received',
        pickup_date TEXT,
        pickup_time TEXT,
        created_by TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        file_path TEXT,
        file_name TEXT,
        file_size INTEGER,
        copies INTEGER DEFAULT 1,
        paper_size TEXT,
        paper_type TEXT,
        color_mode TEXT,
        double_sided BOOLEAN DEFAULT 0,
        binding_type TEXT,
        finishing_options TEXT,
        rush_order BOOLEAN DEFAULT 0,
        estimated_price DECIMAL(10,2),
        final_price DECIMAL(10,2),
        print_ready BOOLEAN DEFAULT 0
      )`,
      
      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Admin users table
      `CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    let completed = 0;
    tables.forEach((sql, index) => {
      db.run(sql, (err) => {
        if (err) {
          console.error(`Error creating table ${index + 1}:`, err);
          reject(err);
          return;
        }
        completed++;
        if (completed === tables.length) {
          insertDefaultData().then(resolve).catch(reject);
        }
      });
    });
  });
};

const insertDefaultData = () => {
  return new Promise((resolve, reject) => {
    // Insert default admin user
    const defaultPassword = 'admin123';
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
    
    db.run(
      `INSERT OR IGNORE INTO admin_users (username, password_hash) VALUES (?, ?)`,
      ['admin', hashedPassword],
      (err) => {
        if (err) {
          console.error('Error creating default admin user:', err);
          reject(err);
          return;
        }
        console.log('Default admin user created (username: admin, password: admin123)');
      }
    );

    // Insert default settings
    const defaultSettings = [
      ['display_mode', 'dark'],
      ['page_rotation_seconds', '10'],
      ['status_colors', JSON.stringify({
        received: '#3B82F6',
        paid: '#10B981',
        in_progress: '#F59E0B',
        ready_for_pickup: '#FCD34D',
        picked_up: '#6B7280',
        abandoned: '#6B7280'
      })],
      ['business_hours', JSON.stringify({
        monday: { open: '10:00', close: '18:00' },
        tuesday: { open: '10:00', close: '18:00' },
        wednesday: { open: '10:00', close: '18:00' },
        thursday: { open: '10:00', close: '18:00' },
        friday: { open: '10:00', close: '18:00' },
        saturday: { open: '10:00', close: '18:00' },
        sunday: { open: '00:00', close: '00:00' }
      })],
      ['pricing_table', JSON.stringify({
        paper_sizes: {
          'letter': 0.10,
          'legal': 0.12,
          'a4': 0.11,
          '11x17': 0.20
        },
        paper_types: {
          'standard': 0.00,
          'glossy': 0.05,
          'matte': 0.03,
          'cardstock': 0.10
        },
        color_modes: {
          'black_white': 0.00,
          'color': 0.25
        },
        binding: {
          'none': 0.00,
          'staples': 0.50,
          'spiral': 2.00,
          'comb': 1.50
        },
        finishing: {
          'none': 0.00,
          'lamination': 1.00,
          'folding': 0.25,
          'cutting': 0.50
        }
      })],
        ['pickup_settings', JSON.stringify({
          pickup_start_time: '09:00',
          pickup_end_time: '17:00',
          pickup_days: {
            sunday: false,
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: true
          },
          time_increment: '30', // 15, 30, or 60 minutes
          unavailable_dates: [] // Array of specific dates when store is closed (YYYY-MM-DD format)
        })]
    ];

    let completed = 0;
    defaultSettings.forEach(([key, value]) => {
      db.run(
        `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
        [key, value],
        (err) => {
          if (err) {
            console.error(`Error inserting setting ${key}:`, err);
            reject(err);
            return;
          }
          completed++;
          if (completed === defaultSettings.length) {
            console.log('Database initialization complete');
            resolve();
          }
        }
      );
    });
  });
};

const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

module.exports = {
  initDatabase,
  getDb
};
