const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../../database/init');
const { authenticateToken } = require('./auth');
const moment = require('moment');

const router = express.Router();

// Get all orders (for display and admin)
router.get('/', (req, res) => {
  const { status, show_picked_up } = req.query;
  const db = getDb();
  
  let query = 'SELECT * FROM orders';
  let params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  } else if (show_picked_up !== 'true') {
    query += ' WHERE status NOT IN (?, ?)';
    params.push('picked_up', 'abandoned');
  }
  
  query += ' ORDER BY pickup_date ASC, order_number ASC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    // Format pickup dates for display
    const formattedRows = rows.map(row => ({
      ...row,
      pickup_date_formatted: row.pickup_date ? 
        moment(row.pickup_date).format('ddd - MMM DD') : null,
      is_ready_now: row.status === 'ready_for_pickup' && 
        moment(row.pickup_date).isBefore(moment(), 'day')
    }));
    
    res.json(formattedRows);
  });
});

// Get single order
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    if (!row) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(row);
  });
});

// Create new order
router.post('/', [
  body('customer_first_name').notEmpty().withMessage('First name is required'),
  body('customer_last_name').notEmpty().withMessage('Last name is required'),
  body('customer_phone').notEmpty().withMessage('Phone is required'),
  body('customer_email').isEmail().withMessage('Valid email is required'),
  body('customer_address').notEmpty().withMessage('Address is required'),
  body('pickup_date').notEmpty().withMessage('Pickup date is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = getDb();
  
  // Get next order number
  db.get('SELECT MAX(order_number) as max_number FROM orders', (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    const nextOrderNumber = (result.max_number || 1000) + 1;
    
    const orderData = {
      order_number: nextOrderNumber,
      customer_first_name: req.body.customer_first_name,
      customer_last_name: req.body.customer_last_name,
      customer_phone: req.body.customer_phone,
      customer_email: req.body.customer_email,
      customer_address: req.body.customer_address,
      order_description: req.body.order_description || '',
      special_instructions: req.body.special_instructions || '',
      status: req.body.status || 'received',
      pickup_date: req.body.pickup_date,
      pickup_time: req.body.pickup_time || '',
      created_by: req.body.created_by || 'public',
      notes: req.body.notes || '',
      file_path: req.body.file_path || '',
      file_name: req.body.file_name || '',
      file_size: req.body.file_size || 0,
      copies: req.body.copies || 1,
      paper_size: req.body.paper_size || '',
      paper_type: req.body.paper_type || '',
      color_mode: req.body.color_mode || '',
      double_sided: req.body.double_sided || 0,
      binding_type: req.body.binding_type || '',
      finishing_options: req.body.finishing_options || '',
      rush_order: req.body.rush_order || 0,
      estimated_price: req.body.estimated_price || 0,
      print_ready: req.body.print_ready || 0
    };
    
    const columns = Object.keys(orderData).join(', ');
    const placeholders = Object.keys(orderData).map(() => '?').join(', ');
    const values = Object.values(orderData);
    
    db.run(
      `INSERT INTO orders (${columns}) VALUES (${placeholders})`,
      values,
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }
        
        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
          io.emit('order_created', { orderId: this.lastID, orderNumber: nextOrderNumber });
        }
        
        res.status(201).json({
          message: 'Order created successfully',
          orderId: this.lastID,
          orderNumber: nextOrderNumber
        });
      }
    );
  });
});

