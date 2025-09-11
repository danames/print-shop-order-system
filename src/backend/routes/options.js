const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../../database/init');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Utility function to generate unique names from display names
function generateUniqueName(displayName, table, db) {
  return new Promise((resolve, reject) => {
    // Convert display name to URL-safe format
    let baseName = displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-')         // Replace spaces with hyphens
      .replace(/-+/g, '-')          // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens
    
    // If empty after cleaning, use a fallback
    if (!baseName) {
      baseName = 'option';
    }
    
    // Check for uniqueness and append number if needed
    let candidateName = baseName;
    let counter = 1;
    
    const checkUniqueness = () => {
      db.get(`SELECT id FROM ${table} WHERE name = ?`, [candidateName], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          // Name is unique
          resolve(candidateName);
        } else {
          // Name exists, try with counter
          candidateName = `${baseName}-${counter}`;
          counter++;
          checkUniqueness();
        }
      });
    };
    
    checkUniqueness();
  });
}

// Get all options (paper sizes, types, color modes)
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    
    const [paperSizes, paperTypes, colorModes] = await Promise.all([
      new Promise((resolve, reject) => {
        db.all('SELECT * FROM paper_sizes ORDER BY sort_order, name', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      new Promise((resolve, reject) => {
        db.all('SELECT * FROM paper_types ORDER BY sort_order, name', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      new Promise((resolve, reject) => {
        db.all('SELECT * FROM color_modes ORDER BY sort_order, name', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      })
    ]);

    res.json({
      paperSizes,
      paperTypes,
      colorModes
    });
  } catch (error) {
    console.error('Error fetching options:', error);
    res.status(500).json({ error: 'Failed to fetch options' });
  }
});

// Get all combinations with option details
router.get('/combinations', async (req, res) => {
  try {
    const db = getDb();
    
    const combinations = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          pc.id,
          pc.price,
          pc.is_available,
          ps.name as paper_size_name,
          ps.display_name as paper_size_display,
          pt.name as paper_type_name,
          pt.display_name as paper_type_display,
          cm.name as color_mode_name,
          cm.display_name as color_mode_display
        FROM print_combinations pc
        JOIN paper_sizes ps ON pc.paper_size_id = ps.id
        JOIN paper_types pt ON pc.paper_type_id = pt.id
        JOIN color_modes cm ON pc.color_mode_id = cm.id
        ORDER BY ps.sort_order, pt.sort_order, cm.sort_order
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(combinations);
  } catch (error) {
    console.error('Error fetching combinations:', error);
    res.status(500).json({ error: 'Failed to fetch combinations' });
  }
});

// Add new paper size
router.post('/paper-sizes', authenticateToken, [
  body('display_name').notEmpty().withMessage('Display name is required'),
  body('sort_order').optional().isInt().withMessage('Sort order must be an integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { display_name, sort_order = 0 } = req.body;
    const db = getDb();

    // Auto-generate unique name from display_name
    const name = await generateUniqueName(display_name, 'paper_sizes', db);

    db.run(
      'INSERT INTO paper_sizes (name, display_name, sort_order) VALUES (?, ?, ?)',
      [name, display_name, sort_order],
      function(err) {
        if (err) {
          console.error('Error adding paper size:', err);
          return res.status(500).json({ error: 'Failed to add paper size' });
        }
        
        // Create combinations for this new paper size
        createCombinationsForNewOption('paper_size', this.lastID, db)
          .then(() => {
            res.json({ id: this.lastID, message: 'Paper size added successfully' });
          })
          .catch(err => {
            console.error('Error creating combinations:', err);
            res.status(500).json({ error: 'Paper size added but failed to create combinations' });
          });
      }
    );
  } catch (error) {
    console.error('Error adding paper size:', error);
    res.status(500).json({ error: 'Failed to add paper size' });
  }
});

// Add new paper type
router.post('/paper-types', authenticateToken, [
  body('display_name').notEmpty().withMessage('Display name is required'),
  body('sort_order').optional().isInt().withMessage('Sort order must be an integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { display_name, sort_order = 0 } = req.body;
    const db = getDb();

    // Auto-generate unique name from display_name
    const name = await generateUniqueName(display_name, 'paper_types', db);

    db.run(
      'INSERT INTO paper_types (name, display_name, sort_order) VALUES (?, ?, ?)',
      [name, display_name, sort_order],
      function(err) {
        if (err) {
          console.error('Error adding paper type:', err);
          return res.status(500).json({ error: 'Failed to add paper type' });
        }
        
        // Create combinations for this new paper type
        createCombinationsForNewOption('paper_type', this.lastID, db)
          .then(() => {
            res.json({ id: this.lastID, message: 'Paper type added successfully' });
          })
          .catch(err => {
            console.error('Error creating combinations:', err);
            res.status(500).json({ error: 'Paper type added but failed to create combinations' });
          });
      }
    );
  } catch (error) {
    console.error('Error adding paper type:', error);
    res.status(500).json({ error: 'Failed to add paper type' });
  }
});

// Add new color mode
router.post('/color-modes', authenticateToken, [
  body('display_name').notEmpty().withMessage('Display name is required'),
  body('sort_order').optional().isInt().withMessage('Sort order must be an integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { display_name, sort_order = 0 } = req.body;
    const db = getDb();

    // Auto-generate unique name from display_name
    const name = await generateUniqueName(display_name, 'color_modes', db);

    db.run(
      'INSERT INTO color_modes (name, display_name, sort_order) VALUES (?, ?, ?)',
      [name, display_name, sort_order],
      function(err) {
        if (err) {
          console.error('Error adding color mode:', err);
          return res.status(500).json({ error: 'Failed to add color mode' });
        }
        
        // Create combinations for this new color mode
        createCombinationsForNewOption('color_mode', this.lastID, db)
          .then(() => {
            res.json({ id: this.lastID, message: 'Color mode added successfully' });
          })
          .catch(err => {
            console.error('Error creating combinations:', err);
            res.status(500).json({ error: 'Color mode added but failed to create combinations' });
          });
      }
    );
  } catch (error) {
    console.error('Error adding color mode:', error);
    res.status(500).json({ error: 'Failed to add color mode' });
  }
});

// Update combination price and availability - CLEAN IMPLEMENTATION
router.put('/combinations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { price, is_available } = req.body;
    
    console.log(`Updating combination ${id}:`, { price, is_available });
    
    // Simple validation
    if (price !== undefined && (isNaN(price) || price < 0)) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }
    
    // Build update query
    let updateFields = [];
    let values = [];
    
    if (price !== undefined) {
      updateFields.push('price = ?');
      values.push(price);
    }
    
    if (is_available !== undefined) {
      updateFields.push('is_available = ?');
      // Convert boolean to integer for SQLite
      const dbValue = (is_available === true || is_available === 'true' || is_available === 1) ? 1 : 0;
      values.push(dbValue);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const db = getDb();
    const sqlQuery = `UPDATE print_combinations SET ${updateFields.join(', ')} WHERE id = ?`;
    
    db.run(sqlQuery, values, function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to update combination' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Combination not found' });
      }
      
      console.log(`Combination ${id} updated successfully`);
      res.json({ message: 'Combination updated successfully' });
    });
  } catch (error) {
    console.error('Error updating combination:', error);
    res.status(500).json({ error: 'Failed to update combination' });
  }
});

