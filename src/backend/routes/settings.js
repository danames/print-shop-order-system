const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../../database/init');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Get all settings
router.get('/', (req, res) => {
  const db = getDb();
  
  db.all('SELECT * FROM settings', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    const settings = {};
    rows.forEach(row => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch (e) {
        settings[row.key] = row.value;
      }
    });
    
    res.json(settings);
  });
});

// Get single setting
router.get('/:key', (req, res) => {
  const { key } = req.params;
  const db = getDb();
  
  db.get('SELECT * FROM settings WHERE key = ?', [key], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    if (!row) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    try {
      const value = JSON.parse(row.value);
      res.json({ key: row.key, value });
    } catch (e) {
      res.json({ key: row.key, value: row.value });
    }
  });
});

// Update settings (admin only)
router.put('/', authenticateToken, [
  body('display_mode').optional().isIn(['dark', 'light']).withMessage('Display mode must be dark or light'),
  body('page_rotation_seconds').optional().isInt({ min: 5, max: 60 }).withMessage('Page rotation must be between 5 and 60 seconds'),
  body('status_colors').optional().isObject().withMessage('Status colors must be an object'),
  body('business_hours').optional().isObject().withMessage('Business hours must be an object'),
  body('pricing_table').optional().isObject().withMessage('Pricing table must be an object')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = getDb();
  const settings = req.body;
  
  const updatePromises = Object.entries(settings).map(([key, value]) => {
    return new Promise((resolve, reject) => {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
      
      db.run(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
        [key, valueStr, new Date().toISOString()],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  });
  
  Promise.all(updatePromises)
    .then(() => {
      // Emit real-time update
      const io = req.app.get('io');
      if (io) {
        io.emit('settings_updated', settings);
      }
      
      res.json({ message: 'Settings updated successfully' });
    })
    .catch(err => {
      console.error('Database error:', err);
      res.status(500).json({ message: 'Internal server error' });
    });
});

// Update single setting (admin only)
router.put('/:key', authenticateToken, (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  const db = getDb();
  
  const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
  
  db.run(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
    [key, valueStr, new Date().toISOString()],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      
      // Emit real-time update
      const io = req.app.get('io');
      if (io) {
        io.emit('setting_updated', { key, value });
      }
      
      res.json({ message: 'Setting updated successfully' });
    }
  );
});

module.exports = router;
