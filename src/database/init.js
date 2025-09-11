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
      )`,
      
      // Paper sizes table
      `CREATE TABLE IF NOT EXISTS paper_sizes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Paper types table
      `CREATE TABLE IF NOT EXISTS paper_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Color modes table
      `CREATE TABLE IF NOT EXISTS color_modes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Print combinations table
      `CREATE TABLE IF NOT EXISTS print_combinations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paper_size_id INTEGER NOT NULL,
        paper_type_id INTEGER NOT NULL,
        color_mode_id INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        is_available BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (paper_size_id) REFERENCES paper_sizes (id),
        FOREIGN KEY (paper_type_id) REFERENCES paper_types (id),
        FOREIGN KEY (color_mode_id) REFERENCES color_modes (id),
        UNIQUE(paper_size_id, paper_type_id, color_mode_id)
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
            insertDefaultOptions().then(() => {
              console.log('Database initialization complete');
              resolve();
            }).catch(reject);
          }
        }
      );
    });
  });
};

const insertDefaultOptions = () => {
  return new Promise((resolve, reject) => {
    // Insert default paper sizes
    const paperSizes = [
      ['letter', 'Letter (8.5" x 11")', 1],
      ['legal', 'Legal (8.5" x 14")', 2],
      ['a4', 'A4 (8.27" x 11.69")', 3],
      ['11x17', '11" x 17"', 4]
    ];

    // Insert default paper types
    const paperTypes = [
      ['standard', 'Standard Paper', 1],
      ['glossy', 'Glossy Paper', 2],
      ['matte', 'Matte Paper', 3],
      ['cardstock', 'Cardstock', 4]
    ];

    // Insert default color modes
    const colorModes = [
      ['black_white', 'Black & White', 1],
      ['color', 'Color', 2]
    ];

    let completed = 0;
    const totalInserts = paperSizes.length + paperTypes.length + colorModes.length;

    // Insert paper sizes
    paperSizes.forEach(([name, displayName, sortOrder]) => {
      db.run(
        `INSERT OR IGNORE INTO paper_sizes (name, display_name, sort_order) VALUES (?, ?, ?)`,
        [name, displayName, sortOrder],
        (err) => {
          if (err) {
            console.error(`Error inserting paper size ${name}:`, err);
            reject(err);
            return;
          }
          completed++;
          if (completed === totalInserts) {
            insertDefaultCombinations().then(resolve).catch(reject);
          }
        }
      );
    });

    // Insert paper types
    paperTypes.forEach(([name, displayName, sortOrder]) => {
      db.run(
        `INSERT OR IGNORE INTO paper_types (name, display_name, sort_order) VALUES (?, ?, ?)`,
        [name, displayName, sortOrder],
        (err) => {
          if (err) {
            console.error(`Error inserting paper type ${name}:`, err);
            reject(err);
            return;
          }
          completed++;
          if (completed === totalInserts) {
            insertDefaultCombinations().then(resolve).catch(reject);
          }
        }
      );
    });

    // Insert color modes
    colorModes.forEach(([name, displayName, sortOrder]) => {
      db.run(
        `INSERT OR IGNORE INTO color_modes (name, display_name, sort_order) VALUES (?, ?, ?)`,
        [name, displayName, sortOrder],
        (err) => {
          if (err) {
            console.error(`Error inserting color mode ${name}:`, err);
            reject(err);
            return;
          }
          completed++;
          if (completed === totalInserts) {
            insertDefaultCombinations().then(resolve).catch(reject);
          }
        }
      );
    });
  });
};

const insertDefaultCombinations = () => {
  return new Promise((resolve, reject) => {
    // Get all option IDs first
    db.all(`SELECT id, name FROM paper_sizes ORDER BY sort_order`, (err, paperSizes) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.all(`SELECT id, name FROM paper_types ORDER BY sort_order`, (err, paperTypes) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.all(`SELECT id, name FROM color_modes ORDER BY sort_order`, (err, colorModes) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Create all combinations with default pricing
          const combinations = [];
          paperSizes.forEach(size => {
            paperTypes.forEach(type => {
              colorModes.forEach(color => {
                // Calculate price based on old pricing structure
                let price = 0.10; // Base price
                
                // Add paper size cost
                if (size.name === 'legal') price += 0.02;
                else if (size.name === 'a4') price += 0.01;
                else if (size.name === '11x17') price += 0.10;
                
                // Add paper type cost
                if (type.name === 'glossy') price += 0.05;
                else if (type.name === 'matte') price += 0.03;
                else if (type.name === 'cardstock') price += 0.10;
                
                // Add color cost
                if (color.name === 'color') price += 0.25;
                
                combinations.push([size.id, type.id, color.id, price, 1]);
              });
            });
          });
          
          // Insert combinations
          let completed = 0;
          combinations.forEach(([sizeId, typeId, colorId, price, available]) => {
            db.run(
              `INSERT OR IGNORE INTO print_combinations (paper_size_id, paper_type_id, color_mode_id, price, is_available) VALUES (?, ?, ?, ?, ?)`,
              [sizeId, typeId, colorId, price, available],
              (err) => {
                if (err) {
                  console.error(`Error inserting combination:`, err);
                  reject(err);
                  return;
                }
                completed++;
                if (completed === combinations.length) {
                  console.log('Default options and combinations inserted');
                  resolve();
                }
              }
            );
          });
        });
      });
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
