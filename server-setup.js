const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage (basit başlangıç için)
let stockRequests = [];

// Email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.use(bodyParser.json());

// CORS for frontend requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Stock request endpoint
app.post('/api/stock-request', (req, res) => {
  const request = {
    id: Date.now(),
    ...req.body,
    created_at: new Date(),
    notified: false
  };
  
  stockRequests.push(request);
  console.log('New stock request:', request);
  
  res.json({ success: true, id: request.id });
});

// Webhook endpoint for Shopify
app.post('/webhook/inventory', (req, res) => {
  console.log('Inventory webhook received:', req.body);
  
  const variant = req.body;
  
  // Stok 0'dan fazlaya çıktı mı?
  if (variant.inventory_quantity > 0) {
    notifyCustomers(variant);
  }
  
  res.status(200).send('OK');
});

// Customer notification
function notifyCustomers(variant) {
  const pendingRequests = stockRequests.filter(
    r => r.variant_id == variant.id && !r.notified
  );
  
  pendingRequests.forEach(request => {
    sendEmail(request, variant);
    request.notified = true;
  });
  
  console.log(`Notified ${pendingRequests.length} customers for variant ${variant.id}`);
}

// Send email
function sendEmail(request, variant) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: request.email,
    subject: `🎉 ${request.product_title} - Stoğa Girdi!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">🎉 Harika Haber!</h2>
        <p>Merhaba <strong>${request.name || 'Değerli Müşterimiz'}</strong>,</p>
        <p>Talep ettiğiniz ürün stoğa girdi:</p>
        
        <div style="border: 2px solid #28a745; padding: 20px; margin: 20px 0; background: #f8fff9; border-radius: 8px;">
          <h3 style="color: #155724; margin: 0 0 10px 0;">✅ ${request.product_title}</h3>
          <p style="margin: 5px 0;"><strong>Seçenek:</strong> ${request.option || request.size || 'Genel'}</p>
          <p style="margin: 5px 0;"><strong>Durum:</strong> <span style="color: #28a745;">Stokta Mevcut!</span></p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://${process.env.STORE_URL}/products/${request.product_id}?variant=${request.variant_id}" 
             style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            🛒 Hemen Satın Al
          </a>
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;"><strong>⏰ Stok sınırlı!</strong> Bu fırsatı kaçırmayın.</p>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px; text-align: center;">
          Bu email talep ettiğiniz stok bildirimi sebebiyle gönderilmiştir.<br>
          ${process.env.STORE_NAME || 'Mağazamız'}
        </p>
      </div>
    `
  };
  
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Email error:', error);
    } else {
      console.log('Email sent to:', request.email);
    }
  });
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Stock Notification Server Running',
    total_requests: stockRequests.length,
    pending_requests: stockRequests.filter(r => !r.notified).length,
    notified_requests: stockRequests.filter(r => r.notified).length,
    uptime: process.uptime()
  });
});

// List all requests (for debugging)
app.get('/requests', (req, res) => {
  res.json(stockRequests);
});

app.listen(PORT, () => {
  console.log(`🚀 Stock Notification Server running on port ${PORT}`);
  console.log(`📧 Email configured: ${process.env.EMAIL_USER ? 'YES' : 'NO'}`);
  console.log(`🏪 Store URL: ${process.env.STORE_URL || 'NOT SET'}`);
}); 