// Update option
router.put('/:type/:id', authenticateToken, [
  body('display_name').optional().notEmpty().withMessage('Display name cannot be empty'),
  body('sort_order').optional().isInt().withMessage('Sort order must be an integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, id } = req.params;
    const { display_name, sort_order } = req.body;
    
    if (!['paper-sizes', 'paper-types', 'color-modes'].includes(type)) {
      return res.status(400).json({ error: 'Invalid option type' });
    }

    const tableMap = {
      'paper-sizes': 'paper_sizes',
      'paper-types': 'paper_types',
      'color-modes': 'color_modes'
    };

    const table = tableMap[type];
    const db = getDb();
    
    let updateFields = [];
    let values = [];
    
    if (display_name !== undefined) {
      updateFields.push('display_name = ?');
      values.push(display_name);
    }
    
    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      values.push(sort_order);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);

    db.run(
      `UPDATE ${table} SET ${updateFields.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          console.error(`Error updating ${type}:`, err);
          return res.status(500).json({ error: `Failed to update ${type}` });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: `${type} not found` });
        }
        
        res.json({ message: `${type} updated successfully` });
      }
    );
  } catch (error) {
    console.error(`Error updating ${req.params.type}:`, error);
    res.status(500).json({ error: 'Failed to update option' });
  }
});

// Delete option
router.delete('/:type/:id', authenticateToken, async (req, res) => {
  try {
    const { type, id } = req.params;
    
    if (!['paper-sizes', 'paper-types', 'color-modes'].includes(type)) {
      return res.status(400).json({ error: 'Invalid option type' });
    }

    const tableMap = {
      'paper-sizes': 'paper_sizes',
      'paper-types': 'paper_types',
      'color-modes': 'color_modes'
    };

    const table = tableMap[type];
    const db = getDb();

    // First, delete all combinations that use this option
    const idField = table === 'paper_sizes' ? 'paper_size_id' : 
                    table === 'paper_types' ? 'paper_type_id' : 
                    table === 'color_modes' ? 'color_mode_id' : null;
    db.run(
      `DELETE FROM print_combinations WHERE ${idField} = ?`,
      [id],
      (err) => {
        if (err) {
          console.error(`Error deleting combinations for ${type}:`, err);
          return res.status(500).json({ error: `Failed to delete combinations for ${type}` });
        }
        
        // Then delete the option itself
        db.run(
          `DELETE FROM ${table} WHERE id = ?`,
          [id],
          function(err) {
            if (err) {
              console.error(`Error deleting ${type}:`, err);
              return res.status(500).json({ error: `Failed to delete ${type}` });
            }
            
            if (this.changes === 0) {
              return res.status(404).json({ error: `${type} not found` });
            }
            
            res.json({ message: `${type} deleted successfully` });
          }
        );
      }
    );
  } catch (error) {
    console.error(`Error deleting ${req.params.type}:`, error);
    res.status(500).json({ error: 'Failed to delete option' });
  }
});


// Helper function to create combinations when a new option is added
async function createCombinationsForNewOption(optionType, newOptionId, db) {
  return new Promise((resolve, reject) => {
    // Get all existing options
    db.all('SELECT id FROM paper_sizes', (err, paperSizes) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.all('SELECT id FROM paper_types', (err, paperTypes) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.all('SELECT id FROM color_modes', (err, colorModes) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Create combinations for the new option
          const combinations = [];
          
          if (optionType === 'paper_size') {
            paperTypes.forEach(type => {
              colorModes.forEach(color => {
                combinations.push([newOptionId, type.id, color.id, 0.10, 1]);
              });
            });
          } else if (optionType === 'paper_type') {
            paperSizes.forEach(size => {
              colorModes.forEach(color => {
                combinations.push([size.id, newOptionId, color.id, 0.10, 1]);
              });
            });
          } else if (optionType === 'color_mode') {
            paperSizes.forEach(size => {
              paperTypes.forEach(type => {
                combinations.push([size.id, type.id, newOptionId, 0.10, 1]);
              });
            });
          }
          
          // Insert combinations
          let completed = 0;
          if (combinations.length === 0) {
            resolve();
            return;
          }
          
          combinations.forEach(([sizeId, typeId, colorId, price, available]) => {
            db.run(
              'INSERT OR IGNORE INTO print_combinations (paper_size_id, paper_type_id, color_mode_id, price, is_available) VALUES (?, ?, ?, ?, ?)',
              [sizeId, typeId, colorId, price, available],
              (err) => {
                if (err) {
                  reject(err);
                  return;
                }
                completed++;
                if (completed === combinations.length) {
                  resolve();
                }
              }
            );
          });
        });
      });
    });
  });
}


module.exports = router;