// Partial update order (admin only) - for inline editing
router.patch('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  // Only allow specific fields for partial updates
  const allowedFields = ['status', 'pickup_date', 'pickup_time', 'notes'];
  const updateData = {};
  
  // Build update object with only allowed fields that are provided
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });
  
  // Add updated_at timestamp
  updateData.updated_at = new Date().toISOString();
  
  if (Object.keys(updateData).length === 1) { // Only updated_at
    return res.status(400).json({ message: 'No valid fields to update' });
  }
  
  const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updateData);
  values.push(id);
  
  db.run(
    `UPDATE orders SET ${setClause} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Emit real-time update
      const io = req.app.get('io');
      if (io) {
        io.emit('order_updated', { orderId: id, updates: updateData });
      }
      
      res.json({ message: 'Order updated successfully', updates: updateData });
    }
  );
});

// Update order (admin only) - full update
router.put('/:id', authenticateToken, [
  body('customer_first_name').notEmpty().withMessage('First name is required'),
  body('customer_last_name').notEmpty().withMessage('Last name is required'),
  body('customer_phone').notEmpty().withMessage('Phone is required'),
  body('customer_email').isEmail().withMessage('Valid email is required'),
  body('customer_address').notEmpty().withMessage('Address is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const db = getDb();
  
  const updateData = {
    customer_first_name: req.body.customer_first_name,
    customer_last_name: req.body.customer_last_name,
    customer_phone: req.body.customer_phone,
    customer_email: req.body.customer_email,
    customer_address: req.body.customer_address,
    order_description: req.body.order_description || '',
    special_instructions: req.body.special_instructions || '',
    status: req.body.status || 'received',
    pickup_date: req.body.pickup_date,
    pickup_time: req.body.pickup_time || '',
    notes: req.body.notes || '',
    copies: req.body.copies || 1,
    paper_size: req.body.paper_size || '',
    paper_type: req.body.paper_type || '',
    color_mode: req.body.color_mode || '',
    double_sided: req.body.double_sided || 0,
    binding_type: req.body.binding_type || '',
    finishing_options: req.body.finishing_options || '',
    rush_order: req.body.rush_order || 0,
    estimated_price: req.body.estimated_price || 0,
    final_price: req.body.final_price || 0,
    print_ready: req.body.print_ready || 0,
    updated_at: new Date().toISOString()
  };
  
  const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updateData);
  values.push(id);
  
  db.run(
    `UPDATE orders SET ${setClause} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Emit real-time update
      const io = req.app.get('io');
      if (io) {
        io.emit('order_updated', { orderId: id });
      }
      
      res.json({ message: 'Order updated successfully' });
    }
  );
});

// Delete order (admin only)
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  db.run('DELETE FROM orders WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('order_deleted', { orderId: id });
    }
    
    res.json({ message: 'Order deleted successfully' });
  });
});

// Get order statistics
router.get('/stats/summary', (req, res) => {
  const db = getDb();
  
  const query = `
    SELECT 
      status,
      COUNT(*) as count
    FROM orders 
    WHERE status NOT IN ('picked_up', 'abandoned')
    GROUP BY status
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    const stats = {
      received: 0,
      paid: 0,
      in_progress: 0,
      ready_for_pickup: 0
    };
    
    rows.forEach(row => {
      if (stats.hasOwnProperty(row.status)) {
        stats[row.status] = row.count;
      }
    });
    
    res.json(stats);
  });
});

// Export orders to CSV
router.get('/export/csv', authenticateToken, (req, res) => {
  const db = getDb();
  
  db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    // Convert to CSV
    const headers = [
      'Order Number', 'Customer Name', 'Phone', 'Email', 'Address',
      'Status', 'Pickup Date', 'Order Description', 'Special Instructions',
      'Copies', 'Paper Size', 'Paper Type', 'Color Mode', 'Double Sided',
      'Binding Type', 'Finishing Options', 'Rush Order', 'Estimated Price',
      'Final Price', 'Print Ready', 'Created At', 'Updated At', 'Notes'
    ];
    
    const csvRows = rows.map(row => [
      row.order_number,
      `${row.customer_first_name} ${row.customer_last_name}`,
      row.customer_phone,
      row.customer_email,
      row.customer_address,
      row.status,
      row.pickup_date,
      row.order_description,
      row.special_instructions,
      row.copies,
      row.paper_size,
      row.paper_type,
      row.color_mode,
      row.double_sided ? 'Yes' : 'No',
      row.binding_type,
      row.finishing_options,
      row.rush_order ? 'Yes' : 'No',
      row.estimated_price,
      row.final_price,
      row.print_ready ? 'Yes' : 'No',
      row.created_at,
      row.updated_at,
      row.notes
    ]);
    
    const csvContent = [headers, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csvContent);
  });
});

module.exports = router;
